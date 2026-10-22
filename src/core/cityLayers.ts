/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The game's core (docs/CORE_DESIGN.md): the records a city keeps beside its tiles, read from a save and written to
// one, and the parts of the city that player commands change (src/cityCommands.ts). The game (src/game.js), the
// headless city (src/core/cityCore.ts), tests and later the server all build a city the same way from here, so a
// command does the same thing everywhere. Plain code: no DOM.

import type { CommandTarget } from "../cityCommands.js";
import { decodePresetLayer, decodePresetLayerWide, encodePresetLayer } from "../geo/presetMap.js";
import { blockColumns, blockRows, isCityMap, ownsLand, startingBlocks } from "../landBlocks.js";
import { readPolicies } from "../policies.js";
import { isRoadTile, newRoadLevels } from "../roadLevels.js";
import { MAX_ROAD_PIECE, newRoadPieces, nextRoadPiece, readRoadPaths, roadPathsKept } from "../roadPieces.js";
import { RoadGraph } from "../roads/roadGraph.js";
import { PlacedBuildings } from "../buildings/placedBuildings.js";
import { carryKey, carryRecords, readBuildingRecords, writeBuildings } from "../buildings/buildingRecords.js";
import { segmentStands } from "../roads/roadRaster.js";
import { isAnyRail, isAnyRoad } from "../roadTiles.js";
import { tileMetres } from "../units.js";
import { canalMarkStands, canalsKept, isBridgeTile, isWaterTile, newCanals } from "../canals.js";
import { readZoneCells, writeZoneCells } from "../zoneCells.js";
import { farmKindsKept } from "../farmZone.js";
import { HOUSE_KIND, houseStanding, readHouse } from "../rulerHouse.js";
import { isEra } from "../era.js";
import { readWeather } from "../weather.js";
import { calendarOf, newFestivalState, readFestivals, writeFestivals } from "../festivals.js";
import { newTrainedState, readTrained, writeTrained } from "../trainedPeople.js";
import { unlockCity } from "../unlocks.js";
import { readSites, startSite, writeSites } from "../construction.js";
import { modeRule } from "../gameModes.js";
import { newTempleState, readTemples, writeTemples } from "../temples.js";
import { LASTRAIL, RAILBASE, WATER_HIGH, WATER_LOW } from "../tileValues.js";
import { savedSimVersion, SIM_VERSION } from "../sim/simVersion.js";

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
  // The rules of the simulation it was last played with (src/sim/simVersion.ts); a new city is played with today's
  map.simVersion = saved ? savedSimVersion(saved) : SIM_VERSION;
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
    // ... and the drawn line each road tile was laid by (src/roadPieces.ts); roads from before the pieces are 0
    map.roadPieces = saved.roadPieces ? decodePresetLayerWide(saved.roadPieces, map.width, map.height) : null;
    // ... and the tiles each piece was drawn along, which set its shape for good
    map.roadPaths = readRoadPaths(saved.roadPaths);
    // ... and the roads and railways as drawn, in metres (src/roads/roadGraph.ts, docs/METRE_DRAWING_PLAN.md)
    map.roadGraph = readGraph(saved.roads);
    map.railGraph = readGraph(saved.rails);
    // ... and the canals drawn in metres, their graph of their own (docs/CANALS.md)
    map.canalGraph = readGraph(saved.canalLines);
    // ... and the ruler's buildings where they were put down, in metres (src/buildings/placedBuildings.ts)
    map.buildings = saved.buildings ? PlacedBuildings.fromJSON(saved.buildings) : null;
    // ... and the canals the player dug (src/canals.ts)
    map.canals = saved.canals ? decodePresetLayer(saved.canals, map.width, map.height) : null;
    // The ground's heights come from the province's map, not the save (src/splashScreen.js savedCityHeights)
    map.heights = saved.heights || null;
    map.tileSizeM = saved.tileSizeM || null;
    // The city's era, its last months' scores and each building's era (src/eraScore.ts); a city saved before the era
    // score has none, and the game gives it the era of its rank
    map.era = isEra(saved.era) ? saved.era : undefined;
    map.eraHistory = Array.isArray(saved.eraHistory) ? saved.eraHistory.filter((v: unknown) => typeof v === "number") : [];
    map.eraDawn = saved.eraDawn === true;
    map.buildingEras = saved.buildingEras ? decodePresetLayer(saved.buildingEras, map.width, map.height) : null;
    // ... and the frame of its district it plays (src/cityFrame.ts), null on a map that is not a frame
    map.frame = saved.frame || null;
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
    // ... all of which a save from step 2.6 on keeps with its buildings (src/buildings/buildingRecords.ts); where an
    // older one's buildings are drawn (buildingPoses) goes into them once its tiles are in (cityCore.ts completeBuildings)
    readBuildingRecords(map, saved.buildings);
    // ... and where its buses run (src/busStopTool.ts)
    map.buses = Array.isArray(saved.buses) ? saved.buses.filter((i: unknown) => Number.isInteger(i)) : [];
    // ... and, on a map whose zones go a cell at a time, its painted cells (src/zoneCells.ts)
    map.cellZones = saved.cellZones === true;
    map.zoneCells = readZoneCells(saved.zoneCells);
    // ... and the kind of each farm zone field (src/farmZone.ts)
    map.farmKinds = saved.farmKinds ? decodePresetLayer(saved.farmKinds, map.width, map.height) : null;
    // ... and the land the city owns; a city saved before the blocks owns all of it (src/landBlocks.ts)
    map.landBlocks = saved.land ? savedLand(map, saved.land) : null;
    map.landBought = saved.landBought || 0;
    map.needsRulerHouse = saved.needsRulerHouse === true;
    // ... and the month's weather (src/weather.ts); a city saved before the weather starts its own (src/simulation.js)
    map.weather = readWeather(saved.weather);
    // ... and the festivals: the ruler's answers, this month's and their afterglow (src/festivals.ts)
    map.festivals = readFestivals(saved.festivals);
    // ... and the people its schools trained (src/trainedPeople.ts)
    map.trained = readTrained(saved.trained);
    // ... and its buildings still being built (src/construction.ts)
    map.sites = readSites(saved.sites);
    // ... and its temples, which its communities built (src/temples.ts)
    map.temples = readTemples(saved.temples);
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
  // The next drawn line's number is found again from the map's (src/roadPieces.ts)
  map.nextRoadPiece = 0;
}

