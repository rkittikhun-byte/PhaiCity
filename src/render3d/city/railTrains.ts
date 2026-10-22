/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A real train on the railway as drawn (docs/NO_GRID_PLAN.md 1.5): a locomotive and its carriages (veh.train_loco,
// veh.train_car) running the longest line of the rail graph (src/roads/roadGraph.ts, every railway of the map in it,
// src/roads/roadCover.ts) end to end and back, each carriage following the line through its curves, instead of the
// simulation's train drawn as a coloured box that turned a right angle in the middle of a tile. It only reads the map.

import { Group, type Object3D } from 'three';
import { registry } from '../models/registry.js';
import type { RoadGraph } from '../../roads/roadGraph.js';
import type { CityHeightField } from './heightfield.js';
import { longestWay, pointAlong, type Way } from './graphPaths.js';

/** Carriages behind the locomotive, their length (metres) and how fast the train goes (metres a second) */
const CARRIAGES = 4;
const CAR_M = 20;
const SPEED_M = 16;
/** Seconds it waits at each end of its line */
const HALT = 8;

export interface TrainMap { readonly railGraph?: RoadGraph | null; readonly tileSizeM?: number | null }

export class RailTrains {
  readonly root = new Group();
  private cars: Object3D[] = [];
  private way: Way | null = null;
  private wayVersion = -2;

  constructor(private readonly map: TrainMap, private readonly terrain: CityHeightField, private readonly size: number) {
    this.root.name = 'railTrains';
  }

  /** Whether there is a railway long enough for a train */
  get active(): boolean {
    this.plan();
    return this.way !== null;
  }

  update(seconds: number): void {
    this.plan();
    const way = this.way;
    this.root.visible = way !== null;
    if (!way) return;
    if (!this.cars.length) {
      for (let i = 0; i <= CARRIAGES; i++) {
        const model = registry[i === 0 ? 'veh.train_loco' : 'veh.train_car']?.factory({ seed: i }) ?? new Group();
        model.scale.setScalar(this.size);
        model.traverse((node) => { const m = node as { isMesh?: boolean; castShadow?: boolean }; if (m.isMesh) m.castShadow = false; });
        this.cars.push(model);
        this.root.add(model);
      }
    }
    const units = 10 / (this.map.tileSizeM ?? 16), speed = SPEED_M * units, gap = CAR_M * units;
    const train = gap * (CARRIAGES + 1), run = Math.max(0, way.length - train);
    // There and back, waiting at each end: the locomotive leads either way
    const lap = run * 2 / speed + HALT * 2, time = seconds % lap;
    const out = time < run / speed + HALT;
    const head = out ? train + Math.min(run, Math.max(0, (time - HALT) * speed))
      : way.length - train - Math.min(run, Math.max(0, (time - run / speed - HALT * 2) * speed));
    this.cars.forEach((car, i) => {
      const at = pointAlong(way, out ? head - (i + 0.5) * gap : head + (i + 0.5) * gap);
      const turn = Math.atan2(out ? at.dx : -at.dx, out ? at.dz : -at.dz);
      car.position.set(at.x, this.terrain.sample(at.x, at.z), at.z);
      car.rotation.y = turn;
    });
  }

  private plan(): void {
    const graph = this.map.railGraph, version = graph ? graph.version : -1;
    if (version === this.wayVersion) return;
    this.wayVersion = version;
    const units = 10 / (this.map.tileSizeM ?? 16);
    const way = graph?.segments.size ? longestWay(graph, units) : null;
    this.way = way && way.length > CAR_M * units * (CARRIAGES + 3) ? way : null;
  }

  dispose(): void { this.root.clear(); this.cars = []; }
}
