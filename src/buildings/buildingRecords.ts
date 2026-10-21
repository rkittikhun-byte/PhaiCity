/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every ruler's building on the map in gameMap.buildings (docs/METRE_DRAWING_PLAN.md 2.6): a save keeps each one there
// with the kind and level recorded for it, in place of the records kept by tile (powerKinds, mineKinds, civicKinds,
// wasteKinds, stationKinds, buildingLevels) and the poses kept beside them (buildingPoses). The game still reads those
// records by tile; a save writes them from the buildings and opening one writes them back. A building put down before
// the buildings were kept (an older save, a tool command) is taken from its tiles once, where its pose said it is drawn.
// Plain code, no DOM.

import { groupOfCentre, LEVEL_GROUPS } from "../buildingLevels";
import { MINE_TOOLS } from "../mining";
import { PLANT_TOOLS } from "../powerPlants";
import { SERVICE_KINDS } from "../services";
import { STATION_KINDS } from "../transit";
import { WASTE_KINDS } from "../waste";
import { NUCLEAR_KIND } from "../plantBlocks";
import { AIRPORT, CIVIC, FARM, FIRESTATION, FULLSTADIUM, HARBOUR, MINE, NUCLEAR, PLANT2, PLANT3, POLICESTATION, PORT, POWERPLANT, STADIUM,
  STATION, WASTE, WATER_TOWER, WATER_WORKS } from "../tileValues";
import { tileMetres, unitsPerMetre } from "../units";
import { type PlacedBuilding, PlacedBuildings } from "./placedBuildings";

/** The record kept by centre tile for which kind of building stands on a centre of this value */
export const KIND_FIELDS: Readonly<Record<number, string>> = {
  [POWERPLANT]: "powerKinds", [PLANT3]: "powerKinds", [PLANT2]: "powerKinds", [MINE]: "mineKinds", [CIVIC]: "civicKinds", [WASTE]: "wasteKinds", [STATION]: "stationKinds",
};

/** The ruler's buildings by the value of their centre tile: the tool that builds the plain one, and its size */
const CENTRES: ReadonlyMap<number, { tool: string; size: number }> = new Map([
  [AIRPORT, { tool: "airport", size: 6 }], [POWERPLANT, { tool: "coal", size: 4 }], [NUCLEAR, { tool: "nuclear", size: 4 }],
  // (the plants on only the tiles their model covers, src/plantBlocks.ts)
  [PLANT3, { tool: "coal", size: 3 }], [PLANT2, { tool: "solar", size: 2 }],
  [MINE, { tool: "limestone_mine", size: 3 }], [FARM, { tool: "farm", size: 3 }], [HARBOUR, { tool: "fishing", size: 3 }],
  [FIRESTATION, { tool: "fire", size: 3 }], [POLICESTATION, { tool: "police", size: 3 }], [PORT, { tool: "port", size: 4 }],
  [CIVIC, { tool: "ruler_house", size: 3 }], [STADIUM, { tool: "stadium", size: 4 }], [FULLSTADIUM, { tool: "stadium", size: 4 }],
  [WATER_WORKS, { tool: "waterworks", size: 3 }], [WATER_TOWER, { tool: "watertower", size: 1 }],
  [WASTE, { tool: "landfill", size: 3 }], [STATION, { tool: "train_station", size: 3 }],
]);

/** The tool that built the building on a centre tile of this value, by the kind and level recorded for it, and its
 * size; null when no building of the ruler's has such a centre */
export function toolOfCentre(value: number, kind?: string | null, level?: number | null): { tool: string; size: number } | null {
  const centre = CENTRES.get(value);
  if (!centre) return null;
  let tool = centre.tool;
  if (kind && (value === POWERPLANT || value === PLANT3 || value === PLANT2))
    tool = kind === NUCLEAR_KIND ? "nuclear" : PLANT_TOOLS[kind as keyof typeof PLANT_TOOLS] ?? tool;
  else if (kind && value === MINE) tool = MINE_TOOLS[kind as keyof typeof MINE_TOOLS] ?? tool;
  else if (kind && (value === CIVIC || value === WASTE || value === STATION)) tool = kind;
  const group = groupOfCentre(value);
  if (group && level) tool = LEVEL_GROUPS[group].levels[level - 1]?.tool ?? tool;
  return { tool, size: centre.size };
}

