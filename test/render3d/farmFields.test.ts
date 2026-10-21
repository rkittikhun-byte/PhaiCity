/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The farm zone's fields in 3D (src/render3d/city/farmFields.ts): their ground by kind and month, the era's props, the
// cooperative, rice mill or cold store a farm building becomes, and nothing written to the map.

import { InstancedMesh, Mesh, type BufferAttribute } from 'three';
import { CityFarmFields, cropHeight, FARM_DETAIL_DISTANCE, paddyColour } from '../../src/render3d/city/farmFields';
import { fieldTile, kindCode } from '../../src/farmZone';
import { FARM, FIELD_BASE } from '../../src/tileValues';
import { TileSnapshot } from '../../src/render3d/city/tileModels';
import { ZONEBIT } from '../../src/tileFlags';

const W = 40, H = 30;

function newMap(era = 1) {
  const values = new Uint16Array(W * H), farmKinds = new Uint8Array(W * H);
  const grow = (x: number, y: number, level: number, kind: 'paddy' | 'field' | 'orchard' | 'pond') => {
    values[y * W + x] = fieldTile(level);
    farmKinds[y * W + x] = kindCode(kind);
  };
  for (let x = 2; x < 20; x++) for (let y = 2; y < 6; y++) grow(x, y, 2, 'paddy');
  for (let x = 2; x < 20; x++) for (let y = 8; y < 10; y++) grow(x, y, 3, 'field');
  for (let x = 2; x < 20; x++) grow(x, 12, 2, 'orchard');
  for (let x = 2; x < 20; x++) grow(x, 14, 3, 'pond');
  values[20 * W + 5] = fieldTile(0);
  return { width: W, height: H, values, farmKinds, era, getTileValue: (x: number, y: number) => values[y * W + x] };
}

const flat = { sample: () => 0 };
const MAY = 4, OCTOBER = 9;

describe('the farm zone in 3D', () => {
  test('paddies are water when planted, green in the rains and gold at the harvest; crops grow with the rains', () => {
    expect(paddyColour(MAY, 3).getHex()).not.toBe(paddyColour(OCTOBER, 3).getHex());
    expect(paddyColour(7, 3).getHex()).not.toBe(paddyColour(OCTOBER, 3).getHex());
    expect(cropHeight(1)).toBeLessThan(cropHeight(10));
  });

  test('draws every field\'s ground in one mesh and its things instanced, and only near the camera', () => {
    const map = newMap(1), before = map.values.slice();
    const view = new CityFarmFields(map, flat);
    view.update([], MAY, 300, 0);
    const counts = view.counts();
    expect(counts.fields).toBe(18 * 4 + 18 * 2 + 18 + 18 + 1);
    expect(counts.row).toBe(18 * 2 * 4);
    expect(counts.tree).toBe(18 * 4);
    expect(counts.aerator).toBe(18);
    // The village era's buffalo and field huts, no machines
    expect(counts.buffalo).toBeGreaterThan(0);
    expect(counts.tractor ?? 0).toBe(0);
    const meshes: string[] = [];
    view.root.traverse((o) => { if (o instanceof Mesh || o instanceof InstancedMesh) meshes.push(o.name); });
    expect(meshes.filter((n) => n === 'farm_fields/ground')).toHaveLength(1);
    // A draw call a material for each kind of thing, not one a field
    expect(meshes.length).toBeLessThan(20);
    view.update([], MAY, FARM_DETAIL_DISTANCE + 1, 1);
    expect(view.root.children.find((c) => c.name === 'farm_details')!.visible).toBe(false);
    expect(map.values).toEqual(before);
    view.dispose();
  });

  test('turns gold when the month comes, and takes the era\'s machines when the city moves on', () => {
    const map = newMap(1);
    const view = new CityFarmFields(map, flat);
    view.update([], MAY, 300, 0);
    const ground = view.root.children.find((c) => c.name === 'farm_fields/ground') as Mesh;
    const colours = (ground.geometry.getAttribute('color') as BufferAttribute).array.slice();
    view.update([], OCTOBER, 300, 1);
    expect((ground.geometry.getAttribute('color') as BufferAttribute).array).not.toEqual(colours);
    map.era = 3;
    view.update([], OCTOBER, 300, 2);
    expect(view.counts().tractor).toBeGreaterThan(0);
    expect(view.counts().buffalo ?? 0).toBe(0);
    map.era = 5;
    view.update([], OCTOBER, 300, 3);
    expect(view.counts().drone).toBeGreaterThan(0);
    expect(view.counts().solar).toBeGreaterThan(0);
    view.dispose();
  });

  test('is drawn again a little after a field changes, and names the farm buildings to draw again', () => {
    const map = newMap(1);
    map.values[25 * W + 30] = FARM;
    const view = new CityFarmFields(map, flat);
    view.update([], MAY, 300, 0);
    map.values[20 * W + 6] = FIELD_BASE;
    expect(view.update([20 * W + 6], MAY, 300, 0.1)).toEqual([]);
    expect(view.counts().fields).toBe(18 * 8 + 1);
    expect(view.update([], MAY, 300, 1)).toEqual([25 * W + 30]);
    expect(view.counts().fields).toBe(18 * 8 + 2);
    view.dispose();
  });
});

describe('the tiles of the farm zone and its farm buildings', () => {
  test("a field has no tile model of its own; a farm is its fields' rice mill, cold store or cooperative", () => {
    const map = newMap(1), flags = new Uint16Array(W * H);
    const centre = (x: number, y: number) => { map.values[y * W + x] = FARM; flags[y * W + x] = ZONEBIT; return y * W + x; };
    const mill = centre(10, 7), store = centre(10, 24), coop = centre(33, 25);
    const reader = { ...map, getTileFlags: (x: number, y: number) => flags[y * W + x] };
    const snapshot = new TileSnapshot(W, H);
    snapshot.source = reader as never;
    snapshot.sync(reader as never);
    expect(snapshot.placement(3 * W + 3, 'central')).toBeNull();
    expect(snapshot.placement(mill, 'central')?.id).toBe('ind.block_0_0');
    expect(snapshot.placement(store, 'central')?.id).toBe('ind.block_1_3');
    expect(snapshot.placement(coop, 'central')?.id).toBe('ind.block_1_0');
  });
});
