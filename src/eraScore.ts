/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's era from its score (owner, 20 Oct 2026; docs/GAME_DESIGN.md section 1): each month the score of the era
// the city is in is worked out, 0 to 1,
//
//     score = how far its people are toward the era's number  x  how well they live (each side counted per person)
//
// averaged over the last months. From 0.8 its buildings begin to take the next era's look, a few at a time, the best
// placed first; at 1 the city is in the next era and the score starts again against that era's numbers. An era once
// reached is kept. Each building keeps its own era (map.buildingEras, 1-5 a centre tile), which the 3D view draws.
// Plain code with the simulation's Random only: no DOM, the same city for the same seed and commands.

import { type Era, isEra, mapEra } from "./era.js";
import {
  ADVANCE_CHANCE, CLEAN_SHARE, ERA_RULES, FACTORS, type Factor, FLOOR_CAP, FLOORS, LITERATE_WANTED, PAVED_SHARE,
  RENOVATE_CHANCE, SCORE_MONTHS, SHOPS_WANTED, type SymbolKey, TECHNICIANS_WANTED, TRANSITION_START,
} from "./eraRules.js";
import { trainedOf } from "./trainedPeople.js";
import type { Building } from "./objects/cityObject.js";
import { Random } from "./random.js";
import { houseStanding } from "./rulerHouse.js";
import { festivalCheer } from "./festivals.js";
import { templeCheer } from "./temples.js";
import { isRoadTile } from "./roadTiles.js";
import { roadLevelAt } from "./roadLevels.js";
import { segmentLevel } from "./sim/roadUpkeep.js";
import { isCityTileSize } from "./units.js";
import { modeRule } from "./gameModes.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = any;

/** One side of life as the score saw it this month */
export interface FactorScore { value: number; target: number; done: number; weight: number }

/** A symbol of the era and whether the city has it */
export interface EraSymbol { key: SymbolKey; has: boolean; count?: { have: number; need: number } }

