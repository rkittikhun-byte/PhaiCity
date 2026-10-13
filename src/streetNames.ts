/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Street names (ชื่อถนน, owner 13 Oct 2026: road names on the 3D map, as in Cities: Skylines). The city's roads are
// read as streets: a street runs along its road, round its bends and straight on through crossings, and ends where it
// meets another street side-on or runs out. Long or wide streets are roads (ถนน) with a name of their own; a short one
// off a road is a soi (ซอย) named after that road and numbered along it as Thai sois are, odd on one side and even on
// the other, and a short one off a soi is that soi's แยก. Motorways and tollways are numbered, and so are the state's
// roads to the neighbouring provinces (ทางหลวง). Names come from the map alone, so the same roads always read the
// same; they are not saved yet, and a street that grows towards the top left of the map may change its name.
// Plain code: no DOM, nothing random.

import { isRoadTile, MOTORWAY_LEVEL, roadLevelAt, TOLLWAY_LEVEL } from "./roadLevels.js";

export type StreetKind = "road" | "soi" | "lane" | "highway" | "motorway" | "tollway";

export interface Street {
  /** The street's first tile in map order (y * width + x), which picks its name */
  id: number;
  kind: StreetKind;
  /** A road's name, a soi's road's name or a lane's soi's road's name: an index into STREET_NAMES */
  name: number;
  /** A soi's number along its road, a lane's soi's number, a highway's, motorway's or tollway's number */
  number: number;
  /** A lane's own number along its soi */
  sub: number;
  /** The street a soi or lane leaves from, by its id */
  parent: number | null;
  /** The tiles in order along the street (y * width + x) */
  tiles: number[];
  /** Whether the street comes back to where it began */
  closed: boolean;
  /** Its real name, from a real-scale city map (docs/GAME_PLAN.md decision 17): the name most of its tiles carry */
  real?: { th: string; en: string };
  /** A soi's or lane's road's real name, which it is named after instead of a made-up one */
  base?: { th: string; en: string };
}

export interface StreetMap {
  readonly width: number;
  readonly height: number;
  readonly roadLevels?: Uint8Array | null;
  readonly nationalTransport?: ArrayLike<number> | null;
  /** A real-scale city map's street names: each tile's name, an index into streetNameList counted from 1 (0: none) */
  readonly roadNames?: ArrayLike<number> | null;
  readonly streetNameList?: ReadonlyArray<{ th: string; en: string }> | null;
  getTileValue(x: number, y: number): number;
}

/** A street at least this many tiles long is a road (ถนน) whatever it meets (16 m tiles: about 300 m) */
export const ROAD_MIN_TILES = 18;
/** A street at least this level (concrete, two lanes) is a road however short */
export const ROAD_MIN_LEVEL = 3;

