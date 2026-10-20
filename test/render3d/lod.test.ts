/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, BufferAttribute, BufferGeometry, Float32BufferAttribute, Frustum, Matrix4, PerspectiveCamera, PlaneGeometry, SphereGeometry, Vector3 } from 'three';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { LOD_ERRORS, LOD_FEATURE, LOD_HYSTERESIS, LOD_PIXELS, SHADOW_ERROR, compact, lodDistance, lodLevel, makeLevels, makeShadow, pixelsPerUnit,
  splitCreases, useSimplifier, type LodSource, type Simplifier } from '../../src/render3d/city/lod.js';
import { ModelPool, frustumOf, poolPlacements, type PoolMember } from '../../src/render3d/city/pools.js';
import { CityChunks } from '../../src/render3d/city/chunks.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { Placement } from '../../src/render3d/city/placement.js';
import { decodePrototype, type Prototype, type PrototypeRequest, type SerializedPrototype } from '../../src/render3d/city/prototypes.js';
import { getMaterial } from '../../src/render3d/materials/library.js';

/** meshoptimizer's simplifier, the game's, loaded from its ES module in Node (Jest here reads CommonJS) */
function meshopt(): Simplifier {
  const file = join(dirname(require.resolve('meshoptimizer')), 'meshopt_simplifier.js');
  const source = readFileSync(file, 'utf8').replace(/export\s*\{\s*MeshoptSimplifier\s*\};?\s*$/, 'return MeshoptSimplifier;');
  return new Function(source)() as Simplifier;
}

/** A part to make levels of: a geometry's positions and colours, indexed */
function source(geometry: BufferGeometry, rgb = [1, 0.5, 0.25]): LodSource {
  const positions = geometry.getAttribute('position'), count = positions.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colours.set(rgb, i * 3);
  return { attributes: { position: { array: new Float32Array(positions.array), size: 3 }, color: { array: colours, size: 3 } },
    index: geometry.index ? new Uint32Array(geometry.index.array) : null };
}
const triangles = (g: LodSource) => (g.index ? g.index.length : g.attributes.position.array.length / 3) / 3;

describe('levels of detail: when each is drawn (lod.ts)', () => {
  it('draws the coarsest level whose distance the model is past', () => {
    const t = [100, 300, 900];
    expect(lodLevel(0, t)).toBe(0);
    expect(lodLevel(99, t)).toBe(0);
    expect(lodLevel(100, t)).toBe(1);
    expect(lodLevel(299, t)).toBe(1);
    expect(lodLevel(300, t)).toBe(2);
    expect(lodLevel(5000, t)).toBe(3);
    expect(lodLevel(5000, [])).toBe(0);
  });

  it('holds a level near its threshold, so a still camera never flickers between two', () => {
    const t = [100, 300];
    // Coarser only once a little past, finer only once a little back
    expect(lodLevel(100 * (1 + LOD_HYSTERESIS) - 1, t, 0)).toBe(0);
    expect(lodLevel(100 * (1 + LOD_HYSTERESIS) + 1, t, 0)).toBe(1);
    expect(lodLevel(100 * (1 - LOD_HYSTERESIS) + 1, t, 1)).toBe(1);
    expect(lodLevel(100 * (1 - LOD_HYSTERESIS) - 1, t, 1)).toBe(0);
    // ... whichever level it held, the distance alone decides far from the thresholds
    for (const current of [-1, 0, 1, 2]) { expect(lodLevel(20, t, current)).toBe(0); expect(lodLevel(200, t, current)).toBe(1); expect(lodLevel(900, t, current)).toBe(2); }
  });

  it('swaps a level in only where it moves no point of the model on the screen by more than a pixel', () => {
    // The city's lens, 38° high, on a 1080-pixel and a 1350-pixel (1.25x) picture
    const camera = new PerspectiveCamera(38, 16 / 9, 1, 1000);
    for (const height of [1080, 1350]) {
      const ppu = pixelsPerUnit(height, camera.fov);
      expect(ppu).toBeCloseTo(height / (2 * Math.tan(19 * Math.PI / 180)));
      for (const error of LOD_ERRORS) {
        // An era building's metres drawn at 10/16 on the real-scale city map
        const world = error * 10 / 16, from = lodDistance(world, ppu);
        // Projected: a world-space shift of `world` at that distance, through the camera, is LOD_PIXELS on the screen
        camera.position.set(0, 0, 0); camera.lookAt(0, 0, -1); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
        const a = new Vector3(0, 0, -from).project(camera), b = new Vector3(0, world, -from).project(camera);
        expect((b.y - a.y) / 2 * height).toBeCloseTo(LOD_PIXELS, 5);
        // ... and less nearer the screen's middle than past the threshold, where it is drawn
        expect(world * ppu / (from * 1.5)).toBeLessThan(LOD_PIXELS);
      }
    }
  });
});