/** The era score of a month, kept on the map for the status bar and the era card (map.eraScore) */
export interface EraScore {
  era: Era;
  /** The averaged score, 0-1, that moves the city on */
  score: number;
  /** This month's own score, before averaging */
  month: number;
  /** People and how far they are toward the era's number */
  people: number;
  peopleWanted: number;
  peopleDone: number;
  /** How well they live, 0-1 */
  quality: number;
  factors: Record<Factor, FactorScore>;
  /** The symbols the era wants, and which the city has; one that counts (literate) also says how many it has and wants */
  symbols: EraSymbol[];
  /** A floor not met (water or power) holds the score below the transition */
  heldBy: Factor | null;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
/** A number in [0, 1) from the simulation's own generator (src/random.ts), so a replay makes the same city */
const roll = (): number => Random.getRandom16() / 65536;

/** Every building the city keeps as an object (src/objects/), from the core */
interface Objects { all(): Building[] }

/** The people's share with water and with power, each home weighed by its level (a level is about as many people)
 * and, a plot of the list, by how much of a tile it covers (src/objects/buildings.ts plotObject) */
function servedShares(map: Legacy, objects: Objects): { water: number; power: number } {
  let homes = 0, watered = 0, powered = 0;
  for (const b of objects.all()) {
    if (b.kind !== "home") continue;
    const level = ((b as Building & { level?(m: Legacy): number }).level?.(map) || 1) * ((b as Building & { share?: number }).share ?? 1);
    homes += level;
    const water = map.water?.zoneWater?.(b.x, b.y);
    // 1 watered, 2 dry but needing none (a small house): both have what they need
    if (water === 1 || water === 2 || !map.water) watered += level;
    if (b.powered(map)) powered += level;
  }
  return homes ? { water: watered / homes, power: powered / homes } : { water: 0, power: 0 };
}

/** The villagers who read and write the literate symbol wants in a mode (src/gameModes.ts), and the city has */
export function literateCount(map: Legacy, level: unknown): { have: number; need: number } {
  return { have: trainedOf(map).literate, need: Math.ceil(LITERATE_WANTED * modeRule(level).trained) };
}

/** ... and the technicians the technicians symbol wants */
export function techniciansCount(map: Legacy, level: unknown): { have: number; need: number } {
  return { have: trainedOf(map).technician, need: Math.ceil(TECHNICIANS_WANTED * modeRule(level).trained) };
}

/** An era symbol: whether the city has what it asks, and for one that counts, how many */
function symbolOf(key: SymbolKey, map: Legacy, sim: Legacy, objects: Objects): EraSymbol {
  if (key === "literate" || key === "technicians") {
    const count = (key === "literate" ? literateCount : techniciansCount)(map, sim._gameLevel);
    return { key, has: count.have >= count.need, count };
  }
  return { key, has: hasSymbol(key, map, objects) };
}

/** Whether the city has what an era symbol asks */
function hasSymbol(key: Exclude<SymbolKey, "literate" | "technicians">, map: Legacy, objects: Objects): boolean {
  // (a building still being built is not had yet, src/construction.ts)
  const sites = map.sites || {};
  const kinds = (field: string): string[] =>
    Object.entries(map[field] || {}).filter(([tile]) => !(tile in sites)).map(([, kind]) => kind as string);
  const civic = kinds("civicKinds");
  const all = objects.all().filter(b => !(b.id in sites));
  switch (key) {
    case "ruler_house": return !map.rulerHouse || houseStanding(map);
    case "shops": return all.filter(b => b.kind === "shop").length >= SHOPS_WANTED;
    case "water_tower": return all.some(b => b.kind === "water_tower");
    case "water_works": return all.some(b => b.kind === "water_works");
    case "power_plant": return all.some(b => b.kind === "power_plant");
    case "school": return civic.some(k => /school|kindergarten|college|university/.test(k));
    case "hospital": return civic.some(k => /hospital/.test(k));
    case "secondary_school": return civic.some(k => k === "secondary_school" || k === "vocational_college" || k === "university");
    case "university_or_metro": return civic.includes("university") || kinds("stationKinds").some(k => k === "metro_station" || k === "hsr_station");
    case "recycling": return kinds("wasteKinds").includes("recycling_plant");
    case "paved_roads": {
      // ... on a real-scale city map by the length of the roads in the graph, each at the level it works at
      // (docs/NO_GRID_PLAN.md 5.2: the city counted from its roads, not a look over every tile)
      const graph = map.roadGraph;
      if (graph?.segments?.size && isCityTileSize(map.tileSizeM)) {
        let length = 0, pavedLength = 0;
        for (const segment of graph.segments.values()) {
          const metres = graph.length(segment.id);
          length += metres;
          if (segmentLevel(map, graph, segment) >= 2) pavedLength += metres;
        }
        return length > 0 && pavedLength / length >= PAVED_SHARE;
      }
      let roads = 0, paved = 0;
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (!isRoadTile(map.getTileValue(x, y))) continue;
        roads++;
        if (roadLevelAt(map, x, y) >= 2) paved++;
      }
      return roads > 0 && paved / roads >= PAVED_SHARE;
    }
    case "clean_power": {
      const plants = all.filter(b => b.kind === "power_plant");
      if (!plants.length) return false;
      const clean = plants.filter(b => ["solar", "wind", "hydro"].includes((map.powerKinds || {})[b.id] ?? "lignite")).length;
      return clean / plants.length >= CLEAN_SHARE;
    }
  }
}

