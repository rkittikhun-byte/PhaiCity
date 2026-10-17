/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import type { Group } from 'three';
import { TRIANGLE_BUDGETS } from '../constants.js';
import { createDebugBox } from './debug/box.js';
import { createRegionHouse } from './debug/region-house.js';
import { createHouse, HOUSE_IDS, HOUSE_TIERS } from './residential/houses.js';
import { createResidentialBlock, createEmptyResidentialZone, RES_ZONE_SPECS } from './residential/zones.js';
import { createHospital } from './services/hospital.js';
import { createPolice } from './services/police.js';
import { createFire } from './services/fire.js';
import { createStadium, STADIUM_TILES } from './services/stadium.js';
import { createCoal } from './services/coal.js';
import { createNuclear } from './services/nuclear.js';
import { createGas, createHydro, createSolar, createWind } from './services/solar.js';
import { createSeaport } from './transport/seaport.js';
import { createAirport } from './transport/airport.js';
import { createRulerHouse, RULER_HOUSE_ID, RULER_HOUSE_LEVELS } from './civic/ruler-house.js';
import { createSchool, SCHOOL_BUDGETS, SCHOOL_KINDS, schoolId } from './civic/schools.js';
import { createHospitalCivic, HOSPITAL_BUDGETS, HOSPITAL_KINDS, hospitalId } from './civic/hospitals.js';
import { createWaste, WASTE_BUDGETS, WASTE_KINDS, wasteId } from './waste/waste.js';
import { createWaterWorks, WATER_WORKS_ID, WATER_WORKS_TILES } from './water/water-works.js';
import { createWaterTower, WATER_TOWER_ID, WATER_TOWER_TILES } from './water/water-tower.js';
import { createCommercialBlock, createEmptyCommercialZone, COM_ZONE_SPECS } from './commercial/zones.js';
import { createIndustrialBlock, createEmptyIndustrialZone, IND_ZONE_SPECS } from './industrial/zones.js';
import { createPlot, PLOT_SPECS } from './plot/index.js';
import type { RegionId, RegionTier } from '../regional/types.js';
import { createTree, TREE_FOOTPRINTS, TREE_KINDS } from './vegetation/trees.js';
import { createPark, PARK_IDS, PARK_TILES } from './vegetation/parks.js';
import { createTerrain, TERRAIN_KINDS, TERRAIN_TILES } from './terrain/terrain.js';
import { createRoad, ROAD_KINDS, ROAD_TILES } from './road/road.js';
import { createLateriteRoad, LATERITE_KINDS } from './road/laterite.js';
import { STAIRCASE_VARIANTS } from './road/centreline.js';
import { createRail, RAIL_KINDS, RAIL_TILES } from './rail/rail.js';
import { createPower, POWER_KINDS, POWER_TILES } from './power/power.js';
import { createElevatedRail, ELEVATED_KINDS, ELEVATED_STYLES } from './rail/elevated.js';
import {
  createTrainLoco, createTrainCar, createHelicopter, createAirplane,
  createShip, createLongtailBoat, createKorlaeBoat, createSedan,
  createPickup, createTuktuk, createMotorbike, createSongthaew,
  createBus, createTruck, createEtan, createTrainHsr, createMetro,
} from './vehicles/index.js';

export interface ModelOptions {
  roadLevel?: 1 | 2 | 3;
  seed?: number;
  variant?: number;
  state?: string;
  region?: RegionId;
  /** Neighbor masks: bit0 N, bit1 E, bit2 S, bit3 W. Shore/woods use variant. */
  landMask?: number;
  waterMask?: number;
  bankStyle?: 'earth' | 'concrete' | 'brick';
  /** Tile center in world X/Z; required when baking adjacent terrain UVs. */
  worldOrigin?: readonly [number, number];
  /** World-space yaw used to bake rail UVs before the caller rotates the canonical model. */
  worldRotationY?: number;
  /** Distance along a connected rail route at its canonical start; preserves 0.6 m sleeper phase on curves. */
  sleeperOffset?: number;
}
export type ModelFactory = (opts?: ModelOptions) => Group;
export type ModelCategory = 'terrain' | 'vegetation' | 'veg' | 'park' | 'road' | 'rail' | 'power'
  | 'residential' | 'commercial' | 'industrial' | 'services' | 'transport'
  | 'veh' | 'fx' | 'ui' | 'debug';

