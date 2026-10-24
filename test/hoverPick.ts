/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Hover for everything (src/hoverPick.ts): the nearest object within a hand's reach with no flicker, the tooltip's
// lines per kind, nothing shown over the HUD or while dragging, and a tooltip kept inside the screen.

import { hasKey } from "../src/i18n/index";
import {
  chooseHover, HOVER_REACH_PX, hoverAllowed, type HoverCandidate, SAMPLE_OFFSETS, STICK_PX, tooltipLines, tooltipPlace,
  tooltipShows, TOOLTIP_REST_MS,
} from "../src/hoverPick";

const c = (key: string, cls: 0 | 1 | 2, dist: number): HoverCandidate => ({ key, cls, dist });

describe("which object a hand means", () => {
  it("takes the one under the pointer over a nearer-looking ring sample of another kind", () => {
    expect(chooseHover([c("road", 1, 0), c("home", 0, 16)], null)).toBe("road");
  });
  it("prefers a building to a road when both are about as near", () => {
    expect(chooseHover([c("road", 1, 8), c("home", 0, 8)], null)).toBe("home");
  });
  it("finds a building a few pixels off, and nothing past the reach", () => {
    expect(chooseHover([c("home", 0, 12)], null)).toBe("home");
    expect(chooseHover([c("home", 0, HOVER_REACH_PX + 1)], null)).toBeNull();
    expect(chooseHover([], null)).toBeNull();
  });
  it("counts an object found by several samples at its nearest", () => {
    expect(chooseHover([c("field", 2, 16), c("road", 1, 8), c("field", 2, 0)], null)).toBe("field");
  });
  it("keeps the held object until another is clearly nearer (no flicker)", () => {
    // the road is held; the home beside it is a little nearer, but not by the margin
    expect(chooseHover([c("road", 1, 8), c("home", 0, 8)], "road")).toBe("road");
    expect(chooseHover([c("road", 1, 4), c("home", 0, 4)], "road")).toBe("road");
    // ... until the home is clearly nearer, or the held one is out of reach
    expect(chooseHover([c("road", 1, 16), c("home", 0, 0)], "road")).toBe("home");
    expect(chooseHover([c("home", 0, 3)], "road")).toBe("home");
  });
  it("never flips back and forth between two objects as the pointer wobbles", () => {
    let held: string | null = null;
    const seen: Array<string | null> = [];
    // the pointer wobbles between a road and a shop beside it, each a few pixels nearer in turn
    for (let step = 0; step < 12; step++) {
      const wobble = (step % 2 === 0 ? 1 : -1) * 3;
      held = chooseHover([c("road", 1, 6 + wobble), c("shop", 0, 6 - wobble)], held);
      seen.push(held);
    }
    expect(new Set(seen).size).toBe(1);
    expect(STICK_PX).toBeGreaterThan(0);
  });
  it("samples the pointer's own pixel first and stays within the reach", () => {
    expect(SAMPLE_OFFSETS[0]).toEqual([0, 0, 0]);
    for (const [dx, dy, radius] of SAMPLE_OFFSETS) expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(radius + 1);
    expect(Math.max(...SAMPLE_OFFSETS.map((o) => o[2]))).toBe(HOVER_REACH_PX);
  });
});

