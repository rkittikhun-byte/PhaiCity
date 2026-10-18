/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Roads and railways as smooth curves (src/render3d/city/roadCurves.ts): a road laid as a staircase of tiles is drawn
// as one smooth line through them, junctions get a plate, and its tiles draw no model of their own.

import { Mesh, Vector3 } from 'three';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { RoadCurves } from '../../src/render3d/city/roadCurves.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { networkOf } from '../../src/roadGeometry.js';
import { ZONEBIT } from '../../src/tileFlags.js';
import { registry } from '../../src/render3d/models/registry.js';
import { visibleMeshes } from '../../src/render3d/util/geometry.js';

const flat = { sample: () => 0, sampleTile: () => 0, inside: () => true } as unknown as CityHeightField;

/** A road from (2, 2) at a slant of two along for each one down, as the map lays a slanted road */
function slanted(): { snapshot: TileSnapshot; tiles: Array<[number, number]> } {
  const W = 60, snapshot = new TileSnapshot(W, 40), tiles: Array<[number, number]> = [];
  let x = 2, y = 2;
  for (let step = 0; step < 18; step++) {
    for (const [dx, dy] of [[1, 0], [1, 0], [0, 1]]) { tiles.push([x, y]); x += dx; y += dy; }
  }
  for (const [tx, ty] of tiles) snapshot.values[ty * W + tx] = 66;
  return { snapshot, tiles };
}

describe('road curves', () => {
  test('a building stood against its road, drawn smaller than its tiles, lies on a lot of all of them', () => {
    // A road along row 20, and a civic 3 x 3 (the ruler's house's tiles 414-422) on rows 16-18 above it
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[20 * W + x] = 66;
    for (let k = 0; k < 9; k++) snapshot.values[(16 + Math.floor(k / 3)) * W + 19 + k % 3] = 414 + k;
    snapshot.flags[17 * W + 20] = ZONEBIT;
    snapshot.curves = true;
    const curves = new RoadCurves(snapshot, flat);
    expect(snapshot.placement(17 * W + 20, 'central')?.posed).toBe(true);
    const lot = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'lots');
    expect(lot).toBeDefined();
    lot!.geometry.computeBoundingBox();
    const box = lot!.geometry.boundingBox!;
    // Its tiles, x 19-21 and rows 16-18, whole
    expect([box.min.x, box.max.x, box.min.z, box.max.z]).toEqual([190, 220, 160, 190]);
    curves.dispose();
  });


  test('a staircase of road tiles becomes one smooth line close to them', () => {
    const { snapshot, tiles } = slanted();
    const curves = new RoadCurves(snapshot, flat);
    expect(curves.root.children.some(child => child instanceof Mesh && child.name === 'curves')).toBe(true);
    const near = curves.roadsNear(new Vector3(300, 0, 200));
    expect(near.length).toBeGreaterThan(20);
    // Every piece heads the same way, within a few degrees: no wiggles left from the steps
    const heading = Math.atan2(2, 1);
    const middle = near.filter(p => p.x > 80 && p.x < 330);
    for (const p of middle) expect(Math.abs(p.rotation - heading)).toBeLessThan(0.12);
    // ... and it stays within about a tile of the tiles' middles
    for (const p of middle) {
      const closest = Math.min(...tiles.map(([tx, ty]) => Math.hypot((tx + 0.5) * 10 - p.x, (ty + 0.5) * 10 - p.z)));
      expect(closest).toBeLessThan(10);
    }
    curves.dispose();
  });

  test('tiles drawn as curves have no model of their own, and a changed tile draws the curves again', () => {
    const { snapshot } = slanted();
    snapshot.curves = true;
    expect(snapshot.placement(2 * 60 + 2, 'central')).toBeNull();
    snapshot.curves = false;
    expect(snapshot.placement(2 * 60 + 2, 'central')?.kind).toBe('road');
    const curves = new RoadCurves(snapshot, flat);
    const before = curves.roadsNear(new Vector3(300, 0, 200)).length;
    // A branch off the middle: a junction with a plate, and more road
    for (let y = 20; y < 30; y++) snapshot.values[y * 60 + 30] = 66;
    curves.update([25 * 60 + 30]);
    expect(curves.roadsNear(new Vector3(300, 0, 250)).length).toBeGreaterThan(0);
    expect(curves.roadsNear(new Vector3(300, 0, 200)).length).toBeGreaterThanOrEqual(before);
    curves.dispose();
  });
  test('a power line over a curved road keeps only its poles and wires, and the road runs on through it', () => {
    // A road along row 2 with a power line crossing it at (5, 2) (tile 77)
    const W = 12, snapshot = new TileSnapshot(W, 6);
    for (let x = 1; x < 10; x++) snapshot.values[2 * W + x] = 66;
    snapshot.values[2 * W + 5] = 77;
    snapshot.curves = true;
    const crossing = snapshot.placement(2 * W + 5, 'central')!;
    expect(crossing).toMatchObject({ id: 'road.power_crossing', kind: 'power' });
    expect(crossing.options.state).toBe('wires');
    const network = networkOf({ width: W, height: 6, value: (i) => snapshot.values[i], level: () => 1 }, false);
    expect(network.stretches).toHaveLength(1);
    expect(network.stretches[0].tiles).toContain(2 * W + 5);
    // The wires alone have no road under them, and a power line on a city map no laterite square
    const full = registry['road.power_crossing'].factory({ seed: 1 }), wires = registry['road.power_crossing'].factory({ seed: 1, state: 'wires' });
    expect(visibleMeshes(wires).length).toBeLessThan(visibleMeshes(full).length);
    const ground = registry['power.straight'].factory({ seed: 1 }), open = registry['power.straight'].factory({ seed: 1, state: 'open' });
    expect(visibleMeshes(open).length).toBeLessThan(visibleMeshes(ground).length);
  });
});
