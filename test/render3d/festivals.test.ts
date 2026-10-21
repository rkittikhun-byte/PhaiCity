/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The festivals in the 3D view (src/render3d/city/festivals3d.ts): it reads what the map holds this month and dresses
// the town, strings of lanterns or flags between poles along the streets near the ruler's house and the built-up blocks,
// krathong on the water, sky lanterns at night and rockets, more of them for a grand festival, nothing for a village's
// own festival, and never writes the map.

import type { InstancedMesh } from 'three';
import { CityFestivals, FESTIVAL_TOUCHES, MAX_KRATHONG, MAX_POLES, MAX_SKY_LANTERNS, MODEST_SHARE,
  POLE_SPACING, VENUE_TILES, type FestivalLine, type FestivalViewMap } from '../../src/render3d/city/festivals3d';
import { FESTIVAL_IDS } from '../../src/festivals';
import { RIVER } from '../../src/tileValues';

/** Roads every 10 tiles both ways, from 0 to 36 tiles (world units: 10 a tile), and a railway at the bottom */
const ROWS = [105, 205, 305], LINES: FestivalLine[] = [
  ...ROWS.map((z): FestivalLine => ({ points: [[0, z], [360, z]], rail: false, level: 2 })),
  ...ROWS.map((x): FestivalLine => ({ points: [[x, 0], [x, 360]], rail: false, level: 2 })),
  { points: [[0, 395], [400, 395]], rail: true },
];
/** How far a point is from the nearest road's middle */
const offRoad = (x: number, z: number): number => Math.min(...ROWS.map((r) => Math.abs(z - r)), ...ROWS.map((c) => Math.abs(x - c)));

/** Tiles with homes on them: a row along the north side of the road at z 205 (tile row 20), x 8–13; and the ruler's
 * house, its 3 × 3 round (20, 18) */
const built = (x: number, y: number): boolean => y === 21 && x >= 8 && x <= 13 || Math.abs(x - 20) <= 1 && Math.abs(y - 18) <= 1;

/** A 40 × 40 map with a river down column 30 and roads every 10 tiles, the ruler's house at (20, 18) */
function town(held: { id: string; scale: string; quiet?: boolean }[]) {
  const width = 40, height = 40;
  const festivals = { held: held.map((h) => Object.freeze({ ...h })) };
  const map: FestivalViewMap & { festivals: { held: { id: string; scale: string; quiet?: boolean }[] } } = {
    width, height, festivals, rulerHouse: Object.freeze({ x: 20, y: 18 }), town: { x: 5, y: 5 },
    getTileValue: (x: number, y: number) => x === 30 ? RIVER : built(x, y) ? 250 : 0,
  };
  const ground = { sample: () => 2, water: new Float32Array(width * height).fill(NaN) };
  return { map, ground, lines: LINES };
}

