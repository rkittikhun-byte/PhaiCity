/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A simple player that plays a city for years with no screen (docs/GAME_PLAN.md phase 0; owner, 15 Oct 2026: "แก้เรื่อง
// เงินก่อน หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี"), to see a city's money and growth over the years and check a change to
// the game's balance. It plays through commands as a person does (src/cityCommands.ts): the district office, a power
// plant and water works beside the roads near the town, zones painted along the roads nearest the town (homes, shops
// and factories mixed), then each year the services its people ask for and more zones while money allows. No DOM.

import { canBuildIn } from "./cityLayers.js";
import { type CityCore, STEPS_PER_YEAR } from "./cityCore.js";
import { ownsLand } from "../landBlocks.js";
import { plotOf } from "../plots.js";
import { cellsOf } from "../zoneCells.js";

/** The year's money, line by line, as the budget counted it when it collected the taxes (src/budget.js collectTax) */
export interface YearAccounts {
  income: Record<string, number>;
  costs: Record<string, number>;
  /** Income less costs: what the year's end added to the treasury */
  net: number;
}

type Budget = Record<string, number>;

/** The last year's accounts from the budget's lines */
export function yearAccounts(budget: Budget): YearAccounts {
  const income: Record<string, number> = {
    taxes: budget.taxIncome ?? 0, water: budget.waterIncome ?? 0, tourism: budget.tourismIncome ?? 0,
    mining: budget.miningIncome ?? 0, farms: budget.farmIncome ?? 0, recycling: budget.recyclingIncome ?? 0,
    tolls: budget.tollIncome ?? 0, pollutionTax: budget.pollutionTaxIncome ?? 0,
  };
  const costs: Record<string, number> = {
    roads: budget.roadSpend ?? 0, police: budget.policeSpend ?? 0, fire: budget.fireSpend ?? 0,
    fuel: budget.fuelCost ?? 0, house: budget.houseCost ?? 0, education: budget.educationCost ?? 0,
    health: budget.healthCost ?? 0, waste: budget.wasteCost ?? 0, policies: budget.policyCost ?? 0,
    transit: budget.transitCost ?? 0,
  };
  const sum = (lines: Record<string, number>) => Object.values(lines).reduce((a, b) => a + b, 0);
  return { income, costs, net: sum(income) - sum(costs) };
}

/** What a year of play left */
export interface PlayerYear {
  year: number;
  population: number;
  funds: number;
  /** Spent on building and painting through the year */
  built: number;
  accounts: YearAccounts;
  cityClass: string;
  /** Share of people happy with the ruler, % */
  approval: number;
  /** The census's average land value (0–250) and pollution, which the taxes and the people's mood follow */
  landValue: number;
  pollution: number;
  /** Share of the power plants' power the city used at the last power scan, % */
  powerUse: number;
  /** Demand for homes, shops and factories (the simulation's valves, −2000 … 2000) */
  demand: [number, number, number];
  /** Plots by kind, how many at each level 0–5 */
  plots: Record<"residential" | "commercial" | "industrial", number[]>;
}

export interface PlayerOptions {
  /** Where the town's middle is, in tiles */
  town: { x: number; y: number };
  /** Zone cells painted at the start, and each year after while the treasury keeps `reserve` */
  paintFirst?: number;
  paintEachYear?: number;
  reserve?: number;
}

/** The services a town builds as its people grow: [people, tool] */
const SERVICES: ReadonlyArray<[number, string]> = [[300, "police_box"], [300, "fire_post"], [500, "primary_school"],
  [500, "health_centre"], [800, "kindergarten"], [1500, "landfill"], [2000, "waterworks"],
  [3000, "ruler_house_upgrade"], [3000, "secondary_school"], [4000, "community_hospital"], [5000, "police_large"],
  [5000, "fire_centre"], [8000, "waterworks"]];

/** Another power plant goes up when the city uses this share of its plants' power */
const MORE_POWER_AT = 0.85;

export class AutoPlayer {
  /** What it did, a line each, with the year */
  readonly log: string[] = [];
  private year = 0;
  private built = 0;
  private next = 0;

  constructor(private readonly core: CityCore, private readonly options: PlayerOptions) {}

  /** The first buildings and zones of a new city */
  start(): void {
    const { x, y } = this.options.town;
    this.place("ruler_house", x, y);
    this.place("coal", x + 14, y);
    this.place("waterworks", x - 10, y + 8);
    this.paint(this.options.paintFirst ?? 6000);
  }

  /** A year of the city, then what the year's people ask for */
  playYear(): PlayerYear {
    const core = this.core, sim = core.simulation, budget = sim.budget;
    const builtBefore = this.built;
    for (let step = 0; step < STEPS_PER_YEAR; step++) {
      core.step();
      // Short of money at the year's end, the budget asks the player (the budget window): this one keeps the rates
      if (budget.awaitingValues) {
        core.apply({ type: "budget", tax: budget.cityTax, road: Math.round(budget.roadPercent * 100),
          fire: Math.round(budget.firePercent * 100), police: Math.round(budget.policePercent * 100), yearEnd: true });
        this.note(`budget window: ฿${budget.totalFunds}`);
      }
    }
    this.year++;
    const population = sim.evaluation.cityPop;
    const { x, y } = this.options.town;
    while (this.next < SERVICES.length && population >= SERVICES[this.next][0] && budget.totalFunds > (this.options.reserve ?? 3000)) {
      const [, tool] = SERVICES[this.next];
      if (tool === "ruler_house_upgrade") {
        const house = core.map.rulerHouse;
        if (house) this.apply(tool, house.x, house.y);
      } else {
        this.place(tool, x + ((this.next * 7) % 21) - 10, y + ((this.next * 11) % 21) - 10);
      }
      this.next++;
    }
    // A power plant more when the city uses nearly all its power (src/powerManager.js load)
    const load = sim._powerManager?.load ?? 0;
    if (load >= MORE_POWER_AT && budget.totalFunds > (this.options.reserve ?? 3000)) this.place("coal", x + 14, y + 8);
    if (budget.totalFunds > (this.options.reserve ?? 3000) + 1000) this.paint(this.options.paintEachYear ?? 3000);
    const map = core.map, plots = { residential: [0, 0, 0, 0, 0, 0], commercial: [0, 0, 0, 0, 0, 0], industrial: [0, 0, 0, 0, 0, 0] };
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const plot = plotOf(map, tx, ty);
        if (plot) plots[plot.kind as keyof typeof plots][plot.level]++;
      }
    }
    const valves = sim._valves ?? {};
    return {
      year: this.year, population, funds: budget.totalFunds, built: this.built - builtBefore, accounts: yearAccounts(budget),
      cityClass: sim.evaluation.cityClass, approval: sim.evaluation.cityYes,
      landValue: sim._census.landValueAverage, pollution: sim._census.pollutionAverage,
      powerUse: Math.round((sim._powerManager?.load ?? 0) * 100),
      demand: [valves.resValve ?? 0, valves.comValve ?? 0, valves.indValve ?? 0], plots,
    };
  }

  /** A tool at (x, y); true when it built, counting what it cost */
  private apply(tool: string, x: number, y: number): boolean {
    const budget = this.core.simulation.budget, before = budget.totalFunds;
    const outcome = this.core.apply({ type: "tool", tool: tool as never, x, y });
    const cost = before - budget.totalFunds;
    if (!outcome.accepted || outcome.toolResult !== 0 || cost <= 0) return false;
    this.built += cost;
    this.note(`${tool} at ${x},${y} ฿${cost}`);
    return true;
  }

  /** A building at the nearest spot round (cx, cy) the game takes, as a player tries spots near a road */
  private place(tool: string, cx: number, cy: number, reach = 40): boolean {
    const map = this.core.map;
    for (let r = 0; r <= reach; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
          if (this.apply(tool, x, y)) return true;
        }
      }
    }
    this.note(`${tool}: no place`);
    return false;
  }

  /** Up to n more zone cells, the nearest the town first: factories on the town's east side, by the power plant, and
   *  homes and shops elsewhere, mixed by tile (3 : 1) */
  private paint(n: number): void {
    const core = this.core, map = core.map, budget = core.simulation.budget;
    if (!map.cellZones) return;
    const owns = canBuildIn(map);
    const layout = cellsOf(map, (x, y) => ownsLand(map, x, y) && owns(x, y));
    const tx = this.options.town.x * 10, tz = this.options.town.y * 10;
    const free = layout.cells.filter((c) => !map.zoneCells?.get?.(c.key))
      .sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz)).slice(0, n);
    const zoneOf = (c: { x: number; z: number }) => {
      if (Math.abs(Math.atan2(c.z - tz, c.x - tx)) < Math.PI / 4) return "industrial";
      return (Math.floor(c.x / 10) * 7 + Math.floor(c.z / 10) * 13) % 4 === 0 ? "commercial" : "residential";
    };
    let painted = 0;
    for (const zone of ["residential", "commercial", "industrial"] as const) {
      const keys = free.filter((c) => zoneOf(c) === zone).map((c) => c.key);
      for (let i = 0; i < keys.length; i += 4000) {
        const before = budget.totalFunds;
        if (core.apply({ type: "zoneCells", zone, cells: keys.slice(i, i + 4000) }).accepted) {
          painted += Math.min(4000, keys.length - i);
          this.built += before - budget.totalFunds;
        }
      }
    }
    this.note(`painted ${painted} cells`);
  }

  private note(text: string): void { this.log.push(`year ${this.year}: ${text}`); }
}
