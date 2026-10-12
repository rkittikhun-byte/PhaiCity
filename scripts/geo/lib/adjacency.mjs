/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Which provinces share a land border, read from the TopoJSON province shapes: in a topology two shapes that touch
// share an arc, so a shared arc is a shared border. Used to check the hand-made neighbour lists.

/** Arc indices of a Polygon or MultiPolygon geometry (a reversed arc ~i is arc i). */
export function arcsOf(geometry) {
  const rings = geometry.type === 'Polygon' ? geometry.arcs
    : geometry.type === 'MultiPolygon' ? geometry.arcs.flat()
      : [];
  return new Set(rings.flat().map((index) => (index < 0 ? ~index : index)));
}

/** { id: Set of ids sharing at least one arc } for every geometry with an id. */
export function sharedBorders(geometries, idOf = (g) => g.properties?.id ?? g.id) {
  const users = new Map();
  for (const geometry of geometries) {
    const id = idOf(geometry);
    if (!id) continue;
    for (const arc of arcsOf(geometry)) {
      if (!users.has(arc)) users.set(arc, new Set());
      users.get(arc).add(id);
    }
  }
  const borders = new Map(geometries.map((g) => [idOf(g), new Set()]).filter(([id]) => id));
  for (const ids of users.values()) {
    for (const a of ids) for (const b of ids) if (a !== b) borders.get(a).add(b);
  }
  return borders;
}

/**
 * Differences between listed neighbours and shared borders, each pair once (a < b):
 * missing = border on the map but not listed, extra = listed but no border on the map.
 * Known cases are reported separately as expected: `listedWithoutBorder` (neighbours the shapes don't show, e.g. a
 * bridge to an island, or a border too short for simplified shapes) and `falseBorders` (shapes that touch although
 * the provinces don't).
 */
export function compareNeighbors(listed, borders, { listedWithoutBorder = [], falseBorders = [] } = {}) {
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const knownListed = new Set(listedWithoutBorder.map(([a, b]) => key(a, b)));
  const knownFalse = new Set(falseBorders.map(([a, b]) => key(a, b)));
  const listedPairs = new Set();
  for (const [id, neighbors] of listed) for (const other of neighbors) listedPairs.add(key(id, other));
  const borderPairs = new Set();
  for (const [id, others] of borders) for (const other of others) borderPairs.add(key(id, other));
  const split = (pair) => pair.split('|');
  const unlisted = [...borderPairs].filter((pair) => !listedPairs.has(pair));
  const unbordered = [...listedPairs].filter((pair) => !borderPairs.has(pair));
  return {
    missing: unlisted.filter((pair) => !knownFalse.has(pair)).sort().map(split),
    extra: unbordered.filter((pair) => !knownListed.has(pair)).sort().map(split),
    expected: [...unbordered.filter((pair) => knownListed.has(pair)), ...unlisted.filter((pair) => knownFalse.has(pair))]
      .sort().map(split),
  };
}
