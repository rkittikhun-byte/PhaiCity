/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The frame of a district a city plays (src/cityFrame.ts, docs/DISTRICT_FRAME.md): the first frame round the town,
// growing as the city buys land near its edge, and a save moved to the bigger frame with everything where it was.

import { CityCore } from "../src/core/cityCore";
import { cropLayer, firstFrame, frameCenter, grownFrame, reframeSave, type Frame } from "../src/cityFrame";
import { GameMap } from "../src/gameMap.js";
import { MapGenerator } from "../src/mapGenerator.js";
import { Random } from "../src/random";

const BLOCK = 32;

/** A district's map of w × h tiles, all land, a laterite road along row 60, as the game builds a city's map of a frame */
function frameMap(frame: Frame, district = { width: 192, height: 192 }) {
  const cells = new Uint8Array(district.width * district.height), transport = new Uint8Array(district.width * district.height);
  for (let x = 0; x < district.width; x++) transport[60 * district.width + x] = 1;
  const crop = (layer: Uint8Array) => cropLayer(layer, district.width, frame);
  const map = (MapGenerator as any).fromPresetCells(frame.width, frame.height, crop(cells), crop(transport));
  map.nationalTransport = crop(transport);
  map.insideProvince = new Uint8Array(frame.width * frame.height).fill(1);
  map.tileSizeM = 16;
  map.paintedZones = true;
  return map;
}

