/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The water supply (docs/WATER_PLAN.md): groundwater from the land, drawn down by pumping and filled by the rains,
// water running along the roads from powered water works, zones taking their shares, the dry season and the towers,
// and the city map's two water layers.

import { dimmed, KIND_COLOURS, layerPixels, MAP_LAYERS, tileColour, waterCounts, DRY, GROUND_BLUE, PIPE, WATERED,
  type Overlays } from "../src/cityMap";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import {
  computeGroundwater, drawGroundwater, fullStores, GROUNDWATER_FULL, GROUNDWATER_MAX, GROUNDWATER_MIN, pumpFactor,
  rechargeGroundwater, UNITS_PER_LEVEL,
} from "../src/groundwater";
import { GROUNDWATER_LOW, NOT_ENOUGH_WATER } from "../src/messages";
import { BNCNBIT, BULLBIT, BURNBIT, POWERBIT, ZONEBIT } from "../src/tileFlags";
import { DIRT, FREEZ, RIVER, ROADS, WATER_TOWER, WATER_WORKS, WATER_WORKS_BASE } from "../src/tileValues";
import {
  carriesWater, TOWER_STORE, WaterManager, WORKS_SUPPLY, ZONE_DRY, ZONE_THIRSTY, ZONE_WATERED,
} from "../src/waterManager";

interface TestMap {
  width: number;
  height: number;
  getTileValue(x: number, y: number): number;
  getTileFlags(x: number, y: number): number;
  setTile(x: number, y: number, value: number, flags: number): void;
}

const newMap = (w: number, h: number): TestMap => new (GameMap as unknown as new (w: number, h: number) => TestMap)(w, h);

/** A water works centred on (x, y), with power unless told otherwise. */
function putWorks(map: TestMap, x: number, y: number, powered = true): void {
  let tile = WATER_WORKS_BASE;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const centre = dx === 0 && dy === 0;
      map.setTile(x + dx, y + dy, tile++, BNCNBIT | (centre ? ZONEBIT : 0) | (powered ? POWERBIT : 0));
    }
  }
}

function road(map: TestMap, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) map.setTile(x, y, ROADS, BULLBIT | BURNBIT);
}

const census = () => ({ waterWorksPop: 0, waterTowerPop: 0, wateredZoneCount: 0, dryZoneCount: 0 });

describe("groundwater", () => {
  test("is fullest at open water and falls off with distance, never below a little", () => {
    const map = newMap(40, 10);
    for (let y = 0; y < 10; y++) map.setTile(0, y, RIVER, 0);
    const levels = computeGroundwater(map);
    expect(levels[0]).toBe(GROUNDWATER_MAX);
    expect(levels[1]).toBe(GROUNDWATER_MAX - 1); // land never reaches open water's level
    expect(levels[6]).toBeLessThan(levels[2]);
    expect(levels[39]).toBe(GROUNDWATER_MIN);
    for (let x = 1; x < 40; x++) expect(levels[x]).toBeLessThanOrEqual(levels[x - 1]);
  });

  test("is lower on ground that stands above the nearest water", () => {
    const map = newMap(10, 2);
    map.setTile(0, 0, RIVER, 0);
    map.setTile(0, 1, RIVER, 0);
    const flat = computeGroundwater(map, new Float32Array(20));
    const heights = new Float32Array(20);
    for (let x = 0; x < 10; x++) heights[10 + x] = 15 * x; // the second row climbs a hill
    const hilly = computeGroundwater(map, heights);
    expect(hilly[10 + 4]).toBeLessThan(flat[10 + 4]);
    expect(hilly[4]).toBe(flat[4]);
  });

  test("a works draws most under itself, never from open water, and the rains fill it back to the land's level", () => {
    const map = newMap(20, 20);
    map.setTile(10, 6, RIVER, 0);
    const natural = computeGroundwater(map);
    const full = fullStores(natural);
    const stores = full.slice();
    drawGroundwater(stores, natural, 20, 20, 10, 10, 20);
    expect(full[10 * 20 + 10] - stores[10 * 20 + 10]).toBe(20);
    expect(full[10 * 20 + 13] - stores[10 * 20 + 13]).toBeLessThan(20);
    expect(full[10 * 20 + 13] - stores[10 * 20 + 13]).toBeGreaterThan(0);
    expect(stores[6 * 20 + 10]).toBe(full[6 * 20 + 10]); // the river
    expect(stores[10 * 20 + 15]).toBe(full[10 * 20 + 15]); // beyond the reach

    drawGroundwater(stores, natural, 20, 20, 10, 10, 5000);
    expect(stores[10 * 20 + 10]).toBe(0);

    for (let month = 0; month < 600; month++) rechargeGroundwater(stores, natural);
    expect([...stores]).toEqual([...full]);
  });

  test("ground near water fills faster than dry ground far from it", () => {
    const natural = Uint8Array.from([6, 1]);
    const stores = Uint8Array.from([0, 0]);
    rechargeGroundwater(stores, natural);
    expect(stores[0] / (6 * UNITS_PER_LEVEL)).toBeGreaterThan(stores[1] / UNITS_PER_LEVEL);
  });

  test("a works pumps in proportion to the ground under its 3 x 3", () => {
    const stores = new Uint8Array(25).fill(GROUNDWATER_FULL);
    expect(pumpFactor(stores, 5, 5, 2, 2, 3)).toBe(1);
    stores.fill(0, 0, 25);
    expect(pumpFactor(stores, 5, 5, 2, 2, 3)).toBe(0);
  });
});

