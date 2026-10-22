/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The traffic layer on the roads themselves (docs/NO_GRID_PLAN.md 1.6, as Cities: Skylines' traffic view): while the
// city map shows its traffic layer, each road of the road graph is laid over in its own colour by how full the month's
// trips make it (src/sim/cityTrips.ts), green flowing freely, yellow filling, red jammed (src/cityMap.ts trafficColour),
// as wide as the road and along it as drawn, instead of the old 32 m squares of traffic. It only reads the city.

import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { trafficColour } from '../../cityMap.js';
import { halfWidth } from '../../roadGeometry.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import type { CityTrips } from '../../sim/cityTrips.js';
import type { CityHeightField } from './heightfield.js';

/** Over the road's surface, under the cars */
const LIFT = 0.45;
const OPACITY = 0.85;
/** A road is drawn in pieces this long at most (metres) */
const STEP_M = 4;

export interface TrafficLayerMap {
  readonly roadGraph?: RoadGraph | null;
  readonly trips?: CityTrips | null;
}

export class TrafficLayer {
  readonly root = new Group();
  private mesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;
  private shown = false;
  private builtFor: CityTrips | null = null;
  private builtVersion = -1;

  constructor(private readonly map: TrafficLayerMap, private readonly terrain: CityHeightField, private readonly units: number) {
    this.root.name = 'traffic_layer';
  }

  /** Shows the roads in their traffic's colours, or takes them away; false when the city has no trips to show */
  show(on: boolean): boolean {
    this.shown = on && Boolean(this.map.trips && this.map.roadGraph);
    if (this.mesh) this.mesh.visible = this.shown;
    if (this.shown) this.update();
    return this.shown;
  }

  get showing(): boolean { return this.shown; }

  /** Built again when the month's trips or the roads have changed, while it shows */
  update(): void {
    const trips = this.map.trips, graph = this.map.roadGraph;
    if (!this.shown || !trips || !graph) return;
    if (trips === this.builtFor && graph.version === this.builtVersion && this.mesh) return;
    this.builtFor = trips;
    this.builtVersion = graph.version;
    this.clear();
    const positions: number[] = [], colours: number[] = [], index: number[] = [], u = this.units;
    for (const id of [...graph.segments.keys()].sort((a, b) => a - b)) {
      const s = graph.segment(id), k = trips.roads.segmentIndex.get(id);
      const full = k === undefined ? 0 : trips.result.cars[k] / Math.max(1, trips.net.capacity[k]);
      const [r, g, b] = trafficColour(full).map((c) => c / 255);
      const half = halfWidth(s.level, u), n = s.shape === 'line' ? Math.max(1, Math.ceil(graph.length(id) / STEP_M))
        : Math.max(2, Math.ceil(graph.length(id) / STEP_M));
      const points: Array<[number, number]> = [];
      for (let j = 0; j <= n; j++) { const [x, z] = graph.pointAt(id, j / n); points.push([x * u, z * u]); }
      const start = positions.length / 3;
      for (let j = 0; j < points.length; j++) {
        const [ax, az] = points[Math.max(0, j - 1)], [bx, bz] = points[Math.min(points.length - 1, j + 1)];
        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1, nx = -dz / length * half, nz = dx / length * half;
        const [x, z] = points[j];
        for (const side of [1, -1]) {
          const px = x + nx * side, pz = z + nz * side;
          positions.push(px, this.terrain.sample(px, pz) + LIFT, pz);
          colours.push(r, g, b);
        }
      }
      for (let j = 0; j < points.length - 1; j++) {
        const a = start + j * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    if (!positions.length) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setIndex(index);
    const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: OPACITY, depthWrite: false,
      side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.renderOrder = 9;
    this.mesh.frustumCulled = false;
    this.mesh.visible = this.shown;
    this.root.add(this.mesh);
  }

  private clear(): void {
    if (!this.mesh) return;
    this.root.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }

  dispose(): void { this.clear(); }
}
