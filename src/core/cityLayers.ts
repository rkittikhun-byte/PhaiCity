/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's core (docs/CORE_DESIGN.md): the records a city keeps beside its tiles, read from a save and written to
// one, and the parts of the city that player commands change (src/cityCommands.ts). The game (src/game.js), the
// headless city (src/core/cityCore.ts), tests and later the server all build a city the same way from here, so a
// command does the same thing everywhere. Plain code: no DOM.

import type { CommandTarget } from "../cityCommands.js";
import { decodePresetLayer, encodePresetLayer } from "../geo/presetMap.js";
import { blockColumns, blockRows, isCityMap, ownsLand, startingBlocks } from "../landBlocks.js";
import { readPolicies } from "../policies.js";
import { newRoadLevels } from "../roadLevels.js";
import { levelsStanding } from "../buildingLevels.js";
import { readZoneCells, writeZoneCells } from "../zoneCells.js";
import { HOUSE_KIND, houseStanding, readHouse } from "../rulerHouse.js";
import { CIVIC, LASTRAIL, MINE, POWERPLANT, RAILBASE, STATION, WASTE, WATER_HIGH, WATER_LOW } from "../tileValues.js";

/* The map, the simulation and the tools are still the original JavaScript (src/gameMap.js, src/simulation.js,
 * src/gameTools.js), so they are typed loosely here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = any;

/** What the city's host does when the core asks: the game moves its view; a headless city does nothing. */
export interface CityHooks {
  /** The ruler's rank, 0 (หมื่น) and up (src/rulerRank.ts RANKS) */
  rank?(): number;
  /** The ruler's house went up at (x, y): the city's centre and the view's home */
  houseBuilt?(x: number, y: number): void;
}

/** Reads the records kept beside a saved city's tiles onto its map, or starts them afresh for a new city. */
export function readCityLayers(map: Legacy, saved: Legacy | null): void {
  if (saved) {
    // A whole-province map: which tiles are the province's and its town (docs/geo/GEO_SPEC.md section 10)
    map.insideProvince = saved.inside ? decodePresetLayer(saved.inside, map.width, map.height) : null;
    map.town = saved.town || null;
    // The roads and railways the map started with, which are the state's (src/gameMap.js isNationalTransport)
    map.nationalTransport = saved.national ? decodePresetLayer(saved.national, map.width, map.height) : null;
    // What kind of power plant stands where (src/powerPlants.ts); plants from before the kinds are lignite
    map.powerKinds = Object.assign({}, saved.powerKinds || {});
    // ... and what each mine digs (src/mining.ts)
    map.mineKinds = Object.assign({}, saved.mineKinds || {});
    // ... and each road's level (src/roadLevels.ts); roads from before the levels are laterite
    map.roadLevels = saved.roadLevels ? decodePresetLayer(saved.roadLevels, map.width, map.height) : null;
    // The ground's heights come from the province's map, not the save (src/splashScreen.js savedCityHeights)
    map.heights = saved.heights || null;
    map.tileSizeM = saved.tileSizeM || null;
    // ... and the civic buildings, the ruler's house first (src/rulerHouse.ts); a city saved before the house was in
    // the game is not held back by it
    map.civicKinds = Object.assign({}, saved.civicKinds || {});
    // ... and the rubbish and wastewater buildings (src/waste.ts)
    map.wasteKinds = Object.assign({}, saved.wasteKinds || {});
    map.rulerHouse = readHouse(saved.rulerHouse);
    // ... and the ruler's policies (src/policies.ts)
    map.policies = readPolicies(saved.policies);
    // ... and the stations (src/transit.ts)
    map.stationKinds = Object.assign({}, saved.stationKinds || {});
    // ... and the levels of the ruler's buildings (src/buildingLevels.ts); those from before the levels are at their base
    map.buildingLevels = Object.assign({}, saved.buildingLevels || {});
    // ... and where buildings beside a road are drawn, slid along it (src/game.js buildingPose)
    map.buildingPoses = Object.assign({}, saved.buildingPoses || {});
    // ... and, on a map whose zones go a cell at a time, its painted cells (src/zoneCells.ts)
    map.cellZones = saved.cellZones === true;
    map.zoneCells = readZoneCells(saved.zoneCells);
    // ... and the land the city owns; a city saved before the blocks owns all of it (src/landBlocks.ts)
    map.landBlocks = saved.land ? decodePresetLayer(saved.land, blockColumns(map), blockRows(map)) : null;
    map.landBought = saved.landBought || 0;
    map.needsRulerHouse = saved.needsRulerHouse === true;
  } else {
    // A new city builds its ruler's house before anything else
    map.civicKinds = {};
    map.wasteKinds = {};
    map.policies = [];
    map.stationKinds = {};
    map.buildingLevels = {};
    // A new province city owns the land round its town, and buys the rest block by block (src/landBlocks.ts)
    map.landBlocks = map.insideProvince && map.town ? startingBlocks(map, map.town) : null;
    map.landBought = 0;
    map.rulerHouse = null;
    map.needsRulerHouse = true;
  }
  // Homes, shops and factories are painted tile by tile on a real-scale city map (src/plots.ts, docs/ZONE_PAINT.md)
  // ... and on a whole district's map, which says so whatever the size of its tiles (scripts/geo/cityMaps.mjs)
  map.paintedZones = map.paintedZones === true || isCityMap(map) || (saved !== null && saved.paintedZones === true);
}

