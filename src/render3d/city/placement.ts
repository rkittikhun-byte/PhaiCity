/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Everything the city view stands on the map is a Placement (owner, 14 Oct 2026: "ทุก object จะสืบทอดมาจาก class
// หลัก"): one class says where a thing stands, which way it is turned and how big it is drawn, and its model up close,
// its box from afar and the province's far boxes all take that from it, so they always agree. Each way of standing is
// a class below it: a building of the ruler's stood against its road is a RoadsidePlacement, the same thing drawn
// smaller than its tiles and turned to face the road, and everything drawn of it follows.

import { Matrix4, Vector3 } from 'three';
import type { ModelOptions } from '../models/registry.js';

/** What a placement is made of */
export interface PlacementFields {
  index: number; x: number; z: number; id: string | null; options: ModelOptions; rotation: number;
  footprint: readonly [number, number]; height: number; color: number; kind: string; water: boolean;
  scale: number; powered: boolean;
  baseY?: number; outside?: boolean;
}

const size = new Vector3();

/** One thing on the map as the city view draws it: x and z its middle in world units, rotation its turn about the
 * vertical, scale how big its model is drawn, footprint its tiles, height how tall it is at scale 1 */
export class Placement implements PlacementFields {
  declare index: number; declare x: number; declare z: number; declare id: string | null; declare options: ModelOptions;
  declare rotation: number; declare footprint: readonly [number, number]; declare height: number; declare color: number;
  declare kind: string; declare water: boolean; declare scale: number; declare powered: boolean;
  /** The ground under it on a map with hills, and whether it lies outside the province (province-surface.ts) */
  declare baseY?: number; declare outside?: boolean;
  constructor(fields: PlacementFields) { Object.assign(this, fields); }
  /** What a tool in hand would put down: a building of size × size tiles centred at (x, z), before it is built, so its
   * outline stands where and as the building will (overlay.ts) */
  static ofTool(size: number, x: number, z: number): Placement {
    return new Placement({ index: -1, x, z, id: null, options: {} as ModelOptions, rotation: 0, footprint: [size, size], height: 0,
      color: 0, kind: 'tool', water: false, scale: 1, powered: false });
  }
  /** Whether it stands against a road, smaller than its tiles and turned (RoadsidePlacement) */
  get posed(): boolean { return false; }
  /** The ground it stands on as drawn: its middle, its turn and its sides (world units) */
  ground(): { x: number; z: number; rotation: number; width: number; depth: number } {
    return { x: this.x, z: this.z, rotation: 0, width: this.footprint[0] * 10, depth: this.footprint[1] * 10 };
  }
  /** Its model's matrix: on its ground, turned and scaled */
  modelMatrix(target: Matrix4): Matrix4 {
    return target.makeRotationY(this.rotation).scale(size.setScalar(this.scale)).setPosition(this.x, this.baseY ?? 0, this.z);
  }
  /** Its box from afar: its tiles less an inset (world units), `height` tall, standing on y. A plain placement's box
   * fills its tiles unturned, as tiles do */
  farBox(target: Matrix4, height: number, inset: number, y = this.baseY ?? 0): Matrix4 {
    return target.makeScale(this.footprint[0] * 10 - inset, height, this.footprint[1] * 10 - inset).setPosition(this.x, y + height / 2, this.z);
  }
  /** The same thing stood against a road: its middle at (x, z), turned to face the road, drawn `scale` of its size */
  againstRoad(x: number, z: number, rotation: number, scale: number): RoadsidePlacement {
    return new RoadsidePlacement({ ...this, x, z, rotation, scale: this.scale * scale,
      options: { ...this.options, worldOrigin: [x, z], worldRotationY: rotation } });
  }
}

/** A building of the ruler's stood against its road, as Cities: Skylines sets one: smaller than its tiles and turned
 * to face the road (tileModels.ts againstRoad). Its box from afar is as small and as turned as its model. */
export class RoadsidePlacement extends Placement {
  override get posed(): boolean { return true; }
  override ground(): { x: number; z: number; rotation: number; width: number; depth: number } {
    return { x: this.x, z: this.z, rotation: this.rotation, width: this.footprint[0] * 10 * this.scale, depth: this.footprint[1] * 10 * this.scale };
  }
  override farBox(target: Matrix4, height: number, inset: number, y = this.baseY ?? 0): Matrix4 {
    const s = this.scale;
    return target.makeRotationY(this.rotation)
      .scale(size.set((this.footprint[0] * 10 - inset) * s, height * s, (this.footprint[1] * 10 - inset) * s))
      .setPosition(this.x, y + height * s / 2, this.z);
  }
}
