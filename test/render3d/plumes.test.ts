/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The smoke of chimneys (docs/3d/RENDERER_SPEC.md 8D): the baked beads are taken out of a model and found again as
// sources, the plume leans with the wind, its density follows the building's state, and the number of plumes drawn holds.

import { BoxGeometry, Matrix4, SphereGeometry, Vector3 } from 'three';
import { splitSmoke, emittersOf, isSmokeColour, outputOf, sootOf, smokes, STEAM_RADIUS, type Emitter } from '../../src/render3d/city/smokeSources';
import { CityPlumes, MAX_NEAR, PLUME_BUDGET, PUFFS, RINGS, planPlumes, plumeAlpha, plumeHeight, plumeLean } from '../../src/render3d/city/plumes';
import { SCENE } from '../../src/theme/tokens';

const SMOKE = [0.776, 0.745, 0.701], WALL = [0.55, 0.3, 0.2];

/** A model of arrays: a wall box and a chain of smoke spheres up and away from (x, y, z) */
function model(chain: { x: number; y: number; z: number; r: number }[], extra: { x: number; y: number; z: number; r: number; colour: number[] }[] = []) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const add = (g: SphereGeometry | BoxGeometry, x: number, y: number, z: number, colour: number[]) => {
    const base = pos.length / 3, p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i) + x, p.getY(i) + y, p.getZ(i) + z); col.push(...colour); }
    for (const i of g.index!.array) idx.push(base + i);
  };
  add(new BoxGeometry(4, 6, 4), 0, 3, 0, WALL);
  for (const s of chain) add(new SphereGeometry(s.r, 10, 6), s.x, s.y, s.z, SMOKE);
  for (const s of extra) add(new SphereGeometry(s.r, 8, 5), s.x, s.y, s.z, s.colour);
  return { position: Float32Array.from(pos), color: Float32Array.from(col), index: Uint32Array.from(idx) };
}

describe('the baked smoke in a model', () => {
  const chain = [{ x: 6, y: 18, z: -6, r: 0.6 }, { x: 7.1, y: 19, z: -5.7, r: 0.9 }, { x: 8.6, y: 20.2, z: -5.2, r: 1.3 }];

  it('is taken out and found again as one source at the chimney', () => {
    const m = model(chain);
    const split = splitSmoke(m.position, m.color, m.index);
    expect(split.sources).toHaveLength(1);
    const s = split.sources[0];
    expect(s.x).toBeCloseTo(6, 1); expect(s.z).toBeCloseTo(-6, 1);
    expect(s.y).toBeLessThan(18); expect(s.y).toBeGreaterThan(17);
    expect(s.r).toBeGreaterThan(0.5); expect(s.r).toBeLessThan(0.7);
    // only the wall is left, packed
    expect(split.position.length / 3).toBeLessThan(m.position.length / 3);
    for (let v = 0; v < split.color.length / 3; v++) expect(isSmokeColour(split.color, v)).toBe(false);
    expect(Math.max(...Array.from(split.index!))).toBeLessThan(split.position.length / 3);
  });

  it('leaves a small pale part of the building alone', () => {
    const m = model(chain, [{ x: 1, y: 3, z: 1, r: 0.15, colour: SMOKE }]);
    const split = splitSmoke(m.position, m.color, m.index);
    expect(split.sources).toHaveLength(1);
    const left = Array.from({ length: split.color.length / 3 }, (_, v) => isSmokeColour(split.color, v)).filter(Boolean).length;
    expect(left).toBeGreaterThan(0);
  });

  it('is not mistaken for other whites', () => {
    const m = model([], [{ x: 0, y: 8, z: 0, r: 1, colour: [0.846, 0.823, 0.76] }]);
    expect(splitSmoke(m.position, m.color, m.index).sources).toHaveLength(0);
  });

  it('keeps two chimneys apart', () => {
    const m = model([...chain, { x: -20, y: 10, z: 0, r: 0.8 }, { x: -19, y: 11, z: 0.3, r: 1.1 }]);
    expect(splitSmoke(m.position, m.color, m.index).sources).toHaveLength(2);
  });
});

