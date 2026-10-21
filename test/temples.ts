/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Temples (src/temples.ts, docs/GAME_DESIGN.md 9; owner, 21 Oct 2026: "ที่ไหนมีชุมชน ก็จะมีวัด"): a community of homes
// with no temple within reach builds one beside its road, facing it, as a construction site; it grows with its people,
// cheers them, holds the temple festivals, keeps its centre out of fire, and no tool of the ruler's touches it.

import { CityCore } from "../src/core/cityCore";
import { isTurned, outlineTiles } from "../src/buildings/turnedFootprint";
import { MapGenerator } from "../src/mapGenerator.js";
import { plotTile } from "../src/plots";
import { isRoadTile } from "../src/roadTiles";
import { BURNBIT, ZONEBIT } from "../src/tileFlags";
import { CIVIC } from "../src/tileValues";
import { scoreEra } from "../src/eraScore";
import { buildingAt } from "../src/objects/buildings";
import {
  BUILD_MONTHS, FOUND_PEOPLE, GATHER_MONTHS, GROW_MONTHS, festivalTemple, neediest, peopleGrid, reachTiles, readTemples,
  TEMPLE_IN_THE_WAY, TEMPLE_KIND, templeAt, templeCheer, templeMonth, templesOf, writeTemples,
} from "../src/temples";

const W = 90, H = 90, M = 16;
const MONTH = 4;

/** A bare 16 m city map with a road drawn in metres from (x0, z0) to (x1, z1) */
function city(from: [number, number], to: [number, number]) {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.tileSizeM = M;
  map.paintedZones = true;
  map.cellZones = true;
  const core = new CityCore({ map, seed: 5, sandbox: true });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  expect(core.apply({ type: "road", tool: "road", from, to, stroke: 1 } as any)).toMatchObject({ accepted: true });
  return { core, map: core.map as any };
}

/** Home plots of a level on these tiles: 20 people a level each */
function homes(map: any, tiles: Array<[number, number]>, level = 4): void {
  for (const [x, y] of tiles) map.setTile(x, y, plotTile("residential", level), 0);
}

/** A row of n home plots from (x, y) along x */
const row = (x: number, y: number, n: number): Array<[number, number]> => Array.from({ length: n }, (_, k) => [x + k, y]);

/** Runs the temples' months from `month` (city months), returning the news, the sites finished as the core would */
function months(map: any, from: number, n: number): any[] {
  const news: any[] = [];
  for (let m = from; m < from + n; m++) {
    news.push(...templeMonth(map, m * MONTH, m % 12));
    for (const [key, site] of Object.entries(map.sites ?? {}) as Array<[string, any]>) if (m * MONTH >= site.ready) delete map.sites[key];
  }
  return news;
}

