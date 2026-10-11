/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { DataTexture, RepeatWrapping, RGBAFormat, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { TEXTURE_CATALOG, TextureAsset, TextureDefinition } from './catalog.js';

const cache = new Map<string, Promise<Texture | null>>();
type Channel = keyof TextureDefinition['maps'];
export type TextureSet = Partial<Record<Channel, Texture>>;
const sets = new Map<string, Promise<TextureSet | null>>();
let waterNormal: Texture | undefined;

/** No I/O at import time. Identical CC0 scans share textures across material keys. */
export function loadTexture(url: string, colorMap = false, asset?: TextureAsset): Promise<Texture | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const key = `${asset?.identity ?? url}:${colorMap}:${asset?.meters.join(',') ?? '1,1'}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = new Promise<Texture | null>(resolve => {
    try {
      new TextureLoader().load(url, texture => {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.repeat.set(1 / (asset?.meters[0] ?? 1), 1 / (asset?.meters[1] ?? 1));
        texture.anisotropy = 4;
        if (colorMap) texture.colorSpace = SRGBColorSpace;
        resolve(texture);
      }, undefined, () => resolve(null));
    } catch { resolve(null); }
  });
  cache.set(key, pending);
  return pending;
}

/** Commit a complete map set together; any failed channel leaves a flat material. */
export function loadMaterialTextures(key: keyof typeof TEXTURE_CATALOG): Promise<TextureSet | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const cached = sets.get(key);
  if (cached) return cached;
  const definition: TextureDefinition = TEXTURE_CATALOG[key];
  const pending = Promise.all(Object.entries(definition.maps).map(async ([channel, asset]) =>
    [channel, await loadTexture(asset.file, channel === 'color', asset)] as const,
  )).then(entries => {
    if (entries.some(([, texture]) => !texture)) return null;
    return Object.fromEntries(entries) as TextureSet;
  });
  sets.set(key, pending);
  return pending;
}

/** Periodic analytic wave slopes: seamless water normals, generated only on demand. */
export function getWaterNormal(): Texture {
  if (waterNormal) return waterNormal;
  const size = 1024, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const nx = 0.15 * Math.cos(3 * u + v) + 0.075 * Math.cos(7 * u - 4 * v);
    const ny = 0.05 * Math.cos(3 * u + v) - 0.043 * Math.cos(7 * u - 4 * v);
    const length = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    data[i] = Math.round((nx / length * 0.5 + 0.5) * 255);
    data[i + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
    data[i + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
    data[i + 3] = 255;
  }
  waterNormal = new DataTexture(data, size, size, RGBAFormat);
  waterNormal.wrapS = waterNormal.wrapT = RepeatWrapping;
  waterNormal.needsUpdate = true;
  return waterNormal;
}