describe("a district's frame", () => {
  test("a new city's frame is 15 blocks a side round its town, within the district", () => {
    expect(firstFrame({ width: 2624, height: 2912 }, { x: 1402, y: 1378 }, BLOCK)).toEqual({ x: (43 - 7) * 32, y: (43 - 7) * 32, width: 480, height: 480 });
    // Near the district's edge it is moved in, and a small district is all frame
    expect(firstFrame({ width: 2624, height: 2912 }, { x: 10, y: 10 }, BLOCK)).toMatchObject({ x: 0, y: 0 });
    expect(firstFrame({ width: 320, height: 256 }, { x: 100, y: 100 }, BLOCK)).toEqual({ x: 0, y: 0, width: 320, height: 256 });
  });

  test("the frame grows on a side where owned land comes near its edge, and only there", () => {
    const frame = { x: 320, y: 320, width: 480, height: 480 }, district = { width: 2624, height: 2912 };
    const blocks = new Uint8Array(15 * 15);
    for (let y = 6; y <= 8; y++) for (let x = 6; x <= 8; x++) blocks[y * 15 + x] = 1;
    expect(grownFrame(frame, blocks, district, BLOCK)).toBeNull();
    // Land bought two blocks from the east edge: the frame grows four blocks east
    blocks[7 * 15 + 13] = 1;
    expect(grownFrame(frame, blocks, district, BLOCK)).toEqual({ x: 320, y: 320, width: 480 + 128, height: 480 });
    // At the district's edge it cannot grow
    expect(grownFrame({ x: 2624 - 480, y: 320, width: 480, height: 480 }, blocks, district, BLOCK)).toBeNull();
  });

  test("a frame's middle on the earth moves with the frame", () => {
    const center = { lat: 16.4, lon: 102.8 }, district = { width: 2560, height: 2560 };
    expect(frameCenter(center, district, { x: 1040, y: 1040, width: 480, height: 480 }, 16)).toEqual(center);
    const east = frameCenter(center, district, { x: 1040 + 64, y: 1040, width: 480, height: 480 }, 16);
    expect(east.lat).toBeCloseTo(16.4);
    expect((east.lon - 102.8) * 111320 * Math.cos(16.4 * Math.PI / 180)).toBeCloseTo(64 * 16, 3);
  });

  test("a save moved to a bigger frame keeps every tile and record where it was on the district", () => {
    Random.seed(7);
    const from = { x: 64, y: 32, width: 96, height: 96 }, to = { x: 32, y: 0, width: 160, height: 160 };
    const map = frameMap(from), dx = from.x - to.x, dy = from.y - to.y;
    map.town = { x: 40, y: 26 };
    const core = new CityCore({ map, seed: 5 });
    core.simulation.budget.setFunds(500000);
    expect(core.apply({ type: "tool", tool: "ruler_house" as any, x: 40, y: 26 }).accepted).toBe(true);
    for (let x = 20; x < 80; x++) core.apply({ type: "tool", tool: "road", x, y: 40, stroke: 1, shape: "straight",
      controls: [[19.6, 40], [79, 40]] } as any);
    expect(core.apply({ type: "tool", tool: "coal" as any, x: 30, y: 37 }).accepted).toBe(true);
    expect(core.apply({ type: "tool", tool: "landfill" as any, x: 50, y: 37 }).accepted).toBe(true);
    core.map.buildingPoses[37 * 96 + 50] = [500, 380, 1];
    expect(core.apply({ type: "tool", tool: "bus_stop" as any, x: 60, y: 40 }).toolResult).toBe(0);
    expect(core.map.buses).toEqual([40 * 96 + 60]);
    core.run(100);
    const save = JSON.parse(JSON.stringify(core.save()));

    const fresh = frameMap(to), freshData: any = {};
    fresh.save(freshData);
    const moved = reframeSave(save, from, to, { map: freshData.map, inside: fresh.insideProvince, national: fresh.nationalTransport,
      roadLevels: null }, BLOCK);
    expect(save.width).toBe(96);
    expect(moved.frame).toEqual(to);

    const again = new CityCore({ map: new (GameMap as any)(160, 160), saved: moved });
    // Every tile of the old frame in the same place on the district
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      expect(again.map.getTileValue(x + dx, y + dy)).toBe(core.map.getTileValue(x, y));
    }
    // The new land is the district's: its road along row 60 (district) runs through it
    expect(again.map.getTileValue(5, 60)).toBe(fresh.getTileValue(5, 60));
    expect(again.map.isNationalTransport(5, 60)).toBe(true);
    expect(core.map.isNationalTransport(40, 60 - 32)).toBe(true);
    expect(again.map.isNationalTransport(40 + dx, 60 - 32 + dy)).toBe(true);
    // The records kept by tile
    const at = (x: number, y: number) => (y + dy) * 160 + x + dx;
    expect(again.map.powerKinds[at(30, 37)]).toBe("lignite");
    expect(again.map.civicKinds[at(40, 26)]).toBe("ruler_house");
    expect(again.map.wasteKinds).toEqual(Object.fromEntries(Object.entries(core.map.wasteKinds).map(([k, v]) => [String(at(Number(k) % 96, Math.floor(Number(k) / 96))), v])));
    expect(again.map.buildingPoses[at(50, 37)]).toEqual([500 + dx * 10, 380 + dy * 10, 1]);
    expect(again.map.buses).toEqual([at(60, 40)]);
    // ... and each building's era (src/eraScore.ts)
    expect(save.buildingEras).toEqual(expect.any(String));
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      expect(again.map.buildingEras[at(x, y)]).toBe(core.map.buildingEras[y * 96 + x]);
    }
    expect(again.map.buildingEras[0]).toBe(0);
    // ... and the drawn line each road tile was laid by (src/roadPieces.ts)
    expect(again.map.roadPieces[at(20, 40)]).toBe(1);
    expect(again.map.roadPieces[at(79, 40)]).toBe(1);
    expect(again.map.roadPieces[5 * 160 + 5]).toBe(0);
    expect(again.map.roadPaths[1].tiles[0]).toBe(at(20, 40));
    expect(again.map.roadPaths[1].tiles[59]).toBe(at(79, 40));
    // ... and its points, one where it joined a road between tiles' middles
    expect(again.map.roadPaths[1].controls).toEqual([[19.6 + dx, 40 + dy], [79 + dx, 40 + dy]]);
    expect(again.map.rulerHouse).toMatchObject({ x: 40 + dx, y: 26 + dy });
    expect(again.map.town).toEqual({ x: 40 + dx, y: 26 + dy });
    // The land it owned is still its own, and the new land is not
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      expect(again.map.landBlocks[Math.floor((y + dy) / BLOCK) * 5 + Math.floor((x + dx) / BLOCK)])
        .toBe(core.map.landBlocks[Math.floor(y / BLOCK) * 3 + Math.floor(x / BLOCK)]);
    }
    expect(again.map.landBlocks[0]).toBe(0);
    // The same buildings, and the city runs on
    expect(again.objects.all().length).toBe(core.objects.all().length);
    expect(again.simulation.budget.totalFunds).toBe(core.simulation.budget.totalFunds);
    again.run(50);
  });

  test("a city map's save keeps the size of its tiles, and one saved before still opens with its land", () => {
    const map = frameMap({ x: 0, y: 0, width: 96, height: 96 });
    map.town = { x: 48, y: 48 };
    const core = new CityCore({ map, seed: 2 });
    const save = JSON.parse(JSON.stringify(core.save()));
    expect(save.tileSizeM).toBe(16);
    delete save.tileSizeM;
    const again = new CityCore({ map: new (GameMap as any)(96, 96), saved: save });
    expect(again.map.tileSizeM).toBe(16);
    expect([...again.map.landBlocks]).toEqual([...core.map.landBlocks]);
  });

  test("painted zone cells move with their land", () => {
    const from = { x: 32, y: 32, width: 64, height: 64 }, to = { x: 0, y: 0, width: 128, height: 128 };
    // A cell whose middle is 3 m into tile (5, 7), 2 m down: raster square (5 * 16 + 3, 7 * 16 + 2)
    const key = (7 * 16 + 2) * 64 * 16 + 5 * 16 + 3;
    const save = { map: Array.from({ length: 64 * 64 }, () => ({ value: 0 })), width: 64, height: 64, cityCentreX: 0,
      cityCentreY: 0, pollutionMaxX: 0, pollutionMaxY: 0, zoneCells: [key, 2] };
    const moved = reframeSave(save, from, to, { map: Array.from({ length: 128 * 128 }, () => ({ value: 0 })), inside: null,
      national: null, roadLevels: null }, BLOCK);
    expect(moved.zoneCells).toEqual([((7 + 32) * 16 + 2) * 128 * 16 + (5 + 32) * 16 + 3, 2]);
  });
});