export interface ModelRegistration {
  factory: ModelFactory;
  category: ModelCategory;
  /** Footprint in tiles; root origin is at its center at y = 0. */
  footprint: readonly [number, number];
  tiles: readonly number[];
  budget: number;
  regionTier: RegionTier;
  /** Prompt 2 explicitly permits seeded size, lean and crown variation for plants. */
  seededVegetation?: boolean;
  /** Full tile coverage without the building margin. */
  tiling?: boolean;
  ground?: 'land' | 'water' | 'bridge' | 'shore';
  variants?: readonly number[];
  states?: readonly string[];
}

export const registry: Readonly<Record<string, ModelRegistration>> = Object.freeze({
  'ind.zone_empty': { factory: createEmptyIndustrialZone, category: 'industrial', footprint: [3, 3],
    tiles: Array.from({ length: 9 }, (_, i) => 612 + i), budget: TRIANGLE_BUDGETS.lowRise, regionTier: 'R2' },
  ...Object.fromEntries(IND_ZONE_SPECS.map(spec => [spec.id, {
    factory: (options?: ModelOptions) => createIndustrialBlock(spec.type, spec.size, options),
    category: 'industrial', footprint: [3, 3], tiles: spec.tiles, budget: spec.budget, regionTier: spec.regionTier,
  } as ModelRegistration])),
  'com.zone_empty': { factory: createEmptyCommercialZone, category: 'commercial', footprint: [3, 3],
    tiles: Array.from({ length: 9 }, (_, i) => 423 + i), budget: TRIANGLE_BUDGETS.lowRise, regionTier: 'R2' },
  ...Object.fromEntries(COM_ZONE_SPECS.map(spec => [spec.id, {
    factory: (options?: ModelOptions) => createCommercialBlock(spec.landValue, spec.density, options),
    category: 'commercial', footprint: [3, 3], tiles: spec.tiles, budget: spec.budget, regionTier: spec.regionTier,
    ...(spec.landValue === 3 && spec.density === 4 ? { variants: [0, 1, 2] } : {}),
  } as ModelRegistration])),
  'svc.hospital': { factory: createHospital, category: 'services', footprint: [3, 3],
    tiles: Array.from({ length: 9 }, (_, i) => 405 + i), budget: TRIANGLE_BUDGETS.highRise, regionTier: 'R2' },
  'svc.police': { factory: createPolice, category: 'services', footprint: [3, 3],
    tiles: Array.from({ length: 9 }, (_, i) => 770 + i), budget: TRIANGLE_BUDGETS.lowRise, regionTier: 'R2' },
  'svc.fire': { factory: createFire, category: 'services', footprint: [3, 3],
    tiles: Array.from({ length: 9 }, (_, i) => 761 + i), budget: TRIANGLE_BUDGETS.highRise, regionTier: 'R2' },
  // The city view picks it from gameMap.civicKinds, not by tile; variant = level 1–6, state = its wings.
  [RULER_HOUSE_ID]: { factory: createRulerHouse, category: 'services', footprint: [3, 3], tiles: [],
    budget: TRIANGLE_BUDGETS.special, regionTier: 'R1', variants: RULER_HOUSE_LEVELS },
  // Schools share the civic 3×3 and are placed the same way, from gameMap.civicKinds (RENDERER_SPEC 6H).
  ...Object.fromEntries(SCHOOL_KINDS.map(kind => [schoolId(kind), {
    factory: (options?: ModelOptions) => createSchool(kind, options), category: 'services', footprint: [3, 3], tiles: [],
    budget: SCHOOL_BUDGETS[kind], regionTier: 'R2',
  } as ModelRegistration])),
  // Hospitals share the civic 3×3 too (RENDERER_SPEC 6H): a health centre up to a regional hospital, from gameMap.civicKinds.
  ...Object.fromEntries(HOSPITAL_KINDS.map(kind => [hospitalId(kind), {
    factory: (options?: ModelOptions) => createHospitalCivic(kind, options), category: 'services', footprint: [3, 3], tiles: [],
    budget: HOSPITAL_BUDGETS[kind], regionTier: 'R2',
  } as ModelRegistration])),
  // The water supply (RENDERER_SPEC 6C): the water works' 3×3 and the one-tile water tower, by tile value.
  [WATER_WORKS_ID]: { factory: createWaterWorks, category: 'services', footprint: [3, 3], tiles: WATER_WORKS_TILES,
    budget: TRIANGLE_BUDGETS.lowRise, regionTier: 'R3' },
  [WATER_TOWER_ID]: { factory: createWaterTower, category: 'services', footprint: [1, 1], tiles: WATER_TOWER_TILES,
    budget: TRIANGLE_BUDGETS.prop, regionTier: 'R3' },
  // Rubbish and wastewater plants (RENDERER_SPEC 6I): the five kinds on tiles 992–1000, picked from gameMap.wasteKinds.
  ...Object.fromEntries(WASTE_KINDS.map(kind => [wasteId(kind), {
    factory: (options?: ModelOptions) => createWaste(kind, options), category: 'services', footprint: [3, 3], tiles: [],
    budget: WASTE_BUDGETS[kind], regionTier: 'R3',
  } as ModelRegistration])),
  'svc.stadium': { factory: createStadium, category: 'services', footprint: [4, 4],
    tiles: STADIUM_TILES, budget: TRIANGLE_BUDGETS.special, regionTier: 'R3', states: ['empty', 'game'] },
  'power.coal': { factory: createCoal, category: 'services', footprint: [4, 4],
    tiles: Array.from({ length: 16 }, (_, i) => 745 + i), budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'power.solar': { factory: createSolar, category: 'services', footprint: [4, 4],
    tiles: [], budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'power.wind': { factory: createWind, category: 'services', footprint: [4, 4],
    tiles: [], budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'power.gas': { factory: createGas, category: 'services', footprint: [4, 4],
    tiles: [], budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'power.hydro': { factory: createHydro, category: 'services', footprint: [4, 4],
    tiles: [], budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'power.nuclear': { factory: createNuclear, category: 'services', footprint: [4, 4],
    tiles: Array.from({ length: 16 }, (_, i) => 811 + i), budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'port.seaport': { factory: createSeaport, category: 'transport', footprint: [4, 4],
    tiles: Array.from({ length: 16 }, (_, i) => 693 + i), budget: TRIANGLE_BUDGETS.special, regionTier: 'R3' },
  'port.airport': { factory: createAirport, category: 'transport', footprint: [6, 6],
    tiles: Array.from({ length: 36 }, (_, i) => 709 + i), budget: TRIANGLE_BUDGETS.special, regionTier: 'R2' },
  'res.zone_empty': { factory: createEmptyResidentialZone, category: 'residential', footprint: [3, 3],
    tiles: Array.from({ length: 9 }, (_, i) => 240 + i), budget: TRIANGLE_BUDGETS.lowRise, regionTier: 'R2' },
  ...Object.fromEntries(RES_ZONE_SPECS.map(spec => [spec.id, {
    factory: (options?: ModelOptions) => createResidentialBlock(spec.landValue, spec.density, options),
    category: 'residential', footprint: [3, 3], tiles: spec.tiles, budget: spec.budget, regionTier: spec.regionTier,
  } as ModelRegistration])),
  ...Object.fromEntries(HOUSE_IDS.map((id, i) => [id, {
    factory: (options?: ModelOptions) => createHouse(i, options), category: 'residential', footprint: [1, 1],
    tiles: [249 + i], budget: TRIANGLE_BUDGETS.prop, regionTier: HOUSE_TIERS[i],
  } as ModelRegistration])),
  // Plot buildings: one-tile plots (แปลง) and two-by-two lots, placed by the city view's plots layer, not by tile values.
  ...Object.fromEntries(PLOT_SPECS.map(spec => [spec.id, {
    factory: (options?: ModelOptions) => createPlot(spec.id, options), category: spec.category, footprint: spec.footprint,
    tiles: [], budget: spec.budget, regionTier: spec.regionTier, variants: spec.variants,
  } as ModelRegistration])),
  'debug.region_house': { factory: createRegionHouse, category: 'debug', footprint: [1, 1], tiles: [],
    budget: TRIANGLE_BUDGETS.prop, regionTier: 'R1' },
  ...Object.fromEntries(POWER_KINDS.map(kind => [`power.${kind}`, {
    factory: (options?: ModelOptions) => createPower(kind, options), category: 'power', footprint: [1, 1],
    tiles: POWER_TILES[kind], budget: TRIANGLE_BUDGETS.tile, regionTier: 'R3', tiling: true,
    ...(kind === 'water' ? { ground: 'water' } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(ELEVATED_STYLES.flatMap(style => ELEVATED_KINDS.map(kind => [`rail.${style}_${kind}`, {
    factory: (options?: ModelOptions) => createElevatedRail(style, kind, options),
    category: 'rail', footprint: [1, 1], tiles: [], budget: TRIANGLE_BUDGETS.tile,
    regionTier: 'R3', tiling: true, ...(kind === 'ramp' ? { variants: [0, 1, 2] } : {}),
  } as ModelRegistration]))),
  'veh.train_hsr': { factory: createTrainHsr, category: 'veh', footprint: [1, 8], tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle, regionTier: 'R3' },
  'veh.metro': { factory: createMetro, category: 'veh', footprint: [1, 6], tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle, regionTier: 'R3' },
  ...Object.fromEntries(RAIL_KINDS.map(kind => [`rail.${kind}`, {
    factory: (options?: ModelOptions) => createRail(kind, options), category: 'rail', footprint: [1, 1],
    tiles: RAIL_TILES[kind], budget: TRIANGLE_BUDGETS.tile, regionTier: 'R3', tiling: true,
    ...(kind === 'bridge' ? { ground: 'bridge' } : {}),
    // Corner variants: which sides are steps of a staircase, so a slanted line runs straight (rail/track.ts).
    ...(kind === 'corner' ? { variants: [0, 1, 2, 3] } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(ROAD_KINDS.map(kind => [`road.${kind}`, {
    factory: (options?: ModelOptions) => createRoad(kind, options),
    category: 'road', footprint: [1, 1], tiles: ROAD_TILES[kind], budget: TRIANGLE_BUDGETS.tile,
    regionTier: 'R3', tiling: true,
    ...(kind.includes('bridge') ? { ground: 'bridge' } : {}),
    ...(['drawbridge', 'rail_crossing'].includes(kind) ? { states: ['closed', 'open'] } : {}),
    // Corner variants: which sides are steps of a staircase (models/road/centreline.ts).
    ...(kind === 'corner' ? { variants: STAIRCASE_VARIANTS } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(LATERITE_KINDS.map(kind => [`road.laterite_${kind}`, {
    factory: (options?: ModelOptions) => createLateriteRoad(kind, options),
    category: 'road', footprint: [1, 1], tiles: [], budget: TRIANGLE_BUDGETS.tile,
    regionTier: 'R3', tiling: true,
    ...(kind.includes('bridge') ? { ground: 'bridge' } : {}),
    ...(['drawbridge', 'rail_crossing'].includes(kind) ? { states: ['closed', 'open'] } : {}),
    ...(kind === 'corner' ? { variants: STAIRCASE_VARIANTS } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(TERRAIN_KINDS.map(kind => [`terrain.${kind}`, {
    factory: (options?: ModelOptions) => createTerrain(kind, options),
    category: 'terrain', footprint: [1, 1], tiles: TERRAIN_TILES[kind], budget: TRIANGLE_BUDGETS.tile,
    regionTier: 'R3', tiling: true,
    ...(['water', 'shore'].includes(kind) ? { ground: kind } : {}),
    ...(kind === 'woods' ? { seededVegetation: true } : {}),
    variants: ['shore', 'woods'].includes(kind) ? Array.from({ length: 16 }, (_, i) => i) :
      ['dirt', 'rubble', 'flood'].includes(kind) ? [0, 1, 2, 3] : [0],
  } as ModelRegistration])),
  ...Object.fromEntries(TREE_KINDS.map(kind => [`veg.${kind}`, {
    factory: (options?: ModelOptions) => createTree(kind, options),
    category: 'veg', footprint: TREE_FOOTPRINTS[kind], tiles: [], budget: TRIANGLE_BUDGETS.tree,
    regionTier: 'R3', seededVegetation: true,
    ...(kind === 'hedge' ? { tiling: true } : {}),
    ...(kind === 'mangrove' ? { ground: 'shore' } : {}),
  } as ModelRegistration])),
  ...Object.fromEntries(PARK_IDS.map((id, index) => [id, {
    factory: (options?: ModelOptions) => createPark(index, options),
    category: 'park', footprint: [1, 1], tiles: PARK_TILES[index], budget: TRIANGLE_BUDGETS.prop,
    regionTier: index === 2 ? 'R1' : 'R3', seededVegetation: index !== 4,
    ...(index === 4 ? { states: ['on', 'off'] } : {}),
  } as ModelRegistration])),
  'debug.box_3x3': {
    factory: createDebugBox,
    category: 'debug',
    footprint: [3, 3],
    tiles: [], // Debug assets never map to simulation tiles.
    budget: TRIANGLE_BUDGETS.lowRise,
    regionTier: 'R3',
    variants: [0, 1, 2, 3],
    states: ['solid', 'lit'],
  },
  'veh.train_loco': {
    factory: createTrainLoco,
    category: 'veh',
    footprint: [1, 2],
    tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle,
    regionTier: 'R3',
  },
  'veh.train_car': {
    factory: createTrainCar,
    category: 'veh',
    footprint: [1, 2],
    tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle,
    regionTier: 'R3',
  },
  'veh.helicopter': {
    factory: createHelicopter,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle,
    regionTier: 'R3',
  },
  'veh.airplane': {
    factory: createAirplane,
    category: 'veh',
    footprint: [3, 3],
    tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle,
    regionTier: 'R3',
  },
  'veh.ship': {
    factory: createShip,
    category: 'veh',
    footprint: [1, 4],
    tiles: [],
    budget: TRIANGLE_BUDGETS.largeVehicle,
    regionTier: 'R3',
  },
  'veh.sedan': {
    factory: createSedan,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.pickup': {
    factory: createPickup,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.tuktuk': {
    factory: createTuktuk,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.motorbike': {
    factory: createMotorbike,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.songthaew': {
    factory: createSongthaew,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R2',
  },
  'veh.bus': {
    factory: createBus,
    category: 'veh',
    footprint: [1, 2],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.truck': {
    factory: createTruck,
    category: 'veh',
    footprint: [1, 2],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.longtail_boat': {
    factory: createLongtailBoat,
    category: 'veh',
    footprint: [1, 2],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R3',
  },
  'veh.etan': {
    factory: createEtan,
    category: 'veh',
    footprint: [1, 1],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R2',
  },
  'veh.korlae_boat': {
    factory: createKorlaeBoat,
    category: 'veh',
    footprint: [1, 2],
    tiles: [],
    budget: TRIANGLE_BUDGETS.smallVehicle,
    regionTier: 'R2',
  },
});
