/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// How the tool in hand draws (โหมดวาด, owner 13 Oct 2026, docs/ZONE_PAINT.md), as Cities: Skylines' tool modes do:
// roads, railways and power lines draw a straight line between two clicks, a curve bent by one or two clicks more,
// follow the mouse freely, or lay a grid across a dragged rectangle (src/drawPaths.ts); the zone brushes of a map with
// painted zones (src/plots.ts) paint under the mouse, fill a dragged rectangle, or fill a whole stretch of empty land
// along a road. The mode is chosen in a row of the tool levels card (src/toolLevels.ts) and remembered in this browser.
// The game does the drawing (src/game.js); this only knows the modes.

import { t } from "./i18n/index";
import { ERASE_TOOL, PAINT_TOOLS } from "./plots";
import { ROAD_TOOLS, UPGRADE_TOOL } from "./roadLevels";

export const LINE_MODES = ["straight", "curve", "curve2", "free", "grid"] as const;
export const PAINT_MODES = ["brush", "rectangle", "fill"] as const;
export type DrawMode = typeof LINE_MODES[number] | typeof PAINT_MODES[number];
type ModeGroup = "line" | "paint";

/** The clicks a clicked mode takes: the start and the end, and one or two bends between */
export const POINTS_NEEDED: Readonly<Partial<Record<DrawMode, number>>> = { straight: 2, curve: 3, curve2: 4 };

const LINE_TOOLS = new Set<string>([...ROAD_TOOLS, UPGRADE_TOOL, "rail", "wire"]);
const PAINT_TOOL_NAMES = new Set<string>([...Object.values(PAINT_TOOLS), ERASE_TOOL]);
const GROUP_MODES: Readonly<Record<ModeGroup, readonly DrawMode[]>> = { line: LINE_MODES, paint: PAINT_MODES };
// Zones are painted by dragging a rectangle over them (owner, 15 Oct 2026: "บ้าน ร้านค้า อุสาหกรรม การวาด ต้องเป็น drag แล้ว
// คลุมได้")
const DEFAULTS: Readonly<Record<ModeGroup, DrawMode>> = { line: "straight", paint: "rectangle" };
// Kept per player; a new key from 15 Oct 2026, when the brushes' default became the rectangle, so every player gets it
const STORAGE_KEY = "phaicity.drawModes.2";

/** Whether a tool draws lines (roads, railways, power lines) or paints zones, or neither. */
export function modeGroupOf(tool: string | null | undefined): ModeGroup | null {
  if (!tool) return null;
  if (LINE_TOOLS.has(tool)) return "line";
  return PAINT_TOOL_NAMES.has(tool) ? "paint" : null;
}

/** Whether a tool is one of the zone brushes or the eraser. */
export const isPaintTool = (tool: string | null | undefined): boolean => modeGroupOf(tool) === "paint";

/** Whether the grid of tiles that can take painted zones shows with this tool in hand: the brushes only, so a road is
 * drawn over open land as in Cities: Skylines (owner, 14 Oct 2026: "การวาดถนน ทำไมมันเป็นช่องแบบนี้นะ") */
export const showsZoneGrid = (tool: string | null | undefined): boolean => isPaintTool(tool);

function loadModes(): Record<ModeGroup, DrawMode> {
  const modes = { ...DEFAULTS };
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "null") as Record<string, unknown> | null;
    for (const group of ["line", "paint"] as const) {
      const mode = saved?.[group];
      if (typeof mode === "string" && (GROUP_MODES[group] as readonly string[]).includes(mode)) modes[group] = mode as DrawMode;
    }
  } catch {
    // No storage here (a private window, tests): the defaults
  }
  return modes;
}

const current = loadModes();

/** The mode the tool draws in, or null for a tool without modes. */
export function drawModeOf(tool: string | null | undefined): DrawMode | null {
  const group = modeGroupOf(tool);
  return group ? current[group] : null;
}

/** The modes a tool may draw in (none for most tools). */
export function modesFor(tool: string | null | undefined): readonly DrawMode[] {
  const group = modeGroupOf(tool);
  return group ? GROUP_MODES[group] : [];
}

