/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { groupViewBox, projectNationalMap } from "../src/geo/nationalMap";
import {
  BASE_FUNDS, difficultyStars, fundsBonus, MapStats, provinceResources, startingFunds,
} from "../src/geo/provinceProfile";
import { hasKey } from "../src/i18n/index";

const dataDir = path.join(__dirname, "..", "data");
const provinceData = JSON.parse(fs.readFileSync(path.join(dataDir, "thailand-provinces.json"), "utf8"));
const presets: Array<{ provinceId: string; stats: MapStats }> = fs.readdirSync(path.join(dataDir, "maps"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dataDir, "maps", f), "utf8")));

describe("starting treasury", () => {
  test("open land gets the normal treasury, water and forest get more", () => {
    expect(startingFunds({ land: 1, water: 0, woods: 0 })).toBe(BASE_FUNDS);
    expect(startingFunds({ land: 0.6, water: 0.4, woods: 0 })).toBeGreaterThan(startingFunds({ land: 0.6, water: 0, woods: 0.4 }));
  });

  test("the bonus is capped at half the normal treasury", () => {
    expect(fundsBonus({ land: 0, water: 1, woods: 0 })).toBe(0.5);
    expect(startingFunds({ land: 0, water: 1, woods: 0 })).toBe(BASE_FUNDS * 1.5);
  });

  test("every province starts with a round amount between the normal and the capped treasury", () => {
    expect(presets).toHaveLength(77);
    for (const preset of presets) {
      const funds = startingFunds(preset.stats);
      expect(funds % 500).toBe(0);
      expect(funds).toBeGreaterThanOrEqual(BASE_FUNDS);
      expect(funds).toBeLessThanOrEqual(BASE_FUNDS * 1.5);
    }
  });
});

describe("difficulty", () => {
  test("follows the share of open land", () => {
    expect(difficultyStars({ land: 0.95, water: 0.05, woods: 0 })).toBe(1);
    expect(difficultyStars({ land: 0.8, water: 0.1, woods: 0.1 })).toBe(2);
    expect(difficultyStars({ land: 0.6, water: 0.4, woods: 0 })).toBe(3);
  });

  test("most provinces are easy and a few are hard", () => {
    const counts = [0, 0, 0];
    for (const preset of presets) counts[difficultyStars(preset.stats) - 1]++;
    expect(counts[0]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(0);
  });
});

describe("resources", () => {
  test("lists public tags first, then the land shares that matter", () => {
    const resources = provinceResources(["coast_gulf", "sensitive"], { land: 0.7, water: 0.2, woods: 0.1 });
    expect(resources.map((r) => r.key)).toEqual(["resource.coast_gulf", "resource.flat", "resource.forest", "resource.water"]);
    expect(resources.find((r) => r.key === "resource.water")?.pct).toBe(20);
  });

  test("internal tags never reach the player", () => {
    for (const province of provinceData.provinces) {
      const keys = provinceResources(province.tags, { land: 1, water: 0, woods: 0 }).map((r) => r.key);
      expect(keys.some((key) => key.includes("sensitive"))).toBe(false);
      for (const key of keys) expect(hasKey(key)).toBe(true);
    }
  });
});

describe("region text and zoom", () => {
  const map = projectNationalMap(JSON.parse(fs.readFileSync(path.join(dataDir, "geo", "thailand-provinces.topo.json"), "utf8")));

  test("every region has a description, strengths and challenges in both languages", () => {
    for (const region of provinceData.regions) {
      for (const part of ["desc", "pros", "cons"]) expect(hasKey(`region.${region.id}.${part}`)).toBe(true);
    }
    for (const stars of [1, 2, 3]) expect(hasKey(`picker.difficulty.${stars}`)).toBe(true);
  });

  test("every province has bounds inside the national map", () => {
    const [x, y, w, h] = map.viewBox;
    for (const p of map.provinces) {
      expect(p.bounds[0]).toBeGreaterThanOrEqual(x);
      expect(p.bounds[1]).toBeGreaterThanOrEqual(y);
      expect(p.bounds[2]).toBeLessThanOrEqual(x + w);
      expect(p.bounds[3]).toBeLessThanOrEqual(y + h);
    }
  });

  test("a region's view frames all its provinces and is smaller than the whole country", () => {
    for (const region of provinceData.regions) {
      const ids = new Set(provinceData.provinces.filter((p: { region: string }) => p.region === region.id).map((p: { id: string }) => p.id));
      const members = map.provinces.filter((p) => ids.has(p.id));
      const [x, y, w, h] = groupViewBox(members);
      for (const p of members) {
        expect(p.bounds[0]).toBeGreaterThanOrEqual(x);
        expect(p.bounds[3]).toBeLessThanOrEqual(y + h);
      }
      expect(w * h).toBeLessThan(map.viewBox[2] * map.viewBox[3]);
    }
    expect(groupViewBox([])).toEqual([0, 0, 0, 0]);
  });
});
