/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The gold loading line fills with what has really loaded: the tile and sprite images, then the province
// data, then the map. Progress only moves forward, and lives in the --load CSS variable (0 to 1).

let current = 0;

export function setLoadingProgress(value: number): void {
  const next = Math.max(current, Math.min(1, value));
  if (next === current) return;
  current = next;
  if (typeof document !== "undefined") document.documentElement.style.setProperty("--load", current.toFixed(3));
}

export function loadingProgress(): number {
  return current;
}

/** How many things of a kind (such as the 3D view's textures) were asked for, and how many have arrived */
export interface LoadCount {
  requested: number;
  finished: number;
}

const counts = new Map<string, LoadCount>();
const countListeners = new Set<() => void>();

/** Counts a load of this kind until it settles, whether it arrives or fails (src/loadingScreen.ts shows them) */
export function countLoad<T>(kind: string, pending: Promise<T>): Promise<T> {
  const count = counts.get(kind) ?? { requested: 0, finished: 0 };
  counts.set(kind, count);
  count.requested++;
  countListeners.forEach((listener) => listener());
  const settle = (): void => {
    count.finished++;
    countListeners.forEach((listener) => listener());
  };
  pending.then(settle, settle);
  return pending;
}

export function loadCount(kind: string): LoadCount {
  const count = counts.get(kind);
  return count ? { ...count } : { requested: 0, finished: 0 };
}

/** Calls the listener whenever a counted load starts or settles; returns how to stop */
export function onLoadCount(listener: () => void): () => void {
  countListeners.add(listener);
  return () => countListeners.delete(listener);
}

/** Moves progress from `from` to `to` as the images finish loading. */
export function trackImages(images: HTMLImageElement[], from: number, to: number): void {
  if (images.length === 0) {
    setLoadingProgress(to);
    return;
  }
  const update = (): void => {
    const done = images.filter((image) => image.complete).length;
    setLoadingProgress(from + ((to - from) * done) / images.length);
  };
  for (const image of images) image.addEventListener("load", update);
  update();
}
