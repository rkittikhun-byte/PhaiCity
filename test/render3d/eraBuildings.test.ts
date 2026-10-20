/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ERA_KINDS, EraModels, eraKindFor, eraModelId, parseEraId, plotEraKind, serializeEraScene,
  type EraIndex } from '../../src/render3d/city/eraBuildings.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { plotTile } from '../../src/plots.js';
import { POWERBIT } from '../../src/tileFlags.js';

const REGIONS = ['north', 'northeast', 'central', 'east', 'west', 'south'];
const index = JSON.parse(readFileSync(resolve('assets/models/buildings/index.json'), 'utf8')) as EraIndex;

describe('era buildings (art/buildings exported for the game)', () => {
  it('has every kind of every era in every region, each a glb on disk', () => {
    for (let era = 1; era <= 5; era++) for (const region of REGIONS) for (const kind of ERA_KINDS) {
      const entry = index.buildings[`era${era}`]?.[region]?.[kind];
      expect(entry).toBeDefined();
      expect(entry!.height).toBeGreaterThan(0);
      expect(existsSync(resolve(`assets/models/buildings/era${era}/${region}/${kind}.glb`))).toBe(true);
    }
    expect(index.tileMetres).toBe(16);
    expect(existsSync(resolve('assets/draco/draco_wasm_wrapper.js'))).toBe(true);
    expect(readFileSync(resolve('assets/CREDITS.md'), 'utf8')).toContain('Draco');
  });

  // The export thins props to a fifth and the building to about a third at most, so a few dense ones stay a little over
  it('keeps the game light: about 4,500 triangles a plot, 11,000 a lot, 16,000 a service', () => {
    const budget: Record<number, number> = { 1: 4500, 2: 11000, 3: 16000 };
    for (const era of Object.values(index.buildings)) for (const region of Object.values(era))
      for (const [kind, entry] of Object.entries(region)) expect(entry.triangles).toBeLessThanOrEqual(budget[index.kinds[kind].tiles] * 1.35);
  });

  it('names models by era and kind', () => {
    expect(eraModelId(3, 'shop_2')).toBe('era.3.shop_2');
    expect(parseEraId('era.3.shop_2')).toEqual({ era: 3, kind: 'shop_2' });
    expect(parseEraId('plot.res_2')).toBeNull();
  });

  it('maps plots, lots and services to their era kinds', () => {
    expect(plotEraKind('residential', 1, false)).toBe('home_1');
    expect(plotEraKind('residential', 5, false)).toBe('home_4');
    expect(plotEraKind('residential', 4, true)).toBe('home_5');
    expect(plotEraKind('commercial', 5, true)).toBe('shop_5');
    expect(plotEraKind('industrial', 4, false)).toBe('factory_3');
    expect(plotEraKind('industrial', 3, true)).toBe('factory_4');
    expect(eraKindFor('civic.primary_school', undefined, 2)).toBe('school');
    expect(eraKindFor('civic.regional_hospital', undefined, 4)).toBe('hospital');
    expect(eraKindFor('civic.ruler_house', undefined, 1)).toBe('ruler_house');
    expect(eraKindFor('svc.police', undefined, 3)).toBe('police');
    expect(eraKindFor('water.works', undefined, 5)).toBe('water_works');
    expect(eraKindFor('waste.landfill', undefined, 3)).toBe('waste');
    expect(eraKindFor('waste.wastewater_plant', undefined, 3)).toBeNull();
    // A power plant or station takes the era's model only when it is the same sort of thing
    expect(eraKindFor('power.coal', undefined, 3)).toBe('power_plant');
    expect(eraKindFor('power.coal', undefined, 4)).toBeNull();
    expect(eraKindFor('power.gas', undefined, 4)).toBe('power_plant');
    expect(eraKindFor('power.solar', undefined, 5)).toBeNull();
    expect(eraKindFor('ind.block_0_0', 'station.train_station', 2)).toBe('station');
    expect(eraKindFor('ind.block_0_0', 'station.train_station', 4)).toBeNull();
    expect(eraKindFor('ind.block_0_0', 'station.metro_station', 4)).toBe('station');
    expect(eraKindFor('road.straight', undefined, 3)).toBeNull();
  });

  it('draws a painted plot with its era model once the index is in, in the city era, at its real size', () => {
    const width = 4, height = 4, values = new Uint16Array(width * height), flags = new Uint16Array(width * height);
    // A road along the top and a level-2 home below it
    for (let x = 0; x < width; x++) values[x] = 66;
    values[width + 1] = plotTile('residential', 2); flags[width + 1] = POWERBIT;
    const map = { width, height, values, flags, era: 3, paintedZones: true,
      getTileValue: (x: number, y: number) => values[y * width + x], getTileFlags: (x: number, y: number) => flags[y * width + x] };
    const s = new TileSnapshot(width, height);
    s.source = map as never; s.sync(map as never);
    const before = s.placement(width + 1, 'northeast');
    expect(before?.id).toBe('plot.res_2');
    s.eraModels = new EraModels(index);
    const after = s.placement(width + 1, 'northeast')!;
    expect(after.id).toBe('era.3.home_2');
    expect(after.height).toBe(index.buildings.era3.northeast.home_2.height);
    // Not a real-scale map: a 16 m model tile drawn in a 10-unit tile
    expect(after.scale).toBeCloseTo(10 / 16);
    // A map that keeps an era per tile draws that tile in its own era
    (map as { buildingEras?: Uint8Array }).buildingEras = Object.assign(new Uint8Array(width * height), { [width + 1]: 1 });
    expect(s.placement(width + 1, 'northeast')!.id).toBe('era.1.home_2');
  });

  it('turns a glb scene into a city prototype: flat-coloured body and lit windows', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 4, 0]), 3));
    geometry.setAttribute('color', new BufferAttribute(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]), 4, true));
    const root = new Group(), body = new Mesh(geometry, new MeshBasicMaterial()), windows = new Mesh(geometry.clone(), new MeshBasicMaterial());
    body.name = 'body'; windows.name = 'windows'; root.add(body, windows);
    const proto = serializeEraScene('k', root);
    expect(proto.height).toBe(4);
    expect(proto.parts.map(p => p.material.data.eraBuilding)).toEqual(['body', 'windows']);
    expect(proto.parts[1].material.key).toBe('emissive_window');
    expect(proto.parts[0].attributes.color.size).toBe(3);
    expect(Array.from(proto.parts[0].attributes.color.array.slice(0, 3))).toEqual([1, 0, 0]);
  });
});
