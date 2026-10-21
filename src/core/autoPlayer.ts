/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A simple player that plays a city for years with no screen (docs/GAME_PLAN.md phase 0; owner, 15 Oct 2026: "แก้เรื่อง
// เงินก่อน หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี"), to see a city's money and growth over the years and check a change to
// the game's balance. It plays through commands as a person does (src/cityCommands.ts): the district office, a power
// plant and water works beside the roads near the town, zones painted along the roads nearest the town (homes, shops
// and factories mixed), then each year the services its people ask for and more zones while money allows, and it
// answers the festival card a month before each festival as a sensible ruler would (answerFestivals). It asks what the
// city cannot build yet (src/unlocks.ts) before it tries, and waits for it: a building it wanted is tried again each month
// once it is unlocked, a locked service lets the next ones go first, and it paves the town's roads once it has the
// technicians (docs/GAME_DESIGN.md 6). No DOM.

import { BlockMapUtils } from "../blockMapUtils.js";
import { canBuildIn } from "./cityLayers.js";
import { type CityCore, STEPS_PER_YEAR } from "./cityCore.js";
import { blockColumns, blockPrice, blockRows, blockSizeOf, ownsLand } from "../landBlocks.js";
import { LANDFILL_HOLDS, LANDFILL_WARN, rubbishOf, WASTE_SPECS } from "../waste.js";
import { DENSITY_TO_RISE, nearestRoad, plotOf } from "../plots.js";
import { besideRoad, NOTHING_TO_PAINT } from "../cityCommands.js";
import { isRoadTile } from "../roadLevels.js";
import { cellsOf, plotTileOfCell } from "../zoneCells.js";
import { CHILDREN_SHARE, isServiceKind, SERVICE_SPECS, serviceProblem } from "../services.js";
import { ERA_RULES } from "../eraRules.js";
import { roadLevelAt } from "../roadLevels.js";
import { houseSpec } from "../rulerHouse.js";
import type { TrainedKind } from "../trainedPeople.js";
import { POWER_TOOLS, unlockCity } from "../unlocks.js";
import type { FestivalNews, FestivalScale } from "../festivals.js";
import { FARM_PAINT_TOOL, fieldLevelOf, isFieldValue, kindOfCode, wayField } from "../farmZone.js";
import { isOpenLand } from "../plots.js";
import { FARM_ZONE } from "../provinceRules.js";

/** The year's money, line by line, as the budget counted it when it collected the taxes (src/budget.js collectTax) */
export interface YearAccounts {
  income: Record<string, number>;
  costs: Record<string, number>;
  /** Income less costs: what the year added to the treasury, when its end charged them (charged); the festivals among
   *  the costs were paid in their months */
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
    // ... and the state's grant for the city's people (src/gameModes.ts)
    grant: budget.grantIncome ?? 0,
  };
  const costs: Record<string, number> = {
    roads: budget.roadSpend ?? 0, police: budget.policeSpend ?? 0, fire: budget.fireSpend ?? 0,
    fuel: budget.fuelCost ?? 0, house: budget.houseCost ?? 0, education: budget.educationCost ?? 0,
    health: budget.healthCost ?? 0, waste: budget.wasteCost ?? 0, policies: budget.policyCost ?? 0,
    transit: budget.transitCost ?? 0,
    // ... and the festivals, paid from the treasury in their months rather than at the year's end (src/festivals.ts)
    festivals: budget.festivalCost ?? 0,
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
  /** The farm zone (src/farmZone.ts): tiles painted, how many have grown and their levels, by kind */
  fields: { painted: number; grown: number; levels: number; byKind: Record<string, number> };
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
/** ... while the treasury holds this much */
const PLANT_FROM_FUNDS = 3500;
/** ... and another water works when this share of its buildings went without water, or this share of its supply is taken */
const MORE_WATER_AT = 0.15;
const MORE_WATER_USED = 0.9;
/** Factories stand this far from the town's middle at least (world units, 10 a tile), the power plants further */
const FACTORIES_FROM = 100;
const PLANT_FROM = 24;
/** The farm zone painted round the town while it is a farming village or a market town (src/farmZone.ts): at the start,
 * then each year as many tiles as the fields' room for more food asks, no more than FARM_EACH_YEAR, behind the tiles that
 * face a road (left for the zones) and no nearer the town's middle than FARM_FROM tiles */
const FARM_FIRST = 300;
const FARM_EACH_YEAR = 300;
const FARM_UNTIL_ERA = 2;
const FARM_FROM = 12;
/** A festival that would leave the treasury less than this is not held: money is tight, and a fire or a flood may come
 *  before the year's taxes (src/festivals.ts) */
const FESTIVAL_KEEP = 250;

/** The schools that train each kind of trained people, the first tried first (src/trainedPeople.ts TRAINING) */
const TRAINS: Readonly<Record<TrainedKind, readonly string[]>> = {
  literate: ["primary_school"], technician: ["secondary_school", "vocational_college"], nurse: ["vocational_college"],
  engineer: ["university"], doctor: ["university"],
};

/** The building that gives each era symbol (src/eraRules.ts), which the player builds when the era card lists it missing */
const SYMBOL_TOOLS: Readonly<Record<string, string>> = {
  water_tower: "watertower", water_works: "waterworks", power_plant: "coal", school: "primary_school",
  literate: "primary_school", hospital: "community_hospital", secondary_school: "secondary_school",
};

/** The era score's short sides are built for this much past their aim, for the year's growth to come, with no more
 * than ASK_MOST buildings a side a year */
const ASK_AHEAD = 0.15;
const ASK_MOST = 3;

/** What is kept in the treasury past the price of a building the era score asks for */
const ERA_ASK_SPARE = 300;
/** Road tiles nearest the town raised a level a year, once the city may lay the level (src/unlocks.ts) */
const PAVE_EACH_YEAR = 400;
/** ... while the treasury keeps this much */
const PAVE_KEEP = 800;
/** Spots cleared for a building before the player gives up on it for the year (clearFor): a cleared spot that still
 *  refuses the building has lost its plots for nothing */
const CLEAR_TRIES = 3;
/** Water towers put up a year while the village has no water works and is short of water */
const TOWERS_A_YEAR = 4;
/** A month of steps, when the buildings waiting for their unlock are tried again */
const STEPS_PER_MONTH = 16 * 4;

/** The festival card's question (src/festivals.ts festivalAhead): which festival, how it stands, its prices now */
type FestivalAsk = Extract<FestivalNews, { type: "festivalAhead" }>;

/**
 * How a sensible ruler holds a festival, by its prices now [modest, grand], the treasury, whether the era score finds the
 * people's living short of the era's aim (src/eraScore.ts), which a festival's cheer lifts, and the treasury's reserve:
 * grandly while the treasury would still be over its reserve after paying for it and living is short; not at all when
 * money is tight, the treasury left with less than FESTIVAL_KEEP; else modestly. A treasury that cannot pay even the
 * modest price answers modestly too: the temples and the people then hold it themselves, which lets nobody down, where
 * a festival not held would (src/festivals.ts festivalMonth). keep: what the ruler is saving for (a school, a hospital),
 * which a festival may not eat into while the people live well enough.
 */
export function festivalAnswer(costs: readonly [number, number], funds: number, livingShort: boolean, reserve: number,
                               keep = FESTIVAL_KEEP): FestivalScale {
  const [modest, grand] = costs;
  if (livingShort && funds - grand >= reserve) return "grand";
  // (while living is short a festival not held would let the people down further: it waits for no savings, only for
  // the treasury's last FESTIVAL_KEEP)
  return funds >= modest && funds - modest < (livingShort ? FESTIVAL_KEEP : Math.max(FESTIVAL_KEEP, keep)) ? "none" : "modest";
}

export class AutoPlayer {
  /** What it did, a line each, with the year */
  readonly log: string[] = [];
  private year = 0;
  private built = 0;
  private next = 0;
  /** How many buildings the era score asked for */
  private asked = 0;
  /** The festivals the news asked about at the last month's turn, answered after the step (answerFestivals) */
  private readonly asks: FestivalAsk[] = [];
  /** Buildings wanted but not yet unlocked, tried again each month: [tool, x, y] */
  private readonly later: Array<[string, number, number]> = [];
  /** The services of SERVICES built, by their place in it */
  private readonly servicesDone = new Set<number>();
  /** The locks noted this year, so each is noted once */
  private readonly noted = new Set<string>();
  /** The price of what the player saves for this year (a service, a school), which festivals do not eat into */
  private savingFor = 0;
  /** The trained people a building waited for this year, whose school the player builds (trainingGoal) */
  private readonly wantTrained = new Set<TrainedKind>();

  constructor(private readonly core: CityCore, private readonly options: PlayerOptions) {
    core.on("festivalAhead", (ask) => { this.asks.push(ask); });
  }

  /** The first buildings and zones of a new city */
  start(): void {
    const { x, y } = this.options.town;
    this.place("ruler_house", x, y);
    this.place("coal", x + PLANT_FROM, y);
    // A village's water tower, whose well waters the roads beside it, and the water works once the market town may
    // build them and the plant's months are over (src/unlocks.ts, src/construction.ts)
    this.place("watertower", x - 4, y + 4, 12);
    this.soon("waterworks", x - 10, y + 8);
    // ... and a primary school, as the era card asks from the first day: a market town needs villagers who read and
    // write, and only its classes over the years bring them (src/eraRules.ts literate, docs/GAME_DESIGN.md 6.5); it is
    // the first of the services its people ask for
    if (this.place("primary_school", x + 6, y - 6, 20)) {
      const first = SERVICES.findIndex(([, tool]) => tool === "primary_school");
      if (first >= 0) this.servicesDone.add(first);
    }
    this.paint(this.options.paintFirst ?? 6000);
    this.paintFarms(FARM_FIRST);
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
      if (this.asks.length) this.answerFestivals();
      if (this.later.length && step % STEPS_PER_MONTH === 0) this.tryLater();
      if (this.cellsLater.length && step % STEPS_PER_MONTH === 0) this.paintLater();
    }
    this.year++;
    this.noted.clear();
    const population = sim.evaluation.cityPop;
    const { x, y } = this.options.town;
    // First what the news asks for when a kind of zone can grow no more without it (src/simulation.js _sendMessages): a
    // stadium for the homes, a port for the factories, an airport for the shops; while one waits, money is saved for
    // it and nothing else but power, water and rubbish is bought
    const valves = sim._valves ?? {};
    let saving = false;
    this.savingFor = 0;
    const saveFor = (price: number): void => { saving = true; this.savingFor = Math.max(this.savingFor, price); };
    for (const [cap, tool, dx, dy] of CAPS) {
      if (!valves[cap]) continue;
      // (one the city cannot build yet is not saved for: what unlocks it comes first, src/unlocks.ts)
      if (this.waits(tool)) continue;
      const price = core.tools?.[tool]?.toolCost ?? 0;
      if (budget.totalFunds >= price + 500 && this.place(tool, x + dx, y + dy)) continue;
      saving = true;
    }
    // Then what keeps the town running: a power plant more when it uses nearly all its power (src/powerManager.js load),
    // none more while one is still being built (src/construction.ts)
    const load = sim._powerManager?.load ?? 0;
    const plantBuilding = Object.values((core.map as { sites?: Record<string, { tool: string }> | null }).sites ?? {})
      .some((site) => POWER_TOOLS.includes(site.tool));
    if (load >= MORE_POWER_AT && !plantBuilding && budget.totalFunds > PLANT_FROM_FUNDS) this.place("coal", x + PLANT_FROM, y + 8);
    // ... a water works more when many buildings went without or the supply is nearly all taken (src/waterManager.ts)
    const census = sim._census, dry = census.dryZoneCount ?? 0, wet = census.wateredZoneCount ?? 0;
    const water = sim._waterManager, short = water && water.supply > 0 && water.used >= water.supply * MORE_WATER_USED;
    if ((short || dry + wet > 0 && dry / (dry + wet) >= MORE_WATER_AT) && budget.totalFunds > 2000) {
      // ... a village's water towers while it may not build works yet (src/unlocks.ts)
      if (this.waits("waterworks")) {
        for (let n = 0; n < TOWERS_A_YEAR; n++) this.place("watertower", x + ((this.year * 7 + n * 5) % 25) - 12, y + ((n * 9) % 25) - 12, 14);
      } else {
        this.place("waterworks", x - 10 - this.year, y + 8);
      }
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
    // ... and what the era card says the next era still needs (src/eraScore.ts symbols), as a ruler reading it builds:
    // the first it can build, else money saved for it (a water works the market town waited a year for while its water
    // was not yet short, docs/GAME_DESIGN.md 6.5)
    for (const tool of this.symbolTools()) {
      const price = core.tools?.[tool]?.toolCost ?? 0;
      if (budget.totalFunds < price + ERA_ASK_SPARE) { saveFor(price + ERA_ASK_SPARE); break; }
      const n = this.asked++;
      if (this.place(tool, x + ((n * 13) % 41) - 20, y + ((n * 17) % 41) - 20)) continue;
      saveFor(price + ERA_ASK_SPARE);
      break;
    }
    if (!saving) {
      // First more care or seats while the era score finds them short of the era's aim, as a ruler reading the era
      // card would build (owner, 20 Oct 2026: the 10-year play sat at 90% in era 2 for want of health), before the
      // services the people ask for by their numbers alone (a town short of care built a big police station first)
      const factors = (core.map as { eraScore?: { factors?: Record<string, { value: number; target: number }> } }).eraScore?.factors;
      // ... the first it can afford, else it saves for it rather than painting more (a ruler reading the era card)
      for (const [side, tools] of ERA_ASKS) {
        const f = factors?.[side];
        if (!f || f.value >= f.target) continue;
        // (none more while one of the side is still being built, whose places the score does not count yet: the first
        // year built three primary schools for a village of 1,100, src/construction.ts)
        if (this.building(side)) continue;
        // (only those the district office is high enough for and the city can build: place() buys land when a
        // building finds no room)
        const allowed = tools.filter((tool) => serviceProblem(tool, core.map.rulerHouse?.level ?? 0) === null && !this.waits(tool));
        if (!allowed.length) continue;
        // ... as many as the places short of the aim, and of the next year's growth (ASK_AHEAD), no more than ASK_MOST:
        // a town growing by 3,000 people a year that built one health post a year stayed short of care for six years.
        // The places are people cared for, or children's seats (the education side's basic share, src/eraScore.ts)
        const era = Math.min(5, Math.max(1, core.map.era ?? 1)) as 1 | 2 | 3 | 4 | 5;
        const base = side === "health" ? population : population * CHILDREN_SHARE / Math.max(0.1, ERA_RULES[era].education.basic);
        let short = (f.target * (1 + ASK_AHEAD) - f.value) * base;
        for (let built = 0; short > 0 && built < ASK_MOST; built++) {
          const affordable = allowed.filter((tool) => budget.totalFunds >= (core.tools?.[tool]?.toolCost ?? 0) + ERA_ASK_SPARE);
          const n = this.asked++;
          const tool = affordable.find((tool) => this.place(tool, x + ((n * 13) % 41) - 20, y + ((n * 17) % 41) - 20));
          if (!tool) {
            if (affordable.length < allowed.length) saveFor(Math.min(...allowed.map((tool) => core.tools?.[tool]?.toolCost ?? 0)) + ERA_ASK_SPARE);
            break;
          }
          short -= isServiceKind(tool) ? SERVICE_SPECS[tool].places : short;
        }
      }
      // The district office a level higher whenever the rank allows and money is there (src/rulerHouse.ts), unless the
      // money is kept for what the era card asks
      const house = core.map.rulerHouse;
      if (house && !saving && budget.totalFunds > (this.options.reserve ?? 3000)) this.apply("ruler_house_upgrade", house.x, house.y);
      // The services its people ask for, in turn; one the office is not yet high enough for waits (serviceProblem)
      // ... and one the city cannot build yet waits while the next ones go up (src/unlocks.ts)
      // ... built while the treasury pays for them, saving for the next rather than painting more (in the normal mode
      // the treasury seldom holds the reserve)
      for (let i = this.next; !saving && i < SERVICES.length && population >= SERVICES[i][0]; i++) {
        if (this.servicesDone.has(i)) continue;
        const [, tool] = SERVICES[i];
        if (this.waits(tool)) continue;
        const price = core.tools?.[tool]?.toolCost ?? 0;
        if (budget.totalFunds < price + ERA_ASK_SPARE) { saveFor(price + ERA_ASK_SPARE); break; }
        if (!this.place(tool, x + ((i * 7) % 41) - 20, y + ((i * 11) % 41) - 20)) break;
        this.servicesDone.add(i);
      }
      while (this.servicesDone.has(this.next)) this.next++;
      // ... and the school that trains the people a building waits for, the district office raised for it first when
      // it must be, saving for them rather than painting more (src/trainedPeople.ts)
      const goal = this.trainingGoal();
      if (goal) {
        const house = core.map.rulerHouse, level = house?.level ?? 0;
        const raise = serviceProblem(goal, level) !== null;
        const price = raise ? houseSpec(level + 1).price - houseSpec(level).price : core.tools?.[goal]?.toolCost ?? 0;
        const n = this.asked++;
        this.note(`training: ${raise ? `district office for ${goal}` : goal} (฿${price}, treasury ฿${budget.totalFunds})`);
        if (budget.totalFunds < price + ERA_ASK_SPARE) saveFor(price + ERA_ASK_SPARE);
        else if (raise && house) this.apply("ruler_house_upgrade", house.x, house.y);
        else if (!raise) this.place(goal, x + ((n * 13) % 41) - 20, y + ((n * 17) % 41) - 20);
      }
      this.wantTrained.clear();
      // A bus more on a road near the middle for every BUS_PEOPLE people: riders leave their cars, so the roads carry
      // less traffic and its smoke (src/transit.ts, src/busStopTool.ts)
      while ((core.map.buses?.length ?? 0) < Math.floor(population / BUS_PEOPLE) && budget.totalFunds > (this.options.reserve ?? 3000)) {
        const n = core.map.buses?.length ?? 0;
        if (!this.place("bus_stop", x + ((n * 5) % 13) - 6, y + ((n * 3) % 13) - 6, 12)) break;
      }
    }
    // The town's roads paved, nearest first, once the city has the technicians for it (src/unlocks.ts)
    if (!saving) this.pave();
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
    // ... and the fields round a farming village, as many as its people and the market would eat
    const fields = sim._farming?.fields;
    if (!saving && fields && (core.map.era ?? 1) <= FARM_UNTIL_ERA && budget.totalFunds > EXPAND_FROM) {
      this.paintFarms(Math.min(FARM_EACH_YEAR, Math.max(0, fields.room - fields.empty)));
    }
    const map = core.map, plots = { residential: [0, 0, 0, 0, 0, 0], commercial: [0, 0, 0, 0, 0, 0], industrial: [0, 0, 0, 0, 0, 0] };
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const plot = plotOf(map, tx, ty);
        if (plot) plots[plot.kind as keyof typeof plots][plot.level]++;
      }
    }
    const farm = { painted: 0, grown: 0, levels: 0, byKind: {} as Record<string, number> };
    for (let i = 0; i < map.width * map.height; i++) {
      const level = fieldLevelOf(map.getTileValue(i % map.width, Math.floor(i / map.width)));
      if (level < 0) continue;
      farm.painted++;
      if (!level) continue;
      farm.grown++;
      farm.levels += level;
      const kind = kindOfCode(map.farmKinds?.[i] ?? 0) ?? "?";
      farm.byKind[kind] = (farm.byKind[kind] ?? 0) + 1;
    }
    return {
      fields: farm,
      year: this.year, population, funds: budget.totalFunds, built: this.built - builtBefore, accounts: yearAccounts(budget),
      cityClass: sim.evaluation.cityClass, approval: sim.evaluation.cityYes,
      landValue: sim._census.landValueAverage, pollution: sim._census.pollutionAverage,
      powerUse: Math.round((sim._powerManager?.load ?? 0) * 100),
      water: { supply: sim._waterManager?.supply ?? 0, used: Math.round(sim._waterManager?.used ?? 0),
        works: sim._census.waterWorksPop ?? 0 },
      demand: [valves.resValve ?? 0, valves.comValve ?? 0, valves.indValve ?? 0], plots,
    };
  }

  /**
   * The festival card answered for the festivals the news asked about (festivalAnswer), by the treasury now and the era
   * score; each answer is the real `festival` command, standing for the years after until the next one changes it
   */
  private answerFestivals(): void {
    const core = this.core, reserve = this.options.reserve ?? 3000;
    const living = (core.map as { eraScore?: { factors?: Record<string, { value: number; target: number }> } }).eraScore?.factors?.living;
    const short = living !== undefined && living.value < living.target;
    // Festivals asked about together are paid together
    let funds = core.simulation.budget.totalFunds;
    for (const ask of this.asks.splice(0)) {
      const [modest, grand] = ask.costs, scale = festivalAnswer(ask.costs, funds, short, reserve, this.savingFor);
      const price = scale === "grand" ? grand : scale === "modest" && funds >= modest ? modest : 0;
      funds -= price;
      if (scale === ask.scale) continue;
      if (core.apply({ type: "festival", id: ask.id, scale }).accepted) {
        // (asked during the year being played, which playYear counts once its steps are done)
        this.note(`festival ${ask.id} ${scale} (฿${price}, treasury ฿${core.simulation.budget.totalFunds}${short ? ", living short" : ""})`, this.year + 1);
      }
    }
  }

  /**
   * The buildings the era score finds missing among its symbols (src/eraScore.ts), that the city may build now and the
   * district office is high enough for: a symbol the city lacks a building for (a primary school for the villagers who
   * read and write, which only time brings once one stands)
   */
  private symbolTools(): string[] {
    const core = this.core, score = (core.map as { eraScore?: { symbols?: Array<{ key: string; has: boolean }> } }).eraScore;
    const city = unlockCity(core.map), level = core.map.rulerHouse?.level ?? 0, tools: string[] = [];
    for (const { key, has } of score?.symbols ?? []) {
      const tool = SYMBOL_TOOLS[key];
      if (has || !tool || tools.includes(tool) || city.count(tool) > 0) continue;
      if (serviceProblem(tool, level) !== null || this.waits(tool)) continue;
      tools.push(tool);
    }
    return tools;
  }

  /** Whether the city cannot build the tool yet (src/unlocks.ts), noting why once a year */
  private waits(tool: string): boolean {
    const lock = this.core.commands.lock(tool);
    if (!lock) return false;
    if (lock.reason === "unlock.trained") this.wantTrained.add(lock.params.kind as TrainedKind);
    const why = `${tool} waits: ${lock.reason} ${JSON.stringify(lock.params)}`;
    if (!this.noted.has(why)) { this.noted.add(why); this.note(why); }
    return true;
  }

  /**
   * The school to build for the trained people a building waited for this year: the first of its kind's schools the
   * city has none of and may build, or what one of them needs first; null when there is none to build yet (the
   * university waits for its era) or the rank does not allow the district office it needs
   */
  private trainingGoal(): string | null {
    const core = this.core, city = unlockCity(core.map), rank = core.commands.rank();
    for (const kind of this.wantTrained) {
      for (const school of TRAINS[kind]) {
        if (city.count(school) > 0) continue;
        const lock = core.commands.lock(school);
        const goal = !lock ? school : lock.reason === "unlock.first" && core.tools?.[String(lock.params.need)] &&
          !core.commands.lock(String(lock.params.need)) ? String(lock.params.need) : null;
        if (!goal) continue;
        // (the district office's next level needs the ruler's rank, src/rulerHouse.ts)
        const level = core.map.rulerHouse?.level ?? 0;
        if (serviceProblem(goal, level) !== null && houseSpec(level + 1).rank > rank) continue;
        return goal;
      }
    }
    return null;
  }

  /** A building now, or once the city can build it (tryLater) */
  private soon(tool: string, x: number, y: number): void {
    if (this.waits(tool)) this.later.push([tool, x, y]);
    else this.place(tool, x, y);
  }

  /** Whether a school (education) or a hospital (health) of the city stands as a construction site */
  private building(side: "health" | "education"): boolean {
    const map = this.core.map as { sites?: Record<string, unknown> | null; civicKinds?: Record<string, string> | null };
    return Object.keys(map.sites ?? {}).some((tile) => {
      const kind = map.civicKinds?.[tile];
      return isServiceKind(kind) && (SERVICE_SPECS[kind].field === "health") === (side === "health");
    });
  }

  /** The zone cells painted once their zone is unlocked (paintLater), as a ruler paints the factories planned at the
   *  start once the power plant is finished: the factories give the village its jobs, without which nobody moves in
   *  (a town that never had the money to paint them again stayed at 2,500 people for 14 years) */
  private readonly cellsLater: Array<[string, number[]]> = [];

  /** The cells waiting for their zone's unlock painted, those whose zone is unlocked and the treasury pays for */
  private paintLater(): void {
    const core = this.core, budget = core.simulation.budget;
    for (const wanted of this.cellsLater.splice(0)) {
      const [zone, cells] = wanted;
      const before = budget.totalFunds;
      const outcome = core.commands.lock(`zone_${zone}`) ? null : core.apply({ type: "zoneCells", zone: zone as never, cells });
      if (outcome?.accepted) {
        this.built += before - budget.totalFunds;
        this.note(`painted ${cells.length} ${zone} cells once unlocked`);
      } else if (!outcome || outcome.reason !== NOTHING_TO_PAINT) {
        this.cellsLater.push(wanted);
      }
    }
  }

  /** The buildings waiting for their unlock, those now unlocked tried */
  private tryLater(): void {
    for (const wanted of this.later.splice(0)) {
      const [tool, x, y] = wanted;
      if (this.core.commands.lock(tool)) this.later.push(wanted);
      else this.place(tool, x, y);
    }
  }

  /** Up to PAVE_EACH_YEAR laterite road tiles nearest the town raised to asphalt, while money allows */
  private pave(): void {
    const core = this.core, map = core.map, budget = core.simulation.budget, reserve = PAVE_KEEP;
    if (core.commands.lock("road_asphalt") || budget.totalFunds <= reserve) return;
    const { x: tx, y: ty } = this.options.town, tiles: Array<{ x: number; y: number; d: number }> = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (isRoadTile(map.getTileValue(x, y)) && roadLevelAt(map, x, y) === 1 && ownsLand(map, x, y)) {
        tiles.push({ x, y, d: Math.hypot(x - tx, y - ty) });
      }
    }
    tiles.sort((a, b) => a.d - b.d);
    let paved = 0;
    for (const { x, y } of tiles.slice(0, PAVE_EACH_YEAR)) {
      if (budget.totalFunds <= reserve) break;
      if (this.apply("road_upgrade", x, y, true)) paved++;
    }
    if (paved) this.note(`paved ${paved} road tiles`);
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
    if (this.waits(tool)) return false;
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
    // No room left on the city's land: a block more, and the building there, when the treasury pays for both (a town that
    // bought the land with the water works' money then could not build them, src/landBlocks.ts blockPrice)
    const both = blockPrice(map as never) + (this.core.tools?.[tool]?.toolCost ?? 0);
    if (!this.buying && (!map.landBlocks || this.core.simulation.budget.totalFunds >= both)) {
      this.buying = true;
      const land = this.buyLand();
      const built = land !== null && this.place(tool, land.x, land.y, 16);
      this.buying = false;
      if (built) return true;
    }
    // Still no room: plots cleared for it beside a road, as a player knocks houses down for a stadium or a port, or for
    // what the town could not build before its land was painted (src/unlocks.ts: water works, schools, hospitals)
    if (reach > 16 && (this.core.tools?.[tool]?.size ?? 1) >= 3 && this.clearFor(tool, cx, cy)) return true;
    const reasons = [...this.failures].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([why, n]) => `${why} ×${n}`);
    this.note(`${tool}: no place (${reasons.join(", ")})`);
    return false;
  }

  /**
   * Room for a building of the tool's size made on painted plots beside a road within 30 tiles of (cx, cy), where the
   * fewest and least grown plots stand: their cells
   * cleared (the eraser takes a plot and its building back, src/zoneCells.ts), then the building put there. Only plots,
   * open land and the city's own land; no road, service or other building is taken.
   */
  private clearFor(tool: string, cx: number, cy: number): boolean {
    const core = this.core, map = core.map, size = core.tools?.[tool]?.size ?? 3;
    if (!map.cellZones) return false;
    const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isRoadTile(map.getTileValue(x, y));
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && ownsLand(map, x, y) &&
      (map.getTileValue(x, y) === 0 || plotOf(map, x, y) !== null);
    // The spots where it would fit once their plots are cleared, those that take the fewest and least grown plots first
    // (a ruler clears young plots rather than the town's grown shops), then the nearest: each tile's plot counts its
    // level and one more
    const spots: Array<{ x: number; y: number; loss: number; d: number }> = [];
    for (let r = 0; r <= 30; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy, left = x - 1, top = y - 1;
          let ok = besideRoad(map.width, map.height, isRoad, x, y, size), loss = 0;
          for (let ty = top; ok && ty < top + size; ty++) {
            for (let tx = left; ok && tx < left + size; tx++) {
              ok = free(tx, ty);
              loss += ok ? (plotOf(map, tx, ty)?.level ?? -1) + 1 : 0;
            }
          }
          if (ok) spots.push({ x, y, loss, d: r });
        }
      }
    }
    if (!spots.length) return false;
    spots.sort((a, b) => a.loss - b.loss || a.d - b.d);
    // The painted cells and the tiles they stand on and belong to: a plot behind the row facing the road takes its cells
    // from beside the road (src/zoneCells.ts plotTileOfCell), so clearing only the cells on the tiles left such a plot
    // standing, and a 4 × 4 power plant never found room (the easy town stayed at 11,700 people with one plant full)
    const painted = cellsOf(map).cells.filter((c) => map.zoneCells?.get?.(c.key)).map((c) => ({
      key: c.key, tile: Math.floor(c.z / 10) * map.width + Math.floor(c.x / 10), plot: plotTileOfCell(map as never, c) }));
    for (const { x, y } of spots.slice(0, CLEAR_TRIES)) {
      const left = x - 1, top = y - 1;
      const inside = (tile: number) => {
        const tx = tile % map.width, ty = Math.floor(tile / map.width);
        return tile >= 0 && tx >= left && tx < left + size && ty >= top && ty < top + size;
      };
      const keys = painted.filter((c) => inside(c.tile) || inside(c.plot)).map((c) => c.key);
      for (let i = 0; i < keys.length; i += 4000) core.apply({ type: "zoneCells", zone: null, cells: keys.slice(i, i + 4000) });
      if (this.apply(tool, x, y)) { this.note(`cleared ${keys.length} cells for ${tool}`); return true; }
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
        const before = budget.totalFunds, batch = keys.slice(i, i + 4000);
        const outcome = core.apply({ type: "zoneCells", zone, cells: batch });
        if (outcome.accepted) {
          painted += batch.length;
          this.built += before - budget.totalFunds;
        } else if (String(outcome.reason).startsWith("unlock.")) {
          // (factories wait for a finished power plant, src/unlocks.ts: painted the month they may be, paintLater)
          this.cellsLater.push([zone, batch]);
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

  /** Up to n tiles of the farm zone painted, the nearest the town first past FARM_FROM tiles, on open land of the city's own
   *  with a way to a road that does not face the road itself (src/farmZone.ts) */
  private paintFarms(n: number): number {
    const core = this.core, map = core.map;
    if (!map.paintedZones || n <= 0) return 0;
    const reach = core.simulation.rules?.farmZone?.reach ?? FARM_ZONE.reach;
    const ways = wayField(map, reach), owns = canBuildIn(map), { x: tx, y: ty } = this.options.town;
    const spots: Array<{ x: number; y: number; d: number }> = [];
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const i = y * map.width + x, d = Math.hypot(x - tx, y - ty);
        if (ways[i] < 2 || d < FARM_FROM || !isOpenLand(map.getTileValue(x, y)) || !ownsLand(map, x, y) || !owns(x, y)) continue;
        spots.push({ x, y, d });
      }
    }
    spots.sort((a, b) => a.d - b.d);
    const budget = core.simulation.budget, before = budget.totalFunds, stroke = 900000 + this.year;
    let painted = 0;
    for (const { x, y } of spots) {
      if (painted >= n || budget.totalFunds < EXPAND_FROM / 2) break;
      const out = core.apply({ type: "tool", tool: FARM_PAINT_TOOL as never, x, y, stroke });
      if (out.accepted && out.toolResult === 0 && isFieldValue(map.getTileValue(x, y))) painted++;
    }
    this.built += before - budget.totalFunds;
    this.note(`painted ${painted} farm zone tiles ฿${before - budget.totalFunds}`);
    return painted;
  }

  private note(text: string, year = this.year): void { this.log.push(`year ${year}: ${text}`); }
}
