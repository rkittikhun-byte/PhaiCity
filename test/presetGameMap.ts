/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { decodePresetCells } from "../src/geo/presetMap";
import { MapGenerator } from "../src/mapGenerator.js";
import { DIRT, REDGE, RIVER, WATER_HIGH, WATER_LOW, WOODS_HIGH, WOODS_LOW } from "../src/tileValues";

const L = 0;
const W = 1;
const T = 2;

const isWaterTile = (value: number) => value >= WATER_LOW && value <= WATER_HIGH;
const isWoodsTile = (value: number) => value >= WOODS_LOW && value <= WOODS_HIGH;

describe("MapGenerator.fromPresetCells", () => {
    test("keeps the map size and turns land codes into dirt", () => {
        const map = MapGenerator.fromPresetCells(3, 2, [L, L, L, L, L, L]);
        expect([map.width, map.height]).toEqual([3, 2]);
        expect(map.getTileValue(1, 1)).toBe(DIRT);
    });

    test("makes a lake with open water in the middle and smoothed shores", () => {
        const cells = [
            L, L, L, L, L,
            L, W, W, W, L,
            L, W, W, W, L,
            L, W, W, W, L,
            L, L, L, L, L,
        ];
        const map = MapGenerator.fromPresetCells(5, 5, cells);
        expect(map.getTileValue(2, 2)).toBe(RIVER);
        for (const [x, y] of [[1, 1], [2, 1], [1, 2], [3, 3]]) {
            const value = map.getTileValue(x, y);
            expect(isWaterTile(value)).toBe(true);
            expect(value).not.toBe(REDGE);   // every shore tile was smoothed into a proper edge
        }
        expect(map.getTileValue(0, 0)).toBe(DIRT);
    });

    test("keeps a one-tile canal as continuous open water", () => {
        const cells = [
            L, L, L, L, L, L,
            W, W, W, W, W, W,
            L, L, L, L, L, L,
        ];
        const map = MapGenerator.fromPresetCells(6, 3, cells);
        for (let x = 0; x < 6; x++) {
            expect(isWaterTile(map.getTileValue(x, 1))).toBe(true);
        }
    });

    test("keeps water touching the map border open", () => {
        const map = MapGenerator.fromPresetCells(3, 3, [W, W, W, W, W, W, L, L, L]);
        expect(map.getTileValue(1, 0)).toBe(RIVER);
    });

    test("turns woods codes into woods tiles", () => {
        const map = MapGenerator.fromPresetCells(3, 3, [T, T, T, T, T, T, T, T, T]);
        expect(isWoodsTile(map.getTileValue(1, 1))).toBe(true);
    });

    test("rejects a cell count that does not match the size", () => {
        expect(() => MapGenerator.fromPresetCells(3, 3, [L, L])).toThrow();
    });

    test("builds the real Chiang Mai preset at its full size, moat included", () => {
        const file = path.join(__dirname, "..", "data", "maps", "TH-50.json");
        const preset = JSON.parse(fs.readFileSync(file, "utf8"));
        const map = MapGenerator.fromPresetCells(preset.width, preset.height, decodePresetCells(preset));

        let water = 0;
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                if (isWaterTile(map.getTileValue(x, y))) water++;
            }
        }
        expect([map.width, map.height]).toEqual([200, 200]);
        expect(water).toBeGreaterThan(0);
    });
});
