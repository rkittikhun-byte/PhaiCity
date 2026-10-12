/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Material, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { getMaterial, paintedSteel, tint } from '../../materials/library.js';
import { thaiSign } from '../../materials/signs.js';
import { applyWorldUV, beveledBox } from '../../util/geometry.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { point, VehicleBuilder } from './builder.js';

/** Repeated windows, doors, wheels and equipment clone one owned prototype per shape. */
class ElectricTrainBuilder extends VehicleBuilder {
  private readonly templates = new Map<string, BufferGeometry>();
  template(key: string, create: () => BufferGeometry): BufferGeometry {
    let source = this.templates.get(key);
    if (!source) { source = create(); this.templates.set(key, source); }
    return source.clone();
  }
  private projected(source: BufferGeometry, material: Material): void {
    const geometry = applyWorldUV(source, 1); if (geometry !== source) source.dispose(); this.add(geometry, material);
  }
  override box(center: Vector3, size: Vector3, material: Material, yaw = 0, pitch = 0, roll = 0): void {
    const source = this.template(`box/${size.toArray()}`, () => new BoxGeometry(size.x, size.y, size.z));
    source.rotateZ(roll).rotateX(pitch).rotateY(yaw).translate(center.x, center.y, center.z);
    this.projected(source, material);
  }
  override cylinder(center: Vector3, radius: number, height: number, material: Material, sides = 8, axis: 'x' | 'y' | 'z' = 'y'): void {
    const source = this.template(`cylinder/${radius}/${height}/${sides}`, () => new CylinderGeometry(radius, radius, height, sides));
    if (axis === 'x') source.rotateZ(-Math.PI / 2); else if (axis === 'z') source.rotateX(Math.PI / 2);
    source.translate(center.x, center.y, center.z); this.projected(source, material);
  }
  override wheel(center: Vector3, radius: number, width: number, tire: Material, rim: Material, sides = 10): void {
    for (const [r, w, material] of [[radius, width, tire], [radius * 0.62, width + 0.015, rim]] as const) {
      const source = this.template(`cylinder/${r}/${w}/${sides}`, () => new CylinderGeometry(r, r, w, sides));
      source.rotateZ(Math.PI / 2).translate(center.x, center.y, center.z); this.projected(source, material);
    }
  }
  disposeTemplates(): void { this.templates.forEach(geometry => geometry.dispose()); this.templates.clear(); }
}

/** Eight-sided shells with a tapered cab; the roof crown and shoulder retain real volume. */
function shell(b: VehicleBuilder, sections: readonly { z: number; width: number; roof: number; bottom: number }[], material: Material): void {
  const rings = sections.map(s => [[-s.width * 0.42, s.bottom], [s.width * 0.42, s.bottom],
    [s.width / 2, s.bottom + 0.18], [s.width / 2, s.roof - 0.48], [s.width * 0.38, s.roof],
    [-s.width * 0.38, s.roof], [-s.width / 2, s.roof - 0.48], [-s.width / 2, s.bottom + 0.18]]
    .map(([x, y]) => [x, y, s.z]));
  const vertices: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 8; j++) {
    const k = (j + 1) % 8;
    vertices.push(...rings[i][j], ...rings[i][k], ...rings[i + 1][k],
      ...rings[i][j], ...rings[i + 1][k], ...rings[i + 1][j]);
  }
  for (const [i, reverse] of [[0, true], [rings.length - 1, false]] as const) {
    const r = rings[i];
    for (let j = 1; j < 7; j++) vertices.push(...r[0], ...r[reverse ? j + 1 : j], ...r[reverse ? j : j + 1]);
  }
  const g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals(); const uv = applyWorldUV(g, 1); if (uv !== g) g.dispose(); b.add(uv, material);
}

function bogie(b: VehicleBuilder, z: number, steel: Material, dark: Material): void {
  for (const dz of [-1, 1]) {
    b.cylinder(point(0, 0.43, z + dz), 0.07, 1.65, steel, 6, 'x');
    for (const side of [-1, 1]) b.wheel(point(side * 0.7575, 0.43, z + dz), 0.43, 0.14, dark, steel, 12);
  }
  for (const side of [-1, 1]) b.box(point(side * 0.94, 0.57, z), point(0.22, 0.32, 2.7), dark);
  b.box(point(0, 0.72, z), point(2.0, 0.18, 1.2), steel);
}

function pantograph(b: ElectricTrainBuilder, z: number, steel: Material): void {
  b.box(point(0, 3.86, z), point(1.3, 0.13, 1.8), steel);
  for (const x of [-0.48, 0.48]) for (const sign of [-1, 1]) {
    const start = point(x, 3.92, z), elbow = point(x, 4.55, z + sign * 0.72), end = point(x, 5.58, z);
    for (const [a, c] of [[start, elbow], [elbow, end]]) {
      const direction = c.clone().sub(a), length = direction.length();
      const source = b.template(`pantograph/${length}`, () => beveledBox(0.055, length, 0.055, 0.015));
      source.applyQuaternion(new Quaternion().setFromUnitVectors(point(0, 1, 0), direction.normalize()));
      source.translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2); b.add(source, steel);
    }
  }
  b.box(point(0, 5.58, z), point(1.65, 0.08, 0.20), steel);
}