/** The records every city has, whatever made it (a practice map has none of them yet) */
export function ensureCityLayers(map: Legacy): void {
  map.powerKinds = map.powerKinds || {};
  map.mineKinds = map.mineKinds || {};
  map.roadLevels = map.roadLevels || newRoadLevels(map.width, map.height);
  map.civicKinds = map.civicKinds || {};
  map.wasteKinds = map.wasteKinds || {};
  map.policies = map.policies || [];
  map.stationKinds = map.stationKinds || {};
  map.buildingLevels = map.buildingLevels || {};
  map.buildingPoses = map.buildingPoses || {};
  map.zoneCells = map.zoneCells || new Map();
}

/** A kind record (powerKinds …) kept only where its building still stands */
export function plantsStanding(map: Legacy, field: string, centre: number): Record<string, string> {
  const kinds: Record<string, string> = {};
  const record: Record<string, string> = map[field] || {};
  for (const index of Object.keys(record)) {
    const i = Number(index), x = i % map.width, y = (i - x) / map.width;
    if (map.testBounds(x, y) && map.getTileValue(x, y) === centre) kinds[index] = record[index];
  }
  return kinds;
}

/** Where buildings are drawn, kept only where a building's centre still stands */
function posesStanding(map: Legacy): Record<string, [number, number, number]> | undefined {
  const kept: Record<string, [number, number, number]> = {};
  for (const [index, pose] of Object.entries(map.buildingPoses || {})) {
    const i = Number(index), x = i % map.width, y = (i - x) / map.width;
    if (map.testBounds(x, y) && map.getTile(x, y).isZone()) kept[index] = pose as [number, number, number];
  }
  return Object.keys(kept).length ? kept : undefined;
}

/** The records kept beside the tiles, as a save keeps them (run-length encoded like the map) */
export function writeCityLayers(map: Legacy): Record<string, unknown> {
  return {
    // A whole-province map's own tiles and town
    inside: map.insideProvince ? encodePresetLayer(map.insideProvince) : undefined,
    town: map.town || undefined,
    national: map.nationalTransport ? encodePresetLayer(map.nationalTransport) : undefined,
    powerKinds: plantsStanding(map, "powerKinds", POWERPLANT),
    mineKinds: plantsStanding(map, "mineKinds", MINE),
    // The ruler's house, its wings, and whether a new city still has to build it (src/rulerHouse.ts)
    civicKinds: plantsStanding(map, "civicKinds", CIVIC),
    // ... and the rubbish and wastewater buildings (src/waste.ts)
    wasteKinds: plantsStanding(map, "wasteKinds", WASTE),
    // ... and the ruler's policies (src/policies.ts)
    policies: (map.policies || []).length ? map.policies.slice() : undefined,
    // ... and the stations (src/transit.ts)
    stationKinds: plantsStanding(map, "stationKinds", STATION),
    // ... and the levels of the ruler's buildings (src/buildingLevels.ts)
    buildingLevels: levelsStanding(map),
    buildingPoses: posesStanding(map),
    // ... and its zone cells (src/zoneCells.ts)
    cellZones: map.cellZones ? true : undefined,
    zoneCells: map.cellZones ? writeZoneCells(map.zoneCells) : undefined,
    // ... and the land the city owns (src/landBlocks.ts)
    land: map.landBlocks ? encodePresetLayer(map.landBlocks) : undefined,
    landBought: map.landBlocks ? map.landBought || 0 : undefined,
    rulerHouse: houseStanding(map) ? map.rulerHouse : undefined,
    needsRulerHouse: map.needsRulerHouse ? true : undefined,
    roadLevels: map.roadLevels ? encodePresetLayer(map.roadLevels) : undefined,
    // ... and whether its zones are painted tile by tile (src/plots.ts)
    paintedZones: map.paintedZones ? true : undefined,
  };
}

