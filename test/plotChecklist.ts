/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A home's, shop's or factory's level checklist (src/plotChecklist.ts, docs/GAME_DESIGN.md section 2): what its next
// level needs, ticked and crossed, read from what the simulation weighs, and the row holding it back the same one the
// simulation's own look at the plot finds (src/plots.ts plotFound, map.plotWhy).

import { hasKey } from "../src/i18n/index";
import { type PlotChecklist, plotChecklist } from "../src/plotChecklist";
import { PLOT_KINDS, PLOT_TOP, PLOT_WHY, type PlotKind, plotFound, plotTile } from "../src/plots";
import { Random } from "../src/random";
import { POWERBIT } from "../src/tileFlags";
import { ROADS } from "../src/tileValues";

const ROAD_Y = 4;

interface Place { land?: number; pollution?: number; crowd?: number; watered?: boolean; powered?: boolean }

/** A painted map with a road along ROAD_Y, the simulation's block maps and the water marks, each the same everywhere */
function world(place: Place = {}) {
  const width = 16, height = 16, values = new Uint16Array(width * height), flags = new Uint16Array(width * height);
  const watered = place.watered ?? true;
  const map: any = {
    width, height, paintedZones: true, roadLevels: null, plotWhy: null,
    water: { zoneWater: () => (watered ? 1 : 3) },
    getTileValue: (x: number, y: number) => values[y * width + x],
    getTileFlags: (x: number, y: number) => flags[y * width + x],
    getTile: (x: number, y: number) => ({ isPowered: () => (flags[y * width + x] & POWERBIT) !== 0 }),
    setTile(x: number, y: number, value: number, flag: number) { values[y * width + x] = value; flags[y * width + x] = flag; },
  };
  for (let x = 0; x < width; x++) map.setTile(x, ROAD_Y, ROADS, 0);
  const grid = (value: number) => ({ worldGet: () => value, worldSet: () => undefined });
  const blockMaps = {
    landValueMap: grid(place.land ?? 150), pollutionDensityMap: grid(place.pollution ?? 10),
    populationDensityMap: grid(place.crowd ?? 200), cityCentreDistScoreMap: grid(0), rateOfGrowthMap: grid(0),
  };
  const plot = (x: number, y: number, kind: PlotKind, level: number) =>
    map.setTile(x, y, plotTile(kind, level), (place.powered ?? true) ? POWERBIT : 0);
  return { map, blockMaps, plot, watered };
}

const valves = { resValve: 1000, comValve: 1000, indValve: 1000 };

function check(w: ReturnType<typeof world>, x: number, y: number, over: Partial<{ valves: typeof valves; services: any }> = {}) {
  return plotChecklist({ map: w.map, blockMaps: w.blockMaps, valves: over.valves ?? valves, services: over.services ?? null }, x, y)!;
}

const rowsOf = (list: PlotChecklist) => list.rows.map(row => `${row.ok ? "✓" : "✗"}${row.check}`);

/** Every key a checklist names, for the translation check */
function keysOf(list: PlotChecklist): string[] {
  const keys = list.rows.flatMap(row => [row.key, ...(row.hint ? [row.hint] : []),
    ...Object.values(row.params ?? {}).filter((v): v is string => typeof v === "string")]);
  if (list.state !== "growing" && list.state !== "top") keys.push(`plot.name.${list.state}`);
  for (const step of list.later) keys.push(...step.checks.map(c => `plot.later.${c}`));
  return keys;
}

