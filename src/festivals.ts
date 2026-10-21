/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Thai festivals as the ruler's choice (docs/GAME_DESIGN.md section 5; section 2: "ความท้าทาย: ฤดูกาล เทศกาล ทางเลือกที่
// ต้องแลก"). Which festivals a province keeps, and in which month, is data: the country's own (New Year, Songkran, Loy
// Krathong) are the game's defaults, and data/province-rules.json adds a region's (Yi Peng in the North, Bun Bang Fai in
// the Northeast, the vegetarian festival in the South) and a province's (Khon Kaen's silk festival) through the same
// three layers as every other rule (src/provinceRules.ts). What each festival is like (its draw, price, cheer, fire
// risk and waste) is FESTIVAL_SPECS below, and the data may change any of it for a region or a province.
//
// A village under FESTIVAL_TOWN_PEOPLE people holds its festivals itself, free and unasked. In a town, a month before a
// festival the news asks the ruler how to hold it: modestly, grandly or not at all. The answer is a
// command ({ type: "festival", id, scale }, src/cityCommands.ts), kept with the city (gameMap.festivals, saved as
// festivals) and standing for the years after until the ruler changes it; a festival nobody answered for is held
// modestly. At the month's turn the core's "festivals" system (src/core/cityCore.ts) holds it: it pays for it (counted
// in the budget's festivals line, src/budget.js festivalCost), cheers the people (or lets them down), raises the land
// value round the venue (the ruler's house, or the town), and may set a fire where lanterns and rockets come down, while
// disasters are on. The simulation reads what is held this month for
// its visitors, the water Songkran uses, the traffic and the rubbish and krathong left in the water (src/simulation.js);
// the era score reads the people's cheer (src/eraScore.ts); the 3D view reads it for its lanterns and krathong
// (src/render3d/city/festivals3d.ts). Plain code: no DOM, nothing random but Random, so the same seed and the same
// commands make the same city.

import {
  DEFAULT_RULES, type Festival, FESTIVAL_IDS, type FestivalEntry, type FestivalId, type FestivalSpec, isFestivalId,
  festivalCalendar,
} from "./provinceRules";
import { Random } from "./random";
import { houseStanding, type HouseMap } from "./rulerHouse";

export { FESTIVAL_IDS, FESTIVAL_SPECS, festivalCalendar, isFestivalId } from "./provinceRules";
export type { Festival, FestivalEntry, FestivalId, FestivalSpec } from "./provinceRules";

/** How the ruler holds a festival */
export const FESTIVAL_SCALES = ["none", "modest", "grand"] as const;
export type FestivalScale = typeof FESTIVAL_SCALES[number];
/** The country's own festivals, kept in every province */
export const NATIONAL_FESTIVALS: readonly FestivalId[] = FESTIVAL_IDS.filter((id) => id in DEFAULT_RULES.festivals);

/** The festivals in a month, 0–11 as the game counts them */
export function festivalsIn(calendar: readonly Festival[], month: number): Festival[] {
  const m = ((month % 12) + 12) % 12 + 1;
  return calendar.filter((festival) => festival.month === m);
}

// --- How each way of holding it changes it ---------------------------------------------------------------------------

/** Held grandly, a festival's extra draw of visitors goes this many times as far; not held, none of it */
export const GRAND_DRAW = 1.8;
/** People still come home for a festival the city does not hold, but this share of them; more for a grand one */
export const QUIET_HOMECOMING = 0.5;
export const GRAND_HOMECOMING = 1.3;
/** Songkran's water fights held grandly use this many times the water */
export const GRAND_WATER = 1.5;
/** Traffic a festival's month adds on the roads (src/traffic.js), held modestly and grandly */
export const FESTIVAL_TRAFFIC: readonly [number, number] = [1.05, 1.15];
/** The costs are for a town of this many people; a town pays in step with its people, as its taxes come in (a village of
 * 2,000 a tenth, a city of 40,000 twice), but never less than COST_LEAST of the price (21 Oct 2026, docs/GAME_DESIGN.md
 * 6.5: a village of 1,000 paid ฿780 a year for its four festivals out of ฿200 of taxes) */
export const COST_PEOPLE = 20000;
export const COST_LEAST = 0.1;
/** Below this many people a village holds its festivals itself (owner, 21 Oct 2026: a new city's first screen was a
 * festival card over the map, "มันมีอะไรมารกหน้าจอมากๆ"): the temple and the people hold each one modestly, at no cost
 * to the treasury and with the cheer of one held modestly, and the ruler is not asked; from this many people on the
 * town's festivals are the ruler's to hold */
