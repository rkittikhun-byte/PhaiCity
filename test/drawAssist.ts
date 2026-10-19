/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { COMFORT, EDGE_PX, edgeVelocity, focusDrawPoint, outsideComfort, setDrawingLine } from '../src/drawAssist.js';

describe('drawing help (src/drawAssist.ts)', () => {
  it('recentres only on a point clicked near an edge or behind the cards', () => {
    expect(outsideComfort(500, 300, 1000, 800)).toBe(false);
    expect(outsideComfort(500, 800 * COMFORT.bottom + 10, 1000, 800)).toBe(true);
    expect(outsideComfort(40, 300, 1000, 800)).toBe(true);
    expect(outsideComfort(990, 300, 1000, 800)).toBe(true);
    expect(outsideComfort(500, 20, 1000, 800)).toBe(true);
    const calls: Array<[number, number]> = [];
    const view = { centreOn: (x: number, y: number) => { calls.push([x, y]); } };
    const canvas = { clientWidth: 1000, clientHeight: 800 };
    expect(focusDrawPoint(view, 12, 34, 500, 300, canvas)).toBe(false);
    expect(focusDrawPoint(view, 12, 34, 500, 760, canvas)).toBe(true);
    expect(calls).toEqual([[12, 34]]);
  });

  it('slides the map away from the edge the mouse rests on, faster the closer it is', () => {
    expect(edgeVelocity(500, 400, 1000, 800)).toEqual({ dx: 0, dy: 0 });
    const right = edgeVelocity(999, 400, 1000, 800);
    expect(right.dx).toBeLessThan(0);
    expect(right.dy).toBe(0);
    const top = edgeVelocity(500, 1, 1000, 800);
    expect(top.dy).toBeGreaterThan(0);
    const nearer = edgeVelocity(5, 400, 1000, 800).dx;
    const farther = edgeVelocity(EDGE_PX - 5, 400, 1000, 800).dx;
    expect(nearer).toBeGreaterThan(farther);
    expect(edgeVelocity(EDGE_PX + 1, 400, 1000, 800).dx).toBe(0);
  });

  it('marks the page while a line is half drawn', () => {
    const list = new Set<string>();
    const doc = { body: { classList: { toggle: (name: string, on: boolean) => { if (on) list.add(name); else list.delete(name); } } } };
    setDrawingLine(true, doc as unknown as Document);
    expect(list.has('drawingLine')).toBe(true);
    setDrawingLine(false, doc as unknown as Document);
    expect(list.has('drawingLine')).toBe(false);
  });
});
