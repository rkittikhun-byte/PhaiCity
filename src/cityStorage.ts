/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Several saved cities (docs/ONLINE_PLAN.md: saves support multiple cities with worldId / provinceId).
//   phaicity.cities        an index of every city, small enough to read on every visit
//   phaicity.city.<id>     one city's save
// The map is stored run-length encoded (mapRle): a 200x200 province map shrinks from about 560 KB of
// {"value": n} objects to a few tens of KB, so many cities fit in the browser's storage.
// The single save of older versions (micropolisJSGame) is copied in once and left untouched.

import { Storage as LegacyStorage } from "./storage.js";

// storage.js defines its version and migrations at runtime; this is the part used here
const Storage = LegacyStorage as unknown as { CURRENT_VERSION: number; transitionOldSave(save: unknown): void };

export interface CityMeta {
  id: string;
  name: string;
  provinceId: string | null;
  worldId: string | null;
  savedAt: number;
  population: number;
  funds: number;
  year: number;
  month: number;
}

type Store = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type SaveData = Record<string, unknown> & { map?: Array<{ value: number }>; mapRle?: string };

const INDEX_KEY = "phaicity.cities";
const CITY_PREFIX = "phaicity.city.";
const LEGACY_KEY = "micropolisJSGame";

export class StorageFullError extends Error {
  constructor() {
    super("Not enough browser storage to save the city");
  }
}

function defaultStore(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// --- Map encoding: "value*count" runs, in base 36, separated by commas ---

export function encodeMap(map: ReadonlyArray<{ value: number }>): string {
  const runs: string[] = [];
  let i = 0;
  while (i < map.length) {
    const value = map[i].value;
    let count = 1;
    while (i + count < map.length && map[i + count].value === value) count++;
    runs.push(count === 1 ? value.toString(36) : `${value.toString(36)}*${count.toString(36)}`);
    i += count;
  }
  return runs.join(",");
}

export function decodeMap(encoded: string): Array<{ value: number }> {
  const map: Array<{ value: number }> = [];
  if (encoded === "") return map;
  for (const run of encoded.split(",")) {
    const [value, count] = run.split("*");
    const tile = parseInt(value, 36);
    const times = count === undefined ? 1 : parseInt(count, 36);
    if (!Number.isFinite(tile) || !Number.isFinite(times)) throw new Error(`Bad map run "${run}"`);
    for (let n = 0; n < times; n++) map.push({ value: tile });
  }
  return map;
}

// --- The index ---

function readIndex(store: Store): CityMeta[] {
  try {
    const parsed = JSON.parse(store.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((city) => city && typeof city.id === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(store: Store, cities: CityMeta[]): void {
  store.setItem(INDEX_KEY, JSON.stringify(cities));
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// The one save of older versions becomes the first city, once
function migrateLegacy(store: Store): void {
  if (store.getItem(INDEX_KEY) !== null) return;
  const legacy = store.getItem(LEGACY_KEY);
  if (legacy === null) {
    writeIndex(store, []);
    return;
  }
  try {
    const save = JSON.parse(legacy) as SaveData;
    const id = newId();
    const month = Math.floor(Number(save._cityTime ?? 0) % 48) >> 2;
    const meta: CityMeta = {
      id,
      name: String(save.name ?? "MyTown"),
      provinceId: (save.provinceId as string | undefined) ?? null,
      worldId: (save.worldId as string | undefined) ?? null,
      savedAt: Date.now(),
      // The same formula as Evaluation.cityPop
      population: (Number(save.resPop ?? 0) + (Number(save.comPop ?? 0) + Number(save.indPop ?? 0)) * 8) * 20,
      funds: Number(save.totalFunds ?? 0),
      year: 1900 + Math.floor(Number(save._cityTime ?? 0) / 48),
      month,
    };
    writeCity(store, id, { ...save, cityId: id });
    writeIndex(store, [meta]);
  } catch {
    writeIndex(store, []); // An unreadable old save is left where it is
  }
}

function writeCity(store: Store, id: string, save: SaveData): void {
  const compact: SaveData = { ...save };
  if (Array.isArray(compact.map)) {
    compact.mapRle = encodeMap(compact.map);
    delete compact.map;
  }
  try {
    store.setItem(CITY_PREFIX + id, JSON.stringify(compact));
  } catch {
    throw new StorageFullError();
  }
}

// --- Public API ---

/** Every saved city, most recently played first. */
export function listCities(store: Store | null = defaultStore()): CityMeta[] {
  if (!store) return [];
  migrateLegacy(store);
  return readIndex(store).sort((a, b) => b.savedAt - a.savedAt);
}

/** A city's save, ready for new Game(), or null when it is missing or unreadable. */
export function loadCity(id: string, store: Store | null = defaultStore()): SaveData | null {
  if (!store) return null;
  const text = store.getItem(CITY_PREFIX + id);
  if (text === null) return null;
  try {
    const save = JSON.parse(text) as SaveData;
    if (typeof save.mapRle === "string") {
      save.map = decodeMap(save.mapRle);
      delete save.mapRle;
    }
    if (save.version !== Storage.CURRENT_VERSION) Storage.transitionOldSave(save);
    save.isSavedGame = true;
    save.cityId = id;
    return save;
  } catch {
    return null;
  }
}

/** Saves a city and returns its id (a new one the first time). Throws StorageFullError when storage is full. */
export function saveCity(save: SaveData, meta: Omit<CityMeta, "id" | "savedAt">, id: string | null,
                         store: Store | null = defaultStore()): string {
  if (!store) throw new StorageFullError();
  migrateLegacy(store);
  const cityId = id ?? newId();
  writeCity(store, cityId, { ...save, version: Storage.CURRENT_VERSION, cityId });
  const cities = readIndex(store).filter((city) => city.id !== cityId);
  cities.push({ ...meta, id: cityId, savedAt: Date.now() });
  writeIndex(store, cities);
  return cityId;
}

export function deleteCity(id: string, store: Store | null = defaultStore()): void {
  if (!store) return;
  store.removeItem(CITY_PREFIX + id);
  writeIndex(store, readIndex(store).filter((city) => city.id !== id));
}
