/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A city map's real streets (docs/GAME_PLAN.md decision 17, phase 1): every street of OpenStreetMap laid on the
// tiles by the same routing the railways use (routing.mjs: along the real line, over water on straight bridges,
// over railways on straight level crossings), biggest first, so a small street joins a big one rather than pushing it
// aside; then the two-tile-wide clumps thinned. Each road tile gets its level (src/roadLevels.ts, 1 laterite …
// 8 tollway) from its street's class and lanes, and the name of the biggest street through it.

import { STREET_CLASSES } from './dbLayers.mjs';
import { anchorTile, clipLine, layPath, ROAD, route, thinBlocks } from './routing.mjs';

/** A street's road level (src/roadLevels.ts) from its class and lanes */
export function streetLevel(tags) {
  const base = String(tags.highway ?? '').replace(/_link$/, '');
  const lanes = Number.parseInt(tags.lanes ?? '', 10) || 0;
  switch (base) {
    case 'motorway': return tags.toll === 'yes' ? 8 : 7;
    case 'trunk': return lanes >= 8 ? 6 : lanes >= 6 ? 5 : 4;
    case 'primary': return lanes >= 6 ? 5 : lanes >= 4 ? 4 : 3;
    case 'secondary':
    case 'tertiary': return lanes >= 4 ? 4 : 3;
    default: return 2; // unclassified, residential and living streets: asphalt
  }
}

/** Biggest first: the class's place in STREET_CLASSES, a slip road with its main road */
const rankOf = (tags) => {
  const at = STREET_CLASSES.indexOf(String(tags.highway ?? '').replace(/_link$/, ''));
  return at < 0 ? STREET_CLASSES.length : at;
};

/**
 * Lays the streets on the network. Returns each tile's road level (0: no road), the index of its street's name in
 * names (0: none), and how many streets were laid or could not be.
 * @param classes the street classes to lay (STREET_CLASSES by default)
 */
export function layStreets(net, streets, toTiles, { classes = STREET_CLASSES } = {}) {
  const { width, height } = net;
  const levels = new Uint8Array(width * height);
  const nameAt = new Uint16Array(width * height);
  const names = [{ th: '', en: '' }];
  const nameIds = new Map();
  const nameId = (tags) => {
    if (!tags.name) return 0;
    if (!nameIds.has(tags.name)) { nameIds.set(tags.name, names.length); names.push({ th: tags.name, en: tags['name:en'] ?? '' }); }
    return nameIds.get(tags.name);
  };
  const wanted = new Set(classes);
  const ways = streets
    .filter((e) => e.type === 'way' && e.points.length >= 4 && wanted.has(String(e.tags.highway).replace(/_link$/, '')))
    .map((e) => {
      const points = [];
      for (let i = 0; i + 1 < e.points.length; i += 2) points.push(toTiles(e.points[i], e.points[i + 1]));
      let length = 0;
      for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      return { tags: e.tags, points, length, rank: rankOf(e.tags), level: streetLevel(e.tags), name: nameId(e.tags) };
    })
    .sort((a, b) => a.rank - b.rank || b.length - a.length);
  let laid = 0, failed = 0;
  for (const way of ways) {
    for (const part of clipLine(way.points, width, height)) {
      const a = part.points[0], b = part.points[part.points.length - 1];
      const start = anchorTile(net, 'road', Math.floor(a[0]), Math.floor(a[1]));
      const goal = anchorTile(net, 'road', Math.floor(b[0]), Math.floor(b[1]));
      const path = route(net, 'road', part.points, start, goal);
      if (!path) { failed++; continue; }
      layPath(net, 'road', path);
      laid++;
      for (const tile of path) {
        if (way.level > levels[tile]) levels[tile] = way.level;
        if (!nameAt[tile] && way.name) nameAt[tile] = way.name;
      }
    }
  }
  thinBlocks(net, 'road');
  for (let i = 0; i < levels.length; i++) {
    if (!(net.transport[i] & ROAD)) { levels[i] = 0; nameAt[i] = 0; }
  }
  return { levels, nameAt, names, laid, failed };
}
