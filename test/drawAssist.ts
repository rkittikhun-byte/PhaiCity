/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { COMFORT, focusDrawPoint, outsideComfort, setDrawingLine } from '../src/drawAssist.js';

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

  it('marks the page while a line is half drawn', () => {
    const list = new Set<string>();
    const doc = { body: { classList: { toggle: (name: string, on: boolean) => { if (on) list.add(name); else list.delete(name); } } } };
    setDrawingLine(true, doc as unknown as Document);
    expect(list.has('drawingLine')).toBe(true);
    setDrawingLine(false, doc as unknown as Document);
    expect(list.has('drawingLine')).toBe(false);
  });
});
