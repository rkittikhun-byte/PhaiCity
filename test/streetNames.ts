/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Street names (src/streetNames.ts): roads, sois numbered odd and even, lanes, numbered highways, and where the
// 3D view writes them.

import { hasKey, t } from "../src/i18n/index";
import { findStreets, labelSpots, ROAD_MIN_TILES, Street, STREET_NAMES, streetLabel } from "../src/streetNames";

const ROAD = 66;

function grid(width: number, height: number, draw: (set: (x: number, y: number, level?: number) => void) => void,
  national?: Uint8Array) {
  const tiles = new Uint16Array(width * height), roadLevels = new Uint8Array(width * height).fill(1);
  draw((x, y, level = 1) => { tiles[y * width + x] = ROAD; roadLevels[y * width + x] = level; });
  return { width, height, roadLevels, nationalTransport: national ?? null, getTileValue: (x: number, y: number) => tiles[y * width + x] };
}

const label = (street: Street, language: "th" | "en" = "th"): string => {
  const { key, params } = streetLabel(street, language);
  return t(key, params);
};

describe("street names", () => {
  test("a long straight road is one named road, straight on through a crossing", () => {
    const map = grid(40, 40, set => {
      for (let x = 0; x < 40; x++) set(x, 20);
      for (let y = 0; y < 40; y++) set(20, y);
    });
    const streets = findStreets(map);
    expect(streets).toHaveLength(2);
    expect(streets.every(s => s.kind === "road" && s.tiles.length === 40)).toBe(true);
    expect(streets[0].name).not.toBe(streets[1].name);
    expect(STREET_NAMES[streets[0].name]).toBeDefined();
  });

  test("short streets off a road are sois, odd on one side and even on the other, numbered along it", () => {
    const map = grid(40, 30, set => {
      for (let x = 0; x < 40; x++) set(x, 10);
      for (const x of [5, 15, 25]) for (let y = 4; y < 10; y++) set(x, y);   // north side
      for (const x of [8, 18]) for (let y = 11; y < 16; y++) set(x, y);      // south side
    });
    const streets = findStreets(map);
    const road = streets.find(s => s.kind === "road")!;
    const sois = streets.filter(s => s.kind === "soi");
    expect(sois).toHaveLength(5);
    expect(sois.every(s => s.parent === road.id && s.name === road.name)).toBe(true);
    const at = (x: number) => sois.find(s => s.tiles.some(t => t % 40 === x))!.number;
    const north = [at(5), at(15), at(25)], south = [at(8), at(18)];
    // One side is odd and the other even, and the numbers climb along the road
    expect(new Set(north.map(n => n % 2)).size).toBe(1);
    expect(new Set(south.map(n => n % 2)).size).toBe(1);
    expect(north[0] % 2).not.toBe(south[0] % 2);
    expect(north).toEqual([...north].sort((a, b) => a - b));
    expect(label(sois[0])).toMatch(/^ซอย.+ \d+$/);
    expect(streetLabel(sois[0], "en")).toEqual({ key: "street.soi", params: { name: STREET_NAMES[road.name].en, number: sois[0].number } });
  });

  test("a street off a soi is a lane (แยก)", () => {
    const map = grid(40, 30, set => {
      for (let x = 0; x < 40; x++) set(x, 20);
      for (let y = 10; y < 20; y++) set(10, y);
      for (let x = 11; x < 15; x++) set(x, 14);
    });
    const streets = findStreets(map);
    const lane = streets.find(s => s.kind === "lane")!;
    const soi = streets.find(s => s.kind === "soi")!;
    expect(lane.parent).toBe(soi.id);
    expect(label(lane)).toMatch(/^ซอย.+ \d+ แยก \d+$/);
  });

  test("a short street on its own is still a road; wide roads, motorways, tollways and state roads", () => {
    const map = grid(30, 30, set => {
      for (let x = 2; x < 7; x++) set(x, 2);
      for (let x = 2; x < 8; x++) set(x, 6, 4);
      for (let x = 0; x < 30; x++) set(x, 12, 7);
      for (let x = 0; x < 30; x++) set(x, 18, 8);
    }, (() => { const n = new Uint8Array(900); return n; })());
    const kinds = findStreets(map).map(s => s.kind).sort();
    expect(kinds).toEqual(["motorway", "road", "road", "tollway"]);
    const national = new Uint8Array(30 * 30);
    for (let x = 0; x < 30; x++) national[24 * 30 + x] = 1;
    const highway = findStreets(grid(30, 30, set => { for (let x = 0; x < 30; x++) set(x, 24); }, national));
    expect(highway[0].kind).toBe("highway");
    expect(label(highway[0])).toBe(`ทางหลวง ${highway[0].number}`);
  });

  test("a bend and a staircase keep one street; a ring closes", () => {
    const map = grid(40, 40, set => {
      for (let i = 0; i < 12; i++) { set(5 + i, 5 + i); set(6 + i, 5 + i); }   // a staircase south-east
      for (let x = 20; x < 30; x++) { set(x, 30); set(x, 38); }
      for (let y = 30; y <= 38; y++) { set(20, y); set(29, y); }
    });
    const streets = findStreets(map);
    expect(streets).toHaveLength(2);
    const ring = streets.find(s => s.closed)!;
    expect(ring.tiles).toHaveLength(2 * 10 + 2 * 7);
    const stairs = streets.find(s => !s.closed)!;
    expect(stairs.tiles).toHaveLength(24);
    expect(stairs.kind).toBe("road");
    // The name sits along the diagonal
    const spots = labelSpots(stairs, 40);
    expect(spots.length).toBeGreaterThan(0);
    expect(Math.abs(Math.abs(spots[0].angle) - Math.PI / 4)).toBeLessThan(0.3);
  });

  test("labels: one in the middle, more along a long street, none on a stub", () => {
    const long = findStreets(grid(100, 5, set => { for (let x = 0; x < 100; x++) set(x, 2); }))[0];
    const spots = labelSpots(long, 100);
    expect(spots.length).toBe(3);
    expect(spots.every(s => s.y === 2.5 && Math.abs(s.angle) < 1e-9 && s.run === 9)).toBe(true);
    const stub = findStreets(grid(10, 5, set => { for (let x = 0; x < 3; x++) set(x, 2); }))[0];
    expect(labelSpots(stub, 10)).toEqual([]);
  });

  test("a real map's streets carry their real names, and their sois are named after them", () => {
    const map: any = grid(40, 30, set => {
      for (let x = 0; x < 40; x++) set(x, 10);
      for (let y = 4; y < 10; y++) set(5, y);
    });
    map.roadNames = new Uint16Array(40 * 30);
    for (let x = 0; x < 40; x++) map.roadNames[10 * 40 + x] = 1;
    map.streetNameList = [{ th: "ถนนศรีจันทร์", en: "Si Chan Road" }];
    const streets = findStreets(map);
    const road = streets.find(s => s.kind === "road")!, soi = streets.find(s => s.kind === "soi")!;
    expect(label(road)).toBe("ถนนศรีจันทร์");
    expect(streetLabel(road, "en").params.name).toBe("Si Chan Road");
    expect(label(soi)).toBe(`ซอยศรีจันทร์ ${soi.number}`);
    expect(streetLabel(soi, "en")).toEqual({ key: "street.soi", params: { name: "Si Chan", number: soi.number } });
  });

  test("the same roads always read the same, and every label key is translated", () => {
    const draw = (set: (x: number, y: number) => void) => {
      for (let x = 0; x < ROAD_MIN_TILES + 5; x++) set(x, 3);
      for (let y = 4; y < 9; y++) set(4, y);
    };
    const a = findStreets(grid(30, 12, draw)), b = findStreets(grid(30, 12, draw));
    expect(a.map(s => label(s))).toEqual(b.map(s => label(s)));
    for (const key of ["street.road", "street.real", "street.soi", "street.soi_highway", "street.lane", "street.lane_highway",
      "street.highway", "street.motorway", "street.tollway"]) expect(hasKey(key)).toBe(true);
    expect(new Set(STREET_NAMES.map(n => n.th)).size).toBe(STREET_NAMES.length);
  });
});