/** What of a map the buildings are read from and written to (src/gameMap.js, typed loosely) */
export interface BuildingMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  getTileValue(x: number, y: number): number;
  getTile(x: number, y: number): { isZone(): boolean };
  buildings?: PlacedBuildings | null;
  buildingLevels?: Record<string, number> | null;
  [record: string]: unknown;
}

const recordOf = (map: BuildingMap, field: string): Record<string, string> | null =>
  (map[field] as Record<string, string> | null | undefined) ?? null;

/**
 * Puts every ruler's building standing on the map into map.buildings that is not there yet: taken from its centre tile,
 * the kind and level recorded for it, and where the pose kept for it says it is drawn ([x, z, turn] in world units,
 * src/core/cityLayers.ts), else its block's middle, not yet turned. Those already there are left as they are.
 */
export function completeBuildings(map: BuildingMap, poses?: Readonly<Record<string, readonly number[]>> | null): PlacedBuildings {
  const placed = map.buildings ??= new PlacedBuildings();
  const metres = tileMetres(map), units = unitsPerMetre(metres);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const value = map.getTileValue(x, y);
    if (!CENTRES.has(value)) continue;
    const i = y * map.width + x;
    if (placed.atTile(i)) continue;
    const field = KIND_FIELDS[value];
    const found = toolOfCentre(value, field ? recordOf(map, field)?.[i] : null, map.buildingLevels?.[i]);
    if (!found || found.size > 1 && !map.getTile(x, y).isZone()) continue;
    const pose = poses?.[i], corner = found.size > 1 ? 1 : 0;
    const usable = Array.isArray(pose) && pose.length >= 3 && pose.slice(0, 3).every((n) => typeof n === "number" && Number.isFinite(n));
    placed.add({ tool: found.tool, size: found.size, tile: i,
      x: usable ? pose![0] / units : (x - corner + found.size / 2) * metres,
      z: usable ? pose![1] / units : (y - corner + found.size / 2) * metres,
      rot: usable ? pose![2] : null });
  }
  return placed;
}

/** Whether the building is still standing on its tiles (a bulldozed one's tiles blow up first) */
function standing(map: BuildingMap, b: PlacedBuilding): boolean {
  const x = b.tile % map.width, y = Math.floor(b.tile / map.width);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (b.size > 1) return map.getTile(x, y).isZone() && CENTRES.has(map.getTileValue(x, y));
  return CENTRES.has(map.getTileValue(x, y));
}

/** The buildings as a save keeps them: those standing, each with the kind recorded for it ("" none) and its level (0
 * none) after [id, tool, x, z, rot, size, tile]; `all` says the list holds every building, so the records kept by tile
 * are written from it */
export function writeBuildings(map: BuildingMap): { buildings: unknown[][]; next: number; all: true } | undefined {
  const placed = completeBuildings(map);
  if (!placed.size) return undefined;
  const json = placed.toJSON((b) => standing(map, b), (b) => {
    const value = map.getTileValue(b.tile % map.width, Math.floor(b.tile / map.width)), field = KIND_FIELDS[value];
    return [(field && recordOf(map, field)?.[b.tile]) || "", map.buildingLevels?.[b.tile] || 0];
  });
  return json.buildings.length ? { ...json, all: true } : undefined;
}

