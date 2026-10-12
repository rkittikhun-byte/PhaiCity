/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// CityView: everything the game asks of whatever draws the city. The 2D view (src/cityView2d.ts, around
// gameCanvas.js) implements it today; the three.js view (src/render3d/city/, docs/3d/RENDERER_SPEC.md) will
// implement the same interface, so the game never needs to know which one it has.
// A view only reads the city. It never changes the map, the budget or the sprites (CLAUDE.md, "Online plan").
// Positions the game passes in and gets back are map tiles, never pixels, so a view may draw tiles any size.

export interface TilePoint {
  x: number;
  y: number;
}

/** A rectangle of map tiles, both corners included. */
export interface TileRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The tool under the mouse: the tile the mouse is on, the tool's square size in tiles and its colour. */
export interface ToolHover {
  tile: TilePoint;
  size: number;
  colour: string;
  /** While a zone tool drags an area: every tile the zones will cover. toolFootprint returns it. */
  area?: TileRect;
}

export interface CityView {
  readonly kind: "2d" | "3d";
  /** The view's size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /**
   * Draws a frame: called on every animation frame. hover is the tool's footprint under the mouse (see
   * toolFootprint), sprites are the moving things from src/spriteManager.js (positions in 16-unit world pixels).
   */
  paint(hover: ToolHover | null, sprites: unknown[] | null, isPaused: boolean): void;
  /** The map tile under a point of the view (CSS pixels from its top-left), or null when it is not on the map. */
  tileAt(x: number, y: number): TilePoint | null;
  /** The map tiles on screen, clipped to the map, or null when none are. Sound and sprites use it. */
  visibleTiles(): TileRect | null;
  /** Keyboard panning: called on every game tick while the key is held. */
  moveNorth(): void;
  moveEast(): void;
  moveSouth(): void;
  moveWest(): void;
  /** Brings a map tile to the middle of the view (news items and disasters use it). */
  centreOn(x: number, y: number): void;
  /** Images as data: URLs, for the snapshot window. */
  screenshotMap(): string;
  screenshotVisible(): string;
  /** A short shake (earthquakes). */
  shake(): void;
  /**
   * 3D only, optional: turns the camera around the point it looks at, by degrees (positive turns clockwise as seen
   * from above). The corner buttons and the Q and E keys use it when the view has it (src/viewSwitch.ts).
   */
  rotate?(degrees: number): void;
}

/** The functions every view has; tests of each view check them (test/cityView.ts, and the 3D view's own test). */
export const CITY_VIEW_FUNCTIONS = [
  "paint", "tileAt", "visibleTiles", "moveNorth", "moveEast", "moveSouth", "moveWest",
  "centreOn", "screenshotMap", "screenshotVisible", "shake",
] as const;

/** The CityView functions an object lacks (none for a complete view). */
export function missingViewFunctions(view: object): string[] {
  const record = view as Record<string, unknown>;
  return CITY_VIEW_FUNCTIONS.filter((name) => typeof record[name] !== "function");
}

/**
 * The map tiles a tool covers when the mouse is on a tile: tools bigger than 2×2 have the mouse one tile in from
 * their top-left corner (zones and buildings are placed by that tile, src/buildingTool.js).
 */
export function toolFootprint(hover: ToolHover): TileRect {
  if (hover.area) return { ...hover.area };
  const offset = hover.size > 2 ? 1 : 0;
  const x0 = hover.tile.x - offset;
  const y0 = hover.tile.y - offset;
  return { x0, y0, x1: x0 + hover.size - 1, y1: y0 + hover.size - 1 };
}

/** The most zones one dragged area lays. */
export const MAX_AREA_ZONES = 400;

/**
 * The centres of the zones a dragged area lays: a zone on the tile where the drag began, then one every `size`
 * tiles towards where it ends, side by side, as long as the zones stay within the drag (at least one zone).
 */
export function areaCentres(start: TilePoint, end: TilePoint, size: number): TilePoint[] {
  const along = (from: number, to: number): number[] => {
    const count = Math.floor(Math.abs(to - from) / size) + 1;
    const step = to >= from ? size : -size;
    return Array.from({ length: count }, (_, i) => from + i * step);
  };
  const xs = along(start.x, end.x);
  const ys = along(start.y, end.y).slice(0, Math.max(1, Math.floor(MAX_AREA_ZONES / xs.length)));
  return ys.flatMap((y) => xs.map((x) => ({ x, y }))).slice(0, MAX_AREA_ZONES);
}

/** Every tile the zones at these centres cover. */
export function areaFootprint(centres: readonly TilePoint[], size: number): TileRect {
  const offset = size > 2 ? 1 : 0;
  const xs = centres.map((c) => c.x);
  const ys = centres.map((c) => c.y);
  const x0 = Math.min(...xs) - offset;
  const y0 = Math.min(...ys) - offset;
  return { x0, y0, x1: Math.max(...xs) - offset + size - 1, y1: Math.max(...ys) - offset + size - 1 };
}

/** A rectangle cut down to the map, or null when it lies wholly outside. */
export function clipToMap(rect: TileRect, width: number, height: number): TileRect | null {
  const clipped = {
    x0: Math.max(0, rect.x0),
    y0: Math.max(0, rect.y0),
    x1: Math.min(width - 1, rect.x1),
    y1: Math.min(height - 1, rect.y1),
  };
  return clipped.x0 > clipped.x1 || clipped.y0 > clipped.y1 ? null : clipped;
}

/** World pixels per map tile in sprite positions (src/spriteUtils.js), whatever size a view draws tiles. */
export const SPRITE_UNITS_PER_TILE = 16;
