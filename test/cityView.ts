/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { clipToMap, missingViewFunctions, toolFootprint } from "../src/cityView";
import { CityView2D, TileCanvas } from "../src/cityView2d";

describe("toolFootprint", () => {
  test("puts the mouse one tile in from the corner of tools bigger than 2×2, like the buildings", () => {
    const at = (size: number) => toolFootprint({ tile: { x: 10, y: 20 }, size, colour: "lime" });
    expect(at(1)).toEqual({ x0: 10, y0: 20, x1: 10, y1: 20 });
    expect(at(2)).toEqual({ x0: 10, y0: 20, x1: 11, y1: 21 });
    expect(at(3)).toEqual({ x0: 9, y0: 19, x1: 11, y1: 21 });
    expect(at(4)).toEqual({ x0: 9, y0: 19, x1: 12, y1: 22 });
    expect(at(6)).toEqual({ x0: 9, y0: 19, x1: 14, y1: 24 });
  });
});

describe("clipToMap", () => {
  test("cuts a rectangle to the map, or drops it when it is all outside", () => {
    expect(clipToMap({ x0: -3, y0: 5, x1: 250, y1: 9 }, 200, 200)).toEqual({ x0: 0, y0: 5, x1: 199, y1: 9 });
    expect(clipToMap({ x0: -9, y0: -9, x1: -1, y1: 3 }, 200, 200)).toBeNull();
  });
});

// gameCanvas.js stand-in: 16 px tiles, a 10×8-tile window whose top-left tile is the origin
function fakeCanvas() {
  const calls: unknown[] = [];
  const canvas: TileCanvas & { origin: { x: number; y: number } } = {
    origin: { x: -2, y: 5 },
    canvasWidth: 160,
    canvasHeight: 128,
    animationManager: {},
    init: () => undefined,
    paint: (mouse, sprites, isPaused) => { calls.push({ mouse, sprites, isPaused }); },
    canvasCoordinateToTileCoordinate(x, y) {
      return { x: this.origin.x + Math.floor(x / 16), y: this.origin.y + Math.floor(y / 16) };
    },
    getTileOrigin() { return { ...this.origin }; },
    getMaxTile() { return { x: this.origin.x + 9, y: this.origin.y + 7 }; },
    moveNorth: () => calls.push("north"),
    moveEast: () => calls.push("east"),
    moveSouth: () => calls.push("south"),
    moveWest: () => calls.push("west"),
    centreOn: (x, y) => calls.push(`centre ${x},${y}`),
    screenshotMap: () => "data:map",
    screenshotVisible: () => "data:visible",
    shoogle: () => calls.push("shake"),
  };
  return { canvas, calls, view: new CityView2D(canvas, { width: 200, height: 200 }) };
}

describe("CityView2D", () => {
  test("has every CityView function", () => {
    expect(missingViewFunctions(fakeCanvas().view)).toEqual([]);
    expect(missingViewFunctions({ paint() { /* only one */ } })).toContain("tileAt");
  });

  test("answers in map tiles, and nothing off the map", () => {
    const { view } = fakeCanvas();
    expect(view.tileAt(40, 20)).toEqual({ x: 0, y: 6 });
    expect(view.tileAt(0, 0)).toBeNull(); // tile -2: the dark margin left of the map
    expect(view.visibleTiles()).toEqual({ x0: 0, y0: 5, x1: 7, y1: 12 });
    expect([view.width, view.height]).toEqual([160, 128]);
  });

  test("hands gameCanvas.js the mouse tile as an offset from its top-left tile", () => {
    const { view, calls } = fakeCanvas();
    view.paint({ tile: { x: 3, y: 9 }, size: 3, colour: "lime" }, null, false);
    view.paint(null, [], true);
    expect(calls).toEqual([
      { mouse: { x: 5, y: 4, width: 3, height: 3, colour: "lime" }, sprites: null, isPaused: false },
      { mouse: null, sprites: [], isPaused: true },
    ]);
  });

  test("passes moves, centring, screenshots and shakes through", () => {
    const { view, calls } = fakeCanvas();
    view.moveNorth(); view.moveEast(); view.moveSouth(); view.moveWest();
    view.centreOn(50, 60);
    view.shake();
    expect(calls).toEqual(["north", "east", "south", "west", "centre 50,60", "shake"]);
    expect([view.screenshotMap(), view.screenshotVisible()]).toEqual(["data:map", "data:visible"]);
  });
});
