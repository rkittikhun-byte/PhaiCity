/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every building of the city (src/objects/buildings.ts), kept in step with the map: a scan finds what stands on the
// tiles, keeps the objects that still stand (with what they remember), adds the new ones and lets the gone ones go.
// Each tile knows which building covers it, for a click. Plain code: no DOM, nothing random.

import { buildingAt } from "./buildings.js";
import type { Building, CityReader, SavedObject } from "./cityObject.js";

export class CityObjects {
  private byId = new Map<number, Building>();
  /** For each tile, the id of the building covering it plus one (0: none) */
  private cover: Int32Array;
  constructor(readonly width: number, readonly height: number) {
    this.cover = new Int32Array(width * height);
  }
  get size(): number { return this.byId.size; }
  all(): Building[] { return [...this.byId.values()]; }
  get(id: number): Building | undefined { return this.byId.get(id); }
  /** The building covering this tile, or null */
  at(x: number, y: number): Building | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const id = this.cover[y * this.width + x] - 1;
    return id >= 0 ? this.byId.get(id) ?? null : null;
  }
  /**
   * Look over the whole map. A building whose centre still holds the same kind keeps its object; one that is new
   * is stamped with `now` (city time); one that is gone is dropped.
   */
  scan(city: CityReader, now: number): { added: Building[]; removed: Building[] } {
    const found = new Map<number, Building>(), added: Building[] = [];
    for (let y = 0; y < city.height; y++) for (let x = 0; x < city.width; x++) {
      const fresh = buildingAt(city, x, y);
      if (!fresh) continue;
      const old = this.byId.get(fresh.id);
      if (old && old.kind === fresh.kind && old.size === fresh.size) found.set(old.id, old);
      else { fresh.built = now; found.set(fresh.id, fresh); added.push(fresh); }
    }
    const removed = [...this.byId.values()].filter(b => found.get(b.id) !== b);
    this.byId = found;
    this.cover.fill(0);
    for (const building of found.values()) {
      for (let y = building.top; y < building.top + building.size; y++) for (let x = building.left; x < building.left + building.size; x++) {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cover[y * this.width + x] = building.id + 1;
      }
    }
    return { added, removed };
  }
  /** What a save keeps */
  toJSON(): SavedObject[] { return this.all().map(b => b.toJSON()); }
  /** A saved city's objects: scan its map, then give back what each remembered */
  static restore(city: CityReader, saved: readonly SavedObject[] | null | undefined): CityObjects {
    const objects = new CityObjects(city.width, city.height);
    objects.scan(city, 0);
    for (const record of saved ?? []) {
      const building = objects.byId.get(record.id);
      if (building && Number.isFinite(record.built)) building.built = record.built;
    }
    return objects;
  }
}
