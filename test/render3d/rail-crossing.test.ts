/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The railway through Mueang Khon Kaen and its level crossing with the laterite road from the north, at tile (202, 156)
// of the city the game starts there (owner, 18 Oct 2026: the road seemed to stop either side of it, and no railway
// showed): the crossing keeps its tile model, the railway runs up to it from both sides, drawn so it reads as one, and the
// far ground drawn before its chunk is filled in never lies over them.

import * as fs from 'fs';
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { firstFrame } from '../../src/cityFrame';
import { DISTRICT_BLOCK, framePreset, isDistrictMap, presetHeights } from '../../src/geo/districtFrame';
import { decodePresetCells, decodePresetLayer } from '../../src/geo/presetMap';
import { MapGenerator } from '../../src/mapGenerator.js';
import { realUnits } from '../../src/roadGeometry.js';
import { CityChunks } from '../../src/render3d/city/chunks.js';
import { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { ProvinceSurface } from '../../src/render3d/city/province-surface.js';
import { RoadCurves } from '../../src/render3d/city/roadCurves.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import type { PrototypeRequest, SerializedPrototype } from '../../src/render3d/city/prototypes.js';
import { registry } from '../../src/render3d/models/registry.js';

const X = 202, Y = 156;

/** The city's map as the game's start screen makes it (src/splashScreen.js startProvince), and the 3D view's snapshot of
 * it (src/render3d/city/index.ts) */
async function khonKaen(): Promise<{ snapshot: TileSnapshot; terrain: CityHeightField }> {
  const whole = JSON.parse(fs.readFileSync('data/maps/district/TH-40-mueang-khon-kaen.json', 'utf8'));
  const preset = isDistrictMap(whole) ? await framePreset(whole, firstFrame(whole, whole.town, DISTRICT_BLOCK)) : whole;
  const layer = (encoded: string | undefined) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : null);
  const transport = layer(preset.transport);
  const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  Object.assign(map, { tileSizeM: preset.tileSizeM || null, roadLevels: layer(preset.roadLevels), insideProvince: layer(preset.inside),
    paintedZones: preset.paintedZones === true, cellZones: preset.cellZones === true, heights: await presetHeights(preset) });
  const snapshot = new TileSnapshot(map.width, map.height);
  snapshot.source = map; snapshot.sync(map); snapshot.coverZones();
  snapshot.roadLevel = 1; snapshot.realUnits = realUnits(map.tileSizeM); snapshot.curves = true;
  return { snapshot, terrain: new CityHeightField(snapshot, map) };
}

