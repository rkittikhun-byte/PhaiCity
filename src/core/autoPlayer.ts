/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A simple player that plays a city for years with no screen (docs/GAME_PLAN.md phase 0; owner, 15 Oct 2026: "แก้เรื่อง
// เงินก่อน หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี"), to see a city's money and growth over the years and check a change to
// the game's balance. It plays through commands as a person does (src/cityCommands.ts): the district office, a power
// plant and water works beside the roads near the town, zones painted along the roads nearest the town (homes, shops
// and factories mixed), then each year the services its people ask for and more zones while money allows. No DOM.

import { BlockMapUtils } from "../blockMapUtils.js";
import { canBuildIn } from "./cityLayers.js";
import { type CityCore, STEPS_PER_YEAR } from "./cityCore.js";
import { blockColumns, blockRows, blockSizeOf, ownsLand } from "../landBlocks.js";
import { LANDFILL_HOLDS, LANDFILL_WARN, rubbishOf, WASTE_SPECS } from "../waste.js";
import { DENSITY_TO_RISE, nearestRoad, plotOf } from "../plots.js";
import { besideRoad } from "../cityCommands.js";
import { isRoadTile } from "../roadLevels.js";
import { cellsOf } from "../zoneCells.js";

/** The year's money, line by line, as the budget counted it when it collected the taxes (src/budget.js collectTax) */
export interface YearAccounts {
  income: Record<string, number>;
  costs: Record<string, number>;
  /** Income less costs: what the year's end added to the treasury, when it charged them (charged) */
  net: number;
  /** Whether the year's end charged them: not while no one lived in the city */
  charged: boolean;
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
  return { income, costs, net: sum(income) - sum(costs), charged: (budget as Record<string, unknown>).charged !== false };
}

/** Why the plots of one kind at one level are where they are: how many, and the share held back by each cause */
export interface PlotLevelReport {
  kind: string;
  level: number;
  count: number;
  /** Averages over them: land value, pollution, and (homes) their growth score, which grows them when well above 0
   *  and shrinks them below 350 (src/plots.ts grows, shrinks) */
  landValue: number;
  pollution: number;
  score: number | null;
  /** The parts of their land value (src/blockMapUtils.js): nearness to the city's centre, open land round them, and
   *  the ruler's house and the rest; pollution and crime take away */
  nearness: number;
  openLand: number;
  crime: number;
  /** Shares, 0–1: no power; thirsty (no water, needed to grow past a house); pollution over 128 (homes cannot rise);
   *  too few people round them to rise (homes); the land worth too little for a bigger shop */
  unpowered: number;
  thirsty: number;
  /** ... of which no pipe reaches (the rest went without because the supply ran out) */
  unpiped: number;
  polluted: number;
  tooQuiet: number;
  landCaps: number;
}

/** The city's plots by kind and level, and what holds each group back (src/plots.ts plotFound) */
export function plotReport(core: CityCore): PlotLevelReport[] {
  const map = core.map, sim = core.simulation, bm = sim.blockMaps, water = sim._waterManager?.view;
  const groups = new Map<string, { kind: string; level: number; n: number; lv: number; pol: number; score: number;
    near: number; open: number; crime: number;
    unpowered: number; thirsty: number; unpiped: number; polluted: number; quiet: number; capped: number }>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const plot = plotOf(map, x, y);
      if (!plot) continue;
      const key = plot.kind + plot.level;
      const g = groups.get(key) ?? { kind: plot.kind, level: plot.level, n: 0, lv: 0, pol: 0, score: 0, near: 0, open: 0, crime: 0, unpowered: 0,
        thirsty: 0, unpiped: 0, polluted: 0, quiet: 0, capped: 0 };
      const lv = bm.landValueMap.worldGet(x, y), pol = bm.pollutionDensityMap.worldGet(x, y);
      g.n++; g.lv += lv; g.pol += pol;
      const bx = x & ~1, by = y & ~1;
      const step = BlockMapUtils.nearnessStep(map);
      const far = Math.min(Math.floor((Math.abs(bx - map.cityCentreX) + Math.abs(by - map.cityCentreY)) / step), 64);
      g.near += (34 - Math.floor(far / 2)) * 4;
      g.open += bm.terrainDensityMap.worldGet(x, y);
      if (bm.crimeRateMap.worldGet(x, y) > 190) g.crime += 20;
      if (!map.getTile(x, y).isPowered()) g.unpowered++;
      if (water && water.zoneWater(x, y) === 3) {
        g.thirsty++;
        const road = nearestRoad(map, x, y);
        if (!road || !water.hasWater(road.x, road.y)) g.unpiped++;
      }
      if (plot.kind === "residential") {
        const land = Math.min(Math.max(lv - pol, 0) * 32, 6000) - 3000;
        g.score += (sim._valves?.resValve ?? 0) + land;
        if (pol > 128) g.polluted++;
        if (plot.level > 0 && bm.populationDensityMap.worldGet(x, y) <= DENSITY_TO_RISE[plot.level]) g.quiet++;
      }
      if (plot.kind === "commercial" && plot.level > lv >> 5) g.capped++;
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.level - b.level).map((g) => ({
    kind: g.kind, level: g.level, count: g.n, landValue: Math.round(g.lv / g.n), pollution: Math.round(g.pol / g.n),
    nearness: Math.round(g.near / g.n), openLand: Math.round(g.open / g.n), crime: Math.round(g.crime / g.n),
    score: g.kind === "residential" ? Math.round(g.score / g.n) : null, unpowered: g.unpowered / g.n,
    thirsty: g.thirsty / g.n, unpiped: g.unpiped / g.n, polluted: g.polluted / g.n, tooQuiet: g.quiet / g.n, landCaps: g.capped / g.n,
  }));
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
  /** The water works' supply in zone shares (a plot takes an eighth) and what the buildings asked for, at the last scan */
  water: { supply: number; used: number; works: number };
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
  [500, "health_centre"], [800, "kindergarten"], [1500, "landfill"],
  [3000, "secondary_school"], [4000, "community_hospital"], [5000, "police_large"],
  [5000, "fire_centre"], [8000, "primary_school"], [8000, "health_centre"], [12000, "vocational_college"],
  [15000, "secondary_school"], [20000, "provincial_hospital"], [25000, "police_large"], [25000, "fire_centre"],
  [30000, "university"], [40000, "primary_school"], [40000, "community_hospital"], [60000, "police_hq"],
  [80000, "regional_hospital"], [100000, "university"]];