describe("the tooltip's words", () => {
  const keys = (lines: ReturnType<typeof tooltipLines>) => lines.map((line) => line.map((p) => p.key));
  const known = (lines: ReturnType<typeof tooltipLines>) => lines.every((line) => line.every((p) => hasKey(p.key)));
  const base = { checklist: undefined, street: undefined };
  it("names a home with its level, and says its people", () => {
    const lines = tooltipLines({ ...base, title: { key: "object.kind.home" },
      facts: [{ key: "object.fact.level", params: { level: 2 } }, { key: "object.fact.powered" },
        { key: "object.fact.people", params: { people: 80 } }] });
    expect(keys(lines)).toEqual([["object.kind.home", "object.fact.level"], ["object.fact.people"]]);
    expect(known(lines)).toBe(true);
  });
  it("says what is going on with a building going up or standing empty first", () => {
    expect(keys(tooltipLines({ ...base, title: { key: "object.kind.factory" },
      facts: [{ key: "object.fact.going_up", params: { percent: 40 } }, { key: "object.fact.unpowered" }] }))[1])
      .toEqual(["object.fact.going_up"]);
    expect(keys(tooltipLines({ ...base, title: { key: "object.kind.shop" },
      facts: [{ key: "object.fact.vacant" }, { key: "object.fact.people", params: { people: 3 } }] }))[1])
      .toEqual(["object.fact.vacant"]);
    expect(keys(tooltipLines({ ...base, title: { key: "tool.police" },
      facts: [{ key: "site.months_left", params: { months: 4 } }] }))[1]).toEqual(["site.months_left"]);
  });
  it("says a missing power or water supply", () => {
    expect(keys(tooltipLines({ ...base, title: { key: "object.kind.shop" },
      facts: [{ key: "object.fact.unpowered" }, { key: "object.fact.dry" }] }))[1]).toEqual(["object.fact.unpowered"]);
    expect(keys(tooltipLines({ ...base, title: { key: "object.kind.shop" }, facts: [{ key: "object.fact.dry" }] }))[1])
      .toEqual(["object.fact.dry"]);
  });
  it("tells a road's kind and street, then its load", () => {
    const lines = tooltipLines({ ...base, title: { key: "object.kind.road" },
      street: { key: "street.highway", params: { number: 2 } },
      facts: [{ key: "object.fact.road_level", params: { road: "tool.road" } }, { key: "object.fact.road_cars", params: { cars: 9, capacity: 20 } }] });
    expect(keys(lines)).toEqual([["object.fact.road_level", "street.highway"], ["object.fact.road_cars"]]);
    expect(known(lines)).toBe(true);
    // a road with no street and no trips yet is its kind alone
    expect(keys(tooltipLines({ ...base, title: { key: "object.kind.road" },
      facts: [{ key: "object.fact.road_level", params: { road: "tool.road" } }] }))).toEqual([["object.fact.road_level"]]);
  });
  it("tells a field's and a canal's level beside its name", () => {
    expect(keys(tooltipLines({ ...base, title: { key: "farm.kind.paddy" }, facts: [{ key: "object.fact.level", params: { level: 2 } }] })))
      .toEqual([["farm.kind.paddy", "object.fact.level"]]);
    expect(keys(tooltipLines({ ...base, title: { key: "object.kind.canal" },
      facts: [{ key: "object.fact.canal_level", params: { level: 1, name: "canal.level.1" } }] })))
      .toEqual([["object.kind.canal", "object.fact.canal_level"]]);
  });
  it("is at most two lines, and a title alone when there is nothing more", () => {
    expect(tooltipLines({ ...base, title: { key: "object.kind.rail" }, facts: [] })).toHaveLength(1);
    expect(tooltipLines({ ...base, title: { key: "object.kind.home" },
      facts: [{ key: "object.fact.people", params: { people: 1 } }, { key: "object.fact.unpowered" }, { key: "object.fact.dry" }] }).length)
      .toBeLessThanOrEqual(2);
  });
});

describe("when anything may show", () => {
  const free = { toolInHand: false, onCity: true, dragging: false, flying: false };
  it("outlines at once but names the thing only after the pointer rests", () => {
    expect(hoverAllowed(free)).toBe(true);
    expect(tooltipShows(free, TOOLTIP_REST_MS - 1)).toBe(false);
    expect(tooltipShows(free, TOOLTIP_REST_MS)).toBe(true);
  });
  it("shows nothing over the HUD, with a tool in hand, while dragging or flying", () => {
    for (const off of [{ onCity: false }, { toolInHand: true }, { dragging: true }, { flying: true }]) {
      const context = { ...free, ...off };
      expect(hoverAllowed(context)).toBe(false);
      expect(tooltipShows(context, 5000)).toBe(false);
    }
  });
});

describe("where the tooltip sits", () => {
  it("is below and right of the pointer, never over it", () => {
    const p = tooltipPlace(100, 100, 80, 24, 1000, 700);
    expect(p.x).toBeGreaterThan(100);
    expect(p.y).toBeGreaterThan(100);
  });
  it("turns to the other side and stays inside the screen near the edges", () => {
    const corner = tooltipPlace(990, 690, 80, 24, 1000, 700);
    expect(corner.x + 80).toBeLessThanOrEqual(1000);
    expect(corner.y + 24).toBeLessThanOrEqual(700);
    expect(corner.x + 80 <= 990 || corner.y + 24 <= 690).toBe(true);
    const top = tooltipPlace(2, 2, 80, 24, 1000, 700);
    expect(top.x).toBeGreaterThanOrEqual(0);
    expect(top.y).toBeGreaterThanOrEqual(0);
  });
});
