/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Census } from "../src/census.js";
import { graphSeries, LIVING_SERIES, linePoints, PEOPLE_SERIES, peopleMax } from "../src/cityGraphs";
import { hasKey } from "../src/i18n/index";

describe("city graphs", () => {
  test("read the census history oldest first, for both ranges", () => {
    const census = new (Census as unknown as new () => Record<string, number[]>)();
    census.resHist10[0] = 50; // newest sample
    census.resHist10[119] = 5; // oldest sample
    census.moneyHist120[0] = 200;
    const short = graphSeries(census, "10");
    const res = short.people.find((s) => s.id === "res")!;
    expect(res.values).toHaveLength(120);
    expect([res.values[0], res.values[119]]).toEqual([5, 50]);
    expect(graphSeries(census, "120").living.find((s) => s.id === "money")!.values[119]).toBe(200);
  });

  test("survive odd saves: missing or broken history draws as flat zero", () => {
    const series = graphSeries({ resHist10: [1, "x", null], comHist10: "nope" }, "10");
    expect(series.people.find((s) => s.id === "res")!.values).toEqual([0, 0, 1]);
    expect(series.people.find((s) => s.id === "com")!.values).toEqual([]);
  });

  test("scale the people chart to its largest visible value", () => {
    expect(peopleMax([{ id: "res", colour: "", values: [0, 3, 9] }, { id: "ind", colour: "", values: [12] }])).toBe(12);
    expect(peopleMax([])).toBe(1);
  });

  test("draw points across the width, the top at the maximum, and clamp values outside the scale", () => {
    expect(linePoints([0, 5, 10], 10, 100, 50)).toBe("0.0,50.0 50.0,25.0 100.0,0.0");
    expect(linePoints([20, -3], 10, 100, 50)).toBe("0.0,0.0 100.0,50.0");
    expect(linePoints([], 10, 100, 50)).toBe("");
  });

  test("every series has a name in both languages", () => {
    for (const { id } of [...PEOPLE_SERIES, ...LIVING_SERIES]) expect({ id, ok: hasKey(`graphs.${id}`) }).toEqual({ id, ok: true });
  });
});
