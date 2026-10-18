/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { junctionLayout, type JunctionApproach } from '../../src/render3d/city/roadJunctions.js';
import { halfWidth, type Point } from '../../src/roadGeometry.js';

function approaches(levels: number[], angles: number[], units: number | null = null, length = 160, curved = false): JunctionApproach[] {
  return angles.map((angle, i) => {
    const a = angle * Math.PI / 180, way: Point = [Math.cos(a), Math.sin(a)];
    const points: Point[] = [[0, 0]];
    for (let d = 2; d <= length; d += 2) {
      const bend = curved ? d * d * 0.0009 : 0;
      points.push([way[0] * d - way[1] * bend, way[1] * d + way[0] * bend]);
    }
    return { points, way, half: halfWidth(levels[i], units) };
  });
}

function verify(arms: JunctionApproach[], metre = 1): void {
  const { mouths, corners } = junctionLayout([0, 0], arms, metre);
  const boundary: Point[] = [];
  for (let i = 0; i < arms.length; i++) {
    const mouth = mouths[i], next = mouths[(i + 1) % arms.length], corner = corners[i];
    expect(mouth.distance).toBeGreaterThanOrEqual(0);
    expect(corner.points.every((p) => [...p.at, ...p.normal, p.fraction].every(Number.isFinite))).toBe(true);
    const left: Point = [mouth.at[0] + mouth.normal[0] * mouth.half, mouth.at[1] + mouth.normal[1] * mouth.half];
    const right: Point = [mouth.at[0] - mouth.normal[0] * mouth.half, mouth.at[1] - mouth.normal[1] * mouth.half];
    const nextRight: Point = [next.at[0] - next.normal[0] * next.half, next.at[1] - next.normal[1] * next.half];
    expect(Math.hypot(corner.points[0].at[0] - left[0], corner.points[0].at[1] - left[1])).toBeLessThan(1e-6);
    const last = corner.points[corner.points.length - 1];
    expect(Math.hypot(last.at[0] - nextRight[0], last.at[1] - nextRight[1])).toBeLessThan(1e-6);
    expect(corner.points[0].normal).toEqual(mouth.normal);
    boundary.push(right, left, ...corner.points.slice(1, -1).map((p) => p.at));
    if (corner.radius > 0.01) {
      const tangentA = corner.points[1], tangentB = corner.points[corner.points.length - 2];
      // At each tangent the radius is perpendicular to that approach's road direction, for
      // oblique intersections as well as 90 degrees. The old complementary-angle solver failed this.
      expect(Math.abs(tangentA.normal[0] * mouth.way[0] + tangentA.normal[1] * mouth.way[1])).toBeLessThan(1e-6);
      expect(Math.abs(tangentB.normal[0] * next.way[0] + tangentB.normal[1] * next.way[1])).toBeLessThan(1e-6);
      const centre = (p: typeof tangentA): Point => [p.at[0] + p.normal[0] * corner.radius, p.at[1] + p.normal[1] * corner.radius];
      const a = centre(tangentA), b = centre(tangentB);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-5);
    }
  }
  const cross = (a: Point, b: Point, c: Point): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < boundary.length; i++) for (let j = i + 2; j < boundary.length; j++) {
    if (i === 0 && j === boundary.length - 1) continue;
    const a = boundary[i], b = boundary[(i + 1) % boundary.length], c = boundary[j], d = boundary[(j + 1) % boundary.length];
    expect(cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8).toBe(false);
  }
}

describe('continuous junction layout', () => {
  for (const units of [null, 0.625]) for (let level = 1; level <= 8; level++) {
    for (const angles of [[0, 90, 180], [0, 90, 180, 270], [0, 62, 139, 213, 289]]) {
      test(`level ${level}, ${angles.length} arms, units ${units ?? 'legacy'}`, () => {
        verify(approaches(angles.map(() => level), angles, units), units ?? 1);
      });
    }
  }
  test('mixed widths and materials on a curved five-way intersection', () => {
    verify(approaches([1, 4, 8, 3, 2], [0, 62, 139, 213, 289], 0.625, 160, true), 0.625);
  });
  test('short approaches reduce corner radii without extending past the mouths', () => {
    verify(approaches([3, 5, 2], [0, 90, 210], null, 22));
  });
  test('acute laterite turn retains tangent corners without sharp protrusions', () => {
    verify(approaches([1, 1, 1], [0, 42, 205]));
  });
});
