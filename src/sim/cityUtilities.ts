/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Power and water on a real-scale city map (docs/NO_GRID_PLAN.md 2.2, 2.3): the plants, works and wells, and the
// buildings that take from them, read off the map and put on the road graph, then handed out along the roads
// (src/sim/roadSupply.ts). The power manager (src/powerManager.js) and the water supply (src/waterManager.ts) call these
// on such a map and keep their old tile ways for the province and practice maps (docs/NO_GRID_PLAN.md 4.4).
//
// What each takes: a building of the ruler's or a zone as much as before (its tiles' worth of power, a zone's share of
// water); a plot by its kind and level (an empty lot little, a tower block much), no longer the same for all. Plain
// code, no DOM, nothing random.

import { turnedTilesOf, type FootprintMap } from "../buildings/turnedFootprint";
import { plotAccess, type PlotKind, type PlotMap, plotOf, PLOT_SHARE } from "../plots";
import type { RoadGraph } from "../roads/roadGraph";
import { isCityTileSize } from "../units";
import { blockTiles, centreSize, roadsMet } from "./roadAccess";
import { roadNet, type RoadNet } from "./roadNetwork";
import { segmentShape } from "./roadUpkeep";
import { type Attach, ROAD_NONE, type SupplyLinks, type SupplySource, type SupplyUser, supplyAlongRoads } from "./roadSupply";

export type UtilityMap = FootprintMap & PlotMap & {
  readonly roadGraph?: RoadGraph | null;
  getTileFlags(x: number, y: number): number;
};

/** Whether power and water run along the road graph on this map: a real-scale city map (docs/NO_GRID_PLAN.md 4.4) */
export function byRoads(map: { tileSizeM?: number | null; roadGraph?: RoadGraph | null }): boolean {
  return isCityTileSize(map.tileSizeM) && Boolean(map.roadGraph);
}

/** A road whose node comes this near a road of another network is joined to it for power and water (metres): a short
 * cable or pipe crosses the gap, as the power once crossed from a road tile to the one beside it (two streets side by
 * side, a street's end stopping a tile short of another), never along a band of plots as it did */
export const GAP_M = 17;

/** The short links between the road networks, by graph, worked out again when it changes */
const gaps = new WeakMap<RoadGraph, { version: number; links: SupplyLinks }>();

/** The short cables and pipes that join the road networks where their roads nearly meet (GAP_M): from each node, in
 * order, to the nearer end of a road of another network within reach, once a pair of networks */
export function gapLinks(graph: RoadGraph, roads: RoadNet): SupplyLinks {
  const had = gaps.get(graph);
  if (had && had.version === graph.version) return had.links;
  const n = roads.nodeIds.length, parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra < rb) parent[rb] = ra; else if (rb < ra) parent[ra] = rb; };
  for (let k = 0; k < roads.segA.length; k++) join(roads.segA[k], roads.segB[k]);
  const a: number[] = [], b: number[] = [], length: number[] = [];
  for (let i = 0; i < n; i++) {
    const p: [number, number] = [roads.x[i], roads.z[i]];
    for (const id of graph.segmentsNear(p, GAP_M)) {
      const k = roads.segmentIndex.get(id);
      if (k === undefined || find(roads.segA[k]) === find(i)) continue;
      const near = graph.nearestOn(id, p);
      if (near.distance > GAP_M) continue;
      const toA = near.t * roads.length[k], toB = (1 - near.t) * roads.length[k];
      a.push(i);
      b.push(toA <= toB ? roads.segA[k] : roads.segB[k]);
      length.push(near.distance + Math.min(toA, toB));
      join(i, roads.segA[k]);
    }
  }
  const links = { a: Int32Array.from(a), b: Int32Array.from(b), length: Float64Array.from(length) };
  gaps.set(graph, { version: graph.version, links });
  return links;
}

/** What a scan leaves for the layers to read: the last one's own object while nothing it shows changed (the roads and
 * each one's state), so the layers are built again only when something did */
export function scanState<T extends { roads: RoadNet; state: Uint8Array }>(last: T | null | undefined, next: T): T {
  if (!last || last.roads !== next.roads || last.state.length !== next.state.length) return next;
  for (let k = 0; k < next.state.length; k++) if (last.state[k] !== next.state[k]) return next;
  return Object.assign(last, next, { state: last.state });
}

/** What ran along each road at a power or water scan, by tile, for the city map's layers: the state of the road whose
 * tiles these are (src/sim/roadSupply.ts ROAD_*, the best of several on a tile), -1 where no road of the graph lies;
 * null without a scan to show */
