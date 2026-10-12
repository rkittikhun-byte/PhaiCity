/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run with: npm run test:geo
// Whole-province maps (GEO_SPEC sections 2 and 6B): the scale, roads and railways on the grid, and the roads to the
// neighbours.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARGIN_TILES, MAX_SIDE_TILES, provinceScale, ringsAreaM2, SIDE_STEP_TILES,
} from '../../scripts/geo/lib/provinceArea.mjs';
import { polygonIndex, provinceAt, provinceLinks, roadGraph } from '../../scripts/geo/lib/links.mjs';
import {
  buildChains, clipLine, createNetwork, layPath, RAIL, ROAD, route, routeLine, thinBlocks,
} from '../../scripts/geo/lib/routing.mjs';

const at = (net, x, y) => net.transport[y * net.width + x];
const xy = (net, i) => [i % net.width, Math.floor(i / net.width)];

/** Every step of a path moves to a 4-neighbour. */
function assertConnected(net, path) {
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = xy(net, path[k - 1]);
    const [bx, by] = xy(net, path[k]);
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, `step ${k} jumps from ${ax},${ay} to ${bx},${by}`);
  }
}

describe('province scale', () => {
  test('a small province gets small tiles and a long one keeps under the side limit', () => {
    const small = provinceScale([100, 13, 100.1, 13.1], ringsAreaM2([[[100, 13], [100.1, 13], [100.1, 13.1], [100, 13.1]]], 13));
    assert.ok(small.tileSizeM < 100, `tile ${small.tileSizeM}`);
    assert.equal(small.tileSizeM % 5, 0);
    const long = provinceScale([98, 10, 98.5, 14], 0.5 * 4 * 110000 * 55000 / 2);
    assert.ok(long.height < MAX_SIDE_TILES + SIDE_STEP_TILES, `height ${long.height}`);
    assert.ok(long.width >= 2 * MARGIN_TILES);
    // The simulation reads the map in blocks of up to 8 tiles
    for (const side of [small.width, small.height, long.width, long.height]) assert.equal(side % SIDE_STEP_TILES, 0);
  });
});

describe('chains', () => {
  test('ways meeting end to end form one chain, and a junction ends chains', () => {
    const ways = [
      { points: [0, 0, 1, 0], rank: 1 },
      { points: [1, 0, 2, 0], rank: 0 },
      // A branch at (2, 0): three ways meet there
      { points: [2, 0, 3, 0], rank: 1 },
      { points: [2, 0, 2, 1], rank: 2 },
    ];
    const chains = buildChains(ways);
    assert.equal(chains.length, 3);
    const main = chains.find((chain) => chain.points.length === 3);
    assert.deepEqual(main.points.map(([x]) => x).sort(), [0, 1, 2]);
    assert.equal(main.rank, 0);
  });
});

describe('clipping', () => {
  test('a line crossing the map is cut at its edges', () => {
    const parts = clipLine([[-5, 5], [15, 5]], 10, 10);
    assert.equal(parts.length, 1);
    assert.deepEqual(parts[0].points, [[0, 5], [10, 5]]);
    assert.ok(parts[0].startCut && parts[0].endCut);
  });

  test('a line inside keeps its own ends', () => {
    const [part] = clipLine([[1, 1], [5, 5]], 10, 10);
    assert.ok(!part.startCut && !part.endCut);
  });
});

