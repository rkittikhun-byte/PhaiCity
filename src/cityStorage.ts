/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Several saved cities (docs/ONLINE_PLAN.md: saves support multiple cities with worldId / provinceId).
//   phaicity.cities        an index of every city, small enough to read on every visit
//   phaicity.city.<id>     one city's save
// The map is stored run-length encoded (mapRle): a 200x200 province map shrinks from about 560 KB of
// {"value": n} objects to a few tens of KB, so many cities fit in the browser's storage.
// The single save of older versions (micropolisJSGame) is copied in once and left untouched. Where the browser has
// IndexedDB the cities are kept there instead, gzipped (the city database below).

import { Storage as LegacyStorage } from "./storage.js";

// storage.js defines its version and migrations at runtime; this is the part used here
const Storage = LegacyStorage as unknown as { CURRENT_VERSION: number; transitionOldSave(save: unknown): void };

export interface CityMeta {
  id: string;
  name: string;
  provinceId: string | null;
  /** The district whose town the city stands in (data/maps/district/), if it does */
  districtId?: string;
  worldId: string | null;
  savedAt: number;
  population: number;
  funds: number;
  year: number;
  month: number;
  /** The ruler's rank (src/rulerRank.ts); cities saved before ranks have none. */
  rank?: string;
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

// --- The city database (docs/METRE_DRAWING_PLAN.md 6, step 1.6) ---
//
// Where the browser has IndexedDB the cities are kept there instead: no ~5 MB limit as localStorage has, each save
// gzipped in the browser (CompressionStream) as it is written. Opened once as the game starts (openCityStore), when
// the cities localStorage kept are read into it once and left where they were. The index is kept in memory, so the list
// of cities stays at hand; a save is written in the background, in the order saved, and read back with loadCityAsync.

/** Where the database keeps things: the index and each city's save, packed (packSave) */
export interface CityBackend {
  readIndex(): Promise<CityMeta[] | null>;
  writeIndex(cities: CityMeta[]): Promise<void>;
  read(id: string): Promise<Uint8Array | string | null>;
  write(id: string, data: Uint8Array | string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Set in localStorage once its cities have been read into the database */
const MOVED_KEY = "phaicity.cities.moved";
const DB_NAME = "phaicity", DB_STORE = "cities", INDEX_RECORD = "index";

/** A save's text gzipped, or as it is where the browser cannot compress */
export async function packSave(text: string): Promise<Uint8Array | string> {
  if (typeof CompressionStream === "undefined" || typeof Blob === "undefined" || typeof Response === "undefined") return text;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unpackSave(data: Uint8Array | string): Promise<string> {
  if (typeof data === "string") return data;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** The browser's IndexedDB as a backend: one object store, the index under "index" and each city under its id */
export function indexedDbBackend(factory: IDBFactory): Promise<CityBackend> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(DB_STORE); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const run = <T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest | null): Promise<T> =>
        new Promise((done, fail) => {
          const transaction = db.transaction(DB_STORE, mode), call = act(transaction.objectStore(DB_STORE));
          transaction.oncomplete = () => done((call ? call.result : undefined) as T);
          transaction.onerror = () => fail(transaction.error);
          transaction.onabort = () => fail(transaction.error ?? new StorageFullError());
        });
      resolve({
        readIndex: async () => {
          const found = await run<unknown>("readonly", (store) => store.get(INDEX_RECORD));
          return Array.isArray(found) ? found.filter((city) => city && typeof city.id === "string") : null;
        },
        writeIndex: (cities) => run("readwrite", (store) => store.put(cities, INDEX_RECORD)),
        read: async (id) => {
          const found = await run<unknown>("readonly", (store) => store.get(CITY_PREFIX + id));
          return found instanceof Uint8Array || typeof found === "string" ? found :
            found instanceof ArrayBuffer ? new Uint8Array(found) : null;
        },
        write: (id, data) => run("readwrite", (store) => store.put(data, CITY_PREFIX + id)),
        remove: (id) => run("readwrite", (store) => store.delete(CITY_PREFIX + id)),
      });
    };
  });
}

interface OpenStore {
  backend: CityBackend;
  index: CityMeta[];
  /** Saves made this session not yet written, by city */
  writing: Map<string, string>;
  /** The writes, one after another */
  queue: Promise<boolean>;
}

let opened: OpenStore | null = null;
const failures: Array<(error: unknown) => void> = [];

/**
 * Opens the city database (the browser's IndexedDB, or backend), reading the cities localStorage kept into it the
 * first time; true when the cities are kept there from now on, false when it is not there (they stay in localStorage).
 */
