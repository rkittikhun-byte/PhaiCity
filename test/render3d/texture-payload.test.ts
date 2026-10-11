/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TEXTURE_CATALOG, TextureDefinition } from '../../src/render3d/materials/catalog.js';

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

describe('texture shipping budget', () => {
  const files = filesIn(resolve('assets/textures'));

  it('ships at most 15 MB, including every file and the daytime HDRI', () => {
    const bytes = files.reduce((sum, file) => sum + readFileSync(file).length, 0);
    expect(bytes).toBeLessThanOrEqual(15_000_000);
  });

  it('contains no byte-identical files', () => {
    const hashes = new Map<string, string>();
    const duplicates: string[][] = [];
    for (const file of files) {
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
      const existing = hashes.get(hash);
      if (existing) duplicates.push([existing, file]);
      else hashes.set(hash, file);
    }
    expect(duplicates).toEqual([]);
  });

  it('shares source files and packs the three scalar channels into source ORM maps', () => {
    const available = new Set(files);
    for (const entry of Object.values(TEXTURE_CATALOG) as TextureDefinition[]) {
      for (const [channel, asset] of Object.entries(entry.maps)) {
        expect(asset.file).toMatch(/^assets\/textures\/sources\/[^/]+\//);
        expect(available.has(resolve(asset.file))).toBe(true);
        if (['ao', 'roughness', 'metalness'].includes(channel)) {
          expect(asset.file).toMatch(/\/orm\.jpg$/);
          expect(asset.identity).toMatch(/:ORM$/);
        }
      }
      if (entry.maps.ao && entry.maps.roughness && entry.maps.ao.identity === entry.maps.roughness.identity) {
        expect(entry.maps.ao).toEqual(entry.maps.roughness);
      }
    }
    expect(TEXTURE_CATALOG.plaster_white.maps).toEqual(TEXTURE_CATALOG.plaster_cream.maps);
    expect(TEXTURE_CATALOG.glass_clear.maps).toEqual(TEXTURE_CATALOG.water_river.maps);
    expect(TEXTURE_CATALOG.roof_cement_tile.maps.roughness).toEqual(TEXTURE_CATALOG.concrete_raw.maps.roughness);
    expect(TEXTURE_CATALOG.roof_cement_tile.maps.ao).toEqual(TEXTURE_CATALOG.roof_metal_corrugated.maps.ao);
    expect(TEXTURE_CATALOG.roof_cement_tile.maps.ao.meters).not.toEqual(TEXTURE_CATALOG.roof_cement_tile.maps.roughness.meters);
  });
});
