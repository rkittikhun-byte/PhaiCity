/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads' smooth lines (src/roadGeometry.ts): stretches between junctions, and a knot of junction tiles side by
// side drawn as one junction, not a ring of little roads.

import { nearestOnLines, networkOf, smoothLine } from "../src/roadGeometry";

function roads(tiles: Array<[number, number]>, width = 30, height = 30) {
  const values = new Uint16Array(width * height);
  for (const [x, y] of tiles) values[y * width + x] = 66;
  return networkOf({ width, height, value: (i) => values[i], level: () => 1 }, false);
}

describe("road geometry", () => {
  test("a crossing is four stretches meeting at one junction; dead ends get a rounded end", () => {
    const tiles: Array<[number, number]> = [];
    for (let i = 5; i < 25; i++) tiles.push([i, 15], [15, i]);
    const network = roads(tiles);
    expect(network.junctions.filter(([x, z]) => Math.hypot(x - 155, z - 155) < 1)).toHaveLength(1);
    expect(network.plates).toHaveLength(4);
    expect(network.stretches.filter(s => s.points.length > 2)).toHaveLength(4);
  });

  test("a road laid beside another at the junction makes one junction, not a knot of little roads", () => {
    const tiles: Array<[number, number]> = [];
    for (let x = 2; x < 28; x++) tiles.push([x, 15]);
    // A new road from the north that runs down beside the old one before joining: a 2 x 2 block of road tiles
    for (let y = 3; y <= 16; y++) tiles.push([14, y]);
    tiles.push([15, 16], [15, 14], [14, 14]);
    const network = roads(tiles);
    const near = network.junctions.filter(([x, z]) => Math.hypot(x - 150, z - 155) < 20);
    expect(near).toHaveLength(1);
    // No stretch lies wholly inside the knot
    for (const stretch of network.stretches) {
      const inside = stretch.points.every(([x, z]) => Math.hypot(x - near[0][0], z - near[0][1]) < 15);
      expect(inside).toBe(false);
    }
  });

  test("a point near a road's line snaps onto it", () => {
    const tiles: Array<[number, number]> = [];
    for (let x = 2; x < 28; x++) tiles.push([x, 10]);
    const lines = roads(tiles).stretches.map(s => smoothLine(s.points));
    expect(nearestOnLines(lines, 100, 108, 10)).toEqual([100, 105]);
    expect(nearestOnLines(lines, 100, 130, 10)).toBeNull();
  });
});