export function roadStateTiles(map: { width: number; height: number; tileSizeM?: number | null; roadGraph?: RoadGraph | null },
  scan: { roads: RoadNet; state: Uint8Array } | null | undefined): Int8Array | null {
  const graph = map.roadGraph;
  if (!scan || !graph) return null;
  const out = new Int8Array(map.width * map.height).fill(-1), raster = { width: map.width, height: map.height, tileSizeM: map.tileSizeM ?? 16 };
  // (served beats short beats none on a tile two roads share)
  const rank = (s: number): number => (s === 1 ? 3 : s === 2 ? 2 : s === 0 ? 1 : 0);
  for (let k = 0; k < scan.state.length; k++) {
    const segment = graph.segments.get(scan.roads.segmentIds[k]);
    if (!segment) continue;
    for (const i of segmentShape(graph, segment, raster).tiles) if (rank(scan.state[k]) > rank(out[i])) out[i] = scan.state[k];
  }
  return out;
}

/** A plot's power by its level, in the units a tile of a building takes (the old game's one a tile): an empty lot a
 * little, a house less than a tile, a tower block several; factories take a quarter more */
export const PLOT_POWER: readonly number[] = [0.25, 0.75, 1, 1.5, 2, 2.5];
export const FACTORY_POWER = 1.25;
/** A plot's water by its level, times a plot's share of a zone's (PLOT_SHARE): none for an empty lot */
export const PLOT_WATER: readonly number[] = [0, 0.75, 1, 1.25, 1.5, 2];

const byLevel = (table: readonly number[], level: number): number => table[Math.max(0, Math.min(table.length - 1, level))];

/** The power a plot of this kind and level takes */
export function plotPower(kind: PlotKind, level: number): number {
  return byLevel(PLOT_POWER, level) * (kind === "industrial" ? FACTORY_POWER : 1);
}

/** The water a plot of this level takes, in zone shares */
export function plotWater(level: number): number {
  return byLevel(PLOT_WATER, level) * PLOT_SHARE;
}

/** Where a building on centre tile `centre` meets the roads (its nearest road), on the graph's arrays, or null */
export function buildingAttach(map: UtilityMap, roads: RoadNet, centre: number, size: number): Attach | null {
  for (const meet of roadsMet(map, centre, size)) {
    const k = roads.segmentIndex.get(meet.segment);
    if (k !== undefined) return { k, t: meet.t };
  }
  return null;
}

/** Every road a building meets, on the graph's arrays (a plant or works feeds them all) */
export function buildingAttaches(map: UtilityMap, roads: RoadNet, centre: number, size: number): Attach[] {
  const out: Attach[] = [];
  for (const meet of roadsMet(map, centre, size)) {
    const k = roads.segmentIndex.get(meet.segment);
    if (k !== undefined) out.push({ k, t: meet.t });
  }
  return out;
}

/** Where a plot meets its road, on the graph's arrays, or null */
export function plotAttach(map: UtilityMap, roads: RoadNet, tile: number): Attach | null {
  const x = tile % map.width, access = plotAccess(map, x, (tile - x) / map.width);
  const k = access ? roads.segmentIndex.get(access.segment) : undefined;
  return access && k !== undefined ? { k, t: access.t } : null;
}

/** The tiles a building on centre tile `centre` stands on: as laid turned, else its square block */
export function buildingTiles(map: UtilityMap, centre: number, size: number): number[] {
  const value = map.getTileValue(centre % map.width, Math.floor(centre / map.width));
  return turnedTilesOf(map, centre, value) ?? blockTiles(centre, size, map.width, map.height);
}

/** The plots and the centres of zones and buildings that take from a supply this cycle, as the map scan found them */
export interface UtilityUsers {
  plots: number[];
  zones: number[];
}

/** Every plot and every zone or building centre on the map now, but the construction sites: for a city's first scan,
 * before the map scan has found them */
export function usersOnMap(map: UtilityMap & { sites?: Record<string, unknown> | null }, zoneBit: number): UtilityUsers {
  const plots: number[] = [], zones: number[] = [], sites = map.sites ?? null;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    if (map.getTileFlags(x, y) & zoneBit) {
      if (!sites || sites[i] === undefined) zones.push(i);
    } else if (plotOf(map, x, y)) plots.push(i);
  }
  return { plots, zones };
}

/** A power plant, works or well: its centre tile, its size in tiles, and what it gives */
export interface UtilitySource {
  centre: number;
  size: number;
  amount: number;
}

/** What the power along the roads came to */
export interface RoadPower {
  /** The graph's arrays it was worked out on, and each segment's state (src/sim/roadSupply.ts ROAD_*) */
  roads: RoadNet;
  state: Uint8Array;
  /** The tiles with power: the plots and the tiles of the buildings served, and the plants' own */
  powered: number[];
  /** What the plants give, what the buildings served take, and whether some went without */
  supply: number;
  used: number;
  short: boolean;
}

/**
 * The power along the roads: each plant feeds the roads it meets; each plot takes its level's power (plotPower) and each
 * zone or building its tiles' worth, the nearest to a plant by road first, until the power runs out.
 */
