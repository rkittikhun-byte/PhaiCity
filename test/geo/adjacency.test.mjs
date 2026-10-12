/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arcsOf, compareNeighbors, sharedBorders } from '../../scripts/geo/lib/adjacency.mjs';
import { NATIONAL_TOPO_FILE, PROVINCES_FILE, readJson } from '../../scripts/geo/lib/common.mjs';

// Three squares in a row, A | B | C, sharing arcs 1 (A–B) and 2 (B–C); D is an island
const geometries = [
  { type: 'Polygon', properties: { id: 'A' }, arcs: [[0, 1]] },
  { type: 'Polygon', properties: { id: 'B' }, arcs: [[~1, 3, 2, 4]] },
  { type: 'MultiPolygon', properties: { id: 'C' }, arcs: [[[~2, 5]], [[6]]] },
  { type: 'Polygon', properties: { id: 'D' }, arcs: [[7]] },
];

test('arcsOf reads reversed arcs and multipolygons', () => {
  assert.deepEqual([...arcsOf(geometries[1])].sort(), [1, 2, 3, 4]);
  assert.deepEqual([...arcsOf(geometries[2])].sort(), [2, 5, 6]);
});

test('provinces sharing an arc share a border', () => {
  const borders = sharedBorders(geometries);
  assert.deepEqual([...borders.get('A')], ['B']);
  assert.deepEqual([...borders.get('B')].sort(), ['A', 'C']);
  assert.deepEqual([...borders.get('D')], []);
});

test('compareNeighbors reports each difference once, and known cases apart', () => {
  const listed = new Map([['A', ['B', 'C']], ['B', ['A']], ['C', ['A', 'D']], ['D', ['C']]]);
  const result = compareNeighbors(listed, sharedBorders(geometries), { listedWithoutBorder: [['D', 'C']] });
  assert.deepEqual(result.missing, [['B', 'C']]);
  assert.deepEqual(result.extra, [['A', 'C']]);
  assert.deepEqual(result.expected, [['C', 'D']]);
  const knownFalse = compareNeighbors(listed, sharedBorders(geometries), { falseBorders: [['C', 'B']] });
  assert.deepEqual(knownFalse.missing, []);
});

test('the neighbour lists agree with the province shapes, apart from the checked cases', () => {
  const { provinces } = readJson(PROVINCES_FILE);
  const topology = readJson(NATIONAL_TOPO_FILE);
  const listed = new Map(provinces.map((p) => [p.id, p.neighbors]));
  const result = compareNeighbors(listed, sharedBorders(Object.values(topology.objects)[0].geometries), {
    listedWithoutBorder: [['TH-83', 'TH-82'], ['TH-16', 'TH-36'], ['TH-91', 'TH-93']],
    falseBorders: [['TH-90', 'TH-92']],
  });
  assert.deepEqual({ missing: result.missing, extra: result.extra }, { missing: [], extra: [] });
  // Every list is two-way
  for (const p of provinces) {
    for (const other of p.neighbors) assert.ok(listed.get(other)?.includes(p.id), `${p.id} lists ${other}, not the other way`);
  }
});
