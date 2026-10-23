/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The tools' outlines in the 3D view (src/render3d/city/overlay.ts ToolOutline) show no tile's square on a city map
// (owner, 21 Oct 2026: "ที่สังเกต ช่อง หรือ ตารางยังไม่หายไปเลย", of a red tile standing beside a road drawn past the ruler's
// house): what a line cannot build on is the stretch of the line over it, red, as wide as the road; a building it
// meets, or a one-tile tool points at, shows as the building's own turned outline.

import { BufferGeometry, Mesh, Vector3 } from 'three';
import { longRuns, roadEdges, stretchSteps, ToolOutline } from '../../src/render3d/city/overlay.js';
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

  test('where a click of a road tool lands is marked in a look of its own for each thing it lands on', () => {
    // Every mesh's corners where they lie on the ground, turned as the mesh is
    const placed = (tool: ToolOutline): { vertices: number; points: Point[] }[] => {
      const out: { vertices: number; points: Point[] }[] = [];
      tool.root.updateMatrixWorld(true);
      tool.root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const position = (o.geometry as BufferGeometry).getAttribute('position'), points: Point[] = [];
        for (let i = 0; i < position.count; i++) {
          const v = new Vector3(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(o.matrixWorld);
          points.push([v.x, v.z]);
        }
        out.push({ vertices: position.count, points });
      });
      return out;
    };
    // A road running east along row 7 (z = 75), the click landing at x = 103 on it
    const look = (snapKind: string | null, extra: Partial<ToolHover> = {}) => {
      const tool = outline();
      tool.update({ tile: { x: 10, y: 7 }, size: 1, colour: '#4a4f52', linePoint: { x: 10.3, y: 7.5 }, roadWidth: 7,
        tilePixels: 32, snapKind, snapWay: { x: 1, y: 0 }, ...extra } as ToolHover);
      return placed(tool);
    };
    const kinds = [null, 'node', 'end', 'mark', 'road', 'guide'];
    const shapes = kinds.map((kind) => look(kind, kind === 'guide' ? { snapGuide: [{ x: 6, y: 7.5 }, { x: 14, y: 7.5 }] } : {}));
    const signature = (drawn: { vertices: number }[]): string => drawn.map((m) => m.vertices).join(',');
    expect(new Set(shapes.map(signature)).size).toBe(kinds.length);
    // A junction is a diamond, its corners out along the map's axes from where it lands
    const node = shapes[1].flatMap((m) => m.points).filter(([x, z]) => Math.hypot(x - 103, z - 75) > 1);
    expect(node.every(([x, z]) => Math.abs(x - 103) < 0.01 || Math.abs(z - 75) < 0.01)).toBe(true);
    // The road's middle line: a bar across the road (north–south here), wider than the road and thin along it
    const bar = shapes[4].map((m) => m.points).find((points) => {
      const zs = points.map(([, z]) => z), xs = points.map(([x]) => x);
      return Math.max(...zs) - Math.min(...zs) > 7 && Math.max(...xs) - Math.min(...xs) < 1.5;
    });
    expect(bar).toBeDefined();
    // A guideline: dashes along it, from one end of its stretch to the other
    const dashes = shapes[5].filter((m) => m.points.every(([, z]) => Math.abs(z - 75) < 0.2));
    expect(dashes.length).toBeGreaterThan(5);
    const xs = dashes.flatMap((m) => m.points.map(([x]) => x));
    expect(Math.min(...xs)).toBeLessThan(65);
    expect(Math.max(...xs)).toBeGreaterThan(135);
  });

  describe('the inspector', () => {
    // Owner, 22 Oct 2026: "ที่เปล่าๆ คลิกได้เป็นตาราง แนวเฉียง คืออะไร ไหนบอกว่าไม่มีตารางแล้ว ... ทุก object พอคลิกแล้วจะต้องได้ rect
    // เหมือนตอนวาง"
    test('plain ground: a soft round mark at the very point, no tile', () => {
      const tool = outline();
      tool.update({ tile: { x: 30, y: 30 }, size: 1, colour: '#8fdcff', inspect: { x: 30.3, y: 30.8 } } as ToolHover);
      const points = meshes(tool).flatMap((m) => m.points);
      expect(points.length).toBeGreaterThan(0);
      expect(tileSquares(points)).toBe(false);
      // ... round the point, about 6 m across (4 world units a side of it at most)
      for (const [x, z] of points) expect(Math.hypot(x - 303, z - 308)).toBeLessThan(4);
    });

    test('an object: its own ground as drawn and turned, edged in white, as when it was put down', () => {
      const tool = outline();
      tool.objectOf = (index) => lotOf(index);
      tool.update({ tile: { x: 12, y: 13 }, size: 1, colour: '#8fdcff', inspect: { x: 12.4, y: 13.6 } } as ToolHover);
      const drawn = meshes(tool), points = drawn.flatMap((m) => m.points);
      expect(tileSquares(points)).toBe(false);
      for (const [cx, cz] of lot) expect(points.some(([x, z]) => Math.hypot(x - cx, z - cz) < 0.5)).toBe(true);
      expect(drawn.length).toBe(2);
    });

    test('a road: the stretch of it drawn on its tiles, and the whole stretch the card shows once opened', () => {
      const tool = outline(), asked: number[][] = [];
      tool.roadStrips = (tiles) => {
        asked.push([...tiles]);
        return { quads: [...tiles].map((i): Point[] => { const x = (i % 40) * 10, z = Math.floor(i / 40) * 10 + 5;
          return [[x, z - 2], [x + 10, z - 2], [x + 10, z + 2], [x, z + 2]]; }), covered: new Set(tiles) };
      };
      tool.update({ tile: { x: 5, y: 20 }, size: 1, colour: '#8fdcff', inspect: { x: 5.5, y: 20.5 },
        inspectPath: [{ x: 4, y: 20 }, { x: 5, y: 20 }, { x: 6, y: 20 }] } as ToolHover);
      expect(asked).toEqual([[804, 805, 806]]);
      const points = meshes(tool).flatMap((m) => m.points);
      for (const [, z] of points) expect(Math.abs(z - 205)).toBeLessThanOrEqual(2 + 1e-6);
      // edged in white along both sides, no pale patch over the road's middle (playtest, 23 Oct 2026)
      expect(points.some(([, z]) => Math.abs(z - 205) < 1.5)).toBe(false);
      expect(points.some(([, z]) => z < 204) && points.some(([, z]) => z > 206)).toBe(true);
    });

    test('a card of the land a drawn road passes marks the point, not the road', () => {
      const tool = outline();
      let asked = 0;
      tool.roadStrips = () => { asked++; return { quads: [[[0, 0], [10, 0], [10, 4], [0, 4]]], covered: new Set([0]) }; };
      tool.update({ tile: { x: 5, y: 20 }, size: 1, colour: '#8fdcff', inspect: { x: 5.5, y: 20.5 }, inspectRoad: false } as ToolHover);
      expect(asked).toBe(0);
      for (const [x, z] of meshes(tool).flatMap((m) => m.points)) expect(Math.hypot(x - 55, z - 205)).toBeLessThan(4);
    });

    test("a slanted road's stretch is one band: gaps of a tile and a half between steps on its tiles are taken", () => {
      expect(stretchSteps([true, false, false, true, false], 2)).toEqual([true, true, true, true, false]);
      expect(stretchSteps([true, false, false, false, true], 2)).toEqual([true, false, false, false, true]);
      expect(stretchSteps([false, true, false], 5)).toEqual([false, true, false]);
      // a crossing road's few steps on the junction's tile are left out when the stretch has a long run; a short stretch stays
      expect(longRuns([[true, true, true, true], [false, true, false]], 3)).toEqual([[true, true, true, true], [false, false, false]]);
      expect(longRuns([[true, false], [false, true]], 3)).toEqual([[true, false], [false, true]]);
      const edges = roadEdges([[[0, -2], [10, -2], [10, 2], [0, 2]]], 0.35);
      expect(edges).toHaveLength(2);
      for (const strip of edges) for (const [, z] of strip) expect(Math.abs(z)).toBeGreaterThanOrEqual(2 - 0.35 - 1e-9);
    });
  });
});
