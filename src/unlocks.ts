/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What can be built yet, and why not (docs/GAME_DESIGN.md 6.1-6.2; owner, 21 Oct 2026: "ทุกอย่างมันมีเหตุและผลที่จะสร้าง
// ไม่ได้ ต้องค่อยๆ จัดให้มีขึ้น"). Every tool has one row of plain data: the era that brings it (its technology), the trained
// people it needs (src/trainedPeople.ts), what must stand first, how many months it stands as a construction site
// (src/construction.ts), and, for the first plants, how many an early era may have. The ruler's rank (the house's level)
// still says what is allowed; these say what can really be done. The commands refuse a locked tool (src/cityCommands.ts)
// with the same reason the tool's button shows; buildings a city already has are kept.
// The trained people and the months are the normal mode's; the mode scales them (src/gameModes.ts).
// Plain code: no DOM, nothing random.

import { type Era, mapEra } from "./era.js";
import { KIND_FIELDS, toolOfCentre } from "./buildings/buildingRecords.js";
import { isAnyRail } from "./roadTiles.js";
import { isRoadTile, roadLevelAt } from "./roadLevels.js";
import { TRAINED_KINDS, type TrainedCounts, trainedOf } from "./trainedPeople.js";

export interface Unlock {
  /** The era that brings it */
  era: Era;
  /** The trained people the city must have (normal mode) */
  trained?: Partial<TrainedCounts>;
  /** What must stand first: each entry a list of which one is enough, of tools whose building stands finished, or
   * "rail" (a railway) or "paved_road" (a road of asphalt or better) */
  first?: readonly (readonly string[])[];
  /** Months it stands as a construction site before it works (normal mode) */
  months?: number;
  /** In the eras before `until`, at most `count` may stand */
  limit?: { count: number; until: Era };
}

/** Any power plant */
const POWER = ["coal", "gas", "hydro", "solar", "wind", "nuclear", "waste_power_plant"] as const;
const MINE = { era: 2, trained: { technician: 20 }, months: 3 } as const satisfies Unlock;

/**
 * The unlock table (docs/GAME_DESIGN.md 6.2), one row a tool, every tool of src/gameTools.js that builds something.
 * Tools not in it (the bulldozer, parks, the eraser, buying land, the ruler's house and its levels, which the rank
 * allows) are never locked; the upgrade tools ask the row of the level they build.
 */
export const UNLOCKS: Readonly<Record<string, Unlock>> = {
  // Era 1, the farming village: dirt and laterite roads, canals, homes and small shops, farms and fishing, the first
  // schools and health posts, police boxes and fire posts, a landfill, a water tower, and one small lignite plant
  road: { era: 1 }, canal: { era: 1 }, wire: { era: 1 },
  residential: { era: 1 }, commercial: { era: 1 }, zone_residential: { era: 1 }, zone_commercial: { era: 1 },
  // ... factories only once there is power for them (a village's factories mill its crops)
  industrial: { era: 1, first: [POWER] }, zone_industrial: { era: 1, first: [POWER] },
  farm: { era: 1 }, fishing: { era: 1 },
  kindergarten: { era: 1 }, primary_school: { era: 1 }, health_centre: { era: 1 },
  police_box: { era: 1 }, fire_post: { era: 1 }, police: { era: 1 }, fire: { era: 1 },
  landfill: { era: 1 }, watertower: { era: 1 },
  coal: { era: 1, months: 2, limit: { count: 1, until: 2 } },
  // (the water works stay in the first era, needing power to pump: the era asks for one to end, src/eraRules.ts, and a
  // water tower stores water but gives none of its own, src/waterManager.ts)
  waterworks: { era: 1, first: [POWER] },
  // Era 2, the market town: paved roads and railways with technicians, gas, mines, secondary schools and colleges, the
  // community hospital with nurses, buses on paved roads, train stations on railways, the stadium
  road_asphalt: { era: 2, trained: { technician: 20 } },
  road_concrete2: { era: 2, trained: { technician: 40 } },
  rail: { era: 2, trained: { technician: 20 } },
  gas: { era: 2, trained: { technician: 30 }, months: 3 },
  limestone_mine: MINE, potash_mine: MINE, tin_mine: MINE, zinc_mine: MINE, gold_mine: MINE, gem_mine: MINE,
  rare_earth_mine: MINE, lignite_mine: MINE, oil_well: MINE,
  secondary_school: { era: 2, first: [["primary_school"]], months: 3 },
  vocational_college: { era: 2, first: [["secondary_school"]], months: 4 },
  community_hospital: { era: 2, trained: { nurse: 10 }, months: 3 },
  police_large: { era: 2 }, fire_centre: { era: 2 },
  bus_stop: { era: 2, first: [["paved_road"]] },
  train_station: { era: 2, first: [["rail"]], months: 4 },
  stadium: { era: 2, trained: { technician: 30 }, months: 6 },
  // Era 3, the factory town: the university, then with its graduates the provincial hospital and the dam; four-lane
  // roads and highways, the port and a small airport, incinerators and wastewater plants
  university: { era: 3, first: [["secondary_school"]], months: 12 },
  provincial_hospital: { era: 3, trained: { doctor: 20, nurse: 40 }, months: 6 },
  hydro: { era: 3, trained: { engineer: 30 }, months: 12 },
  road_concrete4: { era: 3, trained: { technician: 80, engineer: 10 } },
  road_concrete6: { era: 3, trained: { technician: 120, engineer: 20 } },
  port: { era: 3, trained: { technician: 60 }, months: 6 },
  airport: { era: 3, trained: { engineer: 20 }, months: 9 },
  incinerator: { era: 3, trained: { technician: 40 }, months: 4 },
  wastewater_plant: { era: 3, trained: { technician: 40 }, months: 4 },
  police_hq: { era: 3 },
  // Era 4, the modern city: solar and wind with 200 engineers, the metro, expressways and tollways, the regional
  // hospital, waste-to-power and recycling
  solar: { era: 4, trained: { engineer: 200 }, months: 3 },
  wind: { era: 4, trained: { engineer: 200 }, months: 4 },
  metro_station: { era: 4, trained: { engineer: 100 }, months: 12 },
  road_concrete8: { era: 4, trained: { engineer: 40 } },
  motorway: { era: 4, trained: { engineer: 60 } },
  tollway: { era: 4, trained: { engineer: 80 } },
  regional_hospital: { era: 4, trained: { doctor: 100, nurse: 150 }, months: 9 },
  recycling_plant: { era: 4, trained: { engineer: 20 }, months: 4 },
  waste_power_plant: { era: 4, trained: { engineer: 50 }, months: 6 },
  // Era 5, the future city: nuclear power with many engineers and a university for its research, high-speed rail
  nuclear: { era: 5, trained: { engineer: 1000 }, first: [["university"]], months: 24 },
  hsr_station: { era: 5, trained: { engineer: 500 }, months: 18 },
};

/** Tools never locked: they build nothing that needs a reason, or the rank already decides them */
export const FREE_TOOLS: readonly string[] = ["bulldozer", "park", "zone_erase", "ruler_house", "ruler_house_upgrade",
  "road_upgrade", "building_upgrade", "building_move", "land", "query"];

/** Why a tool is locked: an i18n key (docs/i18n/UI_STRINGS.md unlock.*) and what fills it */
export interface UnlockLock {
  reason: typeof UNLOCK_REASONS[number];
  params: Record<string, string | number>;
}
export const UNLOCK_REASONS = ["unlock.era", "unlock.trained", "unlock.first", "unlock.limit"] as const;

/** What the unlocks are asked against: the city now */
export interface UnlockCity {
  era: Era;
  trained: TrainedCounts;
  /** Trained people needed times this (the mode, src/gameModes.ts) */
  trainedScale: number;
  /** Whether what a row needs first stands finished: a tool, "rail" or "paved_road" */
  has(need: string): boolean;
  /** How many buildings of the tool stand, finished or being built */
  count(tool: string): number;
}

/** The trained people a row needs in a mode, rounded up */
export function trainedNeeded(unlock: Unlock, scale: number): Partial<TrainedCounts> {
  const out: Partial<TrainedCounts> = {};
  for (const kind of TRAINED_KINDS) {
    const n = unlock.trained?.[kind];
    if (n) out[kind] = Math.ceil(n * scale);
  }
  return out;
}

/** Why the tool cannot be used yet, the first reason of the four (era, trained people, what stands first, the early
 * eras' limit), or null when it can */
export function unlockProblem(tool: string, city: UnlockCity): UnlockLock | null {
  const unlock = UNLOCKS[tool];
  if (!unlock) return null;
  if (city.era < unlock.era) return { reason: "unlock.era", params: { era: unlock.era } };
  const needed = trainedNeeded(unlock, city.trainedScale);
  for (const kind of TRAINED_KINDS) {
    const need = needed[kind] ?? 0;
    if (need > city.trained[kind]) return { reason: "unlock.trained", params: { kind, need, have: city.trained[kind] } };
  }
  for (const choices of unlock.first ?? []) {
    if (!choices.some((need) => city.has(need))) return { reason: "unlock.first", params: { need: choices[0] } };
  }
  const limit = unlock.limit;
  if (limit && city.era < limit.until && city.count(tool) >= limit.count) {
    return { reason: "unlock.limit", params: { count: limit.count, era: limit.until } };
  }
  return null;
}

/** What of the map the unlocks read (src/gameMap.js, typed loosely) */
export interface UnlockMap {
  readonly width: number;
  readonly height: number;
  era?: unknown;
  trained?: unknown;
  sites?: Record<string, unknown> | null;
  roadLevels?: Uint8Array | null;
  buildingLevels?: Record<string, number> | null;
  getTileValue(x: number, y: number): number;
  getTile(x: number, y: number): { isZone(): boolean };
  [record: string]: unknown;
}

/**
 * The city the unlocks are asked against, from its map: its era, its trained people, and its buildings, looked over once
 * when first asked (a construction site counts toward a limit but does not yet stand for what needs it).
 */
export function unlockCity(map: UnlockMap, trainedScale = 1): UnlockCity {
  let finished: Map<string, number> | null = null, all: Map<string, number> | null = null;
  let rail: boolean | null = null, paved: boolean | null = null;
  const look = (): void => {
    finished = new Map(); all = new Map();
    const sites = map.sites ?? {};
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const value = map.getTileValue(x, y), i = y * map.width + x;
      const field = KIND_FIELDS[value];
      const kind = field ? (map[field] as Record<string, string> | null | undefined)?.[i] : null;
      const found = toolOfCentre(value, kind, map.buildingLevels?.[i]);
      if (!found || found.size > 1 && !map.getTile(x, y).isZone()) continue;
      all.set(found.tool, (all.get(found.tool) ?? 0) + 1);
      if (!(i in sites)) finished.set(found.tool, (finished.get(found.tool) ?? 0) + 1);
    }
  };
  const scanRoads = (): void => {
    rail = false; paved = false;
    for (let y = 0; y < map.height && !(rail && paved); y++) for (let x = 0; x < map.width; x++) {
      const value = map.getTileValue(x, y);
      if (!rail && isAnyRail(value)) rail = true;
      if (!paved && isRoadTile(value) && roadLevelAt(map, x, y) >= 2) paved = true;
    }
  };
  return {
    era: mapEra(map),
    trained: trainedOf(map as { trained?: never }),
    trainedScale,
    has(need) {
      if (need === "rail" || need === "paved_road") {
        if (rail === null) scanRoads();
        return Boolean(need === "rail" ? rail : paved);
      }
      if (!finished) look();
      return (finished!.get(need) ?? 0) > 0;
    },
    count(tool) {
      if (!all) look();
      return all!.get(tool) ?? 0;
    },
  };
}
