/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The festivals in the 3D view (src/render3d/city/festivals3d.ts): it reads what the map holds this month and dresses
// the town, lanterns or flags along the roads near the ruler's house, krathong on the water, sky lanterns at night and
// rockets, more of them for a grand festival, and never writes the map.

import type { InstancedMesh } from 'three';
import { CityFestivals, FESTIVAL_TOUCHES, MAX_BUNTING, MAX_KRATHONG, MAX_SHOW_SECONDS, MAX_SKY_LANTERNS, MODEST_SHARE,
  type FestivalLine, type FestivalViewMap } from '../../src/render3d/city/festivals3d';
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

/** A 40 × 40 map with a river down column 30 and roads every 10 tiles, the ruler's house at (20, 18) */
function town(held: { id: string; scale: string }[]) {
  const width = 40, height = 40;
  const festivals = { held: held.map((h) => Object.freeze({ ...h })) };
  const map: FestivalViewMap & { festivals: { held: { id: string; scale: string }[] } } = {
    width, height, festivals, rulerHouse: Object.freeze({ x: 20, y: 18 }), town: { x: 5, y: 5 },
    getTileValue: (x: number) => x === 30 ? RIVER : 0,
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

  test('Loy Krathong hangs lanterns along the road, not the railway, and floats krathong on the river', () => {
    const { map, ground, lines } = town([{ id: 'loy_krathong', scale: 'modest' }]);
    const before = JSON.stringify(map);
    const view = new CityFestivals(map, ground);
    for (let t = 0; t <= 5; t += 0.05) view.update(lines, 1, t);
    const counts = view.counts();
    expect(counts.lanterns).toBe(Math.round(MAX_BUNTING * MODEST_SHARE));
    expect(counts.flags).toBe(0);
    expect(counts.krathong).toBe(Math.round(MAX_KRATHONG * MODEST_SHARE));
    expect(counts.skyLanterns).toBe(0);
    // Every lantern beside the road near the house, none along the railway
    const lanterns = view.root.getObjectByName('festival_lanterns') as InstancedMesh;
    const m = lanterns.instanceMatrix.array;
    for (let i = 0; i < lanterns.count; i++) {
      const x = m[i * 16 + 12], z = m[i * 16 + 14];
      expect(offRoad(x, z)).toBeLessThan(8);
      expect(z).toBeLessThan(380);
      expect(Math.hypot(x - 205, z - 185)).toBeLessThan(270);
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
    expect(counts.lanterns).toBeGreaterThan(Math.round(MAX_BUNTING * MODEST_SHARE));
    expect(counts.lanterns).toBeLessThanOrEqual(MAX_BUNTING);
    expect(counts.skyLanterns).toBe(MAX_SKY_LANTERNS);
    expect(counts.rockets + counts.smoke).toBeGreaterThan(0);
    view.dispose();
  });

  test('the town stays dressed after the festival until its night is over, then the lights fade away', () => {
    const { map, ground, lines } = town([{ id: 'songkran', scale: 'modest' }]);
    const view = new CityFestivals(map, ground);
    view.update(lines, 0, 1);
    expect(view.counts().flags).toBeGreaterThan(0);
    map.festivals.held = [];
    // The month is over by day: still dressed, through the night
    view.update(lines, 0, 10);
    view.update(lines, 1, 60);
    expect(view.shown).toEqual(['songkran']);
    // Morning: the flags come down over a few seconds
    view.update(lines, 0, 100);
    expect(view.shown).toEqual(['songkran']);
    view.update(lines, 0, 104);
    expect(view.shown).toEqual([]);
    expect(view.root.visible).toBe(false);
    // ... and never longer than a few minutes, night or not
    map.festivals.held = [{ id: 'silk', scale: 'grand' }];
    view.update(lines, 0, 200);
    map.festivals.held = [];
    view.update(lines, 0, 200 + MAX_SHOW_SECONDS + 1);
    view.update(lines, 0, 200 + MAX_SHOW_SECONDS + 5);
    expect(view.shown).toEqual([]);
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

  test("a new festival's bunting takes the road, while the last one's krathong stay on the water through their night", () => {
    const { map, ground, lines } = town([{ id: 'loy_krathong', scale: 'modest' }]);
    const view = new CityFestivals(map, ground);
    view.update(lines, 1, 1);
    // Khon Kaen's silk festival comes the month after Loy Krathong, in the same night
    map.festivals.held = [{ id: 'silk', scale: 'modest' }];
    view.update(lines, 1, 5);
    view.update(lines, 1, 9);
    expect(view.shown.sort()).toEqual(['loy_krathong', 'silk']);
    expect(view.counts().flags).toBeGreaterThan(0);
    expect(view.counts().lanterns).toBe(0);
    expect(view.counts().krathong).toBeGreaterThan(0);
    // Morning: Loy Krathong's night is over and its krathong go; the silk banners stay while the silk festival is held
    view.update(lines, 0, 30);
    view.update(lines, 0, 35);
    expect(view.shown).toEqual(['silk']);
    expect(view.counts().krathong).toBe(0);
    expect(view.counts().flags).toBeGreaterThan(0);
    view.dispose();
  });
});