describe('levels of detail: the lighter copies (lod.ts makeLevels, meshoptimizer)', () => {
  const simplifier = meshopt();
  beforeAll(() => simplifier.ready);

  it('makes each level within its error, lighter than the one before, on only the vertices it uses', () => {
    // A detailed body (a sphere of 4 m radius, about 4,000 triangles) and a small part (a box)
    const body = source(new SphereGeometry(4, 64, 32)), box = source(new BoxGeometry(1, 1, 1).translate(0, 5, 0), [0.1, 0.2, 0.9]);
    const levels = makeLevels([body, box], simplifier);
    expect(levels.length).toBeGreaterThanOrEqual(2);
    let before = triangles(body) + triangles(box);
    levels.forEach((level, k) => {
      expect(level.error).toBeLessThanOrEqual(LOD_ERRORS[LOD_ERRORS.length - 1] + 1e-6);
      if (k) expect(level.error).toBeGreaterThanOrEqual(levels[k - 1].error);
      const count = level.parts.reduce((n, p) => n + (p ? triangles(p) : 0), 0);
      expect(count).toBeLessThan(before);
      before = count;
      for (const part of level.parts) if (part) {
        const vertices = part.attributes.position.array.length / 3;
        expect(Math.max(...part.index)).toBe(vertices - 1);
        // ... with its colours, which stay as they were
        expect(part.attributes.color.array.length).toBe(vertices * 3);
      }
    });
    // The far level keeps the box in its own colour
    const far = levels[levels.length - 1].parts[1]!;
    expect(Array.from(far.attributes.color.array.slice(0, 3)).map(v => +v.toFixed(2))).toEqual([0.1, 0.2, 0.9]);
    // Every point of the light copy lies near the sphere (its error is a distance, metres here)
    const positions = levels[0].parts[0]!.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) expect(Math.abs(Math.hypot(positions[i], positions[i + 1], positions[i + 2]) - 4)).toBeLessThan(levels[0].error + 1e-3);
  });

  /** A board of planks in one surface, as the era buildings' walls are: 4 m square, cut every 5 cm, every other strip of
   * four cuts 4 cm higher, the strips' sides steep slopes */
  function planked(): { positions: Float32Array; index: Uint32Array } {
    const plane = new PlaneGeometry(4, 4, 80, 8).rotateX(-Math.PI / 2), position = plane.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const column = Math.round((position.getX(i) + 2) / .05);
      position.setY(i, Math.floor(column / 4) % 2 ? .04 : 0);
    }
    return { positions: new Float32Array(position.array), index: new Uint32Array(plane.index!.array) };
  }
  const raised = (positions: ArrayLike<number>, index: ArrayLike<number>) => {
    let n = 0;
    for (let t = 0; t < index.length; t += 3) if ([0, 1, 2].every(k => Math.abs(positions[index[t + k] * 3 + 1] - .04) < 1e-4)) n++;
    return n;
  };

  it('keeps every crease, so shallow planks and grooves still show in flat shading far away', () => {
    const board = planked(), part: LodSource = { attributes: { position: { array: board.positions, size: 3 } }, index: board.index };
    // Within the coarsest error a plain simplifier flattens the 4 cm strips (they are well inside its 36 cm)
    const [lax] = simplifier.simplify(board.index, board.positions, 3, 0, LOD_ERRORS[LOD_ERRORS.length - 1], ['ErrorAbsolute', 'Prune']);
    expect(raised(board.positions, lax)).toBeLessThan(10);
    // ... where the levels keep every strip's top, each at least the two triangles of a flat strip
    const levels = makeLevels([part], simplifier), creased = levels.filter(l => l.error < LOD_FEATURE);
    expect(creased.length).toBeGreaterThan(0);
    for (const level of creased) {
      const g = level.parts[0]!;
      expect(raised(g.attributes.position.array, g.index)).toBeGreaterThanOrEqual(2 * 10);
      expect(triangles(g)).toBeLessThan(triangles(part));
    }
    // ... all but the last, which may smooth them, and is drawn only where a feature of LOD_FEATURE is under a pixel
    const last = levels[levels.length - 1];
    expect(last.error).toBeGreaterThanOrEqual(LOD_FEATURE);
    expect(triangles(last.parts[0]!)).toBeLessThan(triangles(creased[creased.length - 1].parts[0]!));
  });

  it('splits a vertex wherever its faces turn by more than the crease angle', () => {
    // A cube of 8 shared corners: each corner meets three faces at right angles
    const p = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]);
    const cube = new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]);
    const split = splitCreases({ attributes: { position: { array: p, size: 3 } }, index: cube });
    expect(split.attributes.position.array.length / 3).toBe(24);
    expect(split.index!.length).toBe(cube.length);
    // ... and a flat sheet of shared corners keeps them shared
    const flat = splitCreases({ attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]), size: 3 } }, index: new Uint32Array([0, 2, 1, 0, 3, 2]) });
    expect(flat.attributes.position.array.length / 3).toBe(4);
  });

  it('makes a shadow caster far lighter than the levels, within less than a texel of the shadow map', () => {
    // On the planked board, where the levels keep every crease, the shadow keeps none of the 4 cm strips
    const board = planked(), part: LodSource = { attributes: { position: { array: board.positions, size: 3 } }, index: board.index };
    const boardLevels = makeLevels([part], simplifier).filter(l => l.error < LOD_FEATURE), [boardShadow] = makeShadow([part], simplifier);
    expect(triangles(boardShadow!)).toBeLessThan(triangles(boardLevels[boardLevels.length - 1].parts[0]!) / 4);
    const body = source(new SphereGeometry(4, 64, 32));
    const [shadow] = makeShadow([body], simplifier);
    expect(triangles(shadow!)).toBeLessThan(triangles(body) / 4);
    // Only positions: a depth map sees no colour
    expect(Object.keys(shadow!.attributes)).toEqual(['position']);
    // Its vertices are the model's own, on the sphere; its faces cut inside by less than the error
    const q = shadow!.attributes.position.array;
    for (let t = 0; t < shadow!.index.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map(k => new Vector3().fromArray(q, shadow!.index[t + k] * 3));
      expect(4 - a.add(b).add(c).divideScalar(3).length()).toBeLessThan(SHADOW_ERROR * 2);
    }
    // ... the error a texel of 0.27 m of an era building or less: the finest shadow map is 170 units over 1,024 texels
    expect(SHADOW_ERROR * 10 / 16).toBeLessThanOrEqual(170 / 1024);
  });

  it('leaves out a level that would save too little, so a plain box keeps only itself', () => {
    expect(makeLevels([source(new BoxGeometry(2, 2, 2))], simplifier)).toEqual([]);
  });

  it('compacts a part to the vertices its triangles use, in the order first used', () => {
    const part: LodSource = { attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 9, 9, 9, 0, 1, 0]), size: 3 } }, index: null };
    const out = compact(part, new Uint32Array([3, 1, 0]));
    expect(Array.from(out.index)).toEqual([0, 1, 2]);
    expect(Array.from(out.attributes.position.array)).toEqual([0, 1, 0, 1, 0, 0, 0, 0, 0]);
  });
});

