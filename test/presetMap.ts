/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { decodePresetCells, PRESET_LAND, PRESET_WATER, PRESET_WOODS } from "../src/geo/presetMap";

describe("decodePresetCells", () => {
    test("expands runs row-major", () => {
        const cells = decodePresetCells({ cells: "3:0,2:1,1:2", width: 3, height: 2 });
        expect(Array.from(cells)).toEqual([0, 0, 0, 1, 1, 2]);
    });

    test("rejects a run total that does not match the map size", () => {
        expect(() => decodePresetCells({ cells: "5:0", width: 3, height: 2 })).toThrow();
        expect(() => decodePresetCells({ cells: "7:0", width: 3, height: 2 })).toThrow();
    });

    test("rejects malformed runs", () => {
        expect(() => decodePresetCells({ cells: "6", width: 3, height: 2 })).toThrow();
        expect(() => decodePresetCells({ cells: "x:0,6:0", width: 3, height: 2 })).toThrow();
    });

    test("decodes every committed province map with valid codes", () => {
        const dir = path.join(__dirname, "..", "data", "maps");
        const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^TH-\d+\.json$/.test(f)) : [];
        for (const file of files) {
            const map = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
            const cells = decodePresetCells(map);
            expect(cells.length).toBe(map.width * map.height);
            expect(cells.every((c) => c === PRESET_LAND || c === PRESET_WATER || c === PRESET_WOODS)).toBe(true);
        }
    });
});
