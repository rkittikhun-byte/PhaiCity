/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Bone, Box3, BufferGeometry, Float32BufferAttribute, Group, Material, Mesh,
  Object3D, Shape, ShapeGeometry, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector2, Vector3 } from 'three';
import { getMaterial, roadCurbMaterial } from '../../materials/library.js';
import { countTriangles, mergeGeometry } from '../../util/geometry.js';
import { TerrainBuilder } from '../terrain/helpers.js';
import { point } from '../vegetation/builder.js';
import { ROAD_SECTION } from './interfaces.js';

export type Point2 = readonly [number, number];
export interface PropBounds { kind: string; min: number[]; max: number[] }

/** Uses the terrain's world projection and batches both rigid and articulated parts. */
export class RoadBuilder extends TerrainBuilder {
  readonly props: PropBounds[] = [];
  readonly anchors: Object3D[] = [];
  private readonly rootBone = new Bone();
  private readonly bones: Bone[] = [this.rootBone];
  private readonly poses: { bone: Bone; axis: 'x' | 'z'; angle: number }[] = [];
  private readonly partBones: number[] = [];
  private currentBone = 0;

  override add(geometry: BufferGeometry, material: Material): void {
    super.add(geometry, material); this.partBones.push(this.currentBone);
  }

  polygon(outline: readonly Point2[], material: Material, height: (x: number, z: number) => number): void {
    const shape = new Shape(outline.map(([x, z]) => new Vector2(x, -z)));
    const source = new ShapeGeometry(shape).rotateX(-Math.PI / 2);
    const positions = source.getAttribute('position');
    for (let i = 0; i < positions.count; i++) positions.setY(i, height(positions.getX(i), positions.getZ(i)));
    source.computeVertexNormals(); this.world(source, material);
  }

  slab(outline: readonly Point2[], material: Material, ground: (z: number) => number = () => 0): void {
    this.polygon(outline, material, (_x, z) => ground(z) + ROAD_SECTION.sidewalkY);
    const vertices: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const ay = ground(a[1]), by = ground(b[1]), h = ROAD_SECTION.sidewalkY;
      vertices.push(a[0], ay, a[1], a[0], ay + h, a[1], b[0], by + h, b[1],
        a[0], ay, a[1], b[0], by + h, b[1], b[0], by, b[1]);
    }
    const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
    source.computeVertexNormals(); this.world(source, material);
  }

  /** Raised curb with UV.x measured continuously along the curb, including curves. */
  curb(path: readonly Point2[], painted: boolean, ground: (z: number) => number = () => 0): void {
    const vertices: number[] = [], uv: number[] = []; let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], next = distance + Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ay = ground(a[1]), by = ground(b[1]), h = ROAD_SECTION.sidewalkY;
      const p = [point(a[0], ay, a[1]), point(a[0], ay + h, a[1]), point(b[0], by + h, b[1]), point(b[0], by, b[1])];
      // Two-sided vertical curb face, no overlapping top paint.
      for (const indices of [[0, 1, 2, 0, 2, 3], [2, 1, 0, 3, 2, 0]]) for (const index of indices) {
        vertices.push(...p[index].toArray()); uv.push(index < 2 ? distance : next, index === 1 || index === 2 ? h : 0);
      }
      distance = next;
    }
    const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
    source.setAttribute('uv', new Float32BufferAttribute(uv, 2)); source.computeVertexNormals();
    this.add(source, painted ? roadCurbMaterial() : getMaterial('sidewalk_tile'));
  }

  line(path: readonly Point2[], width = 0.12, ground: (z: number) => number = () => 0): void {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length === 0) continue;
      const dx = -(b[1] - a[1]) / length * width / 2, dz = (b[0] - a[0]) / length * width / 2;
      const corners: Point2[] = [[a[0] + dx, a[1] + dz], [b[0] + dx, b[1] + dz],
        [b[0] - dx, b[1] - dz], [a[0] - dx, a[1] - dz]];
      this.polygon(corners.map(([x, z]) => [Math.max(-5, Math.min(5, x)), Math.max(-5, Math.min(5, z))]),
        getMaterial('road_marking_white'), (_x, z) => ground(z) + 0.004);
    }
  }

  prop(kind: string, build: () => void): void {
    const start = this.parts.length; build(); const bounds = new Box3();
    this.parts.slice(start).forEach(part => { part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!); });
    this.props.push({ kind, min: bounds.min.toArray(), max: bounds.max.toArray() });
  }

  light(x: number, y: number, z: number): void {
    const anchor = new Object3D(); anchor.name = `anchor_light_${this.anchors.length}`;
    anchor.position.set(x, y, z); this.anchors.push(anchor);
  }

  articulated(name: string, pivot: Vector3, axis: 'x' | 'z', angle: number, build: () => void): void {
    const bone = new Bone(); bone.name = name; bone.position.copy(pivot);
    this.rootBone.add(bone); this.bones.push(bone); this.poses.push({ bone, axis, angle });
    this.currentBone = this.bones.length - 1; build(); this.currentBone = 0;
  }

  finishRoad(id: string, tiles: readonly number[], mask: number): Group {
    let root: Group;
    if (this.bones.length === 1) root = this.finish(id, 'road', [1, 1], tiles, this.options);
    else {
      root = new Group(); root.name = id; this.rootBone.name = `${id}/rig`; root.add(this.rootBone);
      root.updateMatrixWorld(true);
      const skeleton = new Skeleton(this.bones);
      const batches = new Map<Material, { geometry: BufferGeometry; bone: number }[]>();
      this.parts.forEach((part, index) => {
        const batch = batches.get(part.material) ?? [];
        batch.push({ geometry: part.geometry, bone: this.partBones[index] }); batches.set(part.material, batch);
      });
      batches.forEach((parts, material) => {
        const geometry = mergeGeometry(parts.map(part => part.geometry));
        const indices: number[] = [], weights: number[] = [];
        parts.forEach(part => {
          const count = part.geometry.index?.count ?? part.geometry.getAttribute('position').count;
          for (let i = 0; i < count; i++) { indices.push(part.bone, 0, 0, 0); weights.push(1, 0, 0, 0); }
        });
        geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
        geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
        const mesh = new SkinnedMesh(geometry, material); mesh.name = `${id}/${material.name}`;
        mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
        root.add(mesh); mesh.bind(skeleton);
      });
      this.parts.forEach(part => part.geometry.dispose());
      this.poses.forEach(({ bone, axis, angle }) => { bone.rotation[axis] = angle; });
      root.updateMatrixWorld(true);
      root.traverse(object => { if (object instanceof SkinnedMesh) { object.computeBoundingBox(); object.computeBoundingSphere(); } });
      root.userData = { id, category: 'road', footprint: [1, 1], tiles: [...tiles], regionTier: 'R3', region: this.options.region ?? 'central' };
    }
    if (this.anchors.length) root.add(...this.anchors);
    root.userData = { ...root.userData, triangles: countTriangles(root), connections: mask,
      crossSection: { ...ROAD_SECTION }, props: this.props, worldOrigin: [...(this.options.worldOrigin ?? [0, 0])] };
    // Avoid burying the surface name in a material cache token.
    root.traverse(object => {
      if (object instanceof Mesh && !Array.isArray(object.material) && object.material === getMaterial('asphalt')) object.name = `${id}/carriageway`;
    });
    return root;
  }
}
