/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's house (จวนเจ้าเมือง, docs/RULER_HOUSE.md; owner, 13 Oct 2026): a new city's first building. Until it
// stands, a new city's other tools wait (CityCommands refuses them, the tools dock greys them); a city saved before
// the house is not held back. One house a city, on the civic 3x3 (tiles 414–422), recorded by the map:
// gameMap.rulerHouse {x, y, level} and gameMap.civicKinds[centre] = "ruler_house", both saved with the city.
// - Six levels, one for each rank (src/rulerRank.ts): the upgrade choice raises it one level for the difference in
//   price, once the ruler holds that level's rank.
// - Gains: the city's centre is the house, so land value and the shops' pull fall away from it
//   (src/blockMapUtils.js); land near it is worth more at each level; ⌂ returns to it; each level from the second
//   opens a wing (docs/RULER_HOUSE.md), and higher schools and hospitals will want a higher house.
// - Costs: its price and its upkeep each year grow with its level; there is only one, and if it burns or is
//   bulldozed its gains are gone until it is built again.
// No DOM, nothing random.

import { BaseTool } from "./baseTool.js";
import { CIVIC } from "./tileValues";

export const HOUSE_TOOL = "ruler_house";
export const HOUSE_UPGRADE_TOOL = "ruler_house_upgrade";
/** What gameMap.civicKinds says of the house's centre */
export const HOUSE_KIND = "ruler_house";

export interface HouseSpec {
  /** What a house of this level costs in all: building one pays level 1's, raising it pays the difference */
  price: number;
  /** Upkeep a year */
  upkeep: number;
  /** The rank it needs: its place in src/rulerRank.ts RANKS (0 หมื่น … 5 เจ้าพระยา) */
  rank: number;
  /** The wings it may have (docs/RULER_HOUSE.md) */
  wings: number;
}

/** By level, 1 to 6 (index 0 is level 1) */
export const HOUSE_SPECS: readonly HouseSpec[] = [
  { price: 500, upkeep: 20, rank: 0, wings: 0 },
  { price: 1500, upkeep: 50, rank: 1, wings: 1 },
  { price: 4000, upkeep: 120, rank: 2, wings: 2 },
  { price: 10000, upkeep: 300, rank: 3, wings: 3 },
  { price: 20000, upkeep: 600, rank: 4, wings: 4 },
  { price: 40000, upkeep: 1000, rank: 5, wings: 5 },
];

export const MAX_HOUSE_LEVEL = HOUSE_SPECS.length;

/** Why a tool was refused: a new city builds its ruler's house first */
export const HOUSE_FIRST = "the ruler's house comes first";
/** ... a city has one house */
export const HOUSE_STANDS = "the city has its ruler's house";
/** ... there is no house to raise */
export const NO_HOUSE = "no ruler's house to raise";
/** ... the next level needs a higher rank */
export const NEEDS_RANK = "the house's next level needs a higher rank";
/** ... the house is at its highest level */
export const HOUSE_AT_TOP = "the house is at its highest level";
export const HOUSE_REASONS: readonly string[] = [HOUSE_FIRST, HOUSE_STANDS, NO_HOUSE, NEEDS_RANK, HOUSE_AT_TOP];

/** The tools a new city may use before its house stands */
export const BEFORE_HOUSE: readonly string[] = [HOUSE_TOOL, "bulldozer"];

/**
 * The wings (ส่วนต่อเติม, owner 13 Oct 2026): a house of level n may have n − 1 of them, chosen in its window. Each costs
 * a price and an upkeep a year, and is lost without a refund when taken off or when the house falls. Two wait for
 * what they work with: the council hall for the ruler's policies, the trade office for the online network mode.
 */
export const WINGS = ["council_hall", "treasury", "planning_office", "warning_tower", "granary", "culture_court",
  "front_garden", "trade_office"] as const;
export type Wing = typeof WINGS[number];

export interface WingSpec {
  price: number;
  upkeep: number;
  /** Not in the game yet: what it waits for */
  waitsFor?: "policies" | "network";
}

export const WING_SPECS: Readonly<Record<Wing, WingSpec>> = {
  council_hall: { price: 2000, upkeep: 100, waitsFor: "policies" },
  treasury: { price: 3000, upkeep: 200 },
  planning_office: { price: 2500, upkeep: 150 },
  warning_tower: { price: 2000, upkeep: 100 },
  granary: { price: 4000, upkeep: 150 },
  culture_court: { price: 3000, upkeep: 150 },
  front_garden: { price: 1500, upkeep: 80 },
  trade_office: { price: 3000, upkeep: 150, waitsFor: "network" },
};

/** The treasury: the year's taxes, this much more (src/budget.js) */
export const TREASURY_TAX_BONUS = 0.05;
/** The planning office: roads and their upgrades cost this much of their price */
export const PLANNING_DISCOUNT = 0.9;
/** The warning tower: the seasons' disasters strike this often, of what they would (src/provinceRules.ts) */
export const WARNING_RISK_FACTOR = 0.7;
/** The granary and city tank: the water the dry season takes from the works, this much of it (src/waterManager.ts) */
export const GRANARY_DROUGHT_FACTOR = 0.5;
/** The culture court: visitors and what they spend, this many times (src/tourism.ts) ... */
export const CULTURE_VISITORS = 1.15;
/** ... and the noise around the house in a festival's month, as pollution, as far as CULTURE_NOISE_RADIUS */
export const CULTURE_NOISE = 20;
export const CULTURE_NOISE_RADIUS = 5;
/** The front garden: the land value the house adds, this many times */
export const GARDEN_LAND_VALUE = 2;

