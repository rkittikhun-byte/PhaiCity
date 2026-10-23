/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the trips of a month are made from, read off a real-scale city map (docs/NO_GRID_PLAN.md step 1.2): its roads as
// the trips see them (src/sim/roadNetwork.ts, each road's speed and capacity by the level it works at), and its homes,
// shops and factories with the road each reaches (src/plots.ts plotAccess) and what each sends or draws, until the
// buildings are a list of their own (step 3B). Plain code, no DOM.

import { plotAccess, type PlotMap, plotOf } from "../plots";
import { type PlotListMap, plotShare, usesPlotList } from "../plotBuildings";
import { roadCapacity, roadSpeed } from "../roadLevels";
import type { RoadGraph } from "../roads/roadGraph";
import { roadNet, type RoadNet } from "./roadNetwork";
import { segmentLevel, type UpkeepMap } from "./roadUpkeep";
import { wornSpeed } from "./disasterLand";
import { roadsMet } from "./roadAccess";
import { STORE_KIND, STORE_RULES } from "../departmentStores";
import { CIVIC } from "../tileValues";
import type { TripNet, TripPlaces } from "./trips";

/** People a home, shop or factory plot of each level counts (the census's 20 people a level, src/plots.ts) */
const PEOPLE_A_LEVEL = 20;
/** Of a home's people, the cars they drive out in the busiest hour, to work or to the shops */
export const CARS_A_PERSON = 0.15;

export type TripMap = PlotMap & UpkeepMap & { roadGraph?: RoadGraph | null; roadWear?: Map<number, number> | null };

/** The roads as the trips see them, and the road graph's arrays they come from */
export function tripNet(map: TripMap, graph: RoadGraph): { net: TripNet; roads: RoadNet } {
  const roads = roadNet(graph), m = roads.segmentIds.length;
  const speed = new Float64Array(m), capacity = new Float64Array(m);
  for (let k = 0; k < m; k++) {
    const level = segmentLevel(map, graph, graph.segment(roads.segmentIds[k]));
    // (slower as it wears, src/sim/disasterLand.ts)
    speed[k] = wornSpeed(roadSpeed(level), map.roadWear?.get(roads.segmentIds[k]) ?? 0);
    capacity[k] = roadCapacity(level);
  }
  return { roads, net: { offsets: roads.offsets, wayTo: roads.wayTo, waySegment: roads.waySegment, segA: roads.segA,
    segB: roads.segB, length: roads.length, speed, capacity } };
}

/**
 * The map's homes and its shops and factories with the road each reaches, in tile order. riders: the share of a place's
 * trips that go by public transport instead (src/transit.ts), which take no car.
 */
export function tripPlaces(map: TripMap, roads: RoadNet, riders?: (x: number, y: number) => number): TripPlaces {
  const homes: number[][] = [], jobs: number[][] = [];
  // Where the plots are a list (src/plotBuildings.ts, docs/NO_GRID_PLAN.md 3B), each plot from the tile it is counted
  // at, with the people of its area
  const list = usesPlotList(map) ? (map as unknown as PlotListMap).plotBuildings ?? null : null;
  if (list) {
    for (const plot of list.all()) {
      const place = list.places.get(plot.id);
      if (!place || plot.level < 1) continue;
      const tile = place.anchor, x = tile % map.width, y = (tile - x) / map.width;
      const access = plotAccess(map, x, y), k = access ? roads.segmentIndex.get(access.segment) ?? -1 : -1;
      const people = plot.level * PEOPLE_A_LEVEL * plotShare(map, plot);
      if (plot.kind === "residential") {
        const drive = 1 - Math.max(0, Math.min(1, riders?.(x, y) ?? 0));
        homes.push([tile, k, access?.t ?? 0, people * CARS_A_PERSON * drive]);
      } else {
        jobs.push([tile, k, access?.t ?? 0, people, plot.kind === "commercial" ? people : 0]);
      }
    }
  }
  for (let y = 0; y < map.height && !list; y++) for (let x = 0; x < map.width; x++) {
    const plot = plotOf(map, x, y);
    if (!plot || plot.level < 1) continue;
    const access = plotAccess(map, x, y), k = access ? roads.segmentIndex.get(access.segment) ?? -1 : -1;
    const tile = y * map.width + x, people = plot.level * PEOPLE_A_LEVEL;
    if (plot.kind === "residential") {
      const drive = 1 - Math.max(0, Math.min(1, riders?.(x, y) ?? 0));
      homes.push([tile, k, access?.t ?? 0, people * CARS_A_PERSON * drive]);
    } else {
      jobs.push([tile, k, access?.t ?? 0, people, plot.kind === "commercial" ? people : 0]);
    }
  }
  // ... and the department stores, finished, each a place of work and of shopping where it meets its road
  // (src/departmentStores.ts)
  const civic = (map as { civicKinds?: Record<string, string> | null; sites?: Record<string, unknown> | null });
  for (const [key, kind] of Object.entries(civic.civicKinds ?? {})) {
    const tile = Number(key), x = tile % map.width, y = (tile - x) / map.width;
    if (kind !== STORE_KIND || map.getTileValue(x, y) !== CIVIC || (civic.sites && key in civic.sites)) continue;
    const meet = roadsMet(map as never, tile, 3)[0], k = meet ? roads.segmentIndex.get(meet.segment) ?? -1 : -1;
    jobs.push([tile, k, meet?.t ?? 0, STORE_RULES.staff, STORE_RULES.shoppers]);
  }
  return {
    homeTile: Int32Array.from(homes, (h) => h[0]), homeSegment: Int32Array.from(homes, (h) => h[1]),
    homeT: Float32Array.from(homes, (h) => h[2]), homeCars: Float32Array.from(homes, (h) => h[3]),
    jobTile: Int32Array.from(jobs, (j) => j[0]), jobSegment: Int32Array.from(jobs, (j) => j[1]),
    jobT: Float32Array.from(jobs, (j) => j[2]), jobs: Float32Array.from(jobs, (j) => j[3]), shops: Float32Array.from(jobs, (j) => j[4]),
  };
}
