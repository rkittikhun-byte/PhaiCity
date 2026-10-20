/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every building of the city (src/objects/buildings.ts), kept in step with the map: a scan finds what stands, keeps
// the objects that still stand (with what they remember), adds the new ones and lets the gone ones go. The buildings a
// tool put down come from their list (gameMap.buildings), each with where it stands in metres (docs/
// METRE_DRAWING_PLAN.md 2.7); homes, shops, factories and stops from the tiles they grow on, until zones are kept in
// metres too (step 3), and so would any building the list missed. Each tile knows which building covers it, for a
// click. Plain code: no DOM, nothing random.

import { buildingAt } from "./buildings.js";
import type { Building, CityReader } from "./cityObject.js";

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
    const found = new Map<number, Building>(), added: Building[] = [], moved = new Set<Building>();
    // A ruler's building the move command took to another block is the same building on a new centre tile: it keeps
    // when it went up, and is neither new nor gone
    const byRecord = new Map<number, Building>();
    for (const b of this.byId.values()) if (b.placed) byRecord.set(b.placed.id, b);
    const keep = (fresh: Building, record?: { id: number }): Building => {
      const old = this.byId.get(fresh.id);
      if (old && old.kind === fresh.kind && old.size === fresh.size) { found.set(old.id, old); return old; }
      const was = record ? byRecord.get(record.id) : undefined;
      if (was && was.id !== fresh.id && was.kind === fresh.kind && was.size === fresh.size) {
        fresh.built = was.built; found.set(fresh.id, fresh); moved.add(was);
        return fresh;
      }
      fresh.built = now; found.set(fresh.id, fresh); added.push(fresh);
      return fresh;
    };
    // The ruler's buildings put down, those still standing on their centre tile
    const placed = city.buildings?.all() ?? null;
    if (placed) for (const record of placed) {
      const x = record.tile % city.width, y = Math.floor(record.tile / city.width);
      if (x < 0 || y < 0 || x >= city.width || y >= city.height) continue;
      const fresh = buildingAt(city, x, y);
      if (fresh && fresh.size === record.size) keep(fresh, record).placed = record;
    }
    // ... and what grows on the tiles: homes, shops, factories and the stops (every building on a map with no list)
    for (let y = 0; y < city.height; y++) for (let x = 0; x < city.width; x++) {
      if (found.has(y * city.width + x)) continue;
      const fresh = buildingAt(city, x, y);
      if (fresh) keep(fresh).placed = null;
    }
    const removed = [...this.byId.values()].filter(b => found.get(b.id) !== b && !moved.has(b));
    this.byId = found;
    this.cover.fill(0);
    for (const building of found.values()) {
      for (let y = building.top; y < building.top + building.size; y++) for (let x = building.left; x < building.left + building.size; x++) {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cover[y * this.width + x] = building.id + 1;
      }
    }
    return { added, removed };
  }
  /** What a save keeps, flat to stay small (a big painted city has tens of thousands of buildings): id, built, … for
   * each building whose time of building is known */
  toJSON(): number[] {
    const flat: number[] = [];
    for (const record of this.all().map(b => b.toJSON())) if (record.built > 0) flat.push(record.id, record.built);
    return flat;
  }
  /** A saved city's objects: scan its map, then give back what each remembered */
  static restore(city: CityReader, saved: readonly number[] | null | undefined): CityObjects {
    const objects = new CityObjects(city.width, city.height);
    objects.scan(city, 0);
    for (let i = 0; saved && i + 1 < saved.length; i += 2) {
      const building = objects.byId.get(saved[i]), built = saved[i + 1];
      if (building && Number.isFinite(built)) building.built = built;
    }
    return objects;
  }
}
