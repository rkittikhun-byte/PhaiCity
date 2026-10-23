/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The loading screen between the province card and the city (src/loadingScreen.ts; owner, 18 Oct 2026): what it lists,
// in both languages, and how far along it says the city is.

import { hasKey } from "../src/i18n/index";
import { countLoad, loadCount } from "../src/loadingProgress";
import { LoadingSteps, LOAD_STEPS, stepKey, stepsFor } from "../src/loadingScreen";

describe("the loading screen", () => {
  test("a province's city lists every step; a saved or practice city has no heights to fetch", () => {
    expect(stepsFor("province")).toEqual([...LOAD_STEPS]);
    for (const source of ["saved", "practice"] as const) {
      expect(stepsFor(source)).not.toContain("heights");
      expect(stepsFor(source)).toContain("map");
    }
  });

  test("every step and state has words in both languages", () => {
    for (const source of ["province", "saved", "practice"] as const) {
      for (const step of stepsFor(source)) expect(hasKey(stepKey(step, source))).toBe(true);
    }
    for (const key of ["loading.title", "loading.title_practice", "loading.music", "loading.music_theme"]) {
      expect(hasKey(key)).toBe(true);
    }
    for (const region of ["north", "northeast", "central", "east", "west", "south"]) expect(hasKey(`region.${region}.short`)).toBe(true);
  });

  test("a step never goes back, and the bar counts the surfaces as they arrive", () => {
    const steps = new LoadingSteps(stepsFor("saved"));
    const none = { requested: 0, finished: 0 };
    expect(steps.progress(none)).toBe(0);
    steps.mark("map", "done");
    steps.mark("map", "loading");
    expect(steps.state("map")).toBe("done");
    steps.mark("rules", "failed");
    expect(steps.progress(none)).toBeCloseTo(2 / steps.steps.length);
    // Half the surfaces in counts half a step
    expect(steps.progress({ requested: 10, finished: 5 })).toBeCloseTo(2.5 / steps.steps.length);
    for (const step of steps.steps) steps.mark(step, "done");
    expect(steps.progress(none)).toBe(1);
    // A step the city does not load is not added
    steps.mark("heights", "loading");
    expect(steps.states.has("heights")).toBe(false);
  });

  test("the one line names the step loading now, else the next one waiting", () => {
    // Owner, 18 Oct 2026: "แสดงเป็นบันทัดเดียว"
    const steps = new LoadingSteps(stepsFor("province"));
    expect(steps.current()).toBe("map");
    steps.mark("map", "done");
    steps.mark("view", "loading");
    expect(steps.current()).toBe("view");
    steps.mark("view", "done");
    expect(steps.current()).toBe("heights");
    for (const step of steps.steps) steps.mark(step, "done");
    expect(steps.current()).toBe("buildings");
  });

  test("loads are counted until they settle, whether they arrive or fail", async () => {
    const before = loadCount("test");
    let finish!: () => void;
    const arriving = countLoad("test", new Promise<void>((resolve) => { finish = resolve; }));
    const failing = countLoad("test", Promise.reject(new Error("no file"))).catch(() => undefined);
    expect(loadCount("test").requested).toBe(before.requested + 2);
    await failing;
    expect(loadCount("test").finished).toBe(before.finished + 1);
    finish();
    await arriving;
    expect(loadCount("test").finished).toBe(before.finished + 2);
  });
});