/** Road names: plain Thai words a town's streets carry, with their usual spelling in English; no royal names */
export const STREET_NAMES: ReadonlyArray<{ th: string; en: string }> = [
  { th: "มิตรภาพ", en: "Mittraphap" }, { th: "ศรีจันทร์", en: "Si Chan" }, { th: "กลางเมือง", en: "Klang Mueang" },
  { th: "หน้าเมือง", en: "Na Mueang" }, { th: "หลังเมือง", en: "Lang Mueang" }, { th: "ประชาสโมสร", en: "Pracha Samoson" },
  { th: "รื่นรมย์", en: "Ruen Rom" }, { th: "เทพารักษ์", en: "Thepharak" }, { th: "อำมาตย์", en: "Ammat" },
  { th: "ศรีสุข", en: "Si Suk" }, { th: "สามัคคี", en: "Samakkhi" }, { th: "พัฒนา", en: "Phatthana" },
  { th: "เจริญเมือง", en: "Charoen Mueang" }, { th: "สุขสวัสดิ์", en: "Suk Sawat" }, { th: "ร่วมใจ", en: "Ruam Chai" },
  { th: "นิมิตใหม่", en: "Nimit Mai" }, { th: "ศรีเมือง", en: "Si Mueang" }, { th: "ดอกคูน", en: "Dok Khun" },
  { th: "ทองหลาง", en: "Thonglang" }, { th: "ราษฎร์บำรุง", en: "Rat Bamrung" }, { th: "ประชาร่วมใจ", en: "Pracha Ruam Chai" },
  { th: "บ้านเก่า", en: "Ban Kao" }, { th: "หนองแวง", en: "Nong Waeng" }, { th: "โนนทอง", en: "Non Thong" },
  { th: "บ้านโคก", en: "Ban Khok" }, { th: "ศรีบุญเรือง", en: "Si Bun Rueang" }, { th: "ชัยพฤกษ์", en: "Chaiyaphruek" },
  { th: "ร่มโพธิ์", en: "Rom Pho" }, { th: "กังสดาล", en: "Kangsadan" }, { th: "มะลิวัลย์", en: "Maliwan" },
  { th: "สายบัว", en: "Sai Bua" }, { th: "ท่าน้ำ", en: "Tha Nam" }, { th: "ตลาดเก่า", en: "Talat Kao" },
  { th: "โรงเรียน", en: "Rong Rian" }, { th: "สถานี", en: "Sathani" }, { th: "ประตูเมือง", en: "Pratu Mueang" },
  { th: "ริมบึง", en: "Rim Bueng" }, { th: "หนองใหญ่", en: "Nong Yai" }, { th: "ดอนหญ้านาง", en: "Don Ya Nang" },
  { th: "โพธิ์ทอง", en: "Pho Thong" }, { th: "สันติสุข", en: "Santisuk" }, { th: "เสรีไทย", en: "Seri Thai" },
  { th: "ประชาอุทิศ", en: "Pracha Uthit" }, { th: "ร่มเย็น", en: "Rom Yen" }, { th: "ทุ่งสร้าง", en: "Thung Sang" },
  { th: "บ้านเหล่า", en: "Ban Lao" }, { th: "หนองคู", en: "Nong Khu" }, { th: "ศรีธาตุ", en: "Si That" },
  { th: "ชลประทาน", en: "Chonlaprathan" }, { th: "เทศบาล", en: "Thetsaban" }, { th: "กสิกรทุ่งสร้าง", en: "Kasikon Thung Sang" },
  { th: "สวนสน", en: "Suan Son" }, { th: "บ้านสวน", en: "Ban Suan" }, { th: "นาคประดิษฐ์", en: "Nak Pradit" },
  { th: "ลำห้วย", en: "Lam Huai" }, { th: "หัวสะพาน", en: "Hua Saphan" }, { th: "คุ้มวัด", en: "Khum Wat" },
  { th: "ร่องเมือง", en: "Rong Mueang" }, { th: "ต้นตาล", en: "Ton Tan" }, { th: "สีลม", en: "Si Lom" },
];

// Neighbours as [dx, dy]: east, south, west, north
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