/** This month's score of the era the city is in, from what the simulation last counted */
export function scoreEra(map: Legacy, sim: Legacy, objects: Objects, era: Era = mapEra(map)): Omit<EraScore, "score"> {
  const rule = ERA_RULES[era];
  const census = sim._census ?? {}, levels = sim._serviceLevels ?? {}, evaluation = sim.evaluation ?? {};
  const people = Math.max(0, evaluation.cityPop ?? 0);
  const shares = servedShares(map, objects);
  // Jobs per worker as the demand valves count them (src/valves.js): shops and factories against homes
  // ... and the farm zone's work in the fields (src/farmZone.ts)
  const res = census.resHist10?.[0] ?? 0, jobs = (census.comHist10?.[0] ?? 0) + (census.indHist10?.[0] ?? 0) + (sim._farming?.fields?.jobs ?? 0);
  const education = ((levels.basic ?? 0) * rule.education.basic + (levels.higher ?? 0) * rule.education.higher) / 100;
  // ... the yearly poll, and the cheer of the festivals the ruler held or let pass these last months (src/festivals.ts)
  // and of the temples (src/temples.ts)
  const approval = clamp01(((evaluation.cityYes ?? 0) > 0 ? evaluation.cityYes / 100 : 0.5) + (festivalCheer(map) + templeCheer(map)) / 100);
  const values: Record<Exclude<Factor, "symbol">, number> = {
    water: shares.water,
    power: shares.power,
    jobs: res > 0 ? jobs / res : 0,
    education,
    health: (levels.health ?? 0) / 100,
    safety: 1 - (census.crimeAverage ?? 0) / 250,
    clean: (1 - (census.pollutionAverage ?? 0) / 255) * (1 - clamp01(sim._waste?.overflow ?? 0)),
    living: (approval + clamp01((census.landValueAverage ?? 0) / 250)) / 2,
  };
  const symbols = rule.symbols.map(key => symbolOf(key, map, sim, objects));
  const factors = {} as Record<Factor, FactorScore>;
  let quality = 0;
  for (const factor of FACTORS) {
    const weight = rule.weights[factor];
    const value = factor === "symbol" ? (symbols.length ? symbols.filter(s => s.has).length / symbols.length : 1) : clamp01(values[factor]);
    const target = factor === "symbol" ? 1 : rule.targets[factor];
    const done = clamp01(target > 0 ? value / target : 1);
    factors[factor] = { value, target, done, weight };
    quality += weight * done;
  }
  // The people the era wants, scaled by the city's mode (src/gameModes.ts)
  const peopleWanted = Math.round(rule.people * modeRule(sim._gameLevel).people);
  const peopleDone = clamp01(people / peopleWanted);
  let month = clamp01(peopleDone * quality);
  let heldBy: Factor | null = null;
  for (const [factor, floor] of Object.entries(FLOORS) as [Factor, number][]) {
    if (factors[factor].value < floor && month > FLOOR_CAP) { month = FLOOR_CAP; heldBy = factor; }
  }
  return { era, month, people, peopleWanted, peopleDone, quality: clamp01(quality), factors, symbols, heldBy };
}

/** What the era system tells the game: the transition began, or a new era came */
export type EraNews = { type: "dawn"; era: Era } | { type: "era"; era: Era };

/** The pull of a building's place toward the new: its land value (0.5 on the poorest land, 1.5 on the best) */
function pull(sim: Legacy, b: Building): number {
  const land = sim.blockMaps?.landValueMap?.worldGet?.(b.x, b.y) ?? 0;
  return 0.5 + clamp01(land / 250);
}

/** The era a building takes when it goes up or grows a level: the city's, or in the transition sometimes the next */
function eraForNew(cityEra: Era, transition: number, place: number): Era {
  if (cityEra < 5 && transition > 0 && roll() < transition * Math.min(1, place)) return (cityEra + 1) as Era;
  return cityEra;
}

/**
 * The monthly era system (src/core/cityCore.ts): the score, the move to the next era, and each building's era.
 * `levels` keeps, per centre tile, the level its era was last given at (not saved: after a load every building
 * counts as unchanged).
 */
