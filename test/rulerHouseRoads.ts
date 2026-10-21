/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A new city puts its ruler's house down where the game shows its outline against a road (owner, 22 Oct 2026: "ฉันวาง
// ที่ว่าการอำเภอไม่ได้"): beside a straight road and beside a slanted one laid a tile at a time, as the laterite road a
// district's map comes with, whose staircase of tiles pokes past the road as drawn; with trees in the lot. The outline
// is red, with the reason, exactly where the build command refuses it (CityCommands.quoteBuild).

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { drawnRoads } from "../src/roads/graphLines";
import { realUnits, roadReach } from "../src/roadGeometry";
import { isRoadTile } from "../src/roadTiles";
import { isTurned } from "../src/buildings/turnedFootprint";
import { blockOf } from "../src/buildings/placedBuildings";
import { BLBNBIT } from "../src/tileFlags";
import { WOODS } from "../src/tileValues";

const W = 60, H = 50, M = 16, PER_UNIT = M / 10;

/** A new city on a bare 16 m map grown over with trees, its ruler's house still to build, with roads laid a tile at a
 * time along these tiles (no road graph, as the roads a district's map comes with) */
function city(roads: Array<[number, number]>) {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  Object.assign(map, { tileSizeM: M, paintedZones: true, cellZones: true });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) map.setTile(x, y, WOODS, BLBNBIT);
  const core = new CityCore({ map, seed: 3 });
  core.simulation.budget.setFunds(21000);
  expect((core.map as any).needsRulerHouse).toBe(true);
  for (const [x, y] of roads) core.apply({ type: "tool", tool: "road", x, y } as any);
  for (const [x, y] of roads) expect(isRoadTile(core.map.getTileValue(x, y))).toBe(true);
  return core;
}

/** A staircase of road tiles from (x0, y0), rising a tile every `run` tiles */
function staircase(x0: number, y0: number, length: number, run: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let k = 0; k < length; k++) {
    const x = x0 + k, y = y0 + Math.floor(k / run);
    if (k > 0 && Math.floor((k - 1) / run) !== Math.floor(k / run)) out.push([x, y - 1]);
    out.push([x, y]);
  }
  return out;
}

/** The roads as the game draws them (src/game.js networkLines), in world units, 10 a tile */
function lines(core: CityCore) {
  const map: any = core.map;
  const value = (i: number) => map.getTileValue(i % W, Math.floor(i / W));
  return drawnRoads({ width: W, height: H, value, level: () => 1, piece: () => 0 }, null, false).lines;
}

/** Where the game puts a 3 x 3 against a road (src/game.js buildingPose): `along` world units along the line, on the side
 * `side` (1 or -1), as the build command it sends */
function pose(core: CityCore, line: { points: [number, number][]; level: number }, along: number, side: number) {
  const map: any = core.map, pts = line.points;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], dx = pts[i][0] - ax, dz = pts[i][1] - az, length = Math.hypot(dx, dz) || 1;
    if (walked + length < along && i < pts.length - 1) { walked += length; continue; }
    const t = Math.max(0, Math.min(1, (along - walked) / length)), rx = ax + dx * t, rz = az + dz * t;
    const nx = -dz / length * side, nz = dx / length * side;
    let gap = roadReach(line.level, realUnits(M)) + 0.6 + 15;
    // ... a square block stood back a metre at a time until it covers no road and stands beside one
    const isRoad = (x: number, y: number) => map.testBounds(x, y) && isRoadTile(map.getTileValue(x, y));
    for (let back = 0; back <= 24 && !isTurned(Math.atan2(-nx, -nz)); back++) {
      const b = blockOf(rx + nx * (gap + back * 10 / M), rz + nz * (gap + back * 10 / M), 3, 10);
      let clear = true, beside = false;
      for (let y = b.top - 1; y <= b.top + 3; y++) for (let x = b.left - 1; x <= b.left + 3; x++) {
        const inside = x >= b.left && x < b.left + 3 && y >= b.top && y < b.top + 3;
        if (inside && (!map.testBounds(x, y) || isRoad(x, y))) clear = false;
        if (!inside && isRoad(x, y) && (x >= b.left && x < b.left + 3 || y >= b.top && y < b.top + 3)) beside = true;
      }
      if (clear && beside) { gap += back * 10 / M; break; }
    }
    const x = Math.round((rx + nx * gap) * 100) / 100, z = Math.round((rz + nz * gap) * 100) / 100;
    return { type: "build", tool: "ruler_house", x: Math.round(x * PER_UNIT * 100) / 100,
      z: Math.round(z * PER_UNIT * 100) / 100, rot: Math.round(Math.atan2(-nx, -nz) * 1000) / 1000, stroke: 1 };
  }
  throw new Error("no line");
}

/** Every place along the road's middle, five tiles clear of its ends (where one bends into the outline), on both sides:
 * the quote and the build agree, and how many were put down */
function placeAlong(roads: Array<[number, number]>) {
  const probe = city(roads), [line] = lines(probe);
  let length = 0;
  for (let i = 1; i < line.points.length; i++) length += Math.hypot(line.points[i][0] - line.points[i - 1][0], line.points[i][1] - line.points[i - 1][1]);
  let placed = 0, tried = 0;
  for (let along = 50; along <= length - 50; along += 7) {
    for (const side of [1, -1]) {
      const core = city(roads), command = pose(core, lines(core)[0], along, side) as any;
      const quote = core.commands.quoteBuild(command);
      const out = core.apply(command);
      tried++;
      // the outline is red exactly where the click is refused, with its reason
      expect([command, quote?.reason ?? null]).toEqual([command, out.accepted ? null : out.reason]);
      if (out.accepted && out.toolResult === 0) {
        placed++;
        expect((core.map as any).rulerHouse).not.toBeNull();
      }
    }
  }
  return { placed, tried };
}

describe("a new city's ruler's house", () => {
  test("is put down beside a straight road, its lot full of trees", () => {
    const road: Array<[number, number]> = [];
    for (let x = 5; x < 45; x++) road.push([x, 20]);
    const { placed, tried } = placeAlong(road);
    expect(placed).toBe(tried);
  });

  test("is put down turned beside a slanted road laid a tile at a time, as a district map's laterite road", () => {
    // about 27° and about 18°, the slants of Mueang Khon Kaen's state roads
    for (const run of [2, 3]) {
      const { placed, tried } = placeAlong(staircase(5, 8, 40, run));
      expect([run, placed]).toEqual([run, tried]);
    }
  });

  test("is refused, with its reason in the quote, where a road runs inside its outline", () => {
    const core = city(staircase(5, 8, 40, 2)), line = lines(core)[0];
    const p = pose(core, line, 200, 1) as any;
    // half its depth nearer the road than the game puts it
    const near = { ...p, x: p.x + Math.sin(p.rot) * 20, z: p.z + Math.cos(p.rot) * 20 };
    const quote = core.commands.quoteBuild(near);
    expect(quote?.reason).toBe("a road or railway is in the way");
    expect(core.apply(near)).toMatchObject({ accepted: false, reason: quote!.reason });
  });
});