describe("the water supply", () => {
  test("pipes are every road, bridge and level crossing, and nothing else", () => {
    expect([64, 66, 76, 77, 206, 207, 237, 238, 828, 951].every(carriesWater)).toBe(true);
    expect([0, 2, 208, 224, 225, 240, WATER_WORKS].some(carriesWater)).toBe(false);
  });

  test("runs from a powered works along the roads it touches, to the zones beside them", () => {
    const map = newMap(40, 20);
    putWorks(map, 5, 5);
    road(map, 4, 30, 7); // touches the works' bottom side
    road(map, 4, 30, 15); // not joined to it
    const water = new WaterManager(map);
    water.prepareGround(null);
    water.findSources();
    water.doWaterScan(5, false);
    expect(water.view.hasWater(20, 7)).toBe(true);
    expect(water.view.hasWater(20, 15)).toBe(false);
    expect(water.supply).toBe(Math.floor(WORKS_SUPPLY * GROUNDWATER_MIN / GROUNDWATER_MAX));

    water.clearCycle();
    const counts = census();
    expect(water.supplyZone(20, 9, counts)).toBe(true); // its top side touches the road
    expect(water.supplyZone(20, 12, counts)).toBe(false);
    expect(counts).toEqual({ waterWorksPop: 0, waterTowerPop: 0, wateredZoneCount: 1, dryZoneCount: 1 });
    water.clearCycle(); // the scan's marks show once it is complete
    expect(water.view.zoneWater(19, 8)).toBe(ZONE_WATERED);
    expect(water.view.zoneWater(20, 12)).toBe(ZONE_THIRSTY);
    expect(water.view.zoneWater(25, 12)).toBe(0);
  });

  test("an unpowered works gives no water", () => {
    const map = newMap(20, 12);
    putWorks(map, 5, 5, false);
    road(map, 4, 15, 7);
    const water = new WaterManager(map);
    water.prepareGround(null);
    water.findSources();
    water.doWaterScan(5, false);
    expect(water.supply).toBe(0);
    expect(water.view.hasWater(10, 7)).toBe(false);
  });

  test("runs out: the zones the scan reaches last go dry, and the news hears of it once a cycle", () => {
    const map = newMap(80, 12);
    putWorks(map, 2, 5);
    road(map, 1, 79, 7);
    const water = new WaterManager(map);
    const warnings: unknown[] = [];
    water.addEventListener(NOT_ENOUGH_WATER, (value) => warnings.push(value));
    water.prepareGround(null);
    water.findSources();
    water.doWaterScan(5, false);
    water.clearCycle();
    const results = [];
    for (let x = 5; x < 77; x += 3) results.push(water.supplyZone(x, 9));
    expect(results.filter(Boolean).length).toBe(water.supply);
    expect(results.indexOf(false)).toBe(water.supply);
    expect(warnings.length).toBe(1);
    // A zone without water that needs none at its size is dry, not thirsty
    water.supplyZone(70, 9, null, false);
    water.clearCycle();
    expect(water.view.zoneWater(70, 9)).toBe(ZONE_DRY);
  });

  test("the dry season takes its share, and towers on the pipes give some back", () => {
    const map = newMap(30, 12);
    putWorks(map, 5, 5);
    road(map, 4, 25, 7);
    map.setTile(20, 8, WATER_TOWER, BURNBIT | BULLBIT); // beside the road
    map.setTile(20, 2, WATER_TOWER, BURNBIT | BULLBIT); // far from any pipe
    const water = new WaterManager(map);
    water.prepareGround(null);
    water.drought = { months: [1], share: 0.5 };
    water.findSources();
    const full = WORKS_SUPPLY * GROUNDWATER_MIN / GROUNDWATER_MAX;
    water.doWaterScan(5, false); // June
    expect(water.supply).toBe(Math.floor(full));
    water.doWaterScan(0, false); // January: half lost, one tower on the pipes makes up to TOWER_STORE of it
    expect(water.supply).toBe(Math.floor(full * 0.5 + Math.min(full * 0.5, TOWER_STORE)));
    map.setTile(20, 8, DIRT, 0);
    water.findSources();
    water.doWaterScan(0, false);
    expect(water.supply).toBe(Math.floor(full * 0.5));
  });

  test("pumping hard runs the ground low, and the rains fill it again", () => {
    const map = newMap(30, 20);
    for (let x = 0; x < 30; x++) map.setTile(x, 0, RIVER, 0);
    putWorks(map, 10, 6);
    road(map, 8, 28, 8);
    const water = new WaterManager(map);
    water.prepareGround(null);
    water.drought = { months: [1, 2, 3, 4, 12], share: 0.3 };
    const startFactor = pumpFactor(water.stores!, 30, 20, 10, 6, 3);

    // Every cycle the zones take all the water there is, for ten years
    let month = 0;
    for (let cycle = 0; cycle < 48 * 10; cycle++) {
      water.clearCycle();
      water.findSources();
      for (let k = 0; k < water.supply; k++) water.supplyZone(13, 10);
      if (cycle % 4 === 0) month = (cycle / 4) % 12;
      water.doWaterScan(month, cycle % 4 === 0);
    }
    const drawn = pumpFactor(water.stores!, 30, 20, 10, 6, 3);
    expect(drawn).toBeLessThan(startFactor * 0.8);

    // No one takes any water for three years: the ground fills again
    for (let cycle = 0; cycle < 48 * 3; cycle++) {
      water.clearCycle();
      water.findSources();
      if (cycle % 4 === 0) month = (cycle / 4) % 12;
      water.doWaterScan(month, cycle % 4 === 0);
    }
    expect(pumpFactor(water.stores!, 30, 20, 10, 6, 3)).toBeGreaterThan(drawn);
  });

  test("warns once a year at most when a works' ground falls below half, with the place", () => {
    const map = newMap(20, 20);
    putWorks(map, 10, 10);
    road(map, 8, 18, 12);
    const water = new WaterManager(map);
    const warnings: unknown[] = [];
    water.addEventListener(GROUNDWATER_LOW, (value) => warnings.push(value));
    water.prepareGround(null);
    water.stores!.fill(0);
    water.findSources();
    for (let month = 0; month < 24; month++) water.doWaterScan(month % 12, true);
    expect(warnings).toEqual([{ x: 10, y: 10 }, { x: 10, y: 10 }]);
  });

  test("saves what is in the ground, and a city from before the water supply starts full", () => {
    const map = newMap(20, 10);
    map.setTile(0, 0, RIVER, 0);
    const water = new WaterManager(map);
    water.prepareGround(null);
    drawGroundwater(water.stores!, water.natural!, 20, 10, 5, 5, 50);
    const saved: Record<string, unknown> = {};
    water.save(saved);
    expect(typeof saved.groundwater).toBe("string");

    const loaded = new WaterManager(map);
    loaded.load(saved);
    loaded.prepareGround(null);
    expect([...loaded.stores!]).toEqual([...water.stores!]);

    const old = new WaterManager(map);
    old.load({});
    old.prepareGround(null);
    expect([...old.stores!]).toEqual([...fullStores(old.natural!)]);

    const broken = new WaterManager(map);
    broken.prepareGround(null);
    broken.load({ groundwater: "12:x" });
    expect([...broken.stores!]).toEqual([...fullStores(broken.natural!)]);
  });
});