/** A saved road or rail graph (RoadGraph toJSON), or null for none or one that does not read */
function readGraph(saved: unknown): RoadGraph | null {
  if (!saved || typeof saved !== "object") return null;
  try {
    const graph = RoadGraph.fromJSON(saved as ReturnType<RoadGraph["toJSON"]>);
    return graph.segments.size ? graph : null;
  } catch {
    return null;
  }
}

/** A road or rail graph as a save keeps it: the strokes whose every segment still lies on roads (or railways), those
 * bulldozed in part being their tiles' lines from then on (src/roads/graphLines.ts), and every segment of no stroke (a
 * map's own roads, src/roads/roadCover.ts), which the view draws from their tiles anyway and which are cut where their
 * tiles go (src/roads/roadCut.ts), so a city opened from its save goes on with the very graph it had */
function graphKept(map: Legacy, graph: RoadGraph | null | undefined, kind: (value: number) => boolean):
  ReturnType<RoadGraph["toJSON"]> | undefined {
  if (!graph || !graph.segments.size) return undefined;
  const raster = { width: map.width, height: map.height, tileSizeM: tileMetres(map) };
  const standing = (id: number): boolean =>
    segmentStands(graph, id, raster, (i) => kind(map.getTileValue(i % map.width, Math.floor(i / map.width))));
  const gone = new Set<number>();
  for (const id of graph.segments.keys()) {
    const piece = graph.segment(id).piece;
    if (piece !== undefined && !standing(id)) gone.add(piece);
  }
  const kept = RoadGraph.fromJSON(graph.toJSON());
  for (const [id, s] of [...kept.segments]) if (s.piece !== undefined && gone.has(s.piece)) kept.remove(id);
  return kept.segments.size ? kept.toJSON() : undefined;
}

/** A saved city's land blocks. Saves before 15 Oct 2026 did not keep the size of a city map's tiles, so their 32-tile
 * blocks read as a province map's 24: such a save's land that only reads as 32-tile blocks is a city map's */
function savedLand(map: Legacy, land: string): Uint8Array {
  try {
    return decodePresetLayer(land, blockColumns(map), blockRows(map));
  } catch (error) {
    if (map.tileSizeM) throw error;
    const city = { width: map.width, height: map.height, tileSizeM: 16 };
    const blocks = decodePresetLayer(land, blockColumns(city), blockRows(city));
    map.tileSizeM = 16;
    return blocks;
  }
}

