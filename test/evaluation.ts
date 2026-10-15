/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's yearly score and the people's approval (src/evaluation.js), as the original Micropolis works them out.

import { Evaluation } from "../src/evaluation.js";

/** The score a city of 20,000 gets this year when `moved` people came (or left), with nothing else wrong */
function scoreAfter(moved: number): number {
  const evaluation: any = new (Evaluation as any)(0);
  evaluation.cityPop = 20000;
  evaluation.cityPopDelta = moved;
  evaluation.cityScore = 600;
  const budget = { roadEffect: 32, MAX_ROAD_EFFECT: 32, policeEffect: 1000, fireEffect: 1000, averageTax: () => 7 };
  const census = { firePop: 0, unpoweredZoneCount: 0, poweredZoneCount: 100, crimeAverage: 0, pollutionAverage: 0,
    landValueAverage: 0, resPop: 0, comPop: 0, indPop: 0 };
  const empty = { gameMapWidth: 0, gameMapHeight: 0, blockSize: 1, worldGet: () => 0 };
  evaluation.doProblems(census, budget, { landValueMap: empty, trafficDensityMap: empty });
  evaluation.getScore({ census, budget, valves: { resValve: 0, comValve: 0, indValve: 0 } });
  return evaluation.cityScore;
}

describe("the city's score", () => {
  // Owner, 16 Oct 2026: the people's approval swung from 4% to 85% and back
  test("a few people leaving takes a little off the year's score, not all of it", () => {
    const steady = scoreAfter(0);
    const shrinking = scoreAfter(-200);
    expect(shrinking).toBeLessThan(steady);
    expect(shrinking).toBeGreaterThan(steady * 0.9);
    expect(scoreAfter(2000)).toBeGreaterThan(steady);
  });
});
