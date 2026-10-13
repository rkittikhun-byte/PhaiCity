/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Each province's resources (docs/PROVINCE_PROFILE.md): levels measured from the data, the game's inferences and the
// owner's own; the profiles file and its checks. The admin page's save is tested in test/geo/admin.test.mjs.

import * as fs from "fs";
import * as path from "path";
import { hasKey } from "../src/i18n/index";
import {
  checkProfilesData, MADE_UP, MAX_LEVEL, measuredLevels, provinceLevels, RESOURCE_IDS,
} from "../src/geo/provinceResources";

const root = path.join(__dirname, "..");
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const indicators = read("data/geo/province-indicators.json").provinces;
const profiles = read("data/province-profiles.json");
const provinceList = read("data/thailand-provinces.json").provinces as Array<{ id: string }>;
const key = (id: string) => id.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

describe("province resources", () => {
  test("every province is measured, and the profiles file is valid", () => {
    expect(Object.keys(indicators).sort()).toEqual(provinceList.map((p) => p.id).sort());
    for (const id of Object.keys(indicators)) expect(indicators[id].areaKm2).toBeGreaterThan(0);
    expect(checkProfilesData(profiles).problems).toEqual([]);
  });

  test("measured levels rank the provinces that have any of a resource into fifths, 1 to 5", () => {
    const made = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`TH-${10 + i}`, { tourism: i, water: 0 }]));
    const levels = measuredLevels(made);
    expect(levels["TH-10"].tourism).toBe(0);
    expect(levels["TH-11"].tourism).toBe(1);
    expect(levels["TH-19"].tourism).toBe(5);
    expect(Object.values(levels).every((l) => l.water === 0)).toBe(true);
    // Equal values share a level
    const tied = measuredLevels({ "TH-10": { tourism: 5 }, "TH-11": { tourism: 5 }, "TH-12": { tourism: 9 } });
    expect(tied["TH-10"].tourism).toBe(tied["TH-11"].tourism);
  });

  test("the real data gives sensible leaders", () => {
    const levels = measuredLevels(indicators);
    expect(levels["TH-50"].tourism).toBe(5); // Chiang Mai
    expect(levels["TH-83"].fishery).toBeGreaterThanOrEqual(4); // Phuket's coast
    expect(levels["TH-10"].farmland).toBeLessThanOrEqual(2); // Bangkok is town, not fields
    expect(levels["TH-35"].farmland).toBe(5); // Yasothon
    expect(levels["TH-58"].forest).toBe(5); // Mae Hong Son
  });

  test("the owner's level wins over the game's inference, which wins over the measurement", () => {
    const measured = { tourism: 3, lignite: undefined };
    const entry = { levels: { tourism: 1 }, inferred: { lignite: 4, tourism: 5 } };
    const levels = provinceLevels(measured, entry);
    expect(levels.find((l) => l.id === "tourism")).toEqual({ id: "tourism", level: 1, source: "owner" });
    expect(levels.find((l) => l.id === "lignite")).toEqual({ id: "lignite", level: 4, source: "inferred" });
    expect(levels.find((l) => l.id === "gold")).toEqual({ id: "gold", level: 0, source: "none" });
    expect(provinceLevels({ water: 2 }, undefined).find((l) => l.id === "water")?.source).toBe("measured");
    expect(levels.length).toBe(RESOURCE_IDS.length);
  });

  test("a bad profile is reported and left out, and comments are kept out of the way", () => {
    const { data, problems } = checkProfilesData({ version: 1, provinces: {
      "TH-52": { levels: { gold: 7, tin: 2 }, inferred: { unobtainium: 3 }, note: "ok", _why: "a comment" },
      "XX-01": { levels: {} },
      "TH-53": "no",
      "_note": "a comment",
    } });
    expect(problems).toEqual([
      "provinces.TH-52.levels.gold: must be a whole number 0–5",
      "provinces.TH-52.inferred.unobtainium: unknown resource",
      "provinces.XX-01: unknown province",
      "provinces.TH-53: not an object",
    ]);
    expect(data.provinces["TH-52"]).toEqual({ levels: { tin: 2 }, inferred: {}, note: "ok" });
    expect(checkProfilesData({ version: 2 }).problems).toEqual(["profiles.version: must be 1"]);
  });

  test("every resource has a name, what it brings and what it costs, in both languages", () => {
    for (const id of RESOURCE_IDS) {
      for (const part of ["level", "gain", "cost"]) expect([id, part, hasKey(`resource.${part}.${key(id)}`)]).toEqual([id, part, true]);
    }
    for (const extra of ["resource.gain_cost", "resource.inferred", "resource.made_up", "resource.protected", "resource.border"]) {
      expect(hasKey(extra)).toBe(true);
    }
    expect(MADE_UP).toEqual(["rareEarth"]);
    expect(MAX_LEVEL).toBe(5);
  });
});