/** The records every city has, whatever made it (a practice map has none of them yet) */
export function ensureCityLayers(map: Legacy): void {
  // Why each painted plot does not grow, which the scan fills (src/plots.ts PLOT_WHY); never saved
  if (map.paintedZones && map.plotWhy === undefined) map.plotWhy = null;
  map.powerKinds = map.powerKinds || {};
  map.mineKinds = map.mineKinds || {};
  map.roadLevels = map.roadLevels || newRoadLevels(map.width, map.height);
  map.roadPieces = map.roadPieces || newRoadPieces(map.width, map.height);
  map.roadPaths = map.roadPaths || {};
  map.canals = map.canals || newCanals(map.width, map.height);
  map.civicKinds = map.civicKinds || {};
  map.wasteKinds = map.wasteKinds || {};
  map.policies = map.policies || [];
  map.stationKinds = map.stationKinds || {};
  map.buildingLevels = map.buildingLevels || {};
  map.buses = map.buses || [];
  map.zoneCells = map.zoneCells || new Map();
  map.festivals = map.festivals || newFestivalState();
  map.trained = map.trained || newTrainedState();
  map.sites = map.sites || {};
  map.temples = map.temples || newTempleState();
}

/** The pieces of the roads and railways on the map (src/roadPieces.ts) */
function piecesOnLines(map: Legacy): Set<number> {
  const pieces = new Set<number>(), layer = map.roadPieces;
  if (!layer) return pieces;
  for (let i = 0; i < layer.length; i++) {
    if (!layer[i]) continue;
    const value = map.getTileValue(i % map.width, Math.floor(i / map.width));
    if (isRoadTile(value) || value >= RAILBASE && value <= LASTRAIL) pieces.add(layer[i]);
  }
  return pieces;
}

function encodeFarmKinds(map: Legacy): string | undefined {
  const kept = farmKindsKept(map);
  return kept ? encodePresetLayer(kept) : undefined;
}

function encodeCanals(map: Legacy): string | undefined {
  const kept = canalsKept(map);
  return kept ? encodePresetLayer(kept) : undefined;
}