/** The records kept by tile written back from a save's buildings, when it holds every one of them (writeBuildings) */
export function readBuildingRecords(map: BuildingMap, saved: unknown): void {
  const data = saved as { buildings?: unknown; all?: unknown } | null;
  if (!data || data.all !== true || !Array.isArray(data.buildings)) return;
  for (const row of data.buildings) {
    if (!Array.isArray(row) || typeof row[1] !== "string" || !Number.isInteger(row[6])) continue;
    const tile = row[6] as number, kind = row[7], level = row[8];
    if (typeof kind === "string" && kind) {
      const field = fieldOfTool(row[1]);
      if (field) ((map[field] ??= {}) as Record<string, string>)[tile] = kind;
    }
    if (typeof level === "number" && level > 0) (map.buildingLevels ??= {})[tile] = level;
  }
}

/** A record kept by tile moved from one tile to another: what was on `to` gives way to what was on `from`, which is
 * left with nothing; what moves it back and puts back what `to` had */
export function carryKey(record: Record<string, unknown>, from: number, to: number): () => void {
  const had = to in record, stale = record[to];
  if (from in record) record[to] = record[from];
  else delete record[to];
  delete record[from];
  return () => {
    if (to in record) record[from] = record[to];
    else delete record[from];
    if (had) record[to] = stale;
    else delete record[to];
  };
}

/** What a moved building's records are read from (src/gameMap.js, typed loosely) */
interface CarryMap extends BuildingMap {
  buildingEras?: Uint8Array | null;
  buildingErasVersion?: number;
  rulerHouse?: { x: number; y: number } | null;
  town?: { x: number; y: number } | null;
}

/**
 * Everything kept by a building's centre tile carried from the tile `from` to `to`, as the move command takes the
 * building to another block (docs/METRE_DRAWING_PLAN.md 2.5): its kind, its level and its era, and the ruler's house
 * with its wings, and the town that follows the house (the camera's start and ⌂). What carries them back.
 */
export function carryRecords(map: CarryMap, from: number, to: number): () => void {
  const backs: Array<() => void> = [];
  for (const field of [...new Set(Object.values(KIND_FIELDS)), "buildingLevels"]) {
    const record = map[field] as Record<string, unknown> | null | undefined;
    if (record) backs.push(carryKey(record, from, to));
  }
  const eras = map.buildingEras;
  if (eras instanceof Uint8Array && from < eras.length && to < eras.length) {
    const stale = eras[to];
    eras[to] = eras[from];
    eras[from] = 0;
    // (a count the 3D view watches to draw the buildings' eras again)
    map.buildingErasVersion = (map.buildingErasVersion ?? 0) + 1;
    backs.push(() => {
      eras[from] = eras[to];
      eras[to] = stale;
      map.buildingErasVersion = (map.buildingErasVersion ?? 0) + 1;
    });
  }
  const house = map.rulerHouse, width = map.width;
  if (house && house.y * width + house.x === from) {
    const town = map.town, follows = !!town && town.x === house.x && town.y === house.y;
    const tx = to % width, ty = Math.floor(to / width);
    map.rulerHouse = { ...house, x: tx, y: ty };
    if (follows) map.town = { x: tx, y: ty };
    backs.push(() => {
      const now = map.rulerHouse;
      if (now && now.x === tx && now.y === ty) map.rulerHouse = { ...now, x: house.x, y: house.y };
      if (follows) map.town = { x: house.x, y: house.y };
    });
  }
  return () => { for (const back of backs.reverse()) back(); };
}

/** The record by tile a tool's building keeps its kind in */
function fieldOfTool(tool: string): string | null {
  const among = (list: readonly string[]): boolean => list.includes(tool);
  // (a nuclear plant on a 3x3 keeps its kind too, src/plantBlocks.ts)
  if (among(Object.values(PLANT_TOOLS)) || tool === "nuclear") return "powerKinds";
  if (among(Object.values(MINE_TOOLS))) return "mineKinds";
  // (a temple too, which its community built, src/temples.ts)
  if (tool === "ruler_house" || tool === "temple" || among(SERVICE_KINDS)) return "civicKinds";
  if (among(WASTE_KINDS)) return "wasteKinds";
  if (among(STATION_KINDS)) return "stationKinds";
  return null;
}