describe("the water supply in the simulation", () => {
  test("a works by the road waters the zones beside it, and the census counts them", () => {
    const map = newMap(120, 100) as TestMap & Record<string, unknown>;
    const { Simulation } = jest.requireActual("../src/simulation.js");
    const sim: any = new Simulation(map, 0, 3, null);
    const tools: any = new (GameTools as any)(map);
    sim.budget.setFunds(50000);
    const build = (tool: string, x: number, y: number) => {
      tools[tool].doTool(x, y, sim.blockMaps);
      expect(tools[tool].modifyIfEnoughFunding(sim.budget)).toBe(true);
    };
    build("coal", 11, 11); // the plant on 10..13
    build("waterworks", 15, 11); // touching the plant, so powered
    for (let x = 14; x < 40; x++) build("road", x, 13); // touches the works' bottom side
    for (let k = 0; k < 6; k++) build("residential", 18 + 3 * k, 15);
    for (let k = 0; k < 6; k++) build("residential", 18 + 3 * k, 11); // above the road, touching each other
    for (let step = 0; step < 16 * 8; step++) sim._simulate(sim._constructSimData());

    expect(sim._census.waterWorksPop).toBe(1);
    expect(sim._census.wateredZoneCount).toBeGreaterThan(0);
    expect(map.water).toBe(sim.blockMaps.water);
    expect(sim.blockMaps.water.zoneWater(18, 15)).toBe(ZONE_WATERED);
    expect(sim.blockMaps.water.groundwater(15, 11)).toBeGreaterThan(0);

    // Saved and loaded, the ground is the same
    const saved: Record<string, unknown> = {};
    sim.save(saved);
    expect(typeof saved.groundwater).toBe("string");
  });

  test("tells the city it needs running water when it has zones and no works", () => {
    const map = newMap(120, 100);
    const { Simulation } = jest.requireActual("../src/simulation.js");
    const Messages = jest.requireActual("../src/messages");
    const sim: any = new Simulation(map, 0, 3, null);
    const subjects: string[] = [];
    sim.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => subjects.push(m.subject));
    const tools: any = new (GameTools as any)(map);
    sim.budget.setFunds(50000);
    for (let k = 0; k < 12; k++) {
      tools.residential.doTool(10 + 3 * (k % 6), 10 + 4 * Math.floor(k / 6), sim.blockMaps);
      tools.residential.modifyIfEnoughFunding(sim.budget);
    }
    for (let step = 0; step < 16 * 70; step++) sim._simulate(sim._constructSimData());
    expect(subjects).toContain(Messages.NEED_WATER);
  });
});

