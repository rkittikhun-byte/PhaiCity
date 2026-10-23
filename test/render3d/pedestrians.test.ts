/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Vector3 } from 'three';
import { CityPedestrians, JOG_STRIDE_M, WALK_STRIDE_M } from '../../src/render3d/city/pedestrians.js';
import type { PeopleDrawer } from '../../src/render3d/city/people3d.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { BUS_STOP, HOUSE, IND1 } from '../../src/tileValues.js';
import { ZONEBIT } from '../../src/tileFlags.js';

function createTestMap(width = 24, height = 24) {
  const values = new Uint16Array(width * height);
  const flags = new Uint16Array(width * height);
  return {
    width, height, values, flags,
    getTileValue(x: number, y: number) { return values[y * width + x]; },
    getTileFlags(x: number, y: number) { return flags[y * width + x]; },
  };
}

describe('CityPedestrians Purposeful Employment and Community Activities', () => {
  it('matches residents to real industrial workplaces and counts employed workers in industry', () => {
    const m = createTestMap(30, 30);
    // House at (10, 10)
    m.values[10 * 30 + 10] = HOUSE;
    // House at (11, 10)
    m.values[10 * 30 + 11] = HOUSE;
    // Industrial zone center at (15, 10)
    m.values[10 * 30 + 15] = IND1;
    m.flags[10 * 30 + 15] = ZONEBIT;

    const s = new TileSnapshot(30, 30);
    s.realUnits = 10 / 16;
    s.sync(m);

    const terrain = new CityHeightField(s, m);
    const peds = new CityPedestrians(s, terrain, 10 / 16);
    const lines = [{ points: [[100, 100], [150, 100]] as [number, number][], rail: false, level: 2 }];

    try {
      peds.update(lines, new Vector3(120, 0, 100), 100, 2.0);

      // Verify that employment matching found the real industrial company and assigned workers
      const stats = peds.employmentStats;
      expect(stats.industry).toBeGreaterThan(0);
      expect(stats.totalEmployed).toBeGreaterThan(0);

      const employed = peds.employedCitizens;
      expect(employed.length).toBeGreaterThan(0);
      expect(employed[0].workplace.sector).toBe('industry');
      expect(employed[0].workplace.companyName).toMatch(/สยาม|ไทยเจริญ|อุตสาหกรรม|ผ้าไหม|ผลิตอาหาร|โลจิสติกส์|เหมืองแร่|น้ำมันพืช/);
      expect(employed[0].name.length).toBeGreaterThan(0);

      // Verify road walkers
      expect(peds.shirtMesh.count).toBeGreaterThan(0);
      expect(peds.strideAMesh.count).toBe(peds.shirtMesh.count);
      expect(peds.strideBMesh.count).toBe(peds.shirtMesh.count);
    } finally {
      peds.dispose();
    }
  });

  it('spawns Sepak Takraw (ตะกร้อวง) games with ball and 3 players in front of community spaces', () => {
    const m = createTestMap(30, 30);
    // Place multiple houses to trigger takraw courts
    for (let x = 6; x < 20; x += 2) {
      m.values[12 * 30 + x] = HOUSE;
    }
    const s = new TileSnapshot(30, 30);
    s.sync(m);
    const terrain = new CityHeightField(s, m);
    const peds = new CityPedestrians(s, terrain, 1);
    const lines = [{ points: [[60, 120], [200, 120]] as [number, number][], rail: false, level: 2 }];

    try {
      peds.update(lines, new Vector3(120, 0, 120), 80, 1.2);
      expect(peds.takrawMesh.count).toBeGreaterThan(0);
      expect(peds.shirtMesh.count).toBeGreaterThanOrEqual(3);
    } finally {
      peds.dispose();
    }
  });

  it('places waiting passengers at bus stops with calm standing pose', () => {
    const m = createTestMap(20, 20);
    m.values[8 * 20 + 8] = BUS_STOP; // 1021
    const s = new TileSnapshot(20, 20);
    s.sync(m);
    const terrain = new CityHeightField(s, m);
    const peds = new CityPedestrians(s, terrain, 1);
    const lines = [{ points: [[70, 80], [100, 80]] as [number, number][], rail: false, level: 2 }];

    try {
      peds.update(lines, new Vector3(80, 0, 80), 60, 0.5);
      expect(peds.shirtMesh.count).toBeGreaterThan(0);
    } finally {
      peds.dispose();
    }
  });

  it('does not spawn aimless walkers in empty wilderness fields when no houses or workplaces exist', () => {
    const m = createTestMap(20, 20);
    // 0 buildings, purely empty dirt
    const s = new TileSnapshot(20, 20);
    s.sync(m);
    const terrain = new CityHeightField(s, m);
    const peds = new CityPedestrians(s, terrain, 1);
    const lines = [{ points: [[10, 10], [12, 10]] as [number, number][], rail: false, level: 2 }]; // very short wilderness path

    try {
      peds.update(lines, new Vector3(10, 0, 10), 50, 1.0);
      // Empty short road with no buildings nearby should have 0 commuters and 0 plaza walkers
      expect(peds.employmentStats.totalEmployed).toBe(0);
      expect(peds.employmentStats.activeCommuters).toBe(0);
      expect(peds.takrawMesh.count).toBe(0);
    } finally {
      peds.dispose();
    }
  });

  it('everyone walking faces the way they go, home or out (owner, 23 Oct 2026: "คนก็เดินถอยหลัง"), and steps as far as they walk', () => {
    const m = createTestMap(30, 30);
    for (const x of [10, 11, 12]) m.values[10 * 30 + x] = HOUSE;
    m.values[10 * 30 + 16] = IND1;
    m.flags[10 * 30 + 16] = ZONEBIT;
    const s = new TileSnapshot(30, 30);
    s.realUnits = 10 / 16;
    s.sync(m);
    const peds = new CityPedestrians(s, new CityHeightField(s, m), 10 / 16);
    // a drawer that writes down where each person is put
    let placed = new Map<number, { x: number; z: number; heading: number; phase: number; activity: string; scale: number }>();
    const drawer = {
      place: (_slot: number, x: number, _y: number, z: number, heading: number, scale: number, who: number, activity: string, phase: number) => {
        placed.set(who, { x, z, heading, phase, activity, scale });
      },
      finish: () => {}, useSheets: () => {}, dispose: () => {},
    } as unknown as PeopleDrawer;
    peds.usePeople(drawer, 'central', () => 1);
    const lines = [{ points: [[100, 100], [160, 100], [160, 140]] as [number, number][], rail: false, level: 2 }];
    try {
      let walkers = 0, back = 0;
      for (let t = 0; t < 120; t += 0.5) {
        peds.update(lines, new Vector3(130, 0, 110), 100, t);
        const before = placed;
        placed = new Map();
        peds.update(lines, new Vector3(130, 0, 110), 100, t + 0.05);
        for (const [who, now] of placed) {
          const was = before.get(who);
          if (!was || (now.activity !== 'walk' && now.activity !== 'jog')) continue;
          const mx = now.x - was.x, mz = now.z - was.z, moved = Math.hypot(mx, mz);
          // (a walker who reached the end of the street and turned, or a jogger who came round again, moved too far)
          if (moved < 1e-4 || moved > 1) continue;
          walkers++;
          if (mx * Math.sin(now.heading) + mz * Math.cos(now.heading) <= 0) back++;
          // a step cycle (2π) for every stride of their clip at their size: no sliding
          const stride = (now.activity === 'walk' ? WALK_STRIDE_M : JOG_STRIDE_M) * now.scale;
          expect((now.phase - was.phase) / (2 * Math.PI) * stride).toBeCloseTo(moved, 2);
        }
        placed = new Map();
      }
      expect(walkers).toBeGreaterThan(50);
      expect(back).toBe(0);
    } finally {
      peds.dispose();
    }
  });
});
