/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run geo:extract [-- --force]
// Reads the OpenStreetMap extract of Thailand from Geofabrik (data/geo/cache/pbf/thailand-*.osm.pbf, the newest
// one; GEO_SPEC section 3) and writes the same one-degree squares that geo:download asks Overpass for, in the same
// trimmed form (data/geo/cache/overpass/national/<layer>/<lat>_<lon>.json), plus the airports. Squares that are
// already there are kept unless --force is given, so the two sources can fill in for each other.
// The extract is read three times: relations, then ways, then the nodes those need.

import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, loadProvinces } from './lib/common.mjs';
import { dataBlocks, readBlock } from './lib/pbf.mjs';
import { loadProvinceShapes } from './lib/provinceArea.mjs';
import { METERS_PER_DEGREE_LAT, METERS_PER_DEGREE_LON_AT_EQUATOR } from './lib/projection.mjs';
import {
  cacheFile, cellsTouching, KEPT_TAGS, LAYER_NAMES, MIN_AREA_OUTLINE_M, provinceGrid,
} from './provinceData.mjs';

const PBF_DIR = path.join(CACHE_DIR, 'pbf');
const AIRPORTS_FILE = path.join(CACHE_DIR, 'overpass', 'national', 'airports.json');

// The same choices as the Overpass queries of provinceData.mjs
const WAY_TESTS = {
  roads: (tag) => /^(motorway|trunk|primary)$/.test(tag('highway') ?? ''),
  links: (tag) => /^(motorway|trunk|primary)_link$/.test(tag('highway') ?? ''),
  rail: (tag) => tag('railway') === 'rail',
  coast: (tag) => tag('natural') === 'coastline',
  rivers: (tag) => tag('waterway') === 'river',
  water: (tag) => tag('natural') === 'water' || /^(reservoir|basin)$/.test(tag('landuse') ?? '') ||
    tag('waterway') === 'riverbank',
  forest: (tag) => tag('landuse') === 'forest' || tag('natural') === 'wood' || tag('wetland') === 'mangrove',
};
// Areas: ways and relations, kept when their outline is long enough to cover a tile of some map
const AREA_LAYERS = ['water', 'forest'];

const keptTags = (tags) => Object.fromEntries(Object.entries(tags).filter(([key]) => KEPT_TAGS.has(key)));
const isAirport = (tag) => tag('aeroway') === 'aerodrome' && tag('iata') !== undefined;
const airportTags = (tags) => ({ name: tags.name ?? '', nameEn: tags['name:en'] ?? '', iata: tags.iata });

/** A Float64Array that grows. */
class Numbers {
  constructor() {
    this.values = new Float64Array(1 << 20);
    this.length = 0;
  }

  add(values) {
    while (this.length + values.length > this.values.length) {
      const bigger = new Float64Array(this.values.length * 2);
      bigger.set(this.values.subarray(0, this.length));
      this.values = bigger;
    }
    this.values.set(values, this.length);
    this.length += values.length;
  }

  /** Sorted, each value once. */
  sortedUnique() {
    const sorted = this.values.subarray(0, this.length).sort();
    let count = 0;
    for (let i = 0; i < sorted.length; i++) if (i === 0 || sorted[i] !== sorted[i - 1]) sorted[count++] = sorted[i];
    return sorted.slice(0, count);
  }
}

function newestExtract() {
  const files = fs.existsSync(PBF_DIR) ? fs.readdirSync(PBF_DIR).filter((f) => /^thailand-.*\.osm\.pbf$/.test(f)) : [];
  if (!files.length) throw new Error(`No extract in ${PBF_DIR} (thailand-*.osm.pbf from download.geofabrik.de)`);
  return path.join(PBF_DIR, files.sort().at(-1));
}

function wantedCells() {
  const shapes = loadProvinceShapes();
  const wanted = new Set();
  for (const province of loadProvinces()) {
    for (const key of cellsTouching(provinceGrid(shapes.get(province.id)).fetchBox)) wanted.add(key);
  }
  return wanted;
}

