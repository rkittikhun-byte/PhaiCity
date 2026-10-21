/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's buildings put down in metres stand in the 3D view where they were put (gameMap.buildings,
// src/buildings/placedBuildings.ts; docs/METRE_DRAWING_PLAN.md 2.4): their middle and turn read from there, never from a
// pose kept beside the tiles or a road found near them, so a road drawn later never moves or turns them.

import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { realUnits } from '../../src/roadGeometry.js';

/** World units a metre on a 16 m city map */
const U = 10 / 16;

/** A bare 16 m city map, 60 × 40 tiles (960 × 640 m) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11 });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}

/** The 3D view's copy of the city's map, with a road beside every building it is asked about */
function snapshotOf(core: CityCore, road: { x: number; z: number; tx: number; tz: number } | null): TileSnapshot {
  const map = core.map as any, snapshot = new TileSnapshot(map.width, map.height);
  snapshot.source = map;
  snapshot.sync(map);
  snapshot.realUnits = realUnits(16);
  snapshot.curves = true;
  snapshot.roadSnap = () => road ? { ...road, reach: 4 } as any : null;
  return snapshot;
}

describe('buildings put down in metres, in 3D', () => {
  test('a police station stands at its middle and turn as put down, whatever road lies near it', () => {
    const core = city();
    core.apply({ type: 'build', tool: 'police', x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    const tile = 15 * 60 + 20;
    // A road running north–south a few metres west of it, which would turn a building with no place of its own
    for (const road of [null, { x: 190, z: 157, tx: 0, tz: 1 }]) {
      const p = snapshotOf(core, road).placement(tile, 'central')!;
      expect(p.posed).toBe(true);
      expect(p.x).toBeCloseTo(330.4 * U, 3);
      expect(p.z).toBeCloseTo(251.7 * U, 3);
      expect(p.rotation).toBeCloseTo(0.5, 4);
    }
  });

  test('the view keeps no pose of its own for it', () => {
    const core = city();
    core.apply({ type: 'build', tool: 'police', x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    expect(snapshotOf(core, { x: 190, z: 157, tx: 0, tz: 1 }).poseToKeep(15 * 60 + 20)).toBeNull();
  });

  test('a building moved on its tiles is stood again where it was moved to, though no tile changed', () => {
    // (square to the tiles, a quarter turn to another: a building turned off the quarter turns lays the tiles of its
    // turned outline again where it goes, src/buildings/turnedFootprint.ts)
    const core = city();
    core.apply({ type: 'build', tool: 'police', x: 330.4, z: 251.7, rot: 0, stroke: 1 });
    const snapshot = snapshotOf(core, null), tile = 15 * 60 + 20;
    expect(snapshot.sync(core.map as any)).toEqual([]);
    core.apply({ type: 'move', id: 1, x: 334, z: 250, rot: Math.PI / 2, stroke: 2 });
    expect(snapshot.sync(core.map as any)).toEqual([tile]);
    const p = snapshot.placement(tile, 'central')!;
    expect(p.x).toBeCloseTo(334 * U, 3);
    expect(p.rotation).toBeCloseTo(Math.PI / 2, 4);
    expect(snapshot.sync(core.map as any)).toEqual([]);
  });
});
