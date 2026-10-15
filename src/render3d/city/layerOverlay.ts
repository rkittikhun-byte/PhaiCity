/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A layer of the city map laid over the city's ground, as Cities: Skylines' info views colour it (owner, 15 Oct 2026:
// "คลิกปุ่มใน แผนที่เมือง แล้วให้เห็นใน map ของ ที่กำลังเล่นอยู่ได้ไหม"): the city map window's picture of the layer, one
// pixel a tile (src/cityMap.ts layerPixels), draped over the hills, see-through so the buildings stand out of it. It
// only reads; the window says which layer, and none for the whole city.

import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, NearestFilter,
  SRGBColorSpace } from 'three';
import type { CityHeightField } from './heightfield.js';

/** Over the ground and the roads, under the buildings' tops */
const LIFT = 0.35;
const OPACITY = 0.62;
/** Vertices at most this many a side, so a big map stays light */
const MOST = 256;

export class LayerOverlay {
  readonly root = new Group();
  private mesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;

  constructor(private readonly width: number, private readonly height: number, private readonly terrain: CityHeightField) {
    this.root.name = 'layer_overlay';
  }

  /** Lays the layer's picture (width × height pixels, a pixel a tile) over the ground, or takes it away (null) */
  show(tiles: HTMLCanvasElement | null): void {
    this.clear();
    if (!tiles) return;
    const step = Math.max(1, Math.ceil(Math.max(this.width, this.height) / MOST));
    const columns = Math.ceil(this.width / step), rows = Math.ceil(this.height / step);
    const positions: number[] = [], uvs: number[] = [], index: number[] = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      const x = Math.min(this.width, i * step) * 10, z = Math.min(this.height, j * step) * 10;
      positions.push(x, this.terrain.sample(x, z) + LIFT, z);
      uvs.push(x / (this.width * 10), 1 - z / (this.height * 10));
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    const texture = new CanvasTexture(tiles);
    texture.magFilter = NearestFilter; texture.minFilter = NearestFilter; texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: OPACITY, depthWrite: false,
      side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.renderOrder = 8;
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
  }

  /** Whether a layer is laid over the ground */
  get showing(): boolean { return this.mesh !== null; }

  private clear(): void {
    if (!this.mesh) return;
    this.root.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.map?.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }

  dispose(): void { this.clear(); }
}
