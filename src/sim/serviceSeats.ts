/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The schools' seats and the hospitals' care by the distance along the roads (docs/NO_GRID_PLAN.md 4.3). The levels
// were the city's places over its people, as if a school 5 km off served a home as well as one next door. On a real-scale
// city map whose plots are a list, each home (a plot of the list) wants its share of the city's children, young people
// and patients, by its level and how much of a tile it covers; each school or hospital with power gives its places from
// the roads it meets, the nearest homes along the roads first (src/sim/roadSupply.ts, as the water goes), and a home
// further than its field's reach from every one of them goes without. The level is the share of what the homes want
// that they got, so a city with schools enough within reach scores as before, and a suburb far from any school does
// not count as taught.
//
// Plain code, + - x / only in what decides. No DOM.

import type { RoadGraph } from "../roads/roadGraph";
import { roadNet } from "./roadNetwork";
import { type SupplySource, type SupplyUser, supplyAlongRoads } from "./roadSupply";
import { buildingAttaches, gapLinks, plotAttach, type UtilityMap } from "./cityUtilities";
import { CHILDREN_SHARE, type ServiceField, type ServiceLevels, YOUNG_SHARE } from "../services";
import type { PlotListMap } from "../plotBuildings";

/** How far along the roads a field's places reach a home (metres): a child walks or rides to a primary school, the
 * young go further to a college, and a hospital is a ride away */
export const SEAT_REACH_M: Readonly<Record<ServiceField, number>> = { basic: 3000, higher: 6000, health: 4000 };

/** A school or hospital the scan found: its centre tile, its field and the places it gives (none without power) */
export interface ServiceSite { centre: number; field: ServiceField; places: number }

/** What of each field's people a home wants: children's seats, the young's, and care for all */
const WANT: Readonly<Record<ServiceField, number>> = { basic: CHILDREN_SHARE, higher: YOUNG_SHARE, health: 1 };

const share = (got: number, wanted: number): number => (wanted <= 0 ? 100 : Math.round(100 * Math.min(1, got / wanted)));

/**
 * The levels the places give the people, along the roads: null where the city keeps no plots as a list or no roads (the
 * city-wide count, src/services.ts serviceLevels, stands there). people: the city's people (src/services.ts peopleOf).
 */
export function seatsAlongRoads(map: UtilityMap & PlotListMap & { roadGraph?: RoadGraph | null }, sites: readonly ServiceSite[],
  people: number): ServiceLevels | null {
  const graph = map.roadGraph, list = map.plotBuildings;
  if (!graph || !graph.segments.size || !list) return null;
  const roads = roadNet(graph), links = gapLinks(graph, roads), tile = map.tileSizeM || 16;
  // The homes and what each weighs: its level and how much of a tile it covers
  const homes: Array<{ at: SupplyUser["at"]; weight: number }> = [];
  let total = 0;
  for (const plot of list.all()) {
    if (plot.kind !== "residential" || plot.level <= 0) continue;
    const place = list.places.get(plot.id);
    if (!place) continue;
    const weight = plot.level * plot.columns.length * 64 / (tile * tile);
    homes.push({ at: plotAttach(map, roads, place.anchor), weight });
    total += weight;
  }
  const levels: ServiceLevels = { basic: 0, higher: 0, health: 0, people };
  for (const field of ["basic", "higher", "health"] as const) {
    const wanted = people * WANT[field];
    if (wanted <= 0 || total <= 0) { levels[field] = share(0, wanted); continue; }
    const sources: SupplySource[] = [];
    for (const site of sites) {
      if (site.field !== field || site.places <= 0) continue;
      const at = buildingAttaches(map, roads, site.centre, 3);
      if (at.length) sources.push({ at, amount: site.places });
    }
    if (!sources.length) { levels[field] = 0; continue; }
    const users: SupplyUser[] = homes.map((h) => ({ at: h.at, demand: wanted * h.weight / total }));
    // ... the homes within the field's reach of a school or hospital, and then which of them its places go round
    const reach = supplyAlongRoads(roads, sources, users, links).distance;
    const near = users.map((u, i) => (reach[i] <= SEAT_REACH_M[field] ? u : { at: null, demand: u.demand }));
    const result = supplyAlongRoads(roads, sources, near, links);
    // (the home the places ran out at gets what was left of them: with every home within reach, the city scores as by
    // its places and people, not a point lower for the last home's whole demand)
    let got = 0;
    near.forEach((u, i) => { if (u.at) got += u.demand * result.part[i]; });
    levels[field] = share(got, wanted);
  }
  return levels;
}