/** Why a wing command was refused */
export const NO_WING_SLOT = "the house has no room for another wing";
export const HAS_WING = "the house has that wing";
export const NOT_A_WING = "the house has no such wing";
export const WING_WAITS = "that wing is not in the game yet";
export const NO_MONEY = "not enough money";

export interface RulerHouse {
  /** Its centre */
  x: number;
  y: number;
  level: number;
  /** Its wings, in the order they were built */
  wings?: Wing[];
}

export interface HouseMap {
  readonly width: number;
  rulerHouse?: RulerHouse | null;
  civicKinds?: Record<string, string>;
  /** A new city, which builds its house before anything else */
  needsRulerHouse?: boolean;
  getTileValue(x: number, y: number): number;
  testBounds(x: number, y: number): boolean;
}

export function houseSpec(level: number): HouseSpec {
  return HOUSE_SPECS[Math.max(1, Math.min(MAX_HOUSE_LEVEL, Math.round(level))) - 1];
}

/** What raising the house from level to level + 1 costs, before the province's price rules. */
export function houseUpgradeCost(level: number): number {
  return level >= MAX_HOUSE_LEVEL ? 0 : houseSpec(level + 1).price - houseSpec(level).price;
}

/** A saved house, checked: null when it is not one. Unknown or extra wings are left out. */
export function readHouse(saved: unknown): RulerHouse | null {
  if (typeof saved !== "object" || saved === null) return null;
  const { x, y, level, wings } = saved as Partial<RulerHouse>;
  const whole = (n: unknown, max: number): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  if (!whole(x, 10000) || !whole(y, 10000) || !whole(level, MAX_HOUSE_LEVEL) || level < 1) return null;
  const known = Array.isArray(wings) ? wings.filter((wing, i): wing is Wing =>
    (WINGS as readonly unknown[]).includes(wing) && wings.indexOf(wing) === i) : [];
  return { x, y, level, wings: known.slice(0, houseSpec(level).wings) };
}

/** Whether the standing house has a wing. */
export function hasWing(map: HouseMap, wing: Wing): boolean {
  return houseStanding(map) && (map.rulerHouse?.wings ?? []).includes(wing);
}

/** The house's upkeep a year: its level's and its wings'. */
export function houseUpkeep(house: RulerHouse): number {
  return houseSpec(house.level).upkeep + (house.wings ?? []).reduce((sum, wing) => sum + WING_SPECS[wing].upkeep, 0);
}

/** Why a wing may not be built (add) or taken off now, or null. funds: the treasury's. */
export function wingProblem(map: HouseMap | undefined, wing: Wing, add: boolean, funds: number): string | null {
  if (!map || !houseStanding(map) || !map.rulerHouse) return NO_HOUSE;
  const wings = map.rulerHouse.wings ?? [];
  if (!add) return wings.includes(wing) ? null : NOT_A_WING;
  if (wings.includes(wing)) return HAS_WING;
  if (WING_SPECS[wing].waitsFor) return WING_WAITS;
  if (wings.length >= houseSpec(map.rulerHouse.level).wings) return NO_WING_SLOT;
  return funds < WING_SPECS[wing].price ? NO_MONEY : null;
}

/** One wing's row in the house's window (src/houseWindow.ts), and what its button does now. */
export interface WingRow {
  wing: Wing;
  owned: boolean;
  /** "build", "remove", or why it cannot be built */
  state: "build" | "remove" | "waits_policies" | "waits_network" | "no_room" | "no_money";
}

/** The rows of the house's window for a house and the money in the treasury. */
export function wingRows(house: RulerHouse, funds: number): WingRow[] {
  const wings = house.wings ?? [];
  const room = wings.length < houseSpec(house.level).wings;
  return WINGS.map((wing) => {
    const spec = WING_SPECS[wing];
    const owned = wings.includes(wing);
    const state: WingRow["state"] = owned ? "remove"
      : spec.waitsFor === "policies" ? "waits_policies"
      : spec.waitsFor === "network" ? "waits_network"
      : !room ? "no_room"
      : funds < spec.price ? "no_money"
      : "build";
    return { wing, owned, state };
  });
}

/** Builds or takes off a wing that wingProblem allowed; building one pays its price. */
export function changeWing(map: HouseMap, wing: Wing, add: boolean, budget: { spend(amount: number): void }): void {
  const house = map.rulerHouse;
  if (!house) return;
  const wings = house.wings ?? [];
  if (add) {
    budget.spend(WING_SPECS[wing].price);
    house.wings = [...wings, wing];
  } else {
    house.wings = wings.filter((w) => w !== wing);
  }
}

