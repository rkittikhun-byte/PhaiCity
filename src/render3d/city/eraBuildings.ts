/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The era buildings (owner, 20 Oct 2026; art/buildings/IMPORT.md): every home, shop, factory and service drawn in the
// look of the city's era (gameMap.era, src/era.ts) and region, from the Blender models in art/buildings, exported as
// assets/models/buildings/era<n>/<region>/<kind>.glb (Draco, flat colours in vertex colours, real metres, a 16 m tile).
//
// A placement whose building has an era model takes the id `era.<n>.<kind>` (TileSnapshot.toEra in tileModels.ts);
// eraPrototypeProvider loads that glb on the page and hands it to the city's chunks like any model the worker builds.
// Until the index has loaded, and for anything without an era model, the procedural models stay.
//
// Which era a building is drawn in: the city's era for now. How a city moves between eras a little at a time, and
// how each building reaches its level, are for the owner to settle (owner, 20 Oct 2026); a map may later keep an era
// per tile as `buildingEras` (1-5, 0 for none) and every building follows it with nothing else here changing.

import { BufferAttribute, type BufferGeometry, type Mesh, type Object3D } from 'three';
import type { RegionId } from '../regional/types.js';
import type { PrototypeProvider, PrototypeRequest, SerializedPart, SerializedPrototype } from './prototypes.js';
import { loadSimplifier, makeLevels, makeShadow, type Simplifier } from './lod.js';

export const ERA_BUILDINGS_BASE = 'assets/models/buildings/';
export const DRACO_DECODER_PATH = 'assets/draco/';

export const ERA_KINDS = ['home_1', 'home_2', 'home_3', 'home_4', 'home_5', 'shop_1', 'shop_2', 'shop_3', 'shop_4', 'shop_5',
  'factory_1', 'factory_2', 'factory_3', 'factory_4', 'ruler_house', 'school', 'hospital', 'police', 'fire', 'water_works',
  'power_plant', 'waste', 'station', 'market'] as const;
export type EraKind = typeof ERA_KINDS[number];
/** A temple's era models by its level (src/temples.ts; art/buildings/scripts/buildings/temples.py), a set of their own */
export const TEMPLE_KINDS = ['temple_1', 'temple_2', 'temple_3'] as const;
export type TempleKind = typeof TEMPLE_KINDS[number];

/** The era models by frontage (frontage.ts; art/buildings/scripts/lib/builder.py FRONTAGE): a shophouse bay one 4 m
 * cell wide in its place in a terrace, in the era's lower row (bay1) and its taller one (bay2), and a 12 m house */
export const BAY_PLACES = ['one', 'left', 'mid', 'mid2', 'right'] as const;
export type BayPlace = typeof BAY_PLACES[number];
export const FRONTAGE_KINDS = [...[1, 2].flatMap(h => BAY_PLACES.map(p => `bay${h}_${p}`)), 'house12_1', 'house12_2'] as const;
export type FrontageKind = typeof FRONTAGE_KINDS[number];

export interface EraIndex {
  readonly version: number;
  readonly tileMetres: number;
  /** Each kind's tiles; a frontage kind's frontage and depth in metres too */
  readonly kinds: Readonly<Record<string, { tiles: number; width?: number; depth?: number }>>;
  /** era<n> -> region -> kind -> its height (metres) and triangles */
  readonly buildings: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, { height: number; triangles: number }>>>>>>;
}

/** The era models the index lists, asked by era, region and kind */
export class EraModels {
  /** Whether the index has any frontage models (frontage.ts: shophouse bays, the 12 m house) */
  readonly hasFrontage: boolean;
  constructor(readonly index: EraIndex) {
    this.hasFrontage = Object.values(index.buildings).some(era => Object.values(era).some(region => 'bay1_one' in region));
  }
  /** The model's height in metres, null when there is none for that era and region */
  height(era: number, region: string, kind: string): number | null {
    return this.index.buildings[`era${era}`]?.[region]?.[kind]?.height ?? null;
  }
}