/** Whether a tile may be built on: on a whole-province map only the province's own tiles may */
export function canBuildIn(map: Legacy): (x: number, y: number) => boolean {
  return (x, y) => {
    const inside = map.insideProvince;
    return !inside || inside[x + y * map.width] === 1;
  };
}

/** The parts of the city that player commands change (src/cityCommands.ts), the same in the game and without it */
export function commandTarget(map: Legacy, simulation: Legacy, tools: Legacy, setAutoBulldoze: (on: boolean) => void,
  hooks: CityHooks = {}): CommandTarget {
  ensureCityLayers(map);
  return {
    width: map.width,
    height: map.height,
    tools,
    get blockMaps() { return simulation.blockMaps; },
    budget: simulation.budget,
    disasters: simulation.disasterManager,
    sprites: simulation.spriteManager,
    setSpeed: (speed: number) => simulation.setSpeed(speed),
    setAutoBulldoze,
    // For undo: the map to put back, and the time, as only recent building can be undone
    map,
    cityTime: () => simulation._cityTime,
    canBuildAt: canBuildIn(map),
    ownsLand: (x: number, y: number) => ownsLand(map, x, y),
    // The kinds of power plant the province can build, dams beside water, and what was built where
    resources: simulation.resources,
    isWaterAt: (x: number, y: number) => {
      if (!map.testBounds(x, y)) return false;
      const value = map.getTileValue(x, y);
      return value >= WATER_LOW && value <= WATER_HIGH;
    },
    setPowerKind: (x: number, y: number, kind: string) => { map.powerKinds[y * map.width + x] = kind; },
    setMineKind: (x: number, y: number, kind: string) => { map.mineKinds[y * map.width + x] = kind; },
    setRoadLevel: (x: number, y: number, level: number) => { map.roadLevels[y * map.width + x] = level; },
    // The ruler's house (src/rulerHouse.ts): a new city builds it first, and its next level needs the ruler's rank
    houseMap: map,
    rank: () => hooks.rank?.() ?? 0,
    // ... and the schools and hospitals on the same civic tiles (src/services.ts)
    setCivicKind: (x: number, y: number, kind: string) => { map.civicKinds[y * map.width + x] = kind; },
    // ... and the rubbish and wastewater buildings (src/waste.ts)
    setWasteKind: (x: number, y: number, kind: string) => { map.wasteKinds[y * map.width + x] = kind; },
    // ... and the stations, which train and high-speed stations put beside a railway (src/transit.ts)
    setStationKind: (x: number, y: number, kind: string) => { map.stationKinds[y * map.width + x] = kind; },
    // ... and the level of a building that has levels (src/buildingLevels.ts)
    setBuildingLevel: (x: number, y: number, level: number) => { map.buildingLevels[y * map.width + x] = level; },
    setBuildingPose: (x: number, y: number, pose: [number, number, number]) => { map.buildingPoses[y * map.width + x] = pose; },
    isRailAt: (x: number, y: number) => {
      if (!map.testBounds(x, y)) return false;
      const value = map.getTileValue(x, y);
      return value >= RAILBASE && value <= LASTRAIL;
    },
    setRulerHouse: (x: number, y: number) => {
      map.civicKinds[y * map.width + x] = HOUSE_KIND;
      map.rulerHouse = { x, y, level: 1, wings: [] };
      // The camera's start and ⌂ follow the house
      map.town = { x, y };
      hooks.houseBuilt?.(x, y);
    },
  } as CommandTarget;
}