/** What the era score (src/eraScore.ts) finds short, and what is built for it while it is below its aim, the first that
 * the district office is high enough for and that finds room: one a side a year */
const ERA_ASKS: ReadonlyArray<["health" | "education", string[]]> = [
  ["health", ["provincial_hospital", "community_hospital", "health_centre"]],
  ["education", ["secondary_school", "primary_school", "kindergarten"]]];

/** The buildings a kind of zone waits for, as the valves' caps say, and where round the town they go */
const CAPS: ReadonlyArray<[string, string, number, number]> = [["resCap", "stadium", -20, -12],
  ["indCap", "port", 30, 12], ["comCap", "airport", 30, -20]];
/** Rubbish lying in the streets (src/waste.ts overflow, 0–1) at which another landfill goes up */
const OVERFLOW_AT = 0.1;
/** Zones and land are bought while the treasury has this much: cells are cheap, and a town that stops growing stays small */
const EXPAND_FROM = 1500;
/** Taxes while every kind of zone is wanted this much (the valves, up to 1500–2000), and otherwise */
const WANTED_FOR_TAX = 1000;
const GROWING_TAX = 9;
const DEFAULT_TAX = 7;
/** A bus for this many people */
const BUS_PEOPLE = 1500;
/** One home tile in this many is a park */
const PARK_EVERY = 8;
/** Another power plant goes up when the city uses this share of its plants' power */
const MORE_POWER_AT = 0.85;
/** ... and another water works when this share of its buildings went without water, or this share of its supply is taken */
const MORE_WATER_AT = 0.15;
const MORE_WATER_USED = 0.9;
/** Factories stand this far from the town's middle at least (world units, 10 a tile), the power plants further */
const FACTORIES_FROM = 100;
const PLANT_FROM = 24;

export class AutoPlayer {
  /** What it did, a line each, with the year */
  readonly log: string[] = [];
  private year = 0;
  private built = 0;
  private next = 0;
  /** How many buildings the era score asked for */
  private asked = 0;

  constructor(private readonly core: CityCore, private readonly options: PlayerOptions) {}

