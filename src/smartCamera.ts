/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The smart camera (owner, 23 Oct 2026: "อยากให้เกมส์รู้สึกว่ามันฉลาดในการเลื่อนมุมกล้อง เช่นการเลือก tool แต่ละอย่าง เช่นวาดสี
// มันควรที่จะอยู่มุมไหน"; docs/3d/RENDERER_SPEC.md 7C, docs/GAME_DESIGN.md 17): picking up a tool glides the camera to the
// height and tilt that tool is used at, about 0.7 s, easing in and out, the point at the screen's centre kept where it is.
// A brush also turns the view so the road nearest the centre runs across the screen, as the zones are painted along it.
// Clicking a building flies to frame it beside its card; a data layer looks down on the city. What the player sets by
// hand while holding a tool is used for that tool the next time. It never moves during a drag or a stroke, nor for a
// tool put down, nor when the player has turned it off in the settings (kept per viewer, like phaicity.graphics).
// Only the view moves: nothing here changes the city.

import { modeGroupOf } from "./drawModes.js";

/** How long a glide takes (ms) */
export const GLIDE_MS = 700;
/** The camera's lens: its vertical field of view (degrees, render3d/city/camera.ts) */
const FOV_DEGREES = 38;

/** Where a tool is best used from: the tilt (degrees above the horizon), the width of ground across the screen (metres),
 * and whether the view turns so the road nearest the centre runs across it */
export interface CameraPreset { pitchDeg: number; widthM: number; alongRoad?: boolean }

/** The presets by kind of tool */
export const PRESETS = {
  paint: { pitchDeg: 65, widthM: 250, alongRoad: true },
  line: { pitchDeg: 60, widthM: 600 },
  build: { pitchDeg: 45, widthM: 150 },
  land: { pitchDeg: 60, widthM: 1500 },
} as const satisfies Record<string, CameraPreset>;
export type PresetKind = keyof typeof PRESETS;

/** Tools that never move the camera: the bulldozer, the inspector (its click frames what it shows), the move tool */
const STILL_TOOLS = new Set(["bulldozer", "query", "move"]);

/** The kind of preset a tool takes, or null for none */
export function presetKind(tool: string | null | undefined): PresetKind | null {
  if (!tool || STILL_TOOLS.has(tool)) return null;
  const group = modeGroupOf(tool);
  if (group === "paint") return "paint";
  if (group === "line") return "line";
  if (tool === "land") return "land";
  return "build";
}

/** The camera's distance that shows `width` world units across a screen of this aspect at the point it looks at */
export function distanceForWidth(width: number, aspect: number): number {
  return width / (2 * Math.tan(FOV_DEGREES / 2 * Math.PI / 180) * Math.max(0.1, aspect));
}

/** The pose a camera is in: heading and pitch (radians), distance and the point it looks at (world units) */
export interface CameraPose { heading: number; pitch: number; distance: number; x: number; z: number }

/** The smaller turn from one heading to another (radians, -π to π) */
export function turnBetween(from: number, to: number): number {
  return ((to - from) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

/** The heading nearest `current` at which a road running along (tx, tz) lies across the screen */
export function headingAlong(tx: number, tz: number, current: number): number {
  const along = Math.atan2(-tz, tx);
  const a = turnBetween(current, along), b = turnBetween(current, along + Math.PI);
  return current + (Math.abs(a) <= Math.abs(b) ? a : b);
}

/** Close enough that a glide would only twitch: within 5 degrees of tilt and 20% of distance (8 degrees of heading) */
export function nearPose(now: CameraPose, want: Partial<CameraPose>): boolean {
  if (want.pitch !== undefined && Math.abs(now.pitch - want.pitch) > 5 * Math.PI / 180) return false;
  if (want.distance !== undefined && Math.abs(Math.log(now.distance / want.distance)) > 0.2) return false;
  if (want.heading !== undefined && Math.abs(turnBetween(now.heading, want.heading)) > 8 * Math.PI / 180) return false;
  if (want.x !== undefined && want.z !== undefined && Math.hypot(now.x - want.x, now.z - want.z) > now.distance * 0.05) return false;
  return true;
}

/** Ease in and out: slow at both ends */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- The setting, kept per viewer -----------------------------------------------------------------------------------

const STORAGE_KEY = "phaicity.smartCamera";
const POSES_KEY = "phaicity.smartCamera.poses";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

let on = (() => { try { return storage()?.getItem(STORAGE_KEY) !== "off"; } catch { return true; } })();
const listeners = new Set<(on: boolean) => void>();

export function smartCameraOn(): boolean { return on; }

export function setSmartCamera(value: boolean): void {
  on = value;
  try { storage()?.setItem(STORAGE_KEY, value ? "on" : "off"); } catch { /* kept until the page closes */ }
  listeners.forEach((listener) => listener(on));
}

/** The settings window's checkbox (#smartCamera) shows the setting and changes it at once, as the graphics do */
export function bindSmartCameraSetting(doc: Document | null = typeof document !== "undefined" ? document : null): void {
  const box = doc?.getElementById("smartCamera") as HTMLInputElement | null;
  if (!box) return;
  box.checked = on;
  box.addEventListener("change", () => setSmartCamera(box.checked));
  listeners.add((value) => { box.checked = value; });
}

// --- The controller -------------------------------------------------------------------------------------------------

/** What the smart camera needs of the view's camera (render3d/city/camera.ts) */
export interface GlidingCamera extends CameraPose {
  flat?: boolean;
  minDistance: number;
  maxDistance: number;
  readonly target: { x: number; z: number };
  readonly lastInteractionAt: number;
  glide(to: Partial<CameraPose>, ms: number): void;
  isAnimating(time: number): boolean;
}

/** What it needs of the view */
export interface SmartView {
  navigation?: GlidingCamera;
  width: number;
  height: number;
  /** The direction of the road nearest a point within reach (world units), or null */
  roadAlong?(x: number, z: number, reach: number): { tx: number; tz: number } | null;
  /** World units a metre: under 1 on a real-scale city map */
  unitsPerMetre?(): number;
}

export class SmartCamera {
  private kind: PresetKind | null = null;
  /** When the last glide ends: the player's own moves after it, while holding a tool, are what that tool keeps */
  private glidedUntil = -Infinity;
  private remembered: Partial<Record<PresetKind, { pitch: number; distance: number }>>;

  constructor(private readonly view: SmartView, private readonly busy: () => boolean, private readonly now: () => number = () => performance.now()) {
    let kept: Partial<Record<PresetKind, { pitch: number; distance: number }>> = {};
    try { kept = JSON.parse(storage()?.getItem(POSES_KEY) ?? "{}") ?? {}; } catch { kept = {}; }
    this.remembered = kept;
  }

  private get camera(): GlidingCamera | null { return this.view.navigation ?? null; }

  private pose(): CameraPose | null {
    const c = this.camera;
    return c ? { heading: c.heading, pitch: c.pitch, distance: c.distance, x: c.target.x, z: c.target.z } : null;
  }

  /** Glides there unless the camera is already close, it is busy, or the player turned the smart camera off */
  private go(want: Partial<CameraPose>): boolean {
    const c = this.camera, now = this.pose();
    if (!on || !c || !now || c.flat || this.busy() || c.isAnimating(this.now())) return false;
    if (want.distance !== undefined) want.distance = Math.max(c.minDistance, Math.min(c.maxDistance, want.distance));
    if (nearPose(now, want)) return false;
    c.glide(want, GLIDE_MS);
    this.glidedUntil = this.now() + GLIDE_MS;
    return true;
  }

  /** The tool in hand changed (the dock's phaicity:active_tool_changed); a choice within the same kind moves nothing */
  toolChanged(tool: string | null): void {
    const kind = presetKind(tool);
    this.keepHandSet();
    if (kind === this.kind) return;
    this.kind = kind;
    // Putting a tool down (Esc) leaves the camera where it is
    if (kind === null) return;
    const preset: CameraPreset = PRESETS[kind], c = this.camera;
    if (!c) return;
    const units = this.view.unitsPerMetre?.() ?? 1, aspect = this.view.width / Math.max(1, this.view.height);
    if (units <= 0) return;
    const hand = this.remembered[kind];
    const want: Partial<CameraPose> = hand ? { pitch: hand.pitch, distance: hand.distance } :
      { pitch: preset.pitchDeg * Math.PI / 180, distance: distanceForWidth(preset.widthM * units, aspect) };
    if (preset.alongRoad) {
      const road = this.view.roadAlong?.(c.target.x, c.target.z, (want.distance ?? c.distance) * 0.6);
      if (road) want.heading = headingAlong(road.tx, road.tz, c.heading);
    }
    this.go(want);
  }

  /** What the player set by hand while holding the last tool, kept for that tool */
  private keepHandSet(): void {
    const c = this.camera;
    if (!c || this.kind === null || c.lastInteractionAt <= this.glidedUntil) return;
    this.remembered[this.kind] = { pitch: c.pitch, distance: c.distance };
    try { storage()?.setItem(POSES_KEY, JSON.stringify(this.remembered)); } catch { /* kept until the page closes */ }
    this.glidedUntil = this.now();
  }

  /** A data layer lies over the city (the city map's): look down on it */
  layerShown(): void {
    const c = this.camera;
    if (c && c.pitch < 75 * Math.PI / 180) this.go({ pitch: 80 * Math.PI / 180 });
  }

  /**
   * A building clicked: fly to frame it, tilted low, a little left of the middle so its card (on the right, `cardPx`
   * wide) leaves it in sight. `rect` in tiles.
   */
  frame(rect: { x: number; y: number; width: number; height: number }, cardPx = 250): void {
    const c = this.camera;
    if (!c) return;
    const size = Math.max(rect.width, rect.height) * 10, aspect = this.view.width / Math.max(1, this.view.height);
    const pitch = 35 * Math.PI / 180;
    const distance = Math.max(c.minDistance, distanceForWidth(Math.max(size * 4, 60), aspect));
    // (the screen's right in the world, at that heading; a pixel's worth of ground at that distance)
    const scale = distance * 2 * Math.tan(FOV_DEGREES / 2 * Math.PI / 180) / Math.max(1, this.view.height);
    const shift = Math.min(cardPx, this.view.width / 3) / 2 * scale;
    const x = (rect.x + rect.width / 2) * 10 + Math.cos(c.heading) * shift, z = (rect.y + rect.height / 2) * 10 - Math.sin(c.heading) * shift;
    this.go({ pitch, distance, x, z });
  }
}
