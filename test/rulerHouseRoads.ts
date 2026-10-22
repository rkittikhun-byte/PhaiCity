/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A new city puts its ruler's house down where the game shows its outline against a road (owner, 22 Oct 2026: "ฉันวาง
// ที่ว่าการอำเภอไม่ได้", then "ทำไมวางตรงนี้ไม่ได้"): beside a straight road, a slanted one and a gently curving one laid a
// tile at a time, as the laterite road a district's map comes with, whose staircase of tiles pokes past the road as
// drawn; with trees in the lot, and the mouse a little off the road anywhere along it. Where a curve bends into a corner
// of the turned outline, the game stands it back or slides it along the road to where it fits (src/buildings/roadPose.ts).
// The outline is red, with the reason, exactly where the build command refuses it (CityCommands.quoteBuild). The same
// for a 3 x 3 service: put down, it touches the road and takes none of its tiles.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { firstFrame } from "../src/cityFrame";
import { DISTRICT_BLOCK, framePreset, isDistrictMap } from "../src/geo/districtFrame";
import { decodePresetCells, decodePresetLayer } from "../src/geo/presetMap";
import { MODE_RULES } from "../src/gameModes";
import { checkRulesData, resolveRules } from "../src/provinceRules";
import { LINE_IN_THE_WAY, NEEDS_ROAD_BESIDE } from "../src/cityCommands";
import { MapGenerator } from "../src/mapGenerator.js";
import { drawnRoads } from "../src/roads/graphLines";
import { realUnits } from "../src/roadGeometry";
import { isRoadTile } from "../src/roadTiles";
import { NEEDS_ROAD } from "../src/rulerHouse";
import { roadPose } from "../src/buildings/roadPose";
import { BLBNBIT } from "../src/tileFlags";
import { WOODS } from "../src/tileValues";

const W = 60, H = 50, M = 16, PER_UNIT = M / 10;
type Tiles = Array<[number, number]>;

/** A new city on a bare 16 m map grown over with trees, its ruler's house still to build, with roads laid a tile at a
 * time along these tiles (no road graph, as the roads a district's map comes with) */
function city(roads: Tiles, tool: string) {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  Object.assign(map, { tileSizeM: M, paintedZones: true, cellZones: true });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) map.setTile(x, y, WOODS, BLBNBIT);
  // (a service in a city whose house stands and which may build anything)
  const service = tool !== "ruler_house";
  const core = new CityCore({ map, seed: 3, ...(service ? { sandbox: true } : {}) });
  core.simulation.budget.setFunds(service ? 1000000 : 21000);
  if (service) (core.map as any).needsRulerHouse = false;
  else expect((core.map as any).needsRulerHouse).toBe(true);
  for (const [x, y] of roads) core.apply({ type: "tool", tool: "road", x, y } as any);
  for (const [x, y] of roads) expect(isRoadTile(core.map.getTileValue(x, y))).toBe(true);
  return core;
}

/** Road tiles through these points, each step joined to the last by a corner tile */
function joined(points: Tiles): Tiles {
  const out: Tiles = [];
  for (const [x, y] of points) {
    const last = out[out.length - 1];
    if (last) for (let yy = last[1] + Math.sign(y - last[1]); yy !== y; yy += Math.sign(y - last[1])) out.push([last[0], yy]);
    if (last && last[1] !== y) out.push([last[0], y]);
    out.push([x, y]);
  }
  return out;
}

/** A road from (x0, y0) 40 tiles long, rising a tile every `run` tiles */
const slant = (x0: number, y0: number, run: number): Tiles =>
  joined(Array.from({ length: 40 }, (_, k) => [x0 + k, y0 + Math.floor(k / run)] as [number, number]));
/** A gently curving road, level at its start and about 40° at its end, like the state road on Mueang Khon Kaen's map */
const curve = (): Tiles => joined(Array.from({ length: 45 }, (_, k) => [5 + k, 40 - Math.round(0.0095 * k * k)] as [number, number]));

/** The roads as the game draws them (src/game.js networkLines), in world units, 10 a tile */
function lines(core: CityCore) {
  const map: any = core.map;
  const value = (i: number) => map.getTileValue(i % W, Math.floor(i / W));
  return drawnRoads({ width: W, height: H, value, level: () => 1, piece: () => 0 }, null, false).lines;
}

/** The build command the game sends for a pose (src/game.js buildCommand) */
const buildOf = (tool: string, pose: [number, number, number]) => ({ type: "build", tool,
  x: Math.round(pose[0] * PER_UNIT * 100) / 100, z: Math.round(pose[1] * PER_UNIT * 100) / 100, rot: pose[2], stroke: 1 }) as any;

