/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Many crops in the farm zone, chosen deterministically per family plot from the province's rules and the land's soil
// (src/farmCrops.ts, src/provinceRules.ts, data/province-rules.json; docs/GAME_DESIGN.md section 7.6).

import fs from "fs";
import path from "path";
import {
  cropOfPlot, cropScore, FARM_CROP_IDS, fieldCropAt, fieldCropOfCell, mapSeedOf, plotOfCell, resolveCropTable, soilAt,
  type CropMap, type FarmCropId,
} from "../src/farmCrops";
import { farmCellsOnTiles } from "../src/farmGrid";
import { fieldTile, kindCode, type FarmKind } from "../src/farmZone";
import { tooltipLines } from "../src/hoverPick";
import { formatTooltip } from "../src/hoverTip";
import { hasKey, setLanguage } from "../src/i18n/index";
import { inspectAt } from "../src/inspect";
import { CityObjects } from "../src/objects/cityObjects";
import { checkRulesData, resolveRules } from "../src/provinceRules";
import { HOUSE, ROADS, RZB } from "../src/tileValues";
import type { Cell } from "../src/zoneCells";

const RULES_JSON = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/province-rules.json"), "utf8"));
const RULES_DATA = checkRulesData(RULES_JSON).data;

const PROVINCE_REGION: Record<string, string> = {
  "TH-22": "east",
  "TH-40": "northeast",
};

function makeMap(opts: {
  width?: number; height?: number; provinceId?: string; region?: string; seed?: number;
  elev?: (x: number, y: number) => number;
} = {}): CropMap & { values: Uint16Array; heights: Float32Array; farmKinds: Uint8Array; put(x: number, y: number, v: number): void } {
  const width = opts.width ?? 60, height = opts.height ?? 40;
  const values = new Uint16Array(width * height);
  const heights = new Float32Array(width * height);
  const farmKinds = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      heights[y * width + x] = opts.elev ? opts.elev(x, y) : 10 + (x / width) * 30 + (y / height) * 10;
    }
  }
  const region = opts.region ?? (opts.provinceId ? PROVINCE_REGION[opts.provinceId] ?? null : null);
  const rules = (region || opts.provinceId) ? resolveRules(RULES_DATA, region, opts.provinceId ?? null) : null;
  return {
    width, height, values, heights, farmKinds,
    tileSizeM: 16, cellZones: true,
    provinceId: opts.provinceId ?? null,
    region,
    seed: opts.seed ?? 12345,
    farmZone: rules?.farmZone ?? null,
    getTileValue: (x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? values[y * width + x] : 0),
    getTileFlags: () => 0,
    put(x: number, y: number, v: number) { values[y * width + x] = v; },
  };
}

