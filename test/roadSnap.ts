/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Where a click of the road tools lands (src/roads/roadSnap.ts; owner, 22 Oct 2026: "จุด B มีจุด snap อยู่ ทำให้จุด B
// ชิดกว่านี้ และจุด A มีจุดให้ snap หลายจุดกว่านี้"), tried as a person's hand clicks (docs/design/LOOK_BOOK.md: "คลิกเยื้อง
// 5–20 พิกเซล"): the first point finds the road it is meant to start on, every later point lands within a few metres of
// the mouse unless a junction, an end or a road is truly under it.

import { type Metres } from "../src/roads/roadDraw";
import { MARK_STEP_M, marksAlong, NEXT_PIXELS, snapNext, snapPoints, snapStart, START_PIXELS, WAY_MAX_M, type SnapNet }
  from "../src/roads/roadSnap";

/** Metres a pixel: a 16 m tile 32 pixels across, as the game opens on a town */
const MPP = 0.5;

/** A T: a road east–west along z = 100 from x = 0 to 400, and one south from its middle; a two-lane road's half width */
const NET: SnapNet = {
  lines: [[[0, 100], [400, 100]], [[200, 100], [200, 400]]],
  nodes: [[200, 100]],
  half: [3.5, 3.5],
};

const dist = (p: readonly number[], q: readonly number[]): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** The same jittery hand every run: a point offset from q by 5 to 20 pixels in some direction */
function hand(seed: number) {
  let state = seed;
  const next = (): number => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  return {
    next,
    off(q: Metres, minPx = 5, maxPx = 20): Metres {
      const angle = next() * Math.PI * 2, px = minPx + next() * (maxPx - minPx);
      return [q[0] + Math.cos(angle) * px * MPP, q[1] + Math.sin(angle) * px * MPP];
    },
  };
}

describe("where a click of the road tools lands", () => {
  test("B clicked 5–20 px off a point in open land lands within a few metres of the mouse", () => {
    const h = hand(7);
    let moved = 0;
    for (let k = 0; k < 400; k++) {
      // A on the road, B somewhere south-east and south-west, at least 40 m from either road
      const a: Metres = [h.next() * 400, 100], meant: Metres = [h.next() < 0.5 ? 40 + h.next() * 120 : 240 + h.next() * 120, 140 + h.next() * 250];
      const p = h.off(meant), snap = snapNext(p, MPP, NET, a, [1, 0], 7);
      const landed = snap ? snap.point : p;
      expect(dist(landed, p)).toBeLessThanOrEqual(Math.min(WAY_MAX_M, NEXT_PIXELS.way * MPP) + 1e-9);
      if (snap) moved++;
    }
    // ... and only now and then onto a straight way, when the mouse is nearly on it
    expect(moved).toBeLessThan(100);
  });

  test("B nearly in line, far from A, stays at the mouse instead of swinging onto the line", () => {
    // 300 m from A, 5.7° off east: the old snap moved it 30 m onto east
    const p: Metres = [300, 330];
    expect(snapNext(p, MPP, NET, [0, 300], null, 7)).toBeNull();
    // ... while a mouse a pixel off east lands on it, a metre or less from where it was
    const near = snapNext([300, 300.5], MPP, NET, [0, 300], null, 7)!;
    expect(near.kind).toBe("angle");
    expect(near.point[1]).toBeCloseTo(300, 9);
  });

  test("B joins a road it is on or a few pixels off, at the road's middle line, and not one 20 px off", () => {
    const h = hand(3);
    for (let k = 0; k < 200; k++) {
      // The mouse within the road's edge and NEXT_PIXELS.road past it, away from the junction
      const x = 20 + h.next() * 150, side = (h.next() < 0.5 ? -1 : 1) * h.next() * (3.5 + NEXT_PIXELS.road * MPP);
      const snap = snapNext([x, 100 + side], MPP, NET, [x + 30, 250], null, 7)!;
      expect(snap.kind).toBe("road");
      expect(snap.point[1]).toBeCloseTo(100, 9);
      expect(snap.point[0]).toBeCloseTo(x, 9);
    }
    // 20 px (10 m) from the middle of a two-lane road is 6.5 m past its edge: where the mouse is
    expect(snapNext([100, 110], MPP, NET, [130, 250], null, 7)).toBeNull();
  });

  test("B lands on a junction only when the mouse is on it, not from 12 m down the road", () => {
    expect(snapNext([202, 102], MPP, NET, [50, 300], null, 7)).toMatchObject({ point: [200, 100], kind: "node" });
    expect(snapNext([212, 101], MPP, NET, [50, 300], null, 7)).toMatchObject({ point: [212, 100], kind: "road" });
    // Off the road's ground beside the junction, 14 px from it: where the mouse is
    expect(snapNext([207, 93], MPP, NET, [50, 300], null, 7)).toBeNull();
    // ... and a dead end the same
    expect(snapNext([398, 101], MPP, NET, [300, 300], null, 7)).toMatchObject({ point: [400, 100], kind: "end", way: [1, 0] });
    expect(snapNext([390, 101], MPP, NET, [300, 300], null, 7)).toMatchObject({ point: [390, 100], kind: "road" });
  });

  test("B never lands back on the point the line is drawn from", () => {
    const snap = snapNext([200.6, 100.4], MPP, NET, [200, 100], null, 7);
    expect(snap === null || dist(snap.point, [200, 100]) > 1).toBe(true);
  });

  test("A clicked 5–20 px off a road finds it: a point of its middle line, near the mouse", () => {
    const h = hand(11);
    for (let k = 0; k < 400; k++) {
      // Meant on the east–west road, away from the junction and its ends
      const meant: Metres = [20 + h.next() * 160, 100], p = h.off(meant);
      const snap = snapStart(p, MPP, NET)!;
      expect(["road", "mark"]).toContain(snap.kind);
      expect(snap.point[1]).toBeCloseTo(100, 9);
      // ... along the road no further than a mark's pull from where the mouse is
      expect(Math.abs(snap.point[0] - p[0])).toBeLessThanOrEqual(START_PIXELS.mark * MPP + 1e-9);
    }
  });

  test("A lands on the points along a road a few pixels from them, else just where the mouse is along it", () => {
    // The stretch from the junction to the east end, 200 m, in 25 parts of 8 m
    expect(marksAlong(NET, 0, 200, 240)).toEqual([200, 208, 216, 224, 232, 240].filter((s) => s > 200 && s < 400));
    expect(snapStart([209, 102], MPP, NET)).toMatchObject({ point: [208, 100], kind: "mark", way: [1, 0] });
    expect(snapStart([212, 103], MPP, NET)).toMatchObject({ point: [212, 100], kind: "road" });
    // Zoomed in, 10 pixels a metre, a mark's pull is less than half a metre
    expect(snapStart([208.6, 100.2], 0.1, NET)).toMatchObject({ point: [208.6, 100], kind: "road" });
    expect(MARK_STEP_M).toBe(8);
  });

  test("A lands on a junction or an end the mouse is right on, and on the road beside it otherwise", () => {
    expect(snapStart([201, 98], MPP, NET)).toMatchObject({ point: [200, 100], kind: "node", way: [1, 0] });
    expect(snapStart([203, 102.5], MPP, NET)).toMatchObject({ point: [200, 100], kind: "node" });
    expect(snapStart([200, 116], MPP, NET)!.kind).not.toBe("node");
    expect(snapStart([3, 101], MPP, NET)).toMatchObject({ point: [0, 100], kind: "end", way: [-1, 0] });
  });

  test("A away from the roads lands on the guideline a block of plots from a straight road, when the mouse is near it", () => {
    const spacing = 7 * 16;
    expect(snapStart([100, 214], MPP, NET, spacing)).toMatchObject({ point: [100, 212], kind: "guide", way: [1, 0] });
    const guide = snapStart([100, 214], MPP, NET, spacing)!.guide!;
    expect(guide[0][1]).toBeCloseTo(212, 9);
    expect(guide[1][1]).toBeCloseTo(212, 9);
    // ... beside the south road too, and nothing where no guideline is near
    expect(snapStart([313, 300], MPP, NET, spacing)).toMatchObject({ point: [312, 300], kind: "guide" });
    expect(snapStart([100, 240], MPP, NET, spacing)).toBeNull();
    expect(snapStart([100, 214], MPP, NET, 0)).toBeNull();
  });

  test("the dots shown are where a click lands: points along the roads for A, only junctions and ends for B", () => {
    const first = snapPoints([210, 102], 20, NET, true), later = snapPoints([210, 102], 20, NET, false);
    expect(first.filter((d) => d.kind === "node")).toEqual([{ point: [200, 100], kind: "node" }]);
    // ... on the east–west road those of its stretches either side of the junction, and on the south road its own
    expect(first.filter((d) => d.kind === "mark" && d.point[1] === 100).map((d) => d.point[0]).sort((a, b) => a - b))
      .toEqual([192, 208, 216, 224]);
    expect(first.some((d) => d.kind === "mark" && d.point[0] === 200)).toBe(true);
    // Every mark shown is one a click on it lands on
    for (const dot of first.filter((d) => d.kind === "mark")) expect(snapStart(dot.point, MPP, NET)!.point).toEqual(dot.point);
    expect(later.map((d) => d.kind)).toEqual(["node"]);
  });
});