describe('the railway and its level crossing in Mueang Khon Kaen', () => {
  test('the crossing has its laterite model and the railway is drawn up to it from both sides, readable as a railway', async () => {
    const { snapshot, terrain } = await khonKaen();
    const W = snapshot.width;
    // A laterite road across a railway: the crossing tile, the railway north and south of it, the road east and west
    expect(snapshot.values[Y * W + X]).toBe(238);
    const curves = new RoadCurves(snapshot, terrain);
    snapshot.roadSnap = (x, z, reach) => curves.nearest(x, z, reach);
    const crossing = snapshot.placement(Y * W + X, 'northeast');
    expect(crossing).not.toBeNull();
    expect(crossing!.id).toBe('road.laterite_rail_crossing');
    expect(registry[crossing!.id!]).toBeDefined();
    expect([crossing!.x, crossing!.z]).toEqual([(X + 0.5) * 10, (Y + 0.5) * 10]);

    // The railway's lines end at the crossing's edges, one from the north and one from the south
    const middle: [number, number] = [(X + 0.5) * 10, (Y + 0.5) * 10];
    const ends = curves.drawnLines.filter((line) => line.rail).flatMap((line) => [line.points[0], line.points[line.points.length - 1]])
      .filter(([x, z]) => Math.abs(x - middle[0]) < 1 && Math.abs(z - middle[1]) <= 10);
    expect(ends.some(([, z]) => z < middle[1])).toBe(true);
    expect(ends.some(([, z]) => z > middle[1])).toBe(true);

    // Rails, sleepers and ballast lie on the track just north and south of the crossing, over the ground
    const near = (x: number, z: number) => Math.abs(x - middle[0]) < 3 && Math.abs(z - middle[1]) > 5 && Math.abs(z - middle[1]) < 40;
    const rails = curves.root.getObjectByName('rails') as Mesh, sleepers = curves.root.getObjectByName('sleepers') as InstancedMesh;
    const ribbon = curves.root.getObjectByName('curves') as Mesh;
    expect(rails && sleepers && ribbon).toBeTruthy();
    const steel = rails.geometry.getAttribute('position');
    let railTops = 0, railsAbove = true;
    for (let i = 0; i < steel.count; i++) {
      const x = steel.getX(i), z = steel.getZ(i);
      if (!near(x, z)) continue;
      railTops++;
      if (steel.getY(i) <= terrain.sample(x, z)) railsAbove = false;
    }
    expect(railTops).toBeGreaterThan(20);
    expect(railsAbove).toBe(true);
    const at = new Vector3(), matrix = new Matrix4();
    let ties = 0;
    for (let n = 0; n < sleepers.count; n++) {
      sleepers.getMatrixAt(n, matrix); at.setFromMatrixPosition(matrix);
      if (near(at.x, at.z)) { ties++; expect(at.y).toBeGreaterThan(terrain.sample(at.x, at.z)); }
    }
    expect(ties).toBeGreaterThan(20);
    // ... the rails wide enough to show from the game's camera, standing over the sleepers
    let widest = 0;
    for (let i = 0; i + 1 < steel.count; i++) {
      const x = steel.getX(i), z = steel.getZ(i);
      if (near(x, z) && Math.abs(steel.getZ(i + 1) - z) < 1e-3) widest = Math.max(widest, Math.abs(steel.getX(i + 1) - x));
    }
    expect(widest).toBeGreaterThanOrEqual(0.1);
    // ... and the ballast dark under the light sleepers and the darker steel, not a pale path
    const colour = ribbon.geometry.getAttribute('color'), place = ribbon.geometry.getAttribute('position');
    let brightest = 0, ballast = 0;
    for (let i = 0; i < place.count; i++) {
      if (!near(place.getX(i), place.getZ(i))) continue;
      ballast++;
      brightest = Math.max(brightest, colour.getX(i), colour.getY(i), colour.getZ(i));
    }
    expect(ballast).toBeGreaterThan(0);
    const luminance = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const sleeperColour = (sleepers.material as MeshStandardMaterial).color;
    const railColour = (rails.material as MeshStandardMaterial).color;
    expect(brightest).toBeLessThan(0.16);
    expect(luminance(sleeperColour)).toBeGreaterThan(brightest * 2);
    expect(luminance(railColour)).toBeLessThan(luminance(sleeperColour) / 2);
    curves.dispose();
  }, 60000);

  test('the far ground drawn before its tiles are filled in lies under the railway, the road and the crossing', async () => {
    // The crossing lies in a hollow; the first coarse ground, flat quads of 4 x 4 tiles, once took its height only at
    // their corners and hid all three until its chunk was filled in tile by tile
    const { snapshot, terrain } = await khonKaen();
    const curves = new RoadCurves(snapshot, terrain), surface = new ProvinceSurface(snapshot, terrain);
    const land = surface.chunks.find((c) => c.x <= X && X < c.x + 32 && c.y <= Y && Y < c.y + 32)!.land;
    const ground = land.geometry.getAttribute('position');
    /** The coarse ground's height under (x, z), from the triangle of it that lies there */
    const coarse = (x: number, z: number): number => {
      for (let t = 0; t + 2 < ground.count; t += 3) {
        const [ax, az, bx, bz, cx, cz] = [ground.getX(t), ground.getZ(t), ground.getX(t + 1), ground.getZ(t + 1), ground.getX(t + 2), ground.getZ(t + 2)];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (!d) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        return u * ground.getY(t) + v * ground.getY(t + 1) + (1 - u - v) * ground.getY(t + 2);
      }
      throw new Error(`no coarse ground under ${x}, ${z}`);
    };
    const middle: [number, number] = [(X + 0.5) * 10, (Y + 0.5) * 10];
    // The real ground there rises and falls by metres within the quads round the crossing
    const heights: number[] = [];
    for (let dz = -40; dz <= 40; dz += 10) for (let dx = -40; dx <= 40; dx += 10) heights.push(terrain.sample(middle[0] + dx, middle[1] + dz));
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(2);
    let checked = 0;
    for (const name of ['rails', 'curves', 'dirt']) {
      const position = (curves.root.getObjectByName(name) as Mesh).geometry.getAttribute('position');
      for (let i = 0; i < position.count; i += 3) {
        const x = position.getX(i), z = position.getZ(i);
        if (Math.abs(x - middle[0]) > 30 || Math.abs(z - middle[1]) > 30) continue;
        checked++;
        expect(coarse(x, z)).toBeLessThanOrEqual(position.getY(i));
      }
    }
    expect(checked).toBeGreaterThan(100);
    // ... and the ground itself across the crossing's tile and its neighbours, where its model stands
    for (let z = middle[1] - 15; z <= middle[1] + 15; z += 2.5) for (let x = middle[0] - 15; x <= middle[0] + 15; x += 2.5) {
      expect(coarse(x, z)).toBeLessThanOrEqual(terrain.sample(x, z) + 1e-4);
    }
    surface.dispose(); curves.dispose();
  }, 60000);

  test('the crossing model is shown however slow each frame is, on a map of 900 chunks', async () => {
    // Each frame scanned tiles for their models for a millisecond, but on this map sorting the 900 chunks took that
    // millisecond, so no tile was scanned and the crossing never got its model. A clock that gains 5 ms each time it
    // is read makes every slice run out at once.
    const { snapshot, terrain } = await khonKaen();
    snapshot.roadSnap = null;
    const geometry = new BoxGeometry(1, 1, 1), ready: SerializedPrototype[] = [];
    const provider = { request(r: PrototypeRequest) { ready.push({ key: r.key, height: 1, parts: [{ index: new Uint32Array(geometry.index!.array),
      attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, a]) => [key, { array: new Float32Array(a.array), size: a.itemSize }])),
      material: { key: 'plaster_white', name: 'plaster_white', color: 0xffffff, data: { materialKey: 'plaster_white' } } }] }); },
    take() { return ready.splice(0); }, dispose: jest.fn() };
    let time = 0;
    const chunks = new CityChunks(snapshot, 'northeast', provider, () => (time += 5), terrain);
    expect(chunks.chunks.length).toBeGreaterThan(800);
    const target = new Vector3((X + 0.5) * 10, 0, (Y + 0.5) * 10), visible = { x0: X - 7, y0: Y - 4, x1: X + 7, y1: Y + 4 };
    const crossing = () => chunks.chunks.flatMap((c) => c.batches).find((b) => b.placements.some((p) => p.index === Y * snapshot.width + X));
    try {
      for (let frame = 0; frame < 40 && !(crossing()?.fade === 1); frame++) chunks.update(visible, target, 60);
      const batch = crossing();
      expect(batch?.placements.find((p) => p.index === Y * snapshot.width + X)?.id).toBe('road.laterite_rail_crossing');
      expect(batch!.selected).toBe(true);
      expect(batch!.fade).toBe(1);
      expect(batch!.group.visible).toBe(true);
      expect(batch!.group.children.length).toBeGreaterThan(0);
    } finally { chunks.dispose(); geometry.dispose(); }
  }, 60000);
});
