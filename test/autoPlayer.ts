/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The auto player (src/core/autoPlayer.ts): it builds a town through commands and plays it for years, and its yearly
// accounts hold every baht the treasury gained or lost, so a change to the game's balance can be read line by line.

import { AutoPlayer, festivalAnswer, yearAccounts } from "../src/core/autoPlayer";
import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";
import { zoneCode } from "../src/zoneCells";

/** A bare 16 m map painted a cell at a time, with a road through the town and a crossing road; with a province's
 *  resources it keeps the country's festivals (src/festivals.ts calendarOf), else none */
function town(resources?: Record<string, number>) {
  const map = (MapGenerator as any).fromPresetCells(80, 60, new Uint8Array(80 * 60), null);
  Object.assign(map, { tileSizeM: 16, paintedZones: true, cellZones: true, town: { x: 40, y: 30 } });
  const core = new CityCore({ map, seed: 5, ...(resources ? { resources } : {}) });
  core.simulation.budget.setFunds(30000);
  for (let x = 2; x < 78; x++) core.apply({ type: "tool", tool: "road", x, y: 28 });
  for (let y = 4; y < 56; y++) core.apply({ type: "tool", tool: "road", x: 40, y });
  return core;
}

describe("the auto player", () => {
  test.each([["a practice town", undefined], ["a province's town (it holds festivals)", { tourism: 3 }]])(
    "builds %s that grows, and each year's accounts are what the treasury gained or lost", (_name, resources) => {
    Random.seed(5);
    const core = town(resources);
    const player = new AutoPlayer(core, { town: { x: 40, y: 30 }, paintFirst: 3000, paintEachYear: 1000 });
    player.start();
    expect(core.map.rulerHouse).toBeTruthy();
    expect(player.log.some((line) => line.includes("coal at"))).toBe(true);
    let funds = core.simulation.budget.totalFunds, checked = 0, festivals = 0;
    for (let n = 0; n < 4; n++) {
      const year = player.playYear();
      // Gained by the year's end, less what was built and painted through the year (nothing is charged while no one lives
      // in the city, as at its start); the festivals, paid in their months, are among the costs
      expect(year.funds).toBe(funds + (year.accounts.charged ? year.accounts.net : 0) - year.built);
      if (year.accounts.charged) checked++;
      festivals += year.accounts.costs.festivals;
      funds = year.funds;
    }
    expect(checked).toBeGreaterThan(0);
    expect(festivals > 0).toBe(resources !== undefined);
    expect(core.simulation.evaluation.cityPop).toBeGreaterThan(0);
  });

  test("answers the festival card as a sensible ruler: grandly with money to spare and living short, not when money is tight", () => {
    const reserve = 3000;
    // Living short of the era's aim, and the treasury still over its reserve after a grand one
    expect(festivalAnswer([400, 2400], 5400, true, reserve)).toBe("grand");
    expect(festivalAnswer([400, 2400], 5399, true, reserve)).toBe("modest");
    // ... living at its aim needs no grand one
    expect(festivalAnswer([400, 2400], 50000, false, reserve)).toBe("modest");
    // Money tight: paying would leave the treasury nearly empty
    expect(festivalAnswer([400, 2400], 600, true, reserve)).toBe("none");
    expect(festivalAnswer([400, 2400], 400, false, reserve)).toBe("none");
    expect(festivalAnswer([400, 2400], 650, false, reserve)).toBe("modest");
    // ... but a treasury that cannot pay at all answers modestly: the people then hold it themselves, letting nobody down
    expect(festivalAnswer([400, 2400], 399, true, reserve)).toBe("modest");
    expect(festivalAnswer([400, 2400], 0, false, reserve)).toBe("modest");
    // ... and while it saves for a school or a hospital, a festival may not eat into that
    expect(festivalAnswer([400, 2400], 1500, false, reserve, 1800)).toBe("none");
    expect(festivalAnswer([400, 2400], 2300, false, reserve, 1800)).toBe("modest");
    // ... unless the people's living is short of the era's aim, which a festival not held would only make worse
    expect(festivalAnswer([400, 2400], 1500, true, reserve, 1800)).toBe("modest");
  });

  test("waits for what the city cannot build yet, and builds it once it can (docs/GAME_DESIGN.md 6)", () => {
    Random.seed(5);
    const core = town();
    const player = new AutoPlayer(core, { town: { x: 40, y: 30 }, paintFirst: 300, paintEachYear: 300 });
    player.start();
    // A village's water is its towers' wells; the water works wait for the market town and the plant's months
    expect(player.log.some((line) => line.includes("watertower at"))).toBe(true);
    expect(player.log.some((line) => line.includes("waterworks waits: unlock.era"))).toBe(true);
    expect(player.log.some((line) => line.includes("waterworks at"))).toBe(false);
    core.map.era = 2;
    core.run(16 * 4 * 7);
    player.playYear();
    expect(player.log.some((line) => line.includes("waterworks at"))).toBe(true);
  });

  test("opens a primary school at once, and paints the factories it planned once the power plant is finished (6.5)", () => {
    Random.seed(5);
    const core = town();
    const player = new AutoPlayer(core, { town: { x: 40, y: 30 }, paintFirst: 3000, paintEachYear: 0 });
    player.start();
    // The market town needs villagers who read and write, which only the years of a school bring
    expect(player.log.some((line) => line.includes("primary_school at"))).toBe(true);
    // The factories wait for a finished power plant (src/unlocks.ts) ...
    const factories = () => [...(core.map.zoneCells?.values() ?? [])].filter((code) => code === zoneCode("industrial")).length;
    expect(factories()).toBe(0);
    // ... and are painted the month it is
    player.playYear();
    expect(player.log.some((line) => /painted \d+ industrial cells once unlocked/.test(line))).toBe(true);
    expect(factories()).toBeGreaterThan(0);
  });

  test("raises the district office for the school its trained people need before the services (6.5)", () => {
    Random.seed(5);
    const map = (MapGenerator as any).fromPresetCells(80, 60, new Uint8Array(80 * 60), null);
    Object.assign(map, { tileSizeM: 16, paintedZones: true, cellZones: true, town: { x: 40, y: 30 } });
    const core = new CityCore({ map, seed: 5, hooks: { rank: () => 2 } });
    core.simulation.budget.setFunds(30000);
    for (let x = 2; x < 78; x++) core.apply({ type: "tool", tool: "road", x, y: 28 });
    for (let y = 4; y < 56; y++) core.apply({ type: "tool", tool: "road", x: 40, y });
    const player = new AutoPlayer(core, { town: { x: 40, y: 30 }, paintFirst: 300, paintEachYear: 300 });
    player.start();
    // The primary school done, a market town whose roads wait for technicians, who come from the secondary school,
    // which needs the district office of level 2
    core.run(16 * 4 * 4);
    core.map.era = 2;
    expect(core.map.rulerHouse?.level).toBe(1);
    (player as unknown as { wantTrained: Set<string> }).wantTrained.add("technician");
    player.playYear();
    const year = player.log.filter((line) => line.startsWith("year 1:"));
    const planned = year.findIndex((line) => line.startsWith("year 1: training: district office for secondary_school"));
    expect(planned).toBeGreaterThanOrEqual(0);
    expect(year.slice(planned + 1).some((line) => line.includes("ruler_house_upgrade at"))).toBe(true);
    expect(core.map.rulerHouse?.level).toBeGreaterThanOrEqual(2);
  });

  test("answers through the festival command, and a festival not held costs the year nothing", () => {
    Random.seed(5);
    const core = town({ tourism: 3 });
    const player = new AutoPlayer(core, { town: { x: 40, y: 30 }, paintFirst: 3000, paintEachYear: 1000 });
    player.start();
    // A treasury that could pay for Songkran but be left nearly empty (a new town's price: a tenth, src/festivals.ts)
    core.simulation.budget.setFunds(265);
    const year = player.playYear();
    const answers = core.log.filter((logged) => logged.command.type === "festival").map((logged) => logged.command);
    expect(answers).toEqual([{ type: "festival", id: "songkran", scale: "none" }, { type: "festival", id: "loy_krathong", scale: "none" }]);
    expect(player.log.filter((line) => line.includes("festival songkran none"))).toHaveLength(1);
    expect(core.map.festivals?.choices).toEqual({ songkran: "none", loy_krathong: "none" });
    expect(year.accounts.costs.festivals).toBe(0);
  });

  test("reads every line of the budget's year", () => {
    const accounts = yearAccounts({ taxIncome: 500, tourismIncome: 100, roadSpend: 20, fuelCost: 150, educationCost: 60,
      festivalCost: 350 });
    expect(accounts.income.taxes).toBe(500);
    expect(accounts.costs.fuel).toBe(150);
    // ... the festivals too, paid in their months (src/festivals.ts)
    expect(accounts.costs.festivals).toBe(350);
    expect(accounts.net).toBe(500 + 100 - 20 - 150 - 60 - 350);
  });
});
