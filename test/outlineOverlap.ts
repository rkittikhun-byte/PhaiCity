/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Buildings meet by their outlines, not their tiles (docs/NO_GRID_PLAN.md 3A.2, src/buildings/outlineOverlap.ts): two of
// the ruler's buildings side by side along a slanted road stand clear of each other when their turned outlines do, and
// one whose outline would run into another's is refused, though no tile's middle lies in both.

import { CityCore } from "../src/core/cityCore";
import { BUILDING_IN_THE_WAY } from "../src/cityCommands";
import { MapGenerator } from "../src/mapGenerator.js";
import { OVERLAP_SLACK_M, overlapDepth, outlinesOverlap } from "../src/buildings/outlineOverlap";
import { outlineOf, outlineTiles } from "../src/buildings/turnedFootprint";
import { roadReach } from "../src/roadGeometry";

const M = 16, U = 10 / 16, REACH = roadReach(1, U) / U;

describe("two outlines", () => {
  test("stand clear with a gap or edge to edge, and run into each other by as much as they overlap", () => {
    const a = outlineOf(100, 100, 0, 3, M);
    expect(overlapDepth(a, outlineOf(100 + 48 + 2, 100, 0, 3, M))).toBeCloseTo(-2, 6);
    expect(outlinesOverlap(a, outlineOf(100 + 48, 100, 0, 3, M))).toBe(false);
    expect(overlapDepth(a, outlineOf(100 + 40, 100, 0, 3, M))).toBeCloseTo(8, 6);
    // ... a turned one whose corner reaches into the other's side, as deep as the corner goes past it
    const turned = outlineOf(100 + 24 + 24 * Math.SQRT2 - 3, 100, Math.PI / 4, 3, M);
    expect(overlapDepth(a, turned)).toBeCloseTo(3, 6);
    expect(outlinesOverlap(a, turned)).toBe(true);
    // ... and a little more than touching is allowed
    expect(outlinesOverlap(a, outlineOf(100 + 48 - OVERLAP_SLACK_M / 2, 100, 0, 3, M))).toBe(false);
  });
});

describe("the ruler's buildings along a slanted road", () => {
  /** A bare 16 m city map with a road at about 27°, and where the game puts a 3 x 3 against it (buildingPose) */
  function city() {
    const map = (MapGenerator as any).fromPresetCells(60, 50, new Uint8Array(60 * 50));
    map.tileSizeM = M;
    map.paintedZones = true;
    map.cellZones = true;
    const core = new CityCore({ map, seed: 3, sandbox: true });
    core.simulation.budget.setFunds(1000000);
    (core.map as any).needsRulerHouse = false;
    const from: [number, number] = [80, 640], to: [number, number] = [880, 240];
    expect(core.apply({ type: "road", tool: "road", from, to, stroke: 1 } as any)).toMatchObject({ accepted: true });
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]), tx = (to[0] - from[0]) / len, tz = (to[1] - from[1]) / len;
    const nx = -tz, nz = tx;
    const pose = (along: number) => {
      const px = from[0] + tx * along, pz = from[1] + tz * along, gap = REACH + 1 + 24;
      return { x: px + nx * gap, z: pz + nz * gap, rot: Math.atan2(-nx, -nz) };
    };
    return { core, pose };
  }

  test("one whose outline would run into its neighbour's is refused, though their tiles are apart; one clear of it stands", () => {
    const { core, pose } = city();
    const first = pose(300);
    expect(core.apply({ type: "build", tool: "police", ...first, stroke: 2 } as any)).toMatchObject({ accepted: true });
    // 44 m further along: the outlines (48 m) run 4 m into each other
    const close = pose(344);
    const tilesA = new Set(outlineTiles(outlineOf(first.x, first.z, first.rot, 3, M), 60, 50, M));
    const shared = outlineTiles(outlineOf(close.x, close.z, close.rot, 3, M), 60, 50, M).filter((i) => tilesA.has(i));
    const refused = core.apply({ type: "build", tool: "fire", ...close, stroke: 3 } as any);
    expect(refused).toMatchObject({ accepted: false, reason: BUILDING_IN_THE_WAY });
    // (the check is the outlines', which a tile check missed where no shared tile's middle lies in both)
    expect(shared.length).toBeLessThanOrEqual(2);
    expect(core.apply({ type: "build", tool: "fire", ...pose(352), stroke: 4 } as any)).toMatchObject({ accepted: true });
    // ... and a building moved into its neighbour's lot is refused the same
    const placed = (core.map as any).buildings.all();
    const fire = placed.find((b: any) => b.tool === "fire");
    expect(core.apply({ type: "move", id: fire.id, ...pose(340), stroke: 5 } as any)).toMatchObject({ accepted: false, reason: BUILDING_IN_THE_WAY });
  });
});