  /** The first buildings and zones of a new city */
  start(): void {
    const { x, y } = this.options.town;
    this.place("ruler_house", x, y);
    this.place("coal", x + PLANT_FROM, y);
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
    // First what the news asks for when a kind of zone can grow no more without it (src/simulation.js _sendMessages): a
    // stadium for the homes, a port for the factories, an airport for the shops; while one waits, money is saved for
    // it and nothing else but power, water and rubbish is bought
    const valves = sim._valves ?? {};
    let saving = false;
    for (const [cap, tool, dx, dy] of CAPS) {
      if (!valves[cap]) continue;
      const price = core.tools?.[tool]?.toolCost ?? 0;
      if (budget.totalFunds >= price + 500 && this.place(tool, x + dx, y + dy)) continue;
      saving = true;
    }
    // Then what keeps the town running: a power plant more when it uses nearly all its power (src/powerManager.js load)
    const load = sim._powerManager?.load ?? 0;
    if (load >= MORE_POWER_AT && budget.totalFunds > 3500) this.place("coal", x + PLANT_FROM, y + 8);
    // ... a water works more when many buildings went without or the supply is nearly all taken (src/waterManager.ts)
    const census = sim._census, dry = census.dryZoneCount ?? 0, wet = census.wateredZoneCount ?? 0;
    const water = sim._waterManager, short = water && water.supply > 0 && water.used >= water.supply * MORE_WATER_USED;
    if ((short || dry + wet > 0 && dry / (dry + wet) >= MORE_WATER_AT) && budget.totalFunds > 2000) {
      this.place("waterworks", x - 10 - this.year, y + 8);
    }
    // ... a landfill more when one is nearly full or rubbish lies in the streets (src/waste.ts)
    const waste = sim._waste;
    const nearlyFull = Object.values(waste?.fill ?? {}).some((t) => (t as number) >= LANDFILL_HOLDS * LANDFILL_WARN);
    // Landfills enough for the town's rubbish: one more while those not yet nearly full take less than it makes, or
    // rubbish lies in the streets (the cheapest to keep: ฿20 a year against an incinerator's ฿150, src/waste.ts)
    const room = Object.values(waste?.fill ?? {}).filter((t) => (t as number) < LANDFILL_HOLDS * LANDFILL_WARN).length;
    const made = rubbishOf(population / 1, 0);
    if ((nearlyFull || room * WASTE_SPECS.landfill.takes < made || (waste?.overflow ?? 0) > OVERFLOW_AT) && budget.totalFunds > 800) {
      this.place("landfill", x + PLANT_FROM, y - 8 - this.year);
    }
    if (!saving) {
      // The district office a level higher whenever the rank allows and money is there (src/rulerHouse.ts)
      const house = core.map.rulerHouse;
      if (house && budget.totalFunds > (this.options.reserve ?? 3000)) this.apply("ruler_house_upgrade", house.x, house.y);
      // The services its people ask for, in turn; one the office is not yet high enough for waits (serviceProblem)
      while (this.next < SERVICES.length && population >= SERVICES[this.next][0] && budget.totalFunds > (this.options.reserve ?? 3000)) {
        const [, tool] = SERVICES[this.next];
        if (!this.place(tool, x + ((this.next * 7) % 41) - 20, y + ((this.next * 11) % 41) - 20)) break;
        this.next++;
      }
      // ... and more care or seats while the era score finds them short of the era's aim, as a ruler reading the era
      // card would build (owner, 20 Oct 2026: the 10-year play sat at 90% in era 2 for want of health)
      const factors = (core.map as { eraScore?: { factors?: Record<string, { value: number; target: number }> } }).eraScore?.factors;
      for (const [side, tools] of ERA_ASKS) {
        const f = factors?.[side];
        if (!f || f.value >= f.target || budget.totalFunds <= (this.options.reserve ?? 3000)) continue;
        const n = this.asked++;
        tools.some((tool) => this.place(tool, x + ((n * 13) % 41) - 20, y + ((n * 17) % 41) - 20));
      }
      // A bus more on a road near the middle for every BUS_PEOPLE people: riders leave their cars, so the roads carry
      // less traffic and its smoke (src/transit.ts, src/busStopTool.ts)
      while ((core.map.buses?.length ?? 0) < Math.floor(population / BUS_PEOPLE) && budget.totalFunds > (this.options.reserve ?? 3000)) {
        const n = core.map.buses?.length ?? 0;
        if (!this.place("bus_stop", x + ((n * 5) % 13) - 6, y + ((n * 3) % 13) - 6, 12)) break;
      }
    }
    // More zones while money allows, and a block of land more when the town's own is nearly all painted
    // ... and taxes a little higher while every kind of zone is wanted, as a ruler of a growing town would set them
    const wanted = Math.min(valves.resValve ?? 0, valves.comValve ?? 0, valves.indValve ?? 0);
    const tax = wanted >= WANTED_FOR_TAX ? GROWING_TAX : DEFAULT_TAX;
    if (budget.cityTax !== tax) {
      core.apply({ type: "budget", tax, comTax: tax, indTax: tax, road: Math.round(budget.roadPercent * 100),
        fire: Math.round(budget.firePercent * 100), police: Math.round(budget.policePercent * 100), yearEnd: false });
    }
    if (!saving && budget.totalFunds > EXPAND_FROM) {
      const wanted = this.options.paintEachYear ?? 3000;
      const painted = this.paint(wanted);
      if (painted < wanted / 2 && this.buyLand() !== null) this.paint(wanted - painted);
    }
    const map = core.map, plots = { residential: [0, 0, 0, 0, 0, 0], commercial: [0, 0, 0, 0, 0, 0], industrial: [0, 0, 0, 0, 0, 0] };
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const plot = plotOf(map, tx, ty);
        if (plot) plots[plot.kind as keyof typeof plots][plot.level]++;
      }
    }
    return {
      year: this.year, population, funds: budget.totalFunds, built: this.built - builtBefore, accounts: yearAccounts(budget),
      cityClass: sim.evaluation.cityClass, approval: sim.evaluation.cityYes,
      landValue: sim._census.landValueAverage, pollution: sim._census.pollutionAverage,
      powerUse: Math.round((sim._powerManager?.load ?? 0) * 100),
      water: { supply: sim._waterManager?.supply ?? 0, used: Math.round(sim._waterManager?.used ?? 0),
        works: sim._census.waterWorksPop ?? 0 },
      demand: [valves.resValve ?? 0, valves.comValve ?? 0, valves.indValve ?? 0], plots,
    };
  }

  /** Buying land for a building that found no room, so a failure there does not buy again */
  private buying = false;
  /** Why the last tries of a tool failed, and how often */
  private failures = new Map<string, number>();

  /** A tool at (x, y); true when it built, counting what it cost */
  private apply(tool: string, x: number, y: number, quiet = false): boolean {
    const budget = this.core.simulation.budget, before = budget.totalFunds;
    const outcome = this.core.apply({ type: "tool", tool: tool as never, x, y });
    const cost = before - budget.totalFunds;
    if (!outcome.accepted || outcome.toolResult !== 0 || cost <= 0) {
      const why = !outcome.accepted ? String(outcome.reason) : `tool result ${String(outcome.toolResult)}`;
      this.failures.set(why, (this.failures.get(why) ?? 0) + 1);
      return false;
    }
    this.built += cost;
    if (!quiet) this.note(`${tool} at ${x},${y} ฿${cost}`);
    return true;
  }

  /** A building at the nearest spot round (cx, cy) the game takes, as a player tries spots near a road */
  private place(tool: string, cx: number, cy: number, reach = 40): boolean {
    const map = this.core.map;
    this.failures.clear();
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
    // No room left on the city's land: a block more, and the building there
    if (!this.buying) {
      this.buying = true;
      const land = this.buyLand();
      const built = land !== null && this.place(tool, land.x, land.y, 16);
      this.buying = false;
      if (built) return true;
    }
    // Still no room: plots cleared for it beside a road, as a player knocks houses down for a stadium or a port
    if (reach > 16 && (tool === "landfill" || CAPS.some(([, waited]) => waited === tool)) && this.clearFor(tool, cx, cy)) return true;
    const reasons = [...this.failures].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([why, n]) => `${why} ×${n}`);
    this.note(`${tool}: no place (${reasons.join(", ")})`);
    return false;
  }

  /**
   * Room for a building of the tool's size made on painted plots beside a road, the nearest (cx, cy): their cells
   * cleared (the eraser takes a plot and its building back, src/zoneCells.ts), then the building put there. Only plots,
   * open land and the city's own land; no road, service or other building is taken.
   */
  private clearFor(tool: string, cx: number, cy: number): boolean {
    const core = this.core, map = core.map, size = core.tools?.[tool]?.size ?? 3;
    if (!map.cellZones) return false;
    const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isRoadTile(map.getTileValue(x, y));
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && ownsLand(map, x, y) &&
      (map.getTileValue(x, y) === 0 || plotOf(map, x, y) !== null);
    for (let r = 0; r <= 30; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy, left = x - 1, top = y - 1;
          let ok = besideRoad(map.width, map.height, isRoad, x, y, size);
          for (let ty = top; ok && ty < top + size; ty++) for (let tx = left; ok && tx < left + size; tx++) ok = free(tx, ty);
          if (!ok) continue;
          const keys = cellsOf(map).cells.filter((c) => {
            const tx = Math.floor(c.x / 10), ty = Math.floor(c.z / 10);
            return tx >= left && tx < left + size && ty >= top && ty < top + size && map.zoneCells?.get?.(c.key);
          }).map((c) => c.key);
          for (let i = 0; i < keys.length; i += 4000) core.apply({ type: "zoneCells", zone: null, cells: keys.slice(i, i + 4000) });
          if (this.apply(tool, x, y)) { this.note(`cleared ${keys.length} cells for ${tool}`); return true; }
        }
      }
    }
    return false;
  }

  /** The block of land beside the city's own nearest the town, bought (src/landBlocks.ts): its middle tile, or null when
   *  none can be */
  private buyLand(): { x: number; y: number } | null {
    const map = this.core.map, budget = this.core.simulation.budget;
    if (!map.landBlocks) return null;
    const size = blockSizeOf(map), columns = blockColumns(map), rows = blockRows(map);
    const { x, y } = this.options.town;
    const blocks: Array<{ bx: number; by: number; d: number }> = [];
    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < columns; bx++) {
        if (!map.landBlocks[by * columns + bx]) blocks.push({ bx, by, d: Math.hypot((bx + 0.5) * size - x, (by + 0.5) * size - y) });
      }
    }
    blocks.sort((a, b) => a.d - b.d);
    for (const { bx, by } of blocks.slice(0, 24)) {
      const tx = Math.min(map.width - 1, Math.floor((bx + 0.5) * size)), ty = Math.min(map.height - 1, Math.floor((by + 0.5) * size));
      const before = budget.totalFunds;
      if (this.core.apply({ type: "land", x: tx, y: ty }).accepted) {
        this.built += before - budget.totalFunds;
        this.note(`land at ${tx},${ty} ฿${before - budget.totalFunds}`);
        return { x: tx, y: ty };
      }
    }
    this.note("land: none to buy");
    return null;
  }

  /** Up to n more zone cells, the nearest the town first: factories on the town's east side past a band of shops, by
   *  the power plant, and homes and shops elsewhere, mixed by tile (3 : 1) */
  private paint(n: number): number {
    const core = this.core, map = core.map, budget = core.simulation.budget;
    if (!map.cellZones) return 0;
    const owns = canBuildIn(map);
    const layout = cellsOf(map, (x, y) => ownsLand(map, x, y) && owns(x, y));
    const tx = this.options.town.x * 10, tz = this.options.town.y * 10;
    const free = layout.cells.filter((c) => !map.zoneCells?.get?.(c.key))
      .sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz)).slice(0, n);
    const zoneOf = (c: { x: number; z: number }) => {
      if (Math.abs(Math.atan2(c.z - tz, c.x - tx)) < Math.PI / 4) {
        return Math.hypot(c.x - tx, c.z - tz) > FACTORIES_FROM ? "industrial" : "commercial";
      }
      return (Math.floor(c.x / 10) * 7 + Math.floor(c.z / 10) * 13) % 4 === 0 ? "commercial" : "residential";
    };
    // One home tile in PARK_EVERY is left for a park, which raises the land's value round it (src/blockMapUtils.js)
    const tileOf = (c: { x: number; z: number }) => ({ x: Math.floor(c.x / 10), y: Math.floor(c.z / 10) });
    const isPark = (c: { x: number; z: number }) => {
      const { x, y } = tileOf(c);
      return zoneOf(c) === "residential" && (x * 3 + y * 7 + 1) % PARK_EVERY === 0;
    };
    let painted = 0;
    for (const zone of ["residential", "commercial", "industrial"] as const) {
      const keys = free.filter((c) => zoneOf(c) === zone && !isPark(c)).map((c) => c.key);
      for (let i = 0; i < keys.length; i += 4000) {
        const before = budget.totalFunds;
        if (core.apply({ type: "zoneCells", zone, cells: keys.slice(i, i + 4000) }).accepted) {
          painted += Math.min(4000, keys.length - i);
          this.built += before - budget.totalFunds;
        }
      }
    }
    const parks = new Map<number, { x: number; y: number }>();
    for (const c of free) if (isPark(c)) { const t = tileOf(c); parks.set(t.y * map.width + t.x, t); }
    let parked = 0;
    this.failures.clear();
    for (const { x, y } of parks.values()) if (this.apply("park", x, y, true)) parked++;
    this.note(`painted ${painted} cells, ${parked} parks` + (parks.size && !parked ? ` (${[...this.failures].map(([w, n]) => `${w} ×${n}`).join(", ")})` : ""));
    return painted;
  }

  private note(text: string): void { this.log.push(`year ${this.year}: ${text}`); }
}
