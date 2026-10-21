/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Easy, normal and hard (src/gameModes.ts, docs/GAME_DESIGN.md 6.3): one table scales the trained people, the building
// time, the starting money and each era's people; the level is the city's for good, and online is always normal.

import { commandProblem } from "../src/cityCommands";
import { CityCore } from "../src/core/cityCore";
import { commandTarget } from "../src/core/cityLayers";
import { scoreEra } from "../src/eraScore";
import { ERA_RULES } from "../src/eraRules";
import { GameMap } from "../src/gameMap.js";
import { levelsFor, MODE_RULES, modeChoosable, modeOfLevel, modeRule, startingFundsIn } from "../src/gameModes";
import { MapGenerator } from "../src/mapGenerator.js";

describe("the modes", () => {
  test("follow section 6.3, on the game's old levels", () => {
    expect(MODE_RULES.easy).toEqual({ level: 0, trained: 0.5, buildTime: 0.5, schooling: 0.5, funds: 1.5, people: 0.75 });
    expect(MODE_RULES.normal).toEqual({ level: 1, trained: 1, buildTime: 1, schooling: 1, funds: 1, people: 1 });
    expect(MODE_RULES.hard).toEqual({ level: 2, trained: 1.5, buildTime: 1.5, schooling: 1.5, funds: 0.7, people: 1.25 });
    expect([0, 1, 2, 7, undefined].map(modeOfLevel)).toEqual(["easy", "normal", "hard", "normal", "normal"]);
    expect(startingFundsIn(20000, 0)).toBe(30000);
    expect(startingFundsIn(20000, 2)).toBe(14000);
  });

  test("a city of an online world has no choice: it is normal", () => {
    expect(modeChoosable(null)).toBe(true);
    expect(levelsFor(null)).toEqual([0, 1, 2]);
    expect(modeChoosable("world-1")).toBe(false);
    expect(levelsFor("world-1")).toEqual([1]);
  });

  test("scale the people each era wants, the trained people needed and the building time", () => {
    const map = { era: 1, width: 1, height: 1, civicKinds: {}, getTileValue: () => 0, getTile: () => ({ isZone: () => false }) };
    const sim = (level: number) => ({ _gameLevel: level, evaluation: { cityPop: 1000 }, _census: {}, _serviceLevels: {} });
    const objects = { all: () => [] };
    expect(scoreEra(map, sim(0), objects).peopleWanted).toBe(ERA_RULES[1].people * 0.75);
    expect(scoreEra(map, sim(1), objects).peopleWanted).toBe(ERA_RULES[1].people);
    expect(scoreEra(map, sim(2), objects).peopleWanted).toBe(ERA_RULES[1].people * 1.25);
    const hard = new CityCore({ map: (MapGenerator as any)(), seed: 2, level: 2 });
    const target = commandTarget(hard.map, hard.simulation, hard.tools, () => undefined);
    expect(target.unlocks?.()?.trainedScale).toBe(1.5);
    target.startSite?.(10, 10, "hydro");
    expect(hard.map.sites[10 * hard.map.width + 10].ready - hard.simulation._cityTime).toBe(12 * 1.5 * 4);
    expect(modeRule(hard.simulation._gameLevel).people).toBe(1.25);
  });

  test("the level is saved with the city and kept when it opens again; no command changes it", () => {
    const core = new CityCore({ map: (MapGenerator as any)(), seed: 4, level: 2 });
    const saved = JSON.parse(JSON.stringify(core.save()));
    expect(saved._gameLevel).toBe(2);
    const again = new CityCore({ map: new (GameMap as any)(saved.width, saved.height), saved, level: 0 });
    expect(again.simulation._gameLevel).toBe(2);
    expect(again.simulation.disasterManager._gameLevel).toBe(2);
    expect(again.simulation.evaluation.gameLevel).toBe("2");
    expect(commandProblem({ type: "level", level: 0 }, 10, 10)).toMatch(/unknown command/);
  });
});
