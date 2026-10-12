/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The original 2D tile view (src/gameCanvas.js, 16 px tiles) behind the CityView interface (src/cityView.ts).
// It only translates between map tiles, which the game speaks, and gameCanvas.js's screen offsets.

import type { CityView, TilePoint, TileRect, ToolHover } from "./cityView";
import { clipToMap } from "./cityView";
import { GameCanvas } from "./gameCanvas.js";

/** The parts of gameCanvas.js used here. */
export interface TileCanvas {
  canvasWidth: number;
  canvasHeight: number;
  animationManager: unknown;
  init(map: unknown, tileSet: unknown, spriteSheet: unknown): void;
  paint(mouse: { x: number; y: number; width: number; height: number; colour: string } | null,
    sprites: unknown[] | null, isPaused: boolean): void;
  canvasCoordinateToTileCoordinate(x: number, y: number): TilePoint | null;
  getTileOrigin(): TilePoint;
  getMaxTile(): TilePoint;
  moveNorth(): void;
  moveEast(): void;
  moveSouth(): void;
  moveWest(): void;
  centreOn(x: number, y: number): void;
  screenshotMap(): string;
  screenshotVisible(): string;
  shoogle(): void;
}

interface MapSize {
  width: number;
  height: number;
}

export class CityView2D implements CityView {
  readonly kind = "2d" as const;

  /** @param canvas the gameCanvas.js view, made by createCityView2D or given by tests */
  constructor(readonly canvas: TileCanvas, private readonly map: MapSize) {}

  get width(): number {
    return this.canvas.canvasWidth;
  }

  get height(): number {
    return this.canvas.canvasHeight;
  }

  paint(hover: ToolHover | null, sprites: unknown[] | null, isPaused: boolean): void {
    // gameCanvas.js takes the mouse tile as an offset from the view's top-left tile, and works out the footprint
    const origin = this.canvas.getTileOrigin();
    // A dragged area of zones is drawn as one box; gameCanvas.js moves boxes over 2 tiles back by one, so add it
    const area = hover?.area;
    const mouse = hover && (area ? {
      x: area.x0 - origin.x + (area.x1 - area.x0 + 1 > 2 ? 1 : 0),
      y: area.y0 - origin.y + (area.y1 - area.y0 + 1 > 2 ? 1 : 0),
      width: area.x1 - area.x0 + 1,
      height: area.y1 - area.y0 + 1,
      colour: hover.colour,
    } : {
      x: hover.tile.x - origin.x,
      y: hover.tile.y - origin.y,
      width: hover.size,
      height: hover.size,
      colour: hover.colour,
    });
    this.canvas.paint(mouse, sprites, isPaused);
  }

  tileAt(x: number, y: number): TilePoint | null {
    const tile = this.canvas.canvasCoordinateToTileCoordinate(x, y);
    if (!tile || tile.x < 0 || tile.y < 0 || tile.x >= this.map.width || tile.y >= this.map.height) return null;
    return tile;
  }

  visibleTiles(): TileRect | null {
    const origin = this.canvas.getTileOrigin();
    const last = this.canvas.getMaxTile();
    return clipToMap({ x0: origin.x, y0: origin.y, x1: last.x, y1: last.y }, this.map.width, this.map.height);
  }

  moveNorth(): void { this.canvas.moveNorth(); }
  moveEast(): void { this.canvas.moveEast(); }
  moveSouth(): void { this.canvas.moveSouth(); }
  moveWest(): void { this.canvas.moveWest(); }

  centreOn(x: number, y: number): void {
    this.canvas.centreOn(x, y);
  }

  screenshotMap(): string {
    return this.canvas.screenshotMap();
  }

  screenshotVisible(): string {
    return this.canvas.screenshotVisible();
  }

  shake(): void {
    this.canvas.shoogle();
  }
}

/** The 2D view filling the element with this id. */
export function createCityView2D(containerId: string, map: MapSize, tileSet: unknown, spriteSheet: unknown): CityView2D {
  const canvas = new (GameCanvas as unknown as new (parentId: string) => TileCanvas)(containerId);
  canvas.init(map, tileSet, spriteSheet);
  return new CityView2D(canvas, map);
}
