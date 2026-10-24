/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Frontage (src/render3d/city/frontage.ts, docs/METRE_DRAWING_PLAN.md 3.3): a painted plot's building by how many 4 m
// cells run side by side along its road: a shophouse bay on every cell, joined into one terrace across plots, a 12 m
// house on a run of three, the full-tile model where nothing fits.

import { Matrix4, Vector3 } from 'three';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CityCore } from '../../src/core/cityCore';
import { MapGenerator } from '../../src/mapGenerator.js';
import { plotOf } from '../../src/plots';
import { joinNeighbour, putPlotLevel } from '../../src/plotBuildings';
import { cellsOf } from '../../src/zoneCells';
import { BAY_LEVELS, bayRow, FRONTAGE_KINDS, frontagePlan, houseSize } from '../../src/render3d/city/frontage.js';
import { EraModels, type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import { FrontagePlacement, type Placement } from '../../src/render3d/city/placement.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';

const realIndex = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;
/** An index with every frontage kind in every era for the central region, as the game's will have */
function frontageIndex(): EraIndex {
  const buildings: Record<string, Record<string, Record<string, { height: number; triangles: number }>>> = {};
  for (let era = 1; era <= 5; era++) {
    const central: Record<string, { height: number; triangles: number }> = { ...realIndex.buildings[`era${era}`].central };
    for (const kind of FRONTAGE_KINDS) central[kind] = { height: kind.startsWith('bay2') ? 14 : 9, triangles: 1200 };
    buildings[`era${era}`] = { central };
  }
  return { ...realIndex, buildings };
}

/** A bare 16 m map painted in cells, with a straight road along row 10 (its middle at z = 105) */
function city() {
  const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
  map.tileSizeM = 16;
  map.paintedZones = true;
  map.cellZones = true;
  map.era = 3;
  const core = new CityCore({ map, seed: 3 });
  core.simulation.budget.setFunds(50000);
  for (let x = 2; x < 58; x++) core.apply({ type: 'tool', tool: 'road', x, y: 10 });
  expect(core.apply({ type: 'tool', tool: 'ruler_house' as any, x: 4, y: 8 }).accepted).toBe(true);
  return core;
}

/** The cells south of the road whose middles lie between x0 and x1 (world units), every row */
const south = (core: CityCore, x0: number, x1: number) =>
  cellsOf(core.map as any).cells.filter(c => c.x > x0 && c.x < x1 && c.z > 106 && c.z < 140);

/** The front row's columns south of the road on tile tx, by their middles' x */
const columnsOn = (core: CityCore, tx: number) =>
  [...new Set(south(core, tx * 10, tx * 10 + 10).filter(c => c.row === 0).map(c => Math.round(c.x * 100) / 100))].sort((a, b) => a - b);

function paint(core: CityCore, zone: 'residential' | 'commercial', x0: number, x1: number): void {
  expect(core.apply({ type: 'zoneCells', zone, cells: south(core, x0, x1).map(c => c.key) }).accepted).toBe(true);
}

/** Every plot counted on row 11 between x0 and x1 grown to a level: the plots of the list this map keeps
 * (src/plotBuildings.ts, docs/NO_GRID_PLAN.md 3B) */
function grow(core: CityCore, x0: number, x1: number, level: number): void {
  const list = (core.map as any).plotBuildings;
  for (const p of list.all()) {
    const anchor = list.places.get(p.id)?.anchor;
    if (anchor === undefined) continue;
    const x = anchor % core.map.width, y = Math.floor(anchor / core.map.width);
    if (y === 11 && x >= x0 && x <= x1) putPlotLevel(core.map as any, p, level);
  }
}

function snapshot(core: CityCore, index = frontageIndex()): TileSnapshot {
  const s = new TileSnapshot(core.map.width, core.map.height);
  s.source = core.map as never;
  s.realUnits = 10 / 16;
  s.sync(core.map as never);
  s.eraModels = new EraModels(index);
  return s;
}

/** Every building the plots on row 11 draw, x0..x1, with their tiles */
function drawn(s: TileSnapshot, x0: number, x1: number): Array<Placement & { tile: number }> {
  const out: Array<Placement & { tile: number }> = [];
  for (let x = x0; x <= x1; x++) {
    const p = s.placement(11 * s.width + x, 'central');
    if (!p) continue;
    for (const q of [p, ...(p.parts ?? [])]) if (q.id?.startsWith("era.")) out.push(Object.assign(q, { tile: x }));
  }
  return out;
}

const kindOf = (p: Placement): string => p.id!.split('.')[2];
/** In the order a building's own -X to +X runs: its left to its right as seen from the road (the plots here face north,
 * so that is east to west) */
const leftToRight = (a: Placement, b: Placement): number =>
  (a.x * Math.cos(a.rotation) - a.z * Math.sin(a.rotation)) - (b.x * Math.cos(b.rotation) - b.z * Math.sin(b.rotation));

describe('frontage: era models by the painted cells along the road', () => {
  // Owner, 24 Oct 2026: "การเปลี่ยนยุค ต้องมีก่อสร้างด้วย": an era rebuild wraps the old look in scaffold, then is a site
  test("a building rebuilt in the next era's look stands in its old look in a scaffold, then as a site, then anew", () => {
    const core = city();
    paint(core, 'commercial', 200, 260);
    grow(core, 0, 59, 2);
    const list = (core.map as any).plotBuildings, anchor = list.places.get(list.all()[0].id).anchor;
    const map = core.map as any;
    map.buildingEras = new Uint8Array(map.width * map.height).fill(0); map.buildingEras[anchor] = 2;
    map.eraRebuilds = { [anchor]: { from: 1, since: 0, months: 4 } };
    const at = (now: number): Placement[] => { map.eraRebuildNow = now; const s = snapshot(core); s.enableConstruction = true; list.now = 1e6;
      const p = s.placement(anchor, 'central'); return p ? [p, ...(p.parts ?? [])] : []; };
    const early = at(2);
    expect(early.some(q => String(q.options.state).startsWith('scaffold:e1'))).toBe(true);
    expect(early.filter(q => q.id?.startsWith('era.')).every(q => q.id!.startsWith('era.1.'))).toBe(true);
    expect(at(10).some(q => String(q.options.state).startsWith('stage_2:e2'))).toBe(true);
    const done = at(16);
    expect(done.some(q => String(q.options.state).startsWith('scaffold') || String(q.options.state).startsWith('stage'))).toBe(false);
  });

  // Owner, 24 Oct 2026: a building goes up through its stages, and one its people left stands, dark, until bulldozed
  test("a plot's building going up is a construction site in its era's way; one its people left stands dark", () => {
    const core = city();
    paint(core, 'commercial', 200, 260);
    const list = (core.map as any).plotBuildings, plots = list.all().filter((p: any) => list.places.get(p.id)?.anchor !== undefined);
    for (const p of plots) putPlotLevel(core.map as any, p, 2, 1, 0);
    const s = snapshot(core); s.enableConstruction = true;
    const states = (): string[] => { const out: string[] = []; for (let x = 0; x < s.width; x++) {
      const p = s.placement(11 * s.width + x, 'central'); for (const q of p ? [p, ...(p.parts ?? [])] : []) if (q.kind === 'commercial') out.push(String(q.options.state)); } return out; };
    list.now = 1;
    expect(states().some(st => st.startsWith('stage_1:e'))).toBe(true);
    list.now = 1000;
    expect([...new Set(states())]).toEqual(['closed']);
    // its people leave: the building still stands, drawn with no light
    for (const p of plots) putPlotLevel(core.map as any, p, 0, 1, 2000);
    const s2 = snapshot(core); s2.enableConstruction = true; list.now = 2000;
    const standing = drawn(s2, 0, s2.width - 1);
    expect(standing.length).toBeGreaterThan(0);
    for (const p of standing) expect(p.powered).toBe(false);
    // ... and run down, rubbish lies by its door
    list.now = 2000 + 12 * 4;
    const rubbish: string[] = [];
    for (let x = 0; x < s2.width; x++) { const p = s2.placement(11 * s2.width + x, 'central'); for (const q of p ? [p, ...(p.parts ?? [])] : []) if (q.id === 'terrain.rubble') rubbish.push(q.id); }
    expect(rubbish.length).toBeGreaterThan(0);
    // ... its walls faded and stained (Placement.weather, drawn by materials/library.ts)
    const weathered = drawn(s2, 0, s2.width - 1);
    expect(weathered.length).toBeGreaterThan(0);
    for (const p of weathered) expect(p.wear).toBe(1);
  });

  test('a shop street is a terrace of shophouse bays, one on every 4 m cell, joined across its plots', () => {
    const core = city();
    paint(core, 'commercial', 120, 180);
    grow(core, 12, 17, 2);
    const s = snapshot(core);
    const bays = drawn(s, 11, 18).sort(leftToRight);
    // Every painted column has its bay, 4 m (2.5 units) apart, a plot deep from the road's row of cells
    const columns = [11, 12, 13, 14, 15, 16, 17, 18].reduce((n, tx) => n + (plotOf(core.map as any, tx, 11) ? columnsOn(core, tx).length : 0), 0);
    expect(bays.length).toBeGreaterThanOrEqual(columns);
    expect(bays.length).toBeGreaterThanOrEqual(20);
    for (let i = 1; i < bays.length; i++) expect(Math.abs(bays[i].x - bays[i - 1].x)).toBeCloseTo(2.5, 1);
    // ... at their real size (16 m model tile drawn 10 units), facing the road to the north
    for (const b of bays) {
      expect(b.id).toMatch(/^era\.3\.bay1_/);
      expect(b.scale).toBeCloseTo(10 / 16);
      expect(Math.abs(Math.abs(b.rotation) - Math.PI)).toBeLessThan(1e-6);
      // the building's front (its +Z, 8 m from its middle) on the first row's front edge, beside the road
      const front = new Vector3(0, 0, 8).applyMatrix4(b.modelMatrix(new Matrix4()));
      expect(front.z).toBeGreaterThan(105);
      expect(front.z).toBeLessThan(110);
    }
    // One terrace: end walls only at its ends, the middle bays taking turns
    const kinds = bays.map(kindOf);
    expect(kinds[0]).toBe('bay1_left');
    expect(kinds[kinds.length - 1]).toBe('bay1_right');
    for (const k of kinds.slice(1, -1)) expect(['bay1_mid', 'bay1_mid2']).toContain(k);
    for (let i = 2; i < kinds.length - 1; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    // A plot's first building carries the rest as its parts, and its ground and far box are the whole run's
    const p = s.placement(11 * s.width + 14, 'central') as FrontagePlacement;
    expect(p).toBeInstanceOf(FrontagePlacement);
    const ground = p.ground();
    expect(ground.width).toBeCloseTo(2.5 * (1 + (p.parts?.length ?? 0)), 1);
    expect(ground.depth).toBeCloseTo(10);
  });

  test('a taller level takes the taller row, and the bays still join the lower ones', () => {
    const core = city();
    paint(core, 'commercial', 120, 160);
    grow(core, 12, 15, 2);
    grow(core, 14, 14, 4);
    const s = snapshot(core);
    const tall = drawn(s, 14, 14), low = drawn(s, 12, 13);
    expect(tall.every(b => kindOf(b).startsWith('bay2_'))).toBe(true);
    expect(low.every(b => kindOf(b).startsWith('bay1_'))).toBe(true);
    // the tall plot's bays are in the middle of the terrace: no end walls
    expect(tall.map(kindOf).filter(k => /left|right|one/.test(k))).toEqual([]);
  });

  test('a bay alone stands with both end walls; a plot past the bays\' levels keeps its full-tile model', () => {
    const core = city();
    // Two columns of shop paint with a gap between them: two bays, each alone
    const cols = columnsOn(core, 20);
    paint(core, 'commercial', cols[0] - 1, cols[0] + 1);
    paint(core, 'commercial', cols[2] - 1, cols[2] + 1);
    grow(core, 20, 20, 1);
    const s = snapshot(core);
    expect(drawn(s, 20, 20).map(kindOf)).toEqual(['bay1_one', 'bay1_one']);
    // ... next to each other they join, once the shop painted between them is built
    paint(core, 'commercial', cols[1] - 1, cols[1] + 1);
    grow(core, 20, 20, 1);
    s.sync(core.map as never);
    expect(drawn(s, 20, 20).sort(leftToRight).map(kindOf)).toEqual(['bay1_left', 'bay1_mid', 'bay1_right']);
    // ... in era 4 a level-3 shop is an office tower, the era's tile model, on a plot a tile wide: the three bays and
    // the fourth column joined into one (src/plotBuildings.ts needColumns, joinNeighbour)
    (core.map as any).era = 4;
    paint(core, 'commercial', cols[3] - 1, cols[3] + 1);
    const list = (core.map as any).plotBuildings, shops = list.all().filter((p: any) => list.places.get(p.id)?.anchor === 11 * s.width + 20);
    const first = shops[0];
    while (joinNeighbour(core.map as any, list, first));
    expect(first.columns.length).toBe(4);
    putPlotLevel(core.map as any, first, 3);
    s.sync(core.map as never);
    const tower = s.placement(11 * s.width + 20, 'central')!;
    expect(tower.id).toBe('era.4.shop_3');
    expect(tower.parts).toEqual([]);
    // ... and with no frontage models in the index every plot keeps its tile model
    (core.map as any).era = 3;
    grow(core, 20, 20, 1);
    const index = frontageIndex();
    for (const region of Object.values(index.buildings.era3)) for (const kind of FRONTAGE_KINDS) delete (region as Record<string, unknown>)[kind];
    const plain = snapshot(core, index);
    expect(plain.placement(11 * s.width + 20, 'central')!.id).toBe('era.3.shop_1');
  });

  test('paint beside a plot, three cells of a column, is a plot of its own that joins the terrace once it grows', () => {
    // (where the plots are a list, docs/NO_GRID_PLAN.md 3B.1: one row of paint is enough, and no paint is left over
    // for a plot beside it to draw)
    const core = city();
    const cols = columnsOn(core, 30), next = columnsOn(core, 31);
    paint(core, 'commercial', 300, 310);
    const stub = south(core, next[0] - 1, next[0] + 1).filter(c => c.row < 3).map(c => c.key);
    expect(stub.length).toBe(3);
    expect(core.apply({ type: 'zoneCells', zone: 'commercial', cells: stub }).accepted).toBe(true);
    expect(plotOf(core.map as any, 31, 11)).toMatchObject({ kind: 'commercial', level: 0 });
    grow(core, 30, 30, 2);
    const s = snapshot(core);
    let bays = drawn(s, 29, 32);
    expect(bays.length).toBe(cols.length);
    expect(bays.sort(leftToRight).map(kindOf)[0]).toBe('bay1_left');
    grow(core, 31, 31, 2);
    s.sync(core.map as never);
    bays = drawn(s, 29, 32);
    expect(bays.length).toBe(cols.length + 1);
    const kinds = bays.sort(leftToRight).map(kindOf);
    expect(kinds[0]).toBe('bay1_left');
    expect(kinds[kinds.length - 1]).toBe('bay1_right');
  });

  test('a home on three cells along its road is a 12 m house; on four it keeps its tile model', () => {
    const core = city();
    const cols = columnsOn(core, 40);
    expect(cols.length).toBe(4);
    paint(core, 'residential', cols[0] - 1, cols[2] + 1);
    grow(core, 40, 40, 2);
    const s = snapshot(core);
    const house = s.placement(11 * s.width + 40, 'central')!;
    expect(house.id).toBe('era.3.house12_2');
    expect(house.parts).toEqual([]);
    // standing on the middle column
    expect(house.x).toBeCloseTo(cols[1], 1);
    expect(house.ground().width).toBeCloseTo(7.5);
    // level 1 is the smaller house; four columns keep the full-tile home
    grow(core, 40, 40, 1);
    s.sync(core.map as never);
    expect(s.placement(11 * s.width + 40, 'central')!.id).toBe('era.3.house12_1');
    // ... a fourth column painted beside it is a plot of its own, an empty lot, and the house stays
    // (src/plotBuildings.ts: a plot keeps its columns)
    paint(core, 'residential', cols[3] - 1, cols[3] + 1);
    s.sync(core.map as never);
    expect(s.placement(11 * s.width + 40, 'central')!.id).toBe('era.3.house12_1');
    expect((core.map as any).plotBuildings.all().map((p: any) => p.columns.length)).toEqual([3, 1]);
  });

  test('one column of shop paint the whole plot deep is a plot of its own: a lone shophouse bay', () => {
    const core = city();
    const cols = columnsOn(core, 24);
    paint(core, 'commercial', cols[1] - 1, cols[1] + 1);
    expect(plotOf(core.map as any, 24, 11)).toMatchObject({ kind: 'commercial' });
    grow(core, 24, 24, 1);
    const s = snapshot(core);
    const bays = drawn(s, 23, 25);
    expect(bays.map(kindOf)).toEqual(['bay1_one']);
    expect(bays[0].x).toBeCloseTo(cols[1], 1);
  });

  test('a full-tile era model stands its whole plot deep from the road, its front on the first row of cells', () => {
    // An era model is in metres, a tile 16 m deep (8 m either side of its middle); it once stood as if 10 m deep,
    // 3 m out over the road's edge
    const core = city();
    paint(core, 'commercial', 500, 510);
    (core.map as any).era = 4;
    // (the tile's four shop columns one plot a tile wide, as an office tower takes: src/plotBuildings.ts)
    const list = (core.map as any).plotBuildings, first = list.all()[0];
    grow(core, 50, 50, 1);
    while (joinNeighbour(core.map as any, list, first));
    grow(core, 50, 50, 3);
    const s = snapshot(core);
    // as in the game, whose roads are curves its buildings stand against
    s.curves = true;
    s.roadSnap = () => null;
    const tower = s.placement(11 * s.width + 50, 'central')!;
    expect(tower.id).toBe('era.4.shop_3');
    const layout = cellsOf(core.map as any);
    const row0 = south(core, 500, 510).filter(c => c.row === 0);
    const edge = row0[0].z - layout.cellUnits / 2;
    const m = tower.modelMatrix(new Matrix4());
    expect(new Vector3(0, 0, 8).applyMatrix4(m).z).toBeCloseTo(edge, 1);
    expect(new Vector3(0, 0, -8).applyMatrix4(m).z).toBeCloseTo(edge + 10, 1);
  });

  test('painting more cells beside a grown plot redraws it, though no tile changes', () => {
    const core = city();
    const cols = columnsOn(core, 44);
    paint(core, 'commercial', cols[0] - 1, cols[1] + 1);
    grow(core, 44, 44, 2);
    const s = snapshot(core);
    expect(drawn(s, 44, 44).length).toBe(2);
    // (a plot of its own, an empty lot until it grows: src/plotBuildings.ts)
    paint(core, 'commercial', cols[2] - 1, cols[2] + 1);
    grow(core, 44, 44, 2);
    expect(s.sync(core.map as never)).toContain(11 * s.width + 44);
    expect(drawn(s, 44, 44).length).toBe(3);
  });

  test('the levels each era draws as bays and houses', () => {
    expect(bayRow({ kind: 'commercial', level: 2, lot: false, era: 2 })).toBe(1);
    expect(bayRow({ kind: 'commercial', level: 3, lot: false, era: 3 })).toBe(2);
    expect(bayRow({ kind: 'commercial', level: 3, lot: false, era: 4 })).toBe(0);
    expect(bayRow({ kind: 'commercial', level: 4, lot: true, era: 1 })).toBe(0);
    expect(bayRow({ kind: 'residential', level: 1, lot: false, era: 1 })).toBe(0);
    expect(houseSize({ kind: 'residential', level: 4, lot: false, era: 3 })).toBe(0);
    expect(houseSize({ kind: 'residential', level: 3, lot: false, era: 2 })).toBe(2);
    expect(houseSize({ kind: 'residential', level: 1, lot: false, era: 5 })).toBe(1);
    for (let era = 1; era <= 5; era++) expect(BAY_LEVELS[era][0]).toBeLessThanOrEqual(BAY_LEVELS[era][1]);
  });

  test('columns link to the next along the road both ways, and a column on no plot is the nearest plot\'s', () => {
    const core = city();
    paint(core, 'commercial', 120, 150);
    const layout = cellsOf(core.map as any);
    const plan = frontagePlan(layout, core.map.zoneCells!, tile => {
      const x = tile % core.map.width, y = Math.floor(tile / core.map.width);
      return plotOf(core.map as any, x, y)?.kind ?? null;
    });
    expect(plan.columns.length).toBeGreaterThan(8);
    plan.columns.forEach((c, k) => {
      if (c.right >= 0) expect(plan.columns[c.right].left).toBe(k);
      if (c.left >= 0) expect(plan.columns[c.left].right).toBe(k);
    });
    // a run along the road: only its two ends lack a neighbour
    expect(plan.columns.filter(c => c.left < 0).length).toBe(1);
    expect(plan.columns.filter(c => c.right < 0).length).toBe(1);
  });
});