describe('a plume in the world', () => {
  it('leans downwind with the wind and not at all in still air', () => {
    const east = plumeLean(0.8, 14, { x: 1, y: 0, strength: 0.6 }), south = plumeLean(0.8, 14, { x: 0, y: 1, strength: 0.6 });
    expect(east.x).toBeGreaterThan(5); expect(Math.abs(east.z)).toBeLessThan(1e-9);
    expect(south.z).toBeGreaterThan(5); expect(Math.abs(south.x)).toBeLessThan(1e-9);
    expect(plumeLean(0.8, 14, { x: 1, y: 0, strength: 0 }).x).toBe(0);
    expect(plumeLean(0.8, 14, { x: 1, y: 0, strength: 0.9 }).x).toBeGreaterThan(east.x);
    // ... more the higher it is, and the opposite way for the opposite wind
    expect(plumeLean(0.3, 14, { x: 1, y: 0, strength: 0.6 }).x).toBeLessThan(east.x);
    expect(plumeLean(0.8, 14, { x: -1, y: 0, strength: 0.6 }).x).toBeLessThan(0);
  });

  it('gives the wind to the shader as the wind’s way times its strength', () => {
    const plumes = new CityPlumes(), eye = new Vector3(0, 40, 0);
    plumes.update({ smokers: () => undefined }, eye, 1, { wind: { x: 0, y: 1, strength: 0.5 }, rain: 0, fog: 0, night: 0, twilight: 0 });
    const wind = (plumes.mesh.material as unknown as { uniforms: { uWind: { value: { x: number; y: number } } } }).uniforms.uWind.value;
    expect(wind.x).toBeCloseTo(0); expect(wind.y).toBeCloseTo(0.5);
  });

  it('rises less and thins in rain and fog', () => {
    const clear = { rain: 0, fog: 0 }, wet = { rain: 1, fog: 0.5 };
    expect(plumeHeight(1, wet)).toBeLessThan(plumeHeight(1, clear));
    expect(plumeAlpha(0.4, 1, wet)).toBeLessThan(plumeAlpha(0.4, 1, clear));
  });

  it('is thicker and darker from heavy industry than from a bakery', () => {
    expect(outputOf(1.9)).toBeGreaterThan(outputOf(0.4));
    expect(sootOf(outputOf(1.9), 1.9)).toBeGreaterThan(sootOf(outputOf(0.4), 0.4));
    expect(plumeHeight(outputOf(1.9), { rain: 0, fog: 0 })).toBeGreaterThan(plumeHeight(outputOf(0.4), { rain: 0, fog: 0 }));
    expect(plumeAlpha(0.3, outputOf(1.9), { rain: 0, fog: 0 })).toBeGreaterThan(plumeAlpha(0.3, outputOf(0.4), { rain: 0, fog: 0 }));
    // a cooling tower's wide steam is white
    expect(sootOf(1.6, STEAM_RADIUS + 0.5)).toBe(0);
  });

  it('has a colour for every hour in the theme, never written here', () => {
    for (const hex of Object.values(SCENE.plume)) expect(typeof hex).toBe('number');
  });
});

