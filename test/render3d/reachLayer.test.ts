/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What a police station, fire station, school or hospital in hand would reach along the roads (src/sim/reachPreview.ts,
// src/render3d/city/reachLayer.ts, docs/NO_GRID_PLAN.md 4.3): the roads from where it would stand, as far along them as
// its cover or places go, drawn on the roads and paler with the distance; nothing past its reach, nothing for other tools
// or off a real-scale city map.

import { type Mesh } from 'three';
import { reachColour, NO_SUPPLY } from '../../src/cityMap.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { ReachLayer } from '../../src/render3d/city/reachLayer.js';
import { RoadGraph } from '../../src/roads/roadGraph.js';
import { reachedAt, reachPreview, reachShare, toolReach } from '../../src/sim/reachPreview.js';
import { COVER_REACH_M } from '../../src/sim/serviceReach.js';
import { SEAT_REACH_M } from '../../src/sim/serviceSeats.js';

const flat = { sample: () => 0 } as unknown as CityHeightField;
const U = 10 / 16;

/** A real-scale map 100 x 100 tiles of 16 m: a road east-west at z = 200 m, and a road north from it at x = 800 m */
function city(tileSizeM = 16) {
  const graph = new RoadGraph();
  graph.add({ from: [0, 200], to: [1600, 200], level: 2 });
  graph.add({ from: [800, 200], to: [800, 1500], level: 2 });
  const map = { width: 100, height: 100, tileSizeM, roadGraph: graph, getTileValue: () => 0, buildings: null };
  return { graph, map };
}
/** A 3 x 3 building centred on tile (10, 11): its outline 144-192 m east-west... and 160-208 m north-south, on the road */
const CENTRE = 11 * 100 + 10;

describe('what a service in hand reaches along the roads', () => {
  test('police and fire stations reach their cover, schools and hospitals their places; other tools nothing', () => {
    expect(toolReach('police_box')).toEqual({ field: 'police', metres: COVER_REACH_M });
    expect(toolReach('fire_centre')).toEqual({ field: 'fire', metres: COVER_REACH_M });
    expect(toolReach('primary_school')).toEqual({ field: 'basic', metres: SEAT_REACH_M.basic });
    expect(toolReach('vocational_college')).toEqual({ field: 'higher', metres: SEAT_REACH_M.higher });
    expect(toolReach('health_centre')).toEqual({ field: 'health', metres: SEAT_REACH_M.health });
    expect(toolReach('road')).toBeNull();
    expect(toolReach('residential')).toBeNull();
    // the cover falls to nothing at its reach; places are the same to the last tenth of theirs
    expect(reachShare('police', 0, 320)).toBe(1);
    expect(reachShare('police', 160, 320)).toBeCloseTo(0.5625, 6);
    expect(reachShare('police', 320, 320)).toBe(0);
    expect(reachShare('basic', 2000, 3000)).toBe(1);
    expect(reachShare('basic', 2850, 3000)).toBeCloseTo(0.5, 6);
    expect(reachShare('basic', 3000, 3000)).toBe(0);
  });

  test('a police box reaches its own road both ways, not the road 600 m off; a school reaches that one too', () => {
    const { graph, map } = city();
    const police = reachPreview(map, 'police_box', CENTRE, 3)!;
    expect(police.field).toBe('police');
    const branch = [...graph.segments.keys()].filter((id) => graph.pointAt(id, 0.5)[0] === 800 && graph.pointAt(id, 0.5)[1] > 300);
    expect(branch.length).toBe(1);
    expect(police.roads.some((r) => r.id === branch[0])).toBe(false);
    // ... where it stands it is on its road (its outline's edge 0 m off the line), and 320 m east of there its cover ends
    const own = police.roads.find((r) => r.at)!;
    expect(own).toBeDefined();
    const length = graph.length(own.id);
    expect(reachedAt(own, own.at!.t, length)).toBeLessThan(1);
    const stand = graph.pointAt(own.id, own.at!.t)[0];
    expect(stand).toBeGreaterThanOrEqual(144);
    expect(stand).toBeLessThanOrEqual(192);
    const at = (x: number): number => {
      const [x0] = graph.pointAt(own.id, 0), [x1] = graph.pointAt(own.id, 1);
      return reachedAt(own, (x - x0) / (x1 - x0), length);
    };
    expect(at(stand + 300)).toBeCloseTo(300, 0);
    expect(at(stand + 340)).toBeGreaterThan(COVER_REACH_M);
    const school = reachPreview(map, 'primary_school', CENTRE, 3)!;
    expect(school.roads.some((r) => r.id === branch[0])).toBe(true);
  });

  test('nothing for other tools, off a real-scale map, or where it meets no road', () => {
    const { map } = city();
    expect(reachPreview(map, 'road', CENTRE, 3)).toBeNull();
    expect(reachPreview(city(100).map, 'police_box', CENTRE, 3)).toBeNull();
    expect(reachPreview(map, 'police_box', 50 * 100 + 30, 3)).toBeNull();
  });

  test('the 3D view draws the roads it reaches, paler further off, none past its reach; gone with the tool', () => {
    const { map } = city(), layer = new ReachLayer(map, flat, U);
    const police = reachPreview(map, 'police_box', CENTRE, 3)!;
    layer.show(police);
    expect(layer.pieces).toBeGreaterThan(20);
    const mesh = layer.root.children[0] as Mesh;
    const p = mesh.geometry.getAttribute('position'), c = mesh.geometry.getAttribute('color'), index = mesh.geometry.getIndex()!;
    // every piece drawn lies on the east-west road within the reach (and a piece's length) of where it stands
    for (let i = 0; i < index.count; i++) {
      const v = index.getX(i), x = p.getX(v) / U, z = p.getZ(v) / U;
      expect(Math.abs(z - 200)).toBeLessThan(6);
      expect(x).toBeLessThan(192 + COVER_REACH_M + 8);
    }
    // ... in the police's colour where it stands, greyer towards the end of its reach
    const near = reachColour('police', 1).map((v) => v / 255), far = reachColour('police', 0).map((v) => v / 255);
    expect(far).toEqual(reachColour('police', 0).map((v) => v / 255));
    expect(reachColour('police', 0)).not.toEqual(NO_SUPPLY);
    let sawNear = false;
    for (let v = 0; v < p.count; v++) if (Math.abs(c.getX(v) - near[0]) < 0.02 && Math.abs(c.getZ(v) - near[2]) < 0.02) sawNear = true;
    expect(sawNear).toBe(true);
    // the same preview is not built again; none takes it away
    layer.show(police);
    expect(layer.root.children[0]).toBe(mesh);
    layer.show(null);
    expect(layer.pieces).toBe(0);
    expect(layer.root.children.length).toBe(0);
  });
});
