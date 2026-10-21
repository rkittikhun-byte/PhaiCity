/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The tools' outlines in the 3D view (src/render3d/city/overlay.ts ToolOutline) show no tile's square on a city map
// (owner, 21 Oct 2026: "ที่สังเกต ช่อง หรือ ตารางยังไม่หายไปเลย", of a red tile standing beside a road drawn past the ruler's
// house): what a line cannot build on is the stretch of the line over it, red, as wide as the road; a building it
// meets, or a one-tile tool points at, shows as the building's own turned outline.

import { BufferGeometry, Mesh } from 'three';
import { ToolOutline } from '../../src/render3d/city/overlay.js';
import type { ToolHover } from '../../src/cityView.js';

type Point = [number, number];

/** A turned building's lot round (125, 125), 30 units a side, turned 30° */
const turn = Math.PI / 6, lot: Point[] = [[-15, -15], [15, -15], [15, 15], [-15, 15]].map(([u, v]): Point =>
  [125 + Math.cos(turn) * u + Math.sin(turn) * v, 125 - Math.sin(turn) * u + Math.cos(turn) * v]);
/** Its tiles: 11–13 both ways */
const lotOf = (index: number): Point[] | null => {
  const x = index % 40, y = Math.floor(index / 40);
  return x >= 11 && x <= 13 && y >= 11 && y <= 13 ? lot : null;
};

function outline() {
  const tool = new ToolOutline(40, 40);
  tool.lotOf = lotOf;
  tool.scaledBuildings = true;
  return tool;
}

/** Every mesh it drew, with its triangles' corners (x, z) */
const meshes = (tool: ToolOutline): { order: number; points: Point[] }[] => {
  const out: { order: number; points: Point[] }[] = [];
  tool.root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const position = (o.geometry as BufferGeometry).getAttribute('position');
    const points: Point[] = [];
    for (let i = 0; i < position.count; i++) points.push([position.getX(i) + o.position.x, position.getZ(i) + o.position.z]);
    out.push({ order: o.renderOrder, points });
  });
  return out;
};

/** Whether a set of corners makes up whole tiles' squares, lying square on the map */
const tileSquares = (points: readonly Point[]): boolean => points.length > 0 && points.every(([x, z]) =>
  Math.abs(x / 10 - Math.round(x / 10)) < 0.02 && Math.abs(z / 10 - Math.round(z / 10)) < 0.02);

describe('the tools\' outlines on a city map', () => {
  test('a line over a tile it cannot build on shows the stretch of the line in red, as wide as the road, no square', () => {
    const tool = outline();
    // A road along row 5, across tile (8, 5), which is refused
    const path = Array.from({ length: 12 }, (_, x) => ({ x: x + 2, y: 5 }));
    tool.update({ tile: { x: 13, y: 5 }, size: 1, colour: '#ffffff', path, line: true, straight: true,
      blocked: [{ x: 8, y: 5 }], roadWidth: 4 } as ToolHover);
    const drawn = meshes(tool), red = drawn.filter((m) => m.order === 28);
    expect(red.length).toBe(1);
    expect(red[0].points.length).toBeGreaterThan(0);
    for (const [x, z] of red[0].points) {
      // ... on the road (half its width either side of row 5's middle) and about the refused tile
      expect(Math.abs(z - 55)).toBeLessThanOrEqual(2 + 1e-6);
      expect(x).toBeGreaterThan(70);
      expect(x).toBeLessThan(100);
    }
    // ... and nothing drawn as a tile's square
    for (const m of drawn) expect(tileSquares(m.points) && m.points.length <= 6).toBe(false);
  });

  test('a line meeting a turned building shows the building\'s turned outline and the stretch over it, never its tiles', () => {
    const tool = outline();
    const path = Array.from({ length: 20 }, (_, x) => ({ x: x + 2, y: 12 }));
    tool.update({ tile: { x: 21, y: 12 }, size: 1, colour: '#ffffff', path, line: true, straight: true,
      blocked: [{ x: 11, y: 12 }, { x: 12, y: 12 }, { x: 13, y: 12 }], roadWidth: 4 } as ToolHover);
    const drawn = meshes(tool);
    expect(drawn.some((m) => tileSquares(m.points))).toBe(false);
    const red = drawn.filter((m) => m.order === 28)[0];
    expect(red.points.length).toBeGreaterThan(0);
    // The lot's red reaches its turned corners
    const lotRed = drawn.filter((m) => m.order === 27).flatMap((m) => m.points);
    for (const [cx, cz] of lot) expect(lotRed.some(([x, z]) => Math.hypot(x - cx, z - cz) < 0.5)).toBe(true);
  });

  test('a one-tile tool pointing at a building shows the building\'s outline, turned with it', () => {
    const tool = outline();
    tool.update({ tile: { x: 12, y: 13 }, size: 1, colour: '#ffffff' } as ToolHover);
    const points = meshes(tool).flatMap((m) => m.points);
    expect(tileSquares(points)).toBe(false);
    for (const [cx, cz] of lot) expect(points.some(([x, z]) => Math.hypot(x - cx, z - cz) < 0.5)).toBe(true);
  });

  test('the bulldozer over a building shows the building, not its tiles', () => {
    const tool = outline();
    tool.update({ tile: { x: 12, y: 12 }, size: 1, colour: '#e0453a', path: [{ x: 11, y: 12 }, { x: 12, y: 12 }],
      doze: true } as ToolHover);
    const points = meshes(tool).flatMap((m) => m.points);
    expect(tileSquares(points)).toBe(false);
    for (const [cx, cz] of lot) expect(points.some(([x, z]) => Math.hypot(x - cx, z - cz) < 0.5)).toBe(true);
  });
});