describe("farmCrops: province crop rules and deterministic family plots", () => {
  test("every crop key has Thai and English i18n strings", () => {
    for (const id of FARM_CROP_IDS) expect(hasKey(`farm.crop.${id}`)).toBe(true);
  });

  test("the same map gives the exact same crops twice", () => {
    const run = () => {
      const map = makeMap({ provinceId: "TH-40", seed: 2026 });
      const out: FarmCropId[] = [];
      for (const kind of ["paddy", "field", "orchard", "pond"] as const) {
        for (let x = 4; x < 52; x += 3) {
          for (let y = 4; y < 36; y += 4) out.push(fieldCropAt(map, x, y, kind));
        }
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  test("Khon Kaen (TH-40) grows glutinous rice, cassava, sugarcane and mango, and never durian, mangosteen, oil palm or shrimp", () => {
    const rules = resolveRules(RULES_DATA, "northeast", "TH-40");
    expect(rules.farmZone.crops.durian.weight).toBe(0);
    expect(rules.farmZone.crops.mangosteen.weight).toBe(0);
    expect(rules.farmZone.crops.oil_palm.weight).toBe(0);
    expect(rules.farmZone.crops.shrimp.weight).toBe(0);
    expect(rules.farmZone.crops.glutinous_rice.weight).toBeGreaterThan(rules.farmZone.crops.jasmine_rice.weight);

    const seen = new Set<FarmCropId>();
    for (const seed of [1, 7, 42, 99]) {
      const map = makeMap({
        provinceId: "TH-40", seed,
        elev: (x, y) => 150 + Math.sin(x * 0.2) * 25 + (y / 40) * 40,
      });
      for (const kind of ["paddy", "field", "orchard", "pond"] as const) {
        for (let x = 2; x < map.width - 2; x += 2) {
          for (let y = 2; y < map.height - 2; y += 2) {
            seen.add(fieldCropAt(map, x, y, kind));
          }
        }
      }
    }
    expect(seen.has("durian")).toBe(false);
    expect(seen.has("mangosteen")).toBe(false);
    expect(seen.has("oil_palm")).toBe(false);
    expect(seen.has("shrimp")).toBe(false);
    expect(seen.has("glutinous_rice")).toBe(true);
    expect(seen.has("cassava")).toBe(true);
    expect(seen.has("sugarcane")).toBe(true);
    expect(seen.has("mango")).toBe(true);
    expect(seen.has("fish")).toBe(true);
  });

  test("Chanthaburi (TH-22) grows durian on good, gently sloping upland ground, and not on flat waterlogged bottomland", () => {
    const hillMap = makeMap({
      provinceId: "TH-22", seed: 19,
      elev: (x, y) => (x < 6 ? 2 : 8 + (x - 6) * 0.55 + (y % 5) * 0.4),
    });
    const hillOrchards = new Set<FarmCropId>();
    for (let x = 14; x <= 42; x++) {
      for (let y = 6; y <= 32; y += 2) {
        const s = soilAt(hillMap, x, y);
        expect(s.rise).toBeGreaterThanOrEqual(4);
        expect(s.ground).toBeGreaterThan(0.2);
        hillOrchards.add(fieldCropAt(hillMap, x, y, "orchard"));
      }
    }
    expect(hillOrchards.has("durian")).toBe(true);

    // Waterlogged flat bottomland right on water vs well-drained foothill soil
    const wetSoil = { rise: 0.2, slope: 0, ground: 0.95, water: 0, town: 5 };
    const goodSoil = { rise: 12, slope: 1.5, ground: 0.55, water: 8, town: 10 };
    const durianSpec = resolveCropTable(hillMap).durian;
    expect(cropScore(durianSpec, goodSoil)).toBeGreaterThan(cropScore(durianSpec, wetSoil) * 2.5);
  });

  test("a family plot is one crop across all its cells (5-8 cells wide along the road x 11 rows deep)", () => {
    const map = makeMap({ width: 80, height: 50, provinceId: "TH-40", seed: 314 }) as any;
    for (let x = 5; x < 75; x++) map.put(x, 25, ROADS);
    const cells: Cell[] = farmCellsOnTiles(map, 8, 12, 70, 38, 6).filter((c: Cell) => c.nz > 0.9);
    expect(cells.length).toBeGreaterThan(200);

    const byPlot = new Map<string, Cell[]>();
    for (const c of cells) {
      const p = plotOfCell(map, c, mapSeedOf(map));
      const key = `${p.lineId}:${p.plotIndex}:${p.depthBand}`;
      let list = byPlot.get(key);
      if (!list) byPlot.set(key, list = []);
      list.push(c);
    }
    expect(byPlot.size).toBeGreaterThan(8);

    for (const [, plotCells] of byPlot) {
      const rows = new Set<number>(plotCells.map((c: Cell) => c.row));
      const bands = new Set([...rows].map((r: number) => Math.floor(r / 11)));
      expect(bands.size).toBe(1);
      for (const kind of ["paddy", "field", "orchard", "pond"] as FarmKind[]) {
        const crops = new Set(plotCells.map((c: Cell) => fieldCropOfCell(map, c, kind)));
        expect(crops.size).toBe(1);
      }
    }
  });

  test("neighbouring plots along a long road differ in at least a third of the pairs", () => {
    const map = makeMap({ width: 120, height: 40, provinceId: "TH-40", seed: 777 }) as any;
    for (let x = 4; x < 116; x++) map.put(x, 20, ROADS);
    const row0 = farmCellsOnTiles(map, 6, 18, 112, 26, 4)
      .filter((c: Cell) => c.row === 0 && c.nz > 0.9)
      .sort((a: Cell, b: Cell) => a.x - b.x);

    const plots: Array<{ idx: number; crop: FarmCropId }> = [];
    for (const c of row0) {
      const p = plotOfCell(map, c, mapSeedOf(map));
      if (!plots.length || plots[plots.length - 1].idx !== p.plotIndex) {
        plots.push({ idx: p.plotIndex, crop: fieldCropOfCell(map, c, "field") });
      }
    }
    expect(plots.length).toBeGreaterThanOrEqual(12);
    let diffs = 0;
    for (let i = 1; i < plots.length; i++) {
      if (plots[i].crop !== plots[i - 1].crop) diffs++;
    }
    expect(diffs / (plots.length - 1)).toBeGreaterThanOrEqual(1 / 3);
  });

  test("a weight-0 crop is never picked even when all other weights are tiny", () => {
    const map = makeMap({ provinceId: "TH-40", seed: 55 }) as any;
    const table = JSON.parse(JSON.stringify(resolveCropTable(map)));
    table.durian.weight = 0;
    for (const id of FARM_CROP_IDS) {
      if (table[id].kind === "orchard" && id !== "durian") table[id].weight = 0.01;
    }
    map.farmZone = { crops: table };
    for (let i = 0; i < 60; i++) {
      const crop = cropOfPlot(map, {
        lineId: 100, plotIndex: i, startSlot: i * 6, widthCells: 6, depthBand: 0, tileX: 20 + (i % 30), tileY: 20,
      }, "orchard");
      expect(crop).not.toBe("durian");
    }
  });

  test("a wrong rule value in farmZone.crops is refused by checkRulesData", () => {
    const base = { version: 1, regions: {}, provinces: {} };
    expect(checkRulesData({
      ...base,
      provinces: { "TH-40": { farmZone: { crops: { unknown_crop: { weight: 0.5 } } } } },
    }).problems.join(" ")).toMatch(/unknown crop/i);

    expect(checkRulesData({
      ...base,
      provinces: { "TH-40": { farmZone: { crops: { maize: { weight: -0.2 } } } } },
    }).problems.join(" ")).toMatch(/weight/i);

    expect(checkRulesData({
      ...base,
      provinces: { "TH-40": { farmZone: { crops: { maize: { rise: [80, 10] } } } } },
    }).problems.join(" ")).toMatch(/rise/i);

    expect(checkRulesData({
      ...base,
      provinces: { "TH-40": { farmZone: { crops: { maize: { kind: "orchard" } } } } },
    }).problems.join(" ")).toMatch(/kind/i);
  });

  test("inspector card and hover tooltip format crop name and level in Thai and English", () => {
    const map = makeMap({ width: 30, height: 20, provinceId: "TH-40", seed: 12 }) as any;
    const table = JSON.parse(JSON.stringify(resolveCropTable(map)));
    for (const id of FARM_CROP_IDS) if (table[id].kind === "field") table[id].weight = id === "maize" ? 1 : 0;
    map.farmZone = { crops: table };
    map.getTileFlags = () => 0;
    map.testBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
    map.put(10, 10, fieldTile(3));
    map.farmKinds[10 * map.width + 10] = kindCode("field");

    const grid = (v: number) => ({ worldGet: () => v });
    const blockMaps = { landValueMap: grid(80), pollutionDensityMap: grid(0), crimeRateMap: grid(0) };
    const objects = new CityObjects(map.width, map.height);
    const found = inspectAt({ map, objects, blockMaps, cityTime: 48, startingYear: 1950, language: "th" }, 10, 10)!;
    expect(found.title.key).toBe("farm.crop.maize");
    expect(found.facts[0]).toEqual({ key: "object.fact.level", params: { level: 3 } });

    const lines = tooltipLines(found);
    setLanguage("th");
    expect(formatTooltip(lines)).toBe("ไร่ข้าวโพด ระดับ 3");
    setLanguage("en");
    expect(formatTooltip(lines)).toBe("Maize field, level 3");
    setLanguage("th");
  });

  test("a province layer in the rules that sets durian.weight is what fieldCropAt uses", () => {
    const customData = checkRulesData({
      version: 1,
      regions: {
        northeast: {
          farmZone: {
            crops: {
              mango: { weight: 0.01 },
              papaya: { weight: 0 },
              banana: { weight: 0 },
              coconut: { weight: 0 },
              longan: { weight: 0 },
              durian: { weight: 0 },
              mangosteen: { weight: 0 },
              oil_palm: { weight: 0 },
              rubber: { weight: 0 },
              vegetables: { weight: 0 },
            },
          },
        },
      },
      provinces: {
        "TH-40": {
          farmZone: {
            crops: {
              durian: { weight: 0.95 },
            },
          },
        },
      },
    }).data;

    const rulesWithDurian = resolveRules(customData, "northeast", "TH-40");
    const map = makeMap({
      provinceId: "TH-40",
      region: "northeast",
      seed: 91,
      elev: (x) => (x < 6 ? 2 : 12 + (x - 6) * 0.4),
    }) as any;
    map.farmZone = rulesWithDurian.farmZone;

    const pickedWithDurian = new Set<FarmCropId>();
    for (let x = 14; x < 36; x += 2) {
      pickedWithDurian.add(fieldCropAt(map, x, 16, "orchard"));
    }
    expect(pickedWithDurian.has("durian")).toBe(true);

    const rulesWithoutDurian = resolveRules(customData, "northeast", null);
    const mapWithout = makeMap({
      provinceId: "TH-40",
      region: "northeast",
      seed: 91,
      elev: (x) => (x < 6 ? 2 : 12 + (x - 6) * 0.4),
    }) as any;
    mapWithout.farmZone = rulesWithoutDurian.farmZone;
    for (let x = 14; x < 36; x += 2) {
      expect(fieldCropAt(mapWithout, x, 16, "orchard")).toBe("mango");
    }
  });

  test("changing ground.stores and adding a building near a plot leaves its crop unchanged", () => {
    const width = 60, height = 40;
    const natural = new Uint8Array(width * height).fill(4);
    const stores = new Uint8Array(width * height).fill(200);
    const map = makeMap({ width, height, provinceId: "TH-40", seed: 404 }) as any;
    map.ground = { natural, stores };
    map.town = { x: 30, y: 20 };
    for (let x = 6; x < 54; x++) map.put(x, 20, ROADS);

    const cells: Cell[] = farmCellsOnTiles(map, 8, 16, 50, 26, 4).filter((c: Cell) => c.nz > 0.9);
    expect(cells.length).toBeGreaterThan(40);

    const beforeCells = cells.map((c: Cell) => ({
      paddy: fieldCropOfCell(map, c, "paddy"),
      field: fieldCropOfCell(map, c, "field"),
      orchard: fieldCropOfCell(map, c, "orchard"),
    }));
    const beforeTiles: FarmCropId[] = [];
    for (let x = 8; x < 50; x += 2) {
      for (let y = 16; y < 26; y += 2) {
        beforeTiles.push(fieldCropAt(map, x, y, "field"), fieldCropAt(map, x, y, "orchard"));
      }
    }

    // Dry out seasonal groundwater stores and build houses / residential zones right beside the plots
    stores.fill(0);
    map.put(12, 19, HOUSE);
    map.put(18, 21, RZB);
    map.put(26, 19, HOUSE);
    map.put(34, 21, RZB);

    const afterCells = cells.map((c: Cell) => ({
      paddy: fieldCropOfCell(map, c, "paddy"),
      field: fieldCropOfCell(map, c, "field"),
      orchard: fieldCropOfCell(map, c, "orchard"),
    }));
    const afterTiles: FarmCropId[] = [];
    for (let x = 8; x < 50; x += 2) {
      for (let y = 16; y < 26; y += 2) {
        afterTiles.push(fieldCropAt(map, x, y, "field"), fieldCropAt(map, x, y, "orchard"));
      }
    }

    expect(afterCells).toEqual(beforeCells);
    expect(afterTiles).toEqual(beforeTiles);
  });
});
