/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Hover for everything (owner, 24 Oct 2026: "ถ้าเอา mouse ไปชี้ หรือไปใกล้ object ใดๆ จะมีกรอบ และ tooltip แสดงรายละเอียด
// เล็กๆ ถ้าคลิก จะแสดง card"): with no tool in hand the object the pointer is on or near is outlined and named. This is
// the plain part: which object a human hand means (the nearest within a few pixels, buildings before roads before
// ground, never flickering between two), the two short lines of its tooltip, and where the tooltip sits. No DOM.

import type { Fact } from "./objects/cityObject.js";
import type { Inspection } from "./inspect.js";

/** How far from the pointer an object still counts, in CSS pixels (a hand is not exact) */
export const HOVER_REACH_PX = 16;
/** How long the pointer rests before the tooltip shows (the outline shows at once) */
export const TOOLTIP_REST_MS = 250;
/** The pick runs at most this often */
export const PICK_EVERY_MS = 50;

/** The offsets from the pointer the pick looks at: the pointer, a ring at half the reach and one at the reach */
export const SAMPLE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [[0, 0, 0]];
  for (const radius of [HOVER_REACH_PX / 2, HOVER_REACH_PX]) {
    for (let k = 0; k < 8; k++) {
      const angle = k * Math.PI / 4;
      out.push([Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius), radius]);
    }
  }
  return out;
})();

/** What is a candidate: a building (0) before a road or railway (1) before a canal or a field (2) */
export type HoverClass = 0 | 1 | 2;

export interface HoverCandidate {
  /** The object's identity: the same key for every pixel of it */
  key: string;
  cls: HoverClass;
  /** Pixels from the pointer */
  dist: number;
}

/** What one class costs in pixels more: a road within reach loses to a building a few pixels farther */
const CLASS_COST: readonly number[] = [0, 6, 9];
/** A new object must beat the one held by this many pixels of cost, so two close ones never flicker */
export const STICK_PX = 7;

/** The cost of a candidate: its distance and its class */
export function hoverCost(c: HoverCandidate): number {
  return c.dist + CLASS_COST[c.cls];
}

/**
 * The object to show out of the candidates (the same object found by several samples counts at its nearest), keeping
 * `current` while it is still in reach and no other costs STICK_PX less. Null when none is near; an object right under
 * the pointer (dist 0) beats every ring sample.
 */
export function chooseHover(candidates: readonly HoverCandidate[], current: string | null, count = candidates.length): string | null {
  let best: HoverCandidate | null = null, bestCost = Infinity, held = Infinity;
  for (let i = 0; i < count; i++) {
    const c = candidates[i];
    if (c.dist > HOVER_REACH_PX) continue;
    const cost = hoverCost(c);
    if (c.key === current && cost < held) held = cost;
    if (cost < bestCost) { best = c; bestCost = cost; }
  }
  if (best === null) return null;
  if (held < Infinity && held <= bestCost + STICK_PX) return current;
  return best.key;
}

/** The facts a building's second line may take, the first present winning: what is going on with it */
const STATE_FACTS = ["site.months_left", "object.fact.going_up", "object.fact.rundown", "object.fact.weathered",
  "object.fact.vacant", "object.fact.unpowered", "object.fact.dry", "object.fact.people"];

/** A piece of a tooltip's line: an i18n key with its params */
export interface TooltipPart { key: string; params?: Record<string, string | number> }
/** A line: its parts, said one after the other with a dot between */
export type TooltipLine = readonly TooltipPart[];

const part = (f: Pick<Fact, "key" | "params">): TooltipPart => ({ key: f.key, params: f.params });

/**
 * The tooltip's lines for what the inspector found (src/inspect.ts): what it is with its level beside it where it has one
 * (a road: its kind and the street's name), then one line of its state (a road: its load). The keys are the card's own,
 * so the words stay in one place.
 */
export function tooltipLines(found: Pick<Inspection, "title" | "facts" | "checklist" | "street">): TooltipLine[] {
  const facts: readonly Fact[] = found.facts;
  const has = (key: string): Fact | undefined => facts.find(f => f.key === key);
  const state = STATE_FACTS.map(has).find(Boolean);
  if (found.title.key === "object.kind.road") {
    const kind = has("object.fact.road_level");
    const first: TooltipPart[] = [kind ? part(kind) : { key: found.title.key }];
    if (found.street) first.push({ key: found.street.key, params: found.street.params });
    const load = has("object.fact.road_cars") ?? has("object.fact.traffic") ?? has("object.fact.road_empty");
    return load ? [first, [part(load)]] : [first];
  }
  const level = found.checklist && found.checklist.level > 0
    ? { key: "object.fact.level", params: { level: found.checklist.level } } : has("object.fact.level") ?? has("object.fact.canal_level");
  const first: TooltipPart[] = [{ key: found.title.key, params: found.title.params }];
  if (level) first.push(part(level));
  return state ? [first, [part(state)]] : [first];
}

export interface HoverContext {
  /** A building or drawing tool is in hand (its own outline shows instead) */
  toolInHand: boolean;
  /** The pointer is on the city, not on a card, button or window */
  onCity: boolean;
  /** A mouse button is held, a stroke or the camera is being dragged */
  dragging: boolean;
  /** The camera is flying (home, a framed building) */
  flying: boolean;
}

/** Whether anything may be outlined or named now */
export function hoverAllowed(c: HoverContext): boolean {
  return !c.toolInHand && c.onCity && !c.dragging && !c.flying;
}

/** Whether the tooltip shows: the pointer has rested on the object, and nothing else forbids it */
export function tooltipShows(c: HoverContext, restedMs: number): boolean {
  return hoverAllowed(c) && restedMs >= TOOLTIP_REST_MS;
}

/** Where a tooltip's top-left goes beside the pointer, never over it (below and right, else above or left) and inside the
 * screen (CSS pixels) */
export function tooltipPlace(px: number, py: number, width: number, height: number, screenW: number, screenH: number,
  gap = 18): { x: number; y: number } {
  let x = px + gap, y = py + gap;
  if (x + width > screenW - 4) x = px - gap - width;
  if (y + height > screenH - 4) y = py - gap - height;
  return { x: Math.max(4, Math.min(x, screenW - width - 4)), y: Math.max(4, Math.min(y, screenH - height - 4)) };
}
