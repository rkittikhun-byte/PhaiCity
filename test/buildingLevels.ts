/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The levels of the ruler's buildings (src/buildingLevels.ts): each level a tool, recorded where it stands, doing
// more and costing more to keep the higher it is, raised a level at a time for the difference, saved with the city.

import { buildingLevelAt, levelOfTool, levelUpgradeCost, LEVEL_GROUPS, LEVEL_TOOLS } from "../src/buildingLevels";
import { TOOL_NAMES } from "../src/cityCommands";
import { CityCore, STEPS_PER_YEAR } from "../src/core/cityCore";
import { GameMap } from "../src/gameMap.js";
import { hasKey } from "../src/i18n/index";
import { MapGenerator } from "../src/mapGenerator.js";
import { TOOL_COSTS } from "../src/provinceRules";
import { NEEDS_HOUSE_LEVEL } from "../src/services";

/** A bare map with a road and the ruler's house on it, and money to build */
function city() {
  const map = (MapGenerator as any).fromPresetCells(40, 30, new Uint8Array(40 * 30));
  const core = new CityCore({ map, seed: 7 });
  core.simulation.budget.setFunds(50000);
  for (let x = 1; x < 39; x++) core.apply({ type: "tool", tool: "road", x, y: 10 });
  expect(core.apply({ type: "tool", tool: "ruler_house" as any, x: 3, y: 8 }).accepted).toBe(true);
  return core;
}

describe("building levels", () => {
  test("every level is a known, priced, named tool, dearer as it goes up", () => {
    for (const tool of [...LEVEL_TOOLS, "building_upgrade"]) {
      expect(TOOL_NAMES).toContain(tool);
      expect(TOOL_COSTS).toContain(tool);
      expect(hasKey(`tool.${tool}`)).toBe(true);
      expect(hasKey(`rules.cost.${tool}`)).toBe(true);
    }
    for (const group of Object.values(LEVEL_GROUPS)) {
      for (let i = 1; i < group.levels.length; i++) {
        expect(group.levels[i].price).toBeGreaterThan(group.levels[i - 1].price);
        expect(group.levels[i].effect).toBeGreaterThan(group.levels[i - 1].effect);
      }
    }
    expect(levelOfTool("police")).toEqual({ group: "police", level: 2 });
    expect(levelUpgradeCost("police", 1)).toBe(250);
    expect(levelUpgradeCost("fire", 3)).toBeNull();
  });

  test("a police box is recorded, does half a station's work and costs half to keep", () => {
    const core = city();
    expect(core.apply({ type: "tool", tool: "police_box" as any, x: 12, y: 8 }).accepted).toBe(true);
    expect(core.apply({ type: "tool", tool: "police" as any, x: 20, y: 8 }).accepted).toBe(true);
    expect(buildingLevelAt(core.map, 12, 8, "police")).toBe(1);
    expect(buildingLevelAt(core.map, 20, 8, "police")).toBe(2);
    core.run(STEPS_PER_YEAR / 4);
    const census = core.simulation._census;
    expect(census.policeStationPop).toBe(2);
    expect(census.policeUpkeepUnits).toBeCloseTo(1.5);
    const stations = core.simulation.blockMaps.policeStationMap;
    expect(stations.worldGet(12, 8) * 2).toBeLessThanOrEqual(stations.worldGet(20, 8) + 1);
  });

  test("the upgrade raises a building a level for the difference; the higher levels wait for the house", () => {
    const core = city();
    core.apply({ type: "tool", tool: "fire_post" as any, x: 12, y: 8 });
    const funds = core.simulation.budget.totalFunds;
    expect(core.apply({ type: "tool", tool: "building_upgrade" as any, x: 13, y: 9 }).accepted).toBe(true);
    expect(buildingLevelAt(core.map, 12, 8, "fire")).toBe(2);
    expect(funds - core.simulation.budget.totalFunds).toBe(250);
    // A disaster relief centre needs a level 2 house, so neither its tool nor the upgrade to it may be used yet
    expect(core.apply({ type: "tool", tool: "building_upgrade" as any, x: 12, y: 8 })).toMatchObject({
      accepted: false, reason: NEEDS_HOUSE_LEVEL });
    expect(core.apply({ type: "tool", tool: "fire_centre" as any, x: 20, y: 8 })).toMatchObject({
      accepted: false, reason: NEEDS_HOUSE_LEVEL });
  });

  test("a saved city keeps its buildings' levels, and forgets those that are gone", () => {
    const core = city();
    core.apply({ type: "tool", tool: "police_box" as any, x: 12, y: 8 });
    const saved = JSON.parse(JSON.stringify({ ...core.save(), width: core.map.width, height: core.map.height }));
    expect(saved.buildingLevels).toEqual({ [8 * 40 + 12]: 1 });
    const again = new CityCore({ map: new (GameMap as any)(saved.width, saved.height), saved });
    expect(buildingLevelAt(again.map, 12, 8, "police")).toBe(1);
    for (let y = 7; y <= 9; y++) for (let x = 11; x <= 13; x++) again.apply({ type: "tool", tool: "bulldozer", x, y });
    expect(again.save().buildingLevels).toBeUndefined();
  });
});
