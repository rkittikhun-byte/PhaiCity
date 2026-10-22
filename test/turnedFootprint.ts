/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A building turned to face a slanted road takes the tiles its turned outline covers (src/buildings/turnedFootprint.ts;
// owner, 21 Oct 2026: "ถ้าพื้นที่ที่กันไว้ ก็ควรจะมีพื้นที่กั้นไว้นะ"): no grass corner of a square block refuses a road, a
// road just outside its fence is taken, one inside it is refused; the bulldozer, the mending, moving and undo follow
// its tiles; a building laid on its square block before keeps it.

import { CityCore } from "../src/core/cityCore";
import { HOUSE_IN_THE_WAY, LINE_IN_THE_WAY } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import {
  familyValue, inFamily, isTurned, laidOutline, outlineOf, outlineTiles, outsideBy, turnedTilesOf,
} from "../src/buildings/turnedFootprint";
import { compoundSides, GATE_M } from "../src/render3d/city/compounds";
import { roadReach } from "../src/roadGeometry";
import { isRoadTile } from "../src/roadTiles";
import { ZONEBIT } from "../src/tileFlags";
import { CIVIC, DIRT } from "../src/tileValues";

const W = 60, H = 50, M = 16, U = 10 / 16;
const at = (x: number, y: number): number => y * W + x;
const REACH = roadReach(1, U) / U;

/** A bare 16 m city map whose buildings stand against their roads, with a road at a slant (about 27°) across it */
function city() {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.tileSizeM = M;
  map.paintedZones = true;
  map.cellZones = true;
  const core = new CityCore({ map, seed: 3, sandbox: true });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  const from: [number, number] = [80, 640], to: [number, number] = [880, 240];
  expect(core.apply({ type: "road", tool: "road", from, to, stroke: 1 } as any)).toMatchObject({ accepted: true });
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]), tx = (to[0] - from[0]) / len, tz = (to[1] - from[1]) / len;
  // the side of the road away from the map's top: its normal (-tz, tx) turned to +z
  const nx = -tz, nz = tx;
  return { core, map: core.map as any, from, tx, tz, nx, nz };
}

/** Where the game puts a 3 x 3 against the road (src/game.js buildingPose): its outline's front at the road's edge */
function pose(c: ReturnType<typeof city>, along: number): { x: number; z: number; rot: number } {
  const px = c.from[0] + c.tx * along, pz = c.from[1] + c.tz * along, gap = REACH + 1 + 24;
  return { x: px + c.nx * gap, z: pz + c.nz * gap, rot: Math.atan2(-c.nx, -c.nz) };
}

const value = (core: CityCore, i: number): number => core.map.getTileValue(i % W, Math.floor(i / W));

