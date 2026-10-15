/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's buses (owner, 15 Oct 2026: "ป้ายรถเมล์ ไม่ต้องมีตั้งนะ แค่วาง รถเมล์ ก็ไปรับได้เลย"): each one put down on a
// road (gameMap.buses, src/busStopTool.ts) drives up and down its road there, picking people up, as the simulation counts
// it (src/transit.ts). It only reads the map and the roads' lines.

import { Group, type Object3D } from 'three';
import { registry } from '../models/registry.js';
import type { Point } from '../../roadGeometry.js';
import type { CityHeightField } from './heightfield.js';

/** How far a bus drives either way from where it was put down (world units), and how fast */
const RUN = 60;
const SPEED = 6;
/** How far left of the road's middle it keeps, as traffic does in Thailand (world units, about 1.6 m) */
const LANE = 1;

interface BusMap { readonly width: number; buses?: number[] }

export class CityBuses {
  readonly root = new Group();
  private readonly models: Object3D[] = [];

  constructor(private readonly map: BusMap, private readonly terrain: CityHeightField, private readonly size: number) {
    this.root.name = 'buses';
  }

  /** Each frame: every bus on its road, at the time given (seconds); lines: the roads as drawn (roadCurves.ts) */
  update(lines: ReadonlyArray<{ points: Point[]; rail: boolean }>, seconds: number): void {
    const buses = this.map.buses ?? [];
    while (this.models.length < buses.length) {
      const model = registry['veh.bus']?.factory({ seed: this.models.length }) ?? new Group();
      model.scale.setScalar(this.size);
      this.models.push(model); this.root.add(model);
    }
    this.models.forEach((model, n) => { model.visible = n < buses.length; });
    buses.forEach((index, n) => {
      const x = (index % this.map.width + 0.5) * 10, z = (Math.floor(index / this.map.width) + 0.5) * 10;
      const phase = seconds * SPEED / RUN + n;
      const place = this.along(lines, x, z, Math.sin(phase) * RUN);
      const model = this.models[n];
      if (!place) { model.visible = false; return; }
      // It faces the way it drives: back along the line while its run swings back
      const turn = place.turn + (Math.cos(phase) < 0 ? Math.PI : 0);
      // Its left is (cos, -sin) of the way it faces
      const x0 = place.x + Math.cos(turn) * LANE, z0 = place.z - Math.sin(turn) * LANE;
      model.position.set(x0, this.terrain.sample(x0, z0), z0);
      model.rotation.y = turn;
    });
  }

  /** The point `offset` along the road line nearest (x, z), and the line's own way there */
  private along(lines: ReadonlyArray<{ points: Point[]; rail: boolean }>, x: number, z: number, offset: number):
      { x: number; z: number; turn: number } | null {
    let best: { line: Point[]; i: number; t: number; d: number } | null = null;
    for (const { points, rail } of lines) {
      if (rail) continue;
      for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], dx = points[i][0] - ax, dz = points[i][1] - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
        if (!best || d < best.d) best = { line: points, i, t, d };
      }
    }
    if (!best || best.d > 12) return null;
    // Walk the offset along the line from there
    const { line } = best;
    let i = best.i, left = Math.abs(offset), forward = offset >= 0;
    let [px, pz] = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * best.t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * best.t];
    let k = forward ? i : i - 1;
    while (left > 0 && k >= 0 && k < line.length) {
      const [qx, qz] = line[k], d = Math.hypot(qx - px, qz - pz);
      if (d >= left) { px += (qx - px) * left / d; pz += (qz - pz) * left / d; left = 0; break; }
      left -= d; px = qx; pz = qz; k += forward ? 1 : -1;
    }
    const a = line[Math.max(0, Math.min(line.length - 2, k - (forward ? 1 : 0)))], b = line[Math.max(1, Math.min(line.length - 1, k + (forward ? 0 : 1)))];
    const turn = Math.atan2(b[0] - a[0], b[1] - a[1]);
    return { x: px, z: pz, turn };
  }

  dispose(): void { this.root.clear(); }
}
