/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Icons over plots held back for want of power, water or a road (src/render3d/city/problemIcons.ts).

import type { Points } from 'three';
import { ProblemIcons } from '../../src/render3d/city/problemIcons.js';
import { PLOT_WHY } from '../../src/plots.js';
import type { CityHeightField } from '../../src/render3d/city/heightfield.js';

describe('problem icons', () => {
  it('stand over each plot without power, water or a road, and follow the scan', () => {
    const plotWhy = new Uint8Array(4 * 3);
    plotWhy[1] = PLOT_WHY.indexOf('power'); plotWhy[5] = PLOT_WHY.indexOf('power'); plotWhy[6] = PLOT_WHY.indexOf('water');
    plotWhy[11] = PLOT_WHY.indexOf('land'); // said in words by the inspector, not drawn
    const map = { width: 4, height: 3, plotWhy };
    const icons = new ProblemIcons(map, { sample: () => 2 } as unknown as CityHeightField);
    icons.update(10);
    const count = (n: number) => ((icons.root.children[n] as Points).geometry.getAttribute('position')?.count ?? 0);
    expect([count(0), count(1), count(2)]).toEqual([2, 1, 0]);
    const at = (icons.root.children[1] as Points).geometry.getAttribute('position');
    expect([at.getX(0), at.getZ(0)]).toEqual([25, 15]);
    expect(at.getY(0)).toBeGreaterThan(2);
    // The power comes: the next refresh drops its icons
    plotWhy[1] = plotWhy[5] = 0;
    icons.update(11); expect(count(0)).toBe(2);
    icons.update(13); expect(count(0)).toBe(0);
    icons.dispose();
  });
});
