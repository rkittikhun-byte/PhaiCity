/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The roads' smooth lines (src/roadGeometry.ts): stretches between junctions, and a knot of junction tiles side by
// side drawn as one junction, not a ring of little roads.

import { nearestOnLines, networkOf, roadLines, smoothLine } from "../src/roadGeometry";

function roads(tiles: Array<[number, number]>, width = 30, height = 30) {
  const values = new Uint16Array(width * height);
  for (const [x, y] of tiles) values[y * width + x] = 66;
  return networkOf({ width, height, value: (i) => values[i], level: () => 1 }, false);
}

describe("road geometry", () => {
  test("at a junction the straightest two roads are one road running through, and the other ends on its middle", () => {
    // A road west to east along row 15, and one from the north ending on it at (15, 15)
    const tiles: Array<[number, number]> = [];
    for (let x = 2; x < 28; x++) tiles.push([x, 15]);
    for (let y = 3; y < 15; y++) tiles.push([15, y]);
    const { lines, junctions } = roadLines(roads(tiles));
    expect(lines).toHaveLength(2);
    const [junction] = junctions;
    expect(junction.through).not.toBeNull();
    const through = lines[junction.through!], branch = lines.find(l => l !== through)!;
    // The through road is one straight line from end to end
    expect(through.points[0][0]).toBeCloseTo(25);
    expect(through.points[through.points.length - 1][0]).toBeCloseTo(275);
    for (const [, z] of through.points) expect(z).toBeCloseTo(155);
    // The other ends on its middle, and the junction's roads go west, north and east, round it
    const ends = [branch.points[0], branch.points[branch.points.length - 1]];
    expect(ends.some(([x, z]) => Math.hypot(x - junction.at[0], z - junction.at[1]) < 0.01)).toBe(true);
    expect(junction.arms.map(a => [Math.round(a.way[0]), Math.round(a.way[1])])).toEqual([[-1, 0], [0, -1], [1, 0]].sort((a, b) =>
      Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])));
    expect(junction.arms.filter(a => a.end === null)).toHaveLength(2);
  });

  test("a stretch's ends follow its own way, not its last stairstep", () => {
    // Two along, one down, ending at a dead end: the line's last piece still heads along the slant
    const tiles: Array<[number, number]> = [];
    let x = 2, y = 2;
    for (let step = 0; step < 8; step++) for (const [dx, dy] of [[1, 0], [1, 0], [0, 1]]) { tiles.push([x, y]); x += dx; y += dy; }
    const line = smoothLine(roads(tiles).stretches[0].points), n = line.length;
    const heading = Math.atan2(line[n - 1][1] - line[n - 4][1], line[n - 1][0] - line[n - 4][0]);
    expect(Math.abs(heading - Math.atan2(1, 2))).toBeLessThan(0.25);
  });

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

  test("connecting a side road does not shift or break an existing curved road", () => {
    // An existing curved road connected orthogonally
    const curveTiles: Array<[number, number]> = [];
    for (let x = 2; x <= 8; x++) curveTiles.push([x, 5]);
    let cx = 8, cy = 5;
    for (let step = 0; step < 5; step++) {
      cy++; curveTiles.push([cx, cy]);
      cx++; curveTiles.push([cx, cy]);
    }
    for (let y = cy + 1; y <= 20; y++) curveTiles.push([cx, y]);

    const before = roadLines(roads(curveTiles));
    expect(before.lines).toHaveLength(1);
    const beforePoints = before.lines[0].points;

    // Attach a side road to the curve at (cx, 15)
    const withBranch = [...curveTiles];
    for (let x = cx + 1; x <= cx + 6; x++) withBranch.push([x, 15]);

    const after = roadLines(roads(withBranch));
    // The curve must be preserved as the through road
    expect(after.junctions).toHaveLength(1);
    expect(after.junctions[0].through).not.toBeNull();
    const throughRoad = after.lines[after.junctions[0].through!];
    // Through road points must match the original curve's points
    expect(throughRoad.points).toHaveLength(beforePoints.length);
    for (let i = 0; i < beforePoints.length; i++) {
      expect(throughRoad.points[i][0]).toBeCloseTo(beforePoints[i][0], 1);
      expect(throughRoad.points[i][1]).toBeCloseTo(beforePoints[i][1], 1);
    }
  });
});