describe("a community builds its temple", () => {
  test("not below the people a temple needs", () => {
    const { map } = city([5 * M, 40.5 * M], [85 * M, 40.5 * M]);
    homes(map, row(20, 42, 4)); // 320 people
    expect(neediest(map, peopleGrid(map), []).people).toBe(320);
    expect(months(map, 0, 12)).toEqual([]);
    expect(templesOf(map).temples).toHaveLength(0);
  });

  test("gathers, then lays a temple beside its road facing it, as a construction site", () => {
    const { map } = city([5 * M, 40.5 * M], [85 * M, 40.5 * M]);
    homes(map, [...row(30, 42, 6), ...row(30, 38, 2)]); // 640 people
    expect(neediest(map, peopleGrid(map), []).people).toBeGreaterThanOrEqual(FOUND_PEOPLE);
    expect(months(map, 0, GATHER_MONTHS - 1)).toEqual([]);
    const news = months(map, GATHER_MONTHS - 1, 1);
    expect(news).toEqual([expect.objectContaining({ type: "templeFounded" })]);
    const t = templesOf(map).temples[0], cx = t.tile % W, cy = Math.floor(t.tile / W);
    expect(t.level).toBe(1);
    expect(map.getTileValue(cx, cy)).toBe(CIVIC);
    expect(map.getTileFlags(cx, cy) & ZONEBIT).toBeTruthy();
    // its centre never catches fire: fire reaches its edge only (CLAUDE.md rule 8)
    expect(map.getTileFlags(cx, cy) & BURNBIT).toBe(0);
    expect(map.civicKinds[t.tile]).toBe(TEMPLE_KIND);
    expect(map.sites[String(t.tile)]).toMatchObject({ tool: TEMPLE_KIND });
    // beside the road (the road runs along tile row 40), its 3 x 3 off the road and its homes
    expect(Math.abs(cy - 40)).toBe(2);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) expect(isRoadTile(map.getTileValue(x, y))).toBe(false);
    // kept where it was put, facing the road: its front (sin rot, cos rot) toward the road's side
    const b = map.buildings.atTile(t.tile);
    expect(b).toMatchObject({ tool: TEMPLE_KIND, size: 3 });
    expect(Math.sign(Math.cos(b.rot))).toBe(cy > 40 ? -1 : 1);
    // near the heart of its homes, not far off along the road
    expect(Math.abs(cx - 33)).toBeLessThanOrEqual(4);
    // a site gives nothing yet; then it is a temple
    expect(templeCheer(map)).toBe(0);
    months(map, GATHER_MONTHS, BUILD_MONTHS + 1);
    expect(map.sites[String(t.tile)]).toBeUndefined();
    expect(templeCheer(map)).toBeGreaterThan(0);
  });

  test("turns to a slanted road and takes its turned outline's tiles", () => {
    const { map } = city([5 * M, 70 * M], [85 * M, 30 * M]);
    // homes along the road's lower side, round its middle
    const home: Array<[number, number]> = [];
    for (let x = 36; x <= 50; x += 2) { const y = Math.round(70 - (x - 5) / 2) + 3; home.push([x, y]); }
    homes(map, home, 4);
    months(map, 0, GATHER_MONTHS);
    const t = templesOf(map).temples[0];
    expect(t).toBeDefined();
    const b = map.buildings.atTile(t.tile);
    expect(isTurned(b.rot)).toBe(true);
    const outline = outlineTiles({ x: b.x, z: b.z, half: 24, ux: Math.cos(b.rot), uz: -Math.sin(b.rot), vx: Math.sin(b.rot), vz: Math.cos(b.rot) }, W, H, M);
    for (const i of outline) {
      const v = map.getTileValue(i % W, Math.floor(i / W));
      expect(isRoadTile(v) || v >= CIVIC - 4 && v <= CIVIC + 4).toBe(true);
    }
    expect(templeAt(map, t.tile % W, Math.floor(t.tile / W))).toBe(t);
  });

  test("a second community out of the first temple's reach builds its own; one within reach does not", () => {
    const { map } = city([2 * M, 40.5 * M], [88 * M, 40.5 * M]);
    homes(map, row(8, 42, 6));
    months(map, 0, GATHER_MONTHS + BUILD_MONTHS);
    expect(templesOf(map).temples).toHaveLength(1);
    // more homes within the first one's reach: no second temple
    homes(map, row(20, 38, 6));
    months(map, 20, 12);
    expect(templesOf(map).temples).toHaveLength(1);
    // a community farther than its reach along the road
    const far = 8 + reachTiles(map) + 20;
    homes(map, row(far, 42, 6));
    months(map, 40, GATHER_MONTHS + 1);
    expect(templesOf(map).temples).toHaveLength(2);
  });

  test("grows a level with its people, at most every GROW_MONTHS", () => {
    const { map } = city([5 * M, 40.5 * M], [85 * M, 40.5 * M]);
    homes(map, row(30, 42, 6));
    months(map, 0, GATHER_MONTHS + BUILD_MONTHS + 1);
    const t = templesOf(map).temples[0];
    expect(t.level).toBe(1);
    // 1,600 people within reach
    homes(map, [...row(20, 44, 30), ...row(20, 45, 30), ...row(20, 36, 20)], 1);
    homes(map, row(30, 42, 6), 4);
    const before = t.since;
    months(map, before + 1, GROW_MONTHS - 2);
    expect(t.level).toBe(1);
    const news = months(map, before + GROW_MONTHS - 1, 2);
    expect(t.level).toBe(2);
    expect(news).toContainEqual(expect.objectContaining({ type: "templeGrew", level: 2 }));
  });
});

