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