/** The records kept beside the tiles, as a save keeps them (run-length encoded like the map) */
export function writeCityLayers(map: Legacy): Record<string, unknown> {
  return {
    // A whole-province map's own tiles and town
    inside: map.insideProvince ? encodePresetLayer(map.insideProvince) : undefined,
    town: map.town || undefined,
    national: map.nationalTransport ? encodePresetLayer(map.nationalTransport) : undefined,
    // The kinds of power plant, mine, civic building, waste building and station, and the levels of the ruler's
    // buildings, are kept with the buildings (below, src/buildings/buildingRecords.ts)
    // The ruler's policies (src/policies.ts)
    policies: (map.policies || []).length ? map.policies.slice() : undefined,
    // ... and its buses, those whose road still stands
    buses: (map.buses || []).filter((i: number) => isRoadTile(map.getTileValue(i % map.width, Math.floor(i / map.width)))),
    // ... and its zone cells (src/zoneCells.ts)
    cellZones: map.cellZones ? true : undefined,
    zoneCells: map.cellZones ? writeZoneCells(map.zoneCells) : undefined,
    // ... and the kinds of its farm zone's fields (src/farmZone.ts)
    farmKinds: encodeFarmKinds(map),
    // ... and the land the city owns (src/landBlocks.ts)
    land: map.landBlocks ? encodePresetLayer(map.landBlocks) : undefined,
    landBought: map.landBlocks ? map.landBought || 0 : undefined,
    rulerHouse: houseStanding(map) ? map.rulerHouse : undefined,
    needsRulerHouse: map.needsRulerHouse ? true : undefined,
    roadLevels: map.roadLevels ? encodePresetLayer(map.roadLevels) : undefined,
    // ... and the drawn line each road tile was laid by (src/roadPieces.ts)
    roadPieces: map.roadPieces && map.roadPieces.some((piece: number) => piece > 0) ? encodePresetLayer(map.roadPieces) : undefined,
    roadPaths: roadPathsKept(map.roadPaths, piecesOnLines(map)),
    // ... and the roads and railways as drawn, in metres (src/roads/roadGraph.ts)
    roads: graphKept(map, map.roadGraph, isAnyRoad),
    rails: graphKept(map, map.railGraph, isAnyRail),
    // ... and the canals drawn in metres, on their water or the bridges over it
    canalLines: graphKept(map, map.canalGraph, (v) => isWaterTile(v) || isBridgeTile(v)),
    // ... and every ruler's building where it was put down, those still standing, each with its kind and level
    buildings: writeBuildings(map),
    // ... and the canals the player dug and each one's level, where they are still water or bridged (src/canals.ts)
    canals: encodeCanals(map),
    // ... and whether its zones are painted tile by tile (src/plots.ts)
    paintedZones: map.paintedZones ? true : undefined,
    // ... and the size of its tiles, which sets the size of its land blocks (src/landBlocks.ts)
    tileSizeM: map.tileSizeM || undefined,
    // ... and the frame of its district it plays (src/cityFrame.ts)
    frame: map.frame || undefined,
    // ... and its era, the last months' era scores and each building's era (src/eraScore.ts)
    era: isEra(map.era) ? map.era : undefined,
    eraHistory: Array.isArray(map.eraHistory) && map.eraHistory.length ? map.eraHistory.map((v: number) => Math.round(v * 1e4) / 1e4) : undefined,
    eraDawn: map.eraDawn ? true : undefined,
    buildingEras: map.buildingEras && map.buildingEras.some((e: number) => e > 0) ? encodePresetLayer(map.buildingEras) : undefined,
    // ... and the month's weather, with the seed of its chances (src/weather.ts)
    weather: map.weather ? { ...map.weather } : undefined,
    // ... and the festivals (src/festivals.ts)
    festivals: writeFestivals(map.festivals),
    // ... and the people its schools trained (src/trainedPeople.ts)
    trained: writeTrained(map.trained),
    // ... and its buildings still being built (src/construction.ts)
    sites: writeSites(map.sites),
    // ... and its temples (src/temples.ts)
    temples: writeTemples(map.temples),
    // ... and the rules of the simulation it is played with from now on (src/sim/simVersion.ts)
    simVersion: SIM_VERSION,
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
    // ... and the drawn line it belongs to, numbered on from the highest on the map (src/roadPieces.ts)
    newRoadPiece: () => {
      const piece = map.nextRoadPiece || nextRoadPiece(map.roadPieces);
      map.nextRoadPiece = Math.min(MAX_ROAD_PIECE, piece + 1);
      return piece;
    },
    setRoadPiece: (x: number, y: number, piece: number) => { map.roadPieces[y * map.width + x] = piece; },
    roadPieceAt: (x: number, y: number) => map.roadPieces[y * map.width + x] || 0,
    setRoadPath: (piece: number, path: unknown) => {
      if (path) map.roadPaths[piece] = path;
      else delete map.roadPaths[piece];
    },
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
    addBus: (x: number, y: number) => { map.buses.push(y * map.width + x); },
    // ... and the canals (src/canals.ts), after which the simulation works the ground's water out again
    // (a new dig starts at the first level, src/canals.ts; canalsVersion tells the 3D view to draw them again)
    setCanal: (x: number, y: number) => { map.canals[y * map.width + x] = 1; map.canalsVersion = (map.canalsVersion || 0) + 1; },
    canalAt: (x: number, y: number) => canalMarkStands(map, x, y),
    waterChanged: () => { map.groundChanged = true; map.canalsVersion = (map.canalsVersion || 0) + 1; },
    isRailAt: (x: number, y: number) => {
      if (!map.testBounds(x, y)) return false;
      const value = map.getTileValue(x, y);
      return value >= RAILBASE && value <= LASTRAIL;
    },
    // ... and what the city can build yet: its era, its trained people and its buildings (src/unlocks.ts)
    // (a sandbox city, as tests and the debug window may make one, can build anything at once: map.sandbox, not saved)
    // ... the trained people needed scaled by the city's mode (src/gameModes.ts)
    unlocks: () => (map.sandbox ? undefined : unlockCity(map, modeRule(simulation._gameLevel).trained)),
    // ... and a big building's months as a construction site (src/construction.ts)
    startSite: (x: number, y: number, tool: string) => (map.sandbox ? () => undefined : startSite(map, x, y, tool, simulation._cityTime,
      modeRule(simulation._gameLevel).buildTime)),
    // ... and the festivals the province keeps, and the ruler's answers (src/festivals.ts)
    festivals: { get state() { return map.festivals; }, calendar: () => calendarOf(simulation) },
    // ... and what is kept by a building's centre tile, carried along when the move command takes it to another block:
    // its records, a landfill's fill (src/waste.ts), and the view's home with the ruler's house
    carryBuilding: (from: number, to: number) => {
      const house = map.rulerHouse, backs = [carryRecords(map, from, to), carryKey(map.sites ??= {}, from, to)];
      const fill = simulation._waste?.fill;
      if (fill) backs.push(carryKey(fill, from, to));
      const moved = map.rulerHouse !== house;
      if (moved) hooks.houseBuilt?.(map.rulerHouse.x, map.rulerHouse.y);
      return () => {
        for (const back of backs.reverse()) back();
        if (moved && map.rulerHouse) hooks.houseBuilt?.(map.rulerHouse.x, map.rulerHouse.y);
      };
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