describe('the festivals in the 3D view', () => {
  test('every festival dresses the town', () => {
    for (const id of FESTIVAL_IDS) expect([id, FESTIVAL_TOUCHES[id] !== undefined]).toEqual([id, true]);
  });

  test('nothing is drawn while no festival is held', () => {
    const { map, ground, lines } = town([]);
    const view = new CityFestivals(map, ground);
    view.update(lines, 1, 10);
    expect(view.root.visible).toBe(false);
    expect(Object.values(view.counts()).every((n) => n === 0)).toBe(true);
    view.dispose();
  });

  test("a village's own festival dresses nothing", () => {
    const { map, ground, lines } = town([{ id: 'songkran', scale: 'modest', quiet: true }]);
    const view = new CityFestivals(map, ground);
    for (let t = 0; t <= 5; t += 0.5) view.update(lines, 1, t);
    expect(view.root.visible).toBe(false);
    expect(Object.values(view.counts()).every((n) => n === 0)).toBe(true);
    view.dispose();
  });

  test('Loy Krathong strings lanterns between poles on the streets by the house and the homes, and floats krathong', () => {
    const { map, ground, lines } = town([{ id: 'loy_krathong', scale: 'modest' }]);
    const before = JSON.stringify(map);
    const view = new CityFestivals(map, ground);
    for (let t = 0; t <= 5; t += 0.05) view.update(lines, 1, t);
    const counts = view.counts();
    expect(counts.poles).toBeGreaterThan(4);
    expect(counts.poles).toBeLessThanOrEqual(Math.round(MAX_POLES * MODEST_SHARE));
    // Every pole holds a cord, each cord in two halves
    expect(counts.cords).toBeGreaterThanOrEqual(counts.poles);
    expect(counts.cords % 2).toBe(0);
    expect(counts.lanterns).toBeGreaterThan(counts.cords);
    expect(counts.flags).toBe(0);
    expect(counts.krathong).toBe(Math.round(MAX_KRATHONG * MODEST_SHARE));
    expect(counts.skyLanterns).toBe(0);
    const at = (name: string): [number, number, number][] => {
      const mesh = view.root.getObjectByName(name) as InstancedMesh, m = mesh.instanceMatrix.array, out: [number, number, number][] = [];
      for (let i = 0; i < mesh.count; i++) out.push([m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]]);
      return out;
    };
    // Every pole beside a road, none by the railway, and each by the house or by a home
    const poles = at('festival_poles');
    for (const [x, , z] of poles) {
      expect(offRoad(x, z)).toBeLessThan(5);
      expect(z).toBeLessThan(380);
      const tx = Math.floor(x / 10), ty = Math.floor(z / 10);
      let nearHome = false;
      for (let y = ty - 1; y <= ty + 1; y++) for (let x2 = tx - 1; x2 <= tx + 1; x2++) nearHome ||= built(x2, y);
      expect(Math.hypot(x - 205, z - 185) <= VENUE_TILES * 10 + 1 || nearHome).toBe(true);
    }
    // ... the homes' street dressed too, though far from the house; the open streets to the east not at all
    expect(poles.some(([x, , z]) => x < 140 && Math.abs(z - 205) < 5)).toBe(true);
    expect(poles.some(([x]) => x > 290)).toBe(false);
    // Every lantern hangs between two poles of a span, under the poles' tops
    for (const [x, y, z] of at('festival_lanterns')) {
      const near = poles.filter(([px, , pz]) => Math.hypot(px - x, pz - z) <= POLE_SPACING * 1.6 + 1);
      expect(near.length).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThan(2 + 5);
    }
    // ... and the krathong on the river's tiles
    const krathong = view.root.getObjectByName('festival_krathong') as InstancedMesh;
    const k = krathong.instanceMatrix.array;
    for (let i = 0; i < krathong.count; i++) expect(Math.floor(k[i * 16 + 12] / 10)).toBe(30);
    // The view read the map and wrote nothing to it
    expect(JSON.stringify(map)).toBe(before);
    view.dispose();
  });

  test('a grand festival has more; Yi Peng lets sky lanterns go only after dark; Bun Bang Fai sends up rockets', () => {
    const { map, ground, lines } = town([{ id: 'yi_peng', scale: 'grand' }, { id: 'bun_bang_fai', scale: 'grand' }]);
    const view = new CityFestivals(map, ground);
    view.update(lines, 0, 3);
    expect(view.counts().skyLanterns).toBe(0);
    view.update(lines, 1, 4);
    const counts = view.counts();
    expect(counts.poles).toBeLessThanOrEqual(MAX_POLES);
    // In a town built up all over, a grand festival dresses more of its streets than a modest one
    const dressed = (scale: string) => {
      const big = town([{ id: 'yi_peng', scale }]), all = new CityFestivals({ ...big.map, getTileValue: () => 250 }, ground);
      all.update(lines, 1, 4);
      const n = all.counts();
      all.dispose();
      return n;
    };
    const grand = dressed('grand'), modest = dressed('modest');
    expect(grand.poles).toBeGreaterThan(modest.poles);
    expect(grand.poles).toBeLessThanOrEqual(MAX_POLES);
    expect(modest.poles).toBeLessThanOrEqual(Math.round(MAX_POLES * MODEST_SHARE));
    expect(grand.lanterns).toBeGreaterThan(modest.lanterns);
    expect(counts.skyLanterns).toBe(MAX_SKY_LANTERNS);
    expect(counts.rockets + counts.smoke).toBeGreaterThan(0);
    view.dispose();
  });

  test('the town is dressed only while the festival is held, and the look fades within seconds after', () => {
    // Owner, 21 Oct 2026, of Bun Bang Fai's smoke still in the sky in March: "ไอ้ขาวๆ ลอยขึ้นมาคืออะไร"
    const { map, ground, lines } = town([{ id: 'songkran', scale: 'modest' }]);
    const view = new CityFestivals(map, ground);
    view.update(lines, 0, 1);
    view.update(lines, 1, 30);
    expect(view.counts().flags).toBeGreaterThan(0);
    expect(view.shown).toEqual(['songkran']);
    // The month is over: the flags come down over a few seconds, night or day
    map.festivals.held = [];
    view.update(lines, 1, 31);
    expect(view.shown).toEqual(['songkran']);
    view.update(lines, 1, 35);
    expect(view.shown).toEqual([]);
    expect(view.root.visible).toBe(false);
    expect(Object.values(view.counts()).every((n) => n === 0)).toBe(true);
    view.dispose();
  });

  test('roads drawn after the festival began (a city just opened builds its lines in a worker) are dressed too', () => {
    const { map, ground, lines } = town([{ id: 'songkran', scale: 'modest' }]);
    const view = new CityFestivals(map, ground);
    view.update([], 0, 1);
    expect(view.counts().flags).toBe(0);
    view.update(lines, 0, 2.5);
    expect(view.counts().flags).toBeGreaterThan(0);
    view.dispose();
  });

  test("a new festival's bunting takes the road, and the last one's look fades with its month", () => {
    const { map, ground, lines } = town([{ id: 'loy_krathong', scale: 'modest' }]);
    const view = new CityFestivals(map, ground);
    view.update(lines, 1, 1);
    expect(view.counts().krathong).toBeGreaterThan(0);
    // Khon Kaen's silk festival comes the month after Loy Krathong
    map.festivals.held = [{ id: 'silk', scale: 'modest' }];
    view.update(lines, 1, 5);
    view.update(lines, 1, 9);
    expect(view.shown).toEqual(['silk']);
    expect(view.counts().flags).toBeGreaterThan(0);
    expect(view.counts().lanterns).toBe(0);
    expect(view.counts().krathong).toBe(0);
    view.dispose();
  });
});
