/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The districts a city can start in (scripts/geo/districts.mjs, data/maps/district/): their ids, and that every
// listed district has a map of its own that the game can load.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { districtSlug } from '../../scripts/geo/districts.mjs';
import { MAPS_DIR, readJson } from '../../scripts/geo/lib/common.mjs';

test('a district id is its English name, plain', () => {
  assert.equal(districtSlug('Mueang Khon Kaen District'), 'mueang-khon-kaen');
  assert.equal(districtSlug('Phu Pha Man District'), 'phu-pha-man');
  assert.equal(districtSlug('Ban Haet'), 'ban-haet');
});

test('every listed district has a city map of the province it says, centred on its town', () => {
  const indexFile = path.join(MAPS_DIR, 'district', 'index.json');
  if (!fs.existsSync(indexFile)) return;
  const index = readJson(indexFile);
  for (const [provinceId, districts] of Object.entries(index)) {
    assert.ok(districts.length > 0, provinceId);
    assert.equal(new Set(districts.map((d) => d.id)).size, districts.length, `${provinceId} ids are unique`);
    for (const district of districts) {
      assert.ok(district.id.startsWith(`${provinceId}-`), district.id);
      const map = readJson(path.join(MAPS_DIR, 'district', `${district.id}.json`));
      assert.equal(map.provinceId, provinceId);
      assert.equal(map.districtId, district.id);
      assert.equal(map.scale, 'city');
      assert.equal(map.tileSizeM, 16);
      assert.ok(map.town && map.town.x >= 0 && map.town.x < map.width && map.town.y >= 0 && map.town.y < map.height,
        `${district.id} has its town on the map`);
    }
  }
  // Khon Kaen first: its own town's district leads the list
  if (index['TH-40']) assert.equal(index['TH-40'][0].id, 'TH-40-mueang-khon-kaen');
});