/** Chooses the mode of the tool's group, and remembers it in this browser. */
export function setDrawMode(tool: string, mode: DrawMode): void {
  const group = modeGroupOf(tool);
  if (!group || !GROUP_MODES[group].includes(mode)) return;
  current[group] = mode;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Not remembered, but chosen
  }
}

const SNAP_KEY = "phaicity.drawSnap";
let snapping = (() => {
  try {
    return globalThis.localStorage?.getItem(SNAP_KEY) !== "off";
  } catch {
    return true;
  }
})();

/** Whether lines snap onto roads, straight and 45° lines and the guidelines beside roads (src/drawPaths.ts); on by default. */
export const snapOn = (): boolean => snapping;

export function setSnap(on: boolean): void {
  snapping = on;
  try {
    globalThis.localStorage?.setItem(SNAP_KEY, on ? "on" : "off");
  } catch {
    // Not remembered, but set
  }
}

/** Modes a click works in: a point of a line, or a fill. */
export const isClickMode = (mode: DrawMode | null): boolean =>
  mode === "straight" || mode === "curve" || mode === "curve2" || mode === "fill";

/** Modes a dragged rectangle works in. */
export const isAreaMode = (mode: DrawMode | null): boolean => mode === "rectangle" || mode === "grid";

// Small line pictures of the modes, drawn in the text colour
const ICONS: Readonly<Record<DrawMode, string>> = {
  straight: '<path d="M3 13 13 3"/><circle cx="3" cy="13" r="1.5"/><circle cx="13" cy="3" r="1.5"/>',
  curve: '<path d="M3 13Q3 3 13 3"/><circle cx="3" cy="13" r="1.5"/><circle cx="13" cy="3" r="1.5"/>',
  curve2: '<path d="M2 13C8 13 8 3 14 3"/><circle cx="2" cy="13" r="1.5"/><circle cx="14" cy="3" r="1.5"/>',
  free: '<path d="M2 12c2-6 4 2 6-3s3-5 6-6"/>',
  grid: '<path d="M2 2h12v12H2zM6.7 2v12M11.3 2v12M2 6.7h12M2 11.3h12"/>',
  brush: '<path d="M10 2 14 6 7 13H3V9z"/><path d="M8.5 3.5l4 4"/>',
  rectangle: '<path d="M2.5 3.5h11v9h-11z" stroke-dasharray="2 1.5"/>',
  fill: '<path d="M3 8 8 3l5 5-5 5z"/><path d="M13.5 10.5c.8 1.2 1 2 1 2.5a1 1 0 0 1-2 0c0-.5.2-1.3 1-2.5z"/>',
};

/** The modes row of the tool levels card: one small button a mode, the one in use marked. */
export function renderModes(row: HTMLElement, tool: string | null, doc: Document = document): void {
  const modes = modesFor(tool);
  row.hidden = modes.length === 0 || !tool;
  if (row.hidden || !tool) {
    row.replaceChildren();
    return;
  }
  const title = doc.createElement("span");
  title.className = "modesTitle";
  title.textContent = t("draw.mode");
  const buttons = modes.map((mode) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `modeButton${mode === drawModeOf(tool) ? " current" : ""}`;
    button.dataset.mode = mode;
    button.title = t(`draw.mode.${mode}.hint`);
    button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[mode]}</svg>`;
    const name = doc.createElement("span");
    name.textContent = t(`draw.mode.${mode}`);
    button.appendChild(name);
    button.addEventListener("click", () => {
      setDrawMode(tool, mode);
      renderModes(row, tool, doc);
    });
    return button;
  });
  // Lines may snap; a switch after their modes
  if (modeGroupOf(tool) === "line") {
    const snap = doc.createElement("button");
    snap.type = "button";
    snap.className = `modeButton snapButton${snapping ? " current" : ""}`;
    snap.title = t("draw.snap.hint");
    snap.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${SNAP_ICON}</svg>`;
    const name = doc.createElement("span");
    name.textContent = t("draw.snap");
    snap.appendChild(name);
    snap.addEventListener("click", () => {
      setSnap(!snapping);
      renderModes(row, tool, doc);
    });
    buttons.push(snap);
  }
  row.replaceChildren(title, ...buttons);
}

const SNAP_ICON = '<path d="M3 3v4a5 5 0 0 0 10 0V3"/><path d="M3 3h3M10 3h3"/>';
