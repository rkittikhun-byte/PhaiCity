/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Roads and railways as smooth curves (src/render3d/city/roadCurves.ts): a road laid as a staircase of tiles is drawn
// as one smooth line through them, junctions get a plate, and its tiles draw no model of their own.

import { Mesh, Vector3 } from 'three';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { RoadCurves } from '../../src/render3d/city/roadCurves.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { halfWidth, networkOf, roadReach } from '../../src/roadGeometry.js';
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
  test('a building stood against its road, drawn smaller than its tiles, lies on a lot as big as them, turned with it', () => {
    // A road along row 20, and a civic 3 x 3 (the ruler's house's tiles 414-422) on rows 16-18 above it
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[20 * W + x] = 66;
    for (let k = 0; k < 9; k++) snapshot.values[(16 + Math.floor(k / 3)) * W + 19 + k % 3] = 414 + k;
    snapshot.flags[17 * W + 20] = ZONEBIT;
    snapshot.curves = true;
    const curves = new RoadCurves(snapshot, flat);
    const placed = snapshot.placement(17 * W + 20, 'central')!;
    expect(placed.posed).toBe(true);
    const lot = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'lots');
    expect(lot).toBeDefined();
    lot!.geometry.computeBoundingBox();
    const box = lot!.geometry.boundingBox!;
    // As big as its tiles, three across, turned with it to face the road (rotation 0 here, the road to the south): from
    // the road's edge, just in front of it, three tiles back
    const ground = placed.ground(), front = ground.z + ground.depth / 2 + 0.6;
    expect(ground.rotation).toBeCloseTo(0);
    for (const [got, want] of [[box.min.x, ground.x - 15], [box.max.x, ground.x + 15], [box.min.z, front - 30], [box.max.z, front]])
      expect(got).toBeCloseTo(want, 4);
    expect(front).toBeLessThan(205 - 3);
    curves.dispose();
  });


  test('a crossing is one patch over both roads out past their edges, its corners rounded, kerbed where paved', () => {
    // Owner, 18 Oct 2026: "จุดแยกของถนน มันควรจะมี graphic ที่สวยงามกว่านี้"
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const W = 40, snapshot = new TileSnapshot(W, 40), levels = new Uint8Array(W * 40);
      for (let k = 5; k < 36; k++) for (const i of [20 * W + k, k * W + 20]) { snapshot.values[i] = 66; levels[i] = level; }
      snapshot.source = { roadLevels: levels } as unknown as TileSnapshot['source'];
      const curves = new RoadCurves(snapshot, flat);
      const mesh = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'curves')!;
      const position = mesh.geometry.getAttribute('position');
      // The patch's triangles and the kerbs', by how high they lie over the flat ground
      const patch: Array<Array<[number, number]>> = [], kerbs: Array<Array<[number, number]>> = [];
      for (let i = 0; i < position.count; i += 3) {
        const corners = [0, 1, 2].map((k): [number, number] => [position.getX(i + k), position.getZ(i + k)]);
        const heights = [0, 1, 2].map((k) => position.getY(i + k));
        if (heights.every((y) => Math.abs(y - 0.185) < 1e-4)) patch.push(corners);
        if (heights.every((y) => Math.abs(y - 0.186) < 1e-4)) kerbs.push(corners);
      }
      const under = ([px, pz]: [number, number]): boolean => patch.some(([a, b, c]) => {
        const side = (p: [number, number], q: [number, number]): number => (q[0] - p[0]) * (pz - p[1]) - (q[1] - p[1]) * (px - p[0]);
        const s1 = side(a, b), s2 = side(b, c), s3 = side(c, a);
        return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
      });
      // The crossing (205, 205), each road's carriageway just past the other's edge, and the rounded corners
      const half = halfWidth(level), reach = roadReach(level);
      for (const [dx, dz] of [[0, 0], [reach + 0.1, 0], [-reach - 0.1, 0], [0, reach + 0.1], [0, -reach - 0.1],
        [reach + 0.1, half * 0.8], [half + 0.3, half + 0.3], [-half - 0.3, half + 0.3]]) expect(under([205 + dx, 205 + dz])).toBe(true);
      // ... and not the ground beyond them
      expect(under([205 + 3 * reach, 205 + 3 * reach])).toBe(false);
      expect(kerbs.length > 0).toBe(level > 1);
      curves.dispose();
    }
  });

  test('mixed laterite and paved junctions follow sloped ground without changing saved roads', () => {
    const W = 40, snapshot = new TileSnapshot(W, W), levels = new Uint8Array(W * W);
    for (let k = 5; k < 36; k++) {
      snapshot.values[20 * W + k] = 66; levels[20 * W + k] = k < 20 ? 1 : 5;
      snapshot.values[k * W + 20] = 66; levels[k * W + 20] = k < 20 ? 2 : 3;
    }
    snapshot.source = { roadLevels: levels, tileSizeM: 16 } as unknown as TileSnapshot['source'];
    const savedValues = snapshot.values.slice(), savedLevels = levels.slice();
    const hill = { sample: (x: number, z: number) => x * 0.025 + z * 0.015,
      sampleTile: (_tx: number, _tz: number, x: number, z: number) => x * 0.025 + z * 0.015,
      inside: () => true } as unknown as CityHeightField;
    const curves = new RoadCurves(snapshot, hill);
    const mesh = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'curves')!;
    const position = mesh.geometry.getAttribute('position'), colour = mesh.geometry.getAttribute('color');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      expect(Number.isFinite(x + y + z + colour.getX(i) + colour.getY(i) + colour.getZ(i))).toBe(true);
      expect(y - x * 0.025 - z * 0.015).toBeGreaterThan(0.129);
    }
    expect(snapshot.values).toEqual(savedValues);
    expect(levels).toEqual(savedLevels);
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
