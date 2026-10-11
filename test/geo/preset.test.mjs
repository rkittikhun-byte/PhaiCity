/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run with: npm run test:geo

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeRle, encodeRle } from '../../scripts/geo/lib/rle.mjs';
import { makeGrid } from '../../scripts/geo/lib/projection.mjs';
import { createMask, fillPolygon, seaFromCoastline, strokeSegment, traceSegmentCells } from '../../scripts/geo/lib/raster.mjs';
import { buildPreset, LAND, WATER, WOODS } from '../../scripts/geo/lib/preset.mjs';

describe('RLE', () => {
  test('round-trips cells', () => {
    const cells = [0, 0, 0, 1, 1, 2, 0, 0];
    assert.equal(encodeRle(cells), '3:0,2:1,1:2,2:0');
    assert.deepEqual(decodeRle(encodeRle(cells), cells.length), cells);
  });

  test('rejects a wrong length', () => {
    assert.throws(() => decodeRle('3:0', 4));
  });
});

describe('projection', () => {
  const grid = makeGrid({ center: { lat: 13.75, lon: 100.5 }, width: 120, height: 100, tileSizeM: 10 });

  test('puts the center in the middle of the grid', () => {
    const { x, y } = grid.project(13.75, 100.5);
    assert.ok(Math.abs(x - 600) < 1e-6 && Math.abs(y - 500) < 1e-6);
  });

  test('round-trips points', () => {
    const point = grid.unproject(123, 456);
    const back = grid.project(point.lat, point.lon);
    assert.ok(Math.abs(back.x - 123) < 1e-6 && Math.abs(back.y - 456) < 1e-6);
  });

  test('north is up and east is right', () => {
    assert.ok(grid.project(13.76, 100.5).y < 500);
    assert.ok(grid.project(13.75, 100.51).x > 600);
  });
});

describe('rasterizers', () => {
  test('fills a square polygon and leaves its hole empty', () => {
    const mask = createMask(10, 10);
    const square = (a, b) => [[a, a, b, a], [b, a, b, b], [b, b, a, b], [a, b, a, a]];
    fillPolygon(mask, 1, [...square(1, 9), ...square(4, 6)]);
    assert.equal(mask.data[2 * 10 + 2], 1);
    assert.equal(mask.data[5 * 10 + 5], 0);
    assert.equal(mask.data[0], 0);
  });

  test('skips rows of an unclosed ring instead of streaking', () => {
    const mask = createMask(10, 10);
    fillPolygon(mask, 1, [[1, 1, 9, 1], [9, 1, 9, 9]]);
    assert.equal(mask.data.reduce((sum, v) => sum + v, 0), 0);
  });

  test('strokes a thick line', () => {
    const mask = createMask(20, 20);
    strokeSegment(mask, 1, [2, 10, 18, 10], 2);
    assert.equal(mask.data[10 * 20 + 10], 1);
    assert.equal(mask.data[11 * 20 + 10], 1);
    assert.equal(mask.data[15 * 20 + 10], 0);
  });

  test('traces a diagonal as a 4-connected path', () => {
    const visited = [];
    traceSegmentCells([0.5, 0.5, 9.5, 9.5], 1, 10, 10, (c, r) => visited.push([c, r]));
    for (let i = 1; i < visited.length; i++) {
      const [c1, r1] = visited[i - 1];
      const [c2, r2] = visited[i];
      assert.ok(Math.abs(c1 - c2) + Math.abs(r1 - r2) <= 1, `jump between ${visited[i - 1]} and ${visited[i]}`);
    }
  });
});

describe('seaFromCoastline', () => {
  // A coastline running west → east across the middle: land on the left (north), sea on the right (south).
  test('puts the sea on the right-hand side of the coastline', () => {
    const sea = seaFromCoastline(20, 20, 1, [[-5, 10, 25, 10]]);
    assert.equal(sea.data[2 * 20 + 10], 0, 'north should be land');
    assert.equal(sea.data[17 * 20 + 10], 1, 'south should be sea');
  });

  test('reverses when the coastline direction is reversed', () => {
    const sea = seaFromCoastline(20, 20, 1, [[25, 10, -5, 10]]);
    assert.equal(sea.data[2 * 20 + 10], 1);
    assert.equal(sea.data[17 * 20 + 10], 0);
  });

  test('returns null without a coastline', () => {
    assert.equal(seaFromCoastline(20, 20, 1, []), null);
  });
});

describe('buildPreset', () => {
  const center = { lat: 15, lon: 100 };
  const grid = makeGrid({ center, width: 40, height: 30, tileSizeM: 10 });
  const at = (x, y) => grid.unproject(x, y);
  const closedWay = (tags, corners) => ({
    type: 'way', tags, geometry: [...corners, corners[0]].map(([x, y]) => at(x, y)),
  });

  test('classifies water, woods and land by coverage', () => {
    const { cells, stats } = buildPreset(grid, [
      closedWay({ natural: 'water' }, [[0, 0], [100, 0], [100, 100], [0, 100]]),
      closedWay({ leisure: 'park' }, [[200, 0], [300, 0], [300, 100], [200, 100]]),
    ]);
    assert.equal(cells[2 * 40 + 2], WATER);
    assert.equal(cells[2 * 40 + 22], WOODS);
    assert.equal(cells[20 * 40 + 20], LAND);
    assert.ok(stats.water > 0 && stats.woods > 0 && stats.land > 0.8);
  });

  test('keeps a narrow canal continuous and at least one tile wide', () => {
    const canal = {
      type: 'way', tags: { waterway: 'canal', width: '3' },
      geometry: [at(5, 150), at(395, 150)],
    };
    const { cells } = buildPreset(grid, [canal]);
    for (let column = 1; column < 39; column++) {
      assert.equal(cells[15 * 40 + column], WATER, `gap at column ${column}`);
    }
  });

  test('ignores waterways in tunnels', () => {
    const culvert = { type: 'way', tags: { waterway: 'stream', tunnel: 'culvert' }, geometry: [at(5, 150), at(395, 150)] };
    assert.equal(buildPreset(grid, [culvert]).stats.water, 0);
  });

  test('builds the sea from a coastline and reports that it reaches the edge', () => {
    const coastline = {
      type: 'way', tags: { natural: 'coastline' },
      geometry: [at(-50, 200), at(450, 200)],   // west → east, sea to the south
    };
    const result = buildPreset(grid, [coastline]);
    assert.equal(result.cells[28 * 40 + 20], WATER);
    assert.equal(result.cells[5 * 40 + 20], LAND);
    assert.equal(result.seaTouchesEdge, true);
  });
});
