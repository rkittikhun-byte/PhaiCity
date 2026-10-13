/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Painted zones (src/plots.ts, docs/ZONE_PAINT.md): on a real-scale city map homes, shops and factories are painted a
// tile at a time within reach of a road, and each painted tile grows its own building, level by level.

import { BaseTool } from "../src/baseTool.js";
import { CityCommands } from "../src/cityCommands";
import { drawModeOf, isAreaMode, isClickMode, modesFor, showsZoneGrid } from "../src/drawModes";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import {
  ERASE_TOOL, fillRegion, nearestRoad, PAINT_TOOLS, paintOutcome, PLOT_KINDS, PLOT_REACH, PLOT_TOP, plotFacing, plotOf,
  plotTile, readPlotValue, zonable,
} from "../src/plots";
import { Random } from "../src/random";
import { MOTORWAY_LEVEL, newRoadLevels } from "../src/roadLevels";
import { Simulation } from "../src/simulation.js";
import { BLBNCNBIT, ZONEBIT } from "../src/tileFlags";
import { COMBASE, DIRT, FREEZ, INDBASE, RESBASE, WOODS } from "../src/tileValues";

const ROAD_Y = 8;

/** A painted city map: a road along ROAD_Y from x = 2 to 40, and money in the bank. */
function city() {
  const map: any = new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);
  map.paintedZones = true;
  map.tileSizeM = 16;
  map.roadLevels = newRoadLevels(map.width, map.height);
  const sim: any = new (Simulation as any)(map, 0, 3, null);
  const tools: any = new (GameTools as any)(map);
  sim.budget.setFunds(100000);
  (BaseTool as any).setAutoBulldoze(true);
  const commands = new CityCommands({
    width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
    disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
    map, cityTime: () => sim._cityTime, houseMap: map, rank: () => 5,
    setRoadLevel: (x: number, y: number, level: number) => { map.roadLevels[y * map.width + x] = level; },
  } as any);
  for (let x = 2; x <= 40; x++) commands.apply({ type: "tool", tool: "road", x, y: ROAD_Y, stroke: 1 });
  return { map, sim, tools, commands };
}