/** A whole number from a tile's place that spreads neighbouring places far apart (no Math.random). */
function hash(index: number): number {
  let h = (index + 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Every street of the map, roads first, each named; recomputed from the tiles whenever the roads change. */
export function findStreets(map: StreetMap): Street[] {
  const { width, height } = map, size = width * height;
  const road = new Uint8Array(size);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (isRoadTile(map.getTileValue(x, y))) road[y * width + x] = 1;
  }
  const neighbour = (i: number, d: number): number => {
    const x = i % width + DX[d], y = Math.floor(i / width) + DY[d];
    return x >= 0 && y >= 0 && x < width && y < height && road[y * width + x] ? y * width + x : -1;
  };
  // Each link between two road tiles is one edge: 2i to the east, 2i + 1 to the south
  const edgeOf = (i: number, d: number): number => d === 0 ? 2 * i : d === 1 ? 2 * i + 1 : d === 2 ? 2 * (i - 1) : 2 * (i - width) + 1;
  const parent = new Int32Array(2 * size).fill(-1);
  const find = (e: number): number => { while (parent[e] !== e) { parent[e] = parent[parent[e]]; e = parent[e]; } return e; };
  const join = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  for (let i = 0; i < size; i++) {
    if (!road[i]) continue;
    for (const d of [0, 1]) if (neighbour(i, d) >= 0) parent[edgeOf(i, d)] = edgeOf(i, d);
  }
  // A street goes on through a tile with two links, and straight on through a crossing or past a side street
  for (let i = 0; i < size; i++) {
    if (!road[i]) continue;
    const links = [0, 1, 2, 3].filter(d => neighbour(i, d) >= 0);
    if (links.length === 2) join(edgeOf(i, links[0]), edgeOf(i, links[1]));
    else if (links.length >= 3) for (const d of [0, 1]) {
      if (links.includes(d) && links.includes(d + 2)) join(edgeOf(i, d), edgeOf(i, d + 2));
    }
  }
  // Gather each street's edges, then walk them in order from one end
  const groups = new Map<number, number[]>();
  for (let e = 0; e < 2 * size; e++) {
    if (parent[e] < 0) continue;
    const root = find(e), list = groups.get(root);
    if (list) list.push(e); else groups.set(root, [e]);
  }
  const streets: Street[] = [];
  for (const edges of groups.values()) streets.push(walk(edges, width));
  streets.sort((a, b) => a.id - b.id);
  name(streets, map);
  return streets.sort((a, b) => rank(a.kind) - rank(b.kind) || a.id - b.id);
}

const rank = (kind: StreetKind): number => ["tollway", "motorway", "highway", "road", "soi", "lane"].indexOf(kind);

function walk(edges: number[], width: number): Street {
  const links = new Map<number, number[]>();
  const add = (a: number, b: number): void => { const list = links.get(a); if (list) list.push(b); else links.set(a, [b]); };
  for (const e of edges) {
    const a = e >> 1, b = e & 1 ? a + width : a + 1;
    add(a, b); add(b, a);
  }
  let id = Infinity, start = -1;
  for (const [tile, next] of links) {
    id = Math.min(id, tile);
    if (next.length === 1 && (start < 0 || tile < start)) start = tile;
  }
  const closed = start < 0;
  if (closed) start = id;
  const used = new Set<string>(), tiles = [start];
  let at = start, from = -1;
  for (;;) {
    const options = (links.get(at) ?? []).filter(next => !used.has(at < next ? `${at},${next}` : `${next},${at}`));
    if (!options.length) break;
    // Straight on where the street crosses itself
    const ahead = from >= 0 ? options.find(next => next - at === at - from) : undefined;
    const next = ahead ?? options[0];
    used.add(at < next ? `${at},${next}` : `${next},${at}`);
    from = at; at = next; tiles.push(at);
  }
  if (closed && tiles.length > 1 && tiles[tiles.length - 1] === tiles[0]) tiles.pop();
  return { id, kind: "road", name: 0, number: 0, sub: 0, parent: null, tiles, closed };
}

function name(streets: Street[], map: StreetMap): void {
  const { width } = map;
  const levelOf = (street: Street): number => {
    const counts = new Map<number, number>();
    for (const t of street.tiles) { const l = roadLevelAt(map, t % width, Math.floor(t / width)); counts.set(l, (counts.get(l) ?? 0) + 1); }
    let best = 1, most = 0;
    for (const [level, n] of counts) if (n > most || n === most && level > best) { best = level; most = n; }
    return best;
  };
  const national = map.nationalTransport;
  const isNational = (street: Street): boolean => !!national &&
    street.tiles.filter(t => national[t] !== 0).length * 2 >= street.tiles.length;
  // Which streets pass through each tile, for a short street to find the one it leaves from
  const at = new Map<number, Street[]>();
  for (const street of streets) for (const t of street.tiles) { const list = at.get(t); if (list) list.push(street); else at.set(t, [street]); }
  const used = new Set<number>(), numbers = new Set<number>();
  const numbered = (street: Street, low: number, span: number): void => {
    let n = low + hash(street.id) % span;
    // The next free number; when every one is taken, two streets share one rather than looking for ever
    for (let tries = 0; numbers.has(n) && tries < span; tries++) n = low + (n - low + 1) % span;
    numbers.add(n); street.number = n;
  };
  // On a real map every street came with the map and has its real name instead (docs/GAME_PLAN.md decision 17)
  const realMap = !!(map.roadNames && map.streetNameList);
  for (const street of streets) {
    const level = levelOf(street);
    if (level >= TOLLWAY_LEVEL) { street.kind = "tollway"; numbered(street, 1, 9); }
    else if (level >= MOTORWAY_LEVEL) { street.kind = "motorway"; numbered(street, 1, 9); }
    else if (!realMap && isNational(street)) { street.kind = "highway"; numbered(street, 201, 2200); }
    else if (street.tiles.length >= ROAD_MIN_TILES || level >= ROAD_MIN_LEVEL) street.kind = "road";
    else street.kind = "soi";
  }
  // A short street leaves from a road at one of its ends: a soi, numbered later; one that leaves from a soi is a lane
  const leavesFrom = (street: Street, kinds: StreetKind[]): { from: Street; tile: number; next: number } | null => {
    const ends = street.closed ? [] : [[street.tiles[0], street.tiles[1]], [street.tiles[street.tiles.length - 1], street.tiles[street.tiles.length - 2]]];
    for (const [tile, next] of ends) {
      if (next === undefined) continue;
      const other = (at.get(tile) ?? []).find(s => s !== street && kinds.includes(s.kind));
      if (other) return { from: other, tile, next };
    }
    return null;
  };
  const sois = new Map<Street, Array<{ street: Street; position: number; odd: boolean }>>();
  const side = (from: Street, tile: number, next: number): { position: number; odd: boolean } => {
    const position = from.tiles.indexOf(tile), before = from.tiles[Math.max(0, position - 1)], after = from.tiles[Math.min(from.tiles.length - 1, position + 1)];
    const ax = after % width - before % width, ay = Math.floor(after / width) - Math.floor(before / width);
    const bx = next % width - tile % width, by = Math.floor(next / width) - Math.floor(tile / width);
    // Left of the road's way along (x east, y south): odd numbers; right: even
    return { position, odd: ax * by - ay * bx < 0 };
  };
  for (const street of streets) {
    if (street.kind !== "soi") continue;
    const link = leavesFrom(street, ["road", "highway"]);
    if (!link) continue;
    street.parent = link.from.id;
    const list = sois.get(link.from) ?? [];
    list.push({ street, ...side(link.from, link.tile, link.next) }); sois.set(link.from, list);
  }
  const lanes = new Map<Street, Array<{ street: Street; position: number; odd: boolean }>>();
  for (const street of streets) {
    if (street.kind !== "soi" || street.parent !== null) continue;
    const link = leavesFrom(street, ["soi"]);
    const from = link?.from;
    if (!link || !from || from.parent === null) { street.kind = "road"; continue; }
    street.kind = "lane"; street.parent = from.id;
    const list = lanes.get(from) ?? [];
    list.push({ street, ...side(from, link.tile, link.next) }); lanes.set(from, list);
  }
  // Streets of a real map take the name most of their tiles carry; a soi of a road with a real name is named after it
  const realNames = map.roadNames, list = map.streetNameList;
  if (realNames && list) {
    for (const street of streets) {
      const counts = new Map<number, number>();
      for (const t of street.tiles) { const k = realNames[t]; if (k > 0) counts.set(k, (counts.get(k) ?? 0) + 1); }
      let best = 0, most = 0;
      for (const [k, n] of counts) if (n > most) { best = k; most = n; }
      if (best && list[best - 1] && most * 3 >= street.tiles.length) street.real = list[best - 1];
    }
    for (const [road, list2] of sois) if (road.real) for (const item of list2) item.street.base = road.real;
    for (const [soi, list2] of lanes) if (soi.base) for (const item of list2) item.street.base = soi.base;
  }
  // Roads take a name each, the first free one from where their tile points; highways' roads read by number
  const names = STREET_NAMES.length;
  for (const street of streets) {
    if (street.kind !== "road" || street.real) continue;
    let n = hash(street.id) % names;
    for (let tries = 0; used.has(n) && tries < names; tries++) n = (n + 1) % names;
    used.add(n); street.name = n;
  }
  const count = (list: Array<{ street: Street; position: number; odd: boolean }>, set: (street: Street, n: number) => void): void => {
    let odd = 1, even = 2;
    for (const item of list.sort((a, b) => a.position - b.position || a.street.id - b.street.id)) {
      if (item.odd) { set(item.street, odd); odd += 2; } else { set(item.street, even); even += 2; }
    }
  };
  for (const [road, list] of sois) count(list, (soi, n) => { soi.name = road.kind === "road" ? road.name : -road.number; soi.number = n; });
  for (const [soi, list] of lanes) count(list, (lane, n) => { lane.name = soi.name; lane.number = soi.number; lane.sub = n; });
}

/** How a street reads: the i18n key and its placeholders (src/i18n `street.*`), so the caller translates it. */
export function streetLabel(street: Street, language: "th" | "en"): { key: string; params: Record<string, string | number> } {
  // A real street reads as its sign does
  if (street.real) return { key: "street.real", params: { name: language === "en" && street.real.en ? street.real.en : street.real.th } };
  const words = street.base ? realBase(street.base) : STREET_NAMES[Math.abs(street.name) % STREET_NAMES.length];
  // A soi off a highway reads by the highway's number
  const base = street.name < 0 && !street.base ? String(-street.name) : words[language];
  switch (street.kind) {
    case "tollway": case "motorway": case "highway": return { key: `street.${street.kind}`, params: { number: street.number } };
    case "soi": return { key: street.name < 0 && !street.base ? "street.soi_highway" : "street.soi", params: { name: base, number: street.number } };
    case "lane": return { key: street.name < 0 && !street.base ? "street.lane_highway" : "street.lane", params: { name: base, number: street.number, sub: street.sub } };
    default: return { key: "street.road", params: { name: base } };
  }
}

/** A real road's name as a soi carries it: "ถนนศรีจันทร์" → "ศรีจันทร์", "Si Chan Road" → "Si Chan" */
function realBase(real: { th: string; en: string }): { th: string; en: string } {
  const th = real.th.replace(/^ถนน\s*/u, "");
  const en = (real.en || real.th).replace(/\s+(Road|Rd\.?|Street|St\.?)$/i, "");
  return { th, en };
}

export interface LabelSpot {
  /** Where the label's middle lies, in tiles (the centre of tile x is x + 0.5) */
  x: number;
  y: number;
  /** Which way the street runs there, in radians from east towards south (map y) */
  angle: number;
  /** How many tiles of the street run straight there */
  run: number;
}

/** Where to write a street's name: the straightest stretch round its middle, and again every `spacing` tiles. */
export function labelSpots(street: Street, width: number, spacing = 32, minRun = 4): LabelSpot[] {
  const n = street.tiles.length;
  if (n < minRun) return [];
  const px = street.tiles.map(t => t % width + 0.5), py = street.tiles.map(t => Math.floor(t / width) + 0.5);
  // The longest straight window centred on tile c (at most 9 tiles), or 0 if the tiles there wander off a line
  const straight = (c: number): { run: number; angle: number } => {
    let best = { run: 0, angle: 0 };
    for (let k = 1; k <= 4; k++) {
      const a = c - k, b = c + k;
      if (a < 0 || b >= n) break;
      const dx = px[b] - px[a], dy = py[b] - py[a], len = Math.hypot(dx, dy);
      if (len < 0.5) break;
      let ok = true;
      for (let i = a; i <= b && ok; i++) ok = Math.abs((px[i] - px[a]) * dy - (py[i] - py[a]) * dx) / len <= 0.75;
      if (!ok) break;
      best = { run: 2 * k + 1, angle: Math.atan2(dy, dx) };
    }
    return best;
  };
  const spots: LabelSpot[] = [];
  const count = Math.max(1, Math.floor(n / spacing));
  for (let s = 0; s < count; s++) {
    const centre = Math.floor((s + 0.5) * n / count);
    let pick = -1, pickRun = 0, pickAngle = 0;
    for (let d = 0; d <= 6; d++) for (const c of d ? [centre - d, centre + d] : [centre]) {
      if (c < 0 || c >= n) continue;
      const { run, angle } = straight(c);
      if (run > pickRun) { pick = c; pickRun = run; pickAngle = angle; }
    }
    if (pick >= 0 && pickRun >= minRun) spots.push({ x: px[pick], y: py[pick], angle: pickAngle, run: pickRun });
  }
  return spots;
}
