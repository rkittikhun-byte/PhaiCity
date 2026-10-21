/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Mines in the city view (RENDERER_SPEC 6E): until prompt M1 gives them their own models, each kind of src/mining.ts
// borrows an industrial one by gameMap.mineKinds, so an oil well and a quarry no longer look the same.

import { registry } from '../../src/render3d/models/registry.js';
import { MINE_STAND_INS, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { MINE_KINDS } from '../../src/mining.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { MINE } from '../../src/tileValues.js';

describe('mines in the city view', () => {
  const W = 20, centre = 10 * W + 10;
  function placed(kinds: Record<string, string> | null): string | null {
    const values = new Uint16Array(W * W), flags = new Uint16Array(W * W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values[(10 + dy) * W + 10 + dx] = MINE - 4 + (dy + 1) * 3 + dx + 1;
    flags[centre] = ZONEBIT | POWERBIT;
    const map = { width: W, height: W, getTileValue: (x: number, y: number) => values[y * W + x],
      getTileFlags: (x: number, y: number) => flags[y * W + x], mineKinds: kinds };
    const snapshot = new TileSnapshot(W, W); snapshot.source = map; snapshot.sync(map);
    return snapshot.placement(centre, 'northeast')!.id;
  }

  it('gives every kind the game digs a registered stand-in, picked by mineKinds at the centre', () => {
    for (const kind of MINE_KINDS) {
      expect(registry[MINE_STAND_INS[kind]]).toBeDefined();
      expect([kind, placed({ [centre]: kind })]).toEqual([kind, MINE_STAND_INS[kind]]);
    }
  });

  it('draws an oil well, a gem field and a quarry differently', () => {
    const oil = placed({ [centre]: 'petroleum' }), gems = placed({ [centre]: 'gems' }), quarry = placed({ [centre]: 'limestone' });
    expect(new Set([oil, gems, quarry]).size).toBe(3);
  });

  it('takes a mine without a record, or a map without the record, for limestone', () => {
    expect(placed({})).toBe(MINE_STAND_INS.limestone);
    expect(placed(null)).toBe(MINE_STAND_INS.limestone);
  });
});
