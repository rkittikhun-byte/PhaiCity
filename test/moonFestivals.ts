/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Loy Krathong and Yi Peng on the full-moon night (src/moonFestivals.ts; docs/GAME_DESIGN.md 20): held in their month,
// shown on the clock's first full-moon night after it, from dusk to midnight, once.

import { sunHours } from "../src/dayClock";
import { moonLit, moonPhase, SYNODIC_DAYS } from "../src/moon";
import { inFestivalNight, isFullMoonEvening, MoonFestivals, nextFullMoonEvening, NIGHT_BEGINS_BEFORE_SUNSET } from "../src/moonFestivals";

const NOV = 10;
const loy = [{ id: "loy_krathong", scale: "grand" }];

describe("the full-moon night", () => {
  test("comes once a lunation, and its moon is full at midnight", () => {
    const evenings: number[] = [];
    for (let d = 0; d < 300; d++) if (isFullMoonEvening(d)) evenings.push(d);
    expect(evenings.length).toBeGreaterThanOrEqual(Math.floor(300 / SYNODIC_DAYS));
    expect(evenings.length).toBeLessThanOrEqual(Math.ceil(300 / SYNODIC_DAYS));
    for (const d of evenings) expect(moonLit(moonPhase(d + 1))).toBeGreaterThan(0.99);
    for (let i = 1; i < evenings.length; i++) expect([29, 30]).toContain(evenings[i] - evenings[i - 1]);
  });

  test("runs from just before sunset to midnight", () => {
    const d = nextFullMoonEvening(0), set = sunHours(NOV).set;
    expect(inFestivalNight(d, set - NIGHT_BEGINS_BEFORE_SUNSET - 0.1, NOV)).toBe(false);
    expect(inFestivalNight(d, set, NOV)).toBe(true);
    expect(inFestivalNight(d, 23.9, NOV)).toBe(true);
    expect(inFestivalNight(d + 1, 0.2, NOV)).toBe(false);
    expect(inFestivalNight(d - 1, 20, NOV)).toBe(false);
  });
});

describe("Loy Krathong and Yi Peng wait for it", () => {
  test("held in its month, shown on the next full-moon night from dusk to midnight, and only once", () => {
    const festivals = new MoonFestivals(), night = nextFullMoonEvening(3), set = sunHours(NOV).set;
    // Held on a day well before the full moon: nothing yet, that day or any day before the night
    expect(festivals.update(loy, 100, 3, 20, NOV)).toEqual([]);
    for (let d = 4; d < night; d++) expect(festivals.update([], 101, d, 21, NOV)).toEqual([]);
    expect(festivals.update([], 101, night, 15, NOV)).toEqual([]);
    expect(festivals.showing).toBe(false);
    // ... then the night
    expect(festivals.update([], 101, night, set, NOV)).toEqual(loy);
    expect(festivals.update([], 101, night, 23.95, NOV)).toEqual(loy);
    expect(festivals.showing).toBe(true);
    // ... over at midnight, and not again at the next full moon
    expect(festivals.update([], 101, night + 1, 0.1, NOV)).toEqual([]);
    const next = nextFullMoonEvening(night + 2);
    expect(festivals.update([], 102, next, 21, NOV)).toEqual([]);
  });

  test("a month owes it once, however many frames it is held", () => {
    const festivals = new MoonFestivals(), night = nextFullMoonEvening(0);
    for (let i = 0; i < 5; i++) festivals.update(loy, 100, night, 20, NOV);
    festivals.update([], 100, night + 1, 1, NOV);
    // The same month, still held after its night, owes nothing more
    festivals.update(loy, 100, night + 1, 2, NOV);
    expect(festivals.update([], 100, nextFullMoonEvening(night + 2), 21, NOV)).toEqual([]);
    // ... a later year's does
    festivals.update(loy, 112, night + 3, 2, NOV);
    expect(festivals.update([], 113, nextFullMoonEvening(night + 3), 21, NOV)).toEqual(loy);
  });

  test("held on the full-moon night itself, it shows at once", () => {
    const festivals = new MoonFestivals(), night = nextFullMoonEvening(0);
    expect(festivals.update([{ id: "yi_peng", scale: "modest" }], 50, night, 21, NOV)).toEqual([{ id: "yi_peng", scale: "modest" }]);
  });

  test("a festival held quietly, or none of the moon's, owes nothing", () => {
    const festivals = new MoonFestivals(), night = nextFullMoonEvening(0);
    festivals.update([{ id: "loy_krathong", scale: "modest", quiet: true }, { id: "songkran", scale: "grand" },
      { id: "yi_peng", scale: "none" }], 3, 0, 9, NOV);
    expect(festivals.update([], 4, night, 21, NOV)).toEqual([]);
  });

  test("what is owed is kept with the city", () => {
    const festivals = new MoonFestivals(), night = nextFullMoonEvening(2);
    festivals.update(loy, 100, 1, 9, NOV);
    const again = MoonFestivals.fromJSON(JSON.parse(JSON.stringify(festivals.toJSON())));
    expect(again.update([], 101, night, 21, NOV)).toEqual(loy);
    expect(MoonFestivals.fromJSON(null).update([], 1, night, 21, NOV)).toEqual([]);
    expect(MoonFestivals.fromJSON({ owed: [["songkran", "grand"], "x"] }).update([], 1, night, 21, NOV)).toEqual([]);
  });
});
