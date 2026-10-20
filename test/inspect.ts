/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What a click on the map shows (src/inspect.ts): a building's card from its object, or the road, water, woods and
// land there, as i18n keys every one of which is translated.

import { hasKey } from "../src/i18n/index";
import { homePeople, inspectAt } from "../src/inspect";
import { plotTile } from "../src/plots";
import { CityObjects } from "../src/objects/cityObjects";
import { POWERBIT, ZONEBIT } from "../src/tileFlags";
import { CZB, POLICESTATION } from "../src/tileValues";
import { HOUSE, POWERPLANT, RIVER, ROADS, RZB, WOODS } from "../src/tileValues";

function city() {
  const width = 30, height = 20, values = new Uint16Array(width * height), flags = new Uint16Array(width * height);
  const map: any = {
    width, height, values, powerKinds: {} as Record<string, string>, roadLevels: new Uint8Array(width * height).fill(1),
    landCover: new Uint8Array(width * height), insideProvince: null, paintedZones: false,
    getTileValue: (x: number, y: number) => values[y * width + x],
    getTileFlags: (x: number, y: number) => flags[y * width + x],
    testBounds: (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height,
    put(x: number, y: number, value: number, flag = 0) { values[y * width + x] = value; flags[y * width + x] = flag; },
  };
  const grid = (value: number) => ({ worldGet: () => value });
  const blockMaps = { landValueMap: grid(90), pollutionDensityMap: grid(10), crimeRateMap: grid(200) };
  const objects = new CityObjects(width, height);
  const look = (x: number, y: number) => {
    objects.scan(map, 96);
    return inspectAt({ map, objects, blockMaps, cityTime: 96, startingYear: 1900, language: "th",
      satisfaction: { blockMaps, budget: { cityTax: 7, comTax: 12, policePercent: 0.5 }, valves: { comValve: 1000 },
        services: { basic: 80, higher: 0, health: 30, people: 800 } } }, x, y);
  };
  return { map, look };
}

const keysOf = (found: any) => [found.title.key, ...found.facts.map((f: any) => f.key),
  ...found.facts.flatMap((f: any) => Object.values(f.params ?? {}).filter(v => typeof v === "string"))];

describe("the inspector", () => {
  test("a gas plant: its kind's name, the ruler's, no power, when it went up, the land round it", () => {
    const { map, look } = city();
    map.put(5, 5, POWERPLANT, ZONEBIT); map.powerKinds[5 * 30 + 5] = "gas";
    for (let x = 0; x < 30; x++) map.put(x, 8, ROADS);
    const found = look(6, 7)!;
    expect(found.title.key).toBe("tool.gas");
    expect(found.sector).toBe("central");
    expect(found.rect).toEqual({ x: 4, y: 4, width: 4, height: 4 });
    expect(found.facts.map(f => f.key)).toEqual(["object.fact.unpowered", "object.fact.built", "object.fact.land_value",
      "object.fact.pollution", "object.fact.crime"]);
    expect(found.facts[1].params).toEqual({ year: 1902 });
    expect(found.facts[2].params).toEqual({ grade: "object.grade.2" });
    expect(found.street?.key).toMatch(/^street\./);
    for (const key of keysOf(found)) expect(hasKey(key)).toBe(true);
  });

  test("homes say how many live there; a house is about twenty", () => {
    const { map, look } = city();
    map.put(2, 2, RZB + (1 * 4 + 1) * 9, ZONEBIT | POWERBIT);
    map.put(10, 10, HOUSE);
    const zone = look(2, 2)!, house = look(10, 10)!;
    expect(zone.title.key).toBe("object.kind.home");
    expect(zone.sector).toBe("community");
    expect(zone.facts.find(f => f.key === "object.fact.people")?.params).toEqual({ people: homePeople(3, 3, false) });
    expect(house.facts.find(f => f.key === "object.fact.people")?.params).toEqual({ people: 20 });
    expect(homePeople(5, 1, true)).toBe(Math.round(48 * 20 / 8));
    for (const key of [...keysOf(zone), ...keysOf(house)]) expect(hasKey(key)).toBe(true);
  });

  test("each kind is content in its own way, with its reasons biggest first", () => {
    const { map, look } = city();
    map.put(2, 2, RZB, ZONEBIT | POWERBIT);            // a home with power
    map.put(8, 2, CZB, ZONEBIT);                       // a shop without
    map.put(14, 2, POLICESTATION, ZONEBIT | POWERBIT); // police paid half their budget
    map.put(20, 2, POWERPLANT, ZONEBIT);               // a plant without power
    const home = look(2, 2)!.satisfaction!, shop = look(8, 2)!.satisfaction!;
    // Home: power +4, low pollution +4, high crime -5, good land +3, schools +3, health -2 (0 traffic, 7% tax)
    expect(home.score).toBe(50 + 4 + 4 - 5 + 3 + 3 - 2);
    expect(home.factors[0]).toEqual({ key: "satisfaction.crime", points: -5 });
    // Shop: no power -10, low pollution +2, high crime -6, good land +3, quiet street -1, market +5, 12% tax -2
    expect(shop.score).toBe(50 - 10 + 2 - 6 + 3 - 1 + 5 - 2);
    expect(look(14, 2)!.satisfaction).toEqual({ score: 50 + 6 - 15, factors: [
      { key: "satisfaction.budget", points: -15 }, { key: "satisfaction.power", points: 6 }] });
    expect(look(20, 2)!.satisfaction!.score).toBe(30);
    for (const s of [home, shop]) for (const f of s.factors) expect(hasKey(f.key)).toBe(true);
    expect(hasKey("object.satisfaction")).toBe(true);
  });

  test("roads, water, woods and open land", () => {
    const { map, look } = city();
    for (let x = 0; x < 30; x++) map.put(x, 12, ROADS);
    map.roadLevels[12 * 30 + 3] = 2;
    map.put(1, 1, RIVER); map.put(3, 1, WOODS);
    map.landCover[15 * 30 + 15] = 1;
    const road = look(3, 12)!;
    expect(road.title.key).toBe("object.kind.road");
    expect(road.facts[0]).toEqual({ key: "object.fact.road_level", params: { road: "tool.road_asphalt" } });
    expect(road.street?.key).toBe("street.road");
    expect(look(1, 1)!.title.key).toBe("object.kind.water");
    expect(look(3, 1)!.title.key).toBe("object.kind.woods");
    expect(look(15, 15)!.title.key).toBe("object.cover.1");
    expect(look(20, 3)!.title.key).toBe("object.kind.land");
    expect(look(40, 3)).toBeNull();
    for (const found of [road, look(15, 15)!, look(20, 3)!]) for (const key of keysOf(found)) expect(hasKey(key)).toBe(true);
  });

  test("a painted plot shows its level checklist in place of the lines on its level, power and water", () => {
    const { map, look } = city();
    map.paintedZones = true;
    for (let x = 0; x < 30; x++) map.put(x, 12, ROADS);
    map.put(5, 11, plotTile("residential", 2), POWERBIT);
    map.put(8, 11, plotTile("commercial", 0));
    const home = look(5, 11)!;
    expect(home.title.key).toBe("object.kind.home");
    expect(home.checklist).toMatchObject({ kind: "residential", level: 2, target: 3 });
    expect(home.checklist!.rows.slice(0, 2).map(row => [row.check, row.ok])).toEqual([["road", true], ["power", true]]);
    const keys = home.facts.map(f => f.key);
    for (const gone of ["object.fact.level", "object.fact.powered", "object.fact.unpowered"]) expect(keys).not.toContain(gone);
    expect(home.facts.find(f => f.key === "object.fact.people")?.params).toEqual({ people: homePeople(2, 1, true) });
    // An empty plot is named for what it waits to grow, with what its first building needs: here power
    const empty = look(8, 11)!;
    expect(empty.title.key).toBe("object.kind.plot.commercial");
    expect(empty.checklist).toMatchObject({ level: 0, target: 1, state: "power" });
    for (const found of [home, empty]) for (const key of keysOf(found)) expect(hasKey(key)).toBe(true);
  });
});
