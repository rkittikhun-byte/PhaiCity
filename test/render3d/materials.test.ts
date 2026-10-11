/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CanvasTexture, Texture, TextureLoader } from 'three';
import { DAY_SKY_URL, TEXTURE_CATALOG, TextureDefinition } from '../../src/render3d/materials/catalog.js';
import { getMaterial, isLibraryMaterial, MATERIAL_KEYS, materialTextureStatus, setNightMode, shophousePastel, SHOPHOUSE_PASTELS, tint, whenMaterialReady } from '../../src/render3d/materials/library.js';
import { FICTIONAL_THAI_SIGNS, thaiSign } from '../../src/render3d/materials/signs.js';
import { loadTexture } from '../../src/render3d/materials/textures.js';

/** Read JPEG SOF dimensions without adding a browser or an image decoder dependency. */
function jpegDimensions(bytes: Buffer): [number, number] {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Not a JPEG');
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    let marker = bytes[offset++];
    while (marker === 0xff) marker = bytes[offset++];
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    offset += length;
  }
  throw new Error('No JPEG dimensions');
}

describe('bundled licensed assets', () => {
  it('covers every material with local, genuine 1K maps and source credits', () => {
    expect(Object.keys(TEXTURE_CATALOG).sort()).toEqual([...MATERIAL_KEYS].sort());
    const credits = readFileSync(resolve('assets/CREDITS.md'), 'utf8');
    for (const key of MATERIAL_KEYS) {
      const entry: TextureDefinition = TEXTURE_CATALOG[key];
      expect(credits).toContain('`' + key + '`');
      entry.sources.forEach(source => expect(credits).toContain(source));
      expect(entry.maps.normal).toBeDefined();
      expect(entry.maps.roughness).toBeDefined();
      Object.values(entry.maps).forEach(asset => {
        const dimensions = jpegDimensions(readFileSync(resolve(asset.file)));
        // Poly Haven's 1K Cotton Jersey export is 1024 × 1025, preserving scan aspect.
        expect(Math.max(...dimensions)).toBeGreaterThanOrEqual(1024);
        expect(Math.max(...dimensions)).toBeLessThanOrEqual(1025);
        expect(Math.min(...dimensions)).toBeGreaterThan(0);
        expect(asset.meters.every(value => Number.isFinite(value) && value > 0)).toBe(true);
      });
    }
    expect(TEXTURE_CATALOG.foliage_tropical.maps.alpha).toBeDefined();
    const sky = readFileSync(resolve(DAY_SKY_URL));
    expect(sky.subarray(0, 100).toString()).toContain('#?RADIANCE');
    expect(sky.subarray(0, 250).toString()).toMatch(/-Y 512 \+X 1024/);
    for (const weight of ['Regular', 'Bold']) expect(existsSync(resolve(`assets/fonts/Sarabun-${weight}.ttf`))).toBe(true);
    expect(readFileSync(resolve('assets/fonts/OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('provides 40 distinct Thai texts and 12 reproducible pastel choices', () => {
    expect(FICTIONAL_THAI_SIGNS).toHaveLength(40);
    expect(new Set(FICTIONAL_THAI_SIGNS).size).toBe(40);
    FICTIONAL_THAI_SIGNS.forEach(text => expect(text).toMatch(/[ก-๙]/));
    expect(SHOPHOUSE_PASTELS).toHaveLength(12);
    expect(new Set(SHOPHOUSE_PASTELS.map(entry => entry.color)).size).toBe(12);
    const selections = Array.from({ length: 128 }, (_, seed) => shophousePastel(seed));
    expect(new Set(selections).size).toBe(12);
    expect(selections).toEqual(Array.from({ length: 128 }, (_, seed) => shophousePastel(seed)));
  });
});

describe('headless fallback and lazy loading', () => {
  afterEach(() => { jest.restoreAllMocks(); delete (globalThis as { document?: unknown }).document; });

  it('does not request images without a document and keeps tinted materials cached', async () => {
    const loader = jest.spyOn(TextureLoader.prototype, 'load');
    for (const key of MATERIAL_KEYS) expect(await whenMaterialReady(key)).toBe(false);
    expect(await loadTexture('/not-present.jpg')).toBeNull();
    expect(thaiSign('ห้องว่าง')).toBe(getMaterial('sign_thai'));
    expect(tint('plaster_tint', '#aabbcc')).toBe(tint('plaster_tint', 0xaabbcc));
    const lit = thaiSign('ครัวลมเย็น', '#dddddd', '#224433', [4, 1], { lit: true });
    expect(lit.map).toBeNull(); expect(isLibraryMaterial(lit)).toBe(true);
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads once, supplies already-created tints, and shares scans across keys', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {} });
    const callbacks: Array<() => void> = [];
    const loader = jest.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, loaded) => {
      const texture = new Texture<HTMLImageElement>(); callbacks.push(() => loaded?.(texture)); return texture;
    });
    const base = getMaterial('plaster_white');
    const clone = tint('plaster_white', '#ddbbaa');
    expect(base.map).toBeNull(); expect(clone.map).toBeNull();
    callbacks.forEach(callback => callback());
    expect(await whenMaterialReady('plaster_white')).toBe(true);
    expect(clone.map).toBe(base.map); expect(clone.normalMap).toBe(base.normalMap);
    expect(clone.color.getHex()).toBe(0xddbbaa);
    const late = tint('plaster_white', '#abcdef');
    expect(late.map).toBe(base.map);
    const requests = loader.mock.calls.length;
    getMaterial('plaster_cream'); await whenMaterialReady('plaster_cream');
    expect(loader).toHaveBeenCalledTimes(requests);
    expect(getMaterial('plaster_cream').map).toBe(base.map);
  });

  it('keeps a complete flat fallback if any map fails, without repeated requests', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {} });
    const loader = jest.spyOn(TextureLoader.prototype, 'load').mockImplementation((url, loaded, _progress, failed) => {
      const texture = new Texture<HTMLImageElement>();
      if (String(url).endsWith('normal.jpg')) failed?.(new Error('404')); else loaded?.(texture);
      return texture;
    });
    const material = getMaterial('brick_red'), color = material.color.getHex();
    expect(await whenMaterialReady('brick_red')).toBe(false);
    expect([material.map, material.normalMap, material.roughnessMap, material.aoMap]).toEqual([null, null, null, null]);
    expect(material.color.getHex()).toBe(color);
    expect(materialTextureStatus('brick_red')).toBe('fallback');
    const calls = loader.mock.calls.length;
    getMaterial('brick_red'); await whenMaterialReady('brick_red');
    expect(loader).toHaveBeenCalledTimes(calls);
  });

  it('supports day/night for both existing and future lit materials', () => {
    setNightMode(true);
    const window = tint('emissive_window', '#ffedc0');
    const sign = thaiSign('ร้านน้ำชา', '#edddbb', '#244433', [4, 1], { lit: true });
    expect(window.emissiveIntensity).toBe(2.5); expect(sign.emissiveIntensity).toBe(1.6);
    setNightMode(false);
    expect(window.emissiveIntensity).toBe(0.15); expect(sign.emissiveIntensity).toBe(0.3);
    expect(() => thaiSign('ป้าย', 0xffffff, 0x000000, [0, 1])).toThrow(RangeError);
  });
});

