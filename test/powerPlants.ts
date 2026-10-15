/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The kinds of power plant (docs/POWER_PLANTS.md): what each gives and costs, where it may be built, and the city
// running them.

import { CityCommands, NEEDS_WATER, NO_RESOURCE } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import {
  besideWater, canBuildKind, fuelShare, kindOfTool, MIN_FUEL_SHARE, PLANT_TOOLS, plantFuel, plantPollution, plantPower,
  plantSmokes, POWER_KINDS,
  powerKindAt,
} from "../src/powerPlants";
import { BASE_PRICES } from "../src/provinceRules";
import { Simulation } from "../src/simulation.js";
import { POWERPLANT, RIVER } from "../src/tileValues";

const JANUARY = 0;
const APRIL = 3;
const JULY = 6;
const dry = { months: [12, 1, 2, 3, 4], share: 0.4 };

describe("the kinds of power plant", () => {
  test("are five, each built by its own tool, the old coal tool building lignite plants", () => {
    expect(POWER_KINDS).toEqual(["lignite", "gas", "hydro", "solar", "wind"]);
    expect(PLANT_TOOLS.lignite).toBe("coal");
    expect(kindOfTool("solar")).toBe("solar");
    expect(kindOfTool("road")).toBeNull();
    for (const kind of POWER_KINDS) expect(BASE_PRICES[PLANT_TOOLS[kind] as keyof typeof BASE_PRICES]).toBeGreaterThan(0);
  });

  test("give power by kind, resource and season", () => {
    const none = {};
    expect(plantPower("lignite", none, JANUARY, null)).toBe(700); // as the coal plant always did
    expect(plantPower("gas", { petroleum: 0 }, JANUARY, null)).toBeGreaterThan(plantPower("lignite", { lignite: 0 }, JANUARY, null));
    // Dams: more with more hydropower, less in a dry month
    expect(plantPower("hydro", { hydro: 5 }, JULY, dry)).toBeGreaterThan(plantPower("hydro", { hydro: 1 }, JULY, dry));
    expect(plantPower("hydro", { hydro: 3 }, JANUARY, dry)).toBe(Math.round(600 * 0.6));
    // Solar: more where the sun is, less in the rains; wind: calm in the hot months
    expect(plantPower("solar", { solar: 5 }, JANUARY, null)).toBeGreaterThan(plantPower("solar", { solar: 0 }, JANUARY, null));
    expect(plantPower("solar", { solar: 3 }, JULY, null)).toBeLessThan(plantPower("solar", { solar: 3 }, JANUARY, null));
    expect(plantPower("wind", { wind: 3 }, APRIL, null)).toBe(plantPower("wind", { wind: 3 }, JANUARY, null) / 2);
  });

  test("cost fuel for lignite and gas, less where the province has its own", () => {
    expect(plantFuel("lignite", {})).toBe(240);
    expect(plantFuel("lignite", { lignite: 5 })).toBeLessThan(plantFuel("lignite", {}));
    expect(plantFuel("gas", { petroleum: 4 })).toBeLessThan(plantFuel("gas", {}));
    for (const kind of ["hydro", "solar", "wind"] as const) expect(plantFuel(kind, {})).toBe(0);
  });

  test("smoke or make noise by kind", () => {
    expect(plantPollution("lignite")).toBe(100);
    expect(plantPollution("gas")).toBeLessThan(plantPollution("lignite"));
    expect([plantPollution("hydro"), plantPollution("solar")]).toEqual([0, 0]);
    expect(plantPollution("wind")).toBeGreaterThan(0);
    expect(POWER_KINDS.filter(plantSmokes)).toEqual(["lignite", "gas"]);
  });

  test("dams and wind farms only where the province has them; a practice map has all", () => {
    expect(canBuildKind("hydro", { hydro: 0, wind: 2 })).toBe(false);
    expect(canBuildKind("wind", { hydro: 0, wind: 2 })).toBe(true);
    expect(canBuildKind("solar", { solar: 0 })).toBe(true);
    expect(canBuildKind("hydro", {})).toBe(true);
  });

  test("are lignite where the map has no record, as plants built before the kinds were", () => {
    expect(powerKindAt(null, 5)).toBe("lignite");
    expect(powerKindAt({ 5: "solar" }, 5)).toBe("solar");
    expect(powerKindAt({ 5: "unknown" }, 5)).toBe("lignite");
  });

  test("dams need water beside them, all round the 4 x 4", () => {
    const water = new Set(["10,4"]);
    const isWater = (x: number, y: number) => water.has(`${x},${y}`);
    expect(besideWater(10, 6, isWater)).toBe(true); // the row above the top (6 - 2)
    expect(besideWater(10, 7, isWater)).toBe(false);
    expect(besideWater(13, 5, (x, y) => x === 16 && y === 5)).toBe(true); // the column right of the plant (13 + 3)
  });
});

