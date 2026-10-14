/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What a click on the map shows (ตัวตรวจดู, docs/GAME_PLAN.md phase 7 step 1, docs/INSPECTOR.md): the object on the
// tile, from the city's objects (src/objects/), or the road, railway, water, woods or open land there, with the lines
// of its card as i18n keys and their values. The card (src/inspectCard.ts) translates and draws them. It only reads
// the city. Plain code: no DOM.

import { buildingLevelAt, groupOfCentre, levelSpec } from "./buildingLevels.js";
import { ownsLand } from "./landBlocks.js";
import type { Fact } from "./objects/cityObject.js";
import type { CityObjects } from "./objects/cityObjects.js";
import { DENSITY_GRADES, gradeAt, LAND_GRADES, type Satisfaction, type SatisfactionContext } from "./objects/satisfaction.js";
import { MINE_TOOLS } from "./mining.js";
import { PLANT_TOOLS } from "./powerPlants.js";
import { isRoadTile, ROAD_TOOLS, roadLevelAt } from "./roadLevels.js";
import { findStreets, type Street, type StreetMap, streetLabel } from "./streetNames.js";
import { LASTRAIL, LASTRIVEDGE, LASTTREE, RAILBASE, RIVER, TREEBASE, WOODS, WOODS2 } from "./tileValues.js";

export interface Inspection {
  /** The card's title: an i18n key (a tool's name takes `{price}`, given empty) */
  title: { key: string; params?: Record<string, string | number> };
  /** The street it stands on or is: an i18n key from src/streetNames.ts streetLabel */
  street?: { key: string; params: Record<string, string | number> };
  /** The community's or the ruler's, for a building */
  sector?: "community" | "central";
  /** How content it is (src/objects/satisfaction.ts), for what has someone to be content */
  satisfaction?: Satisfaction;
  facts: Fact[];
  /** The tiles it covers, for the outline in the view */
  rect: { x: number; y: number; width: number; height: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = any;

export interface InspectCity {
  map: StreetMap & Legacy;
  objects: CityObjects;
  /** The simulation's block maps (land value, pollution, crime, traffic) */
  blockMaps: Legacy;
  /** The city's time now and the year it began, for when a building went up */
  cityTime: number;
  startingYear: number;
  language: "th" | "en";
  /** What the satisfaction scores read besides the map (budget, demand, services) */
  satisfaction?: SatisfactionContext;
}

/** The tool whose name a building's sort takes as its title */
function titleOf(kind: string, sort: string): string {
  switch (kind) {
    case "home": case "shop": case "factory": return `object.kind.${kind}`;
    case "power_plant": return `tool.${sort === "nuclear" ? "nuclear" : PLANT_TOOLS[sort as keyof typeof PLANT_TOOLS] ?? "coal"}`;
    case "mine": return `tool.${MINE_TOOLS[sort as keyof typeof MINE_TOOLS] ?? "lignite_mine"}`;
    case "civic": case "waste": case "station": return `tool.${sort || kind}`;
    case "water_works": return "tool.waterworks";
    case "water_tower": return "tool.watertower";
    case "harbour": return "tool.fishing";
    default: return `tool.${kind}`;
  }
}

/** The area round a tile, from the simulation's block maps */
function areaFacts(blockMaps: Legacy, x: number, y: number): Fact[] {
  if (!blockMaps) return [];
  return [
    { key: "object.fact.land_value", params: { grade: `object.grade.${gradeAt(blockMaps.landValueMap, x, y, LAND_GRADES)}` } },
    { key: "object.fact.pollution", params: { grade: `object.grade.${gradeAt(blockMaps.pollutionDensityMap, x, y, DENSITY_GRADES)}` } },
    { key: "object.fact.crime", params: { grade: `object.grade.${gradeAt(blockMaps.crimeRateMap, x, y, DENSITY_GRADES)}` } },
  ];
}

/** About how many people live in a home, by the game's own count (src/residential.js, src/evaluation.js) */
export function homePeople(level: number, size: number, painted: boolean): number {
  if (level <= 1) return 20;
  const zone = ((level - 1) * 8 + 16) * 20;
  return size === 1 && painted ? Math.round(zone / 8) : zone;
}

let streetsCache: { map: StreetMap; signature: number; streets: Street[]; byTile: Map<number, Street> } | null = null;

/** The street a road tile belongs to (findStreets is read again only when the roads have changed) */
function streetAt(map: StreetMap & Legacy, i: number): Street | null {
  let signature = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (isRoadTile(map.getTileValue(x, y))) signature = (Math.imul(signature, 31) + y * map.width + x) | 0;
  }
  if (!streetsCache || streetsCache.map !== map || streetsCache.signature !== signature) {
    const streets = findStreets(map), byTile = new Map<number, Street>();
    for (const street of streets) for (const t of street.tiles) if (!byTile.has(t)) byTile.set(t, street);
    streetsCache = { map, signature, streets, byTile };
  }
  return streetsCache.byTile.get(i) ?? null;
}

/** The nearest street to a building: a road tile beside its edge */
function streetBeside(map: StreetMap & Legacy, rect: Inspection["rect"]): Street | null {
  for (let y = rect.y - 1; y <= rect.y + rect.height; y++) for (let x = rect.x - 1; x <= rect.x + rect.width; x++) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (isRoadTile(map.getTileValue(x, y))) { const street = streetAt(map, y * map.width + x); if (street) return street; }
  }
  return null;
}

