/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { CHAPTERS, CityStats, currentChapter, currentGoal, GOALS, readStats, tickGoals } from "../src/rulerGoals";
import { Simulation } from "../src/simulation.js";

const empty: CityStats = {
  resZones: 0, comZones: 0, indZones: 0, powerPlants: 0, poweredZones: 0, roads: 0, population: 0, rails: 0,
  policeStations: 0, fireStations: 0, stadiums: 0, airports: 0, litZones: 0, darkZones: 0, pollution: 0, crime: 0,
};

const firstDone = new Set(CHAPTERS[0].goals.map((goal) => goal.id));

describe("ruler's tasks", () => {
  test("start with homes, and tick off as the city grows", () => {
    expect(currentGoal(tickGoals(new Set(), empty))?.id).toBe("homes");
    const homes = tickGoals(new Set(), { ...empty, resZones: 2 });
    expect(currentGoal(homes)?.id).toBe("power");
    const powered = tickGoals(homes, { ...empty, resZones: 2, powerPlants: 1, poweredZones: 1 });
    expect(currentGoal(powered)?.id).toBe("wires"); // the plant powers itself; no zone has power yet
    const wired = tickGoals(powered, { ...empty, resZones: 2, powerPlants: 1, poweredZones: 2 });
    expect(currentGoal(wired)?.id).toBe("roads");
  });

  test("stay ticked when the counts drop for a moment (the census is rebuilt during each scan)", () => {
    const done = tickGoals(new Set(), { ...empty, resZones: 1, powerPlants: 1, poweredZones: 3, roads: 40 });
    expect(tickGoals(done, empty)).toEqual(done);
  });

  test("end the first chapter at a town of over 2,000 people, then go on to Khun's tasks", () => {
    const almost = tickGoals(new Set(),
      { ...empty, resZones: 9, comZones: 2, indZones: 2, powerPlants: 1, poweredZones: 14, roads: 90, population: 2000 });
    expect(currentGoal(almost)?.id).toBe("town");
    expect(currentChapter(almost)?.id).toBe("first");
    const town = tickGoals(almost, { ...empty, population: 2001 });
    expect(currentChapter(town)?.id).toBe("khun");
    expect(currentGoal(town)?.id).toBe("police");
  });

  test("ask for every zone to be lit only once there are 20, and judge it by the tiles", () => {
    expect(tickGoals(firstDone, { ...empty, litZones: 19 }).has("lit")).toBe(false);
    expect(tickGoals(firstDone, { ...empty, litZones: 25, darkZones: 1 }).has("lit")).toBe(false);
    expect(tickGoals(firstDone, { ...empty, litZones: 25 }).has("lit")).toBe(true);
  });

  test("ask for clean air and safe streets only of a city over 10,000", () => {
    const small = tickGoals(firstDone, { ...empty, population: 9000 });
    expect([small.has("clean"), small.has("safe")]).toEqual([false, false]);
    const dirty = tickGoals(firstDone, { ...empty, population: 12000, pollution: 70, crime: 20 });
    expect([dirty.has("clean"), dirty.has("safe")]).toEqual([false, true]);
  });

  test("finish after a province centre of over 50,000 people", () => {
    const all = new Set(GOALS.map((goal) => goal.id));
    all.delete("capital");
    expect(currentChapter(all)?.id).toBe("luang");
    const capital = tickGoals(all, { ...empty, population: 50001 });
    expect(currentGoal(capital)).toBeNull();
    expect(currentChapter(capital)).toBeNull();
  });

  test("read the simulation's census, and power from the map when there is one", () => {
    const census = {
      resZonePop: 3, comZonePop: 1, indZonePop: 0, coalPowerPop: 1, nuclearPowerPop: 1, poweredZoneCount: 5,
      roadTotal: 12, railTotal: 4, policeStationPop: 1, fireStationPop: 2, stadiumPop: 0, airportPop: 1,
      pollutionAverage: 44, crimeAverage: 17,
    };
    expect(readStats({ _census: census, evaluation: { cityPop: 840 } })).toEqual({
      resZones: 3, comZones: 1, indZones: 0, powerPlants: 2, poweredZones: 5, roads: 12, population: 840, rails: 4,
      policeStations: 1, fireStations: 2, stadiums: 0, airports: 1, litZones: 0, darkZones: 0, pollution: 44, crime: 17,
    });

    // A zone by a coal plant has power, one far away does not
    const map = new (GameMap as unknown as new (w: number, h: number) => any)(120, 100);
    const sim: any = new (Simulation as any)(map, 0, 3, null);
    const tools: any = new (GameTools as any)(map);
    for (const [tool, x, y] of [["coal", 10, 10], ["residential", 14, 10], ["residential", 60, 60]] as const) {
      tools[tool].doTool(x, y, sim.blockMaps);
      tools[tool].modifyIfEnoughFunding(sim.budget);
    }
    for (let step = 0; step < 16 * 12; step++) sim._simulate(sim._constructSimData());
    expect(readStats(sim)).toEqual(expect.objectContaining({ litZones: 1, darkZones: 1, powerPlants: 1 }));
  });

  test("have a title, names and hints in both languages, and point at tools that exist", () => {
    const tools = ["residential", "coal", "wire", "road", "commercial", "police", "fire", "rail", "stadium", "airport"];
    const ids = new Set<string>();
    for (const chapter of CHAPTERS) {
      expect(hasKey(chapter.title)).toBe(true);
      for (const goal of chapter.goals) {
        expect({ goal: goal.id, name: hasKey(`goals.${goal.id}`), hint: hasKey(`goals.${goal.id}.hint`) })
          .toEqual({ goal: goal.id, name: true, hint: true });
        if (goal.tool) expect(tools).toContain(goal.tool);
        expect(ids.has(goal.id)).toBe(false); // saves keep the ids of every chapter in one list
        ids.add(goal.id);
      }
    }
    expect(hasKey("goals.done_chapter") && hasKey("goals.done_all")).toBe(true);
  });
});
