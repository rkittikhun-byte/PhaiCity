/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every building of the ruler's stands with its front against the edge of the road it faces (owner, 21 Oct 2026:
// "object ก็ไม่ชิดกับถนน"; src/render3d/city/tileModels.ts toRoadEdge): the ruler's house, its wings beside and behind it,
// the schools, hospitals, police and fire stations, water works, power plants and rubbish works, drawn by their era's
// model or by their own, beside a straight road and a slanted one, where the game's square block of tiles stood the
// place they were put down back from the road. Each front is measured from what is drawn: an era model's 47 m lot
// (art/buildings/PLAN.md), the house's own fence, or the box of the model itself.

import { Box3, Vector3 } from 'three';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EraModels, type EraIndex, parseEraId } from '../../src/render3d/city/eraBuildings.js';
import { BUILDING_SCALE, ROAD_GAP, type RoadNear, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import type { Placement } from '../../src/render3d/city/placement.js';
import { registry } from '../../src/render3d/models/registry.js';
import { disposeModel } from '../../src/render3d/util/geometry.js';
import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { realUnits } from '../../src/roadGeometry.js';
import { besideRoad } from '../../src/cityCommands';
import { blockOf } from '../../src/buildings/placedBuildings';
import { isRoadTile } from '../../src/roadTiles';
import { RoadCurves } from '../../src/render3d/city/roadCurves.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';

const flat = { sample: () => 0, sampleTile: () => 0, inside: () => true } as unknown as CityHeightField;

const index = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;
/** World units a metre on a 16 m city map */
const U = 10 / 16;
/** The road's half width (world units) */
const REACH = 4;

/** A straight road through (x0, z0) running (tx, tz), as the 3D view's road lines answer where it is nearest */
function road(x0: number, z0: number, angle: number) {
  const tx = Math.cos(angle), tz = Math.sin(angle);
  const snap = (x: number, z: number, reach: number): RoadNear | null => {
    const t = (x - x0) * tx + (z - z0) * tz, px = x0 + tx * t, pz = z0 + tz * t;
    return Math.hypot(px - x, pz - z) <= reach ? { x: px, z: pz, tx, tz, reach: REACH } : null;
  };
  /** How far a point lies from the road's middle line, on the side away from it (+) */
  const off = (x: number, z: number): number => (x - x0) * -tz + (z - z0) * tx;
  return { snap, off, tx, tz };
}

/** A bare 16 m city map where anything may be built (a sandbox), in its second era */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  const core = new CityCore({ map, seed: 11, sandbox: true });
  core.simulation.budget.setFunds(10000000);
  (core.map as any).needsRulerHouse = false;
  (core.map as any).era = 2;
  return core;
}

/**
 * The building a tool puts down beside a road (through (300, 245), a tile's middle), where the game's outline put it
 * (src/game.js buildingPose): turned to face the road, its middle as far from the road's middle as its road, 0.6 and half
 * its tiles as drawn, stood back a metre at a time while its square block of tiles would cover the road's tiles or stand
 * beside none (a slanted road's staircase); then the 3D view's placement of it.
 */
function built(tool: string, size: number, angle: number, era: boolean) {
  const core = city(), r = road(300, 245, angle), map = core.map as any;
  // The road's tiles: those whose middle lies on it, a staircase where it slants
  for (let ty = 0; ty < map.height; ty++) for (let tx = 0; tx < map.width; tx++) {
    if (Math.abs(r.off((tx + 0.5) * 10, (ty + 0.5) * 10)) <= (angle ? 7.1 : 5)) map.setTile(tx, ty, 66, 0);
  }
  const isRoad = (tx: number, ty: number): boolean => map.testBounds(tx, ty) && isRoadTile(map.getTileValue(tx, ty));
  // ... a point on the road, and out from it on the side away from it
  const nx = -r.tz, nz = r.tx;
  let gap = REACH + 0.6 + size * 5 * BUILDING_SCALE, back = 0;
  for (; back <= 24; back++) {
    const g = gap + back * U, block = blockOf(300 + nx * g, 245 + nz * g, size, 10);
    let clear = true;
    for (let ty = block.top; ty < block.top + size; ty++) for (let tx = block.left; tx < block.left + size; tx++) clear &&= !isRoad(tx, ty);
    if (clear && besideRoad(map.width, map.height, isRoad, block.cx, block.cy, size)) break;
  }
  gap += back * U;
  const x = 300 + nx * gap, z = 245 + nz * gap, rot = Math.atan2(-nx, -nz);
  const outcome = core.apply({ type: 'build', tool: tool as never, x: x / U, z: z / U, rot, stroke: 1 });
  expect([tool, outcome]).toEqual([tool, expect.objectContaining({ accepted: true })]);
  const b = [...map.buildings.all()][0];
  const snapshot = new TileSnapshot(map.width, map.height);
  snapshot.source = map;
  snapshot.sync(map);
  snapshot.realUnits = realUnits(16);
  snapshot.curves = true;
  snapshot.roadSnap = r.snap;
  if (era) snapshot.eraModels = new EraModels(index);
  return { core, map, snapshot, p: snapshot.placement(b.tile, 'central')!, r, back };
}

/** How far ahead of its middle a placement's front stands as drawn: an era model's lot, the house's fence, else its model's own box */
function frontOf(p: Placement): number {
  const era = parseEraId(p.id);
  // (the ruler's house drawn smaller than its lot, by its level: its own fence, 23.4 m from its middle at full size)
  if (era?.kind === 'ruler_house') return 23.4 * p.scale;
  if (era) return (index.kinds[era.kind].tiles * 16 / 2 - 0.5) * p.scale;
  const root = registry[p.id!].factory(p.options), box = new Box3().setFromObject(root);
  disposeModel(root);
  return box.max.z * p.scale;
}

