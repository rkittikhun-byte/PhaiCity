/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Local equirectangular projection around a map center (GEO_SPEC section 2).
// Projected coordinates are meters from the map's top-left corner: x east, y south.

export const METERS_PER_DEGREE_LAT = 110574;
export const METERS_PER_DEGREE_LON_AT_EQUATOR = 111320;

export function makeGrid({ center, width, height, tileSizeM }) {
  const widthM = width * tileSizeM;
  const heightM = height * tileSizeM;
  const metersPerDegreeLon = Math.cos(center.lat * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR;

  const project = (lat, lon) => ({
    x: (lon - center.lon) * metersPerDegreeLon + widthM / 2,
    y: (center.lat - lat) * METERS_PER_DEGREE_LAT + heightM / 2,
  });

  const unproject = (x, y) => ({
    lat: center.lat - (y - heightM / 2) / METERS_PER_DEGREE_LAT,
    lon: center.lon + (x - widthM / 2) / metersPerDegreeLon,
  });

  // [west, south, east, north] in WGS84, optionally grown by a margin in meters.
  const bbox = (marginM = 0) => {
    const northWest = unproject(-marginM, -marginM);
    const southEast = unproject(widthM + marginM, heightM + marginM);
    return [northWest.lon, southEast.lat, southEast.lon, northWest.lat];
  };

  return { center, width, height, tileSizeM, widthM, heightM, project, unproject, bbox };
}
