/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The auto player (src/core/autoPlayer.ts): it builds a town through commands and plays it for years, and its yearly
// accounts hold every baht the treasury gained or lost, so a change to the game's balance can be read line by line.

import { AutoPlayer, yearAccounts } from "../src/core/autoPlayer";
import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";

/** A bare 16 m map painted a cell at a time, with a road through the town and a crossing road */
function town() {
  const map = (MapGenerator as any).fromPresetCells(80, 60, new Uint8Array(80 * 60), null);
  Object.assign(map, { tileSizeM: 16, paintedZones: true, cellZones: true, town: { x: 40, y: 30 } });
  const core = new CityCore({ map, seed: 5 });
  core.simulation.budget.setFunds(30000);
  for (let x = 2; x < 78; x++) core.apply({ type: "tool", tool: "road", x, y: 28 });
  for (let y = 4; y < 56; y++) core.apply({ type: "tool", tool: "road", x: 40, y });
  return core;
}

describe("the auto player", () => {
  test("builds a town that grows, and each year's accounts are what the treasury gained or lost", () => {
    Random.seed(5);
    const core = town();
    const player = new AutoPlayer(core, { town: { x: 40, y: 30 }, paintFirst: 3000, paintEachYear: 1000 });
    player.start();
    expect(core.map.rulerHouse).toBeTruthy();
    expect(player.log.some((line) => line.includes("coal at"))).toBe(true);
    let funds = core.simulation.budget.totalFunds, checked = 0;
    for (let n = 0; n < 3; n++) {
      const year = player.playYear();
      // Gained by the year's end, less what was built and painted through the year (the first year's end finds no one)
      if (year.population > 0) { expect(year.funds).toBe(funds + year.accounts.net - year.built); checked++; }
      funds = year.funds;
    }
    expect(checked).toBeGreaterThan(1);
    expect(core.simulation.evaluation.cityPop).toBeGreaterThan(0);
  });

  test("reads every line of the budget's year", () => {
    const accounts = yearAccounts({ taxIncome: 500, tourismIncome: 100, roadSpend: 20, fuelCost: 150, educationCost: 60 });
    expect(accounts.income.taxes).toBe(500);
    expect(accounts.costs.fuel).toBe(150);
    expect(accounts.net).toBe(500 + 100 - 20 - 150 - 60);
  });
});
