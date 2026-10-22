/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The era vehicles (src/render3d/city/eraVehicles.ts, art/vehicles): which vehicles drive in each era and region and
// in what shares, the next era's few in a transition, the bus of public transport, the exported models' budgets and
// sizes, and the instanced pool that draws them with their wheels and a lighter copy far off.

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { BoxGeometry, BufferAttribute, Group, Matrix4, Mesh, Vector3 } from 'three';
import {
  ERA_MIX, EraVehicles, nextEraShare, paintFor, pickVehicle, REGION_MIX, transitVehicle, VEHICLE_BUDGET, type VehicleEntry,
  type VehicleIndex, vehicleMix, vehicleModel, VehiclePool, WHEELS_BUDGET,
} from '../../src/render3d/city/eraVehicles.js';
import { REGIONS } from '../../src/render3d/regional/types.js';

const ROOT = join(__dirname, '..', '..');
const index = JSON.parse(readFileSync(join(ROOT, 'assets/models/vehicles/index.json'), 'utf8')) as VehicleIndex;
const kindOf = (id: string) => id.split('/')[1];
const eraOf = (id: string) => Number(id.slice(3, 4));

/** A stand-in model: a box body, paint and lights, one wheel set */
function fakeScene(): Group {
  const scene = new Group();
  for (const name of ['body', 'paint', 'lights', 'wheel0']) {
    const g = new BoxGeometry(1, 1, 1);
    g.setAttribute('color', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
    const mesh = new Mesh(g);
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}

describe('which vehicles drive in each era and region', () => {
  test('every vehicle a mix or the transit names is exported, and each mix adds up to 1', () => {
    for (const region of REGIONS) for (let era = 1; era <= 5; era++) {
      const mix = vehicleMix(era, region);
      expect(mix.reduce((a, m) => a + m.share, 0)).toBeCloseTo(1, 6);
      for (const { id } of mix) expect(index.vehicles[id]).toBeDefined();
      expect(index.vehicles[transitVehicle(era, region)]).toBeDefined();
      // never a vehicle of a later era
      for (const { id } of mix) expect(eraOf(id)).toBeLessThanOrEqual(era);
    }
  });

  test('carts only in the first two eras, nothing with an engine in the first, flyers only in the future', () => {
    for (const region of REGIONS) for (let era = 1; era <= 5; era++) {
      const kinds = vehicleMix(era, region).map(m => kindOf(m.id));
      const carts = kinds.filter(k => k.endsWith('_cart') && k !== 'hand_cart');
      if (era >= 3) expect(carts).toEqual([]);
      if (era === 1) expect(kinds.every(k => ['bicycle', 'buffalo_cart', 'ox_cart', 'hand_cart'].includes(k))).toBe(true);
      const flyers = vehicleMix(era, region).filter(m => index.vehicles[m.id].fly > 0);
      expect(flyers.length > 0).toBe(era === 5);
    }
  });

  test('motorcycles are the most of anything in the factory town; cars lead in the modern city', () => {
    const share = (era: number, test: (kind: string) => boolean) =>
      vehicleMix(era, 'central').filter(m => test(kindOf(m.id))).reduce((a, m) => a + m.share, 0);
    const motorcycles = share(3, k => k.startsWith('motorcycle'));
    expect(motorcycles).toBeGreaterThan(share(3, k => k.startsWith('pickup')));
    expect(motorcycles).toBeGreaterThan(share(2, k => k.startsWith('motorcycle')));
    expect(share(4, k => ['sedan', 'hatchback', 'taxi'].includes(k))).toBeGreaterThan(share(3, k => k === 'pickup'));
  });

  test('regional vehicles only in their region: the south\'s wooden bus, Isan\'s etan; the north\'s red songthaew', () => {
    for (const region of REGIONS) for (let era = 1; era <= 5; era++) {
      const ids = vehicleMix(era, region).map(m => m.id);
      if (region !== 'south') expect(ids).not.toContain('era2/pothong');
      if (region !== 'northeast') expect(ids).not.toContain('era2/etan');
    }
    expect(vehicleMix(2, 'south').map(m => m.id)).toContain('era2/pothong');
    expect(vehicleMix(2, 'northeast').map(m => m.id)).toContain('era2/etan');
    const songthaew = index.vehicles['era2/songthaew'];
    for (let k = 0; k < 10; k++) expect(paintFor('era2/songthaew', songthaew, 'north', k / 10)).toBe(songthaew.paints[0]);
    expect(paintFor('era2/songthaew', songthaew, 'east', 0.5)).toBe(songthaew.paints[1]);
    expect(transitVehicle(2, 'north')).toBe('era2/songthaew');
    expect(transitVehicle(2, 'central')).toBe('era2/bus');
    expect(transitVehicle(1, 'central')).toBe('era2/bus');
    expect(transitVehicle(5, 'south')).toBe('era5/pod_bus');
    // a livery stays as modelled
    expect(paintFor('era2/bus', index.vehicles['era2/bus'], 'central', 0.3)).toBeNull();
    // the region tables name only exported vehicles
    for (const r of Object.values(REGION_MIX)) for (const m of Object.values(r)) for (const id of Object.keys(m)) expect(index.vehicles[id]).toBeDefined();
    for (const m of Object.values(ERA_MIX)) for (const id of Object.keys(m)) expect(index.vehicles[id]).toBeDefined();
  });

  test('in a transition the next era\'s come in by the share of the buildings already in it', () => {
    expect(nextEraShare(2, Uint8Array.from([0, 2, 2, 3, 0, 2]))).toBeCloseTo(0.25);
    expect(nextEraShare(5, Uint8Array.from([5, 5]))).toBe(0);
    expect(nextEraShare(3, null)).toBe(0);
    let next = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (eraOf(pickVehicle(1, 'central', 0.2, (i * 0.618) % 1, (i * 0.377) % 1)) === 2) next++;
    // a fifth of the cars take the next era's mix, which still has a few of the first era's
    expect(next / n).toBeGreaterThan(0.1);
    expect(next / n).toBeLessThan(0.22);
    for (let i = 0; i < 100; i++) expect(eraOf(pickVehicle(1, 'central', 0, i / 100, i / 100))).toBe(1);
  });
});

describe('the exported vehicles', () => {
  test('within the game\'s budget, each with its glb', () => {
    for (const [id, v] of Object.entries(index.vehicles)) {
      expect(existsSync(join(ROOT, 'assets/models/vehicles', id + '.glb'))).toBe(true);
      expect(v.triangles).toBeLessThanOrEqual(VEHICLE_BUDGET[v.class]);
      const wheels = v.wheels.reduce((a, w) => a + w.triangles * w.at.length, 0);
      expect(wheels).toBeLessThanOrEqual(WHEELS_BUDGET);
      expect(v.wheels.length).toBeGreaterThan(0);
    }
  });

  test('at real size: a pickup about 5.3 m, a tuk-tuk under 3 m, a bus 10-12.5 m, a bicycle under 2 m', () => {
    const v = (id: string): VehicleEntry => index.vehicles[id];
    expect(v('era3/pickup').length).toBeGreaterThan(4.9); expect(v('era3/pickup').length).toBeLessThan(5.8);
    expect(v('era4/pickup').length).toBeGreaterThan(5.0); expect(v('era4/pickup').length).toBeLessThan(5.9);
    expect(v('era3/tuktuk').length).toBeGreaterThan(2.5); expect(v('era3/tuktuk').length).toBeLessThan(3.1);
    for (const bus of ['era2/bus', 'era3/bus', 'era4/bus']) {
      expect(v(bus).length).toBeGreaterThan(10); expect(v(bus).length).toBeLessThan(12.6);
      expect(v(bus).height).toBeGreaterThan(2.9); expect(v(bus).height).toBeLessThan(3.6);
    }
    expect(v('era1/bicycle').length).toBeLessThan(2.1);
    expect(v('era4/hatchback').length).toBeLessThan(v('era4/sedan').length);
    // wheels turn about their axle, a rotor about the upright; their radius real
    expect(v('era3/pickup').wheels[0].radius).toBeCloseTo(0.36, 2);
    expect(v('era5/flying_taxi').wheels[0].axis).toBe('z');
    expect(v('era5/flying_taxi').fly).toBeGreaterThan(10);
  });
});

describe('the pool that draws them', () => {
  const entry = index.vehicles['era3/pickup'];
  const model = vehicleModel('era3/pickup', entry, fakeScene());

  test('a vehicle is its parts and its wheels, each wheel at its place turned by the spin', () => {
    const pool = new VehiclePool();
    pool.ensure(model, 10);
    pool.begin();
    const m = new Matrix4().makeTranslation(100, 0, 50);
    expect(pool.add('era3/pickup', m, '#ff0000', 0, 10, 1000, 1)).toBe(true);
    expect(pool.add('era3/pickup', m, null, Math.PI / 2, 10, 1000, 1)).toBe(true);
    pool.end();
    const meshes = pool.root.children as any[];
    const wheel = meshes[meshes.length - 1];
    expect(wheel.count).toBe(2 * entry.wheels[0].at.length);
    const body = meshes[0];
    expect(body.count).toBe(2);
    const at = new Matrix4(), p = new Vector3();
    wheel.getMatrixAt(0, at); p.setFromMatrixPosition(at);
    expect(p.x).toBeCloseTo(100 + entry.wheels[0].at[0][0], 4);
    expect(p.z).toBeCloseTo(50 + entry.wheels[0].at[0][2], 4);
    // the paint is tinted per car (white where the kind keeps its colour)
    const paint = meshes[1];
    expect(paint.instanceColor).toBeTruthy();
    expect(paint.instanceColor.getX(0)).toBeGreaterThan(0.9);
    expect(paint.instanceColor.getY(0)).toBeLessThan(0.1);
    expect(pool.drawn).toBe(2);
  });

  test('no more than its room, and none of a model it has no room for', () => {
    const pool = new VehiclePool();
    pool.ensure(model, 3);
    pool.begin();
    let added = 0;
    for (let i = 0; i < 10; i++) if (pool.add('era3/pickup', new Matrix4(), null, 0, 1, 1000, 1)) added++;
    expect(added).toBe(3);
    expect(pool.add('era1/bicycle', new Matrix4(), null, 0, 1, 1000, 1)).toBe(false);
  });

  test('far off, the lighter copy', () => {
    const light = { ...model, levels: [model.levels[0], { ...model.levels[0], error: 0.1 }] };
    const pool = new VehiclePool();
    pool.ensure(light, 4);
    pool.begin();
    pool.add('era3/pickup', new Matrix4(), null, 0, 10, 1000, 0.625);
    pool.add('era3/pickup', new Matrix4(), null, 0, 500, 1000, 0.625);
    pool.end();
    const draws = (pool as any).draws.get('era3/pickup').levels;
    expect(draws[0].count).toBe(1);
    expect(draws[1].count).toBe(1);
  });

  test('the models load once, and a plain object of one has its wheels at their places', async () => {
    let loads = 0;
    const vehicles = new EraVehicles(index, 'x/', async () => { loads++; return { scene: fakeScene() }; }, Promise.resolve(null));
    expect(vehicles.model('era4/van')).toBeNull();
    expect(vehicles.model('era4/van')).toBeNull();
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    expect(loads).toBe(1);
    expect(vehicles.model('era4/van')).not.toBeNull();
    const object = vehicles.object('era4/van', '#ffffff')!;
    const wheels = object.children.filter(c => c.name.startsWith('wheel0.'));
    expect(wheels.length).toBe(index.vehicles['era4/van'].wheels[0].at.length);
  });
});
