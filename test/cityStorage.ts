/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { decodeMap, deleteCity, encodeMap, listCities, loadCity, saveCity, StorageFullError } from "../src/cityStorage";

class MemoryStore {
  items = new Map<string, string>();
  limit = Infinity;
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (value.length > this.limit) throw new Error("QuotaExceededError");
    this.items.set(key, value);
  }
  removeItem(key: string): void { this.items.delete(key); }
}

const meta = (name: string) => ({ name, provinceId: "TH-50", worldId: null, population: 1200, funds: 18000, year: 1901, month: 3 });

function provinceSizedMap(): Array<{ value: number }> {
  const map: Array<{ value: number }> = [];
  for (let i = 0; i < 200 * 200; i++) map.push({ value: i % 200 < 140 ? 0 : i % 200 < 150 ? 2 : 21 });
  return map;
}

describe("map encoding", () => {
  test("round-trips exactly", () => {
    const map = [0, 0, 0, 4, 21, 21, 1023, 1023 | 0x2000, 5].map((value) => ({ value }));
    expect(decodeMap(encodeMap(map))).toEqual(map);
    expect(decodeMap(encodeMap([]))).toEqual([]);
  });

  test("shrinks a province-sized map to a small fraction of the old format", () => {
    const map = provinceSizedMap();
    expect(encodeMap(map).length).toBeLessThan(JSON.stringify(map).length / 20);
  });
});

describe("saved cities", () => {
  test("saving, listing, loading and deleting", () => {
    const store = new MemoryStore();
    expect(listCities(store)).toEqual([]);
    const first = saveCity({ name: "Lanna", map: provinceSizedMap() }, meta("Lanna"), null, store);
    const second = saveCity({ name: "Pai" }, meta("Pai"), null, store);
    expect(first).not.toBe(second);
    expect(listCities(store).map((city) => city.name).sort()).toEqual(["Lanna", "Pai"]);

    const loaded = loadCity(first, store)!;
    expect(loaded.isSavedGame).toBe(true);
    expect(loaded.cityId).toBe(first);
    expect((loaded.map as unknown[]).length).toBe(200 * 200);

    deleteCity(first, store);
    expect(listCities(store).map((city) => city.id)).toEqual([second]);
    expect(loadCity(first, store)).toBeNull();
  });

  test("saving again keeps the same slot", () => {
    const store = new MemoryStore();
    const id = saveCity({ name: "Pai" }, meta("Pai"), null, store);
    expect(saveCity({ name: "Pai" }, { ...meta("Pai"), population: 5000 }, id, store)).toBe(id);
    expect(listCities(store)).toHaveLength(1);
    expect(listCities(store)[0].population).toBe(5000);
  });

  test("the single save of older versions becomes the first city, and is left in place", () => {
    const store = new MemoryStore();
    const legacy = JSON.stringify({ version: 3, name: "Old Town", _cityTime: 48 * 2 + 8, totalFunds: 7000, resPop: 10,
      comPop: 1, indPop: 1, map: [{ value: 0 }], width: 1, height: 1 });
    store.setItem("micropolisJSGame", legacy);
    const cities = listCities(store);
    expect(cities).toHaveLength(1);
    expect(cities[0]).toMatchObject({ name: "Old Town", year: 1902, month: 2, funds: 7000, population: (10 + 2 * 8) * 20, provinceId: null });
    const loaded = loadCity(cities[0].id, store)!;
    expect(loaded.provinceId).toBeNull(); // migrated from version 3 to 4
    expect(store.getItem("micropolisJSGame")).toBe(legacy);
    expect(listCities(store)).toHaveLength(1); // only once
  });

  test("a full storage is reported, not ignored", () => {
    const store = new MemoryStore();
    listCities(store);
    store.limit = 10;
    expect(() => saveCity({ name: "Big" }, meta("Big"), null, store)).toThrow(StorageFullError);
  });
});
