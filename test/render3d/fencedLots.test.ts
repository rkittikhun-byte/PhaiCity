/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What a building of the ruler's is drawn on lies inside the fence round what it holds (owner, 21 Oct 2026: "ถ้าพื้นที่
// ที่กันไว้ ก็ควรจะมีพื้นที่กั้นไว้นะ"; docs/design/LOOK_BOOK.md "ที่ที่อาคารจองไว้แต่ดูว่างเปล่า"): a house laid a tile at a
// time beside a slanted road (as the auto player lays it) stands square on its square block, not turned past it with
// its lawn over the fence; one kept turned past its block before is drawn square and kept square again; one turned
// with its tiles stands on its turned outline; and no building is slid toward its road past the ground it holds.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { compoundSides } from '../../src/render3d/city/compounds.js';
import { SLIDE_PAST_M, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { RoadCurves } from '../../src/render3d/city/roadCurves.js';
import { EraModels, type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { isTurned, laidOutline, outlineOf, outsideBy } from '../../src/buildings/turnedFootprint.js';
import { realUnits, roadReach } from '../../src/roadGeometry.js';

const flat = { sample: () => 0, sampleTile: () => 0, inside: () => true } as unknown as CityHeightField;
const index = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;
const W = 60, H = 50, M = 16, U = 10 / 16;

/** A bare 16 m city map, era 2, with a road through (cx, 400) m at `angle` */
function city(angle: number, cx = 480) {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.tileSizeM = M; map.paintedZones = true; map.cellZones = true; map.era = 2;
  const core = new CityCore({ map, seed: 3, sandbox: true });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  const tx = Math.cos(angle), tz = Math.sin(angle);
  core.apply({ type: 'road', tool: 'road', from: [cx - tx * 400, 400 - tz * 399], to: [cx + tx * 400, 400 + tz * 399], stroke: 1 } as any);
  return { core, map: core.map as any, tx, tz };
}

/** The 3D view's snapshot of the map, its roads drawn as curves the buildings stand against */
function view(map: any) {
  const snapshot = new TileSnapshot(W, H);
  snapshot.source = map; snapshot.sync(map);
  snapshot.realUnits = realUnits(M); snapshot.eraModels = new EraModels(index); snapshot.curves = true;
  const curves = new RoadCurves(snapshot, flat);
  snapshot.roadSnap = (x, z, reach) => curves.nearest(x, z, reach);
  snapshot.sync(map);
  return { snapshot, curves };
}

/** The fence round what a building holds (compounds.ts), as an outline in metres */
function fence(map: any, b: any) {
  const sides = compoundSides(b, W, M, laidOutline(map, b));
  const x = sides.reduce((a, s) => a + s.ax, 0) / 4, z = sides.reduce((a, s) => a + s.az, 0) / 4;
  return outlineOf(x, z, -Math.atan2(sides[1].az - sides[0].az, sides[1].ax - sides[0].ax), b.size, M);
}

/** How far the building's drawn lot (its lawn) reaches past its fence, metres */
function pastFence(map: any, snapshot: TileSnapshot, curves: RoadCurves, b: any): number {
  void snapshot;
  const lot = curves.lotAt(b.tile);
  expect(lot).not.toBeNull();
  const o = fence(map, b);
  return Math.max(...lot!.map(([x, z]) => outsideBy(o, x / U, z / U)));
}

const quarter = (rot: number): boolean => !isTurned(rot);

describe('a building of the ruler\'s is drawn inside its fence', () => {
  test.each([Math.PI / 4, Math.PI / 6, Math.PI / 8])('a house laid a tile at a time beside a road at %f rad stands square on its block', angle => {
    const { core, map, tx, tz } = city(angle);
    // the first tile out from the road that takes a house beside it, as the auto player finds one
    let laid = false;
    for (let d = 20; d <= 60 && !laid; d += 4) {
      const x = 480 - tz * d, z = 400 + tx * d;
      laid = core.apply({ type: 'tool', tool: 'ruler_house', x: Math.floor(x / M), y: Math.floor(z / M) } as any).toolResult === 0;
    }
    expect(laid).toBe(true);
    const b = map.buildings.all()[0];
    expect(b.rot).toBeNull();
    const { snapshot, curves } = view(map);
    try {
      const p = snapshot.placement(b.tile, 'central')!;
      expect(p.posed).toBe(true);
      expect(quarter(p.rotation)).toBe(true);
      expect(pastFence(map, snapshot, curves, b)).toBeLessThanOrEqual(SLIDE_PAST_M + 1e-6);
      // ... and the game keeps it there, on its block and square to it: its kept outline its tiles'
      const kept = snapshot.poseToKeep(b.tile)!;
      expect(kept).not.toBeNull();
      expect(quarter(kept[2])).toBe(true);
      const cx = b.tile % W, cy = Math.floor(b.tile / W);
      expect([kept[0], kept[1]]).toEqual([(cx + 0.5) * 10, (cy + 0.5) * 10]);
    } finally { curves.dispose(); }
  });

  test('one kept turned past its square block before is drawn square, and kept square again', () => {
    const { core, map, tx, tz } = city(Math.PI / 4);
    let laid = false;
    for (let d = 20; d <= 60 && !laid; d += 4) {
      laid = core.apply({ type: 'tool', tool: 'ruler_house', x: Math.floor((480 - tz * d) / M), y: Math.floor((400 + tx * d) / M) } as any).toolResult === 0;
    }
    const b = map.buildings.all()[0];
    // (as the game kept it from the view's turned drawing before: turned to the road, slid to it)
    map.buildings.setPose(b.id, b.x + 5, b.z - 5, 2.356);
    expect(laidOutline(map, map.buildings.get(b.id))).toBeNull();
    const { snapshot, curves } = view(map);
    try {
      const p = snapshot.placement(b.tile, 'central')!;
      expect(quarter(p.rotation)).toBe(true);
      expect(pastFence(map, snapshot, curves, map.buildings.get(b.id))).toBeLessThanOrEqual(SLIDE_PAST_M + 1e-6);
      const kept = snapshot.poseToKeep(b.tile)!;
      expect(quarter(kept[2])).toBe(true);
      expect(Math.abs(kept[2] - p.rotation)).toBeLessThan(1e-9);
    } finally { curves.dispose(); }
  });

  test('a house put down turned to its road stands on its turned outline', () => {
    const { core, map, tx, tz } = city(Math.PI / 4);
    const nx = -tz, nz = tx, gap = roadReach(1, U) / U + 1 + 24;
    const pose = { x: 480 + nx * gap, z: 400 + nz * gap, rot: Math.round(Math.atan2(-nx, -nz) * 1000) / 1000 };
    expect(core.apply({ type: 'build', tool: 'ruler_house', ...pose, stroke: 2 } as any).accepted).toBe(true);
    const b = map.buildings.all()[0];
    expect(laidOutline(map, b)).not.toBeNull();
    const { snapshot, curves } = view(map);
    try {
      const p = snapshot.placement(b.tile, 'central')!;
      expect(Math.abs(p.rotation - pose.rot)).toBeLessThan(1e-6);
      expect(pastFence(map, snapshot, curves, b)).toBeLessThanOrEqual(SLIDE_PAST_M + 1e-6);
      expect(snapshot.poseToKeep(b.tile)).toBeNull();
    } finally { curves.dispose(); }
  });

  test.each([0, 6, -6])('a house put down square to a straight road, slid %i m along it, stands on its fence', slide => {
    const { core, map } = city(Math.PI / 2, 488);
    // the road runs down a column's middle, x = 488 m; the house east of it, facing west, its middle `slide` m along it
    const gap = 8 + 24, pose = { x: 488 + gap, z: 392 + slide, rot: -Math.PI / 2 };
    expect(core.apply({ type: 'build', tool: 'ruler_house', ...pose, stroke: 2 } as any).toolResult).toBe(0);
    const b = map.buildings.all()[0];
    // its fence its outline where it was put down, which takes in the square block of tiles it holds
    const held = laidOutline(map, b)!;
    expect(held).not.toBeNull();
    expect([held.x, held.z]).toEqual([pose.x, pose.z]);
    const { snapshot, curves } = view(map);
    try {
      expect(pastFence(map, snapshot, curves, b)).toBeLessThanOrEqual(SLIDE_PAST_M + 1e-6);
      expect(snapshot.poseToKeep(b.tile)).toBeNull();
    } finally { curves.dispose(); }
  });

  test('one kept slid off its square block before stands on the block', () => {
    const { core, map } = city(Math.PI / 2, 488);
    let laid = false;
    for (let x = 31; x <= 34 && !laid; x++) laid = core.apply({ type: 'tool', tool: 'ruler_house', x, y: 24 } as any).toolResult === 0;
    const b = map.buildings.all()[0];
    // (as the view once slid it to its road and the game kept that: square, 12 m off its block)
    map.buildings.setPose(b.id, b.x - 12, b.z, -Math.PI / 2);
    expect(laidOutline(map, map.buildings.get(b.id))).toBeNull();
    const { snapshot, curves } = view(map);
    try {
      expect(pastFence(map, snapshot, curves, map.buildings.get(b.id))).toBeLessThanOrEqual(SLIDE_PAST_M + 1e-6);
      const cx = b.tile % W, cy = Math.floor(b.tile / W);
      expect(snapshot.poseToKeep(b.tile)).toEqual([(cx + 0.5) * 10, (cy + 0.5) * 10, -Math.PI / 2]);
    } finally { curves.dispose(); }
  });

  test('a building behind a straight road\'s second row of tiles is not slid past its fence', () => {
    // a road on a tile boundary: its tiles two rows, the block beside it a whole tile from the road's edge
    const { core, map } = city(0);
    let laid = false;
    for (let y = 26; y <= 30 && !laid; y++) laid = core.apply({ type: 'tool', tool: 'police', x: 30, y } as any).toolResult === 0;
    expect(laid).toBe(true);
    const b = map.buildings.all()[0];
    const { snapshot, curves } = view(map);
    try {
      const p = snapshot.placement(b.tile, 'central')!;
      expect(p.posed).toBe(true);
      expect(pastFence(map, snapshot, curves, b)).toBeLessThanOrEqual(SLIDE_PAST_M + 1e-6);
    } finally { curves.dispose(); }
  });
});
