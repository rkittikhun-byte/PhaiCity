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
  /** The bulldozer's dragged path: its road tiles are shown as the stretch of road they hold, not the tiles' squares */
  doze?: boolean;
  /** While a zone tool drags an area: every tile the zones will cover. toolFootprint returns it. */
  area?: TileRect;
  /**
   * While a road is drawn by clicks, a grid or a rectangle is dragged or a fill is pointed at (src/drawModes.ts): each
   * tile it would build on. A view that cannot draw them one by one may draw toolFootprint's box round them.
   */
  path?: readonly TilePoint[];
  /** Whether path is a line being drawn (a road, railway or power line), shown with a dashed middle. */
  line?: boolean;
  /** ... and its tiles it could not build on (src/game.js estimateTiles), shown red */
  blocked?: readonly TilePoint[] | null;
  /** A zone brush on a map painted a cell at a time (src/zoneCells.ts): where the mouse is, in tiles, to show the cell
   * under it instead of a tile */
  cellPoint?: { x: number; y: number } | null;
  /** ... and while it drags a rectangle, the cells it will paint (their keys, src/zoneCells.ts), shown as they will be */
  cellKeys?: readonly number[] | null;
  /** A road or railway tool: where it would start or end, on an existing road's middle line when near one (in tiles),
   * shown as a small marker rather than a tile; and where the line being drawn started */
  linePoint?: { x: number; y: number } | null;
  lineStart?: { x: number; y: number } | null;
  /** ... and where the mouse is when the click would land elsewhere (a snap moved it, src/drawReadout.ts), in tiles */
  cursorPoint?: { x: number; y: number } | null;
  /** ... and a point on each road (or railway) tile near the mouse, on its middle line, where a click may join it; end:
   * a dead end, where a line goes on from it (src/game.js snapDots) */
  snapDots?: ReadonlyArray<{ x: number; y: number; end: boolean }> | null;
  /** ... and how many pixels a tile takes on the screen there, so they keep their size whatever the zoom */
  tilePixels?: number | null;
  /** The line is drawn in the straight mode: shown as one straight line from its start to its end */
  straight?: boolean;
  /** The points a line drawn by clicks bends through (straight, curve, S-curve), in tiles: its preview is that curve */
  controls?: readonly TilePoint[] | null;
  /** A building slid along its road (src/game.js buildingPose): where it would stand, x and z in world units, and its turn */
  pose?: readonly [number, number, number] | null;
  /** The tool puts a building down, which stands against its road (src/gameTools.js placesBuilding) ... */
  building?: boolean;
  /** ... drawn this share of its tiles where no road is near (1, or BUILDING_SCALE on a city map) */
  fill?: number;
  /** Width of a road or railway tool in world units, so its marker, line and rectangle previews match the road drawn */
  roadWidth?: number;
  /** Active drawing mode ('straight' | 'curve' | 'scurve' | 'free' | 'rectangle' | 'grid' | 'fill') */
  drawMode?: string;
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
  /** The point of the ground at (x, y) on the view, in tiles with their fractions, or null off the map (optional) */
  pointAt?(x: number, y: number): { x: number; y: number } | null;
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
   * from above). The corner buttons and the Q and E keys use it when the view has it (src/viewControls.ts).
   */
  rotate?(degrees: number): void;
  /** 3D only, optional: brings the camera back to the view a city opens with (the ⌂ corner button). */
  resetView?(): void;
  /**
   * 3D only, optional: lays a layer of the city map over the ground (owner, 15 Oct 2026), its picture a pixel a tile
   * (src/cityMap.ts layerPixels), or takes it away (null). The city map window calls it as its layer changes.
   */
  showLayer?(tiles: HTMLCanvasElement | null): void;
  /**
   * 3D only, optional: slides the city along with a mouse drag of dx, dy CSS pixels, so the ground under the mouse
   * stays under it. A left-button drag with no tool in hand uses it (src/viewControls.ts).
   */
  pan?(dx: number, dy: number): void;
  /**
   * 3D only, optional: how the building whose centre is tile (x, y) stands now against its road, [x, z, turn] in world
   * units, when it has no pose kept with the city yet (game.js keepBuildingPoses), else null.
   */
  buildingPoseOf?(x: number, y: number): [number, number, number] | null;
  /**
   * 3D only, optional: shows or hides the grid of tiles that can take painted zones (src/plots.ts), drawn along the
   * roads while a zone brush or a road tool is in hand, as Cities: Skylines shows its zone cells.
   */
  zoneGrid?(on: boolean): void;
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
  if (hover.path && hover.path.length > 0) {
    const xs = hover.path.map((t) => t.x);
    const ys = hover.path.map((t) => t.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
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
