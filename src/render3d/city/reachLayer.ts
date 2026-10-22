/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What a police station, fire station, school or hospital in hand would reach (docs/NO_GRID_PLAN.md 4.3, the Roadmap's
// service radius while a tool is held): on a real-scale city map their cover and places run along the roads, so instead
// of a circle the roads it would reach are laid over in its colour, fainter as its strength falls along them (the road
// showing through), and none past its reach (src/sim/reachPreview.ts, src/cityMap.ts reachColour). Drawn as the traffic layer draws a road (as wide as
// the road, along it as drawn). It only reads the city.

import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { reachColour } from '../../cityMap.js';
import { halfWidth } from '../../roadGeometry.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import { reachedAt, reachShare, type ReachPreview } from '../../sim/reachPreview.js';
import type { CityHeightField } from './heightfield.js';

/** Over the road's surface and the traffic layer, under the cars */
const LIFT = 0.5;
const OPACITY = 0.85;
/** How much of the colour shows at the very end of its reach: enough to see where it ends */
const FAINTEST = 0.2;
/** A road is drawn in pieces this long at most (metres) */
const STEP_M = 4;

export class ReachLayer {
  readonly root = new Group();
  private mesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;
  private shownFor: ReachPreview | null = null;

  constructor(private readonly map: { readonly roadGraph?: RoadGraph | null }, private readonly terrain: CityHeightField,
    private readonly units: number) {
    this.root.name = 'reach_layer';  }

  /** Shows the roads a building in hand would reach, or nothing; built again only when the preview changes */
  show(preview: ReachPreview | null): void {
    if (preview === this.shownFor) return;
    this.shownFor = preview;
    this.clear();
    const graph = this.map.roadGraph;
    if (!preview || !graph) return;
    const positions: number[] = [], colours: number[] = [], index: number[] = [], u = this.units;
    for (const road of preview.roads) {
      if (!graph.segments.has(road.id)) continue;
      const s = graph.segment(road.id), length = graph.length(road.id);
      const half = halfWidth(s.level, u), n = s.shape === 'line' ? Math.max(1, Math.ceil(length / STEP_M))
        : Math.max(2, Math.ceil(length / STEP_M));
      const points: Array<[number, number]> = [], shares: number[] = [];
      for (let j = 0; j <= n; j++) {
        const [x, z] = graph.pointAt(road.id, j / n);
        points.push([x * u, z * u]);
        shares.push(reachShare(preview.field, reachedAt(road, j / n, length), preview.metres));
      }
      const start = positions.length / 3;
      for (let j = 0; j < points.length; j++) {
        const [ax, az] = points[Math.max(0, j - 1)], [bx, bz] = points[Math.min(points.length - 1, j + 1)];
        const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * half, nz = dx / l * half;
        const [x, z] = points[j], [r, g, b] = reachColour(preview.field, shares[j]).map((c) => c / 255);
        const a = OPACITY * (FAINTEST + (1 - FAINTEST) * shares[j]);
        for (const side of [1, -1]) {
          const px = x + nx * side, pz = z + nz * side;
          positions.push(px, this.terrain.sample(px, pz) + LIFT, pz);
          colours.push(r, g, b, a);
        }
      }
      // (only the pieces with an end within its reach)
      for (let j = 0; j < points.length - 1; j++) {
        if (!(shares[j] > 0 || shares[j + 1] > 0)) continue;
        const a = start + j * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    if (!index.length) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    // (each point's own opacity: the colour's fourth number, three.js's vertex alphas)
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 4));
    geometry.setIndex(index);
    const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false,
      side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
  }

  /** How many pieces of road it shows now (tests) */
  get pieces(): number { return this.mesh ? (this.mesh.geometry.getIndex()?.count ?? 0) / 6 : 0; }

  private clear(): void {
    if (!this.mesh) return;
    this.root.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }

  dispose(): void { this.clear(); this.shownFor = null; }
}
