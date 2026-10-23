/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The player's pace of the game's time (src/gamePace.ts; owner, 23 Oct 2026): slow, normal or fast, how long a month
// takes at every speed, kept for this browser, and the simulation spacing its steps by it.

import { gamePaceFactor, getGamePace, onGamePace, reloadGamePace, setGamePace } from "../src/gamePace";
import { Simulation } from "../src/simulation.js";

describe("the pace of the game's time", () => {
  beforeEach(() => { try { window.localStorage.clear(); } catch { /* none */ } reloadGamePace(); });

  test("is normal at first, and slow and fast stretch and shorten a month", () => {
    expect(getGamePace()).toBe("normal");
    expect(gamePaceFactor()).toBe(1);
    setGamePace("slow");
    expect(gamePaceFactor()).toBe(2);
    setGamePace("fast");
    expect(gamePaceFactor()).toBe(0.5);
  });

  test("is kept for this browser and tells whoever listens", () => {
    const heard: string[] = [];
    const stop = onGamePace((pace) => heard.push(pace));
    setGamePace("slow");
    stop();
    setGamePace("fast");
    expect(heard).toEqual(["slow"]);
    // (kept where the browser keeps anything: Jest's Node has no localStorage, and then a reload is the default again)
    const keeps = typeof window !== "undefined" && !!window.localStorage;
    expect(reloadGamePace()).toBe(keeps ? "fast" : "normal");
  });

  test("ignores what is not a pace", () => {
    setGamePace("slow");
    setGamePace("ludicrous" as never);
    expect(getGamePace()).toBe("slow");
  });

  test("spaces the simulation's steps, and only takes a sensible factor", () => {
    const sim = { _pace: 1 } as { _pace: number };
    (Simulation.prototype as unknown as { setPace(this: typeof sim, f: unknown): void }).setPace.call(sim, 2);
    expect(sim._pace).toBe(2);
    (Simulation.prototype as unknown as { setPace(this: typeof sim, f: unknown): void }).setPace.call(sim, -1);
    expect(sim._pace).toBe(1);
  });
});
