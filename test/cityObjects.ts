/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's objects (src/objects/): one base class, a class per kind, found on the tiles and kept in step with them.

import { Building, CentralService, CityObject, CommunityBuilding } from "../src/objects/cityObject";
import { Civic, Factory, Home, PowerPlant, Shop } from "../src/objects/buildings";
import { CityObjects } from "../src/objects/cityObjects";
import { POWERBIT, ZONEBIT } from "../src/tileFlags";
import { BUS_STOP, CIVIC, CZB, FARM, HARBOUR, HOUSE, IZB, MINE, NUCLEAR, POWERPLANT, RZB } from "../src/tileValues";
import { CityCore } from "../src/core/cityCore";
import { MapGenerator } from "../src/mapGenerator.js";

function city(width = 30, height = 20) {
  const values = new Uint16Array(width * height), flags = new Uint16Array(width * height);
  return {
    width, height, values, flags, powerKinds: {} as Record<string, string>, civicKinds: {} as Record<string, string>,
    paintedZones: false,
    getTileValue: (x: number, y: number) => values[y * width + x],
    getTileFlags: (x: number, y: number) => flags[y * width + x],
    put(x: number, y: number, value: number, flag = 0) { values[y * width + x] = value; flags[y * width + x] = flag; },
  };
}

describe("city objects", () => {
  test("every kind is a class under one base, found from its centre tile", () => {
    const c = city();
    c.put(2, 2, RZB + (1 * 4 + 2) * 9, ZONEBIT);          // homes, land class 1, density 2
    c.put(6, 2, CZB + (2 * 5 + 4) * 9, ZONEBIT | POWERBIT); // shops, land class 2, density 4
    c.put(10, 2, IZB + (1 * 4 + 3) * 9, ZONEBIT);         // factories, type 1, size 3
    c.put(15, 3, POWERPLANT, ZONEBIT); c.powerKinds[3 * 30 + 15] = "gas";
    c.put(21, 3, NUCLEAR, ZONEBIT);
    c.put(2, 8, CIVIC, ZONEBIT); c.civicKinds[8 * 30 + 2] = "primary_school";
    c.put(8, 8, HOUSE + 4);
    c.put(10, 8, BUS_STOP);
    const objects = new CityObjects(30, 20);
    objects.scan(c, 7);
    expect(objects.size).toBe(8);
    const home = objects.at(1, 1)!;
    expect(home).toBeInstanceOf(Home);
    expect(home).toBeInstanceOf(Building);
    expect(home).toBeInstanceOf(CityObject);
    expect((home as Home).level(c)).toBe(4);
    expect((home as Home).landClass(c)).toBe(1);
    expect(objects.at(7, 3)).toBeInstanceOf(Shop);
    expect((objects.at(7, 3) as Shop).level(c)).toBe(5);
    expect(objects.at(10, 2)).toBeInstanceOf(Factory);
    const gas = objects.at(17, 5)!;  // a 4 × 4 plant covers (14..17, 2..5)
    expect(gas).toBeInstanceOf(PowerPlant);
    expect(gas.sort(c)).toBe("gas");
    expect(objects.at(18, 5)).toBeNull();
    expect(objects.at(21, 3)!.sort(c)).toBe("nuclear");
    expect(objects.at(3, 9)).toBeInstanceOf(Civic);
    expect(objects.at(3, 9)!.sort(c)).toBe("primary_school");
    expect(objects.at(8, 8)!.kind).toBe("home");
    expect((objects.at(8, 8) as Home).level(c)).toBe(1);
    expect(objects.at(10, 8)!.kind).toBe("bus_stop");
    expect(objects.all().every(o => o.built === 7)).toBe(true);
    // The community's buildings and the central services
    expect(home).toBeInstanceOf(CommunityBuilding);
    expect(objects.all().filter(o => o.sector === "community").map(o => o.kind).sort())
      .toEqual(["factory", "home", "home", "shop"]);
    expect(gas).toBeInstanceOf(CentralService);
    expect(objects.all().filter(o => o instanceof CentralService).length).toBe(4);
  });

  test("farms and harbours are the community's, mines the ruler's concessions", () => {
    const c = city();
    c.put(2, 2, FARM, ZONEBIT); c.put(6, 2, HARBOUR, ZONEBIT); c.put(10, 2, MINE, ZONEBIT);
    const objects = new CityObjects(30, 20); objects.scan(c, 0);
    expect([objects.at(2, 2)!.sector, objects.at(6, 2)!.sector, objects.at(10, 2)!.sector])
      .toEqual(["community", "community", "central"]);
  });

  test("a card's facts: level, land, sort and power, as i18n keys", () => {
    const c = city();
    c.put(6, 2, CZB + (2 * 5 + 4) * 9, ZONEBIT | POWERBIT);
    c.put(15, 3, POWERPLANT, ZONEBIT); c.powerKinds[3 * 30 + 15] = "solar";
    const objects = new CityObjects(30, 20); objects.scan(c, 0);
    expect(objects.at(6, 2)!.facts(c)).toEqual([
      { key: "object.fact.level", params: { level: 5 } },
      { key: "object.fact.land_class", params: { land: "object.land.2" } },
      { key: "object.fact.powered" },
    ]);
    expect(objects.at(15, 3)!.facts(c)).toEqual([
      { key: "object.fact.sort", params: { sort: "object.sort.solar" } },
      { key: "object.fact.unpowered" },
    ]);
  });

  test("a scan keeps what still stands, stamps what is new and drops what is gone", () => {
    const c = city();
    c.put(2, 2, RZB, ZONEBIT); c.put(8, 8, HOUSE);
    const objects = new CityObjects(30, 20);
    objects.scan(c, 5);
    const home = objects.at(2, 2)!;
    c.put(2, 2, RZB + 9, ZONEBIT);   // it grew: still the same home
    c.put(8, 8, 0);                  // the house burned down
    c.put(15, 3, POWERPLANT, ZONEBIT);
    const { added, removed } = objects.scan(c, 9);
    expect(objects.at(2, 2)).toBe(home);
    expect(home.built).toBe(5);
    expect(removed.map(o => o.kind)).toEqual(["home"]);
    expect(added.map(o => [o.kind, o.built])).toEqual([["power_plant", 9]]);
    expect(objects.at(8, 8)).toBeNull();
  });

  test("a save keeps when each went up", () => {
    const c = city();
    c.put(2, 2, RZB, ZONEBIT); c.put(15, 3, POWERPLANT, ZONEBIT);
    const objects = new CityObjects(30, 20);
    objects.scan(c, 3);
    c.put(20, 10, HOUSE); objects.scan(c, 11);
    const saved = JSON.parse(JSON.stringify(objects));
    expect(saved).toHaveLength(6);
    const again = CityObjects.restore(c, saved);
    expect(again.all().map(o => [o.kind, o.built]).sort()).toEqual([["home", 11], ["home", 3], ["power_plant", 3]]);
  });

  test("on a painted map each grown plot is a building of its own", () => {
    const c = city(); c.paintedZones = true;
    c.put(4, 4, HOUSE + 2);          // a house: home level 1
    c.put(5, 4, CZB - 4 + 9 * 2);    // a shop plot, level 3
    const objects = new CityObjects(30, 20); objects.scan(c, 0);
    expect(objects.at(5, 4)).toBeInstanceOf(Shop);
    expect((objects.at(5, 4) as Shop).level(c)).toBe(3);
    expect(objects.at(5, 4)!.size).toBe(1);
  });

  test("the ruler's buildings come from the list of those put down, with where each stands in metres", () => {
    const map = (MapGenerator as any).fromPresetCells(60, 40, new Uint8Array(60 * 40));
    map.tileSizeM = 16;
    const core = new CityCore({ map, seed: 11 });
    core.simulation.budget.setFunds(1000000);
    (core.map as any).needsRulerHouse = false;
    core.apply({ type: "build", tool: "police", x: 330.4, z: 251.7, rot: 0.5, stroke: 1 });
    core.apply({ type: "tool", tool: "gas", x: 40, y: 10, stroke: 2 });
    const objects = new CityObjects(60, 40);
    objects.scan(core.map as any, 3);
    const police = objects.at(19, 16)!, plant = objects.at(41, 11)!;
    expect(police.kind).toBe("police");
    expect(police.placed).toMatchObject({ x: 330.4, z: 251.7, rot: 0.5, tool: "police" });
    expect(plant).toBeInstanceOf(PowerPlant);
    expect(plant.placed).toMatchObject({ tool: "gas", x: 656, z: 176, rot: null });
    // Moved along its road: the same object, where it stands now
    core.apply({ type: "move", id: 1, x: 334, z: 250, rot: 1.25, stroke: 3 });
    const { added, removed } = objects.scan(core.map as any, 4);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(objects.at(20, 15)).toBe(police);
    expect(police.built).toBe(3);
    expect(police.placed).toMatchObject({ x: 334, z: 250, rot: 1.25 });
    // Bulldozed: gone, though the list keeps it until a save leaves it out
    core.apply({ type: "tool", tool: "bulldozer", x: 20, y: 15 });
    expect(objects.scan(core.map as any, 5).removed).toEqual([police]);
  });
});