function electricTrain(hsr: boolean, options: ModelOptions): Group {
  const b = new ElectricTrainBuilder(), rng = seededRng(options.seed ?? 1);
  const length = hsr ? 25 : 20, id = hsr ? 'veh.train_hsr' : 'veh.metro';
  const name = hsr ? 'ไผ่เอ็กซ์เพรส' : 'สายลมเมือง';
  const body = paintedSteel(hsr ? 0xf4f4e8 : 0xf2e4cb), stripe = paintedSteel(hsr ? 0x42764b : 0x287c74);
  const trim = paintedSteel(hsr ? [0x9ba96d, 0xadc17e][Math.floor(rng() * 2)] : [0xca925d, 0xc19d68][Math.floor(rng() * 2)]);
  const steel = getMaterial('metal_steel'), dark = tint('metal_steel', 0x303b3c);
  const glass = getMaterial('glass_tinted'), lights = getMaterial('emissive_window');
  const sign = thaiSign(name, hsr ? 0x42764b : 0x287c74, 0xf4f4e8, [3.2, 0.45]);
  const cars: { centerZ: number; length: number; cab: boolean }[] = [];
  for (let car = 0; car < 3; car++) {
    const z = (1 - car) * length, cab = car === 0, back = z - length / 2 + 0.25,
      front = z + length / 2 - (cab ? 0 : 0.25), shoulder = front - (hsr && cab ? 5.5 : cab ? 1.4 : 0);
    cars.push({ centerZ: z, length, cab });
    shell(b, [{ z: back, width: 2.9, roof: 3.8, bottom: 0.94 },
      { z: shoulder, width: 2.9, roof: 3.8, bottom: 0.94 },
      ...(cab ? hsr ? [{ z: front - 2.2, width: 2.35, roof: 2.9, bottom: 0.94 },
        { z: front, width: 0.9, roof: 1.85, bottom: 1.0 }] :
        [{ z: front, width: 2.55, roof: 3.5, bottom: 1.0 }] : [])], body);
    b.box(point(0, 0.92, z - (cab ? 1 : 0)), point(2.4, 0.18, length - (cab ? 3 : 0.8)), dark);
    for (const end of [-1, 1]) bogie(b, z + end * (length / 2 - 4.2), steel, dark);
    b.box(point(0, 0.69, z), point(1.7, 0.40, length * 0.38), dark);
    const flankEnd = shoulder - 0.6, flankStart = back + 0.55, flankLength = flankEnd - flankStart,
      flankCenter = (flankEnd + flankStart) / 2;
    for (const side of [-1, 1]) {
      b.box(point(side * 1.458, 1.6, flankCenter), point(0.035, 0.48, flankLength), stripe);
      b.box(point(side * 1.48, 1.88, flankCenter), point(0.035, 0.075, flankLength), trim);
      const doors = hsr ? [flankStart + 1.0, flankEnd - 1.0] :
        [flankStart + 1.2, flankCenter, flankEnd - 1.2];
      for (const doorZ of doors) {
        b.box(point(side * 1.475, 2.03, doorZ), point(0.035, 1.65, 1.4), stripe);
        for (const d of [-1, 1]) b.box(point(side * 1.5, 2.44, doorZ + d * 0.34), point(0.024, 0.65, 0.53), glass);
        b.box(point(side * 1.501, 1.73, doorZ), point(0.025, 0.9, 0.022), trim);
      }
      for (let windowZ = flankStart + 0.7; windowZ < flankEnd; windowZ += hsr ? 1.55 : 1.30) {
        if (doors.some(d => Math.abs(windowZ - d) < 1.2)) continue;
        b.box(point(side * 1.466, 2.65, windowZ), point(0.026, 0.78, hsr ? 1.15 : 1.0), glass);
      }
      const signage = new PlaneGeometry(3.2, 0.45).rotateY(side * Math.PI / 2).translate(side * 1.493, 1.57, flankCenter + (hsr ? 3 : 2));
      b.add(signage, sign);
    }
    // Roof equipment is lower than the raised pantograph, and shared by all cars.
    for (const dz of [-3.2, 3.2]) b.add(b.template('roof-equipment', () => beveledBox(1.7, 0.20, 2.4, 0.06)).translate(0, 3.89, z + dz), body);
    if (cab) {
      const windshieldZ = hsr ? front - 3.7 : front + 0.008;
      const windshield = new PlaneGeometry(hsr ? 1.8 : 2.25, hsr ? 1.5 : 0.82)
        .rotateX(hsr ? -Math.atan(3.3 / 0.9) : 0).translate(0, hsr ? 3.327 : 2.92, windshieldZ);
      b.add(windshield, glass);
      for (const side of [-1, 1]) b.box(point(side * (hsr ? 0.40 : 0.98), hsr ? 1.42 : 1.50, front + 0.015),
        point(hsr ? 0.19 : 0.26, 0.12, 0.03), lights);
      // Distinct tapered bamboo-green lower nose, without a real operator's emblem.
      shell(b, [{ z: shoulder, width: 2.94, roof: 1.89, bottom: 1.31 },
        { z: front - 0.03, width: hsr ? 0.92 : 2.57, roof: hsr ? 1.65 : 1.89, bottom: 1.31 }], stripe);
    }
    if (car < 2) b.box(point(0, 2.07, back - 0.25), point(1.8, 2.1, 0.5), dark);
  }
  if (hsr) pantograph(b, 0, steel);
  const root = b.finish(id, [1, hsr ? 8 : 6], options);
  b.disposeTemplates();
  root.userData.train = { cars, carLength: length, length: 3 * length, gauge: 1.435,
    wheelCenters: [-0.7575, 0.7575], livery: name, pantograph: hsr, railContactAboveDeck: 0.42 };
  return root;
}

export const createTrainHsr = (options: ModelOptions = {}): Group => electricTrain(true, options);
export const createMetro = (options: ModelOptions = {}): Group => electricTrain(false, options);
