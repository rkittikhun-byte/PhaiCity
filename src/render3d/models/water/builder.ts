/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Shared parts of the water supply's buildings (ระบบประปา, docs/WATER_PLAN.md, RENDERER_SPEC 6C): open and covered
// concrete tanks, blue water mains on supports, steel ladders and railings, valves, plain utility buildings and a fence.
// Tier R3: the same everywhere; only the plaster tint and the trees follow the region kit. Every part shares eight
// batches at most: concrete, plaster (painted steel too, by vertex colour), sheet roofing, water, lawn, leaves, bark
// and one sign atlas. A generic Thai sign only: no real utility's name or emblem.

import { CircleGeometry, LatheGeometry, Material, Object3D, Vector2, Vector3 } from 'three';
import { vertexFinish } from '../../materials/library.js';
import { point } from '../../regional/geometry.js';
import { applyWorldUV } from '../../util/geometry.js';
import { CivicBuilder, STONE, shade, spread } from '../civic/builder.js';
import type { ModelOptions } from '../registry.js';

/** Painted water mains (ท่อประปา), handrails, ladders */
export const PIPE = 0x2f6fa8;
export const RAIL = 0xe0b43a;
export const LADDER = 0x8d9593;
export const GLASS = 0x33454d;
export const CONCRETE = 0xb9b6ad;

export class WaterBuilder extends CivicBuilder {
  /** Corrugated zinc roofing (สังกะสี), tinted per roof by vertex colour */
  readonly sheet = vertexFinish('roof_metal_corrugated');
  /** Plaster walls: the region's neutral plaster */
  readonly wall: number;

  constructor(options: ModelOptions) {
    super(options);
    this.wall = this.kit.neutralPalette(this.seed).wall;
  }

  /** A flat panel facing local +Z: windows, doors, painted bands. */
  quad(w: number, h: number, x: number, y: number, z: number, color: number, material: Material = this.paint): void {
    this.colored(color, () => this.face([point(x - w / 2, y - h / 2, z), point(x + w / 2, y - h / 2, z),
      point(x + w / 2, y + h / 2, z), point(x - w / 2, y + h / 2, z)], material));
  }

  /** A thin slab through a flat outline (an outside stair's flight), wound so its top faces up. */
  slab(vertices: readonly Vector3[], thickness: number, material: Material = this.stone): void {
    const normal = new Vector3().subVectors(vertices[1], vertices[0]).cross(new Vector3().subVectors(vertices[2], vertices[0])).normalize();
    const up = normal.y >= 0;
    this.panel(up ? vertices : [...vertices].reverse(), up ? normal : normal.negate(), thickness, material);
  }

  /** A flat panel lying at height y, facing up: water surfaces, painted floors. */
  flat(w: number, d: number, x: number, z: number, y: number, material: Material, color?: number): void {
    const make = (): void => this.face([point(x - w / 2, y, z + d / 2), point(x + w / 2, y, z + d / 2),
      point(x + w / 2, y, z - d / 2), point(x - w / 2, y, z - d / 2)], material);
    if (color === undefined) make(); else this.colored(color, make);
  }

  /** A turned concrete shell from a profile of [radius, height] pairs (inside to outside and back for open tanks). */
  shell(profile: readonly (readonly [number, number])[], x: number, y: number, z: number, sides = 24, color = CONCRETE): void {
    const source = new LatheGeometry(profile.map(([r, h]) => new Vector2(r, h)), sides).translate(x, y, z);
    this.colored(color, () => this.add(applyWorldUV(source, 1), this.stone)); source.dispose();
  }

  /** An open round tank (ถังตกตะกอน, a clarifier) of radius r and wall height h; its water stands 0.3 m below the rim. */
  openTank(r: number, h: number, x: number, z: number): void {
    this.shell([[r, 0], [r + 0.05, h], [r - 0.3, h], [r - 0.3, h - 0.3]], x, 0, z, 28);
    const water = new CircleGeometry(r - 0.3, 28).rotateX(-Math.PI / 2).translate(x, h - 0.3, z);
    this.add(applyWorldUV(water, 1), this.water()); water.dispose();
  }

  /** A water main: straight runs of blue pipe through the given points, with a flange at every joint. */
  pipe(points: readonly Vector3[], radius = 0.2, color = PIPE): void {
    this.colored(color, () => {
      for (let i = 1; i < points.length; i++) this.pole(points[i - 1], points[i], radius, this.paint, 8);
      for (const p of points.slice(1, -1)) this.ellipsoid(p, point(radius * 1.25, radius * 1.25, radius * 1.25), this.paint, 8, 4);
    });
  }

  /** A low concrete saddle under a pipe at height y. */
  saddle(x: number, z: number, y: number, yaw = 0): void {
    this.at(x, z, yaw, () => this.bx(this.stone, CONCRETE, 0.5, y, 0.4, 0, y / 2, 0));
  }

  /** A handwheel valve (ประตูน้ำ) on a pipe, its wheel facing local +Z. */
  valve(x: number, y: number, z: number, yaw = 0, radius = 0.2): void {
    this.at(x, z, yaw, () => {
      this.bx(this.paint, PIPE, radius * 2.6, radius * 2.6, radius * 1.6, 0, y, 0);
      this.colored(0x4a4f4e, () => this.pole(point(0, y, radius * 0.8), point(0, y, radius * 0.8 + 0.45), 0.03, this.paint, 4));
      this.colored(0xc23b2f, () => this.cylinder(0.26, 0.05, 0, y, radius * 0.8 + 0.45, this.paint, 10, Math.PI / 2));
    });
  }