describe('which chimneys smoke', () => {
  const sources = [{ x: 1, y: 10, z: 2, r: 0.8 }, { x: -3, y: 12, z: 0, r: 0.4 }];
  const placement = (fields: { powered: boolean; weather?: number }) => ({
    index: 7, scale: 0.625, ...fields, modelMatrix: (m: Matrix4) => m.makeScale(0.625, 0.625, 0.625).setPosition(100, 3, 200),
  });
  const emit = (p: ReturnType<typeof placement>): Emitter[] => { const out: Emitter[] = []; emittersOf(p, sources, out, new Matrix4(), new Vector3()); return out; };

  it('gives each chimney of a powered building a plume at its place in the world', () => {
    const out = emit(placement({ powered: true }));
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(100.625); expect(out[0].y).toBeCloseTo(9.25); expect(out[0].z).toBeCloseTo(201.25);
    expect(out[0].output).toBeGreaterThan(out[1].output);
  });

  it('gives none when the building has no power, stands empty and weathered, or is not there', () => {
    expect(emit(placement({ powered: false }))).toHaveLength(0);
    expect(emit(placement({ powered: true, weather: 0.5 }))).toHaveLength(0);
    expect(emit(placement({ powered: true, weather: 1 }))).toHaveLength(0);
    expect(smokes({ powered: true, weather: 0.2 })).toBe(true);
  });
});

describe('how many plumes are drawn', () => {
  const emitters = (n: number, spread = 3): Emitter[] => Array.from({ length: n }, (_, i) => ({
    key: `c${i}`, x: (i % 20) * spread, y: 10, z: Math.floor(i / 20) * spread, scale: 0.625, output: 1, soot: 0.5 }));
  const eye = new Vector3(0, 60, 0);

  it('never draws more puffs than the budget, however many chimneys there are', () => {
    for (const n of [5, 100, 400, 2000]) {
      const plans = planPlumes(emitters(n), eye);
      expect(plans.reduce((s, p) => s + p.puffs, 0)).toBeLessThanOrEqual(PLUME_BUDGET);
    }
  });

  it('gives full plumes to at most MAX_NEAR of those near the camera, the rest fewer puffs', () => {
    const plans = planPlumes(emitters(100), eye);
    expect(plans.filter(p => p.ring === 'near').length).toBeLessThanOrEqual(MAX_NEAR);
    expect(plans.filter(p => p.ring === 'near').every(p => p.puffs === PUFFS.near)).toBe(true);
    expect(plans.some(p => p.ring === 'mid')).toBe(true);
  });

  it('draws the nearest first and nothing past the far ring', () => {
    const list: Emitter[] = [{ key: 'far', x: RINGS.far + 50, y: 0, z: 0, scale: 1, output: 1, soot: 0 }, { key: 'near', x: 20, y: 0, z: 0, scale: 1, output: 1, soot: 0 },
      { key: 'mid', x: 300, y: 0, z: 0, scale: 1, output: 1, soot: 0 }];
    const plans = planPlumes(list, new Vector3(0, 0, 0));
    expect(plans.map(p => p.emitter.key)).toEqual(['near', 'mid']);
    expect(plans.map(p => p.ring)).toEqual(['near', 'mid']);
  });

  it('writes no more instances than the draw has room for, through the view’s own call', () => {
    const plumes = new CityPlumes(300);
    const placements = emitters(150).map((e, i) => ({ index: i, scale: 1, powered: true, modelMatrix: (m: Matrix4) => m.makeTranslation(e.x, 0, e.z) }));
    plumes.update({ smokers: visit => placements.forEach(p => visit(p, [{ x: 0, y: 10, z: 0, r: 1 }])) }, eye, 5, { wind: { x: 1, y: 0, strength: 0.4 }, rain: 0, fog: 0, night: 0, twilight: 0 });
    expect(plumes.puffs).toBeLessThanOrEqual(300);
    expect(plumes.plumes).toBeGreaterThan(0);
    expect(plumes.mesh.visible).toBe(true);
    // ... and a building that loses its power fades out, then is gone
    const none = { smokers: () => undefined };
    for (let t = 6; t < 20; t += 0.5) plumes.update(none, eye, t, { wind: { x: 1, y: 0, strength: 0.4 }, rain: 0, fog: 0, night: 0, twilight: 0 });
    expect(plumes.puffs).toBe(0);
    expect(plumes.mesh.visible).toBe(false);
  });
});
