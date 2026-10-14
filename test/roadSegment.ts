/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A stretch of road as an object (src/objects/roadSegment.ts): clicking any of its tiles shows the whole stretch from
// junction to junction, how long it is, and the zone cells facing it.

import { hasKey } from "../src/i18n/index";
import { inspectAt } from "../src/inspect";
import { roadSegmentAt, roadSegments } from "../src/objects/roadSegment";
import { CityObjects } from "../src/objects/cityObjects";

function roadMap() {
  const width = 40, height = 30, values = new Uint16Array(width * height);
  // A road along row 10 and a branch down column 20: three stretches meeting at (20, 10)
  for (let x = 2; x < 38; x++) values[10 * width + x] = 66;
  for (let y = 11; y < 25; y++) values[y * width + 20] = 66;
  return { width, height, tileSizeM: 16, roadLevels: null, values, landCover: null, insideProvince: null,
    getTileValue: (x: number, y: number) => values[y * width + x], getTileFlags: () => 0,
    testBounds: (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height } as any;
}

describe("road segments", () => {
  test("the roads are stretches from junction to junction, each found from any of its tiles", () => {
    const map = roadMap();
    expect(roadSegments(map)).toHaveLength(3);
    const branch = roadSegmentAt(map, 20, 18)!;
    expect(branch.kind).toBe("road");
    expect(branch.sector).toBe("central");
    expect(branch.tiles).toContain(18 * 40 + 20);
    expect(branch.lengthM).toBeGreaterThan(14 * 16 - 20);
    expect(roadSegmentAt(map, 5, 5)).toBeNull();
  });

  test("its card says how long it is and outlines the whole stretch", () => {
    const map = roadMap();
    const found = inspectAt({ map, objects: new CityObjects(40, 30), blockMaps: null, cityTime: 0, startingYear: 1900,
      language: "th" } as any, 20, 18)!;
    expect(found.title.key).toBe("object.kind.road");
    expect(found.facts.find(f => f.key === "object.fact.length")?.params?.metres).toBeGreaterThan(200);
    expect(found.path?.length).toBeGreaterThan(10);
    expect(hasKey("object.fact.length") && hasKey("object.fact.traffic") && hasKey("object.fact.cells")).toBe(true);
  });
});