describe('routing', () => {
  test('a diagonal line becomes a 4-connected path near it', () => {
    const net = createNetwork(40, 40, () => false);
    const path = routeLine(net, 'road', [[2.5, 2.5], [30.5, 20.5]], 2 * 40 + 2, 20 * 40 + 30, 2.5);
    assert.ok(path, 'routed');
    assertConnected(net, path);
    for (const tile of path) {
      const [x, y] = xy(net, tile);
      // Distance from the line through (2.5, 2.5) and (30.5, 20.5)
      const distance = Math.abs(20 * (x + 0.5 - 2.5) - 28 * (y + 0.5 - 2.5)) / Math.hypot(20, 28);
      assert.ok(distance <= 2.5, `tile ${x},${y} is ${distance.toFixed(2)} tiles off the line`);
    }
  });

  test('a bridge crosses water straight', () => {
    // A river two tiles wide down the middle; the line crosses it at a slant
    const water = (i) => i % 30 === 14 || i % 30 === 15;
    const net = createNetwork(30, 30, water);
    const path = route(net, 'road', [[5.5, 10.5], [25.5, 16.5]], 10 * 30 + 5, 16 * 30 + 25);
    assert.ok(path, 'routed');
    assertConnected(net, path);
    const wet = path.map((tile, k) => (water(tile) ? k : -1)).filter((k) => k >= 0);
    assert.ok(wet.length >= 2);
    for (const k of wet) {
      const [px, py] = xy(net, path[k - 1]);
      const [x, y] = xy(net, path[k]);
      const [nx, ny] = xy(net, path[k + 1]);
      assert.equal(y, py, 'enters the bridge going across');
      assert.equal(ny, y, 'leaves the bridge going across');
      assert.equal(nx - x, x - px, 'keeps going the same way');
    }
  });

  test('a road crosses a railway only at right angles on straight track', () => {
    const net = createNetwork(30, 30, () => false);
    // A railway down column 15 that bends at row 15
    const rail = [];
    for (let y = 0; y <= 15; y++) rail.push(y * 30 + 15);
    for (let x = 16; x < 30; x++) rail.push(15 * 30 + x);
    layPath(net, 'rail', rail);
    const path = route(net, 'road', [[2.5, 8.5], [27.5, 8.5]], 8 * 30 + 2, 8 * 30 + 27);
    assert.ok(path, 'routed');
    assertConnected(net, path);
    const crossings = path.filter((tile) => net.transport[tile] & RAIL);
    assert.equal(crossings.length, 1);
    const k = path.indexOf(crossings[0]);
    const [px, py] = xy(net, path[k - 1]);
    const [nx, ny] = xy(net, path[k + 1]);
    assert.equal(py, ny, 'straight across the track');
    assert.equal(Math.abs(nx - px), 2);
  });

  test('a second carriageway reuses the first', () => {
    const net = createNetwork(40, 20, () => false);
    const first = route(net, 'road', [[2.5, 10.2], [37.5, 10.2]], 10 * 40 + 2, 10 * 40 + 37);
    layPath(net, 'road', first);
    const second = route(net, 'road', [[2.5, 10.8], [37.5, 10.8]], 10 * 40 + 2, 10 * 40 + 37);
    layPath(net, 'road', second);
    const roads = [...net.transport].filter((code) => code & ROAD).length;
    assert.equal(roads, first.length);
  });

  test('thinning leaves no 2 x 2 block and keeps the road joined', () => {
    const net = createNetwork(10, 10, () => false);
    // An L of road with a filled corner block
    for (let x = 1; x <= 8; x++) net.transport[5 * 10 + x] = ROAD;
    for (let y = 1; y <= 5; y++) net.transport[y * 10 + 4] = ROAD;
    net.transport[4 * 10 + 5] = ROAD;
    net.anchors.add(5 * 10 + 1);
    net.anchors.add(5 * 10 + 8);
    net.anchors.add(1 * 10 + 4);
    thinBlocks(net, 'road');
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const block = [at(net, x, y), at(net, x + 1, y), at(net, x, y + 1), at(net, x + 1, y + 1)];
        assert.ok(!block.every((code) => code & ROAD), `block at ${x},${y}`);
      }
    }
    assert.ok(at(net, 1, 5) && at(net, 8, 5) && at(net, 4, 1));
  });
});

describe('roads to the neighbours', () => {
  // A square province from (0, 0) to (100, 100) metres; a neighbour east and one north
  const insideIndex = polygonIndex([[[0, 0], [100, 0], [100, 100], [0, 100]]], 10);

  test('the polygon index tells inside from outside', () => {
    assert.ok(insideIndex.contains(50, 50));
    assert.ok(!insideIndex.contains(150, 50));
    assert.ok(!insideIndex.contains(50, -5));
  });

  test('each neighbour gets the crossing on the shortest way between the towns', () => {
    // Points are given as [lon, lat]; project maps them straight to metres (x = lon, y = lat)
    const ways = [
      { points: [50, 50, 120, 50, 160, 50], rank: 1, ref: '12' }, // east from the town
      { points: [50, 50, 50, -40], rank: 1, ref: '2' }, // north from the town (y down)
      { points: [50, 50, 90, 80, 130, 80, 160, 60], rank: 2, ref: '209' }, // a longer way east
    ];
    const nodes = roadGraph(ways, (lat, lon) => ({ x: lon, y: lat }));
    const towns = { east: { x: 200, y: 50 }, north: { x: 50, y: -100 } };
    const { links } = provinceLinks({
      nodes,
      inside: (node) => insideIndex.contains(node.x, node.y),
      provinceOf: (node) => (node.x > 100 ? 'east' : node.y < 0 ? 'north' : null),
      neighbors: ['east', 'north'],
      town: { x: 50, y: 50 },
      townOf: (id) => towns[id] ?? null,
      onMap: (node) => node.x >= -20 && node.x <= 140 && node.y >= -20 && node.y <= 120,
    });
    assert.deepEqual(links.map((link) => [link.neighbor, link.ref]), [['east', '12'], ['north', '2']]);
    // The road runs from the town to where it leaves the map
    const east = links[0];
    assert.deepEqual(east.points[0], [50, 50]);
    assert.ok(east.points[east.points.length - 1][0] > 140);
  });

  test('provinceAt finds the province holding a point', () => {
    const shapes = new Map([
      ['TH-01', { bbox: [0, 0, 1, 1], rings: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }],
      ['TH-02', { bbox: [1, 0, 2, 1], rings: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] }],
    ]);
    assert.equal(provinceAt(0.5, 0.5, shapes), 'TH-01');
    assert.equal(provinceAt(1.5, 0.5, shapes), 'TH-02');
    assert.equal(provinceAt(3, 0.5, shapes), null);
  });
});