async function main() {
  const force = process.argv.includes('--force');
  const file = fs.readFileSync(newestExtract());
  const started = Date.now();
  const seconds = () => ((Date.now() - started) / 1000).toFixed(0);

  // 1. Relations: water and forest areas, and airports drawn as relations
  const relations = [];
  const memberWays = new Set();
  for (const bytes of dataBlocks(file)) {
    readBlock(bytes, {
      relation(relation) {
        const layers = AREA_LAYERS.filter((layer) => WAY_TESTS[layer](relation.tag));
        const airport = isAirport(relation.tag);
        if (!layers.length && !airport) return;
        const members = relation.members().filter((member) => member.type === 'way');
        for (const member of members) memberWays.add(member.id);
        const tags = relation.tags();
        relations.push({ id: relation.id, layers, tags: keptTags(tags), airport: airport ? airportTags(tags) : null, members });
      },
    });
  }
  console.log(`${relations.length} relations, ${memberWays.size} member ways (${seconds()} s)`);

  // 2. Ways: every layer's, and the members of those relations
  const ways = [];
  const memberRefs = new Map();
  const needed = new Numbers();
  for (const bytes of dataBlocks(file)) {
    readBlock(bytes, {
      way(way) {
        const layers = LAYER_NAMES.filter((layer) => WAY_TESTS[layer](way.tag));
        const airport = isAirport(way.tag);
        const member = memberWays.has(way.id);
        if (!layers.length && !airport && !member) return;
        const refs = way.refs();
        needed.add(refs);
        if (member) memberRefs.set(way.id, refs);
        if (layers.length || airport) {
          const tags = way.tags();
          ways.push({ id: way.id, layers, tags: keptTags(tags), airport: airport ? airportTags(tags) : null, refs });
        }
      },
    });
  }
  const ids = needed.sortedUnique();
  console.log(`${ways.length} ways, ${ids.length} nodes to find (${seconds()} s)`);

  // 3. Nodes: the coordinates of those, and airports drawn as single points. Node ids come in order in the file.
  const lats = new Float32Array(ids.length).fill(NaN);
  const lons = new Float32Array(ids.length).fill(NaN);
  const airports = [];
  let next = 0;
  for (const bytes of dataBlocks(file)) {
    readBlock(bytes, {
      nodes(nodeIds, nodeLats, nodeLons, tagsOf, hasString) {
        for (let i = 0; i < nodeIds.length; i++) {
          const id = nodeIds[i];
          if (next > 0 && ids[next - 1] > id) next = lowerBound(ids, id); // out of order: search instead
          while (next < ids.length && ids[next] < id) next++;
          if (ids[next] === id) {
            lats[next] = nodeLats[i];
            lons[next] = nodeLons[i];
          }
        }
        if (hasString('aerodrome')) {
          for (let i = 0; i < nodeIds.length; i++) {
            const tags = tagsOf(i);
            if (tags.aeroway === 'aerodrome' && tags.iata) {
              airports.push({ ...airportTags(tags), lat: nodeLats[i], lon: nodeLons[i] });
            }
          }
        }
      },
    });
  }
  console.log(`coordinates found (${seconds()} s)`);

  // Points of a way as [lon, lat, …] to five decimals, leaving out nodes the extract does not have
  const pointsOf = (refs) => {
    const points = [];
    for (const ref of refs) {
      const index = lowerBound(ids, ref);
      if (ids[index] !== ref || Number.isNaN(lats[index])) continue;
      points.push(Math.round(lons[index] * 1e5) / 1e5, Math.round(lats[index] * 1e5) / 1e5);
    }
    return points;
  };

  // Each layer's elements, square by square
  const wanted = wantedCells();
  const byCell = new Map(LAYER_NAMES.map((layer) => [layer, new Map()]));
  const place = (layer, element, box) => {
    for (const key of cellsTouching(box)) {
      if (!wanted.has(key)) continue;
      const cells = byCell.get(layer);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(element);
    }
  };

  for (const way of ways) {
    const points = pointsOf(way.refs);
    if (points.length < 4) continue;
    if (way.airport) airports.push({ ...way.airport, ...centreOf([points]) });
    for (const layer of way.layers) {
      if (AREA_LAYERS.includes(layer) && lengthM(points) < MIN_AREA_OUTLINE_M) continue;
      place(layer, { type: 'way', id: way.id, tags: way.tags, points }, boxOf([points]));
    }
  }
  for (const relation of relations) {
    const members = relation.members
      .map((member) => ({ role: member.role, points: memberRefs.has(member.id) ? pointsOf(memberRefs.get(member.id)) : [] }))
      .filter((member) => member.points.length >= 4);
    if (!members.length) continue;
    const lines = members.map((member) => member.points);
    if (relation.airport) airports.push({ ...relation.airport, ...centreOf(lines) });
    if (lines.reduce((sum, points) => sum + lengthM(points), 0) < MIN_AREA_OUTLINE_M) continue;
    for (const layer of relation.layers) {
      place(layer, { type: 'relation', id: relation.id, tags: relation.tags, members }, boxOf(lines));
    }
  }

  // Write what is not there yet
  let written = 0;
  let kept = 0;
  for (const [layer, cells] of byCell) {
    for (const key of wanted) {
      const target = cacheFile(layer, key);
      if (fs.existsSync(target) && !force) {
        kept++;
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify({ elements: cells.get(key) ?? [], source: 'geofabrik' }));
      written++;
    }
  }
  if (!fs.existsSync(AIRPORTS_FILE) || force) {
    const unique = [...new Map(airports.map((airport) => [airport.iata, airport])).values()]
      .map((airport) => ({ ...airport, lat: Math.round(airport.lat * 1e5) / 1e5, lon: Math.round(airport.lon * 1e5) / 1e5 }));
    fs.writeFileSync(AIRPORTS_FILE, JSON.stringify({ airports: unique, source: 'geofabrik' }));
    console.log(`${unique.length} airports`);
  }
  console.log(`${written} squares written, ${kept} already there (${seconds()} s)`);
}

/** The first index whose value is not below value, in a sorted array. */
function lowerBound(sorted, value) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sorted[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The length of a line [lon, lat, …] in metres. */
function lengthM(points) {
  let total = 0;
  for (let i = 2; i < points.length; i += 2) {
    const kx = Math.cos(points[i + 1] * Math.PI / 180) * METERS_PER_DEGREE_LON_AT_EQUATOR;
    total += Math.hypot((points[i] - points[i - 2]) * kx, (points[i + 1] - points[i - 1]) * METERS_PER_DEGREE_LAT);
  }
  return total;
}

/** [west, south, east, north] around some lines [lon, lat, …]. */
function boxOf(lines) {
  let west = Infinity; let south = Infinity; let east = -Infinity; let north = -Infinity;
  for (const points of lines) {
    for (let i = 0; i < points.length; i += 2) {
      west = Math.min(west, points[i]); east = Math.max(east, points[i]);
      south = Math.min(south, points[i + 1]); north = Math.max(north, points[i + 1]);
    }
  }
  return [west, south, east, north];
}

function centreOf(lines) {
  const [west, south, east, north] = boxOf(lines);
  return { lat: (south + north) / 2, lon: (west + east) / 2 };
}

main().catch((error) => {
  console.error(`\n${error.stack ?? error.message}`);
  process.exit(1);
});
