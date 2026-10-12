/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { hasKey } from "../src/i18n/index";
import { CityStats, currentGoal, GOALS, readStats, tickGoals } from "../src/rulerGoals";

const empty: CityStats = { resZones: 0, comZones: 0, indZones: 0, powerPlants: 0, poweredZones: 0, roads: 0, population: 0 };

describe("first tasks", () => {
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

  test("end at a town of over 2,000 people", () => {
    const almost = tickGoals(new Set(), { resZones: 9, comZones: 2, indZones: 2, powerPlants: 1, poweredZones: 14, roads: 90, population: 2000 });
    expect(currentGoal(almost)?.id).toBe("town");
    expect(currentGoal(tickGoals(almost, { ...empty, population: 2001 }))).toBeNull();
  });

  test("read the simulation's census", () => {
    const census = { resZonePop: 3, comZonePop: 1, indZonePop: 0, coalPowerPop: 1, nuclearPowerPop: 1, poweredZoneCount: 5, roadTotal: 12 };
    expect(readStats({ _census: census, evaluation: { cityPop: 840 } })).toEqual(
      { resZones: 3, comZones: 1, indZones: 0, powerPlants: 2, poweredZones: 5, roads: 12, population: 840 });
  });

  test("have a name and a hint in both languages, and point at tools that exist", () => {
    const tools = ["residential", "coal", "wire", "road", "commercial"];
    for (const goal of GOALS) {
      expect({ goal: goal.id, name: hasKey(`goals.${goal.id}`), hint: hasKey(`goals.${goal.id}.hint`) })
        .toEqual({ goal: goal.id, name: true, hint: true });
      if (goal.tool) expect(tools).toContain(goal.tool);
    }
  });
});