export function powerAlongRoads(map: UtilityMap, plants: readonly UtilitySource[], users: UtilityUsers): RoadPower {
  const roads = roadNet(map.roadGraph!), sources: SupplySource[] = [], powered: number[] = [];
  const isSource = new Set<number>();
  for (const plant of plants) {
    isSource.add(plant.centre);
    sources.push({ at: buildingAttaches(map, roads, plant.centre, plant.size), amount: plant.amount });
    powered.push(...buildingTiles(map, plant.centre, plant.size));
  }
  const list: SupplyUser[] = [], tilesOf: Array<() => number[]> = [];
  for (const tile of users.plots) {
    const x = tile % map.width, plot = plotOf(map, x, (tile - x) / map.width);
    if (!plot) continue;
    list.push({ at: plotAttach(map, roads, tile), demand: plotPower(plot.kind, plot.level) });
    tilesOf.push(() => [tile]);
  }
  for (const centre of users.zones) {
    if (isSource.has(centre)) continue;
    const size = centreSize(map.getTileValue(centre % map.width, Math.floor(centre / map.width)));
    list.push({ at: buildingAttach(map, roads, centre, size), demand: size * size });
    tilesOf.push(() => buildingTiles(map, centre, size));
  }
  const result = supplyAlongRoads(roads, sources, list, gapLinks(map.roadGraph!, roads));
  for (let i = 0; i < list.length; i++) if (result.served[i]) powered.push(...tilesOf[i]());
  return { roads, state: result.roads, powered, supply: result.supply, used: result.used, short: result.short };
}

/** A water user as the map scan found it: a plot or a zone's centre, and what it takes now (0 for one that needs none) */
export interface WaterUser {
  tile: number;
  zone: boolean;
  demand: number;
}

/** What the water along the roads came to */
export interface RoadWater {
  roads: RoadNet;
  state: Uint8Array;
  /** Each user, in the order given: watered (1), piped but the supply ran out before it (2), or no pipe (0) */
  answer: Uint8Array;
  supply: number;
  used: number;
  short: boolean;
  /** The towers that pumped their own wells (their centres), which draw on the ground under them */
  wells: number[];
}

/** A water works, or a tower: what it gives as works or well, and the dry season's loss it was spared */
export interface WaterSource extends UtilitySource {
  tower: boolean;
  /** A works: what the dry season took from it; a tower: what it gives as a well when no works' pipe reaches it */
  lost: number;
  well: number;
}

/**
 * The water along the roads: each powered works feeds the roads it meets; a tower on a works' roads gives back some of
 * what the dry season took (towerStore, as much as was lost), and one no works' road reaches pumps its own well onto the
 * roads it meets, a village's water; then each user takes its share, the nearest to a source by road first.
 * factor: how much further the water goes (a festival's use, the fee's and the policy's saving).
 */
export function waterAlongRoads(map: UtilityMap, sources: readonly WaterSource[], users: readonly WaterUser[],
  towerStore: number, factor: number): RoadWater {
  const roads = roadNet(map.roadGraph!);
  const works = sources.filter((s) => !s.tower && s.amount > 0);
  const worksAt = works.map((s) => ({ at: buildingAttaches(map, roads, s.centre, s.size), amount: s.amount }));
  // The roads the works' water reaches, so the towers know whether they stand on its pipes
  const links = gapLinks(map.roadGraph!, roads), piped = supplyAlongRoads(roads, worksAt, [], links).roads;
  const onPipes: number[] = [], wells: Array<{ centre: number; at: Attach[]; amount: number }> = [];
  for (const tower of sources.filter((s) => s.tower)) {
    const at = buildingAttaches(map, roads, tower.centre, tower.size);
    if (at.some((a) => piped[a.k] !== ROAD_NONE)) onPipes.push(tower.centre);
    else if (at.length && tower.well > 0) wells.push({ centre: tower.centre, at, amount: tower.well });
  }
  // The towers on the pipes give back what the dry season took, as much as they stored
  const lost = works.reduce((sum, s) => sum + s.lost, 0), stored = Math.min(lost, towerStore * onPipes.length);
  const all: SupplySource[] = [...worksAt, ...wells];
  for (const centre of onPipes) {
    if (stored > 0) all.push({ at: buildingAttaches(map, roads, centre, 1), amount: stored / onPipes.length });
  }
  for (const source of all) source.amount *= factor;
  const list: SupplyUser[] = users.map((u) => {
    const x = u.tile % map.width;
    let at: Attach | null;
    if (u.zone) at = buildingAttach(map, roads, u.tile, centreSize(map.getTileValue(x, (u.tile - x) / map.width)));
    else at = plotAttach(map, roads, u.tile);
    return { at, demand: u.demand };
  });
  const result = supplyAlongRoads(roads, all, list, links);
  const answer = new Uint8Array(users.length);
  for (let i = 0; i < users.length; i++) answer[i] = result.served[i] ? 1 : result.reached[i] ? 2 : 0;
  return { roads, state: result.roads, answer, supply: result.supply, used: result.used, short: result.short,
    wells: wells.map((w) => w.centre) };
}
