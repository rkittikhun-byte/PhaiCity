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
  baseY?: number; outside?: boolean; fill?: number;
  /** How weathered it is drawn, 0-1: an empty building faded and stained as it decays (src/plotBuildings.ts decayOf) */
  wear?: number;
  /** The share of its model's size it is drawn at on a real-scale city map, where its id's (tileModels.ts
   * CITY_MODEL_SCALE) does not fit: a power plant on a 3 × 3 or a 2 × 2 (tileModels.ts PLANT_SHARE) */
  share?: number;
  /** Drawn by the program's model whatever its era: a 2 × 2 power plant, which no era model fits (src/plantBlocks.ts) */
  procedural?: boolean;
  /** What its building is among the era models when the model id alone does not say (eraBuildings.ts eraKindFor):
   * a painted plot's or lot's kind and level (home_3, shop_5 ...) or a station's kind (station.metro_station) */
  eraKind?: string;
}

const size = new Vector3();

/** One thing on the map as the city view draws it: x and z its middle in world units, rotation its turn about the
 * vertical, scale how big its model is drawn, footprint its tiles, height how tall it is at scale 1 */
export class Placement implements PlacementFields {
  declare index: number; declare x: number; declare z: number; declare id: string | null; declare options: ModelOptions;
  declare rotation: number; declare footprint: readonly [number, number]; declare height: number; declare color: number;
  declare kind: string; declare water: boolean; declare scale: number; declare powered: boolean;
  /** The ground under it on a map with hills, and whether it lies outside the province (province-surface.ts) */
  declare baseY?: number; declare outside?: boolean; declare wear?: number;
  /** How much of its tiles it covers as drawn, across and up: 1 fills them; less when it is drawn at its real size on
   * a real-scale city map (10/16 of a 16 m tile, TileSnapshot.atRealSize) or smaller against its road */
  declare fill?: number;
  declare eraKind?: string;
  declare share?: number;
  declare procedural?: boolean;
  /** How far ahead of its middle its front stands as drawn (world units), for a building stood against its road
   * (tileModels.ts toRoadEdge): its lot and driveway reach to there (roadCurves.ts) */
  declare front?: number;
  /** How far it reaches either side of its middle, and behind it, as drawn (world units): its front's by default, the
   * ruler's house with its wings round it (tileModels.ts houseCompound) farther */
  declare side?: number;
  declare back?: number;
  /** How wide its model is drawn across the way it runs (its own x), as a share: a bridge on a real-scale city map is
   *  as narrow as the road or railway drawn up to it (TileSnapshot.narrowBridge); 1 or none, as built */
  declare across?: number;
  /** The other buildings drawn with it for its tile: a painted plot's terrace of shophouse bays (frontage.ts,
   * FrontagePlacement), each a placement of its own with the tile's index */
  declare parts?: Placement[];
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
    const f = this.fill ?? 1;
    return { x: this.x, z: this.z, rotation: 0, width: this.footprint[0] * 10 * f, depth: this.footprint[1] * 10 * f };
  }
  /** Its model's matrix: on its ground, turned and scaled */
  modelMatrix(target: Matrix4): Matrix4 {
    return target.makeRotationY(this.rotation).scale(size.set(this.scale * (this.across ?? 1), this.scale, this.scale))
      .setPosition(this.x, this.baseY ?? 0, this.z);
  }
  /** Its box from afar: its tiles less an inset (world units), `height` tall at full size, standing on y, both as
   * much as it fills. A plain placement's box is unturned, as tiles are */
  farBox(target: Matrix4, height: number, inset: number, y = this.baseY ?? 0): Matrix4 {
    const f = this.fill ?? 1;
    // A narrowed bridge's box is as narrow as it, across the way it runs
    if (this.across !== undefined && this.across < 1) {
      return target.makeRotationY(this.rotation)
        .scale(size.set((this.footprint[0] * 10 - inset) * f * this.across, height * f, (this.footprint[1] * 10 - inset) * f))
        .setPosition(this.x, y + height * f / 2, this.z);
    }
    return target.makeScale((this.footprint[0] * 10 - inset) * f, height * f, (this.footprint[1] * 10 - inset) * f)
      .setPosition(this.x, y + height * f / 2, this.z);
  }
  /** The same thing stood against a road: its middle at (x, z), turned to face the road, filling `fill` of its tiles */
  againstRoad(x: number, z: number, rotation: number, fill: number): RoadsidePlacement {
    return new RoadsidePlacement({ ...this, x, z, rotation, scale: this.scale * fill / (this.fill ?? 1), fill,
      options: { ...this.options, worldOrigin: [x, z], worldRotationY: rotation } });
  }
}

/** A building of the ruler's stood against its road, as Cities: Skylines sets one: smaller than its tiles and turned
 * to face the road (tileModels.ts againstRoad). Its box from afar is as small and as turned as its model. */
export class RoadsidePlacement extends Placement {
  override get posed(): boolean { return true; }
  override ground(): { x: number; z: number; rotation: number; width: number; depth: number } {
    return { ...super.ground(), rotation: this.rotation };
  }
  override farBox(target: Matrix4, height: number, inset: number, y = this.baseY ?? 0): Matrix4 {
    const f = this.fill ?? 1;
    return target.makeRotationY(this.rotation)
      .scale(size.set((this.footprint[0] * 10 - inset) * f, height * f, (this.footprint[1] * 10 - inset) * f))
      .setPosition(this.x, y + height * f / 2, this.z);
  }
}

/** The ground a plot's frontage buildings stand on together (frontage.ts): its middle, turn and sides in world units */
export interface FrontageGround { x: number; z: number; rotation: number; width: number; depth: number }

/** A painted plot drawn by its frontage (frontage.ts): the first of its buildings, standing against its road, with the
 * others as its parts; its ground and its box from afar are the whole run's, so the far view shows the terrace whole */
export class FrontagePlacement extends RoadsidePlacement {
  declare frontage: FrontageGround;
  constructor(fields: PlacementFields, frontage: FrontageGround, parts: Placement[]) {
    super(fields);
    this.frontage = frontage;
    this.parts = parts;
  }
  override ground(): { x: number; z: number; rotation: number; width: number; depth: number } { return { ...this.frontage }; }
  override farBox(target: Matrix4, height: number, inset: number, y = this.baseY ?? 0): Matrix4 {
    const f = this.fill ?? 1, g = this.frontage, edge = inset * 0.2;
    return target.makeRotationY(g.rotation)
      .scale(size.set(Math.max(0.5, g.width - edge), height * f, Math.max(0.5, g.depth - edge * 2)))
      .setPosition(g.x, y + height * f / 2, g.z);
  }
}
