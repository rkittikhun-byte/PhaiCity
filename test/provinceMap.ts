/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Whole-province maps in the game (docs/geo/GEO_SPEC.md sections 5 and 10): their roads and railways, building only
// inside the province, and what the province card says about its transport.

import { Budget } from "../src/budget.js";
import { CityCommands, CommandTarget, footprint, OUTSIDE_PROVINCE } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { decodePresetLayer, encodePresetLayer } from "../src/geo/presetMap";
import { hasTransport, provinceTransport, waterwayName } from "../src/geo/provinceTransport";
import { MapGenerator } from "../src/mapGenerator.js";
import {
  DIRT, HBRIDGE, HRAIL, HRAILROAD, LHRAIL, LVRAIL, ROADS, ROADS2, VBRIDGE, VRAILROAD,
} from "../src/tileValues";

const L = 0;
const W = 1;
const ROAD = 1;
const RAIL = 2;
const CROSS = 3;

describe("preset layers", () => {
  test("encode and decode round-trip", () => {
    const codes = [0, 0, 1, 1, 1, 0, 3, 3];
    expect(encodePresetLayer(codes)).toBe("2:0,3:1,1:0,2:3");
    expect([...decodePresetLayer(encodePresetLayer(codes), 4, 2)]).toEqual(codes);
  });
});

describe("roads and railways of a preset", () => {
  test("a road across the map becomes joined road pieces", () => {
    const cells = new Array(5 * 3).fill(L);
    const transport = [0, 0, 0, 0, 0, ROAD, ROAD, ROAD, ROAD, ROAD, 0, 0, 0, 0, 0];
    const map = MapGenerator.fromPresetCells(5, 3, cells, transport);
    for (let x = 1; x < 4; x++) expect(map.getTileValue(x, 1)).toBe(ROADS);
    expect(map.getTileValue(2, 0)).toBe(DIRT);
  });

  test("a road over water is a bridge along its way, and a railway over water a rail bridge", () => {
    const cells = [
      L, W, L,
      L, W, L,
      L, W, L,
    ];
    const transport = [
      0, 0, 0,
      ROAD, ROAD, ROAD,
      0, 0, 0,
    ];
    expect(MapGenerator.fromPresetCells(3, 3, cells, transport).getTileValue(1, 1)).toBe(HBRIDGE);
    const vertical = [
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ];
    const lake = [
      L, L, L,
      W, W, W,
      L, L, L,
    ];
    vertical[1] = vertical[4] = vertical[7] = ROAD;
    expect(MapGenerator.fromPresetCells(3, 3, lake, vertical).getTileValue(1, 1)).toBe(VBRIDGE);
    const rail = [0, 0, 0, RAIL, RAIL, RAIL, 0, 0, 0];
    expect(MapGenerator.fromPresetCells(3, 3, cells, rail).getTileValue(1, 1)).toBe(HRAIL);
  });

  test("a road meeting a railway is a level crossing the right way round", () => {
    const cells = new Array(9).fill(L);
    // Railway across, road down
    const across = [
      0, ROAD, 0,
      RAIL, CROSS, RAIL,
      0, ROAD, 0,
    ];
    const map = MapGenerator.fromPresetCells(3, 3, cells, across);
    expect(map.getTileValue(1, 1)).toBe(HRAILROAD);
    expect(map.getTileValue(0, 1)).toBe(LHRAIL);
    expect(map.getTileValue(1, 0)).toBe(ROADS2); // a vertical piece joined to the crossing
    // Railway down, road across
    const down = [
      0, RAIL, 0,
      ROAD, CROSS, ROAD,
      0, RAIL, 0,
    ];
    const other = MapGenerator.fromPresetCells(3, 3, cells, down);
    expect(other.getTileValue(1, 1)).toBe(VRAILROAD);
    expect(other.getTileValue(1, 0)).toBe(LVRAIL);
  });

  test("rejects a transport layer of the wrong size", () => {
    expect(() => MapGenerator.fromPresetCells(2, 2, [L, L, L, L], [0, 0])).toThrow();
  });
});

