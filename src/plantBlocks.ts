/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A power plant takes the tiles its model covers (owner, 21 Oct 2026: "เอาแบบ B ให้ระบบจำลองกินที่เท่าตัวโมเดลจริง เริ่มที่
// โรงไฟฟ้ากับโรงประปา"; docs/POWER_PLANTS.md). Until then every plant took a 4 x 4 block (64 m on a city map) whatever
// was drawn on it: an era's model is 48 m across (3 tiles), a plant the program draws (solar, wind, a dam, a gas plant
// before its era's model, a lignite plant after its era's) some 30 m (2 tiles). A plant built now takes:
//
//   lignite  3 x 3 in eras 1-3 (the era's model), 2 x 2 in eras 4-5
//   gas      2 x 2 in eras 2-3, 3 x 3 in eras 4-5 (the era's model)
//   solar, wind, hydro  2 x 2
//   nuclear  3 x 3 (era 5's model)
//
// The 3 x 3 is tiles 870-878 (centre 874), the 2 x 2 tiles 1016-1019 (centre 1019, its bottom right), both laid as every
// building is (src/buildingTool.js: the centre at (1, 1) from the top left); the map records each plant's kind at its
// centre (gameMap.powerKinds), the nuclear plant's as "nuclear". A plant's power, fuel and smoke stay its kind's
// (src/powerPlants.ts), whatever its size. Plants built before keep their 4 x 4 (745-760, nuclear 811-826).
// The water works keeps its 3 x 3: its era's model is 48 m on every era (docs/WATER_PLAN.md).

import { mapEra } from "./era";
import { PLANT2, PLANT2_BASE, PLANT2_LAST, PLANT3, PLANT3_BASE, PLANT3_LAST } from "./tileValues";

/** The kinds a plant may be, as gameMap.powerKinds records them: the power kinds and the nuclear plant */
export const NUCLEAR_KIND = "nuclear";
export type PlantSize = 2 | 3;

/** The size a kind of plant built in an era takes: 3 x 3 where its era draws it with the era's model, else 2 x 2 */
export function plantBlockSize(kind: string, era: number): PlantSize {
  if (kind === NUCLEAR_KIND) return 3;
  if (kind === "lignite") return era <= 3 ? 3 : 2;
  if (kind === "gas") return era >= 4 ? 3 : 2;
  return 2;
}

/** The centre tile value of a plant block of a size */
export const plantCentre = (size: PlantSize): number => size === 3 ? PLANT3 : PLANT2;

/** The block a tile value belongs to: its size, first tile and centre; null for any other tile */
export function plantBlockOf(value: number): { size: PlantSize; base: number; centre: number } | null {
  if (value >= PLANT3_BASE && value <= PLANT3_LAST) return { size: 3, base: PLANT3_BASE, centre: PLANT3 };
  if (value >= PLANT2_BASE && value <= PLANT2_LAST) return { size: 2, base: PLANT2_BASE, centre: PLANT2 };
  return null;
}

/** Whether a tile value is the centre of a sized plant (not the old 4 x 4s) */
export const isPlantCentre = (value: number): boolean => value === PLANT3 || value === PLANT2;

/** The centre of the sized plant whose tile (x, y) has this value, or null */
export function plantCentreOf(x: number, y: number, value: number): { x: number; y: number } | null {
  const block = plantBlockOf(value);
  if (!block) return null;
  const index = value - block.base;
  return { x: x - (index % block.size) + 1, y: y - Math.floor(index / block.size) + 1 };
}

/** What a building tool is to a sized plant: its kind, its map, and what it lays */
interface PlantTool { powerKind?: string; size: number; centreTile: number; _map?: { era?: unknown } }

/**
 * Makes a power tool lay the block its kind takes in the city's era now: its size and centre are read each time from
 * the map's era (src/era.ts), so the outline under the mouse, the commands' checks, the building kept in metres and
 * the auto player all see the size it will build.
 */
export function sizePlantTool(tool: PlantTool, kind: string): void {
  tool.powerKind = kind;
  Object.defineProperty(tool, "size", {
    configurable: true, enumerable: true,
    get(this: PlantTool) { return plantBlockSize(kind, mapEra(this._map ?? null)); },
    set() { /* its era says */ },
  });
  Object.defineProperty(tool, "centreTile", {
    configurable: true, enumerable: true,
    get(this: PlantTool) { return plantCentre(plantBlockSize(kind, mapEra(this._map ?? null))); },
    set() { /* its era says */ },
  });
}