export const FESTIVAL_TOWN_PEOPLE = 500;
/** People for each of the census's population units (src/valves.js totalPop; src/services.ts peopleOf) */
const PEOPLE_PER_UNIT = 160;
/** The cheer and the land value fade each month to this share of what they were */
export const CHEER_KEEP = 0.75;
export const GLOW_KEEP = 0.7;
/** The most cheer festivals can bring, or take away */
export const MAX_CHEER = 15;
/** How far round the venue the land value rises, and a fire may start, in steps of the town's nearness (src/blockMapUtils.js
 * nearnessStep: a tile, or 48 m on a real-scale city map) */
export const GLOW_RADIUS = 6;
export const FIRE_RADIUS = 4;

/** Why a festival command was refused */
export const FESTIVAL_NOT_HERE = "no such festival in this province";
export const FESTIVAL_NO_CHOICE = "that festival is not the ruler's to hold";

export const isFestivalScale = (value: unknown): value is FestivalScale =>
  typeof value === "string" && (FESTIVAL_SCALES as readonly string[]).includes(value);

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
/** A scale's place in a [modest, grand] pair, -1 when not held */
const pairIndex = (scale: FestivalScale): number => FESTIVAL_SCALES.indexOf(scale) - 1;
const fromPair = (pair: readonly [number, number], scale: FestivalScale): number => scale === "none" ? 0 : pair[pairIndex(scale)];

// --- What the city keeps -------------------------------------------------------------------------------------------

/** A festival held this month, and how */
export interface HeldFestival {
  id: FestivalId;
  scale: FestivalScale;
  /** What the treasury paid */
  cost: number;
  /** The treasury could not pay, so the temples and the people held it themselves, modestly */
  byPeople?: true;
  /** Held by a village under FESTIVAL_TOWN_PEOPLE people itself: no cost, no question, no news and no dressing in the
   * 3D view, as the people hold their own */
  village?: true;
}

/** The festivals as the city keeps them (gameMap.festivals, saved as festivals) */
export interface FestivalState {
  /** The ruler's answer for each festival, standing until changed; a festival not here is held modestly */
  choices: Partial<Record<FestivalId, FestivalScale>>;
  /** The festivals held this month, set at the month's turn */
  held: HeldFestival[];
  /** The people's cheer from the festivals, in points of approval, fading month by month */
  cheer: number;
  /** Land value added round the venue, fading month by month */
  glow: number;
  /** Where the last festival was held: the ruler's house, or the town */
  venue: { x: number; y: number } | null;
  /** The month (cityTime / 4) last worked out, so a month is never held twice */
  at: number;
}

export function newFestivalState(): FestivalState {
  return { choices: {}, held: [], cheer: 0, glow: 0, venue: null, at: -1 };
}

const finite = (value: unknown, low: number, high: number, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, low, high) : fallback;

/** A saved city's festivals, keeping only what reads; a city saved before them starts afresh */
export function readFestivals(saved: unknown): FestivalState {
  const state = newFestivalState();
  if (typeof saved !== "object" || saved === null) return state;
  const s = saved as Record<string, unknown>;
  if (typeof s.choices === "object" && s.choices !== null) {
    for (const [id, scale] of Object.entries(s.choices as Record<string, unknown>)) {
      if (isFestivalId(id) && isFestivalScale(scale)) state.choices[id] = scale;
    }
  }
  if (Array.isArray(s.held)) {
    for (const h of s.held as unknown[]) {
      const held = h as Partial<HeldFestival> | null;
      if (!held || !isFestivalId(held.id) || !isFestivalScale(held.scale)) continue;
      state.held.push({ id: held.id, scale: held.scale, cost: finite(held.cost, 0, 1e9), ...(held.byPeople ? { byPeople: true as const } : {}),
        ...(held.village ? { village: true as const } : {}) });
    }
  }
  state.cheer = finite(s.cheer, -MAX_CHEER, MAX_CHEER);
  state.glow = finite(s.glow, 0, 100);
  const venue = s.venue as { x?: unknown; y?: unknown } | null | undefined;
  state.venue = venue && Number.isInteger(venue.x) && Number.isInteger(venue.y) ? { x: venue.x as number, y: venue.y as number } : null;
  state.at = Number.isInteger(s.at) ? s.at as number : -1;
  return state;
}