describe("building only inside the province", () => {
  // A 20 x 20 map whose left half (x < 10) is the province
  function provinceCity() {
    const map = new GameMap(20, 20);
    const inside = new Uint8Array(400).map((_, i) => (i % 20 < 10 ? 1 : 0));
    const budget = new Budget();
    budget.setFunds(100000);
    const noop = () => undefined;
    const commands = new CityCommands({
      width: map.width,
      height: map.height,
      tools: new (GameTools as unknown as new (map: unknown) => CommandTarget["tools"])(map),
      blockMaps: {},
      budget,
      disasters: { disastersEnabled: true, makeFire: noop, makeFlood: noop, makeCrash: noop, makeMeltdown: noop },
      sprites: { makeMonster: noop, makeTornado: noop },
      setSpeed: noop,
      setAutoBulldoze: noop,
      canBuildAt: (x, y) => inside[x + y * 20] === 1,
    });
    return { map, budget, commands };
  }

  test("a road inside is built, one outside is refused and costs nothing", () => {
    const { map, budget, commands } = provinceCity();
    expect(commands.apply({ type: "tool", tool: "road", x: 5, y: 5 }).accepted).toBe(true);
    const funds = budget.totalFunds;
    expect(commands.apply({ type: "tool", tool: "road", x: 15, y: 5 })).toEqual({
      accepted: false, reason: OUTSIDE_PROVINCE, toolResult: null,
    });
    expect(map.getTileValue(15, 5)).toBe(DIRT);
    expect(budget.totalFunds).toBe(funds);
  });

  test("a zone that would reach over the edge is refused; one just inside is built", () => {
    const { map, commands } = provinceCity();
    // A 3 x 3 zone centred at x = 9 covers x = 8..10: one column outside
    expect(commands.apply({ type: "tool", tool: "residential", x: 9, y: 5 }).reason).toBe(OUTSIDE_PROVINCE);
    expect(map.getTileValue(8, 5)).toBe(DIRT);
    expect(commands.apply({ type: "tool", tool: "residential", x: 8, y: 5 }).accepted).toBe(true);
  });

  test("the bulldozer cannot clear outside the province either", () => {
    const { commands } = provinceCity();
    expect(commands.apply({ type: "tool", tool: "bulldozer", x: 12, y: 12 }).reason).toBe(OUTSIDE_PROVINCE);
  });

  test("a road may join one outside: only the tile it is built on must be inside", () => {
    const { map, commands } = provinceCity();
    map.setTile(10, 5, ROADS, 0);
    expect(commands.apply({ type: "tool", tool: "road", x: 9, y: 5 }).accepted).toBe(true);
  });

  test("footprints match the tool outline", () => {
    expect(footprint(5, 5, 1)).toEqual([{ x: 5, y: 5 }]);
    expect(footprint(5, 5, 3)[0]).toEqual({ x: 4, y: 4 });
    expect(footprint(5, 5, 6)).toHaveLength(36);
  });
});

describe("transport of a province", () => {
  const map = {
    exits: [
      { neighbor: "TH-44", kind: "road" as const, ref: "12", x: 1, y: 1 },
      { neighbor: "TH-44", kind: "road" as const, ref: "209", x: 2, y: 1 },
      { neighbor: "TH-41", kind: "rail" as const, name: "สายตะวันออกเฉียงเหนือ", x: 3, y: 1 },
      { neighbor: "TH-30", kind: "rail" as const, x: 4, y: 1 },
    ],
    waterways: [{ th: "แม่น้ำชี", en: "Chi River" }, { th: "ลำน้ำพอง", en: "" }],
    unlinked: ["TH-46"],
  };

  test("one road per neighbour, the railways, the waterways and the sea", () => {
    const transport = provinceTransport(map, ["coast_gulf"]);
    expect(transport.roads).toEqual([{ neighbor: "TH-44", ref: "12" }]);
    expect(transport.rails).toEqual(["TH-41", "TH-30"]);
    expect(transport.seas).toEqual(["gulf"]);
    expect(transport.unlinked).toEqual(["TH-46"]);
    expect(hasTransport(transport)).toBe(true);
  });

  test("an old map says nothing", () => {
    expect(hasTransport(provinceTransport({}, []))).toBe(false);
  });

  test("a river without an English name keeps its Thai one", () => {
    expect(waterwayName(map.waterways[0], "en")).toBe("Chi River");
    expect(waterwayName(map.waterways[1], "en")).toBe("ลำน้ำพอง");
    expect(waterwayName(map.waterways[0], "th")).toBe("แม่น้ำชี");
  });
});