describe("what a temple gives", () => {
  function built() {
    const c = city([5 * M, 40.5 * M], [85 * M, 40.5 * M]);
    homes(c.map, row(30, 42, 6));
    months(c.map, 0, GATHER_MONTHS + BUILD_MONTHS + 1);
    return c;
  }

  test("the people it serves are a little more content: the era score's living side", () => {
    const { core, map } = built();
    templeMonth(map, 1001 * MONTH, 0);
    expect(templeCheer(map)).toBeCloseTo(2, 5);
    const sim = core.simulation, objects = core.objects;
    const withTemple = scoreEra(map, sim, objects).factors.living.value;
    const keep = map.temples;
    map.temples = null;
    const without = scoreEra(map, sim, objects).factors.living.value;
    map.temples = keep;
    expect(withTemple - without).toBeCloseTo(0.01, 5);
    // a great Buddhist day adds a point (Visakha Bucha, May)
    templeMonth(map, 1002 * MONTH, 4);
    expect(templeCheer(map)).toBeCloseTo(3, 5);
  });

  test("Songkran, Loy Krathong and Yi Peng are held at the temple; the others where they were", () => {
    const { map } = built();
    const t = templesOf(map).temples[0];
    for (const id of ["songkran", "loy_krathong", "yi_peng"]) expect(festivalTemple(map, id)).toEqual({ x: t.tile % W, y: Math.floor(t.tile / W) });
    expect(festivalTemple(map, "bun_bang_fai")).toBeNull();
  });

  test("is the community's: the ruler's tools never touch it, nor move it", () => {
    const { core, map } = built();
    const t = templesOf(map).temples[0], cx = t.tile % W, cy = Math.floor(t.tile / W);
    for (const [x, y] of [[cx, cy], [cx - 1, cy + 1], [cx + 1, cy - 1]]) {
      expect(core.apply({ type: "tool", tool: "bulldozer", x, y } as any)).toMatchObject({ accepted: false, reason: TEMPLE_IN_THE_WAY });
      expect(core.apply({ type: "tool", tool: "road", x, y } as any)).toMatchObject({ accepted: false, reason: TEMPLE_IN_THE_WAY });
    }
    const b = map.buildings.atTile(t.tile);
    expect(core.apply({ type: "move", id: b.id, x: b.x + 64, z: b.z, rot: 0 } as any)).toMatchObject({ accepted: false, reason: TEMPLE_IN_THE_WAY });
    expect(map.getTileValue(cx, cy)).toBe(CIVIC);
    // ... and a building the ruler puts beside it is fine
    expect(core.apply({ type: "tool", tool: "bulldozer", x: cx + 3, y: cy } as any).reason).not.toBe(TEMPLE_IN_THE_WAY);
  });

  test("is a temple on the map: needs no power, its card says its level", () => {
    const { map } = built();
    const t = templesOf(map).temples[0];
    const object = buildingAt(map, t.tile % W, Math.floor(t.tile / W))!;
    expect(object.kind).toBe("temple");
    expect(object.needsPower).toBe(false);
    expect(object.facts(map)).toContainEqual({ key: "object.fact.temple_level", params: { level: 1 } });
  });
});

describe("temples are saved and the same every time", () => {
  test("a save keeps them", () => {
    const state = { temples: [{ tile: 123, level: 2, since: 40 }], gathering: 1, at: 50, cheer: 2.5, served: 0.4 };
    expect(readTemples(JSON.parse(JSON.stringify(writeTemples(state))))).toEqual(state);
    expect(writeTemples({ temples: [], gathering: 0, at: 3, cheer: 0, served: 0 })).toBeUndefined();
    expect(readTemples(undefined).temples).toEqual([]);
  });

  test("a city saved and opened keeps its temple where it stands", () => {
    const { core, map } = city([5 * M, 40.5 * M], [85 * M, 40.5 * M]);
    homes(map, row(30, 42, 6));
    months(map, 0, GATHER_MONTHS + BUILD_MONTHS + 1);
    const t = templesOf(map).temples[0], b = map.buildings.atTile(t.tile);
    const saved = JSON.parse(JSON.stringify(core.save()));
    expect(saved.temples.temples).toEqual([[t.tile, 1, t.since]]);
    const kept = (saved.buildings.buildings as unknown[][]).find((row) => row[1] === TEMPLE_KIND);
    expect(kept).toBeDefined();
    expect(kept![2]).toBeCloseTo(b.x, 1);
  });

  test("the same city makes the same temples", () => {
    const run = () => {
      const { map } = city([5 * M, 70 * M], [85 * M, 30 * M]);
      homes(map, [...row(30, 56, 5), ...row(60, 42, 5)]);
      months(map, 0, 30);
      return templesOf(map).temples.map((t) => [t.tile, t.level, map.buildings.atTile(t.tile).rot]);
    };
    const first = run();
    expect(first.length).toBeGreaterThan(0);
    expect(run()).toEqual(first);
  });

  test("the core runs them each month", () => {
    const { core } = city([5 * M, 40.5 * M], [85 * M, 40.5 * M]);
    expect(core.systemNames).toContain("temples");
  });
});
