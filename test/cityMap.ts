/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  CITY_KEYS, dimmed, HEAT, heatLevel, isMapLayer, KIND_COLOURS, layerPixels, MAP_LAYERS, mapScale, POWERED,
  powerCounts, stringId, tileAtPoint, tileColour, tileKind, UNPOWERED,
} from "../src/cityMap";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import { Simulation } from "../src/simulation.js";

type Map = { width: number; height: number; getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number };

const pixelAt = (pixels: Uint8ClampedArray, map: Map, x: number, y: number) => {
  const i = (y * map.width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]];
};

describe("city map", () => {
  test("knows what every tile is", () => {
    const cases: Array<[number, string]> = [
      [0, "dirt"], [2, "water"], [20, "water"], [21, "woods"], [37, "woods"], [40, "park"], [840, "park"],
      [44, "rubble"], [48, "flood"], [52, "radiation"], [56, "fire"], [860, "fire"],
      [64, "road"], [80, "road"], [206, "road"], [828, "road"], [948, "road"],
      [208, "powerLine"], [221, "powerLine"], [224, "rail"], [237, "rail"],
      [240, "residential"], [249, "residential"], [409, "residential"], [960, "residential"],
      [423, "commercial"], [611, "commercial"], [612, "industrial"], [844, "industrial"],
      [698, "service"], [716, "service"], [832, "service"], [765, "service"], [774, "service"], [784, "service"],
      [932, "service"], [750, "powerPlant"], [816, "powerPlant"], [916, "powerPlant"], [952, "powerPlant"],
    ];
    for (const [value, kind] of cases) expect([value, tileKind(value)]).toEqual([value, kind]);
    for (let value = 0; value < 1024; value++) expect(KIND_COLOURS[tileKind(value)]).toBeDefined();
  });

  test("colour a live city's power: lit zones, a zone left in the dark, and the overlays", () => {
    const map = new (GameMap as unknown as new (w: number, h: number) => Map)(120, 100);
    const sim: any = new (Simulation as any)(map, 0, 3, null);
    const tools: any = new (GameTools as any)(map);
    const build = (tool: string, x: number, y: number) => {
      tools[tool].doTool(x, y, sim.blockMaps);
      tools[tool].modifyIfEnoughFunding(sim.budget);
      expect(tools[tool].result).toBe(0);
    };
    build("coal", 10, 10); // tiles 9–12
    build("residential", 14, 10); // touches the plant
    build("residential", 60, 60); // far from any power
    for (let step = 0; step < 16 * 40; step++) sim._simulate(sim._constructSimData());

    const power = layerPixels("power", map, sim.blockMaps);
    expect(power).toHaveLength(120 * 100 * 4);
    expect(pixelAt(power, map, 10, 10)).toEqual([...POWERED]);
    expect(pixelAt(power, map, 14, 10)).toEqual([...POWERED]);
    expect(pixelAt(power, map, 60, 60)).toEqual([...UNPOWERED]);
    expect(pixelAt(power, map, 100, 90)).toEqual([...dimmed(KIND_COLOURS.dirt)]);
    expect(powerCounts(map)).toEqual({ powered: 1, unpowered: 1 });

    const city = layerPixels("city", map, sim.blockMaps);
    expect(pixelAt(city, map, 14, 10)).toEqual([...KIND_COLOURS.residential]);
    expect(city[3]).toBe(255);

    // A coal plant pollutes around itself and nowhere else
    const pollution = layerPixels("pollution", map, sim.blockMaps);
    expect(pixelAt(pollution, map, 11, 11)).not.toEqual(pixelAt(power, map, 11, 11));
    expect(pixelAt(pollution, map, 100, 90)).toEqual([...dimmed(KIND_COLOURS.dirt)]);
  });

  test("shade overlays from nothing to the top of their range", () => {
    expect(heatLevel(0, 250)).toBe(0);
    expect(heatLevel(-5, 250)).toBe(0);
    expect(heatLevel(250, 250)).toBe(1);
    expect(heatLevel(1000, 250)).toBe(1);
    expect(heatLevel(62.5, 250)).toBeCloseTo(0.5);
    const overlays = Object.fromEntries(Object.values(HEAT).map((h) => [h.map, { worldGet: () => h.max }])) as any;
    for (const layer of ["traffic", "pollution", "crime", "landValue", "population", "police", "fire"] as const) {
      const top = tileColour(layer, 0, 0, overlays, 0, 0);
      const base = dimmed(KIND_COLOURS.dirt);
      expect(top).not.toEqual(base);
    }
  });

  test("find the tile under a click, whatever size the map is drawn at", () => {
    const box = { left: 100, top: 50, width: 600, height: 600 };
    expect(tileAtPoint(100, 50, box, 200, 200)).toEqual({ x: 0, y: 0 });
    expect(tileAtPoint(699, 649, box, 200, 200)).toEqual({ x: 199, y: 199 });
    expect(tileAtPoint(400, 350, { ...box, width: 300, height: 300 }, 200, 200)).toBeNull();
    expect(tileAtPoint(99, 60, box, 200, 200)).toBeNull();
    expect(tileAtPoint(10, 10, { left: 0, top: 0, width: 0, height: 0 }, 200, 200)).toBeNull();
    expect(mapScale(200, 200)).toBe(3);
    expect(mapScale(120, 100)).toBe(5);
    expect(mapScale(1000, 10)).toBe(1);
  });

  test("have words for every layer and key in both languages", () => {
    for (const layer of MAP_LAYERS) {
      expect(isMapLayer(layer)).toBe(true);
      expect(hasKey(`map.layer.${stringId(layer)}`)).toBe(true);
      expect(hasKey(`map.about.${stringId(layer)}`)).toBe(true);
    }
    for (const kind of CITY_KEYS) expect(hasKey(`map.key.${stringId(kind)}`)).toBe(true);
    expect(stringId("landValue")).toBe("land_value");
    for (const key of ["map.title", "map.hint", "map.close", "map.key.powered", "map.key.unpowered", "map.key.low",
      "map.key.high", "map.power_count", "menu.map", "shortcut.map"]) expect(hasKey(key)).toBe(true);
    expect(isMapLayer("nope")).toBe(false);
  });
});