/** Where the game puts a building with the mouse at (mx, mz) (world units): src/game.js buildingPose */
function gamePose(core: CityCore, tool: string, mx: number, mz: number) {
  const map: any = core.map, drawn = lines(core);
  return roadPose({ width: W, height: H, tileSizeM: M, realUnits: realUnits(M),
    isRoad: (x, y) => map.testBounds(x, y) && isRoadTile(map.getTileValue(x, y)) },
  drawn.map((l) => l.points), drawn.map((l) => l.level), mx, mz, 3, {
    refusal: (pose) => core.commands.quoteBuild(buildOf(tool, pose))?.reason ?? null,
    placeReasons: [LINE_IN_THE_WAY, NEEDS_ROAD, NEEDS_ROAD_BESIDE] });
}

/** The mouse along the road's middle, five tiles clear of its ends, on both sides, half a tile to two tiles off it and
 * never on the 2 m steps: the quote and the build agree, and how many were put down touching the road and taking none
 * of its tiles */
function placeAlong(roads: Tiles, tool: string) {
  const [line] = lines(city(roads, tool)), pts = line.points;
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let placed = 0, tried = 0;
  const missed: unknown[] = [];
  for (let along = 50; along <= length - 50; along += 17.3) {
    // the road's middle there, and the way across it
    let walked = 0, mid: readonly [number, number] = pts[0], across: [number, number] = [0, 1];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dz = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dz) || 1;
      if (walked + l >= along) {
        const t = (along - walked) / l;
        mid = [pts[i - 1][0] + dx * t, pts[i - 1][1] + dz * t];
        across = [-dz / l, dx / l];
        break;
      }
      walked += l;
    }
    for (const side of [1, -1]) for (const off of [5, 12, 20]) {
      const core = city(roads, tool);
      const pose = gamePose(core, tool, mid[0] + across[0] * off * side, mid[1] + across[1] * off * side);
      expect(pose).not.toBeNull();
      const command = buildOf(tool, pose!), quote = core.commands.quoteBuild(command), out = core.apply(command);
      tried++;
      // the outline is red exactly where the click is refused, with its reason
      expect([command, quote?.reason ?? null]).toEqual([command, out.accepted ? null : out.reason]);
      if (!(out.accepted && out.toolResult === 0)) { missed.push({ along, side, off, out }); continue; }
      placed++;
      if (tool === "ruler_house") expect((core.map as any).rulerHouse).not.toBeNull();
      // every road tile is still a road, and the tiles it took (turned, its outline's but those the road holds at its
      // edge: src/buildings/turnedFootprint.ts) touch one
      const map: any = core.map, road = new Set(roads.map(([x, y]) => y * W + x)), taken: number[] = [];
      for (const i of road) expect([i, isRoadTile(map.getTileValue(i % W, Math.floor(i / W)))]).toEqual([i, true]);
      for (let i = 0; i < W * H; i++) if (!road.has(i) && map.getTileValue(i % W, Math.floor(i / W)) !== WOODS) taken.push(i);
      expect(taken.length).toBeGreaterThanOrEqual(5);
      expect(taken.some((i) => [1, -1, W, -W].some((d) => road.has(i + d)))).toBe(true);
    }
  }
  return { placed, tried, missed };
}

describe("a new city's ruler's house", () => {
  test("is put down beside a straight road, its lot full of trees", () => {
    const road: Tiles = [];
    for (let x = 5; x < 45; x++) road.push([x, 20]);
    expect(placeAlong(road, "ruler_house").missed).toEqual([]);
  });

  test("is put down turned beside roads at slants from 11° to 45°, laid a tile at a time as a district map's", () => {
    for (const run of [1, 2, 3, 5]) expect([run, placeAlong(slant(5, 8, run), "ruler_house").missed]).toEqual([run, []]);
  });

  test("is put down beside a gently curving road, stood back or slid where the curve bends into its outline", () => {
    expect(placeAlong(curve(), "ruler_house").missed).toEqual([]);
  });

  test("and a 3 x 3 service the same", () => {
    for (const road of [slant(5, 8, 2), slant(5, 8, 5), curve()]) expect(placeAlong(road, "police").missed).toEqual([]);
  });

  test("is refused, with its reason in the quote, where a road runs inside its outline", () => {
    const core = city(slant(5, 8, 2), "ruler_house"), line = lines(core)[0], mid = line.points[Math.floor(line.points.length / 2)];
    const pose = gamePose(core, "ruler_house", mid[0] - 10, mid[1] + 10)!;
    // half its depth nearer the road than the game puts it
    const near = buildOf("ruler_house", [pose[0] + Math.sin(pose[2]) * 12.5, pose[1] + Math.cos(pose[2]) * 12.5, pose[2]]);
    const quote = core.commands.quoteBuild(near);
    expect(quote?.reason).toBe(LINE_IN_THE_WAY);
    expect(core.apply(near)).toMatchObject({ accepted: false, reason: quote!.reason });
  });
});