export const eraModelId = (era: number, kind: string): string => `era.${era}.${kind}`;
export function parseEraId(id: string | null | undefined): { era: number; kind: string } | null {
  const m = /^era\.([1-5])\.([a-z_0-9]+)$/.exec(id ?? '');
  return m ? { era: Number(m[1]), kind: m[2] } : null;
}

const SCHOOLS = new Set(['kindergarten', 'primary_school', 'secondary_school', 'vocational_college', 'university']);
const HOSPITALS = new Set(['health_centre', 'community_hospital', 'provincial_hospital', 'regional_hospital']);

/**
 * The era model a building is drawn with, or null for one that keeps its own model. `hint` is what the tile reader
 * knows beyond the model id: `home_3`, `shop_5` ... for a painted plot or lot, `station.<kind>` for a station.
 * Power plants and stations use the era's model only when it is the same sort of thing (the era's power plant is a
 * water mill, a steam house, a lignite plant, a gas plant, a clean future plant; its station a landing, a halt, a
 * railway station, then elevated rail), so a solar farm or a dam keeps its own.
 */
export function eraKindFor(id: string | null, hint: string | undefined, era: number): EraKind | TempleKind | null {
  if (hint) {
    if (hint.startsWith('station.')) {
      const sk = hint.slice(8);
      if (sk === 'train_station') return era === 2 || era === 3 ? 'station' : null;
      return era >= 4 ? 'station' : null;
    }
    if ((TEMPLE_KINDS as readonly string[]).includes(hint)) return hint as TempleKind;
    return (ERA_KINDS as readonly string[]).includes(hint) ? hint as EraKind : null;
  }
  if (!id) return null;
  if (id === 'civic.ruler_house') return 'ruler_house';
  if (id.startsWith('civic.')) {
    const kind = id.slice(6);
    if (SCHOOLS.has(kind)) return 'school';
    if (HOSPITALS.has(kind)) return 'hospital';
    return null;
  }
  if (id === 'svc.hospital') return 'hospital';
  if (id === 'svc.police') return 'police';
  if (id === 'svc.fire') return 'fire';
  if (id === 'water.works') return 'water_works';
  if (id === 'power.coal') return era <= 3 ? 'power_plant' : null;
  if (id === 'power.gas') return era >= 4 ? 'power_plant' : null;
  if (id === 'power.nuclear') return era === 5 ? 'power_plant' : null;
  if (id.startsWith('waste.')) return id === 'waste.wastewater_plant' ? null : 'waste';
  return null;
}

/** The kind of a painted plot's building by its kind and level: one-tile homes and shops go to level 4, factories
 * to 3; a 2 x 2 lot is the top kind */
export function plotEraKind(plot: 'residential' | 'commercial' | 'industrial', level: number, lot: boolean): EraKind {
  if (plot === 'residential') return lot ? 'home_5' : `home_${Math.max(1, Math.min(4, level))}` as EraKind;
  if (plot === 'commercial') return lot ? 'shop_5' : `shop_${Math.max(1, Math.min(4, level))}` as EraKind;
  return lot ? 'factory_4' : `factory_${Math.max(1, Math.min(3, level))}` as EraKind;
}

/** The index of every exported building, or null when it is missing (the procedural models stay) */
export async function loadEraIndex(base = ERA_BUILDINGS_BASE): Promise<EraIndex | null> {
  try {
    const response = await fetch(base + 'index.json');
    if (!response.ok) return null;
    const index = await response.json() as EraIndex;
    return index && index.buildings ? index : null;
  } catch {
    return null;
  }
}

/** A loaded glb's meshes as the parts of a city prototype: body (flat colours) and windows (lit at night), and with a
 * simplifier its lighter copies for far away (lod.ts), which the city's chunks draw by distance */