describe("a building turned to a slanted road", () => {
  test("is turned off the quarter turns only", () => {
    expect([isTurned(0), isTurned(Math.PI / 2), isTurned(-Math.PI), isTurned(0.4), isTurned(null)]).toEqual([false, false, false, true, false]);
    // a 3 x 3 on a tile's middle: square, nine tiles; turned 45°, the diamond of thirteen
    const square = outlineTiles(outlineOf(10.5 * M, 10.5 * M, 0, 3, M), W, H, M);
    expect(square.sort((a, b) => a - b)).toEqual([at(9, 9), at(10, 9), at(11, 9), at(9, 10), at(10, 10), at(11, 10), at(9, 11), at(10, 11), at(11, 11)]);
    const diamond = outlineTiles(outlineOf(10.5 * M, 10.5 * M, Math.PI / 4, 3, M), W, H, M);
    expect(diamond).toHaveLength(13);
    expect(diamond).toContain(at(12, 10));
    expect(diamond).not.toContain(at(12, 11));
    // the tiles past the square take its edge's values; the centre's is its own
    expect([familyValue(CIVIC, 3, 0, 0), familyValue(CIVIC, 3, 2, 0), familyValue(CIVIC, 3, 1, 0)]).toEqual([CIVIC, CIVIC + 1, CIVIC + 1]);
  });

  test("takes the tiles of its turned outline, and leaves the square's corners past it free", () => {
    const c = city(), p = pose(c, 400);
    const out = c.core.apply({ type: "build", tool: "ruler_house", x: p.x, z: p.z, rot: p.rot, stroke: 2 } as any);
    expect(out).toMatchObject({ accepted: true, toolResult: 0 });
    const b = c.map.buildings.all().find((x: any) => x.tool === "ruler_house");
    const cx = b.tile % W, cy = Math.floor(b.tile / W);
    expect([Math.floor(p.x / M), Math.floor(p.z / M)]).toEqual([cx, cy]);
    expect(value(c.core, b.tile)).toBe(CIVIC);
    expect(c.core.map.getTileFlags(cx, cy) & ZONEBIT).toBe(ZONEBIT);
    const outline = outlineOf(p.x, p.z, p.rot, 3, M), tiles = outlineTiles(outline, W, H, M);
    // every tile of the outline is the house's, or the road's it faces
    for (const i of tiles) expect([i, inFamily(value(c.core, i), CIVIC, 3) || isRoadTile(value(c.core, i))]).toEqual([i, true]);
    // ... and the corners of its square block that lie past the outline are bare ground
    const inside = new Set(tiles);
    let free = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = at(cx + dx, cy + dy);
      if (!inside.has(i)) { expect(value(c.core, i)).toBe(DIRT); free++; }
    }
    expect(free).toBeGreaterThan(0);
    expect(laidOutline(c.map, b)).not.toBeNull();
    // (turned some 27°, its outline leaves two of the square's corners; the road it faces holds a tile at its front)
    expect(turnedTilesOf(c.map, b.tile, CIVIC)!.length).toBeGreaterThanOrEqual(6);
    // a road may be laid on such a corner
    const corner = [...Array(9)].map((_, k) => at(cx + (k % 3) - 1, cy + Math.floor(k / 3) - 1)).find((i) => !inside.has(i))!;
    expect(c.core.apply({ type: "tool", tool: "road", x: corner % W, y: Math.floor(corner / W), stroke: 3 } as any).toolResult).toBe(0);
    expect(value(c.core, b.tile)).toBe(CIVIC);
  });

  test("takes a road drawn just outside its fence, and refuses one inside it", () => {
    const c = city(), p = pose(c, 400);
    c.core.apply({ type: "build", tool: "ruler_house", x: p.x, z: p.z, rot: p.rot, stroke: 2 } as any);
    const b = c.map.buildings.all().find((x: any) => x.tool === "ruler_house"), outline = outlineOf(p.x, p.z, p.rot, 3, M);
    // a road along its back, its body a metre past the fence
    const back = 24 + REACH + 1;
    const road = (offset: number, stroke: number) => c.core.apply({ type: "road", tool: "road", stroke,
      from: [p.x + c.nx * offset - c.tx * 200, p.z + c.nz * offset - c.tz * 200],
      to: [p.x + c.nx * offset + c.tx * 200, p.z + c.nz * offset + c.tz * 200] } as any);
    // inside the fence: refused, nothing laid
    const tilesBefore = turnedTilesOf(c.map, b.tile, CIVIC)!.length;
    expect(road(24 - 6, 10)).toMatchObject({ accepted: false, reason: HOUSE_IN_THE_WAY });
    expect(turnedTilesOf(c.map, b.tile, CIVIC)!.length).toBe(tilesBefore);
    // just outside: taken, the house standing, at most the tiles at the edge of its outline given up
    expect(road(back, 11)).toMatchObject({ accepted: true, toolResult: 0 });
    expect(value(c.core, b.tile)).toBe(CIVIC);
    const after = turnedTilesOf(c.map, b.tile, CIVIC)!;
    expect(after.length).toBeGreaterThanOrEqual(tilesBefore - 3);
    for (const i of outlineTiles(outline, W, H, M)) {
      if (after.includes(i)) continue;
      // a tile it gave up is one whose middle lies within a few metres of its fence
      expect(outsideBy(outline, (i % W + 0.5) * M, (Math.floor(i / W) + 0.5) * M)).toBeGreaterThan(-8);
    }
  });

  test("is refused where a road runs inside its outline", () => {
    const c = city(), p = pose(c, 400);
    // drawn closer to the road than its outline allows
    const near = { x: p.x - c.nx * 10, z: p.z - c.nz * 10 };
    expect(c.core.apply({ type: "build", tool: "police", x: near.x, z: near.z, rot: p.rot, stroke: 2 } as any))
      .toMatchObject({ accepted: false, reason: LINE_IN_THE_WAY });
  });

  test("is bulldozed whole, mended on its own tiles only, moved and put back by undo", () => {
    const c = city(), p = pose(c, 300);
    c.core.apply({ type: "build", tool: "police", x: p.x, z: p.z, rot: p.rot, stroke: 2 } as any);
    const b = c.map.buildings.all().find((x: any) => x.tool === "police");
    const centre = value(c.core, b.tile), own = turnedTilesOf(c.map, b.tile, centre)!;
    expect(own.length).toBeGreaterThanOrEqual(6);
    // runs a while: the mending never reaches past its outline, nor takes the road
    const snapshot = [...Array(W * H)].map((_, i) => value(c.core, i));
    c.core.run(16 * 8);
    for (let i = 0; i < W * H; i++) if (!own.includes(i) && isRoadTile(snapshot[i])) expect(isRoadTile(value(c.core, i))).toBe(true);
    // moved along the road, still turned: its tiles go with it, its old ones left bare
    const q = pose(c, 560);
    expect(c.core.apply({ type: "move", id: b.id, x: q.x, z: q.z, rot: q.rot, stroke: 3 } as any)).toMatchObject({ accepted: true });
    const moved = c.map.buildings.get(b.id), now = turnedTilesOf(c.map, moved.tile, centre)!;
    expect(moved.tile).not.toBe(b.tile);
    expect(now.length).toBeGreaterThanOrEqual(6);
    for (const i of own) if (!now.includes(i)) expect(inFamily(value(c.core, i), centre, 3)).toBe(false);
    // undo: back where it was, tile for tile
    expect(c.core.apply({ type: "undo" } as any)).toMatchObject({ undone: true });
    expect(turnedTilesOf(c.map, b.tile, centre)!.sort()).toEqual([...own].sort());
    // bulldozed from its centre: every tile of its outline goes, nothing else
    const before = [...Array(W * H)].map((_, i) => value(c.core, i));
    c.core.apply({ type: "tool", tool: "bulldozer", x: b.tile % W, y: Math.floor(b.tile / W), stroke: 4 } as any);
    for (let i = 0; i < W * H; i++) {
      if (own.includes(i)) expect(inFamily(value(c.core, i), centre, 3)).toBe(false);
      else expect([i, value(c.core, i)]).toEqual([i, before[i]]);
    }
  });

  test("laid on its square block before its tiles turned, keeps its block", () => {
    const c = city(), p0 = pose(c, 400), p = { ...p0, x: p0.x + c.nx * 16, z: p0.z + c.nz * 16 };
    // a police station put down by the tool on its square block, then kept turned (as cities saved before 21 Oct have)
    const cx = Math.floor(p.x / M), cy = Math.floor(p.z / M);
    expect(c.core.apply({ type: "tool", tool: "police", x: cx, y: cy, stroke: 2 } as any)).toMatchObject({ accepted: true, toolResult: 0 });
    const b = c.map.buildings.atTile(at(cx, cy));
    c.map.buildings.setPose(b.id, p.x, p.z, p.rot);
    const kept = c.map.buildings.atTile(at(cx, cy));
    expect(isTurned(kept.rot)).toBe(true);
    expect(laidOutline(c.map, kept)).toBeNull();
    expect(turnedTilesOf(c.map, kept.tile, value(c.core, kept.tile))).toBeNull();
    // ... and saves and loads as it was
    const saved = JSON.parse(JSON.stringify({ ...(c.core.save() as any), width: W, height: H }));
    const again = new CityCore({ sandbox: true, map: new (GameMap as any)(W, H), saved });
    expect(laidOutline(again.map as any, (again.map as any).buildings.atTile(at(cx, cy)))).toBeNull();
  });

  test("laid on its square block, is never mended over a road on its block (22 Oct 2026)", () => {
    // A health post's square block with one corner a road kept (a building put down against a slanted road whose laid
    // tiles are its square but that corner): mending it each month left the road alone until it was finished, then took
    // the corner and cut the road (the auto player's village went dark)
    const c = city(), p0 = pose(c, 400), cx = Math.floor((p0.x + c.nx * 16) / M), cy = Math.floor((p0.z + c.nz * 16) / M);
    expect(c.core.apply({ type: "tool", tool: "police", x: cx, y: cy, stroke: 2 } as any)).toMatchObject({ accepted: true, toolResult: 0 });
    const corner = at(cx - 1, cy + 1), road = 66;
    c.map.setTile(cx - 1, cy + 1, road, 0);
    expect(isRoadTile(value(c.core, corner))).toBe(true);
    (c.core.simulation as any)._repairManager.repairZone(cx, cy, 3);
    expect(isRoadTile(value(c.core, corner))).toBe(true);
    // ... while a bare corner is mended as before
    c.map.setTile(cx - 1, cy + 1, DIRT, 0);
    (c.core.simulation as any)._repairManager.repairZone(cx, cy, 3);
    expect(inFamily(value(c.core, corner), value(c.core, at(cx, cy)), 3)).toBe(true);
  });

  test("put down square to a straight road and slid along it, holds the outline it was put down on", () => {
    // (docs/NO_GRID_PLAN.md 3A: its square block of tiles and its fence once stood up to half a tile apart along the road)
    const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
    map.tileSizeM = M; map.paintedZones = true; map.cellZones = true;
    const core = new CityCore({ map, seed: 3, sandbox: true });
    core.simulation.budget.setFunds(1000000);
    (core.map as any).needsRulerHouse = false;
    // a road down a column's middle, x = 488 m; the house east of it facing west, slid 6 m down the road from a block
    core.apply({ type: "road", tool: "road", from: [488, 8], to: [488, 792], stroke: 1 } as any);
    const p = { x: 488 + 8 + 24, z: 392 + 6, rot: -Math.PI / 2 };
    expect(core.apply({ type: "build", tool: "ruler_house", ...p, stroke: 2 } as any)).toMatchObject({ toolResult: 0 });
    const m = core.map as any, b = m.buildings.all()[0], o = laidOutline(m, b)!;
    expect([o.x, o.z, o.hu, o.hv]).toEqual([p.x, p.z, 24, 24]);
    // its tiles its square block, as before
    const cx = b.tile % W, cy = Math.floor(b.tile / W);
    expect(turnedTilesOf(m, b.tile, CIVIC)!.sort((a, c) => a - c)).toEqual(
      [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => at(cx + dx, cy + dy))).sort((a, c) => a - c));
    // a road across, its body a metre past the fence on the side its block reaches 6 m further: taken, the house standing
    const north = p.z - 24 - 1 - REACH;
    expect(core.apply({ type: "road", tool: "road", from: [600, north], to: [700, north], stroke: 3 } as any))
      .toMatchObject({ accepted: true, toolResult: 0 });
    expect(value(core, b.tile)).toBe(CIVIC);
    // one inside the fence: refused
    const south = p.z + 24 - 6;
    expect(core.apply({ type: "road", tool: "road", from: [500, south], to: [700, south], stroke: 4 } as any))
      .toMatchObject({ accepted: false, reason: HOUSE_IN_THE_WAY });
  });

  test("is fenced along its outline, the gate on the side it faces", () => {
    const c = city(), p = pose(c, 400);
    c.core.apply({ type: "build", tool: "ruler_house", x: p.x, z: p.z, rot: p.rot, stroke: 2 } as any);
    const b = c.map.buildings.all().find((x: any) => x.tool === "ruler_house"), o = laidOutline(c.map, b)!;
    const sides = compoundSides(b, W, M, o);
    expect(sides).toHaveLength(4);
    for (const s of sides) {
      expect(Math.abs(outsideBy(o, s.ax, s.az))).toBeLessThan(1e-6);
      expect(Math.hypot(s.bx - s.ax, s.bz - s.az)).toBeCloseTo(48, 5);
    }
    // one gate, on the side toward the road it faces
    const gates = sides.filter((s) => s.gate);
    expect(gates).toHaveLength(1);
    const g = gates[0], mx = (g.ax + g.bx) / 2 - p.x, mz = (g.az + g.bz) / 2 - p.z;
    expect(mx * -c.nx + mz * -c.nz).toBeGreaterThan(20);
    expect(GATE_M).toBeLessThan(48);
  });
});
