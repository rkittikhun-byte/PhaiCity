/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run with: npm run test:geo

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignNeighborEdges, bearingDegrees, edgeForBearing, geometryContains,
} from '../../scripts/geo/lib/geometry.mjs';

const origin = { lat: 15, lon: 100 };
const offset = (dLat, dLon) => ({ lat: origin.lat + dLat, lon: origin.lon + dLon });

describe('bearingDegrees', () => {
  test('points the four compass directions', () => {
    assert.ok(Math.abs(bearingDegrees(origin, offset(1, 0)) - 0) < 0.5);
    assert.ok(Math.abs(bearingDegrees(origin, offset(0, 1)) - 90) < 0.5);
    assert.ok(Math.abs(bearingDegrees(origin, offset(-1, 0)) - 180) < 0.5);
    assert.ok(Math.abs(bearingDegrees(origin, offset(0, -1)) - 270) < 0.5);
  });
});

describe('edgeForBearing', () => {
  test('uses the GEO_SPEC ranges with inclusive lower bounds', () => {
    assert.equal(edgeForBearing(0), 'N');
    assert.equal(edgeForBearing(44.9), 'N');
    assert.equal(edgeForBearing(45), 'E');
    assert.equal(edgeForBearing(134.9), 'E');
    assert.equal(edgeForBearing(135), 'S');
    assert.equal(edgeForBearing(225), 'W');
    assert.equal(edgeForBearing(314.9), 'W');
    assert.equal(edgeForBearing(315), 'N');
    assert.equal(edgeForBearing(359.9), 'N');
  });

  test('normalizes bearings outside 0–360', () => {
    assert.equal(edgeForBearing(-10), 'N');
    assert.equal(edgeForBearing(450), 'E');
  });
});

describe('assignNeighborEdges', () => {
  test('a lone neighbor gets its whole edge', () => {
    const result = assignNeighborEdges(origin, [{ id: 'A', center: offset(0, 1) }]);
    assert.deepEqual(result.map(({ neighbor, edge, from, to }) => ({ neighbor, edge, from, to })),
      [{ neighbor: 'A', edge: 'E', from: 0, to: 1 }]);
  });

  test('neighbors on the north edge are ordered west to east', () => {
    const result = assignNeighborEdges(origin, [
      { id: 'east', center: offset(1, 0.5) },
      { id: 'west', center: offset(1, -0.5) },
      { id: 'middle', center: offset(1, 0) },
    ]);
    assert.deepEqual(result.map((r) => [r.neighbor, r.edge, r.from, r.to]), [
      ['west', 'N', 0, 0.3333],
      ['middle', 'N', 0.3333, 0.6667],
      ['east', 'N', 0.6667, 1],
    ]);
  });

  test('neighbors on the south edge are also ordered west to east', () => {
    const result = assignNeighborEdges(origin, [
      { id: 'southeast', center: offset(-1, 0.5) },
      { id: 'southwest', center: offset(-1, -0.5) },
    ]);
    assert.deepEqual(result.map((r) => [r.neighbor, r.edge, r.from, r.to]), [
      ['southwest', 'S', 0, 0.5],
      ['southeast', 'S', 0.5, 1],
    ]);
  });

  test('neighbors on the west edge are ordered north to south', () => {
    const result = assignNeighborEdges(origin, [
      { id: 'lower', center: offset(-0.5, -1) },
      { id: 'upper', center: offset(0.5, -1) },
    ]);
    assert.deepEqual(result.map((r) => [r.neighbor, r.edge, r.from, r.to]), [
      ['upper', 'W', 0, 0.5],
      ['lower', 'W', 0.5, 1],
    ]);
  });

  test('every neighbor appears exactly once', () => {
    const neighbors = [offset(1, 0), offset(0, 1), offset(-1, 0), offset(0, -1), offset(1, 1)]
      .map((center, i) => ({ id: `n${i}`, center }));
    const result = assignNeighborEdges(origin, neighbors);
    assert.deepEqual(result.map((r) => r.neighbor).sort(), neighbors.map((n) => n.id).sort());
  });
});

describe('geometryContains', () => {
  const square = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
  const withHole = {
    type: 'Polygon',
    coordinates: [square.coordinates[0], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
  };

  test('detects points inside and outside a polygon', () => {
    assert.equal(geometryContains(square, { lon: 5, lat: 5 }), true);
    assert.equal(geometryContains(square, { lon: 15, lat: 5 }), false);
  });

  test('treats holes as outside', () => {
    assert.equal(geometryContains(withHole, { lon: 5, lat: 5 }), false);
    assert.equal(geometryContains(withHole, { lon: 2, lat: 2 }), true);
  });

  test('handles multipolygons', () => {
    const multi = { type: 'MultiPolygon', coordinates: [square.coordinates, [[[20, 20], [30, 20], [30, 30], [20, 20]]]] };
    assert.equal(geometryContains(multi, { lon: 25, lat: 22 }), true);
    assert.equal(geometryContains(multi, { lon: 15, lat: 15 }), false);
  });
});
