/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Roads and railways as smooth curves (src/render3d/city/roadCurves.ts): a road laid as a staircase of tiles is drawn
// as one smooth line through them, junctions get a plate, and its tiles draw no model of their own.

import { InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { RoadCurves, type RoadWorkerLike } from '../../src/render3d/city/roadCurves.js';
import { RoadWorkerState, type RoadRequest } from '../../src/render3d/city/roadBuild.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { halfWidth, networkOf, roadReach } from '../../src/roadGeometry.js';
import { lateriteColour } from '../../src/render3d/models/road/laterite.js';
import { ZONEBIT } from '../../src/tileFlags.js';
import { registry } from '../../src/render3d/models/registry.js';
import { visibleMeshes } from '../../src/render3d/util/geometry.js';

const flat = { sample: () => 0, sampleTile: () => 0, inside: () => true } as unknown as CityHeightField;

/** A road from (2, 2) at a slant of two along for each one down, as the map lays a slanted road */
function slanted(): { snapshot: TileSnapshot; tiles: Array<[number, number]> } {
  const W = 60, snapshot = new TileSnapshot(W, 40), tiles: Array<[number, number]> = [];
  let x = 2, y = 2;
  for (let step = 0; step < 18; step++) {
    for (const [dx, dy] of [[1, 0], [1, 0], [0, 1]]) { tiles.push([x, y]); x += dx; y += dy; }
  }
  for (const [tx, ty] of tiles) snapshot.values[ty * W + tx] = 66;
  return { snapshot, tiles };
}

describe('road curves', () => {
  test('a building stood against its road lies on a lot as big as it is drawn and no bigger, turned with it', () => {
    // A road along row 20, and a civic 3 x 3 (the ruler's house's tiles 414-422) on rows 16-18 above it
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[20 * W + x] = 66;
    for (let k = 0; k < 9; k++) snapshot.values[(16 + Math.floor(k / 3)) * W + 19 + k % 3] = 414 + k;
    snapshot.flags[17 * W + 20] = ZONEBIT;
    snapshot.curves = true;
    const curves = new RoadCurves(snapshot, flat);
    const placed = snapshot.placement(17 * W + 20, 'central')!;
    expect(placed.posed).toBe(true);
    const lot = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'lots');
    expect(lot).toBeDefined();
    lot!.geometry.computeBoundingBox();
    const box = lot!.geometry.boundingBox!;
    // As big as the building drawn on it and no more (owner, 21 Oct 2026: "ต้องย่อให้เท่าๆ กับที่สร้างได้พอดี"), turned with it
    // to face the road (rotation 0 here, the road to the south): from its front to its back, its sides
    const ground = placed.ground(), front = placed.front!;
    expect(ground.rotation).toBeCloseTo(0);
    expect(box.max.z).toBeCloseTo(ground.z + front, 4);
    expect(box.min.z).toBeCloseTo(ground.z - front, 4);
    expect(box.min.x).toBeCloseTo(ground.x - front, 4);
    expect(box.max.x).toBeCloseTo(ground.x + front, 4);
    expect(box.max.z).toBeLessThan(205 - 3);
    // ... never bigger than the tiles it takes (x 190-220, z 160-190), which all show as taken
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(30);
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(30);
    for (let k = 0; k < 9; k++) {
      const rect = curves.lotAt((16 + Math.floor(k / 3)) * W + 19 + k % 3);
      expect(rect).not.toBeNull();
      expect(rect).toBe(curves.lotAt(17 * W + 20));
    }
    expect(curves.lotAt(20 * W + 20)).toBeNull();
    curves.dispose();
  });


  test('a crossing is one patch over both roads out past their edges, its corners rounded, kerbed where paved', () => {
    // Owner, 18 Oct 2026: "จุดแยกของถนน มันควรจะมี graphic ที่สวยงามกว่านี้"
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const W = 40, snapshot = new TileSnapshot(W, 40), levels = new Uint8Array(W * 40);
      for (let k = 5; k < 36; k++) for (const i of [20 * W + k, k * W + 20]) { snapshot.values[i] = 66; levels[i] = level; }
      snapshot.source = { roadLevels: levels } as unknown as TileSnapshot['source'];
      const curves = new RoadCurves(snapshot, flat);
      // A laterite crossing is the laterite roads' own dirt (roadCurves.ts dirt)
      const name = level > 1 ? 'curves' : 'dirt';
      const mesh = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === name)!;
      const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()!;
      // The patch's triangles and the kerbs', by how high they lie over the flat ground (corners shared by triangles)
      const patch: Array<Array<[number, number]>> = [], kerbs: Array<Array<[number, number]>> = [];
      for (let t = 0; t < index.count; t += 3) {
        const at = [0, 1, 2].map((k) => index.getX(t + k));
        const corners = at.map((i): [number, number] => [position.getX(i), position.getZ(i)]);
        const heights = at.map((i) => position.getY(i));
        if (heights.every((y) => Math.abs(y - 0.185) < 1e-4)) patch.push(corners);
        if (heights.every((y) => Math.abs(y - 0.186) < 1e-4)) kerbs.push(corners);
      }
      const under = ([px, pz]: [number, number]): boolean => patch.some(([a, b, c]) => {
        const side = (p: [number, number], q: [number, number]): number => (q[0] - p[0]) * (pz - p[1]) - (q[1] - p[1]) * (px - p[0]);
        const s1 = side(a, b), s2 = side(b, c), s3 = side(c, a);
        return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
      });
      // The crossing (205, 205), each road's carriageway just past the other's edge, and the rounded corners
      const half = halfWidth(level), reach = roadReach(level);
      for (const [dx, dz] of [[0, 0], [reach + 0.1, 0], [-reach - 0.1, 0], [0, reach + 0.1], [0, -reach - 0.1],
        [reach + 0.1, half * 0.8], [half + 0.3, half + 0.3], [-half - 0.3, half + 0.3]]) expect(under([205 + dx, 205 + dz])).toBe(true);
      // ... and not the ground beyond them
      expect(under([205 + 3 * reach, 205 + 3 * reach])).toBe(false);
      expect(kerbs.length > 0).toBe(level > 1);
      curves.dispose();
    }
  });

  test('mixed laterite and paved junctions follow sloped ground without changing saved roads', () => {
    const W = 40, snapshot = new TileSnapshot(W, W), levels = new Uint8Array(W * W);
    for (let k = 5; k < 36; k++) {
      snapshot.values[20 * W + k] = 66; levels[20 * W + k] = k < 20 ? 1 : 5;
      snapshot.values[k * W + 20] = 66; levels[k * W + 20] = k < 20 ? 2 : 3;
    }
    snapshot.source = { roadLevels: levels, tileSizeM: 16 } as unknown as TileSnapshot['source'];
    const savedValues = snapshot.values.slice(), savedLevels = levels.slice();
    const hill = { sample: (x: number, z: number) => x * 0.025 + z * 0.015,
      sampleTile: (_tx: number, _tz: number, x: number, z: number) => x * 0.025 + z * 0.015,
      inside: () => true } as unknown as CityHeightField;
    const curves = new RoadCurves(snapshot, hill);
    // Paved roads lie over the ground; laterite's shoulders fall away to just over it
    for (const [name, over] of [['curves', 0.129], ['dirt', 0.039]] as const) {
      const mesh = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === name)!;
      const position = mesh.geometry.getAttribute('position'), colour = mesh.geometry.getAttribute('color');
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
        expect(Number.isFinite(x + y + z + colour.getX(i) + colour.getY(i) + colour.getZ(i))).toBe(true);
        expect(y - x * 0.025 - z * 0.015).toBeGreaterThan(over);
      }
    }
    expect(snapshot.values).toEqual(savedValues);
    expect(levels).toEqual(savedLevels);
    curves.dispose();
  });

  test('a laterite road is its gallery model across: a crown, wheel tracks, shoulders falling away, and gravel', () => {
    // Owner, 18 Oct 2026: "เพิ่มรายละเอียด 3D (ผิวนูน กรวด ไหล่ทาง) ให้ถนนโค้งและจุดแยกในเกม"
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[20 * W + x] = 66;
    const curves = new RoadCurves(snapshot, flat);
    const dirt = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'dirt')!;
    expect(dirt.geometry.getAttribute('uv')).toBeDefined();
    // Across the road at x = 200 (its middle z = 205): the height at each distance from the middle
    const position = dirt.geometry.getAttribute('position'), across = new Map<number, number>();
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getX(i) - 200) > 4) continue;
      across.set(Math.round(Math.abs(position.getZ(i) - 205) * 100), position.getY(i));
    }
    const at = (d: number): number => across.get(Math.round(d * 100))!;
    expect(at(0)).toBeGreaterThan(at(1.1));
    expect(at(2.1)).toBeGreaterThan(at(1.45));
    expect(at(3.5)).toBeLessThan(at(2.1));
    // ... its crown under a junction's patch, its shoulder down to just over the land
    expect(at(0)).toBeLessThan(0.185);
    const outside = Math.max(...across.keys()) / 100;
    expect(outside).toBeGreaterThan(3.5);
    expect(at(outside)).toBeCloseTo(0.04, 4);
    // Gravel along it, on the shoulders either side and none in the wheel tracks
    const gravel = curves.root.children.find((child): child is InstancedMesh => child instanceof InstancedMesh && child.name === 'gravel')!;
    expect(gravel.count).toBeGreaterThan(30);
    const matrix = new Matrix4(), place = new Vector3(), sides = new Set<number>();
    for (let n = 0; n < gravel.count; n++) {
      gravel.getMatrixAt(n, matrix); place.setFromMatrixPosition(matrix);
      expect(Math.abs(place.z - 205)).toBeGreaterThan(2.2);
      expect(Math.abs(place.z - 205)).toBeLessThan(4);
      sides.add(Math.sign(place.z - 205));
    }
    expect(sides.size).toBe(2);
    // The same stones each time it is drawn
    const again = new RoadCurves(snapshot, flat);
    const twin = again.root.children.find((child): child is InstancedMesh => child instanceof InstancedMesh && child.name === 'gravel')!;
    expect(Array.from(twin.instanceMatrix.array)).toEqual(Array.from(gravel.instanceMatrix.array));
    curves.dispose(); again.dispose();
  });

  test('a building changing lays its lot again but never draws the roads again; a road changing does', () => {
    // Owner, 19 Oct 2026: the game stalled each time a building rose a stage, as every road in the city was drawn again
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[20 * W + x] = 66;
    snapshot.curves = true;
    const curves = new RoadCurves(snapshot, flat);
    const named = (name: string): Mesh | undefined => curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === name);
    const road = named('dirt');
    expect(road).toBeDefined();
    // The ruler's house going up beside it, a stage at a time
    for (let k = 0; k < 9; k++) snapshot.values[(16 + Math.floor(k / 3)) * W + 19 + k % 3] = 414 + k;
    snapshot.flags[17 * W + 20] = ZONEBIT;
    curves.update([16 * W + 19, 17 * W + 20]);
    expect(named('dirt')).toBe(road);
    expect(named('lots')).toBeDefined();
    // Ground raised far from any road leaves the roads alone too
    curves.update([], [2 * W + 2]);
    expect(named('dirt')).toBe(road);
    // A road tile: the roads are drawn again
    snapshot.values[21 * W + 30] = 66;
    curves.update([21 * W + 30]);
    expect(named('dirt')).not.toBe(road);
    curves.dispose();
  });

  test('a road built on draws again only that road: the others are kept as they were built', () => {
    // Owner, 19 Oct 2026: "อยากจะปรับ graphic ให้มันลื่นขึ้น"
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) { snapshot.values[8 * W + x] = 66; snapshot.values[30 * W + x] = 66; }
    for (let y = 9; y < 20; y++) snapshot.values[y * W + 20] = 66;
    const curves = new RoadCurves(snapshot, flat);
    expect(curves.lastBuild.reused).toBe(0);
    const pieces = curves.lastBuild.built;
    expect(pieces).toBeGreaterThanOrEqual(4);
    // The southern road one tile longer: only it is built again
    snapshot.values[30 * W + 36] = 66;
    curves.update([30 * W + 36]);
    expect(curves.lastBuild.built).toBe(1);
    expect(curves.lastBuild.reused).toBe(pieces - 1);
    // ... and the ground moving under the northern road's tiles builds the pieces lying over them again
    curves.update([], [8 * W + 30]);
    expect(curves.lastBuild.built).toBeGreaterThanOrEqual(1);
    expect(curves.lastBuild.reused).toBeGreaterThanOrEqual(1);
    curves.dispose();
  });

  test('in a worker the roads are built off the page: the old ones show until its answer, changes meanwhile wait', async () => {
    // Owner, 19 Oct 2026: "มีวิธีการไหนไหม ที่จะบันทึก เป็น background"
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[8 * W + x] = 66;
    const ground = { sample: () => 0, sampleTile: () => 0, inside: () => true, version: 0,
      grid: () => ({ width: W, height: 40, enabled: false, pads: new Float32Array(W * 40), corners: new Float32Array(41 * 41), mask: null }),
    } as unknown as CityHeightField;
    // A worker in the same thread, answering a moment later, as the browser's does
    const state = new RoadWorkerState(), sent: RoadRequest[] = [];
    const worker: RoadWorkerLike = { onmessage: null, onerror: null, terminate: () => undefined,
      postMessage(message) { sent.push(message); setTimeout(() => this.onmessage!({ data: state.handle(message).reply }), 0); } };
    const curves = new RoadCurves(snapshot, ground, { worker: () => worker });
    const named = (name: string): Mesh | undefined => curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === name);
    // The first build is on the page, so the city opens with its roads
    const first = named('dirt');
    expect(first).toBeDefined();
    expect(sent).toHaveLength(0);
    // A road drawn: asked of the worker, the old roads showing meanwhile; a second change waits for the answer
    for (let y = 9; y < 20; y++) snapshot.values[y * W + 20] = 66;
    curves.update([9 * W + 20]);
    expect(sent).toHaveLength(1);
    expect(sent[0].grid).not.toBeNull();
    expect(named('dirt')).toBe(first);
    for (let x = 5; x < 36; x++) snapshot.values[30 * W + x] = 66;
    curves.update([30 * W + 5]);
    expect(sent).toHaveLength(1);
    // Both answered in turn, the ground sent only once, and all three roads drawn
    for (let wait = 0; wait < 100 && curves.drawnLines.filter((line) => !line.rail).length < 3; wait++) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sent).toHaveLength(2);
    expect(sent[1].grid).toBeNull();
    expect(named('dirt')).not.toBe(first);
    expect(curves.drawnLines.filter((line) => !line.rail).length).toBeGreaterThanOrEqual(3);
    curves.dispose();
  });

  test('a road changed shows at once, sketched as the worker builds it, until its answer takes the sketch\'s place', async () => {
    // Owner, 19 Oct 2026: a road drawn on the Khon Kaen map showed only a moment later
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) { snapshot.values[8 * W + x] = 66; snapshot.values[30 * W + x] = 66; }
    const ground = { ...flat, version: 0, grid: () => ({ width: W, height: 40, enabled: false, pads: new Float32Array(W * 40),
      corners: new Float32Array(41 * 41), mask: null }) } as unknown as CityHeightField;
    // A worker that answers when told to
    const state = new RoadWorkerState(), waiting: RoadRequest[] = [];
    const worker: RoadWorkerLike = { onmessage: null, onerror: null, terminate: () => undefined,
      postMessage(message) { if (!message.quiet) waiting.push(message); else this.onmessage!({ data: state.handle(message).reply }); } };
    const curves = new RoadCurves(snapshot, ground, { worker: () => worker });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const answer = (): void => { worker.onmessage!({ data: state.handle(waiting.shift()!).reply }); };
    // What the roads draw: the corners of every triangle not hidden, and the stones and sleepers not shrunk away, the
    // build's and the sketch's together
    const drawn = (): string[] => {
      const out: string[] = [];
      for (const child of curves.root.children) {
        if (child instanceof InstancedMesh) {
          const matrix = new Matrix4(), place = new Vector3();
          for (let n = 0; n < child.count; n++) {
            child.getMatrixAt(n, matrix);
            if (matrix.determinant() !== 0) out.push(`${child.name.replace('_sketch', '')} ${place.setFromMatrixPosition(matrix).toArray().map((v) => v.toFixed(3))}`);
          }
        } else if (child instanceof Mesh && !['lots', 'driveways'].includes(child.name)) {
          const position = child.geometry.getAttribute('position'), index = child.geometry.getIndex()!;
          for (let t = 0; t < index.count; t += 3) {
            const at = [0, 1, 2].map((k) => index.getX(t + k));
            if (at.every((i) => i === 0)) continue;
            out.push(`${child.name.replace('_sketch', '')} ${at.map((i) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(3))).sort().join(' ')}`);
          }
        }
      }
      return out.sort();
    };
    const named = (name: string): Mesh | undefined => curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === name);
    // A road from the northern one down to row 19, a junction where they meet: drawn at once, before the worker answers
    for (let y = 9; y < 20; y++) snapshot.values[y * W + 20] = 66;
    curves.update(Array.from({ length: 11 }, (_, k) => (9 + k) * W + 20));
    expect(waiting).toHaveLength(1);
    expect(named('dirt_sketch')).toBeDefined();
    expect(curves.drawnLines.some((line) => line.points.some(([x, z]) => Math.abs(x - 205) < 1 && Math.abs(z - 150) < 1))).toBe(true);
    const sketched = drawn();
    // ... the same as the worker then builds, which takes the sketch's place
    answer();
    expect(named('dirt_sketch')).toBeUndefined();
    expect(drawn()).toEqual(sketched);
    // A tile of the southern road bulldozed: its two halves at once, the same as the worker's
    snapshot.values[30 * W + 20] = 0;
    curves.update([30 * W + 20]);
    const cut = drawn();
    expect(cut).not.toEqual(sketched);
    // ... and nothing goes along the old line over the tile bulldozed
    expect(curves.drawnLines.some((line) => line.points.some(([x, z]) => Math.floor(x / 10) === 20 && Math.floor(z / 10) === 30))).toBe(false);
    answer();
    expect(drawn()).toEqual(cut);
    curves.dispose();
  });

  test('when the worker fails the roads are built on the page again', async () => {
    const W = 40, snapshot = new TileSnapshot(W, 40);
    for (let x = 5; x < 36; x++) snapshot.values[8 * W + x] = 66;
    const ground = { ...flat, version: 0, grid: () => ({ width: W, height: 40, enabled: false, pads: new Float32Array(W * 40),
      corners: new Float32Array(41 * 41), mask: null }) } as unknown as CityHeightField;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const worker: RoadWorkerLike = { onmessage: null, onerror: null, terminate: jest.fn(),
      postMessage() { setTimeout(() => this.onerror!({ message: 'city-road-worker.js 404' }), 0); } };
    const curves = new RoadCurves(snapshot, ground, { worker: () => worker });
    for (let x = 5; x < 36; x++) snapshot.values[30 * W + x] = 66;
    curves.update([30 * W + 5]);
    for (let wait = 0; wait < 100 && curves.drawnLines.length < 2; wait++) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(worker.terminate).toHaveBeenCalled();
    expect(curves.drawnLines.length).toBe(2);
    // ... and from then on, at once
    for (let y = 9; y < 20; y++) snapshot.values[y * W + 20] = 66;
    curves.update([9 * W + 20]);
    expect(curves.drawnLines.length).toBeGreaterThanOrEqual(3);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    curves.dispose();
  });

  test("the worker's side hands its arrays over and says why when it cannot build", () => {
    const W = 20, values = new Uint16Array(W * W);
    for (let x = 2; x < 18; x++) values[10 * W + x] = 66;
    const map = { width: W, height: W, values, levels: null, pieces: null, paths: null, realUnits: null };
    const state = new RoadWorkerState();
    expect(state.handle({ id: 1, map, grid: null, invalidate: [] }).reply.error).toMatch(/ground/);
    const grid = { width: W, height: W, enabled: false, pads: new Float32Array(W * W), corners: new Float32Array(21 * 21), mask: null };
    const { reply, transfer } = state.handle({ id: 2, map, grid, invalidate: [] });
    expect(reply.id).toBe(2);
    expect(reply.build!.lines).toHaveLength(1);
    expect(transfer).toContain(reply.build!.dirt!.position.buffer);
  });

  test('a road stops square at its end, with no round plate', () => {
    // Owner, 18 Oct 2026: "เอาวงกลมที่ปลายถนนออก"
    for (const level of [1, 3]) {
      const W = 40, snapshot = new TileSnapshot(W, 40), levels = new Uint8Array(W * 40);
      for (let x = 5; x < 36; x++) { snapshot.values[20 * W + x] = 66; levels[20 * W + x] = level; }
      snapshot.source = { roadLevels: levels } as unknown as TileSnapshot['source'];
      const curves = new RoadCurves(snapshot, flat);
      const position = curves.root.children.filter((child): child is Mesh => child instanceof Mesh && ['dirt', 'curves'].includes(child.name))
        .map((mesh) => mesh.geometry.getAttribute('position'));
      const xs = position.flatMap((p) => Array.from({ length: p.count }, (_, i) => p.getX(i)));
      // From the first tile's middle (55) back as far as it reaches either side, and every point at its end lies on one
      // straight edge across it
      const reach = roadReach(level), west = Math.min(...xs), east = Math.max(...xs);
      expect(west).toBeCloseTo(55 - reach, 3);
      expect(east).toBeCloseTo(355 + reach, 3);
      expect(xs.filter((x) => x < 55 - reach + 0.5).every((x) => Math.abs(x - west) < 1e-3)).toBe(true);
      curves.dispose();
    }
  });

  test('two roads drawn end to end at a corner turn on a bend, and wheel tracks turn through a laterite junction', () => {
    // Owner, 18 Oct 2026: "ร่องล้อเลี้ยวผ่านแยก ขอบมุมโค้งตามถนน และเอาวงกลมที่ปลายถนนออก"
    const W = 40, snapshot = new TileSnapshot(W, 40), pieces = new Uint16Array(W * 40);
    for (let x = 5; x <= 20; x++) { snapshot.values[20 * W + x] = 66; pieces[20 * W + x] = 1; }
    for (let y = 21; y < 36; y++) { snapshot.values[y * W + 20] = 66; pieces[y * W + 20] = 2; }
    snapshot.source = { roadPieces: pieces } as unknown as TileSnapshot['source'];
    const curves = new RoadCurves(snapshot, flat);
    const dirt = curves.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'dirt')!;
    const position = dirt.geometry.getAttribute('position');
    const points = Array.from({ length: position.count }, (_, i): [number, number] => [position.getX(i), position.getZ(i)]);
    // The bend's middle, a quarter of the way in from where each road was cut short of the corner (205, 205), and none
    // of the road out at the corner's sharp outside, where a square or a plate would reach
    const along = 1.6 * roadReach(1);
    expect(points.some(([x, z]) => Math.hypot(x - (205 - along / 4), z - (205 + along / 4)) < 0.05)).toBe(true);
    expect(points.some(([x, z]) => x > 205 + 0.6 * roadReach(1) && z < 205 - 0.6 * roadReach(1))).toBe(false);
    curves.dispose();

    // A crossing of two laterite roads: across its middle the colour of tracks going straight on, darker than the patch
    const cross = new TileSnapshot(W, 40);
    for (let k = 5; k < 36; k++) for (const i of [20 * W + k, k * W + 20]) cross.values[i] = 66;
    const junction = new RoadCurves(cross, flat);
    const patch = junction.root.children.find((child): child is Mesh => child instanceof Mesh && child.name === 'dirt')!;
    const at = patch.geometry.getAttribute('position'), colour = patch.geometry.getAttribute('color');
    const tracks: number[] = [];
    for (let i = 0; i < at.count; i++) {
      if (Math.abs(at.getY(i) - 0.187) < 1e-4 && Math.abs(at.getX(i) - 205) < 0.6) tracks.push(colour.getX(i) + colour.getY(i) + colour.getZ(i));
    }
    expect(tracks.length).toBeGreaterThan(0);
    const light = lateriteColour(0.6);
    expect(Math.max(...tracks)).toBeLessThan(light.r + light.g + light.b);
    junction.dispose();
  });

  test('a staircase of road tiles becomes one smooth line close to them', () => {
    const { snapshot, tiles } = slanted();
    const curves = new RoadCurves(snapshot, flat);
    expect(curves.root.children.some(child => child instanceof Mesh && child.name === 'dirt')).toBe(true);
    const near = curves.roadsNear(new Vector3(300, 0, 200));
    expect(near.length).toBeGreaterThan(20);
    // Every piece heads the same way, within a few degrees: no wiggles left from the steps
    const heading = Math.atan2(2, 1);
    const middle = near.filter(p => p.x > 80 && p.x < 330);
    for (const p of middle) expect(Math.abs(p.rotation - heading)).toBeLessThan(0.12);
    // ... and it stays within about a tile of the tiles' middles
    for (const p of middle) {
      const closest = Math.min(...tiles.map(([tx, ty]) => Math.hypot((tx + 0.5) * 10 - p.x, (ty + 0.5) * 10 - p.z)));
      expect(closest).toBeLessThan(10);
    }
    curves.dispose();
  });

  test('tiles drawn as curves have no model of their own, and a changed tile draws the curves again', () => {
    const { snapshot } = slanted();
    snapshot.curves = true;
    expect(snapshot.placement(2 * 60 + 2, 'central')).toBeNull();
    snapshot.curves = false;
    expect(snapshot.placement(2 * 60 + 2, 'central')?.kind).toBe('road');
    const curves = new RoadCurves(snapshot, flat);
    const before = curves.roadsNear(new Vector3(300, 0, 200)).length;
    // A branch off the middle: a junction with a plate, and more road
    for (let y = 20; y < 30; y++) snapshot.values[y * 60 + 30] = 66;
    curves.update([25 * 60 + 30]);
    expect(curves.roadsNear(new Vector3(300, 0, 250)).length).toBeGreaterThan(0);
    expect(curves.roadsNear(new Vector3(300, 0, 200)).length).toBeGreaterThanOrEqual(before);
    curves.dispose();
  });
  test('a power line over a curved road keeps only its poles and wires, and the road runs on through it', () => {
    // A road along row 2 with a power line crossing it at (5, 2) (tile 77)
    const W = 12, snapshot = new TileSnapshot(W, 6);
    for (let x = 1; x < 10; x++) snapshot.values[2 * W + x] = 66;
    snapshot.values[2 * W + 5] = 77;
    snapshot.curves = true;
    const crossing = snapshot.placement(2 * W + 5, 'central')!;
    expect(crossing).toMatchObject({ id: 'road.power_crossing', kind: 'power' });
    expect(crossing.options.state).toBe('wires');
    const network = networkOf({ width: W, height: 6, value: (i) => snapshot.values[i], level: () => 1 }, false);
    expect(network.stretches).toHaveLength(1);
    expect(network.stretches[0].tiles).toContain(2 * W + 5);
    // The wires alone have no road under them, and a power line on a city map no laterite square
    const full = registry['road.power_crossing'].factory({ seed: 1 }), wires = registry['road.power_crossing'].factory({ seed: 1, state: 'wires' });
    expect(visibleMeshes(wires).length).toBeLessThan(visibleMeshes(full).length);
    const ground = registry['power.straight'].factory({ seed: 1 }), open = registry['power.straight'].factory({ seed: 1, state: 'open' });
    expect(visibleMeshes(open).length).toBeLessThan(visibleMeshes(ground).length);
  });
});