/** The festivals as a save keeps them, or nothing for a city that has had none */
export function writeFestivals(state: FestivalState | null | undefined): Record<string, unknown> | undefined {
  if (!state) return undefined;
  const empty = !Object.keys(state.choices).length && !state.held.length && !state.cheer && !state.glow && state.at < 0;
  if (empty) return undefined;
  return {
    choices: { ...state.choices },
    held: state.held.map((h) => ({ ...h })),
    // Unrounded, so a city opened again goes on as the one saved would have
    cheer: state.cheer,
    glow: state.glow,
    venue: state.venue ? { ...state.venue } : null,
    at: state.at,
  };
}

/** The map's festivals, made when a map has none yet */
export function festivalsOf(map: { festivals?: FestivalState | null }): FestivalState {
  return map.festivals ??= newFestivalState();
}

// --- The ruler's answer --------------------------------------------------------------------------------------------

/** Why the ruler may not hold a festival this way, or null: it must be one of the province's, and the ruler's to hold */
export function festivalProblem(calendar: readonly Festival[], id: FestivalId, scale: FestivalScale): string | null {
  const festival = calendar.find((f) => f.id === id);
  if (!festival || !isFestivalScale(scale)) return FESTIVAL_NOT_HERE;
  return festival.choice ? null : FESTIVAL_NO_CHOICE;
}

/** Keeps the ruler's answer that festivalProblem allowed: it holds from the festival's next turn on */
export function chooseFestival(state: FestivalState, id: FestivalId, scale: FestivalScale): void {
  state.choices[id] = scale;
}

/** How a festival will be held when it comes: the ruler's answer, or modestly */
export function scaleOf(state: FestivalState | null | undefined, festival: Festival): FestivalScale {
  return festival.choice ? state?.choices[festival.id] ?? "modest" : "modest";
}

/** What holding a festival this way costs a town of so many people, in whole tens of baht */
export function festivalCost(festival: FestivalSpec, scale: FestivalScale, people: number): number {
  const base = fromPair(festival.cost, scale);
  if (base <= 0) return 0;
  return Math.round(base * Math.max(COST_LEAST, Math.max(0, people) / COST_PEOPLE) / 10) * 10;
}

// --- The month ----------------------------------------------------------------------------------------------------

/** What the festivals' month needs of the city: the simulation (src/simulation.js) */
export interface FestivalSim {
  _cityTime: number;
  getDate(): { month: number; year: number };
  rules?: { festivals?: Readonly<Partial<Record<string, FestivalEntry>>> } | null;
  /** The province's resources: a practice map has none, and no festivals */
  resources?: Readonly<Record<string, number>> | null;
  _census?: { totalPop?: number } | null;
  /** The treasury, and the year's festival spending it counts for the budget window (src/budget.js festivalFund) */
  budget: { totalFunds: number; spend(amount: number): void; festivalFund?: number };
  disasterManager?: { disastersEnabled: boolean; setFireNear?(x: number, y: number, radius: number): { x: number; y: number } | null } | null;
}

/** The map, as the festivals read it */
export interface FestivalMap extends HouseMap {
  festivals?: FestivalState | null;
  town?: { x: number; y: number } | null;
  tileSizeM?: number | null;
}

/** What the month's festivals tell the city's listeners (src/core/cityCore.ts CoreEvent) */
export type FestivalNews =
  /** A festival held this month: downgraded, a grand one the treasury could not pay held modestly; village, one a
   * village under FESTIVAL_TOWN_PEOPLE held itself, which nobody needs telling about */
  | { type: "festival"; id: FestivalId; scale: FestivalScale; cost: number; byPeople: boolean; downgraded: boolean; village?: true }
  /** A festival next month: the ruler is asked how to hold it, at these prices [modest, grand] */
  | { type: "festivalAhead"; id: FestivalId; scale: FestivalScale; costs: [number, number] }
  /** Lanterns or rockets came down burning at (x, y) */
  | { type: "festivalFire"; id: FestivalId; x: number; y: number };

/** The province's festivals as the simulation's rules have them; none on a practice map */
export function calendarOf(sim: Pick<FestivalSim, "rules" | "resources">): Festival[] {
  if (!sim.resources || Object.keys(sim.resources).length === 0) return [];
  return festivalCalendar(sim.rules?.festivals ?? DEFAULT_RULES.festivals);
}

