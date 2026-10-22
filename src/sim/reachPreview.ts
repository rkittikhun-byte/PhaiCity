/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What a police station, fire station, school or hospital in hand would reach along the roads from where it would stand
// (docs/NO_GRID_PLAN.md 4.3, "วงรัศมีบริการตอนถือเครื่องมือ"): on a real-scale city map their cover and their places
// run along the roads (src/sim/serviceReach.ts, src/sim/serviceSeats.ts), so the 3D view shows the roads they would
// reach, fading with the distance, before the player puts one down (src/render3d/city/reachLayer.ts). Only reads the
// city. Plain code, no DOM.

import { levelOfTool } from "../buildingLevels";
import { SERVICE_SPECS, type ServiceField } from "../services";
import { isCityTileSize } from "../units";
import { roadNet } from "./roadNetwork";
import { roadsMet } from "./roadAccess";
import { COVER_REACH_M, roadDistances, type CoverMap } from "./serviceReach";
import { SEAT_REACH_M } from "./serviceSeats";

/** What a building serves: the police's or the fire brigade's cover, or a school's or hospital's places */
export type ReachField = "police" | "fire" | ServiceField;

/** A road the building would reach: its segment's id and the distance along the roads at each of its ends (metres,
 *  Infinity where an end is past the reach), and, on the road the building stands at, where along it (0-1) and how far
 *  off it is */
export interface ReachedRoad { id: number; a: number; b: number; at?: { t: number; d: number } }

/** The roads a building would reach, for its tool's preview */
export interface ReachPreview { field: ReachField; metres: number; roads: ReachedRoad[] }

/** The field a tool's building serves and how far along the roads, or null for one that serves none */
export function toolReach(tool: string): { field: ReachField; metres: number } | null {
  const level = levelOfTool(tool);
  if (level) return { field: level.group, metres: COVER_REACH_M };
  const spec = (SERVICE_SPECS as Record<string, { field: ServiceField } | undefined>)[tool];
  return spec ? { field: spec.field, metres: SEAT_REACH_M[spec.field] } : null;
}

/** How much of its strength a building gives at `metres` along the roads, 0-1: the police's and the fire brigade's
 *  cover falling to nothing at its reach (serviceReach.ts coverAt), a school's or hospital's places the same all the
 *  way to theirs (serviceSeats.ts), shown fading over its last tenth */
export function reachShare(field: ReachField, metres: number, reach: number): number {
  if (!(metres < reach)) return 0;
  if (field === "police" || field === "fire") {
    const fall = 1 - (metres * metres) / (reach * reach);
    return fall * fall;
  }
  return Math.min(1, (reach - metres) / (reach * 0.1));
}

/**
 * The roads the building `tool` would reach from the `size` x `size` block whose centre is the tile `centre`: null off a
 * real-scale city map, for a tool that serves nothing, or where it would meet no road.
 */
export function reachPreview(map: CoverMap, tool: string, centre: number, size: number): ReachPreview | null {
  const what = toolReach(tool), graph = map.roadGraph;
  if (!what || !isCityTileSize(map.tileSizeM) || !graph || !graph.segments.size) return null;
  const met = roadsMet(map, centre, size);
  if (!met.length) return null;
  const net = roadNet(graph);
  const starts = met.map((m) => ({ k: net.segmentIndex.get(m.segment) ?? -1, t: m.t, d: m.distance })).filter((s) => s.k >= 0);
  const dist = roadDistances(net, starts, what.metres);
  const roads: ReachedRoad[] = [];
  for (let k = 0; k < net.segmentIds.length; k++) {
    const a = dist[net.segA[k]], b = dist[net.segB[k]], own = starts.find((s) => s.k === k);
    if (a === Infinity && b === Infinity && !own) continue;
    roads.push({ id: net.segmentIds[k], a, b, ...(own ? { at: { t: own.t, d: own.d } } : {}) });
  }
  return { field: what.field, metres: what.metres, roads };
}

/** The distance along the roads at a point `s` (0-1) along a reached road `length` metres long */
export function reachedAt(road: ReachedRoad, s: number, length: number): number {
  let d = Math.min(road.a + s * length, road.b + (1 - s) * length);
  if (road.at) d = Math.min(d, road.at.d + Math.abs(s - road.at.t) * length);
  return d;
}
