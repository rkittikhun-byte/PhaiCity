/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { citySavesWritten, closeCityStore, type CityBackend, type CityMeta, decodeMap, deleteCity, encodeMap, listCities, loadCity,
  loadCityAsync, onCitySaveFailed, openCityStore, packSave, saveCity, StorageFullError, unpackSave } from "../src/cityStorage";

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

/** The city database kept in memory, as IndexedDB keeps it */
class MemoryBackend implements CityBackend {
  index: CityMeta[] | null = null;
  saves = new Map<string, Uint8Array | string>();
  full = false;
  async readIndex() { return this.index ? this.index.map((c) => ({ ...c })) : null; }
  async writeIndex(cities: CityMeta[]) { this.index = cities.map((c) => ({ ...c })); }
  async read(id: string) { return this.saves.get(id) ?? null; }
  async write(id: string, data: Uint8Array | string) {
    if (this.full) throw new Error("QuotaExceededError");
    this.saves.set(id, data);
  }
  async remove(id: string) { this.saves.delete(id); }
}

describe("the city database", () => {
  afterEach(() => closeCityStore());

  test("a save is gzipped and comes back the same", async () => {
    const text = JSON.stringify({ name: "Pai", mapRle: encodeMap(provinceSizedMap()) });
    const packed = await packSave(text);
    expect(packed).toBeInstanceOf(Uint8Array);
    expect((packed as Uint8Array).length).toBeLessThan(text.length / 5);
    expect(await unpackSave(packed)).toBe(text);
  });

  test("the cities localStorage kept are read in once and left where they were", async () => {
    const store = new MemoryStore(), backend = new MemoryBackend();
    const id = saveCity({ name: "Lanna", map: provinceSizedMap() }, meta("Lanna"), null, store);
    const kept = store.getItem("phaicity.city." + id);
    expect(await openCityStore(backend, store)).toBe(true);
    expect(listCities().map((c) => c.name)).toEqual(["Lanna"]);
    expect((await loadCityAsync(id))!.map).toHaveLength(200 * 200);
    expect(store.getItem("phaicity.city." + id)).toBe(kept);
    // ... only once: a city deleted from the database does not come back from localStorage
    deleteCity(id);
    await citySavesWritten();
    closeCityStore();
    await openCityStore(backend, store);
    expect(listCities()).toEqual([]);
  });

  test("saving, listing, loading and deleting in the database", async () => {
    const store = new MemoryStore(), backend = new MemoryBackend();
    await openCityStore(backend, store);
    const first = saveCity({ name: "Lanna", map: provinceSizedMap() }, meta("Lanna"), null);
    // ... at hand at once, before it is written
    expect(loadCity(first)!.name).toBe("Lanna");
    expect(await citySavesWritten()).toBe(true);
    expect(backend.saves.get(first)).toBeInstanceOf(Uint8Array);
    expect(store.getItem("phaicity.city." + first)).toBeNull();
    const second = saveCity({ name: "Pai" }, meta("Pai"), null);
    await citySavesWritten();
    closeCityStore();
    // ... and in the next visit
    await openCityStore(backend, store);
    expect(listCities().map((c) => c.name).sort()).toEqual(["Lanna", "Pai"]);
    const loaded = (await loadCityAsync(first))!;
    expect(loaded.isSavedGame).toBe(true);
    expect(loaded.cityId).toBe(first);
    expect((loaded.map as unknown[]).length).toBe(200 * 200);
    deleteCity(first);
    await citySavesWritten();
    expect(listCities().map((c) => c.id)).toEqual([second]);
    expect(await loadCityAsync(first)).toBeNull();
  });

  test("a save the database cannot write is reported", async () => {
    const backend = new MemoryBackend(), failed: unknown[] = [];
    await openCityStore(backend, new MemoryStore());
    onCitySaveFailed((error) => failed.push(error));
    backend.full = true;
    saveCity({ name: "Big" }, meta("Big"), null);
    expect(await citySavesWritten()).toBe(false);
    expect(failed).toHaveLength(1);
  });
});