/** Where the city holds its festivals: the ruler's house while it stands, else the town */
export function venueOf(map: FestivalMap): { x: number; y: number } | null {
  if (houseStanding(map) && map.rulerHouse) return { x: map.rulerHouse.x, y: map.rulerHouse.y };
  return map.town ? { x: map.town.x, y: map.town.y } : null;
}

/** Tiles in one step of the town's nearness: as src/blockMapUtils.js nearnessStep (48 m on a real-scale city map) */
export function nearnessStep(map: { tileSizeM?: number | null }): number {
  const metres = map.tileSizeM;
  return metres && metres > 0 && metres <= 40 ? Math.max(1, Math.round(48 / metres)) : 1;
}

/** People in the city as the census last counted them */
export const peopleNow = (sim: Pick<FestivalSim, "_census">): number => Math.max(0, sim._census?.totalPop ?? 0) * PEOPLE_PER_UNIT;

/** The prices of holding a festival modestly and grandly now */
export function festivalPrices(festival: Festival, sim: Pick<FestivalSim, "_census">): [number, number] {
  const people = peopleNow(sim);
  return [festivalCost(festival, "modest", people), festivalCost(festival, "grand", people)];
}

/**
 * A month of the festivals, at its turn (the core's "festivals" system): the cheer and the land value fade; this
 * month's festivals are held as the ruler answered, paid for from the treasury (a grand one it cannot pay is held
 * modestly, a modest one by the people), cheer the people and raise the land round the venue, and lanterns and rockets
 * may start a fire there while disasters are on (Random); and next month's festivals are announced. Never twice a month.
 */
export function festivalMonth(map: FestivalMap, sim: FestivalSim): FestivalNews[] {
  const state = festivalsOf(map);
  const monthIndex = sim._cityTime >> 2;
  if (state.at === monthIndex) return [];
  state.at = monthIndex;
  const fade = (value: number, keep: number): number => Math.abs(value * keep) < 0.05 ? 0 : value * keep;
  state.cheer = fade(state.cheer, CHEER_KEEP);
  state.glow = fade(state.glow, GLOW_KEEP);
  state.held = [];
  const calendar = calendarOf(sim);
  if (!calendar.length) return [];

  const month = sim.getDate().month, people = peopleNow(sim), venue = venueOf(map), news: FestivalNews[] = [];
  const village = people < FESTIVAL_TOWN_PEOPLE;
  for (const festival of festivalsIn(calendar, month)) {
    if (village) {
      // The village's own: held modestly by its temple and its people, cheering them, and nothing more to it
      state.cheer = clamp(state.cheer + festival.cheer[pairIndex("modest") + 1], -MAX_CHEER, MAX_CHEER);
      state.held.push({ id: festival.id, scale: "modest", cost: 0, byPeople: true, village: true });
      news.push({ type: "festival", id: festival.id, scale: "modest", cost: 0, byPeople: true, downgraded: false, village: true });
      continue;
    }
    let scale = scaleOf(state, festival), cost = festivalCost(festival, scale, people), downgraded = false, byPeople = false;
    if (scale === "grand" && sim.budget.totalFunds < cost) {
      scale = "modest";
      cost = festivalCost(festival, scale, people);
      downgraded = true;
    }
    if (scale === "modest" && cost > 0 && sim.budget.totalFunds < cost) {
      byPeople = true;
      cost = 0;
    }
    if (cost > 0) {
      sim.budget.spend(cost);
      sim.budget.festivalFund = (sim.budget.festivalFund ?? 0) + cost;
    }
    // The people cheer a festival the ruler held, and are let down by one not held; one they held themselves is theirs
    if (!byPeople) state.cheer = clamp(state.cheer + festival.cheer[pairIndex(scale) + 1], -MAX_CHEER, MAX_CHEER);
    if (scale !== "none" && venue) {
      state.glow = Math.max(state.glow, fromPair(festival.land, scale));
      state.venue = venue;
    }
    state.held.push({ id: festival.id, scale, cost, ...(byPeople ? { byPeople: true as const } : {}) });
    news.push({ type: "festival", id: festival.id, scale, cost, byPeople, downgraded });
    // Sky lanterns and rockets come down, sometimes burning, near where they went up
    const chance = fromPair(festival.fire, scale), disasters = sim.disasterManager;
    if (chance > 0 && venue && disasters?.disastersEnabled && disasters.setFireNear && Random.next() < chance) {
      const at = disasters.setFireNear(venue.x, venue.y, FIRE_RADIUS * nearnessStep(map));
      if (at) news.push({ type: "festivalFire", id: festival.id, x: at.x, y: at.y });
    }
  }
  // Next month's festivals: the ruler of a town is asked a month before
  if (village) return news;
  for (const festival of festivalsIn(calendar, month + 1)) {
    if (!festival.choice) continue;
    news.push({ type: "festivalAhead", id: festival.id, scale: scaleOf(state, festival), costs: festivalPrices(festival, sim) });
  }
  return news;
}

