/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Budget } from "../src/budget.js";
import { CityCommands, Command, commandProblem, CommandTarget, DEBUG_FUNDS } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { DIRT, LASTROAD, ROADBASE } from "../src/tileValues";

// A city that records what the commands asked of it
function recordingCity() {
  const calls: string[] = [];
  const record = (name: string) => (...args: unknown[]) => { calls.push(args.length ? `${name}(${args.join(",")})` : name); };
  const tool = {
    result: null as number | null,
    doTool(x: number, y: number) { calls.push(`doTool(${x},${y})`); this.result = 0; },
    modifyIfEnoughFunding() { calls.push("pay"); return true; },
  };
  const city: CommandTarget = {
    width: 200,
    height: 200,
    tools: { road: tool },
    blockMaps: {},
    budget: {
      roadPercent: 1, firePercent: 1, policePercent: 1,
      setTax: record("setTax"), doBudgetWindow: record("doBudgetWindow"), updateFundEffects: record("updateFundEffects"),
      setAutoBudget: record("setAutoBudget"), spend: record("spend"), totalFunds: 20000,
    },
    disasters: {
      disastersEnabled: true,
      makeFire: record("makeFire"), makeFlood: record("makeFlood"), makeCrash: record("makeCrash"), makeMeltdown: record("makeMeltdown"),
    },
    sprites: { makeMonster: record("makeMonster"), makeTornado: record("makeTornado") },
    setSpeed: record("setSpeed"),
    setAutoBulldoze: record("setAutoBulldoze"),
  };
  return { city, calls, commands: new CityCommands(city) };
}

describe("commandProblem", () => {
  test("accepts the commands the game sends", () => {
    const valid: Command[] = [
      { type: "tool", tool: "road", x: 0, y: 199 },
      { type: "budget", tax: 7, road: 100, fire: 0, police: 55, yearEnd: true },
      { type: "disaster", disaster: "monster" },
      { type: "setting", setting: "autoBulldoze", on: false },
      { type: "speed", speed: 0 },
      { type: "debugFunds" },
    ];
    for (const command of valid) {
      expect({ command, problem: commandProblem(command, 200, 200) }).toEqual({ command, problem: null });
      // Plain data: it survives being sent as JSON
      expect(commandProblem(JSON.parse(JSON.stringify(command)), 200, 200)).toBeNull();
    }
  });

  test("refuses anything else, whoever sends it", () => {
    const invalid: unknown[] = [
      null, "road", {}, { type: "teleport" },
      { type: "tool", tool: "query", x: 1, y: 1 },
      { type: "tool", tool: "road", x: 200, y: 0 },
      { type: "tool", tool: "road", x: 1.5, y: 0 },
      { type: "tool", tool: "road", x: "1", y: 0 },
      { type: "budget", tax: 21, road: 100, fire: 100, police: 100, yearEnd: false },
      { type: "budget", tax: 7, road: 101, fire: 100, police: 100, yearEnd: false },
      { type: "budget", tax: 7, road: 100, fire: 100, police: 100 },
      { type: "disaster", disaster: "earthquake" },
      { type: "setting", setting: "money", on: true },
      { type: "setting", setting: "disasters", on: "yes" },
      { type: "speed", speed: 4 },
    ];
    for (const command of invalid) expect({ command, problem: commandProblem(command, 200, 200) }).not.toEqual({ command, problem: null });
  });
});

describe("CityCommands", () => {
  test("a tool builds, then pays", () => {
    const { calls, commands } = recordingCity();
    expect(commands.apply({ type: "tool", tool: "road", x: 3, y: 4 })).toEqual({ accepted: true, toolResult: 0 });
    expect(calls).toEqual(["doTool(3,4)", "pay"]);
  });

  test("the budget sets each service's share; the yearly budget also settles the year", () => {
    const { city, calls, commands } = recordingCity();
    commands.apply({ type: "budget", tax: 9, road: 80, fire: 50, police: 100, yearEnd: false });
    expect([city.budget.roadPercent, city.budget.firePercent, city.budget.policePercent]).toEqual([0.8, 0.5, 1]);
    expect(calls).toEqual(["setTax(9)", "updateFundEffects"]);
    calls.length = 0;
    commands.apply({ type: "budget", tax: 9, road: 80, fire: 50, police: 100, yearEnd: true });
    expect(calls).toEqual(["setTax(9)", "doBudgetWindow"]);
  });

  test("disasters, settings, speed and debug funds reach the right part of the city", () => {
    const { city, calls, commands } = recordingCity();
    for (const disaster of ["fire", "flood", "tornado", "monster", "crash", "meltdown"] as const) commands.apply({ type: "disaster", disaster });
    commands.apply({ type: "setting", setting: "autoBudget", on: true });
    commands.apply({ type: "setting", setting: "autoBulldoze", on: false });
    commands.apply({ type: "setting", setting: "disasters", on: false });
    commands.apply({ type: "speed", speed: 3 });
    commands.apply({ type: "debugFunds" });
    expect(calls).toEqual(["makeFire", "makeFlood", "makeTornado", "makeMonster", "makeCrash", "makeMeltdown",
      "setAutoBudget(true)", "setAutoBulldoze(false)", "setSpeed(3)", `spend(${-DEBUG_FUNDS})`]);
    expect(city.disasters.disastersEnabled).toBe(false);
  });

  test("a refused command changes nothing", () => {
    const { calls, commands } = recordingCity();
    const outcome = commands.apply({ type: "tool", tool: "road", x: -1, y: 0 });
    expect(outcome.accepted).toBe(false);
    expect(outcome.reason).toBe("outside the map");
    expect(calls).toEqual([]);
  });
});

