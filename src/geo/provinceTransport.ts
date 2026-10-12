/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What links a province to the rest of the country (การคมนาคม; owner, 12 Oct 2026; docs/geo/GEO_SPEC.md section 1):
// its laterite roads and its railways to neighbouring provinces, read from where they leave its map, its big rivers,
// and the sea for a coastal province. Pure functions, no DOM; the province picker words and shows them.

import type { PresetMap, PresetWaterway } from "./presetMap";

export interface ProvinceTransport {
  /** One laterite road to each of these neighbours, with the real road's number when it has one */
  roads: Array<{ neighbor: string; ref: string }>;
  /** Neighbours the railway runs on to */
  rails: string[];
  /** Big rivers boats could use */
  waterways: PresetWaterway[];
  seas: Array<"gulf" | "andaman">;
  /** Neighbours no main road crosses to */
  unlinked: string[];
}

export function provinceTransport(map: Pick<PresetMap, "exits" | "waterways" | "unlinked">,
                                  tags: readonly string[]): ProvinceTransport {
  const roads = new Map<string, string>();
  const rails = new Set<string>();
  for (const exit of map.exits ?? []) {
    if (exit.kind === "road" && !roads.has(exit.neighbor)) roads.set(exit.neighbor, exit.ref ?? "");
    if (exit.kind === "rail") rails.add(exit.neighbor);
  }
  const seas: ProvinceTransport["seas"] = [];
  if (tags.includes("coast_gulf")) seas.push("gulf");
  if (tags.includes("coast_andaman")) seas.push("andaman");
  return {
    roads: [...roads].map(([neighbor, ref]) => ({ neighbor, ref })),
    rails: [...rails],
    waterways: map.waterways ?? [],
    seas,
    unlinked: map.unlinked ?? [],
  };
}

/** Whether there is anything to say: an old 2 × 2 km map knows none of it. */
export function hasTransport(transport: ProvinceTransport): boolean {
  return transport.roads.length + transport.rails.length + transport.waterways.length + transport.seas.length > 0;
}

/** A river's name in the player's language: the English one may be missing. */
export function waterwayName(waterway: PresetWaterway, language: string): string {
  return language === "en" && waterway.en ? waterway.en : waterway.th;
}
