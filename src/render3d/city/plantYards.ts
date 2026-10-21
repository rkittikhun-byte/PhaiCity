/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The yards round the city's power plants and water works (models/services/plant-yard.ts; owner, 21 Oct 2026): which
// plant stands in which kind of yard, the yard placed as a part of the plant's placement so it fills the plant's block,
// and the yards' models made on the page with lighter copies for far away (lod.ts), so the city's pools draw every
// yard of a kind and era together and a far one costs a fraction of its triangles (RENDERER_SPEC §8B).

import type { Object3D } from 'three';
import { createPlantYard, holeState, YARD_HEIGHTS, YARD_KINDS, YARD_TILE_METRES, YARD_TILES, yardFits, yardId,
  type YardHole, type YardKind } from '../models/services/plant-yard.js';
import { disposeModel } from '../util/geometry.js';
import { parseEraId, serializeEraScene, type EraModels } from './eraBuildings.js';
import { loadSimplifier } from './lod.js';
import { Placement, RoadsidePlacement } from './placement.js';
import type { PrototypeProvider, SerializedPrototype } from './prototypes.js';

/** The yard each plant's model stands in, by the id the tile reader gives it before its era model (tileModels.ts) */
export const PLANT_YARDS: Readonly<Record<string, YardKind>> = {
  'power.coal': 'coal', 'power.gas': 'gas', 'power.solar': 'solar', 'power.wind': 'wind', 'power.hydro': 'hydro',
  'power.nuclear': 'nuclear', 'water.works': 'water', 'waste.waste_power_plant': 'waste_power',
};
/** The procedural plants that leave their own fence out when they stand in a yard (models/services/solar.ts) */
export const FENCED_BY_YARD: ReadonlySet<string> = new Set(['power.solar', 'power.wind', 'power.gas']);

/**
 * The plant's placement with its yard among its parts, filling its block round it (null when it has none): `plant` is
 * the id the tile reader gave it, `units` the world units a metre its block is drawn at (10 a 16 m tile), `era` the era
 * its building is drawn in. The yard stands with its block's front at the building's front when the building stands
 * against its road, else round its middle, turned with it; its hole is the square the building is drawn on.
 */
export function withPlantYard(p: Placement | null, plant: string | null, units: number, era: number,
  eraModels: EraModels | null): Placement | null {
  const kind = plant ? PLANT_YARDS[plant] : undefined;
  if (!p || !kind || p.index < 0 || p.id?.startsWith('site.')) return p;
  const tiles = YARD_TILES[kind];
  if (Math.max(p.footprint[0], p.footprint[1]) !== tiles) return p;
  // The building's half side as drawn, in metres: an era model 16 m a tile less half a metre clear, a procedural one
  // 10 units a tile less half a unit, at the share of its tiles it fills (tileModels.ts atRealSize)
  const eraId = parseEraId(p.id), eraKind = eraId ? eraModels?.index.kinds[eraId.kind] : undefined;
  const hw = eraKind ? (eraKind.tiles * (eraModels!.index.tileMetres ?? YARD_TILE_METRES) / 2 - 0.5) * p.scale / units
    : (tiles * 5 - 0.5) * (p.fill ?? 1) / units;
  const half = tiles * YARD_TILE_METRES / 2, hole: YardHole = { hw, c: p.posed ? half - hw : 0 };
  if (!yardFits(kind, hole)) return p;
  // the yard's middle, behind the building's by as much as the building stands ahead of the block's
  const back = hole.c * units, x = p.x - Math.sin(p.rotation) * back, z = p.z - Math.cos(p.rotation) * back;
  const fields = { index: p.index, x, z, id: yardId(kind), kind: 'services', footprint: [tiles, tiles] as const,
    height: YARD_HEIGHTS[kind], color: p.color, water: false, rotation: p.rotation, scale: units * YARD_TILE_METRES / 10,
    fill: 1, powered: p.powered, options: { ...p.options, seed: 0, region: 'central' as const, variant: Math.max(1, Math.min(5, era)),
      state: holeState(hole), worldOrigin: [x, z] as [number, number], worldRotationY: p.rotation } };
  const yard = p.posed ? new RoadsidePlacement(fields) : new Placement(fields);
  if (!eraKind && plant && FENCED_BY_YARD.has(plant)) p.options = { ...p.options, state: 'yard' };
  p.parts = [...(p.parts ?? []), yard];
  return p;
}

/** Makes the yards' models on the page, with their lighter copies; every other model goes to `inner` */
export function yardPrototypeProvider(inner: PrototypeProvider): PrototypeProvider {
  const ready: SerializedPrototype[] = [];
  let disposed = false;
  const kinds = new Map(YARD_KINDS.map(kind => [yardId(kind), kind]));
  return {
    request(request) {
      const kind = kinds.get(request.id);
      if (!kind) { inner.request(request); return; }
      loadSimplifier().then(simplifier => {
        if (disposed) return;
        let root: Object3D | null = null;
        try {
          root = createPlantYard(kind, { ...request.options, worldOrigin: [0, 0], worldRotationY: 0 });
          ready.push(serializeEraScene(request.key, root, simplifier));
        } finally { if (root) disposeModel(root); }
      }).catch(error => { if (!disposed) ready.push({ key: request.key, parts: [], height: 0, error: String(error) }); });
    },
    take(): SerializedPrototype[] { return [...inner.take(), ...ready.splice(0)]; },
    dispose(): void { disposed = true; ready.length = 0; inner.dispose(); },
  };
}