/** What a click on tile (x, y) shows, or null off the map */
export function inspectAt(city: InspectCity, x: number, y: number): Inspection | null {
  const { map } = city;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  const i = y * map.width + x, value = map.getTileValue(x, y);
  const building = city.objects.at(x, y);
  if (building) {
    const rect = { x: building.left, y: building.top, width: building.size, height: building.size };
    const facts = building.facts(map).filter(fact => fact.key !== "object.fact.sort");
    if (building.kind === "home") {
      const level = Number(facts.find(f => f.key === "object.fact.level")?.params?.level ?? 1);
      facts.push({ key: "object.fact.people", params: { people: homePeople(level, building.size, !!map.paintedZones) } });
    }
    facts.push(building.built > 0
      ? { key: "object.fact.built", params: { year: city.startingYear + Math.floor(building.built / 48) } }
      : { key: "object.fact.built_before" });
    facts.push(...areaFacts(city.blockMaps, building.x, building.y));
    const street = streetBeside(map, rect);
    const satisfaction = city.satisfaction ? building.satisfaction(map, city.satisfaction) ?? undefined : undefined;
    // A police or fire station is named by its level (src/buildingLevels.ts)
    const group = groupOfCentre(map.getTileValue(building.x, building.y));
    const title = group ? `tool.${levelSpec(group, buildingLevelAt(map, building.x, building.y, group)).tool}`
      : titleOf(building.kind, building.sort(map));
    return { title: { key: title, params: { price: "" } }, sector: building.sector,
      street: street ? streetLabel(street, city.language) : undefined, satisfaction, facts, rect };
  }
  const rect = { x, y, width: 1, height: 1 };
  const outside = map.insideProvince && map.insideProvince[i] !== 1 ? [{ key: "object.fact.outside" }] : [];
  if (isRoadTile(value)) {
    const street = streetAt(map, i), level = roadLevelAt(map, x, y);
    const facts: Fact[] = [{ key: "object.fact.road_level", params: { road: `tool.${ROAD_TOOLS[level - 1] ?? "road"}` } }];
    if (map.isNationalTransport?.(x, y)) facts.push({ key: "object.fact.state_road" });
    return { title: { key: "object.kind.road" }, street: street ? streetLabel(street, city.language) : undefined,
      facts: [...facts, ...areaFacts(city.blockMaps, x, y), ...outside], rect };
  }
  if (value >= RAILBASE && value <= LASTRAIL) return { title: { key: "object.kind.rail" }, facts: outside, rect };
  if (value >= RIVER && value <= LASTRIVEDGE) return { title: { key: "object.kind.water" }, facts: outside, rect };
  if (value >= TREEBASE && value <= LASTTREE || value >= WOODS && value < WOODS2) {
    return { title: { key: "object.kind.woods" }, facts: outside, rect };
  }
  const cover = map.landCover?.[i] ?? 0;
  const facts: Fact[] = [...areaFacts(city.blockMaps, x, y), ...outside];
  if (map.landBlocks && !outside.length && !ownsLand(map, x, y)) facts.push({ key: "object.fact.unowned" });
  return { title: { key: cover ? `object.cover.${cover}` : "object.kind.land" }, facts, rect };
}