describe("painted zones", () => {
  test("a plot's tile says its kind, its level and its land class", () => {
    for (const kind of PLOT_KINDS) {
      for (let level = 0; level <= PLOT_TOP[kind]; level++) {
        for (let value = 0; value <= (kind === "industrial" ? 1 : 3); value++) {
          const plot = readPlotValue(plotTile(kind, level, value, 2));
          expect(plot).toEqual({ kind, level, value: level === 0 ? 0 : value });
        }
      }
    }
    expect(plotTile("residential", 0)).toBe(RESBASE);
    expect(plotTile("commercial", 0)).toBe(COMBASE);
    expect(plotTile("industrial", 0)).toBe(INDBASE);
    expect(readPlotValue(DIRT)).toBeNull();
  });

  test("only a map with painted zones has plots, and never on a 3 × 3 zone's tiles", () => {
    const { map } = city();
    map.setTile(5, 10, plotTile("residential", 1), BLBNCNBIT);
    expect(plotOf(map, 5, 10)).toMatchObject({ kind: "residential", level: 1 });
    map.paintedZones = false;
    expect(plotOf(map, 5, 10)).toBeNull();
    map.paintedZones = true;
    // A zone laid before the map had painted zones: its centre and the tiles round it are not plots
    map.setTile(20, 12, FREEZ, BLBNCNBIT | ZONEBIT);
    map.setTile(21, 12, RESBASE + 5, BLBNCNBIT);
    expect(plotOf(map, 20, 12)).toBeNull();
    expect(plotOf(map, 21, 12)).toBeNull();
  });

  test("paint reaches three tiles from a road, straight along a row or a column, and not from a motorway", () => {
    const { map } = city();
    expect(PLOT_REACH).toBe(3);
    expect(nearestRoad(map, 10, ROAD_Y + 3)).toEqual({ x: 10, y: ROAD_Y });
    expect(nearestRoad(map, 10, ROAD_Y + 4)).toBeNull();
    expect(zonable(map, 10, ROAD_Y - 3)).toBe(true);
    expect(zonable(map, 10, ROAD_Y + 4)).toBe(false);
    expect(zonable(map, 10, ROAD_Y)).toBe(false); // the road itself
    // A building faces its road: south of the road it faces north, north of it south
    expect(plotFacing(map, 10, ROAD_Y + 2)).toBe(0);
    expect(plotFacing(map, 10, ROAD_Y - 2)).toBe(2);
    for (let x = 2; x <= 40; x++) map.roadLevels[ROAD_Y * map.width + x] = MOTORWAY_LEVEL;
    expect(zonable(map, 10, ROAD_Y + 1)).toBe(false);
  });

  test("the brushes paint one tile, for a ninth of a zone, clear woods, and undo", () => {
    const { map, sim, commands, tools } = city();
    expect(tools[PAINT_TOOLS.residential].toolCost).toBe(11);
    const funds = sim.budget.totalFunds;
    expect(commands.apply({ type: "tool", tool: "zone_residential", x: 10, y: ROAD_Y + 1, stroke: 2 }))
      .toMatchObject({ accepted: true, toolResult: 0 });
    expect(map.getTileValue(10, ROAD_Y + 1)).toBe(RESBASE);
    expect(map.getTileFlags(10, ROAD_Y + 1) & ZONEBIT).toBe(0);
    expect(funds - sim.budget.totalFunds).toBe(11);
    // Painting it again changes nothing and costs nothing; another kind may go on an empty plot
    commands.apply({ type: "tool", tool: "zone_residential", x: 10, y: ROAD_Y + 1, stroke: 3 });
    expect(funds - sim.budget.totalFunds).toBe(11);
    expect(paintOutcome(map, "commercial", 10, ROAD_Y + 1)).toBe("paint");
    // Too far from a road
    expect(commands.apply({ type: "tool", tool: "zone_residential", x: 10, y: ROAD_Y + 5, stroke: 4 }).toolResult)
      .toBe(1);
    // Woods are cleared at the province's price
    map.setTile(12, ROAD_Y + 1, WOODS, 0);
    commands.apply({ type: "tool", tool: "zone_industrial", x: 12, y: ROAD_Y + 1, stroke: 5 });
    expect(plotOf(map, 12, ROAD_Y + 1)).toMatchObject({ kind: "industrial", level: 0 });
    expect(commands.apply({ type: "undo" }).undone).toBe(true);
    expect(map.getTileValue(12, ROAD_Y + 1)).toBe(WOODS);
  });

  test("the eraser takes the paint off empty plots only", () => {
    const { map, commands } = city();
    commands.apply({ type: "tool", tool: "zone_commercial", x: 10, y: ROAD_Y - 1, stroke: 2 });
    expect(commands.apply({ type: "tool", tool: ERASE_TOOL, x: 10, y: ROAD_Y - 1, stroke: 3 }).toolResult).toBe(0);
    expect(map.getTileValue(10, ROAD_Y - 1)).toBe(DIRT);
    map.setTile(11, ROAD_Y - 1, plotTile("commercial", 2, 1), BLBNCNBIT);
    expect(commands.apply({ type: "tool", tool: ERASE_TOOL, x: 11, y: ROAD_Y - 1, stroke: 4 }).toolResult).toBe(3);
  });

  test("a fill paints the bare land along the road up to other zones, and erasing fills the same kind", () => {
    const { map } = city();
    map.setTile(20, ROAD_Y + 1, plotTile("commercial", 0), BLBNCNBIT);
    map.setTile(20, ROAD_Y + 2, plotTile("commercial", 0), BLBNCNBIT);
    map.setTile(20, ROAD_Y + 3, plotTile("commercial", 0), BLBNCNBIT);
    const tiles = fillRegion(map, 10, ROAD_Y + 1, "residential");
    // From the road's start at x = 2 (reach goes 3 past its end) to the shops at x = 20, three deep
    expect(tiles.every((t) => t.y > ROAD_Y && t.y <= ROAD_Y + 3 && t.x < 20)).toBe(true);
    expect(tiles.length).toBe((19 - 0 + 1) * 3 - 6); // x 0..19 × 3 rows, less the 6 tiles left of x = 2 not in reach
    expect(fillRegion(map, 20, ROAD_Y + 1, null).length).toBe(3);
    expect(fillRegion(map, 10, ROAD_Y + 1, null)).toEqual([]);
  });

  test("painted plots grow buildings of their own and count in the census", () => {
    Random.seed(7);
    const { map, sim, commands } = city();
    commands.apply({ type: "setting", setting: "autoBudget", on: true });
    commands.apply({ type: "tool", tool: "coal", x: 3, y: 3 }); // x 2..5, y 2..5
    commands.apply({ type: "tool", tool: "wire", x: 6, y: ROAD_Y }); // power across the road
    let stroke = 10;
    for (let x = 6; x <= 30; x++) {
      for (let y = ROAD_Y + 1; y <= ROAD_Y + 3; y++) commands.apply({ type: "tool", tool: "zone_residential", x, y, stroke });
      for (let y = ROAD_Y - 3; y <= ROAD_Y - 1; y++) {
        commands.apply({ type: "tool", tool: x < 18 ? "zone_commercial" : "zone_industrial", x, y, stroke });
      }
    }
    for (let step = 0; step < 2 * 48 * 16; step++) sim._simulate(sim._constructSimData());
    const levels: Record<string, number[]> = { residential: [], commercial: [], industrial: [] };
    for (let y = ROAD_Y - 3; y <= ROAD_Y + 3; y++) {
      for (let x = 6; x <= 30; x++) {
        const plot = plotOf(map, x, y);
        if (plot) levels[plot.kind].push(plot.level);
      }
    }
    expect(levels.residential.some((level) => level >= 1)).toBe(true);
    expect(levels.residential.length).toBe(25 * 3);
    expect(sim._census.resPop).toBeGreaterThan(0);
    expect(sim._census.resZonePop).toBeCloseTo(75 / 8, 5);
  });

  test("the draw modes: lines for roads, brushes for zones, and every string", () => {
    expect(modesFor("road")).toContain("curve2");
    expect(modesFor("zone_residential")).toEqual(["brush", "rectangle", "fill"]);
    expect(modesFor("park")).toEqual([]);
    expect(drawModeOf("rail")).not.toBeNull();
    expect(isClickMode("straight") && isClickMode("fill") && !isClickMode("free")).toBe(true);
    expect(isAreaMode("grid") && isAreaMode("rectangle") && !isAreaMode("brush")).toBe(true);
    expect(showsZoneGrid("road_asphalt") && showsZoneGrid(ERASE_TOOL) && !showsZoneGrid("rail")).toBe(true);
    const keys = ["draw.mode", "draw.cost", "draw.cancel", "draw.step.fill", "choice.erase_note"];
    for (const mode of [...modesFor("road"), ...modesFor("zone_erase")]) keys.push(`draw.mode.${mode}`, `draw.mode.${mode}.hint`);
    for (const [mode, steps] of [["straight", 2], ["curve", 3], ["curve2", 4]] as const) {
      for (let step = 0; step < steps; step++) keys.push(`draw.step.${mode}.${step}`);
    }
    for (const kind of PLOT_KINDS) keys.push(`tool.${PAINT_TOOLS[kind]}`, `choice.${PAINT_TOOLS[kind]}`, `choice.title.${kind}`);
    keys.push(`tool.${ERASE_TOOL}`, `choice.${ERASE_TOOL}`);
    for (const key of keys) expect([key, hasKey(key)]).toEqual([key, true]);
  });
});
