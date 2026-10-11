/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Pure geometry helpers for the geo pipeline. No I/O, so they can be unit-tested directly.

const toRadians = (degrees) => degrees * Math.PI / 180;
const toDegrees = (radians) => radians * 180 / Math.PI;

// Initial great-circle bearing from `from` to `to`, in degrees clockwise from north, in [0, 360).
export function bearingDegrees(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

// GEO_SPEC section 8: N = 315–45, E = 45–135, S = 135–225, W = 225–315 (lower bound inclusive).
export function edgeForBearing(bearing) {
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 315 || b < 45) return 'N';
  if (b < 135) return 'E';
  if (b < 225) return 'S';
  return 'W';
}

// Positions along an edge run west→east on N and S edges, and north→south on E and W edges.
// This key orders bearings within one edge along that direction.
function positionKey(edge, bearing) {
  switch (edge) {
    case 'N': return (bearing - 315 + 360) % 360;   // NW (315) … N … NE (45)
    case 'E': return bearing;                       // NE (45) … SE (135)
    case 'S': return -bearing;                      // SW (225) … SE (135)
    case 'W': return -bearing;                      // NW (315) … SW (225)
    default: throw new Error(`Unknown edge ${edge}`);
  }
}

// neighbors: [{ id, center: {lat, lon} }]. Returns one entry per neighbor with its edge and
// [from, to] segment along that edge. Neighbors sharing an edge split it into equal segments.
export function assignNeighborEdges(center, neighbors) {
  const withBearing = neighbors.map((neighbor) => {
    const bearing = bearingDegrees(center, neighbor.center);
    return { neighbor: neighbor.id, bearing, edge: edgeForBearing(bearing) };
  });

  const result = [];
  for (const edge of ['N', 'E', 'S', 'W']) {
    const onEdge = withBearing
      .filter((entry) => entry.edge === edge)
      .sort((a, b) => positionKey(edge, a.bearing) - positionKey(edge, b.bearing));
    onEdge.forEach((entry, index) => {
      result.push({
        neighbor: entry.neighbor,
        edge,
        from: round(index / onEdge.length),
        to: round((index + 1) / onEdge.length),
        bearing: round(entry.bearing, 1),
      });
    });
  }
  return result;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Ray casting over one ring of [lon, lat] positions.
function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > lat) !== (yj > lat) &&
      lon < (xj - xi) * (lat - yi) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonContains(rings, lon, lat) {
  if (!ringContains(rings[0], lon, lat)) return false;
  for (let i = 1; i < rings.length; i++) {
    if (ringContains(rings[i], lon, lat)) return false;   // inside a hole
  }
  return true;
}

// GeoJSON Polygon or MultiPolygon geometry.
export function geometryContains(geometry, point) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return polygonContains(geometry.coordinates, point.lon, point.lat);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((rings) => polygonContains(rings, point.lon, point.lat));
  }
  return false;
}