export function eraMonth(map: Legacy, sim: Legacy, objects: Objects, levels: { stamps: Uint8Array | null }): EraNews[] {
  const news: EraNews[] = [];
  const size = map.width * map.height;
  if (!isEra(map.era)) map.era = mapEra(map);
  let era = map.era as Era;
  const scored = scoreEra(map, sim, objects, era);
  const history: number[] = Array.isArray(map.eraHistory) ? map.eraHistory.slice(-(SCORE_MONTHS - 1)) : [];
  history.push(scored.month);
  const score = history.reduce((a, b) => a + b, 0) / history.length;
  map.eraHistory = history;
  map.eraScore = { ...scored, score } satisfies EraScore;
  if (score >= TRANSITION_START && !map.eraDawn && era < 5) { map.eraDawn = true; news.push({ type: "dawn", era: (era + 1) as Era }); }
  // (a hair under 1 is 1: the weights' sum rounds)
  if (score >= 1 - 1e-9 && era < 5) {
    era = (era + 1) as Era;
    map.era = era;
    map.eraHistory = [];
    map.eraDawn = false;
    news.push({ type: "era", era });
  }
  // Each building's era
  const transition = era < 5 ? clamp01((score - TRANSITION_START) / (1 - TRANSITION_START)) : 0;
  const first = !(map.buildingEras instanceof Uint8Array) || map.buildingEras.length !== size;
  if (first) map.buildingEras = new Uint8Array(size);
  const eras: Uint8Array = map.buildingEras;
  if (!levels.stamps || levels.stamps.length !== size) levels.stamps = null;
  const stamps = levels.stamps ?? new Uint8Array(size);
  const fresh = levels.stamps === null;
  levels.stamps = stamps;
  const standing = new Uint8Array(size);
  const before = eras.slice();
  // In the transition no more of the buildings take the next era's look than the transition has gone: at 0.9, half
  // of them at most (a city held at 90% for years kept its era but had turned nearly all its buildings to the next)
  // (each building's era is kept by the tile it is drawn by, its centre's or a plot's anchor, src/objects/cityObject.ts
  // eraTile: two plots counted at one tile share it, the first of them deciding)
  const tileOf = (b: Building): number => (b as Building & { eraTile?: number }).eraTile ?? b.id;
  const seenTiles = new Set<number>(), all = objects.all().filter((b) => {
    const t = tileOf(b);
    if (t < 0 || t >= size || seenTiles.has(t)) return false;
    seenTiles.add(t);
    return true;
  }), next = Math.min(5, era + 1);
  let ahead = 0;
  for (const b of all) if (eras[tileOf(b)] >= next && era < 5) ahead++;
  const mayAdvance = (): boolean => era < 5 && ahead < transition * all.length;
  for (const b of all) {
    const t = tileOf(b);
    standing[t] = 1;
    const level = ((b as Building & { level?(m: Legacy): number }).level?.(map) ?? 0) + 1;
    const own = eras[t];
    if (own === 0) {
      // A building of a city that kept no eras yet stands in the era it is in; a new one may be the next
      eras[t] = first ? era : eraForNew(era, mayAdvance() ? transition : 0, pull(sim, b));
    } else if (fresh || stamps[t] === 0) {
      // Just loaded, or just moved to another block (the move command carries its era, src/cityCommands.ts): as it was
    } else if (stamps[t] !== level) {
      // It grew (or shrank) a level: rebuilt in the era of now, never an older one than it had
      eras[t] = Math.max(own, eraForNew(era, mayAdvance() ? transition : 0, pull(sim, b)));
    } else if (own < era && roll() < RENOVATE_CHANCE * pull(sim, b)) {
      eras[t] = era;
    } else if (own === era && transition > 0 && mayAdvance() && roll() < ADVANCE_CHANCE * transition * pull(sim, b)) {
      eras[t] = Math.min(5, era + 1);
    }
    if (eras[t] >= next && (own < next) && era < 5) ahead++;
    stamps[t] = level;
  }
  // A building gone leaves no era behind it
  for (let i = 0; i < size; i++) if (eras[i] && !standing[i]) { eras[i] = 0; stamps[i] = 0; }
  // A count the 3D view watches, to draw again the buildings whose era changed (render3d/city/index.ts)
  for (let i = 0; i < size; i++) if (eras[i] !== before[i]) { map.buildingErasVersion = (map.buildingErasVersion ?? 0) + 1; break; }
  return news;
}
