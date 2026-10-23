/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A layer of the city map laid over the city's ground, as Cities: Skylines' info views colour it (owner, 15 Oct 2026:
// "คลิกปุ่มใน แผนที่เมือง แล้วให้เห็นใน map ของ ที่กำลังเล่นอยู่ได้ไหม"): the city map window's picture of the layer, one
// pixel a tile (src/cityMap.ts layerPixels), draped over the hills, see-through so the buildings stand out of it. It
// only reads; the window says which layer, and none for the whole city.
//
// Soft, with no tile in it (docs/NO_GRID_PLAN.md 0.6, owner 22 Oct 2026: "ไหนบอกว่าไม่มีตารางแล้ว"): the picture is
// blurred a little and drawn smoothly between the tiles' middles, so a value kept a tile (16 m) or a block of tiles at a
// time shows as a gradient rather than squares, until the layers are drawn from the values at the buildings and roads
// themselves (steps 1.6 and 4.5).

import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, Group, LinearFilter, Mesh, MeshBasicMaterial,
  SRGBColorSpace } from 'three';
import type { CityHeightField } from './heightfield.js';

/** Over the ground and the roads, under the buildings' tops */
const LIFT = 0.35;
const OPACITY = 0.62;
/** Vertices at most this many a side, so a big map stays light: up to 512 tiles a side a vertex a tile corner, where the
 * layer lies on the ground's own triangles and follows them exactly (playtest, 23 Oct 2026: with a vertex every 2 tiles
 * on a 480-tile city map the ground's bulges between them poked through in pale polygons and lines) */
const MOST = 512;
/** Times the picture is box-blurred a pixel either side: three make a bell about a tile and a half wide */
const SOFTEN = 3;

/**
 * An RGBA picture blurred in place, a pixel either side `passes` times across and down, its colours weighed by how
 * opaque they are, so a coloured tile fades into a clear one rather than into black. Plain code, for tests.
 */
export function softenPixels(data: Uint8ClampedArray, width: number, height: number, passes = SOFTEN): void {
  const n = width * height, r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const alpha = data[i * 4 + 3] / 255;
    r[i] = data[i * 4] * alpha; g[i] = data[i * 4 + 1] * alpha; b[i] = data[i * 4 + 2] * alpha; a[i] = alpha;
  }
  const tmp = new Float32Array(Math.max(width, height));
  const blurLine = (ch: Float32Array, start: number, stride: number, count: number): void => {
    for (let k = 0; k < count; k++) {
      const p = ch[start + k * stride], before = k > 0 ? ch[start + (k - 1) * stride] : p, after = k < count - 1 ? ch[start + (k + 1) * stride] : p;
      tmp[k] = (before + p + after) / 3;
    }
    for (let k = 0; k < count; k++) ch[start + k * stride] = tmp[k];
  };
  for (let pass = 0; pass < passes; pass++) {
    for (const ch of [r, g, b, a]) {
      for (let y = 0; y < height; y++) blurLine(ch, y * width, 1, width);
      for (let x = 0; x < width; x++) blurLine(ch, x, width, height);
    }
  }
  for (let i = 0; i < n; i++) {
    const alpha = a[i];
    data[i * 4] = alpha > 0 ? r[i] / alpha : 0; data[i * 4 + 1] = alpha > 0 ? g[i] / alpha : 0;
    data[i * 4 + 2] = alpha > 0 ? b[i] / alpha : 0; data[i * 4 + 3] = alpha * 255;
  }
}

/** The layer's picture softened (softenPixels) on a canvas of its own, or the picture as it was where it cannot be read */
function softened(tiles: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const out = document.createElement('canvas');
    out.width = tiles.width; out.height = tiles.height;
    const context = out.getContext('2d');
    if (!context) return tiles;
    context.drawImage(tiles, 0, 0);
    const image = context.getImageData(0, 0, out.width, out.height);
    softenPixels(image.data, out.width, out.height);
    context.putImageData(image, 0, 0);
    return out;
  } catch {
    return tiles;
  }
}

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
    // A cell holding ground levelled under a building (src/terrain/groundGrade.ts) is laid finer, 2.5 units a step over
    // its tiles, so the pad and its bank between the coarse points never poke through the layer (playtest, 23 Oct 2026)
    const fine = (x0: number, z0: number, x1: number, z1: number): void => {
      const n = Math.max(1, Math.round((x1 - x0) / 2.5)), m = Math.max(1, Math.round((z1 - z0) / 2.5)), base = positions.length / 3;
      for (let r = 0; r <= m; r++) for (let q = 0; q <= n; q++) {
        const x = x0 + (x1 - x0) * q / n, z = z0 + (z1 - z0) * r / m;
        positions.push(x, this.terrain.sample(x, z) + LIFT, z);
        uvs.push(x / (this.width * 10), 1 - z / (this.height * 10));
      }
      for (let r = 0; r < m; r++) for (let q = 0; q < n; q++) {
        const a = base + r * (n + 1) + q, b = a + 1, c = a + n + 1, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    };
    const levelled = (i: number, j: number): boolean => {
      for (let y = j * step; y < Math.min(this.height, (j + 1) * step); y++)
        for (let x = i * step; x < Math.min(this.width, (i + 1) * step); x++) if (this.terrain.levelled?.(y * this.width + x)) return true;
      return false;
    };
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      if (levelled(i, j)) {
        fine(i * step * 10, j * step * 10, Math.min(this.width, (i + 1) * step) * 10, Math.min(this.height, (j + 1) * step) * 10);
        continue;
      }
      const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    const texture = new CanvasTexture(softened(tiles));
    texture.magFilter = LinearFilter; texture.minFilter = LinearFilter; texture.generateMipmaps = false;
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
