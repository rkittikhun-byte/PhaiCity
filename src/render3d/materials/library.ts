/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  Color, ColorRepresentation, DoubleSide, Material, MeshPhysicalMaterial,
  MeshStandardMaterial, MeshStandardMaterialParameters,
} from 'three';
import { getWaterNormal, loadMaterialTextures, TextureSet } from './textures.js';
export { SHOPHOUSE_PASTELS, shophousePastel } from './palette.js';

const definitions = {
  plaster_white: { color: 0xeee9df, roughness: 0.9 },
  plaster_cream: { color: 0xe7d6af, roughness: 0.9 },
  plaster_tint: { color: 0xffffff, roughness: 0.9 },
  concrete_raw: { color: 0xaaa99f, roughness: 0.95 },
  concrete_weathered: { color: 0x89877b, roughness: 1 },
  brick_red: { color: 0xa95c40, roughness: 0.95 },
  roof_clay_tile: { color: 0xb45532, roughness: 0.85 },
  roof_cement_tile: { color: 0x8b8f88, roughness: 0.9 },
  roof_metal_corrugated: { color: 0xaeb9bb, roughness: 0.6, metalness: 0.65 },
  roof_metal_rusty: { color: 0x94583b, roughness: 0.95, metalness: 0.25 },
  roof_metal_sheet: { color: 0x566c73, roughness: 0.4, metalness: 0.75 },
  wood_teak: { color: 0x865b32, roughness: 0.85 },
  wood_painted: { color: 0xb2c3b4, roughness: 0.85 },
  metal_steel: { color: 0x6d797c, roughness: 0.45, metalness: 0.85 },
  metal_painted: { color: 0x506966, roughness: 0.55, metalness: 0.35 },
  roller_shutter: { color: 0x9fa8a9, roughness: 0.65, metalness: 0.65 },
  glass_clear: { color: 0xd1e8ee, roughness: 0.15 },
  glass_tinted: { color: 0x547784, roughness: 0.2 },
  asphalt: { color: 0x414546, roughness: 1 },
  road_marking_white: { color: 0xeeeade, roughness: 0.9 },
  road_marking_yellow: { color: 0xe7bb43, roughness: 0.9 },
  sidewalk_tile: { color: 0xc2b7a4, roughness: 0.95 },
  curb_red_white: { color: 0xce6257, roughness: 0.95 },
  grass: { color: 0x748a4c, roughness: 1 },
  dirt_laterite: { color: 0xb9683e, roughness: 1 },
  gravel_ballast: { color: 0x88867e, roughness: 1 },
  water_river: { color: 0x53766a, roughness: 0.3 },
  water_flood: { color: 0x927951, roughness: 0.4 },
  foliage_tropical: { color: 0x8aad73, roughness: 0.95, side: DoubleSide, alphaTest: 0.45 },
  fabric_canvas: { color: 0xc79b60, roughness: 1, side: DoubleSide },
  sign_thai: { color: 0xe4ddc3, roughness: 0.85 },
  emissive_window: { color: 0xffdca1, emissive: 0xffb75e, emissiveIntensity: 0.15, roughness: 0.4 },
} satisfies Record<string, MeshStandardMaterialParameters>;

export type MaterialKey = keyof typeof definitions;
export const MATERIAL_KEYS = Object.freeze(Object.keys(definitions) as MaterialKey[]);
const cache = new Map<string, MeshStandardMaterial>();
const owned = new WeakSet<Material>();
const pending = new Map<MaterialKey, Promise<boolean>>();
const statuses = new Map<MaterialKey, 'loading' | 'ready' | 'fallback'>();
let nightMode = false;
let previewGround: MeshStandardMaterial | undefined;

/** Neutral diagnostic backdrop, kept outside the 32 model-facing material keys. */
export function getPreviewGround(): MeshStandardMaterial {
  if (!previewGround) {
    previewGround = new MeshStandardMaterial({ color: 0xd9ddd1, roughness: 1 });
    previewGround.name = 'gallery/ground';
    owned.add(previewGround);
  }
  return previewGround;
}