describe("the city map's water layers", () => {
  const view = {
    zoneWater: (x: number) => (x === 1 ? ZONE_WATERED : x === 2 ? ZONE_DRY : x === 3 ? ZONE_THIRSTY : 0),
    hasWater: (x: number) => x === 4,
    groundwater: (x: number) => (x === 5 ? GROUNDWATER_FULL : x === 6 ? 0 : null),
  };
  const overlays = { water: view } as unknown as Overlays;

  test("are offered on the map", () => {
    expect(MAP_LAYERS).toEqual(expect.arrayContaining(["water", "groundwater"]));
  });

  test("show zones with water, without, the pipes and the works", () => {
    const dirt = KIND_COLOURS.dirt;
    expect(tileColour("water", FREEZ, 0, overlays, 1, 0)).toEqual(WATERED);
    expect(tileColour("water", FREEZ, 0, overlays, 2, 0)).toEqual(DRY);
    expect(tileColour("water", FREEZ, 0, overlays, 3, 0)).toEqual(DRY);
    expect(tileColour("water", ROADS, 0, overlays, 4, 0)).toEqual(PIPE);
    expect(tileColour("water", DIRT, 0, overlays, 7, 0)).toEqual(dimmed(dirt));
    expect(tileColour("water", WATER_WORKS, 0, overlays, 7, 0)).toEqual(WATERED);
    expect(tileColour("water", WATER_TOWER, 0, {} as Overlays, 7, 0)).toEqual(WATERED);
    expect(tileColour("water", FREEZ, 0, {} as Overlays, 1, 0)).toEqual(dimmed(KIND_COLOURS.residential));
  });

  test("shade the ground bluer where it holds more water, and the city as it is where nothing is known", () => {
    const full = tileColour("groundwater", DIRT, 0, overlays, 5, 0);
    const empty = tileColour("groundwater", DIRT, 0, overlays, 6, 0);
    expect(full[2]).toBeGreaterThan(empty[2]);
    expect(full[2]).toBeGreaterThan(GROUND_BLUE[2] * 0.8);
    expect(empty).toEqual(dimmed(KIND_COLOURS.dirt));
    expect(tileColour("groundwater", DIRT, 0, overlays, 9, 0)).toEqual(dimmed(KIND_COLOURS.dirt));
  });

  test("count zones with water and without, once each, at their centres", () => {
    const map = newMap(10, 3);
    map.setTile(1, 1, FREEZ, ZONEBIT);
    map.setTile(2, 1, FREEZ, ZONEBIT);
    map.setTile(3, 1, FREEZ, ZONEBIT);
    map.setTile(1, 0, FREEZ, 0); // not a centre
    expect(waterCounts(map, view)).toEqual({ watered: 1, dry: 2 });
    expect(waterCounts(map, undefined)).toEqual({ watered: 0, dry: 0 });
    expect(layerPixels("groundwater", map, overlays).length).toBe(10 * 3 * 4);
  });
});