// --- What the simulation reads this month --------------------------------------------------------------------------

/** A festival as the visitors see it this month (src/tourism.ts tourismMonth): its draw, homecoming and water as held */
export interface FestivalVisit {
  id: FestivalId;
  draw: number;
  homecoming: number;
  waterUse: number;
  /** Not held by the city: only some people come home for it, and it is not the month's festival */
  quiet: boolean;
}

/** Whether the core has worked out a month of the festivals for this city (a simulation run alone has none) */
export function festivalsRun(map: { festivals?: FestivalState | null }): boolean {
  return (map.festivals?.at ?? -1) >= 0;
}

/**
 * The festivals held this month, as the visitors and the water see them; undefined before the core has worked out a
 * month of them, when tourismMonth holds the country's own modestly.
 */
export function festivalVisits(map: FestivalMap, calendar: readonly Festival[]): FestivalVisit[] | undefined {
  if (!festivalsRun(map)) return undefined;
  const held = map.festivals?.held ?? [];
  return held.flatMap((h): FestivalVisit[] => {
    const festival = calendar.find((f) => f.id === h.id);
    if (!festival) return [];
    const extra = festival.draw - 1;
    if (h.scale === "none") {
      return [{ id: h.id, draw: 1, homecoming: festival.homecoming * QUIET_HOMECOMING, waterUse: 0, quiet: true }];
    }
    const grand = h.scale === "grand";
    return [{ id: h.id, draw: 1 + extra * (grand ? GRAND_DRAW : 1), homecoming: festival.homecoming * (grand ? GRAND_HOMECOMING : 1),
      waterUse: festival.waterUse * (grand ? GRAND_WATER : 1), quiet: false }];
  });
}

/** How much more traffic this month's festivals bring onto the roads, 1 for none (src/traffic.js weatherLoad) */
export function festivalTraffic(map: FestivalMap): number {
  let load = 1;
  for (const h of map.festivals?.held ?? []) if (h.scale !== "none") load = Math.max(load, fromPair(FESTIVAL_TRAFFIC, h.scale));
  return load;
}

/** The rubbish this month's festivals leave (tonnes) and how much the krathong left in the water dirty it, 0–1 */
export function festivalWaste(map: FestivalMap, calendar: readonly Festival[], people: number): { rubbish: number; dirt: number } {
  let rubbish = 0, dirt = 0;
  for (const h of map.festivals?.held ?? []) {
    const festival = calendar.find((f) => f.id === h.id);
    if (!festival || h.scale === "none") continue;
    rubbish += fromPair(festival.rubbish, h.scale) * Math.max(0, people) / 1000;
    dirt += fromPair(festival.dirt, h.scale);
  }
  return { rubbish, dirt: clamp(dirt, 0, 1) };
}

/** Land value the festivals add at (x, y), highest at the venue and none from GLOW_RADIUS steps out */
export function festivalLandValue(map: FestivalMap, x: number, y: number, step = 1): number {
  const state = map.festivals;
  if (!state || state.glow <= 0 || !state.venue) return 0;
  const radius = GLOW_RADIUS * step, distance = Math.hypot(x - state.venue.x, y - state.venue.y);
  return distance >= radius ? 0 : Math.round(state.glow * (1 - distance / radius));
}

/** The people's cheer from the festivals, in points of approval (src/eraScore.ts "living") */
export function festivalCheer(map: { festivals?: FestivalState | null }): number {
  return map.festivals?.cheer ?? 0;
}

/** The festivals being held this month, as the 3D view draws them: those the town holds, not a village's own */
export function festivalsShown(map: { festivals?: FestivalState | null }): HeldFestival[] {
  return (map.festivals?.held ?? []).filter((h) => h.scale !== "none" && !h.village);
}