describe("commands on a real map", () => {
  function realCity(funds: number) {
    const map = new GameMap(20, 20);
    const budget = new Budget();
    budget.setFunds(funds);
    const noop = () => undefined;
    const commands = new CityCommands({
      width: map.width,
      height: map.height,
      tools: new (GameTools as unknown as new (map: unknown) => CommandTarget["tools"])(map),
      blockMaps: {},
      budget,
      disasters: { disastersEnabled: true, makeFire: noop, makeFlood: noop, makeCrash: noop, makeMeltdown: noop },
      sprites: { makeMonster: noop, makeTornado: noop },
      setSpeed: noop,
      setAutoBulldoze: noop,
    });
    return { map, budget, commands };
  }

  test("a road command lays a road and charges for it", () => {
    const { map, budget, commands } = realCity(1000);
    expect(map.getTileValue(5, 5)).toBe(DIRT);
    const outcome = commands.apply({ type: "tool", tool: "road", x: 5, y: 5 });
    expect(outcome).toEqual({ accepted: true, toolResult: 0 });
    expect(map.getTileValue(5, 5)).toBeGreaterThanOrEqual(ROADBASE);
    expect(map.getTileValue(5, 5)).toBeLessThanOrEqual(LASTROAD);
    expect(budget.totalFunds).toBeLessThan(1000);
  });

  test("without money nothing is built", () => {
    const { map, budget, commands } = realCity(0);
    expect(commands.apply({ type: "tool", tool: "residential", x: 5, y: 5 }).toolResult).toBe(2); // TOOLRESULT_NO_MONEY
    expect(map.getTileValue(5, 5)).toBe(DIRT);
    expect(budget.totalFunds).toBe(0);
  });
});

describe("undo", () => {
  function undoCity(funds: number) {
    const map = new GameMap(30, 30);
    const budget = new Budget();
    budget.setFunds(funds);
    let time = 100;
    const noop = () => undefined;
    const commands = new CityCommands({
      width: map.width,
      height: map.height,
      tools: new (GameTools as unknown as new (map: unknown) => CommandTarget["tools"])(map),
      blockMaps: {},
      budget,
      disasters: { disastersEnabled: true, makeFire: noop, makeFlood: noop, makeCrash: noop, makeMeltdown: noop },
      sprites: { makeMonster: noop, makeTornado: noop },
      setSpeed: noop,
      setAutoBulldoze: noop,
      map,
      cityTime: () => time,
    });
    return { map, budget, commands, later: (units: number) => { time += units; } };
  }

  test("takes back the last stroke, tiles and money, then the one before", () => {
    const { map, budget, commands } = undoCity(1000);
    expect(commands.canUndo()).toBe(false);
    commands.apply({ type: "tool", tool: "residential", x: 5, y: 5, stroke: 1 });
    for (let x = 10; x <= 14; x++) commands.apply({ type: "tool", tool: "road", x, y: 10, stroke: 2 });
    expect(budget.totalFunds).toBeLessThan(900);
    expect(commands.apply({ type: "undo" })).toEqual({ accepted: true, undone: true });
    for (let x = 10; x <= 14; x++) expect(map.getTileValue(x, 10)).toBe(DIRT); // the whole drag of road
    expect(budget.totalFunds).toBe(900);
    expect(map.getTileValue(5, 5)).not.toBe(DIRT);
    expect(commands.apply({ type: "undo" }).undone).toBe(true);
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) expect(map.getTileValue(x, y)).toBe(DIRT);
    expect(budget.totalFunds).toBe(1000);
    expect(commands.apply({ type: "undo" }).undone).toBe(false);
  });

  test("only recent building: after two game months there is nothing to undo", () => {
    const { commands, later } = undoCity(1000);
    commands.apply({ type: "tool", tool: "road", x: 3, y: 3 });
    later(8);
    expect(commands.canUndo()).toBe(true);
    later(1);
    expect(commands.canUndo()).toBe(false);
    expect(commands.apply({ type: "undo" }).undone).toBe(false);
  });

  test("a tool without the money leaves nothing to undo, and a bad stroke is refused", () => {
    const { commands } = undoCity(0);
    commands.apply({ type: "tool", tool: "residential", x: 5, y: 5, stroke: 3 });
    expect(commands.canUndo()).toBe(false);
    expect(commandProblem({ type: "tool", tool: "road", x: 1, y: 1, stroke: -1 }, 30, 30)).toBe("bad stroke");
    expect(commandProblem({ type: "undo" }, 30, 30)).toBeNull();
  });
});
