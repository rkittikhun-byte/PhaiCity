/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Each object its own listeners (src/eventEmitter.js, docs/NO_GRID_PLAN.md 0.3): the original kept one list for every
// object a constructor made, so two cities in one page or process each ran the other's monthly systems, and the same
// seed and commands did not make the same city twice.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { decodeMap } from "../src/cityStorage";
import { EventEmitter } from "../src/eventEmitter.js";
import { GameMap } from "../src/gameMap.js";
import { Random } from "../src/random";
import { Storage } from "../src/storage.js";

describe("each object its own listeners", () => {
  test("an object of a constructor hears only its own events", () => {
    const Thing = (EventEmitter as any)(function (this: any) { this.n = 0; });
    const a = new Thing(), b = new Thing(), heard: string[] = [];
    a.addEventListener("x", (v: string) => heard.push(`a:${v}`));
    b.addEventListener("x", (v: string) => heard.push(`b:${v}`));
    a._emitEvent("x", 1);
    b._emitEvent("x", 2);
    expect(heard).toEqual(["a:1", "b:2"]);
    const listener = () => heard.push("again");
    a.addEventListener("y", listener);
    a.removeEventListener("y", listener);
    a._emitEvent("y");
    expect(heard).toHaveLength(2);
  });

  test("a city opened twice from one save, one after the other in one process, goes on the same both times", () => {
    const open = () => {
      const save = JSON.parse(fs.readFileSync("test/fixtures/khonKaen-v5.json", "utf8"));
      save.map = decodeMap(save.mapRle);
      delete save.mapRle;
      if (save.version !== (Storage as any).CURRENT_VERSION) (Storage as any).transitionOldSave(save);
      return new CityCore({ map: new (GameMap as any)(save.width, save.height), saved: save });
    };
    const run = () => {
      const core = open(), states: number[] = [];
      for (let k = 0; k < 160; k++) { core.step(); states.push(Random.getState()); }
      return states;
    };
    expect(run()).toEqual(run());
  }, 120000);
});
