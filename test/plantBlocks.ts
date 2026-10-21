/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Power plants that take only the tiles their model covers (src/plantBlocks.ts, docs/POWER_PLANTS.md; owner, 21 Oct
// 2026: "เอาแบบ B ให้ระบบจำลองกินที่เท่าตัวโมเดลจริง"): a 3 x 3 where the era draws the plant with its model, a 2 x 2 where
// the program draws it; the power, fuel and smoke stay the kind's; the tiles the old 4 x 4 took are free to build on;
// plants built before keep their 4 x 4.

import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import {
  isPlantCentre, NUCLEAR_KIND, plantBlockOf, plantBlockSize, plantCentre, plantCentreOf,
} from "../src/plantBlocks";
import { plantPower, POWER_KINDS, PLANT_TOOLS } from "../src/powerPlants";
import { BULLBIT, BURNBIT, CONDBIT, POWERBIT, ZONEBIT } from "../src/tileFlags";
import {
  DIRT, PLANT2, PLANT2_BASE, PLANT2_LAST, PLANT3, PLANT3_BASE, PLANT3_LAST, POWERPLANT, RESBASE, RUBBLE, LASTRUBBLE,
} from "../src/tileValues";
import { ZoneUtils } from "../src/zoneUtils.js";

const W = 48, H = 32;
const at = (x: number, y: number): number => y * W + x;

/** A bare sandbox city of an era, rich enough to build anything at once */
function city(era: number, seed = 5): CityCore {
  const map = (MapGenerator as any).fromPresetCells(W, H, new Uint8Array(W * H));
  map.era = era;
  const core = new CityCore({ sandbox: true, map, seed });
  core.simulation.budget.setFunds(1000000);
  (core.map as any).needsRulerHouse = false;
  return core;
}
const value = (core: CityCore, x: number, y: number): number => core.map.getTileValue(x, y);
const block = (core: CityCore, left: number, top: number, size: number): number[] =>
  [...Array(size * size)].map((_, i) => value(core, left + i % size, top + Math.floor(i / size)));

describe("power plants on the tiles their model covers", () => {
  test("take a 3 x 3 where their era draws them with its model, else a 2 x 2", () => {
    expect([1, 2, 3, 4, 5].map((era) => plantBlockSize("lignite", era))).toEqual([3, 3, 3, 2, 2]);
    expect([2, 3, 4, 5].map((era) => plantBlockSize("gas", era))).toEqual([2, 2, 3, 3]);
    for (const kind of ["solar", "wind", "hydro"]) expect([1, 3, 5].map((era) => plantBlockSize(kind, era))).toEqual([2, 2, 2]);
    expect(plantBlockSize(NUCLEAR_KIND, 5)).toBe(3);
    expect([plantCentre(3), plantCentre(2)]).toEqual([PLANT3, PLANT2]);
  });

  test("lie on tiles of their own, the centre one in from the top left as every building's", () => {
    expect([PLANT3_BASE, PLANT3, PLANT3_LAST]).toEqual([870, 874, 878]);
    expect([PLANT2_BASE, PLANT2, PLANT2_LAST]).toEqual([1016, 1019, 1019]);
    expect(plantBlockOf(PLANT3_BASE + 4)).toEqual({ size: 3, base: PLANT3_BASE, centre: PLANT3 });
    expect(plantBlockOf(PLANT2_BASE)).toEqual({ size: 2, base: PLANT2_BASE, centre: PLANT2 });
    expect(plantBlockOf(POWERPLANT)).toBeNull();
    expect([isPlantCentre(PLANT3), isPlantCentre(PLANT2), isPlantCentre(POWERPLANT)]).toEqual([true, true, false]);
    // every tile of a block knows its centre
    expect(plantCentreOf(9, 9, PLANT3_BASE)).toEqual({ x: 10, y: 10 });
    expect(plantCentreOf(11, 11, PLANT3_LAST)).toEqual({ x: 10, y: 10 });
    expect(plantCentreOf(9, 9, PLANT2_BASE)).toEqual({ x: 10, y: 10 });
    expect(plantCentreOf(10, 10, PLANT2)).toEqual({ x: 10, y: 10 });
    // ... and the zone size the bulldozer and the road tool read
    expect(ZoneUtils.checkZoneSize(PLANT3)).toBe(3);
    expect(ZoneUtils.checkZoneSize(PLANT2)).toBe(2);
    expect(ZoneUtils.checkBigZone(PLANT2_BASE)).toEqual({ zoneSize: 2, deltaX: 1, deltaY: 1 });
    expect(ZoneUtils.checkBigZone(PLANT2_BASE + 1)).toEqual({ zoneSize: 2, deltaX: 0, deltaY: 1 });
    expect(ZoneUtils.checkBigZone(PLANT2_BASE + 2)).toEqual({ zoneSize: 2, deltaX: 1, deltaY: 0 });
  });

  test.each([
    ["coal", "lignite", 1, 3], ["coal", "lignite", 4, 2], ["gas", "gas", 2, 2], ["gas", "gas", 5, 3],
    ["solar", "solar", 4, 2], ["wind", "wind", 4, 2], ["nuclear", NUCLEAR_KIND, 5, 3],
  ] as const)("the %s tool (%s) in era %i: %i x %i... the kind's block, its kind kept, the tiles beside it free", (tool, kind, era, size) => {
    const core = city(era as number);
    expect(core.tools[tool].size).toBe(size);
    const out = core.apply({ type: "tool", tool, x: 10, y: 10 } as any);
    expect([out.accepted, out.toolResult]).toEqual([true, 0]);
    const base = size === 3 ? PLANT3_BASE : PLANT2_BASE, centre = size === 3 ? PLANT3 : PLANT2;
    expect(block(core, 9, 9, size)).toEqual([...Array(size * size)].map((_, i) => base + i));
    expect(core.map.getTileFlags(10, 10) & ZONEBIT).toBe(ZONEBIT);
    expect(value(core, 10, 10)).toBe(centre);
    expect((core.map as any).powerKinds[at(10, 10)]).toBe(kind);
    // The old 4 x 4's last row and column stay bare, and another building may stand there
    expect(value(core, 9 + size, 10)).toBe(DIRT);
    expect(value(core, 10, 9 + size)).toBe(DIRT);
    expect(core.apply({ type: "tool", tool: "residential", x: 10 + size, y: 10 + size } as any).toolResult).toBe(0);
    // ... and it is kept in metres as the building it is (src/buildings/placedBuildings.ts)
    const placed = (core.map as any).buildings.atTile(at(10, 10));
    expect(placed).toMatchObject({ tool, size });
  });

  test("give their kind's power, whatever their size, and the nuclear plant the nuclear plant's", () => {
    for (const [tool, kind, era] of [["coal", "lignite", 1], ["coal", "lignite", 4], ["solar", "solar", 4], ["gas", "gas", 5]] as const) {
      const core = city(era);
      core.apply({ type: "tool", tool, x: 10, y: 10 } as any);
      core.run(16 * 4);
      const census = (core.simulation as any)._census, sim = core.simulation as any;
      const month = sim.getDate().month;
      expect([tool, era, census.coalPowerPop]).toEqual([tool, era, 1]);
      expect([tool, era, census.plantPower]).toEqual([tool, era, plantPower(kind, sim.resources, month, sim.rules.drought)]);
      expect(census.nuclearPowerPop).toBe(0);
    }
    const core = city(5);
    core.simulation.disasterManager.disastersEnabled = false;
    core.apply({ type: "tool", tool: "nuclear", x: 10, y: 10 } as any);
    core.run(16 * 4);
    const census = (core.simulation as any)._census;
    expect([census.nuclearPowerPop, census.coalPowerPop, census.plantPower]).toEqual([1, 0, 0]);
    // ... and pollutes as the old nuclear plant does, not at all, where a lignite plant does
    const lignite = city(1);
    lignite.apply({ type: "tool", tool: "coal", x: 10, y: 10 } as any);
    lignite.run(16 * 20);
    core.run(16 * 16);
    const pollution = (c: CityCore) => (c.simulation as any).blockMaps.pollutionDensityMap.worldGet(10, 10);
    expect(pollution(lignite)).toBeGreaterThan(0);
    expect(pollution(core)).toBe(0);
  });

  test("power the zones beside them along their edge", () => {
    const core = city(4);
    core.apply({ type: "tool", tool: "solar", x: 10, y: 10 } as any); // 9..10
    core.apply({ type: "tool", tool: "residential", x: 12, y: 10 } as any); // 11..13, touching it
    core.apply({ type: "tool", tool: "residential", x: 30, y: 20 } as any); // nowhere near
    core.run(16 * 6);
    expect(core.map.getTileFlags(12, 10) & POWERBIT).toBe(POWERBIT);
    expect(core.map.getTileFlags(30, 20) & POWERBIT).toBe(0);
  });

  test("are bulldozed whole from any of their tiles, and the scan never takes a 3 x 3 for dust", () => {
    for (const [era, tool, size, from] of [[4, "solar", 2, [9, 9]], [4, "solar", 2, [10, 10]], [1, "coal", 3, [10, 10]]] as const) {
      const core = city(era);
      core.apply({ type: "tool", tool, x: 10, y: 10 } as any);
      core.run(16 * 4);
      // still standing after the scans: a 3 x 3's tiles lie among the demolition dust's (870-878 of 860-883)
      expect(block(core, 9, 9, size).every((v) => plantBlockOf(v) !== null)).toBe(true);
      core.apply({ type: "tool", tool: "bulldozer", x: from[0], y: from[1] } as any);
      const after = block(core, 9, 9, size);
      expect([tool, from, after.every((v) => plantBlockOf(v) === null)]).toEqual([tool, from, true]);
      core.run(16 * 4);
      expect(block(core, 9, 9, size).every((v) => v === DIRT || v >= RUBBLE && v <= LASTRUBBLE)).toBe(true);
    }
  });

  test("a plant built before keeps its 4 x 4, its power and its kind", () => {
    const core = city(4);
    // An old save's lignite plant: the 4 x 4 of tiles 745-760 round (10, 10), its kind recorded
    for (let i = 0; i < 16; i++) {
      const x = 9 + i % 4, y = 9 + Math.floor(i / 4), flags = BULLBIT | CONDBIT | BURNBIT | (x === 10 && y === 10 ? ZONEBIT : 0);
      core.map.setTile(x, y, POWERPLANT - 5 + i, flags);
    }
    (core.map as any).powerKinds[at(10, 10)] = "gas";
    core.run(16 * 4);
    const census = (core.simulation as any)._census, sim = core.simulation as any;
    expect(census.coalPowerPop).toBe(1);
    expect(census.plantPower).toBe(plantPower("gas", sim.resources, sim.getDate().month, sim.rules.drought));
    expect(ZoneUtils.checkZoneSize(POWERPLANT)).toBe(4);
    expect(value(core, 12, 12)).toBe(POWERPLANT + 10); // its bottom right, tile 760
  });

  test("every power tool sizes itself, the tool for each kind", () => {
    const core = city(5);
    for (const kind of POWER_KINDS) expect([kind, core.tools[PLANT_TOOLS[kind]].powerKind]).toEqual([kind, kind]);
    expect(core.tools.nuclear.powerKind).toBe(NUCLEAR_KIND);
    // a tool never set to a size by hand: the era says
    core.tools.coal.size = 4;
    expect(core.tools.coal.size).toBe(2);
    expect(RESBASE).toBeLessThan(PLANT3_BASE);
  });
});
