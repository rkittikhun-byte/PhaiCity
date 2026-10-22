/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The traffic layer on the roads themselves (src/render3d/city/trafficLayer.ts, src/cityMap.ts trafficColour,
// docs/NO_GRID_PLAN.md 1.6): each road of the graph in its traffic's colour, green to red by how full it is, as wide as
// the road and along it, no squares.

import { type Mesh } from 'three';
import { layerPixels, TRAFFIC_BUSY, TRAFFIC_FREE, TRAFFIC_JAM, trafficColour } from '../../src/cityMap.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { TrafficLayer } from '../../src/render3d/city/trafficLayer.js';
import { RoadGraph } from '../../src/roads/roadGraph.js';
import { buildRoadNet } from '../../src/sim/roadNetwork.js';

const flat = { sample: () => 0 } as unknown as CityHeightField;
const U = 10 / 16;

/** Two roads, one empty and one as full as it takes, and the month's trips on them */
function city() {
  const graph = new RoadGraph();
  const quiet = graph.add({ from: [0, 100], to: [400, 100], level: 2 }).segments[0];
  const busy = graph.add({ from: [0, 300], to: [400, 300], level: 2 }).segments[0];
  const roads = buildRoadNet(graph), cars = new Float32Array(roads.segmentIds.length), capacity = new Float64Array(roads.segmentIds.length).fill(1000);
  cars[roads.segmentIndex.get(busy)!] = 1200;
  const trips: any = { roads, net: { capacity }, result: { cars } };
  return { graph, quiet, busy, map: { roadGraph: graph, trips } };
}

describe('the traffic layer', () => {
  test('green flowing, yellow filling, red jammed', () => {
    expect(trafficColour(0)).toEqual(trafficColour(TRAFFIC_FREE));
    const [r0, g0] = trafficColour(0), [r1, g1] = trafficColour(TRAFFIC_JAM);
    expect(g0).toBeGreaterThan(r0);
    expect(r1).toBeGreaterThan(g1);
    const mid = trafficColour(TRAFFIC_BUSY);
    expect(mid[0]).toBeGreaterThan(r0);
    expect(mid[1]).toBeGreaterThan(g1);
  });

  test('each road along its line, as wide as it is, in its own colour; gone with the layer', () => {
    const { map } = city(), layer = new TrafficLayer(map, flat, U);
    expect(layer.show(true)).toBe(true);
    const mesh = layer.root.children[0] as Mesh;
    const p = mesh.geometry.getAttribute('position'), c = mesh.geometry.getAttribute('color');
    // The quiet road's points are green, the busy one's red, and every point lies on its road, half a road off its line
    let quiet = 0, busy = 0;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i) / U;
      const nearQuiet = Math.abs(z - 100) < 5, nearBusy = Math.abs(z - 300) < 5;
      expect(nearQuiet || nearBusy).toBe(true);
      if (nearQuiet) { quiet++; expect(c.getY(i)).toBeGreaterThan(c.getX(i)); }
      if (nearBusy) { busy++; expect(c.getX(i)).toBeGreaterThan(c.getY(i)); }
    }
    expect(quiet).toBeGreaterThan(4);
    expect(busy).toBeGreaterThan(4);
    layer.show(false);
    expect(mesh.visible).toBe(false);
    layer.dispose();
  });

  test('without trips it shows nothing, and the city map paints only the roads', () => {
    const layer = new TrafficLayer({ roadGraph: new RoadGraph(), trips: null }, flat, U);
    expect(layer.show(true)).toBe(false);
    expect(layer.root.children).toHaveLength(0);
    // The city map's traffic layer: a road tile in its traffic's colour, the rest dimmed
    const map = { width: 3, height: 1, getTileValue: () => 0, getTileFlags: () => 0 } as any;
    const grid = { worldGet: () => 0 };
    const overlays: any = { trafficDensityMap: grid, pollutionDensityMap: grid, crimeRateMap: grid, landValueMap: grid,
      populationDensityMap: grid, policeStationEffectMap: grid, fireStationEffectMap: grid, toxicMap: grid,
      roadFull: (x: number) => (x === 1 ? 1.2 : null) };
    const pixels = layerPixels('traffic', map, overlays);
    expect(Array.from(pixels.slice(4, 7))).toEqual(trafficColour(1.2));
    expect(pixels[0]).toBe(pixels[1]);
  });
});
