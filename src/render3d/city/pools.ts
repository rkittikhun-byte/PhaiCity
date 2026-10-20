/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The era buildings of a whole city in a few draw calls (docs/3d/RENDERER_SPEC.md §8B, METRE_DRAWING_PLAN.md §6
// "BatchedMesh / instancing ทั้งเมือง"). The city's chunks still choose which batches of a model are drawn in detail and
// fade them in and out as before (chunks.ts); a model with levels of detail (lod.ts) then draws every one of its chosen
// batches across the city together: one instanced mesh per level and part, and one per part for the sun's shadow, so a
// town of thousands of buildings costs a few draws per kind of building rather than a few per kind in every chunk.
//
// Each time the camera moves, or a batch comes, goes or fades, a pool fills its meshes again: each building at the level
// its distance allows (lodLevel), and only those the camera or the sun's shadow can see (a sphere round each, against
// their frustums), so a building out of sight costs nothing.

import { DynamicDrawUsage, Frustum, type FrustumArray, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Sphere, Vector3,
  type BufferGeometry, type Camera } from 'three';
import { cityLODDepthMaterial, cityLODMaterial } from '../materials/library.js';
import type { Prototype } from './prototypes.js';
import type { Placement } from './types.js';
import { lodDistance, lodLevel } from './lod.js';

/** What a pool keeps of each placement of a batch it draws: its model matrix, its middle (world units) and reach, its
 * scale, whether it lies outside the province, and the level it was last drawn at (-1 none yet) */
export interface PoolPlacements {
  matrices: Float32Array; centres: Float32Array; reach: Float32Array; scale: Float32Array; outside: Float32Array; at: Int8Array;
}
/** A batch a pool draws: its placements and how far it has faded in (chunks.ts Batch) */
export interface PoolMember { readonly placements: readonly Placement[]; fade: number; selected: boolean; pooled?: PoolPlacements }

const matrix = new Matrix4(), point = new Vector3(), sphere = new Sphere(), product = new Matrix4();

/** The pool's view of each placement, from the prototype's first part (its middle and reach) */
export function poolPlacements(placements: readonly Placement[], prototype: Prototype): PoolPlacements {
  const n = placements.length, bounds = prototype.parts[0]?.geometry.boundingSphere;
  const out: PoolPlacements = { matrices: new Float32Array(n * 16), centres: new Float32Array(n * 3), reach: new Float32Array(n),
    scale: new Float32Array(n), outside: new Float32Array(n), at: new Int8Array(n).fill(-1) };
  placements.forEach((p, i) => {
    p.modelMatrix(matrix); matrix.toArray(out.matrices, i * 16);
    (bounds ? point.copy(bounds.center) : point.set(0, 0, 0)).applyMatrix4(matrix).toArray(out.centres, i * 3);
    out.scale[i] = p.scale; out.reach[i] = (bounds?.radius ?? 0) * p.scale; out.outside[i] = p.outside ? 1 : 0;
  });
  return out;
}

/** One level's (or the shadow's) meshes, one per part, and the per-instance buffers they share */
interface Slots { meshes: InstancedMesh[]; matrix: InstancedBufferAttribute; color: InstancedBufferAttribute; outside: InstancedBufferAttribute; count: number }

/** What a pool needs from the view each time it fills its meshes */
export interface PoolView {
  /** The camera's frustum and where it is, null before the view has said */
  frustum: Frustum | null; eye: Vector3;
  /** The sun's shadow camera's frustum, null when none is known */
  shadow: Frustum | null;
  /** The screen's pixels per world unit one unit from the camera (lod.ts pixelsPerUnit); 0 draws every model whole */
  pixelsPerUnit: number;
}

/** Every drawn batch of one model with levels of detail, drawn together */
export class ModelPool {
  readonly root = new Group();
  readonly members = new Set<PoolMember>();
  /** Set when a member comes, goes or fades, so the pool fills its meshes again */
  dirty = true;
  /** Instances drawn at each level and in the shadow at the last fill */
  readonly drawn: number[] = [];
  shadowDrawn = 0;
  private levels: Slots[] = [];
  private shadow: Slots | null = null;
  private capacity = 0;
  private readonly thresholds: number[] = [];
  /** The buildings of each level in sight at a fill, with their squared distance from the camera, to draw nearest first */
  private readonly order: { member: PoolMember; i: number; d: number }[][] = [];
  private readonly errors: number[];
  /**
   * @param parts the prototype's parts to draw, by index (the chunks leave out ground parts that the far ground draws)
   * @param shadowPass whether a frustum is the sun's shadow pass's, the only pass that draws the shadow meshes
   */
  constructor(readonly prototype: Prototype, private readonly parts: readonly number[], private readonly shadowPass: (frustum: unknown) => boolean) {
    this.root.name = 'city/model-pool';
    this.errors = (prototype.lods ?? []).map(l => l.error);
  }
  /** Draw calls a member's batch would have cost on its own: one per part */
  get calls(): number { return this.parts.length; }
  private slots(geometries: (BufferGeometry | null)[], capacity: number, shadow: boolean): Slots {
    const matrix = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16).setUsage(DynamicDrawUsage);
    const color = new InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3).setUsage(DynamicDrawUsage);
    const outside = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
    // Buildings stand on their own level ground and over no water: no terrain slope and no bridge piers
    const terrain = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4), bridge = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    const meshes: InstancedMesh[] = [];
    this.parts.forEach((j, n) => {
      const source = geometries[n], part = this.prototype.parts[j];
      if (!source || shadow && !(part.castShadow ?? true)) return;
      const geometry = source.clone();
      geometry.setAttribute('cityOutside', outside); geometry.setAttribute('cityTerrain', terrain); geometry.setAttribute('cityBridgeDepth', bridge);
      const mesh = new InstancedMesh(geometry, cityLODMaterial(part.material), capacity);
      mesh.instanceMatrix = matrix; mesh.instanceColor = color; mesh.count = 0; mesh.visible = false;
      mesh.receiveShadow = part.receiveShadow ?? true;
      if (shadow) {
        mesh.castShadow = true; mesh.customDepthMaterial = cityLODDepthMaterial(mesh.material as typeof part.material);
        // ... drawn by the shadow pass alone: every other pass (the city, the map's picture) is told apart by its frustum
        mesh.intersectsFrustum = (frustum: Frustum | FrustumArray) => this.shadowPass(frustum) && mesh.count > 0;
      } else {
        // Out-of-sight buildings are left out when the pool fills (refill), so the mesh needs no culling of its own
        mesh.castShadow = false; mesh.frustumCulled = false;
      }
      meshes.push(mesh); this.root.add(mesh);
    });
    return { meshes, matrix, color, outside, count: 0 };
  }
  private build(capacity: number): void {
    this.disposeMeshes();
    const lods = this.prototype.lods ?? [], parts = this.parts.map(j => this.prototype.parts[j].geometry);
    this.levels = [this.slots(parts, capacity, false), ...lods.map(l => this.slots(this.parts.map(j => l.parts[j]), capacity, false))];
    // The shadow from the prototype's own shadow parts (lod.ts makeShadow, within less than a texel of the shadow map),
    // else the lightest level that has each part
    const lightest = this.parts.map((j, n) => this.prototype.shadow?.[j] ?? [...lods].reverse().map(l => l.parts[j]).find(Boolean) ?? parts[n]);
    this.shadow = this.slots(lightest, capacity, true);
    if (!this.shadow.meshes.length) { this.disposeSlots(this.shadow); this.shadow = null; }
    this.capacity = capacity;
  }
  private static put(slots: Slots, member: PoolMember, i: number): void {
    const k = slots.count++, pooled = member.pooled!;
    (slots.matrix.array as Float32Array).set(pooled.matrices.subarray(i * 16, i * 16 + 16), k * 16);
    slots.color.setX(k, member.fade); slots.outside.setX(k, pooled.outside[i]);
  }
  /** Fills the meshes with the members' placements in sight, each at its level */
  refill(view: PoolView): void {
    let total = 0;
    for (const m of this.members) if (m.selected || m.fade > 0) total += m.placements.length;
    if (total > this.capacity || !this.levels.length) this.build(Math.max(16, total, this.capacity * 2));
    for (const slots of this.levels) slots.count = 0;
    if (this.shadow) this.shadow.count = 0;
    const t = this.thresholds, ppu = view.pixelsPerUnit, eye = view.eye, sorting = ppu > 0 && Number.isFinite(eye.x);
    t.length = this.errors.length;
    for (const m of this.members) {
      if (!(m.selected || m.fade > 0) || !m.pooled) continue;
      const p = m.pooled;
      for (let i = 0; i < m.placements.length; i++) {
        sphere.center.fromArray(p.centres, i * 3); sphere.radius = p.reach[i] + 1;
        if (!view.frustum || view.frustum.intersectsSphere(sphere)) {
          let level = 0;
          if (sorting) {
            for (let k = 0; k < t.length; k++) t[k] = lodDistance(this.errors[k] * p.scale[i], ppu);
            level = lodLevel(Math.max(0, sphere.center.distanceTo(eye) - p.reach[i]), t, p.at[i]);
          }
          p.at[i] = level;
          (this.order[level] ??= []).push({ member: m, i, d: sorting ? sphere.center.distanceToSquared(eye) : 0 });
        }
        // ... a little more room against the shadow camera, which the view moves only as it draws
        sphere.radius += 8;
        if (this.shadow && (!view.shadow || view.shadow.intersectsSphere(sphere))) ModelPool.put(this.shadow, m, i);
      }
    }
    // Each level nearest first, so the depth test passes over what stands behind (the walls and roofs cost the most to
    // shade) instead of shading it and covering it
    this.levels.forEach((slots, k) => {
      const order = this.order[k];
      if (!order) return;
      order.sort((a, b) => a.d - b.d);
      for (const { member, i } of order) ModelPool.put(slots, member, i);
      order.length = 0;
    });
    for (const slots of [...this.levels, ...(this.shadow ? [this.shadow] : [])]) {
      for (const mesh of slots.meshes) { mesh.count = slots.count; mesh.visible = slots.count > 0; }
      if (slots.count) { slots.matrix.needsUpdate = true; slots.color.needsUpdate = true; slots.outside.needsUpdate = true; }
    }
    this.drawn.length = this.levels.length;
    this.levels.forEach((slots, k) => { this.drawn[k] = slots.count; });
    this.shadowDrawn = this.shadow?.count ?? 0;
    this.dirty = false;
  }
  private disposeSlots(slots: Slots): void {
    for (const mesh of slots.meshes) { this.root.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); }
  }
  private disposeMeshes(): void {
    for (const slots of this.levels) this.disposeSlots(slots);
    if (this.shadow) this.disposeSlots(this.shadow);
    this.levels = []; this.shadow = null; this.capacity = 0;
  }
  dispose(): void { this.disposeMeshes(); this.members.clear(); this.root.removeFromParent(); }
}

/** A camera's frustum, and whether it moved since `last` (its projection and view, element by element) */
export function frustumOf(camera: Camera, frustum: Frustum, last: Float32Array): boolean {
  product.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(product);
  let moved = false;
  for (let i = 0; i < 16; i++) if (Math.abs(product.elements[i] - last[i]) > 1e-7 * Math.max(1, Math.abs(last[i]))) { moved = true; last[i] = product.elements[i]; }
  return moved;
}
