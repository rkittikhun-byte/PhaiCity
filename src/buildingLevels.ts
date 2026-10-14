/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The levels of the ruler's buildings (ระดับของเครื่องมือ, docs/TOOLS_PLAN.md item 9; owner, 14 Oct 2026, "ระดับ
// เครื่องมือ" first): each level is a tool of its own, chosen in the places above the dock before building, on the
// same tiles as the building always had; the map records each building's level by its centre's index
// (gameMap.buildingLevels, saved as buildingLevels), and one upgrade tool raises any building a level for the
// difference in price, as the roads' does (src/roadLevels.ts). A higher level does more, and costs more to keep.
// A building with no record is at its group's base level: what it was before the levels.
// Plain code, no DOM, nothing random: the simulation (src/emergencyServices.js) and the commands use it.

import { NEEDS_HOUSE_LEVEL } from "./services.js";
import { FIRESTATION, POLICESTATION } from "./tileValues.js";

export interface LevelSpec {
  /** The tool that builds this level */
  readonly tool: string;
  readonly price: number;
  /** Upkeep as a share of the original building's */
  readonly upkeep: number;
  /** How much it does as a share of the original building's */
  readonly effect: number;
  /** The ruler's house level it needs (src/rulerHouse.ts), 0 for none */
  readonly house: number;
}

export interface LevelGroup {
  /** The building's centre tile, and its size */
  readonly centre: number;
  readonly size: number;
  /** The level of a building the map has no record of */
  readonly base: number;
  /** Level 1 first */
  readonly levels: readonly LevelSpec[];
}

export const LEVEL_GROUPS = {
  // Police: a box at a junction, the old station, a big station, the provincial headquarters
  police: { centre: POLICESTATION, size: 3, base: 2, levels: [
    { tool: "police_box", price: 250, upkeep: 0.5, effect: 0.5, house: 0 },
    { tool: "police", price: 500, upkeep: 1, effect: 1, house: 0 },
    { tool: "police_large", price: 1200, upkeep: 1.8, effect: 1.6, house: 2 },
    { tool: "police_hq", price: 2500, upkeep: 3, effect: 2.3, house: 3 },
  ] },
  // Fire: a fire post, the old station, a disaster relief centre
  fire: { centre: FIRESTATION, size: 3, base: 2, levels: [
    { tool: "fire_post", price: 250, upkeep: 0.5, effect: 0.5, house: 0 },
    { tool: "fire", price: 500, upkeep: 1, effect: 1, house: 0 },
    { tool: "fire_centre", price: 1500, upkeep: 2, effect: 1.8, house: 2 },
  ] },
} as const satisfies Record<string, LevelGroup>;

export type LevelGroupName = keyof typeof LEVEL_GROUPS;
export const LEVEL_GROUP_NAMES = Object.keys(LEVEL_GROUPS) as LevelGroupName[];

/** The tool that raises a building one level */
export const BUILDING_UPGRADE_TOOL = "building_upgrade";

/** Every tool that builds a level, the original ones (police, fire) among them */
export const LEVEL_TOOLS: readonly string[] = LEVEL_GROUP_NAMES.flatMap((group) =>
  LEVEL_GROUPS[group].levels.map((level) => level.tool));

/** The group and level a tool builds, or null */
export function levelOfTool(tool: string): { group: LevelGroupName; level: number } | null {
  for (const group of LEVEL_GROUP_NAMES) {
    const index = LEVEL_GROUPS[group].levels.findIndex((level) => level.tool === tool);
    if (index >= 0) return { group, level: index + 1 };
  }
  return null;
}

/** The group a centre tile belongs to, or null */
export function groupOfCentre(value: number): LevelGroupName | null {
  return LEVEL_GROUP_NAMES.find((group) => LEVEL_GROUPS[group].centre === value) ?? null;
}

export function levelSpec(group: LevelGroupName, level: number): LevelSpec {
  const levels: readonly LevelSpec[] = LEVEL_GROUPS[group].levels;
  return levels[Math.max(1, Math.min(levels.length, level)) - 1];
}

export interface LevelMap {
  width: number;
  buildingLevels?: Record<string, number> | null;
}

/** The level of the building centred at (x, y) */
export function buildingLevelAt(map: LevelMap, x: number, y: number, group: LevelGroupName): number {
  const recorded = map.buildingLevels?.[y * map.width + x];
  return recorded ? Math.max(1, Math.min(LEVEL_GROUPS[group].levels.length, recorded)) : LEVEL_GROUPS[group].base;
}

/** What the building centred at (x, y) does, as a share of the original building's */
export function levelEffect(map: LevelMap, x: number, y: number, group: LevelGroupName): number {
  return levelSpec(group, buildingLevelAt(map, x, y, group)).effect;
}

/** ... and what it costs to keep, as a share */
export function levelUpkeep(map: LevelMap, x: number, y: number, group: LevelGroupName): number {
  return levelSpec(group, buildingLevelAt(map, x, y, group)).upkeep;
}

/** The price of raising a building from this level to the next, or null at the top */
export function levelUpgradeCost(group: LevelGroupName, level: number): number | null {
  const levels: readonly LevelSpec[] = LEVEL_GROUPS[group].levels;
  return level >= levels.length ? null : levels[level].price - levels[level - 1].price;
}

/** Why a level's tool may not be used yet, or null: the higher levels need a higher ruler's house (the schools'
 * reason, src/services.ts) */
export function levelProblem(tool: string, houseLevel: number): string | null {
  const found = levelOfTool(tool);
  return found && levelSpec(found.group, found.level).house > houseLevel ? NEEDS_HOUSE_LEVEL : null;
}

/** The records kept only where their building still stands, as a save keeps them */
export function levelsStanding(map: LevelMap & { getTileValue(x: number, y: number): number; testBounds(x: number, y: number): boolean }):
    Record<string, number> | undefined {
  const kept: Record<string, number> = {};
  for (const [index, level] of Object.entries(map.buildingLevels ?? {})) {
    const i = Number(index), x = i % map.width, y = (i - x) / map.width;
    if (map.testBounds(x, y) && groupOfCentre(map.getTileValue(x, y)) !== null) kept[index] = level;
  }
  return Object.keys(kept).length ? kept : undefined;
}

/** The building with a level that covers (x, y): its centre and group, or null */
export function buildingAt(map: LevelMap & { getTileValue(x: number, y: number): number; testBounds(x: number, y: number): boolean },
  x: number, y: number): { x: number; y: number; group: LevelGroupName } | null {
  for (const group of LEVEL_GROUP_NAMES) {
    const { centre, size } = LEVEL_GROUPS[group];
    // The centre is one tile in from the building's top-left corner, so it covers centre − 1 … centre + size − 2
    for (let cy = y - (size - 2); cy <= y + 1; cy++) for (let cx = x - (size - 2); cx <= x + 1; cx++) {
      if (map.testBounds(cx, cy) && map.getTileValue(cx, cy) === centre) return { x: cx, y: cy, group };
    }
  }
  return null;
}
