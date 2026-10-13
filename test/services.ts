/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Schools and hospitals (src/services.ts, docs/SERVICES.md): the higher ones need a higher ruler's house; with power
// they give places, which draw families, skilled work and health, for their upkeep.

import { CityCommands } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { BASE_PRICES } from "../src/provinceRules";
import { HOUSE_KIND } from "../src/rulerHouse";
import {
  EDUCATION_TOOLS, familyPull, HEALTH_TOOLS, NEEDS_HOUSE_LEVEL, peopleOf, pollutionShield, SERVICE_KINDS, SERVICE_SPECS,
  serviceLevels, skilled,
} from "../src/services";
import { Simulation } from "../src/simulation.js";

function city() {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.rulerHouse = null;
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, houseMap: map, rank: () => 5,
    setRulerHouse: (x: number, y: number) => {
      map.civicKinds[y * map.width + x] = HOUSE_KIND;
      map.rulerHouse = { x, y, level: 1, wings: [] };
    },
    setCivicKind: (x: number, y: number, kind: string) => { map.civicKinds[y * map.width + x] = kind; },
  } as any);
  // The house stands beside a road (src/rulerHouse.ts): a road west of the place the tests build it
  for (let y = 7; y < 14; y++) commands.apply({ type: "tool", tool: "road", x: 8, y });
  const tool = (name: string, x: number, y: number) => commands.apply({ type: "tool", tool: name as any, x, y });
  return { map, sim, tool };
}

describe("schools and hospitals", () => {
  test("nine kinds, the higher ones dearer and needing a higher ruler's house", () => {
    expect(EDUCATION_TOOLS).toHaveLength(5);
    expect(HEALTH_TOOLS).toHaveLength(4);
    for (const kind of SERVICE_KINDS) {
      expect([kind, BASE_PRICES[kind]]).toEqual([kind, SERVICE_SPECS[kind].price]);
      expect([kind, hasKey(`tool.${kind}`), hasKey(`choice.${kind}`), hasKey(`rules.cost.${kind}`)])
        .toEqual([kind, true, true, true]);
    }
    for (const list of [EDUCATION_TOOLS, HEALTH_TOOLS]) {
      for (let i = 1; i < list.length; i++) {
        expect(SERVICE_SPECS[list[i]].price).toBeGreaterThan(SERVICE_SPECS[list[i - 1]].price);
        expect(SERVICE_SPECS[list[i]].house).toBeGreaterThanOrEqual(SERVICE_SPECS[list[i - 1]].house);
      }
    }
  });

  test("wait for the ruler's house's level, and the map records which stands where", () => {
    const { map, tool } = city();
    expect(tool("primary_school", 20, 20).toolResult).toBe(0);
    expect(map.civicKinds[20 * map.width + 20]).toBe("primary_school");
    expect(tool("secondary_school", 30, 20)).toMatchObject({ accepted: false, reason: NEEDS_HOUSE_LEVEL });
    tool("ruler_house", 10, 10);
    tool("ruler_house_upgrade", 10, 10);
    expect(map.rulerHouse.level).toBe(2);
    expect(tool("secondary_school", 30, 20).toolResult).toBe(0);
    expect(tool("university", 40, 20)).toMatchObject({ accepted: false, reason: NEEDS_HOUSE_LEVEL });
  });

  test("give places with power, which become the city's levels, and cost their upkeep", () => {
    const { map, sim, tool } = city();
    tool("coal", 10, 10);
    tool("primary_school", 14, 10);
    tool("health_centre", 50, 30); // no power out there
    // The power scan comes every fifth cycle at this speed
    for (let step = 0; step < 16 * 8; step++) sim._simulate(sim._constructSimData());
    expect(sim._services.places.basic).toBe(SERVICE_SPECS.primary_school.places);
    expect(sim._services.places.health).toBe(0);
    expect(sim._census.educationUpkeep).toBe(SERVICE_SPECS.primary_school.upkeep);
    expect(sim._census.healthUpkeep).toBe(SERVICE_SPECS.health_centre.upkeep);
    expect(map.civicKinds[10 * map.width + 14]).toBe("primary_school");
  });

  test("draw families from 500 people, skilled work and health take pollution's harm away", () => {
    const few = serviceLevels({ basic: 1000, higher: 0, health: 0 }, 400);
    expect(familyPull(few)).toBe(0);
    const town = serviceLevels({ basic: 1000, higher: 300, health: 10000 }, 5000);
    expect(town).toEqual({ basic: 100, higher: 100, health: 100, people: 5000 });
    expect(familyPull(town)).toBeCloseTo(0.1);
    expect(skilled(town)).toBe(1);
    expect(pollutionShield(town)).toBeCloseTo(0.5);
    const poor = serviceLevels({ basic: 0, higher: 0, health: 0 }, 5000);
    expect(familyPull(poor)).toBeCloseTo(-0.1);
    // A village only gains from them: their lack holds a city back from the town on
    expect(familyPull(serviceLevels({ basic: 0, higher: 0, health: 0 }, 1500))).toBe(0);
    expect(familyPull(serviceLevels({ basic: 1000, higher: 0, health: 1500 }, 1500))).toBeCloseTo(0.1);
    expect(peopleOf({ resPop: 100, comPop: 2, indPop: 3 })).toBe((100 + 5 * 8) * 20);
  });

  test("have their words in both languages", () => {
    for (const key of ["choice.title.primary_school", "choice.title.health_centre", "service.note.needs_house",
      "budget.education", "budget.health", "msg.bad.few_schools", "msg.bad.few_hospitals", "about.building.education",
      "about.building.health", "status.services", "status.services_value", "status.services_title",
      "service.reason.house.2", "service.reason.house.3", "service.reason.house.4"]) {
      expect([key, hasKey(key)]).toEqual([key, true]);
    }
  });
});