describe("the level checklist", () => {
  test("a home with all it needs: every row ticked, it grows when its turn comes, and what later levels add", () => {
    const w = world();
    w.plot(5, 5, "residential", 2);
    const list = check(w, 5, 5);
    expect(list).toMatchObject({ kind: "residential", level: 2, top: 5, target: 3, state: "growing" });
    expect(rowsOf(list)).toEqual(["✓road", "✓power", "✓water", "✓demand", "✓land", "✓pollution", "✓crowd"]);
    expect(list.rows.every(row => !row.holds && !row.hint)).toBe(true);
    // Level 4 wants more people round it, level 5 a lot as well
    expect(list.later).toEqual([{ from: 4, to: 4, checks: ["crowd"] }, { from: 5, to: 5, checks: ["crowd", "lot"] }]);
  });

  test("what it lacks is crossed with what to do, and power holds it first, as the simulation looks", () => {
    const w = world({ powered: false, watered: false });
    w.plot(5, 5, "residential", 2);
    const list = check(w, 5, 5);
    expect(rowsOf(list).slice(0, 3)).toEqual(["✓road", "✗power", "✗water"]);
    expect(list.state).toBe("power");
    expect(list.rows.find(row => row.check === "power")).toMatchObject({ holds: true, hint: "plot.hint.power" });
    expect(list.rows.find(row => row.check === "water")).toMatchObject({ holds: false, hint: "plot.hint.water" });
  });

  test("an empty plot needs no water yet; its second level does", () => {
    const w = world({ watered: false });
    w.plot(5, 5, "commercial", 0);
    const list = check(w, 5, 5);
    expect(list.target).toBe(1);
    expect(rowsOf(list)).toEqual(["✓road", "✓power", "✓demand"]);
    // ... and levels in a row that add the same are told together
    expect(list.later).toEqual([{ from: 2, to: 2, checks: ["water", "land"] }, { from: 3, to: 4, checks: ["land"] },
      { from: 5, to: 5, checks: ["land", "lot"] }]);
  });

  test("a shop grows only as far as its land is worth", () => {
    const w = world({ land: 40 });
    w.plot(5, 5, "commercial", 2);
    const list = check(w, 5, 5);
    expect(list.state).toBe("land");
    expect(list.rows.find(row => row.check === "land")).toMatchObject({ ok: false, hint: "plot.hint.land_shop",
      params: { grade: "object.grade.1" } });
    w.plot(5, 5, "commercial", 1);
    expect(check(w, 5, 5).state).toBe("growing");
  });

  test("a factory needs no land, clean air or crowd; its top level needs a lot of four", () => {
    const w = world({ land: 0, pollution: 250, crowd: 0 });
    w.plot(4, 6, "industrial", 3);
    const list = check(w, 4, 6);
    expect(list.target).toBe(PLOT_TOP.industrial);
    expect(rowsOf(list)).toEqual(["✓road", "✓power", "✓water", "✓demand", "✗lot"]);
    expect(list.rows[4]).toMatchObject({ holds: true, params: { level: 3 }, hint: "plot.hint.lot" });
    // Four grown factories on the even 2 x 2 make the lot
    w.plot(5, 6, "industrial", 3); w.plot(4, 7, "industrial", 3); w.plot(5, 7, "industrial", 3);
    expect(check(w, 4, 6).state).toBe("growing");
  });

  test("no road within reach, or a road that leads nowhere it needs", () => {
    const w = world();
    w.plot(5, 12, "residential", 1);
    expect(check(w, 5, 12).rows[0]).toMatchObject({ check: "road", ok: false, key: "plot.check.road_none",
      params: { reach: 3 }, holds: true });
    w.plot(5, 5, "residential", 1);
    w.map.plotWhy = new Uint8Array(16 * 16);
    w.map.plotWhy[5 * 16 + 5] = PLOT_WHY.indexOf("road");
    expect(check(w, 5, 5).rows[0]).toMatchObject({ ok: false, key: "plot.check.route.residential",
      hint: "plot.hint.route.residential", holds: true });
  });

  test("at its top the rows are what keeps it there", () => {
    const w = world({ powered: false });
    w.plot(5, 5, "commercial", 5);
    const list = check(w, 5, 5);
    expect(list).toMatchObject({ target: null, later: [], state: "power" });
    expect(rowsOf(list)).toEqual(["✓road", "✗power", "✓water"]);
  });

  test("schools and health count for homes once the city has people enough", () => {
    const w = world();
    w.plot(5, 5, "residential", 1);
    expect(rowsOf(check(w, 5, 5, { services: { basic: 10, higher: 0, health: 10, people: 300 } }))).not.toContain("✗services");
    const low = check(w, 5, 5, { services: { basic: 10, higher: 0, health: 10, people: 3000 } });
    expect(low.rows.find(row => row.check === "services")).toMatchObject({ ok: false, key: "plot.check.services_low",
      params: { school: 10, health: 10 }, hint: "plot.hint.services" });
    // ... which only helps: it never holds a plot back
    expect(low.state).toBe("growing");
    expect(check(w, 5, 5, { services: { basic: 90, higher: 0, health: 80, people: 3000 } }).rows
      .find(row => row.check === "services")).toMatchObject({ ok: true, key: "plot.check.services" });
    // A village does not miss them yet
    expect(check(w, 5, 5, { services: { basic: 0, higher: 0, health: 0, people: 800 } }).rows
      .find(row => row.check === "services")).toMatchObject({ ok: true, key: "plot.check.services_enough" });
  });

  test("the row holding it is the one the simulation's own look at the plot finds", () => {
    const keys = new Set<string>();
    let compared = 0;
    for (const kind of PLOT_KINDS) for (let level = 0; level <= PLOT_TOP[kind]; level++)
      for (const powered of [true, false]) for (const watered of [true, false]) for (const valve of [-100, 400, 2000])
        for (const land of [10, 60, 200]) for (const pollution of [0, 100, 200]) for (const crowd of [10, 200]) {
          const w = world({ powered, watered, land, pollution, crowd });
          w.plot(6, 5, kind, level);
          const v = { resValve: valve, comValve: valve, indValve: valve };
          const list = check(w, 6, 5, { valves: v });
          keysOf(list).forEach(key => keys.add(key));
          // The simulation's look (the trips it sends always find their way here)
          Random.seed(compared + 1);
          w.map.plotWhy = new Uint8Array(16 * 16);
          const census = { resZonePop: 0, comZonePop: 0, indZonePop: 0, resPop: 0, comPop: 0, indPop: 0,
            poweredZoneCount: 0, unpoweredZoneCount: 0 };
          plotFound(w.map, 6, 5, { blockMaps: w.blockMaps, census, valves: v,
            trafficManager: { makeTrafficFrom: () => 1 },
            waterManager: { supplyPlot: (...args: unknown[]) => watered || !args[5] } } as any);
          const why = PLOT_WHY[w.map.plotWhy[5 * 16 + 6]];
          const expected = { none: "growing", top: "top", quiet: "crowd" }[why as string] ?? why;
          expect(`${kind} ${level} ${powered} ${watered} ${valve} ${land} ${pollution} ${crowd}: ${list.state}`)
            .toBe(`${kind} ${level} ${powered} ${watered} ${valve} ${land} ${pollution} ${crowd}: ${expected}`);
          compared++;
        }
    expect(compared).toBeGreaterThan(1000);
    expect([...keys].filter(key => !hasKey(key))).toEqual([]);
  });
});