/** The gap between a placement's front and the road's edge (world units) */
function gapToRoad(p: Placement, r: ReturnType<typeof road>, front = frontOf(p)): number {
  const ahead = new Vector3(Math.sin(p.rotation), 0, Math.cos(p.rotation));
  return r.off(p.x + ahead.x * front, p.z + ahead.z * front) - REACH;
}

const KINDS: [string, number][] = [['ruler_house', 3], ['primary_school', 3], ['health_centre', 3], ['police', 3], ['fire', 3],
  ['waterworks', 3], ['coal', 4], ['landfill', 3], ['incinerator', 3]];

describe('buildings against their road', () => {
  jest.setTimeout(120000);

  test.each([0, Math.PI / 4])('every kind stands its front at the road edge (a road at %f rad)', angle => {
    const wrong: string[] = [];
    for (const era of [true, false]) for (const [tool, size] of KINDS) {
      const { p, r, back } = built(tool, size, angle, era);
      expect(p.posed).toBe(true);
      // faces the road
      expect(Math.abs(Math.sin(p.rotation) * r.tx + Math.cos(p.rotation) * r.tz)).toBeLessThan(1e-3);
      // ... against its edge: no gap and no overhang, to a tenth of a metre past ROAD_GAP
      const gap = gapToRoad(p, r);
      if (Math.abs(gap - ROAD_GAP) >= 0.1 * U) wrong.push(`${tool} as ${p.id}, put down ${back} m back: its front ${(gap / U).toFixed(2)} m from the road`);
    }
    expect(wrong).toEqual([]);
  });

  test.each([1, 6])("a level-%i ruler's house stands its fence at the road edge, its wings beside and behind it", level => {
    for (const angle of [0, Math.PI / 4]) {
      const { map, snapshot, r } = built('ruler_house', 3, angle, true);
      map.rulerHouse.level = level;
      map.rulerHouse.wings = ['council_hall', 'treasury', 'planning_office', 'warning_tower', 'granary', 'culture_court', 'front_garden'];
      snapshot.sync(map);
      const p = snapshot.placement(map.rulerHouse.y * map.width + map.rulerHouse.x, 'central')!;
      expect(p.id).toBe('era.2.ruler_house');
      const fence = 23.4 * p.scale;
      const houseFront = gapToRoad(p, r, fence);
      expect(Math.abs(houseFront - ROAD_GAP)).toBeLessThan(0.1 * U);
      expect(p.parts!.length).toBe(7);
      // No wing nearer the road than the house's front
      for (const part of p.parts!) {
        const root = registry[part.id!].factory({ region: 'central' }), box = new Box3().setFromObject(root);
        disposeModel(root);
        expect([part.id, gapToRoad(part, r, box.max.z * part.scale) >= houseFront + 0.5 * U]).toEqual([part.id, true]);
      }
    }
  });

  test('every kind lies on a lot as big as it is drawn, never bigger than the tiles it takes', () => {
    // Owner, 21 Oct 2026: "พื้นที่รอบข้าง object มันเกินที่ๆ กำหนดหรือป่าว ต้องย่อให้เท่าๆ กับที่สร้างได้พอดี"
    const wrong: string[] = [];
    for (const angle of [0, Math.PI / 4]) for (const era of [true, false]) for (const [tool, size] of KINDS) {
      const { snapshot } = built(tool, size, angle, era);
      // (the road curves stand the buildings against their own lines of the road's tiles)
      const curves = new RoadCurves(snapshot, flat);
      try {
        const b = [...(snapshot.source as any).buildings.all()][0], p = snapshot.placement(b.tile, 'central')!;
        const rect = curves.lotAt(b.tile)!;
        expect(rect).not.toBeNull();
        const across = Math.hypot(rect[1][0] - rect[0][0], rect[1][1] - rect[0][1]);
        const deep = Math.hypot(rect[3][0] - rect[0][0], rect[3][1] - rect[0][1]);
        // ... the model's own front, sides and back (an era model's 47 m lot, a model's own site)
        const front = frontOf(p);
        if (Math.abs(across - 2 * front) > 0.1 * U || Math.abs(deep - 2 * front) > 0.1 * U || across > size * 10 || deep > size * 10) {
          wrong.push(`${tool} as ${p.id}: lot ${(across / U).toFixed(1)} x ${(deep / U).toFixed(1)} m, drawn ${(2 * front / U).toFixed(1)} m`);
        }
        // ... its front where the building's is
        const ahead = (rect[2][0] + rect[3][0]) / 2, aheadZ = (rect[2][1] + rect[3][1]) / 2;
        expect(Math.hypot(ahead - (p.x + Math.sin(p.rotation) * p.front!), aheadZ - (p.z + Math.cos(p.rotation) * p.front!))).toBeLessThan(1e-3);
      } finally { curves.dispose(); }
    }
    expect(wrong).toEqual([]);
  });

  test('a building at a corner, its side to a road, stays where it was put; with no road it stays too', () => {
    const { p, snapshot, map, r } = built('police', 3, 0, true);
    // the road along its side, not across its front
    snapshot.roadSnap = road(p.x + 30, 245, Math.PI / 2).snap;
    snapshot.sync(map);
    const side = snapshot.placement(p.index, 'central')!;
    snapshot.roadSnap = () => null;
    const none = snapshot.placement(p.index, 'central')!;
    expect(none.x).toBeCloseTo(side.x, 6);
    expect(none.z).toBeCloseTo(side.z, 6);
    void r;
  });
});
