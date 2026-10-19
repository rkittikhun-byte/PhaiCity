/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Matrix4, type Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakeClip, PARTS, PeopleDrawer, type PeopleEntry, type PeopleIndex, sheetsFor } from '../../src/render3d/city/people3d.js';
import { eraForRank, mapEra } from '../../src/era.js';

const DIR = resolve(__dirname, '../../assets/models/people');
const index = JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8')) as PeopleIndex;

async function load(file: string): Promise<{ scene: Object3D; animations: import('three').AnimationClip[] }> {
  const data = readFileSync(resolve(DIR, file));
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return new GLTFLoader().parseAsync(buffer, '');
}

function entry(id: string): PeopleEntry {
  const e = index.people.find(p => p.id === id);
  if (!e) throw new Error('no ' + id);
  return e;
}

describe('concept-sheet people (art/people)', () => {
  it('lists every character of the sheets, each walker with its file', () => {
    expect(index.people.length).toBeGreaterThanOrEqual(75);
    for (const sheet of ['shared', 'era1', 'era2', 'era3', 'era4', 'era5', 'north', 'isan', 'central', 'east', 'west', 'south']) {
      expect(index.people.some(p => p.sheet === sheet && p.walker)).toBe(true);
    }
    for (const p of index.people.filter(p => p.walker)) expect(existsSync(resolve(DIR, p.file!))).toBe(true);
  });

  it('gives every character the same jointed parts', async () => {
    for (const id of ['monk', 'schoolgirl', 'era3_builder', 'isan_khaen_player']) {
      const { scene } = await load(entry(id).file!);
      for (const part of PARTS) expect(scene.getObjectByName(part)).toBeTruthy();
    }
  });

  it('bakes the activity clips, all parts keyed', async () => {
    const { animations } = await load(index.clips);
    const names = animations.map(a => a.name);
    for (const name of ['idle', 'walk', 'walk_carry', 'run', 'bike', 'plant_rice', 'takraw', 'sit', 'wai']) {
      expect(names).toContain(name);
    }
    const walk = bakeClip(animations.find(a => a.name === 'walk')!);
    expect(walk.frames).toBe(25);
    expect(walk.quaternions).toHaveLength(25 * PARTS.length * 4);
    // The legs swing: the right thigh is turned differently at the start and at mid-step.
    const leg = PARTS.indexOf('leg_R');
    const at = (f: number) => Array.from(walk.quaternions.slice((f * PARTS.length + leg) * 4, (f * PARTS.length + leg) * 4 + 4));
    expect(at(0)).not.toEqual(at(12));
  });

  it('draws people in one batch, standing on the ground, and keeps the hands of those who carry things', async () => {
    const { animations } = await load(index.clips);
    const clips = Object.fromEntries(animations.map(a => [a.name, bakeClip(a)]));
    const people = await Promise.all(['schoolboy', 'monk'].map(async id => ({ entry: entry(id), scene: (await load(entry(id).file!)).scene })));
    const drawer = new PeopleDrawer(people, clips, 4);
    drawer.useSheets(['shared']);
    expect(drawer.characters.map(c => c.id).sort()).toEqual(['monk', 'schoolboy']);
    drawer.place(0, 10, 2, 5, 0, 1, 7, 'stand', 0);
    drawer.finish(1);
    const m = new Matrix4();
    const p = new Vector3();
    drawer.mesh.getMatrixAt(PARTS.indexOf('head'), m);
    p.setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(10, 0);
    expect(p.y).toBeGreaterThan(2 + 0.8);
    expect(p.y).toBeLessThan(2 + 1.4);
    // The monk holds his bowl: walking keeps his arms as they are in his own model.
    const monk = drawer.characters.find(c => c.id === 'monk')!;
    expect(monk.swingArms).toBe(false);
    drawer.dispose();
  });
});

describe('the city era', () => {
  it('follows the ruler rank and picks the people sheets with the region', () => {
    expect(eraForRank('muen')).toBe(1);
    expect(eraForRank('luang')).toBe(3);
    expect(eraForRank('chaophraya')).toBe(5);
    expect(mapEra({})).toBe(1);
    expect(mapEra({ era: 4 })).toBe(4);
    expect(sheetsFor(1, 'northeast')).toEqual(['shared', 'era1', 'isan']);
    expect(sheetsFor(5, 'south')).toEqual(['shared', 'era5', 'south']);
  });
});