/** A new normal-mode city on Mueang Khon Kaen's map, set up as the start screen sets one up (test/play/khonKaen.ts) */
async function khonKaen() {
  const read = (path: string) => JSON.parse(fs.readFileSync(path, "utf8"));
  const whole = read("data/maps/district/TH-40-mueang-khon-kaen.json");
  const preset = isDistrictMap(whole) ? await framePreset(whole, firstFrame(whole, whole.town, DISTRICT_BLOCK)) : whole;
  const layer = (encoded: string | undefined) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : null);
  const transport = layer(preset.transport);
  const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  Object.assign(map, { nationalTransport: transport, insideProvince: layer(preset.inside), town: preset.town || null,
    provinceId: "TH-40", tileSizeM: preset.tileSizeM || null, frame: preset.frame || null,
    paintedZones: preset.paintedZones === true, cellZones: preset.cellZones === true, roadLevels: layer(preset.roadLevels),
    landCover: layer(preset.landCover) });
  const rules = resolveRules(checkRulesData(read("data/province-rules.json")).data, "northeast", "TH-40");
  const core = new CityCore({ map, seed: 11, level: MODE_RULES.normal.level, rules, hooks: { rank: () => 0 } } as never);
  core.simulation.budget.setFunds(21000);
  return core;
}

describe("on Mueang Khon Kaen's map", () => {
  test("a new city puts its ruler's house down along the state roads' curves and slants round the town", async () => {
    const core = await khonKaen(), map: any = core.map, w = map.width, h = map.height, M = map.tileSizeM, units = M / 10;
    expect(map.needsRulerHouse).toBe(true);
    const levels = map.roadLevels;
    const drawn = drawnRoads({ width: w, height: h, value: (i: number) => map.getTileValue(i % w, Math.floor(i / w)),
      level: (i: number) => (levels ? levels[i] || 1 : 1), piece: () => 0 }, null, false).lines;
    const poseMap = { width: w, height: h, tileSizeM: M, realUnits: realUnits(M),
      isRoad: (x: number, y: number) => map.testBounds(x, y) && isRoadTile(map.getTileValue(x, y)) };
    const command = (p: [number, number, number]) => ({ type: "build", tool: "ruler_house",
      x: Math.round(p[0] * units * 100) / 100, z: Math.round(p[1] * units * 100) / 100, rot: p[2], stroke: 1 }) as any;
    const refusal = (p: [number, number, number]) => core.commands.quoteBuild(command(p))?.reason ?? null;
    const fit = { refusal, placeReasons: [LINE_IN_THE_WAY, NEEDS_ROAD, NEEDS_ROAD_BESIDE] };
    let tried = 0, before = 0, after = 0;
    const fitted: Array<[number, number, number]> = [];
    // the mouse a little off every stretch of road within 20 tiles of the town, either side
    for (const line of drawn) for (let i = 1; i < line.points.length - 1; i += 4) {
      const [px, pz] = line.points[i], [ax, az] = line.points[i - 1], [bx, bz] = line.points[i + 1];
      if (Math.abs(px / 10 - map.town.x) > 20 || Math.abs(pz / 10 - map.town.y) > 20) continue;
      const l = Math.hypot(bx - ax, bz - az) || 1;
      for (const side of [1, -1]) for (const off of [6, 18]) {
        const mx = px - (bz - az) / l * off * side, mz = pz + (bx - ax) / l * off * side;
        const plain = roadPose(poseMap, drawn.map((d) => d.points), drawn.map((d) => d.level), mx, mz, 3);
        const pose = roadPose(poseMap, drawn.map((d) => d.points), drawn.map((d) => d.level), mx, mz, 3, fit);
        tried++;
        if (plain && refusal(plain)) before++;
        if (!pose || refusal(pose)) after++;
        else if (plain && refusal(plain) && fitted.length < 12) fitted.push(pose);
      }
    }
    // stood against the road where it was, a house was refused at about one place in six, where the road curves into
    // its outline or a junction's arm comes inside it; stood back or slid along the road, only right at the town's
    // junctions, where it shows red with its reason
    expect(tried).toBeGreaterThan(200);
    expect(before).toBeGreaterThan(tried / 10);
    expect(after).toBeLessThan(tried / 50);
    // ... and where it was moved to, the click puts it down
    expect(fitted.length).toBeGreaterThan(5);
    for (const pose of fitted) {
      expect(core.apply(command(pose))).toMatchObject({ accepted: true, toolResult: 0 });
      expect(map.rulerHouse).not.toBeNull();
      expect(core.apply({ type: "undo" } as any)).toMatchObject({ accepted: true });
    }
  });
});
