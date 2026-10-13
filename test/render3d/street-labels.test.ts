/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// Street names on the 3D map (src/render3d/city/streetLabels.ts): written near the ground only, along the road,
// readable from either side, and read again when the roads change.
import { Mesh, PerspectiveCamera } from 'three';
import { LABEL_DISTANCE, StreetLabels } from '../../src/render3d/city/streetLabels';

function city(width: number, height: number) {
  const tiles = new Uint16Array(width * height);
  return {
    width, height, roadLevels: new Uint8Array(width * height).fill(1), tiles,
    getTileValue: (x: number, y: number) => tiles[y * width + x],
  };
}

function camera(heading: number): PerspectiveCamera {
  const c = new PerspectiveCamera(38, 1.6, 1, 10000);
  c.position.set(200 + Math.sin(heading) * 150, 150, 200 + Math.cos(heading) * 150); c.lookAt(200, 0, 200);
  c.updateMatrixWorld();
  return c;
}

describe('street labels', () => {
  let time = 0;
  const now = () => time;
  const all = { x0: 0, y0: 0, x1: 39, y1: 39 };

  test('a road gets its name along it, only near the ground', () => {
    const map = city(40, 40);
    for (let x = 0; x < 40; x++) map.tiles[20 * 40 + x] = 66;
    const labels = new StreetLabels(map, street => `ถนน ${street.id}`, undefined, now);
    labels.update(camera(0), 240, all);
    const meshes = labels.root.children.filter((c): c is Mesh => c instanceof Mesh);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].name).toBe(`street_label_${20 * 40}`);
    expect(meshes[0].position.z).toBeCloseTo(205);
    expect(labels.root.visible).toBe(true);
    labels.update(camera(0), LABEL_DISTANCE + 10, all);
    expect(labels.root.visible).toBe(false);
    labels.dispose();
  });

  test('the words turn to read left to right from the other side', () => {
    const map = city(40, 40);
    for (let x = 0; x < 40; x++) map.tiles[20 * 40 + x] = 66;
    const labels = new StreetLabels(map, () => 'ถนนมิตรภาพ', undefined, now);
    labels.update(camera(0), 240, all);
    const mesh = labels.root.children[0] as Mesh, south = mesh.rotation.y;
    labels.update(camera(Math.PI), 240, all);
    expect(Math.abs(Math.abs(mesh.rotation.y - south) - Math.PI)).toBeLessThan(1e-6);
    labels.dispose();
  });

  test('new roads are read again after a moment, and a language change rewrites the names', () => {
    const map = city(40, 40);
    for (let x = 0; x < 40; x++) map.tiles[10 * 40 + x] = 66;
    let words = 'ถนนหนึ่ง';
    const labels = new StreetLabels(map, () => words, undefined, now);
    labels.update(camera(0), 240, all);
    expect(labels.root.children).toHaveLength(1);
    for (let y = 0; y < 40; y++) map.tiles[y * 40 + 30] = 66;
    time += 2500;
    labels.update(camera(0), 240, all);
    expect(labels.root.children).toHaveLength(2);
    words = 'One Road'; labels.relabel(); labels.update(camera(0), 240, all);
    expect(labels.root.children).toHaveLength(2);
    labels.dispose();
    expect(labels.root.children).toHaveLength(0);
  });
});