describe("power plants in the city", () => {
  // Map widths are multiples of 8, as the scan goes in eighths
  const blank = () => new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);

  function city(resources: Record<string, number> | null) {
    const map = blank();
    map.powerKinds = {};
    const sim: any = new (Simulation as any)(map, 0, 3, null, null, resources);
    const tools: any = new (GameTools as any)(map);
    sim.budget.setFunds(50000);
    const commands = new CityCommands({
      width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
      disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
      resources: sim.resources,
      isWaterAt: (x: number, y: number) => map.testBounds(x, y) && map.getTileValue(x, y) === RIVER,
      setPowerKind: (x: number, y: number, kind: string) => { map.powerKinds[y * map.width + x] = kind; },
    } as any);
    return { map, sim, commands };
  }

  test("a dam is refused where the province has no hydropower, or with no water beside it", () => {
    const { map, commands } = city({ hydro: 0, solar: 3 });
    expect(commands.apply({ type: "tool", tool: "hydro", x: 10, y: 10 }).reason).toBe(NO_RESOURCE);
    const wet = city({ hydro: 3 });
    expect(wet.commands.apply({ type: "tool", tool: "hydro", x: 10, y: 10 }).reason).toBe(NEEDS_WATER);
    for (let x = 5; x < 20; x++) wet.map.setTile(x, 8, RIVER, 0); // a river along the row above it
    const built = wet.commands.apply({ type: "tool", tool: "hydro", x: 10, y: 10 });
    expect([built.accepted, built.toolResult]).toEqual([true, 0]);
    expect(wet.map.getTileValue(10, 10)).toBe(POWERPLANT);
    expect(wet.map.powerKinds[10 * 64 + 10]).toBe("hydro");
    void map;
  });

  test("each kind gives its own power and smoke, and the fuel is paid with the year's taxes", () => {
    const { map, sim, commands } = city({ solar: 5, lignite: 0, petroleum: 0 });
    expect(commands.apply({ type: "tool", tool: "solar", x: 10, y: 10 }).toolResult).toBe(0);
    expect(commands.apply({ type: "tool", tool: "gas", x: 30, y: 10 }).toolResult).toBe(0);
    expect(map.powerKinds[10 * 64 + 10]).toBe("solar");
    expect(map.powerKinds[10 * 64 + 30]).toBe("gas");
    // Long enough for a pollution scan (every 17 cycles at this speed)
    for (let step = 0; step < 16 * 20; step++) sim._simulate(sim._constructSimData());
    const month = sim.getDate().month;
    expect(sim._census.plantPower).toBe(plantPower("solar", sim.resources, month, sim.rules.drought) +
      plantPower("gas", sim.resources, month, sim.rules.drought));
    // Nothing uses their power, so the gas plant burns only the least share of its fuel (fuelShare)
    expect(sim._powerManager.load).toBeLessThan(MIN_FUEL_SHARE);
    expect(sim._census.plantFuel).toBeCloseTo(plantFuel("gas", sim.resources) * MIN_FUEL_SHARE);
    sim._census.totalPop = 10;
    sim.budget.collectTax(0, sim._census);
    expect(sim.budget.fuelCost).toBe(Math.round(plantFuel("gas", sim.resources) * MIN_FUEL_SHARE));
    // The solar farm's tiles stay clean, the gas plant's do not
    const pollution = sim.blockMaps.pollutionDensityMap;
    expect(pollution.worldGet(10, 10)).toBeLessThan(pollution.worldGet(30, 10));
  });

  test("a plant burns fuel for the share of its power the city uses, and a little standing by", () => {
    // Owner, 15 Oct 2026: "หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี"
    expect(fuelShare(0)).toBe(MIN_FUEL_SHARE);
    expect(fuelShare(0.5)).toBe(0.5);
    expect(fuelShare(1.5)).toBe(1);
  });

  test("has its words in both languages", () => {
    for (const kind of POWER_KINDS) {
      const tool = PLANT_TOOLS[kind];
      expect([tool, hasKey(`tool.${tool}`), hasKey(`choice.${tool}`)]).toEqual([tool, true, true]);
    }
    for (const key of ["choice.title.coal", "choice.unavailable", "tool.no_resource", "tool.needs_water", "budget.fuel",
      "about.building.power_kinds", "about.building.gas", "about.building.hydro", "about.building.solar",
      "about.building.wind", "rules.cost.gas"]) expect([key, hasKey(key)]).toEqual([key, true]);
  });
});
