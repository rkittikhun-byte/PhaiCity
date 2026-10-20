/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The player's graphics setting: Auto, Low, Medium or High (src/render3d/city/quality.ts says what each draws). Like the
// language it belongs to whoever plays on this browser, not to the city, so it is saved in localStorage
// (`phaicity.graphics`) and is no command (CLAUDE.md, online plan). It applies at once: the settings window's choices
// change it as they are clicked, as the sound sliders do, and OK and Cancel leave it alone.

import { GRAPHICS_QUALITIES, isGraphicsQuality, type GraphicsQuality } from "./render3d/city/quality.js";

export type { GraphicsQuality };

const STORAGE_KEY = "phaicity.graphics";
const DEFAULT_QUALITY: GraphicsQuality = "auto";

const listeners = new Set<(quality: GraphicsQuality) => void>();

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function load(): GraphicsQuality {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    return isGraphicsQuality(stored) ? stored : DEFAULT_QUALITY;
  } catch {
    return DEFAULT_QUALITY;
  }
}

let current: GraphicsQuality = load();

export function getGraphicsQuality(): GraphicsQuality {
  return current;
}

/** Saves the setting and tells whoever listens (the 3D view) */
export function setGraphicsQuality(quality: GraphicsQuality): void {
  if (!isGraphicsQuality(quality)) return;
  current = quality;
  try {
    storage()?.setItem(STORAGE_KEY, quality);
  } catch {
    // A browser that keeps nothing (private window) still uses the setting until the page closes
  }
  listeners.forEach(listener => listener(quality));
}

export function onGraphicsQualityChange(listener: (quality: GraphicsQuality) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reads the setting again (a test, or another tab that changed it) */
export function reloadGraphicsQuality(): GraphicsQuality {
  current = load();
  return current;
}

/** What draws the city, if it has graphics settings (the 3D view; the 2D fallback has none) */
interface QualityView { setQuality?: (quality: GraphicsQuality) => void }

/**
 * Gives the view the player's setting, and every change after it; the settings window's choices
 * (`input[name=graphicsQuality]`) show the setting and change it. Returns a function that stops listening.
 */
export function bindGraphicsQuality(view: QualityView | null, doc: Document | null = typeof document !== "undefined" ? document : null): () => void {
  const apply = (quality: GraphicsQuality): void => { if (view && typeof view.setQuality === "function") view.setQuality(quality); };
  apply(current);
  const inputs = doc ? Array.from(doc.querySelectorAll<HTMLInputElement>("input[name=graphicsQuality]")) : [];
  const show = (quality: GraphicsQuality): void => { for (const input of inputs) input.checked = input.value === quality; };
  const changed = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.checked && isGraphicsQuality(input.value)) setGraphicsQuality(input.value);
  };
  for (const input of inputs) input.addEventListener("change", changed);
  // The 2D view has no lens: its settings say so by being greyed out
  const fieldset = doc?.getElementById("graphicsSettings") ?? null;
  if (fieldset) fieldset.toggleAttribute("disabled", !(view && typeof view.setQuality === "function"));
  show(current);
  const stop = onGraphicsQualityChange(quality => { show(quality); apply(quality); });
  return () => { stop(); for (const input of inputs) input.removeEventListener("change", changed); };
}

export { GRAPHICS_QUALITIES };
