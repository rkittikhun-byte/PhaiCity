/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The unlock table (src/unlocks.ts, docs/GAME_DESIGN.md 6.2): every tool has a row of plain data, and a tool is locked
// for its era, its trained people, what must stand first, or an early era's limit, in that order.

import { TOOL_NAMES } from "../src/cityCommands";
import { CIVIC, POWERPLANT, RAILBASE, ROADS } from "../src/tileValues";
import { noTrained } from "../src/trainedPeople";
import { FREE_TOOLS, type UnlockCity, unlockCity, type UnlockMap, unlockProblem, UNLOCKS } from "../src/unlocks";

const city = (over: Partial<UnlockCity> = {}): UnlockCity => ({
  era: 1, trained: noTrained(), trainedScale: 1, has: () => false, count: () => 0, ...over,
});

/** A 10 × 10 map: tile values by index, centres being zones */
function tiles(values: Record<number, number>, extra: Partial<UnlockMap> = {}): UnlockMap {
  return {
    width: 10, height: 10, era: 1, ...extra,
    getTileValue: (x, y) => values[y * 10 + x] ?? 0,
    getTile: (x, y) => ({ isZone: () => values[y * 10 + x] !== undefined }),
  };
}

describe("the unlock table", () => {
  test("every tool that builds has a row, and every row is a tool", () => {
    const tools = new Set<string>(TOOL_NAMES);
    for (const tool of TOOL_NAMES) expect(UNLOCKS[tool] !== undefined || FREE_TOOLS.includes(tool)).toBe(true);
    for (const tool of Object.keys(UNLOCKS)) expect(tools.has(tool)).toBe(true);
    for (const row of Object.values(UNLOCKS)) {
      expect([1, 2, 3, 4, 5]).toContain(row.era);
      for (const choices of row.first ?? []) {
        for (const need of choices) expect(need === "rail" || need === "paved_road" || tools.has(need)).toBe(true);
      }
    }
  });

  test("follows section 6.2: what each era brings", () => {
    const era = (tool: string) => UNLOCKS[tool].era;
    expect(["road", "canal", "residential", "farm", "fishing", "primary_school", "health_centre", "police_box",
      "fire_post", "landfill", "watertower", "coal"].map(era)).toEqual(Array(12).fill(1));
    expect(["road_asphalt", "gas", "secondary_school", "vocational_college", "community_hospital", "bus_stop",
      "train_station", "limestone_mine"].map(era)).toEqual(Array(8).fill(2));
    expect(["university", "provincial_hospital", "hydro", "road_concrete4", "port", "airport", "incinerator",
      "wastewater_plant"].map(era)).toEqual(Array(8).fill(3));
    expect(["solar", "wind", "metro_station", "motorway", "tollway", "regional_hospital", "recycling_plant",
      "waste_power_plant"].map(era)).toEqual(Array(8).fill(4));
    expect(["nuclear", "hsr_station"].map(era)).toEqual([5, 5]);
    expect(UNLOCKS.road_asphalt.trained).toEqual({ technician: 20 });
    expect(UNLOCKS.community_hospital.trained).toEqual({ nurse: 10 });
    expect(UNLOCKS.solar.trained).toEqual({ engineer: 200 });
    expect(UNLOCKS.hydro.months).toBe(12);
    expect(UNLOCKS.provincial_hospital.months).toBe(6);
  });

  test("the reasons come in order: era, trained people, what stands first, the early limit", () => {
    expect(unlockProblem("solar", city())).toEqual({ reason: "unlock.era", params: { era: 4 } });
    expect(unlockProblem("solar", city({ era: 4, trained: { ...noTrained(), engineer: 35 } })))
      .toEqual({ reason: "unlock.trained", params: { kind: "engineer", need: 200, have: 35 } });
    expect(unlockProblem("solar", city({ era: 4, trained: { ...noTrained(), engineer: 200 } }))).toBeNull();
    expect(unlockProblem("vocational_college", city({ era: 2 })))
      .toEqual({ reason: "unlock.first", params: { need: "secondary_school" } });
    expect(unlockProblem("vocational_college", city({ era: 2, has: (n) => n === "secondary_school" }))).toBeNull();
    expect(unlockProblem("industrial", city({ has: (n) => n === "gas" }))).toBeNull();
    expect(unlockProblem("coal", city())).toBeNull();
    expect(unlockProblem("coal", city({ count: () => 1 }))).toEqual({ reason: "unlock.limit", params: { count: 1, era: 2 } });
    expect(unlockProblem("coal", city({ era: 2, count: () => 1 }))).toBeNull();
    expect(unlockProblem("bulldozer", city())).toBeNull();
  });

  test("the mode scales the trained people needed, rounding up", () => {
    const trained = { ...noTrained(), engineer: 120 };
    expect(unlockProblem("solar", city({ era: 4, trained, trainedScale: 0.5 }))).toBeNull();
    expect(unlockProblem("solar", city({ era: 4, trained: { ...noTrained(), engineer: 299 }, trainedScale: 1.5 })))
      .toEqual({ reason: "unlock.trained", params: { kind: "engineer", need: 300, have: 299 } });
  });

  test("the city's buildings, from its map: a site counts toward a limit but does not stand for what needs it", () => {
    const map = tiles({ 11: POWERPLANT, 44: CIVIC, 77: CIVIC }, {
      powerKinds: { 11: "lignite" }, civicKinds: { 44: "primary_school", 77: "secondary_school" }, sites: { 77: {} },
      era: 2, trained: { counts: { technician: 25.9, nurse: 0, engineer: 0, doctor: 0 } },
    });
    const c = unlockCity(map);
    expect(c.era).toBe(2);
    expect(c.trained.technician).toBe(25);
    expect(c.count("coal")).toBe(1);
    expect(c.has("coal")).toBe(true);
    expect(c.has("primary_school")).toBe(true);
    expect(c.count("secondary_school")).toBe(1);
    expect(c.has("secondary_school")).toBe(false);
    expect(c.has("rail")).toBe(false);
    expect(c.has("paved_road")).toBe(false);
    const roads = unlockCity(tiles({ 5: RAILBASE, 6: ROADS }, { roadLevels: Object.assign(new Uint8Array(100), { 6: 2 }) }));
    expect(roads.has("rail")).toBe(true);
    expect(roads.has("paved_road")).toBe(true);
  });
});
