/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { groupCentroid, projectNationalMap } from "../src/geo/nationalMap";

const dataDir = path.join(__dirname, "..", "data");
const topology = JSON.parse(fs.readFileSync(path.join(dataDir, "geo", "thailand-provinces.topo.json"), "utf8"));
const provinceData = JSON.parse(fs.readFileSync(path.join(dataDir, "thailand-provinces.json"), "utf8"));

describe("projectNationalMap", () => {
    const map = projectNationalMap(topology);
    const byId = new Map(map.provinces.map((p) => [p.id, p]));

    test("projects all 77 provinces with matching ids", () => {
        expect(map.provinces).toHaveLength(77);
        for (const province of provinceData.provinces) {
            expect(byId.has(province.id)).toBe(true);
        }
    });

    test("every province has a closed SVG path and a positive area", () => {
        for (const p of map.provinces) {
            expect(p.path.startsWith("M")).toBe(true);
            expect(p.path.endsWith("Z")).toBe(true);
            expect(p.area).toBeGreaterThan(0);
        }
    });

    test("keeps north up and east right", () => {
        const chiangMai = byId.get("TH-50")!.centroid;
        const bangkok = byId.get("TH-10")!.centroid;
        const ubon = byId.get("TH-34")!.centroid;
        const phuket = byId.get("TH-83")!.centroid;
        expect(chiangMai[1]).toBeLessThan(bangkok[1]);    // smaller y is further north
        expect(phuket[1]).toBeGreaterThan(bangkok[1]);
        expect(ubon[0]).toBeGreaterThan(bangkok[0]);       // larger x is further east
        expect(phuket[0]).toBeLessThan(bangkok[0]);
    });

    test("the view box covers every centroid", () => {
        const [x, y, w, h] = map.viewBox;
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(w);   // Thailand is taller than it is wide
        for (const p of map.provinces) {
            expect(p.centroid[0]).toBeGreaterThan(x);
            expect(p.centroid[0]).toBeLessThan(x + w);
            expect(p.centroid[1]).toBeGreaterThan(y);
            expect(p.centroid[1]).toBeLessThan(y + h);
        }
    });

    test("region label centres fall between the region's provinces", () => {
        const north = map.provinces.filter((p) =>
            provinceData.provinces.find((q: any) => q.id === p.id).region === "north");
        const south = map.provinces.filter((p) =>
            provinceData.provinces.find((q: any) => q.id === p.id).region === "south");
        expect(groupCentroid(north)[1]).toBeLessThan(groupCentroid(south)[1]);
    });
});
