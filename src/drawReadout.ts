/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The numbers shown while a road, railway or power line is drawn (owner, 18 Oct 2026: "ต้องมีระยะ zoom ให้แสดงด้วยไหม
// ว่าตอนนี้ zoom เท่าไหร่ และ จะ plot จุด a ที่ x,y เท่าไหร่ ให้เห็นชัดเจนเลย", "นอกจาก x,y น่าจะมี z ด้วย ทั้งจุด a และ จุด b"):
// how many pixels a tile is on the screen, each point's tile and ground height where the mouse is and where a click
// lands, why the snap moved it, and after building what was laid. The game (src/game.js) gathers them; this words them
// and keeps the zoom chip on the camera bar. Only reads the map.

import { t } from "./i18n/index";
import type { TilePoint } from "./cityView";

/** Why a click lands where it does (src/game.js snapTile) */
export type SnapWhy = "on" | "end" | "road" | "spacing" | "angle" | "way" | "none";

/** The pixels a tile takes on the screen round (x, y), from where the view finds the ground there; null off the map */
export function pixelsPerTile(view: { pointAt?(x: number, y: number): { x: number; y: number } | null }, x: number,
                              y: number, step = 40): number | null {
  if (typeof view.pointAt !== "function") return null;
  const here = view.pointAt(x, y), across = view.pointAt(x + step, y), down = view.pointAt(x, y + step);
  if (!here || !across || !down) return null;
  const tiles = Math.max(Math.hypot(across.x - here.x, across.y - here.y), Math.hypot(down.x - here.x, down.y - here.y));
  return tiles > 0 ? step / tiles : null;
}

/** The ground's height at a tile in metres (gameMap.heights), or null on a map without heights */
export function tileHeight(map: { width: number; height: number; heights?: ArrayLike<number> | null }, tile: TilePoint): number | null {
  const heights = map.heights;
  if (!heights || tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) return null;
  const z = heights[tile.y * map.width + tile.x];
  return Number.isFinite(z) ? z : null;
}

/**
 * Why a click at raw lands at landed: on a road already, joined to a road's dead end or to a road, moved to the
 * guideline beside a road, onto a straight or 45° line, along the line it goes on from, or where it was clicked.
 * isLine: whether a tile is of the tool's kind.
 */
export function snapWhy(raw: TilePoint, landed: TilePoint, guide: string | null,
                        isLine: (x: number, y: number) => boolean): SnapWhy {
  const moved = raw.x !== landed.x || raw.y !== landed.y;
  if (guide === "road") {
    if (!moved) return "on";
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isLine(landed.x + dx, landed.y + dy)).length;
    return beside <= 1 ? "end" : "road";
  }
  if (guide === "spacing" || guide === "way") return guide;
  return moved ? "angle" : "none";
}

const metres = (z: number | null): string => (z === null ? "–" : z.toFixed(1));

/** A point's name and its tile and height: "A (224, 263, 165.2 ม.)" */
export function pointText(name: string, tile: TilePoint, z: number | null): string {
  return t("draw.debug.point", { name, x: tile.x, y: tile.y, z: metres(z) });
}

/** The next click: where the mouse is, where it would land, and why: "B: เมาส์ (…) → ลงที่ (…) · ต่อปลายถนน" */
export function nextText(name: string, raw: TilePoint, rawZ: number | null, landed: TilePoint, landedZ: number | null,
                         why: SnapWhy): string {
  return t("draw.debug.next", { name, cx: raw.x, cy: raw.y, cz: metres(rawZ), x: landed.x, y: landed.y, z: metres(landedZ),
    why: t(`draw.debug.why.${why}`) });
}

/** After a line is built: where each point was clicked and where it was used, and how many of its tiles were laid,
 * with why the others were not */
export function strokeText(clicks: ReadonlyArray<{ name: string; raw: TilePoint; used: TilePoint }>, laid: number,
                           total: number, refused: ReadonlyArray<[string, number]>): string {
  const parts = clicks.map(({ name, raw, used }) => t("draw.debug.click", { name, cx: raw.x, cy: raw.y, x: used.x, y: used.y }));
  parts.push(t("draw.debug.laid", { laid, total }));
  for (const [why, count] of refused) parts.push(t("draw.debug.refused", { count, why }));
  return parts.join(" · ");
}

/** The zoom chip on the camera bar (src/cameraModes.ts): "1 ช่อง = 42 px" while a line tool is in hand, else hidden */
export function showZoom(pixels: number | null, doc: Document = document): void {
  let chip = doc.getElementById("zoomChip");
  if (!chip) {
    const bar = doc.getElementById("cameraBar");
    if (!bar) return;
    chip = doc.createElement("span");
    chip.id = "zoomChip";
    bar.prepend(chip);
  }
  const text = pixels === null ? "" : t("draw.debug.zoom", { px: pixels >= 10 ? Math.round(pixels) : pixels.toFixed(1) });
  if (chip.textContent !== text) chip.textContent = text;
  chip.hidden = text === "";
}
