/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Raising a stretch of road from its card (src/roadUpgrade.ts; owner, 24 Oct 2026): every level is open from the first
// era, the price of a stretch is the upgrade tool's own, and the card's button raises the stretch and takes the money.

import { CityCommands } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { inspectAt } from "../src/inspect";
import { MAX_ROAD_LEVEL, roadLevelAt, upgradeCost } from "../src/roadLevels";
import { raiseStretch, stretchLevel, stretchPrice, upgradeOffers } from "../src/roadUpgrade";
import { Simulation } from "../src/simulation.js";
import { unlockCity } from "../src/unlocks";

function makeCity() {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.civicKinds = {};
  map.powerKinds = {};
  map.era = 1;
  const sim: any = new (Simulation as any)(map, 1, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  const city = {
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, rank: () => 5, setPowerKind: () => undefined, unlocks: () => unlockCity(map),
  } as any;
  const commands = new CityCommands(city);
  return { map, sim, tools, commands };
}

describe("raising a stretch of road", () => {
  test("a stretch is raised at once in the first era, for the sum of its tiles' steps, and the money is taken", () => {
    const { map, sim, tools, commands } = makeCity();
    const row = Array.from({ length: 10 }, (_, k) => 30 * 64 + 5 + k);
    for (let x = 5; x < 15; x++) commands.apply({ type: "tool", tool: "road", x, y: 30 });
    const road = { tiles: row, lengthM: 160 };
    expect(stretchLevel(map, row)).toBe(1);
    const factor = tools.road_upgrade.costFactor || 1;
    const offers = upgradeOffers(map, road, 16, factor);
    expect(offers.map((o) => o.level)).toEqual([2, 3]);
    expect(offers[0].price).toBe(10 * Math.round(upgradeCost(1) * factor));
    expect(offers[1].price).toBe(10 * (Math.round(upgradeCost(1) * factor) + Math.round(upgradeCost(2) * factor)));
    expect(offers[0].upkeep).toBeGreaterThan(0);
    // ... and the card's button, through the tool's own command
    const before = sim.budget.totalFunds;
    const taken = raiseStretch(map, road, 2, (x, y) => commands.apply({ type: "tool", tool: "road_upgrade", x, y }).accepted);
    expect(taken).toBe(10);
    expect(row.every((i) => roadLevelAt(map, i % 64, 30) === 2)).toBe(true);
    expect(before - sim.budget.totalFunds).toBe(offers[0].price);
    // ... a jump of two levels takes both steps, never past the level chosen
    const again = upgradeOffers(map, road, 16, factor);
    raiseStretch(map, road, 4, (x, y) => commands.apply({ type: "tool", tool: "road_upgrade", x, y }).accepted);
    expect(row.every((i) => roadLevelAt(map, i % 64, 30) === 4)).toBe(true);
    expect(again[1].level).toBe(4);
  });

  test("a stretch's price matches the upgrade tool's, and the top level offers nothing", () => {
    const { map, sim, commands } = makeCity();
    for (let x = 5; x < 12; x++) commands.apply({ type: "tool", tool: "road", x, y: 30 });
    const tiles = Array.from({ length: 7 }, (_, k) => 30 * 64 + 5 + k);
    const funds = sim.budget.totalFunds;
    const price = stretchPrice(map, tiles, 3, 1);
    for (let x = 5; x < 12; x++) for (let n = 0; n < 2; n++) commands.apply({ type: "tool", tool: "road_upgrade", x, y: 30 });
    expect(funds - sim.budget.totalFunds).toBe(price);
    raiseStretch(map, { tiles, lengthM: 112 }, MAX_ROAD_LEVEL, (x, y) => commands.apply({ type: "tool", tool: "road_upgrade", x, y }).accepted);
    expect(upgradeOffers(map, { tiles, lengthM: 112 }, 16, 1)).toEqual([]);
    expect(raiseStretch(map, { tiles, lengthM: 112 }, MAX_ROAD_LEVEL, () => true)).toBe(0);
  });

  test("the road's card carries its stretch", () => {
    const { map, sim, commands } = makeCity();
    for (let x = 5; x < 15; x++) commands.apply({ type: "tool", tool: "road", x, y: 30 });
    const found = inspectAt({ map, objects: { at: () => null }, blockMaps: sim.blockMaps, cityTime: 0, startingYear: 1900,
      language: "en" } as any, 8, 30);
    expect(found?.road?.tiles.length).toBeGreaterThan(1);
  });
});
