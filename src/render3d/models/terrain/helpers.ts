/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group,
  Material, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { getMaterial, tint } from '../../materials/library.js';
import { applyWorldUV, countTriangles, mergeGeometry } from '../../util/geometry.js';
import type { ModelOptions } from '../registry.js';
import { PlantBuilder, point } from '../vegetation/builder.js';

export const mask4 = (value = 0): number => Number.isFinite(value) ? Math.trunc(value) & 15 : 0;
export const SIDES = [
  { bit: 1, x: 0, z: -1, angle: 0 }, { bit: 2, x: 1, z: 0, angle: -Math.PI / 2 },
  { bit: 4, x: 0, z: 1, angle: Math.PI }, { bit: 8, x: -1, z: 0, angle: Math.PI / 2 },
] as const;
export const isCanal = (mask: number): boolean => (mask & 5) === 5 || (mask & 10) === 10;

export function horizontal(width = 10, depth = 10, y = 0): BufferGeometry {
  const geometry = new PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) position.setY(i, y);
  return geometry;
}

/** The source positions are tile-local; UVs are baked from the tile's world center.
 * Leaf atlases and canvas signs deliberately bypass this projection.
 */
export function terrainUV(source: BufferGeometry, origin: readonly [number, number] = [0, 0]): BufferGeometry {
  source.translate(origin[0], 0, origin[1]);
  const geometry = applyWorldUV(source, 1);
  geometry.translate(-origin[0], 0, -origin[1]);
  return geometry;
}

export class TerrainBuilder extends PlantBuilder {
  constructor(readonly options: ModelOptions) { super(); }
  world(source: BufferGeometry, material: Material): void {
    const geometry = terrainUV(source, this.options.worldOrigin);
    if (source !== geometry) source.dispose(); this.add(geometry, material);
  }
  box(center: Vector3, size: Vector3, material: Material, yaw = 0, roll = 0): void {
    this.world(new BoxGeometry(size.x, size.y, size.z).rotateZ(roll).rotateY(yaw)
      .translate(center.x, center.y, center.z), material);
  }
  cylinder(center: Vector3, radius: number, height: number, material: Material, sides = 8, roll = 0): void {
    this.world(new CylinderGeometry(radius, radius, height, sides).rotateZ(roll)
      .translate(center.x, center.y, center.z), material);
  }
  rod(start: Vector3, end: Vector3, radius: number, material: Material, sides = 4): void {
    const direction = end.clone().sub(start), center = start.clone().add(end).multiplyScalar(0.5);
    const source = new CylinderGeometry(radius, radius, direction.length(), sides)
      .applyQuaternion(new Quaternion().setFromUnitVectors(point(0, 1, 0), direction.normalize()))
      .translate(center.x, center.y, center.z);
    this.world(source, material);
  }
  /** Angular rubble, stones and soil heaps, six irregular outer vertices around a peak. */
  heap(center: Vector3, radius: number, height: number, material: Material, phase = 0): void {
    const vertices: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = phase + i * Math.PI / 3, c = phase + (i + 1) * Math.PI / 3;
      vertices.push(center.x, center.y + height, center.z,
        center.x + Math.cos(c) * radius, center.y, center.z + Math.sin(c) * radius,
        center.x + Math.cos(a) * radius, center.y, center.z + Math.sin(a) * radius);
    }
    const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
    source.computeVertexNormals(); this.world(source, material);
  }
  /** Dry grass uses slender intersecting blades, rather than the broadleaf atlas. */
  grass(x: number, z: number, height: number, material: Material, y = 0): void {
    const vertices: number[] = [];
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI / 3, dx = Math.cos(angle) * 0.12, dz = Math.sin(angle) * 0.12;
      const a = [x - dx, y, z - dz], c = [x + dx, y, z + dz], top = [x + dx * 1.4, y + height, z + dz * 1.4];
      vertices.push(...a, ...top, ...c, ...c, ...top, ...a);
    }
    const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
    source.computeVertexNormals(); this.world(source, material);
  }
  finishTerrain(id: string, groundParts: BufferGeometry[], groundMaterial: Material, tiles: readonly number[], waterY?: number): Group {
    // Inherited botanical tubes may have been transformed after construction.
    // Reproject every solid prop from final positions; preserve leaf atlases/sign canvases.
    this.parts.forEach(part => {
      if (!['foliage_tropical', 'sign_thai'].includes(part.material.userData.materialKey)) {
        const source = part.geometry; part.geometry = terrainUV(source, this.options.worldOrigin);
        if (source !== part.geometry) source.dispose();
      }
    });
    const root = this.finish(id, 'terrain', [1, 1], tiles, this.options);
    const projected = groundParts.map(source => {
      const geometry = terrainUV(source, this.options.worldOrigin);
      if (geometry !== source) source.dispose(); return geometry;
    });
    const ground = new Mesh(mergeGeometry(projected), groundMaterial); projected.forEach(g => g.dispose());
    ground.name = `${id}/ground`; ground.receiveShadow = true; ground.userData.role = 'ground'; root.add(ground);
    if (waterY !== undefined) {
      const surface = root.children.find(child => child instanceof Mesh &&
        !Array.isArray(child.material) && child.material.userData.materialKey?.startsWith('water_')) as Mesh | undefined;
      if (surface) {
        root.remove(surface); surface.geometry.translate(0, -waterY, 0);
        surface.name = `${id}/water`; surface.castShadow = false;
        const animation = new Group(); animation.name = 'anim_water'; animation.position.y = waterY;
        animation.userData = { kind: 'normal-scroll', velocity: [0.012, 0.007], surfaceY: waterY };
        animation.add(surface); root.add(animation);
      }
    }
    root.userData.triangles = countTriangles(root);
    root.userData.worldOrigin = [...(this.options.worldOrigin ?? [0, 0])];
    return root;
  }
}

export const bankMaterial = (style: 'earth' | 'concrete' | 'brick'): Material => style === 'earth'
  ? tint('dirt_laterite', 0x77624c) : getMaterial(style === 'brick' ? 'brick_red' : 'concrete_weathered');