/** A prototype of one part with two lighter levels, each a box of fewer faces */
function threeLevelPrototype(): Prototype {
  const g = (segments: number) => new BoxGeometry(4, 4, 4, segments, segments, segments).translate(0, 2, 0);
  return { height: 4, parts: [{ geometry: g(8), material: getMaterial('plaster_white'), castShadow: true }],
    lods: [{ error: .05, parts: [g(4)] }, { error: .5, parts: [g(1)] }] };
}
function member(prototype: Prototype, xs: readonly number[], fade = 1): PoolMember {
  const placements = xs.map((x, i) => new Placement({ index: i, x, z: 0, id: 'era.1.home_1', options: {} as never, rotation: 0,
    footprint: [1, 1], height: 4, color: 0, kind: 'residential', water: false, scale: 1, powered: true }));
  return { placements, fade, selected: true, pooled: poolPlacements(placements, prototype) };
}

describe('the pools: every batch of a model drawn together (pools.ts)', () => {
  // A camera at the origin looking along +x: one pixel a world unit at 1,000 units' distance per thousandth of error
  const camera = new PerspectiveCamera(38, 1, .5, 20000);
  camera.position.set(0, 2, 0); camera.lookAt(1, 2, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const view = (ppu: number) => ({ frustum, eye: camera.position.clone(), shadow: null, pixelsPerUnit: ppu });

  it('draws each building at the level its distance allows, and none out of sight', () => {
    const prototype = threeLevelPrototype(), pool = new ModelPool(prototype, [0], () => false);
    // Level 1 from 0.05 x 1000 = 50 units, level 2 from 500 (the distance is to the model's nearest point)
    const near = member(prototype, [10, 30]), far = member(prototype, [200, 900, 3000]), behind = member(prototype, [-400]);
    for (const m of [near, far, behind]) pool.members.add(m);
    pool.refill(view(1000));
    expect(pool.drawn).toEqual([2, 1, 2]);
    expect(Array.from(near.pooled!.at)).toEqual([0, 0]);
    expect(Array.from(far.pooled!.at)).toEqual([1, 2, 2]);
    // Behind the camera: not drawn, and its level never worked out
    expect(Array.from(behind.pooled!.at)).toEqual([-1]);
    // One draw a level for every building of the model, however many batches it came in
    const meshes = pool.root.children.filter(c => c.visible);
    expect(meshes).toHaveLength(3 + 1);
    // Without the screen's scale (before the view says) every building is drawn whole
    pool.refill(view(0));
    expect(pool.drawn).toEqual([5, 0, 0]);
    pool.dispose();
  });

  it('keeps out a batch that is not drawn, and fills its fade into every building of it', () => {
    const prototype = threeLevelPrototype(), pool = new ModelPool(prototype, [0], () => false);
    const shown = member(prototype, [100], .5), gone = member(prototype, [120], 0);
    gone.selected = false;
    pool.members.add(shown); pool.members.add(gone);
    pool.refill(view(1000));
    expect(pool.drawn.reduce((a, b) => a + b, 0)).toBe(1);
    const mesh = pool.root.children.find(c => c.visible && !(c as { castShadow?: boolean }).castShadow) as unknown as { instanceColor: BufferAttribute };
    expect(mesh.instanceColor.getX(0)).toBe(.5);
    pool.dispose();
  });

  it('casts the shadows from the lightest level, in the shadow pass alone', () => {
    const prototype = threeLevelPrototype(), shadowFrustum = new Frustum();
    const pool = new ModelPool(prototype, [0], f => f === shadowFrustum);
    pool.members.add(member(prototype, [20, 600]));
    pool.refill(view(1000));
    expect(pool.shadowDrawn).toBe(2);
    const caster = pool.root.children.find(c => (c as { castShadow?: boolean }).castShadow) as unknown as
      { geometry: BufferGeometry; intersectsFrustum(f: Frustum): boolean };
    expect(caster.geometry.index!.count).toBe(prototype.lods![1].parts[0]!.index!.count);
    expect(caster.intersectsFrustum(shadowFrustum)).toBe(true);
    expect(caster.intersectsFrustum(frustum)).toBe(false);
    // The detailed meshes never cast a shadow of their own
    for (const c of pool.root.children) if (c !== (caster as unknown)) expect((c as { castShadow?: boolean }).castShadow).toBe(false);
    pool.dispose();
    // ... and a prototype's own shadow parts (lod.ts makeShadow) before any level
    const own = new BoxGeometry(1, 1, 1).toNonIndexed(), withShadow = { ...prototype, shadow: [own] };
    const second = new ModelPool(withShadow, [0], f => f === shadowFrustum);
    second.members.add(member(withShadow, [20]));
    second.refill(view(1000));
    const ownCaster = second.root.children.find(c => (c as { castShadow?: boolean }).castShadow) as unknown as { geometry: BufferGeometry };
    expect(ownCaster.geometry.getAttribute('position').count).toBe(own.getAttribute('position').count);
    second.dispose();
  });

  it('tells when a camera moved', () => {
    const last = new Float32Array(16), f = new Frustum();
    expect(frustumOf(camera, f, last)).toBe(true);
    expect(frustumOf(camera, f, last)).toBe(false);
    camera.position.x += 1; camera.updateMatrixWorld();
    expect(frustumOf(camera, f, last)).toBe(true);
    camera.position.x -= 1; camera.updateMatrixWorld();
  });
});

describe('the chunks with levels of detail (chunks.ts)', () => {
  const simplifier = meshopt();
  beforeAll(() => simplifier.ready);
  afterAll(() => useSimplifier(null));

  /** A row of homes on a road, each a model with levels (a detailed sphere) from the provider */
  function town() {
    const width = 48, height = 16, values = new Uint16Array(width * height);
    for (let x = 0; x < width; x++) values[x] = 66;
    for (let x = 0; x < width; x++) values[width + x] = 249;
    const map = { width, height, getTileValue: (x: number, y: number) => values[y * width + x], getTileFlags: () => 0 };
    const snapshot = new TileSnapshot(width, height); snapshot.sync(map);
    const sphere = source(new SphereGeometry(3, 48, 24).translate(0, 3, 0));
    const levels = makeLevels([sphere], simplifier);
    const ready: SerializedPrototype[] = [], requests: PrototypeRequest[] = [];
    const provider = { request(r: PrototypeRequest) { requests.push(r); ready.push({ key: r.key, height: 6, lods: levels, parts: [{ ...sphere,
      material: { key: 'plaster_white', name: 'plaster_white', color: 0xffffff, data: { materialKey: 'plaster_white' } } }] }); },
      take: () => ready.splice(0), dispose: jest.fn() };
    // The clock stands still, so each frame's slices never run out (as in city.test.ts)
    const chunks = new CityChunks(snapshot, 'central', provider, () => 0);
    const camera = new PerspectiveCamera(38, 1, .5, 20000);
    camera.position.set(240, 150, 200); camera.lookAt(240, 0, 10); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    chunks.camera = camera; chunks.pixelsPerUnit = pixelsPerUnit(1080, 38);
    return { chunks, requests, levels, camera, run(frames = 8) { for (let i = 0; i < frames; i++) chunks.update({ x0: 0, y0: 0, x1: width, y1: height }, new Vector3(240, 0, 10), 240); } };
  }

  it('draws a model that has levels through its pool, counting its parts in the draw budget as before', () => {
    const t = town();
    try {
      t.run();
      expect(t.levels.length).toBeGreaterThan(0);
      const pooled = t.chunks.chunks.flatMap(c => c.batches).filter(b => (b as { pool?: unknown }).pool);
      expect(pooled.length).toBeGreaterThan(0);
      expect(t.chunks.pools.size).toBeGreaterThan(0);
      // A pooled batch counts what it would cost alone, so the chunks choose the same detail as before
      for (const b of pooled) expect(b.calls).toBe(1);
      expect(t.chunks.detailCalls).toBeLessThanOrEqual(t.chunks.drawBudget);
      const drawn = [...t.chunks.pools.values()].reduce((n, pool) => n + pool.drawn.reduce((a, b) => a + b, 0), 0);
      expect(drawn).toBeGreaterThan(0);
      // ... and the batch itself draws nothing, nor stands in the scene
      for (const b of pooled) { expect(b.group.children).toHaveLength(0); expect(b.group.parent).toBeNull(); }
      // The map's picture leaves the pools out with the rest of the detail
      t.chunks.mapLOD(true); expect(t.chunks.root.children.find(c => c.name === 'city/pools')!.visible).toBe(false);
      t.chunks.mapLOD(false); expect(t.chunks.root.children.find(c => c.name === 'city/pools')!.visible).toBe(true);
    } finally { t.chunks.dispose(); }
  });

  it('draws the same batches whole, as before, with the levels turned off, and back', () => {
    const t = town();
    try {
      t.run();
      t.chunks.lodOn = false; t.run(12);
      const batches = t.chunks.chunks.flatMap(c => c.batches).filter(b => b.calls > 0);
      expect(batches.some(b => (b as { pool?: unknown }).pool)).toBe(false);
      expect(batches.some(b => b.group.children.length > 0)).toBe(true);
      for (const pool of t.chunks.pools.values()) expect(pool.members.size).toBe(0);
      t.chunks.lodOn = true; t.run(12);
      expect(t.chunks.chunks.flatMap(c => c.batches).some(b => (b as { pool?: unknown }).pool)).toBe(true);
    } finally { t.chunks.dispose(); }
  });

  it('takes a chunk\'s batches out of their pool when the chunk is built again', () => {
    const t = town();
    try {
      t.run();
      const before = [...t.chunks.pools.values()].reduce((n, p) => n + p.members.size, 0);
      expect(before).toBeGreaterThan(0);
      t.chunks.refreshAll();
      expect([...t.chunks.pools.values()].reduce((n, p) => n + p.members.size, 0)).toBe(0);
    } finally { t.chunks.dispose(); }
  });

  it('turns a glb into a prototype with levels when a simplifier is there (eraBuildings.ts)', async () => {
    const { serializeEraScene } = await import('../../src/render3d/city/eraBuildings.js');
    const { Group, Mesh, MeshBasicMaterial } = await import('three');
    const geometry = new SphereGeometry(5, 64, 32);
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(.5), 3));
    const root = new Group(), body = new Mesh(geometry, new MeshBasicMaterial());
    body.name = 'body'; root.add(body);
    const proto = serializeEraScene('k', root, simplifier);
    expect(proto.lods?.length).toBeGreaterThan(0);
    const decoded = decodePrototype(proto);
    expect(decoded.lods![0].parts[0]!.index!.count).toBeLessThan(decoded.parts[0].geometry.index!.count);
    // ... and a shadow caster of its own
    expect(proto.shadow?.[0]?.index.length).toBeLessThan(proto.parts[0].index!.length);
    expect(serializeEraScene('k', root).lods).toBeUndefined();
    expect(serializeEraScene('k', root).shadow).toBeUndefined();
  });
});
