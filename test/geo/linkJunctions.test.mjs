/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run with: npm run test:geo
// A district's roads where they meet (scripts/geo/lib/linkJunctions.mjs, owner 15 Oct 2026): twins laid once, a spoke
// beside a road leaving from it, close junctions made one and sharp ones squared.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { JUNCTION_MERGE_M, pointKey, SQUARE_RUN_M, tidyJunctions } from '../../scripts/geo/lib/linkJunctions.mjs';

const TILE_M = 16;
const town = [100.5, 100.5];
/** The distinct points the lines meet at: points shared by lines that part there */
function junctions(lines) {
  const next = new Map();
  for (const points of lines) for (let i = 1; i < points.length; i++) {
    for (const [a, b] of [[points[i - 1], points[i]], [points[i], points[i - 1]]]) {
      if (!next.has(pointKey(a))) next.set(pointKey(a), new Set());
      next.get(pointKey(a)).add(pointKey(b));
    }
  }
  return [...next].filter(([, others]) => others.size >= 3).map(([k]) => k.split(',').map(Number));
}

describe('district road junctions', () => {
  test('two junctions closer than 100 m along a road become one', () => {
    // A road east from the town; two roads leave it north 3 tiles (48 m) apart
    const main = [town, [130.5, 100.5], [133.5, 100.5], [200.5, 100.5]];
    const lines = tidyJunctions([main, [town, [130.5, 100.5], [130.5, 40.5]], [town, [130.5, 100.5], [133.5, 100.5], [133.5, 40.5]]], town, TILE_M);
    const found = junctions(lines);
    assert.equal(found.length, 1);
    assert.ok(3 * TILE_M < JUNCTION_MERGE_M);
  });

  test('a road leaving a through road at a sharp angle leaves it square and runs straight 50 m first', () => {
    // East along y = 100, a road off it at about 20 degrees towards the north-east
    const main = [town, [130.5, 100.5], [200.5, 100.5]];
    const branch = [town, [130.5, 100.5], [190.5, 78.5], [200.5, 60.5]];
    const [, out] = tidyJunctions([main, branch], town, TILE_M);
    const run = SQUARE_RUN_M / TILE_M;
    assert.deepEqual(out[2], [130.5, 100.5 - run]);
    // and on from there to where it was going
    assert.deepEqual(out[out.length - 1], [200.5, 60.5]);
  });

  test('two lines a few metres apart are one road, laid once', () => {
    const one = [town, [140.5, 100.5], [180.5, 100.5], [220.5, 100.5]];
    // The other carriageway, 1.5 tiles (24 m) beside it, then off to the south
    const two = [town, [140.5, 102], [180.5, 102], [220.5, 160.5]];
    const [first, second] = tidyJunctions([one, two], town, TILE_M);
    assert.deepEqual(first, one);
    assert.deepEqual(second.slice(0, 3), one.slice(0, 3));
    assert.deepEqual(second[second.length - 1], [220.5, 160.5]);
  });

  test('a long spoke leaving the town beside a real road leaves from that road a little past 100 m out', () => {
    // A real road west from the town, its first point 4 tiles out; a straight spoke 60 tiles off at 15 degrees
    const road = [town, [96.5, 100.5], [90.5, 100.8], [80.5, 101], [40.5, 102]];
    const spoke = [town, [100.5 - 58, 100.5 + 15.5], [20.5, 130.5]];
    const [, out] = tidyJunctions([road, spoke], town, TILE_M);
    // It runs along the road to its first point at least 125 m (7.8 tiles) out, 10 tiles, then leaves it square
    assert.deepEqual(out.slice(0, 3), road.slice(0, 3));
    assert.deepEqual(junctions([road, out]), [[90.5, 100.8]]);
    assert.ok(out[3][1] - 100.8 > 3 && Math.abs(out[3][0] - 90.5) < 0.5);
  });

  test('lines meeting nowhere near each other are left as they were', () => {
    const north = [town, [100.5, 60.5], [100.5, 0.5]], east = [town, [140.5, 100.5], [199.5, 100.5]];
    assert.deepEqual(tidyJunctions([north, east], town, TILE_M), [north, east]);
  });
});