function applyTextures(material: MeshStandardMaterial, key: MaterialKey, maps: TextureSet): void {
  const painted = ['road_marking_white', 'road_marking_yellow', 'sign_thai', 'emissive_window', 'curb_red_white'].includes(key);
  if (!material.userData.keepColorMap && !painted) material.map = maps.color ?? null;
  material.normalMap = maps.normal ?? null;
  // Shared ORM images use three.js's native R (AO), G (roughness), B (metalness).
  // A composite material can retain separate source repeats, such as cement roofing.
  material.roughnessMap = maps.roughness ?? null;
  material.aoMap = maps.ao ?? null;
  material.aoMapIntensity = 0.65;
  material.metalnessMap = maps.metalness ?? null;
  material.alphaMap = maps.alpha ?? null;
  if (material.map && !material.userData.tinted && !material.userData.keepColorMap &&
    !['plaster_white', 'plaster_cream', 'plaster_tint', 'roof_cement_tile', 'wood_painted'].includes(key)) material.color.setHex(0xffffff);
  material.normalScale.setScalar(key.startsWith('glass_') ? 0.025 : key === 'fabric_canvas' ? 0.35 : 0.65);
  if (key.startsWith('water_')) {
    material.normalMap = getWaterNormal();
    material.normalScale.setScalar(0.65);
    material.envMapIntensity = 1.4;
  }
  if (key === 'roof_cement_tile') material.metalness = 0;
  if (maps.alpha) material.alphaTest = 0.45;
  if (key.startsWith('plaster_') || key === 'roof_cement_tile') {
    // A neutral painted coat retains scan grain while keeping seeded pastels legible.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float grain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.62 + 0.38 * grain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-painted-scan';
  }
  if (key === 'curb_red_white') {
    if (!material.userData.tinted) material.color.setHex(0xffffff);
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 curbPosition;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ncurbPosition = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 curbPosition;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float band = mod(floor(curbPosition.x / 0.5), 2.0);
          diffuseColor.rgb *= mix(vec3(0.68, 0.055, 0.04), vec3(0.88, 0.86, 0.80), band);`);
    };
    material.customProgramCacheKey = () => 'phaicity-curb-bands';
  }
  material.needsUpdate = true;
}

/** Returns immediately in Node; failures retain all original flat PBR parameters. */
export function whenMaterialReady(key: MaterialKey): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const cached = pending.get(key);
  if (cached) return cached;
  statuses.set(key, 'loading');
  const promise = loadMaterialTextures(key).then(maps => {
    statuses.set(key, maps ? 'ready' : 'fallback');
    if (maps) cache.forEach(material => {
      if (material.userData.materialKey === key) applyTextures(material, key, maps);
    });
    return Boolean(maps);
  });
  pending.set(key, promise);
  return promise;
}

export function materialTextureStatus(key: MaterialKey): string {
  return statuses.get(key) ?? 'flat';
}

/** A shared flat fallback is available immediately; local PBR maps arrive lazily. */
export function getMaterial(key: MaterialKey): MeshStandardMaterial {
  const cached = cache.get(key);
  if (cached) { void whenMaterialReady(key); return cached; }
  const definition = definitions[key];
  const material = key === 'glass_clear' || key === 'glass_tinted'
    ? new MeshPhysicalMaterial({ ...definition, transmission: key === 'glass_clear' ? 0.9 : 0.65, thickness: 0.15, ior: 1.5 })
    : new MeshStandardMaterial(definition);
  material.name = key;
  material.userData.materialKey = key;
  owned.add(material);
  cache.set(key, material);
  applyNight(material);
  void whenMaterialReady(key);
  return material;
}

/** Cached clones are library-owned; models must never clone or construct materials. */
export function tint(key: MaterialKey, color: ColorRepresentation): MeshStandardMaterial {
  const resolved = new Color(color);
  const cacheKey = `${key}#${resolved.getHexString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const material = getMaterial(key).clone();
  material.color.copy(resolved);
  material.name = cacheKey;
  material.userData.tinted = true;
  material.onBeforeCompile = getMaterial(key).onBeforeCompile;
  material.customProgramCacheKey = getMaterial(key).customProgramCacheKey;
  owned.add(material);
  cache.set(cacheKey, material);
  // Also handles clones requested after the base's lazy loading has completed.
  void whenMaterialReady(key).then(ready => {
    if (ready) void loadMaterialTextures(key).then(maps => { if (maps) applyTextures(material, key, maps); });
  });
  return material;
}

/** Canvas signs are cached and constructed here so models use only library materials. */
export function signMaterial(token: string, configure: (material: MeshStandardMaterial) => void): MeshStandardMaterial {
  const cacheKey = `sign_thai:${token}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const material = getMaterial('sign_thai').clone();
  material.name = cacheKey;
  configure(material);
  owned.add(material);
  cache.set(cacheKey, material);
  applyNight(material);
  void whenMaterialReady('sign_thai').then(ready => {
    if (ready) void loadMaterialTextures('sign_thai').then(maps => { if (maps) applyTextures(material, 'sign_thai', maps); });
  });
  return material;
}

export function isLibraryMaterial(material: Material): boolean {
  return owned.has(material);
}

/** Shared lighting setting: update existing materials and future tinted instances. */
export function setNightMode(night: boolean): void {
  nightMode = night;
  cache.forEach(applyNight);
}

function applyNight(material: MeshStandardMaterial): void {
  if (material.userData.materialKey === 'emissive_window') material.emissiveIntensity = nightMode ? 2.5 : 0.15;
  if (material.userData.litSign) material.emissiveIntensity = nightMode ? 1.6 : 0.3;
}