export async function openCityStore(backend: CityBackend | null = null, store: Store | null = defaultStore()): Promise<boolean> {
  try {
    if (!backend && typeof indexedDB !== "undefined") backend = await indexedDbBackend(indexedDB);
    if (!backend) return false;
    const index = (await backend.readIndex()) ?? [];
    if (store && store.getItem(MOVED_KEY) === null) {
      migrateLegacy(store);
      for (const meta of readIndex(store)) {
        const text = store.getItem(CITY_PREFIX + meta.id);
        if (text === null || index.some((city) => city.id === meta.id)) continue;
        await backend.write(meta.id, await packSave(text));
        index.push(meta);
      }
      await backend.writeIndex(index);
      store.setItem(MOVED_KEY, String(Date.now()));
    }
    opened = { backend, index, writing: new Map(), queue: Promise.resolve(true) };
    return true;
  } catch (error) {
    console.warn("Cities are kept in localStorage: the city database did not open (" + String(error) + ")");
    opened = null;
    return false;
  }
}

/** Closes the city database (tests) */
export function closeCityStore(): void {
  opened = null;
}

/** Calls listener when a save could not be written to the database (the browser's storage full) */
export function onCitySaveFailed(listener: (error: unknown) => void): void {
  failures.push(listener);
}

/** Once every save made so far is written: true when the last was */
export function citySavesWritten(): Promise<boolean> {
  return opened ? opened.queue : Promise.resolve(true);
}

/** A write to the database after the ones before it */
function queueWrite(open: OpenStore, write: () => Promise<void>): void {
  open.queue = open.queue.then(async () => {
    try {
      await write();
      return true;
    } catch (error) {
      for (const listener of failures) listener(error);
      return false;
    }
  });
}

/** A save's text as written: the map run-length encoded */
function compactText(save: SaveData): string {
  const compact: SaveData = { ...save };
  if (Array.isArray(compact.map)) {
    compact.mapRle = encodeMap(compact.map);
    delete compact.map;
  }
  return JSON.stringify(compact);
}

/** A save read back from its text, brought up to this version */
function readSave(text: string, id: string): SaveData | null {
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

// --- Public API ---

/** Every saved city, most recently played first. */
export function listCities(store?: Store | null): CityMeta[] {
  if (store === undefined && opened) return [...opened.index].sort((a, b) => b.savedAt - a.savedAt);
  store = store === undefined ? defaultStore() : store;
  if (!store) return [];
  migrateLegacy(store);
  return readIndex(store).sort((a, b) => b.savedAt - a.savedAt);
}

/** A city's save, ready for new Game(), or null when it is missing or unreadable; from the database only one saved
 * this session (loadCityAsync reads the rest). */
export function loadCity(id: string, store?: Store | null): SaveData | null {
  if (store === undefined && opened) {
    const text = opened.writing.get(id);
    return text === undefined ? null : readSave(text, id);
  }
  store = store === undefined ? defaultStore() : store;
  if (!store) return null;
  const text = store.getItem(CITY_PREFIX + id);
  return text === null ? null : readSave(text, id);
}

/** A city's save, from the database or localStorage, or null when it is missing or unreadable. */
export async function loadCityAsync(id: string): Promise<SaveData | null> {
  const open = opened;
  if (!open) return loadCity(id);
  const pending = open.writing.get(id);
  if (pending !== undefined) return readSave(pending, id);
  try {
    const data = await open.backend.read(id);
    return data === null ? null : readSave(await unpackSave(data), id);
  } catch {
    return null;
  }
}

/** Saves a city and returns its id (a new one the first time). Throws StorageFullError when localStorage is full; the
 * database is written in the background, and says when it could not be (onCitySaveFailed). */
export function saveCity(save: SaveData, meta: Omit<CityMeta, "id" | "savedAt">, id: string | null,
                         store?: Store | null): string {
  const open = store === undefined ? opened : null;
  if (open) {
    const cityId = id ?? newId(), text = compactText({ ...save, version: Storage.CURRENT_VERSION, cityId });
    open.index = open.index.filter((city) => city.id !== cityId);
    open.index.push({ ...meta, id: cityId, savedAt: Date.now() });
    open.writing.set(cityId, text);
    const index = open.index.slice();
    queueWrite(open, async () => {
      await open.backend.write(cityId, await packSave(text));
      await open.backend.writeIndex(index);
      if (open.writing.get(cityId) === text) open.writing.delete(cityId);
    });
    return cityId;
  }
  store = store === undefined ? defaultStore() : store;
  if (!store) throw new StorageFullError();
  migrateLegacy(store);
  const cityId = id ?? newId();
  writeCity(store, cityId, { ...save, version: Storage.CURRENT_VERSION, cityId });
  const cities = readIndex(store).filter((city) => city.id !== cityId);
  cities.push({ ...meta, id: cityId, savedAt: Date.now() });
  writeIndex(store, cities);
  return cityId;
}

export function deleteCity(id: string, store?: Store | null): void {
  const open = store === undefined ? opened : null;
  if (open) {
    open.index = open.index.filter((city) => city.id !== id);
    open.writing.delete(id);
    const index = open.index.slice();
    queueWrite(open, async () => {
      await open.backend.remove(id);
      await open.backend.writeIndex(index);
    });
    return;
  }
  store = store === undefined ? defaultStore() : store;
  if (!store) return;
  store.removeItem(CITY_PREFIX + id);
  writeIndex(store, readIndex(store).filter((city) => city.id !== id));
}