/** Whether the map's house still stands where it was built. */
export function houseStanding(map: HouseMap): boolean {
  const house = map.rulerHouse;
  return !!house && map.testBounds(house.x, house.y) && map.getTileValue(house.x, house.y) === CIVIC &&
    map.civicKinds?.[house.y * map.width + house.x] === HOUSE_KIND;
}

/** Whether a new city must still build its house before anything else. */
export function houseFirst(map: HouseMap): boolean {
  return map.needsRulerHouse === true && !houseStanding(map);
}

/** Why a tool may not be used now because of the ruler's house, or null. rank: the ruler's, 0–5. */
export function houseProblem(map: HouseMap | undefined, tool: string, rank: number): string | null {
  if (!map) return null;
  if (houseFirst(map) && !BEFORE_HOUSE.includes(tool)) return HOUSE_FIRST;
  if (tool === HOUSE_TOOL && houseStanding(map)) return HOUSE_STANDS;
  if (tool !== HOUSE_UPGRADE_TOOL) return null;
  if (!houseStanding(map)) return NO_HOUSE;
  const level = map.rulerHouse?.level ?? 1;
  if (level >= MAX_HOUSE_LEVEL) return HOUSE_AT_TOP;
  return houseSpec(level + 1).rank > rank ? NEEDS_RANK : null;
}

/**
 * Land value the house adds at (x, y): more at a higher level, less further out (src/blockMapUtils.js); twice as much
 * with the front garden.
 */
export function houseLandValue(house: RulerHouse | null | undefined, x: number, y: number): number {
  if (!house) return 0;
  const radius = 4 + 2 * house.level;
  const distance = Math.hypot(x - house.x, y - house.y);
  if (distance >= radius) return 0;
  const garden = (house.wings ?? []).includes("front_garden") ? GARDEN_LAND_VALUE : 1;
  return Math.round(4 * house.level * garden * (1 - distance / radius));
}

/** The culture court's noise at (x, y) in a festival's month, as pollution; none without the court. */
export function cultureNoise(house: RulerHouse | null | undefined, x: number, y: number): number {
  if (!house || !(house.wings ?? []).includes("culture_court")) return 0;
  const distance = Math.hypot(x - house.x, y - house.y);
  return distance > CULTURE_NOISE_RADIUS ? 0 :
    Math.round(CULTURE_NOISE * (CULTURE_NOISE_RADIUS + 1 - distance) / (CULTURE_NOISE_RADIUS + 1));
}

interface UpgradeThis {
  init(cost: number, map: unknown, shouldAutoBulldoze: boolean, isDraggable: boolean): void;
  _map: HouseMap;
  _raise: boolean;
  _applicationCost: number;
  _clearingCost: number;
  result: number | null;
  addCost(cost: number): void;
  clear(): void;
  totalCost(): number;
  TOOLRESULT_OK: number;
  TOOLRESULT_FAILED: number;
  TOOLRESULT_NO_MONEY: number;
}

const makeTool = (BaseTool as unknown as { makeTool<T>(constructor: T): T }).makeTool;

/**
 * The house's upgrade (ยกระดับจวน): a click on the house raises it one level for the difference in price. The rank it
 * needs is checked by CityCommands (houseProblem), which knows the ruler. It changes no tile, so it cannot be undone.
 */
export const RulerHouseUpgradeTool = makeTool(function(this: UpgradeThis, map: unknown) {
  // Its listed price is the first step's; each raise is charged its own step
  this.init(houseUpgradeCost(1), map, false, false);
  this._raise = false;
}) as unknown as { new(map: unknown): UpgradeThis; prototype: Record<string, unknown> };

RulerHouseUpgradeTool.prototype.noUndo = true;

RulerHouseUpgradeTool.prototype.doTool = function(this: UpgradeThis, x: number, y: number): void {
  const map = this._map;
  const house = map.rulerHouse;
  if (!house || !houseStanding(map) || Math.abs(x - house.x) > 1 || Math.abs(y - house.y) > 1 ||
      house.level >= MAX_HOUSE_LEVEL) {
    this.result = this.TOOLRESULT_FAILED;
    return;
  }
  this._raise = true;
  this.addCost(houseUpgradeCost(house.level));
  this.result = this.TOOLRESULT_OK;
};

RulerHouseUpgradeTool.prototype.clear = function(this: UpgradeThis): void {
  this._raise = false;
  this._applicationCost = 0;
  this._clearingCost = 0;
};

RulerHouseUpgradeTool.prototype.modifyIfEnoughFunding = function(this: UpgradeThis,
    budget: { totalFunds: number; spend(amount: number): void }): boolean {
  if (this.result !== this.TOOLRESULT_OK || !this._raise || !this._map.rulerHouse) {
    this.clear();
    return false;
  }
  const cost = this.totalCost();
  if (budget.totalFunds < cost) {
    this.result = this.TOOLRESULT_NO_MONEY;
    this.clear();
    return false;
  }
  this._map.rulerHouse.level += 1;
  budget.spend(cost);
  this.clear();
  return true;
};

RulerHouseUpgradeTool.prototype.pendingTiles = function(): Array<{ x: number; y: number }> {
  return [];
};