export function serializeEraScene(key: string, scene: Object3D, simplifier: Simplifier | null = null): SerializedPrototype {
  scene.updateMatrixWorld(true);
  const parts: SerializedPart[] = [];
  let top = 0;
  scene.traverse(node => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const geometry = (mesh.geometry as BufferGeometry).clone().applyMatrix4(mesh.matrixWorld);
    const attributes: SerializedPart['attributes'] = {};
    for (const name of ['position', 'color'] as const) {
      const source = geometry.getAttribute(name) as BufferAttribute | undefined;
      if (!source) continue;
      const size = name === 'color' ? 3 : source.itemSize;
      const array = new Float32Array(source.count * size);
      for (let i = 0; i < source.count; i++) {
        array[i * size] = source.getX(i);
        array[i * size + 1] = source.getY(i);
        if (size > 2) array[i * size + 2] = source.getZ(i);
      }
      attributes[name] = { array, size };
    }
    if (!attributes.position) return;
    if (!attributes.color) {
      const white = new Float32Array(geometry.getAttribute('position').count * 3).fill(1);
      attributes.color = { array: white, size: 3 };
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const box = geometry.boundingBox!, sphere = geometry.boundingSphere!;
    top = Math.max(top, box.max.y);
    const windows = /window/i.test(mesh.name) || /window/i.test(mesh.parent?.name ?? '');
    parts.push({
      attributes,
      index: geometry.index ? new Uint32Array(geometry.index.array) : null,
      material: { key: windows ? 'emissive_window' : 'stucco_ornament', name: `era-building-${windows ? 'windows' : 'body'}`,
        // the colour is the vertices' (eraBuildingMaterial); this one is not read
        color: 0, data: { eraBuilding: windows ? 'windows' : 'body' } },
      // The window panes lie on the walls, inside the body's own shadow: casting theirs too would only cost a draw
      castShadow: !windows, receiveShadow: true,
      bounds: { min: box.min.toArray(), max: box.max.toArray(), center: sphere.center.toArray(), radius: sphere.radius },
    });
    geometry.dispose();
  });
  const sources = parts.map(p => ({ attributes: p.attributes, index: p.index }));
  const lods = simplifier ? makeLevels(sources, simplifier) : [];
  // ... and the shadow's, much lighter, as the shadow map sees no crease or colour
  return { key, parts, height: top, ...(lods.length ? { lods } : {}), ...(simplifier ? { shadow: makeShadow(sources, simplifier) } : {}) };
}

/** Loads era models on the page (GLTFLoader with Draco); every other model goes to `inner`, the model worker. */
export function eraPrototypeProvider(inner: PrototypeProvider, base = ERA_BUILDINGS_BASE, decoder = DRACO_DECODER_PATH): PrototypeProvider {
  const ready: SerializedPrototype[] = [];
  let disposed = false;
  let loader: Promise<{ loadAsync(url: string): Promise<{ scene: Object3D }> }> | null = null;
  const getLoader = () => loader ??= (async () => {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/loaders/DRACOLoader.js')]);
    const draco = new DRACOLoader();
    draco.setDecoderPath(decoder);
    const gltf = new GLTFLoader();
    gltf.setDRACOLoader(draco);
    return gltf;
  })();
  return {
    request(request: PrototypeRequest): void {
      const era = parseEraId(request.id);
      if (!era) { inner.request(request); return; }
      const region = (request.options.region ?? 'central') as RegionId;
      const url = `${base}era${era.era}/${region}/${era.kind}.glb`;
      Promise.all([getLoader().then(gltf => gltf.loadAsync(url)), loadSimplifier()]).then(([result, simplifier]) => {
        if (!disposed) ready.push(serializeEraScene(request.key, result.scene, simplifier));
      }).catch(error => {
        if (!disposed) ready.push({ key: request.key, parts: [], height: 0, error: String(error) });
      });
    },
    take(): SerializedPrototype[] { return [...inner.take(), ...ready.splice(0)]; },
    dispose(): void { disposed = true; ready.length = 0; inner.dispose(); },
  };
}