  /** A guard rail (ราวกันตก) along local X at height y: posts and two rails in safety yellow. */
  guardRail(length: number, x: number, y: number, z: number, yaw = 0): void {
    this.at(x, z, yaw, () => this.colored(RAIL, () => {
      for (const ry of [0.5, 1]) this.box(length, 0.05, 0.05, 0, y + ry, 0, this.paint);
      for (const px of spread(length, 1.8, 0.03)) this.box(0.05, 1, 0.05, px, y + 0.5, 0, this.paint);
    }));
  }

  /** A steel ladder standing on local −Z of a wall at z, from y0 to y1, its rungs every 0.3 m. */
  ladder(x: number, z: number, y0: number, y1: number, yaw = 0, cage = false): void {
    this.at(x, z, yaw, () => this.colored(LADDER, () => {
      for (const s of [-1, 1]) this.box(0.05, y1 - y0, 0.05, s * 0.22, (y0 + y1) / 2, 0.18, this.paint);
      for (let y = y0 + 0.3; y < y1; y += 0.3) this.box(0.44, 0.03, 0.03, 0, y, 0.18, this.paint);
      if (cage) {
        for (let y = y0 + 2.4; y < y1; y += 1.2) this.box(0.76, 0.04, 0.04, 0, y, 0.85, this.paint);
        for (const s of [-1, 0, 1]) this.box(0.04, y1 - y0 - 2.2, 0.04, s * 0.36, (y0 + 2.2 + y1) / 2, s ? 0.55 : 0.88, this.paint);
      }
    }));
  }

  /** A plain plastered utility building w × d × h, front +Z: a plinth, a band, windows round it, a door, and its sign. */
  utilityBuilding(w: number, d: number, h: number, door: number, sign: string, flatRoof = false): void {
    this.bx(this.stone, STONE, w + 0.3, 0.3, d + 0.3, 0, 0.15, 0);
    this.bx(this.paint, this.wall, w, h, d, 0, 0.3 + h / 2, 0);
    this.bx(this.paint, shade(this.wall, -0.12), w + 0.06, 0.6, d + 0.06, 0, 0.6, 0);
    this.quad(door, 2.4, door / 2 - w / 2 + 0.8, 1.5, d / 2 + 0.02, 0x4f5f63);
    const windows = (span: number, z: number, yaw: number, skip = 0): void => this.at(0, z, yaw, () => {
      for (const x of spread(span - 1.2, 2.2, 0)) if (Math.abs(x - skip) > door / 2 + 0.6 || !skip) {
        this.quad(1.4, 1.1, x, 0.3 + h * 0.62, 0.02, GLASS);
        this.bx(this.paint, 0xeeede6, 1.5, 0.06, 0.12, x, 0.3 + h * 0.62 - 0.58, 0.06);
      }
    });
    windows(w, d / 2, 0, door / 2 - w / 2 + 0.8);
    windows(w, -d / 2, Math.PI);
    for (const s of [-1, 1]) this.at(s * w / 2, 0, s * Math.PI / 2, () => windows(d, 0, 0));
    if (flatRoof) {
      this.bx(this.stone, CONCRETE, w + 0.4, 0.25, d + 0.4, 0, 0.3 + h + 0.125, 0);
      this.bx(this.paint, this.wall, w + 0.4, 0.5, 0.12, 0, 0.3 + h + 0.5, d / 2 + 0.14);
    } else this.sheetGable(w + 0.8, d + 0.8, 0.3 + h, Math.min(1.4, d * 0.2), 0x8c4a3a);
    this.label(sign, Math.min(w * 0.6, 3.4), 0.42, door / 2 - w / 2 + 0.8 + door / 2 + 1.9, 0.3 + h - 0.45, d / 2 + 0.03, 0, 0x2f6fa8, 0xffffff);
  }

  /** A low sheet gable over w × d with its ridge along X, eaves at y, gable ends closed in plaster. */
  sheetGable(w: number, d: number, y: number, rise: number, color: number): void {
    this.colored(color, () => {
      this.panel([point(-w / 2, y, d / 2), point(w / 2, y, d / 2), point(w / 2, y + rise, 0), point(-w / 2, y + rise, 0)],
        point(0, d / 2, rise).normalize(), 0.06, this.sheet);
      this.panel([point(w / 2, y, -d / 2), point(-w / 2, y, -d / 2), point(-w / 2, y + rise, 0), point(w / 2, y + rise, 0)],
        point(0, d / 2, -rise).normalize(), 0.06, this.sheet);
      this.box(w, 0.12, 0.34, 0, y + rise + 0.02, 0, this.sheet);
    });
    // The gable ends, closed in plaster just under the sheets (counterclockwise seen from outside)
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.4), top = point(x, y + rise * (1 - 0.8 / d), 0);
      const ends = [point(x, y, s * (d / 2 - 0.4)), point(x, y, -s * (d / 2 - 0.4)), top];
      this.colored(this.wall, () => this.panel(ends, point(s, 0, 0), 0.08, this.paint));
    }
  }

  /** A garden tree of the region. */
  shadeTree(i: number, x: number, z: number, height: number, radius: number): void {
    this.plant(this.species(i), x, z, height, radius, i + 11);
  }

  /** Lantern glows and fountain-free anchors, the userData of a water building. */
  finishWater(id: string, footprint: readonly [number, number], tiles: readonly number[], metadata: Record<string, unknown>) {
    this.flushSigns();
    const root = this.finish(id, 'services', footprint, tiles, this.options);
    this.lights.forEach((at, i) => {
      const anchor = new Object3D();
      anchor.name = `anchor_light_${i}`; anchor.position.copy(at); root.add(anchor);
    });
    Object.assign(root.userData, { regionTier: 'R3', kit: this.kit.id, entranceFacing: '+Z', components: this.components,
      wallColor: this.wall, ...metadata });
    return root;
  }
}