describe('Thai canvas signs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { FontFace?: unknown }).FontFace;
  });

  it('uses the bundled Thai font for horizontal/vertical signs, caches canvases and lights them', async () => {
    const fillText = jest.fn();
    const context = { fillRect: jest.fn(), fillText, measureText: (text: string) => ({ width: text.length * 60 }) };
    const createElement = jest.fn(() => ({ width: 0, height: 0, getContext: () => context }));
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement, fonts: { add: jest.fn() } } });
    Object.defineProperty(globalThis, 'FontFace', { configurable: true, value: class {
      load(): Promise<this> { return Promise.resolve(this); }
    } });
    // Avoid browser image creation while this test supplies only a canvas surface.
    jest.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, loaded) => {
      const texture = new Texture<HTMLImageElement>(); loaded?.(texture); return texture;
    });
    const horizontal = thaiSign('ข้าวมันไก่', '#eeddaa', '#225533', [4, 1]);
    const vertical = thaiSign('ห้องว่าง', '#eeddaa', '#225533', [1, 4], { layout: 'vertical', lit: true });
    // Allow the font load and canvas completion chain to settle.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(horizontal.map).toBeInstanceOf(CanvasTexture);
    expect(vertical.map).toBeInstanceOf(CanvasTexture);
    const horizontalCanvas = (horizontal.map as Texture<HTMLCanvasElement>).image;
    const verticalCanvas = (vertical.map as Texture<HTMLCanvasElement>).image;
    expect(horizontalCanvas.width).toBe(1024); expect(horizontalCanvas.height).toBe(256);
    expect(verticalCanvas.width).toBe(256); expect(verticalCanvas.height).toBe(1024);
    expect(vertical.emissiveMap).toBe(vertical.map);
    expect(fillText.mock.calls.some(([line]) => line === 'ข้าวมันไก่')).toBe(true);
    expect(fillText.mock.calls.length).toBeGreaterThan(2);
    const calls = createElement.mock.calls.length;
    expect(thaiSign('ข้าวมันไก่', 0xeeddaa, 0x225533, [4, 1])).toBe(horizontal);
    expect(createElement).toHaveBeenCalledTimes(calls);
    expect(isLibraryMaterial(vertical)).toBe(true);
  });
});
