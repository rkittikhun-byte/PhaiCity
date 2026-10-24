/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { registry } from '../models/registry.js';
import { roadForMask } from '../models/road/interfaces.js';
import { LAND_COVER_STATES } from '../models/terrain/terrain.js';
import { staircase as staircaseOf, staircaseVariant } from '../models/road/centreline.js';
import { railForMask } from '../models/rail/track.js';
import { powerForMask } from '../models/power/power.js';
import { BIT_MASK, POWERBIT, ZONEBIT } from '../../tileFlags.js';
import { CELL_M, cellPlotPose, type CellMap } from '../../zoneCells.js';
import { CIVIC, FARM, HARBOUR, MINE, PLANT2, PLANT2_BASE, PLANT3, PLANT3_BASE, POWERPLANT, STATION, WASTE } from '../../tileValues.js';
import { HOSPITAL_HEIGHTS } from '../models/civic/hospitals.js';
import { WASTE_HEIGHTS } from '../models/waste/waste.js';
import { LOT_SIZE, lotFacing, lotOf, type Plot, type PlotKind, plotFacing, plotKindOfValue, plotOf, plotTile, PLOT_TOP, readPlotValue } from '../../plots.js';
import { builtLevel, constructionShare, constructionStage, decayOf, isVacant, LOT_COLUMNS, type PlotBuilding, type PlotBuildings, type PlotListMap,
  usesPlotList } from '../../plotBuildings.js';
import type { CityMapReader } from './types.js';
import { FrontagePlacement, type FrontageGround, Placement, RoadsidePlacement, type PlacementFields } from './placement.js';
import { FRONTAGE_DEPTH_M, frontagePieces, listFrontagePieces, mapFrontagePlan, type FrontagePlan, type FrontagePlot } from './frontage.js';
import { roadReach } from '../../roadGeometry.js';
import { SEED_BUCKETS } from './types.js';
import type { RegionId } from '../regional/types.js';
import { type EraModels, eraKindFor, eraModelId, parseEraId, plotEraKind } from './eraBuildings.js';
import { mapEra } from '../../era.js';
import { laidOutline, outlineOf, type Outline, quarterTurn, TURNED_SIZES, turnedTilesOf, type FootprintMap } from '../../buildings/turnedFootprint.js';
import type { PlacedBuilding } from '../../buildings/placedBuildings.js';
import { type FieldMap, hubKind, type HubKind, isFieldValue } from '../../farmZone.js';
import { type MineKind, mineKindAt } from '../../mining.js';
import { isAnyRoad } from '../../roadTiles.js';
import { tileMetres, unitsPerMetre } from '../../units.js';
import { UNLOCKS } from '../../unlocks.js';
import { RAMPS } from '../../theme/tokens.js';
import { siteId } from '../models/plot/site.js';
import { parseRulerWings, rulerWingId, type RulerHouseWing } from '../models/civic/ruler-house.js';
import { TEMPLE_ID } from '../models/civic/temple.js';

export interface TileResolution { kind: string; id: string | null; footprint: readonly [number, number]; density: number }
const debug = (): TileResolution => ({ kind: 'debug', id: 'debug.box_3x3', footprint: [1, 1], density: 0 });
/** Shared joint tile ranges are a single mask-selected family, not competing model claims. */
export function makeTileTable(): readonly TileResolution[] {
  const table = Array.from({ length: 1024 }, debug);
  for (const [id, entry] of Object.entries(registry)) for (const value of entry.tiles) {
    if (value < 0 || value > 1023) throw new Error(`Invalid registry tile ${id}:${value}`);
    const family = value >= 212 && value <= 220 ? 'power' : value >= 228 && value <= 236 ? 'rail' : '';
    const old = table[value];
    if (old.kind !== 'debug' && !family) throw new Error(`Conflicting tile claims ${value}: ${old.id}, ${id}`);
    table[value] = { kind: family || entry.category, id: family ? `${family}.straight` : id, footprint: entry.footprint, density: 0 };
  }
  for (let value = 5; value <= 20; value++) table[value] = { kind: 'shore', id: 'terrain.shore', footprint: [1, 1], density: 0 };
  for (let value = 80; value <= 206; value++) table[value] = { kind: 'road', id: 'road.straight', footprint: [1, 1], density: 0 };
  for (const [start, , count, kind, levels] of [[240,244,1,'residential',4],[261,265,16,'residential',4],
    [423,427,1,'commercial',5],[432,436,20,'commercial',5],[612,616,1,'industrial',4],[621,625,8,'industrial',4]] as const) {
    for (let n = 0; n < count; n++) for (let i = 0; i < 9; i++) {
      const value = start + n * 9 + i;
      if (table[value].kind === 'debug') table[value] = { kind, id: null, footprint: [3, 3], density: start === 240 || start === 423 || start === 612 ? -1 : n % levels };
      else table[value] = { ...table[value], density: start === 240 || start === 423 ? -1 : n % levels };
    }
  }
  for (const [start, size, kind] of [[693,4,'transport'],[709,6,'transport'],[745,4,'services'],[761,3,'services'],
    [770,3,'services'],[779,4,'services'],[795,4,'services'],[811,4,'services'],[414,3,'services']] as const)
    for (let i = 0; i < size * size; i++) if (table[start+i].kind === 'debug') table[start+i] = { kind, id: null, footprint:[size,size], density:1 };
  // The extended 3 × 3s (water works, mines, farms, harbours, waste, stations) are generic buildings until registered
  for (let start = 956; start <= 1010; start += 9) for (let i=0;i<9;i++) if (table[start+i].kind==='debug') table[start+i] = { kind:'services', id:null, footprint:[3,3], density:1 };
  // The power plants on only the tiles their model covers (src/plantBlocks.ts): a 3 × 3 among the dust's tiles, a 2 × 2
  // on the seventh 3 × 3's last four
  for (let i = 0; i < 9; i++) table[PLANT3_BASE + i] = { kind: 'services', id: null, footprint: [3, 3], density: 1 };
  for (let i = 0; i < 4; i++) table[PLANT2_BASE + i] = { kind: 'services', id: null, footprint: [2, 2], density: 1 };
  // A demolition's dust (tiles 860-883, a bulldozer's or an explosion's) and a fire (56-63) have no model of their own: they
  // show as the rubble they turn into, never as the white test box (owner, 19 Oct 2026: "มันมีกล่องสี่เหลี่ยมได้ยังไง")
  for (const [from, to] of [[860, 883], [56, 63]] as const)
    for (let value = from; value <= to; value++) if (table[value].kind === 'debug') table[value] = { ...table[44] };
  // PhaiCity: a bus or songthaew stop (src/transit.ts) shows a songthaew waiting until the stop has a model of its own
  table[1021] = { kind:'transport', id:'veh.songthaew', footprint:[1,1], density:0 };
  return Object.freeze(table.map(entry=>Object.freeze(entry)));
}
export const TILE_TABLE = makeTileTable();
/** The farm building as its fields make it (src/farmZone.ts hubKind): the traditional rice mill, a cooperative's
 * warehouse, the food plant's cold store (models/industrial/zones.ts) */
const HUB_MODELS: Readonly<Record<HubKind, string>> = { rice_mill: 'ind.block_0_0', cooperative: 'ind.block_1_0', cold_store: 'ind.block_1_3' };
export const tileSeed = (x: number, y: number): number => {
  let h = Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d);
  h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (h ^ h >>> 16) >>> 0;
};
/** Any road tile a line runs up to (src/roadTiles.ts isAnyRoad) */
export const isRoad = isAnyRoad;
/** A road tile drawn from its neighbours alone: not a bridge, a crossing or a drawbridge. */
export const isPlainRoad = (v: number): boolean => v >= 66 && v <= 206 && v !== 77 && v !== 78;
export const isRail = (v: number): boolean => v >= 224 && v <= 238 || v === 221 || v === 222;
/** A plain railway tile; with the plain roads, drawn as part of a smooth curve when the view asks (roadCurves.ts) */
export const isCurveRail = (v: number): boolean => v >= 226 && v <= 236;
/** A road tile with a power line over it: the road is part of the curve, the wires keep their model (wiresOnly) */
export const isPowerCrossing = (v: number): boolean => v === 77 || v === 78;
export const isCurved = (v: number): boolean => isPlainRoad(v) || isPowerCrossing(v) || isCurveRail(v);
export const isPower = (v: number): boolean => v >= 208 && v <= 222 || v === 77 || v === 78 || v === 239;
export const isWater = (v: number): boolean => v >= 2 && v <= 20;
export const isWaterNeighbor = (v:number):boolean => isWater(v)||v===64||v===65||v===208||v===209||v===224||v===225||v>=828&&v<=832||v>=948&&v<=951;
export const isWoods = (v: number): boolean => v >= 21 && v <= 39;
const SIDES = [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]] as const;
/** Heights of the painted plots' buildings by level (src/plots.ts), for the far view's boxes and the camera */
const PLOT_HEIGHTS: Readonly<Record<PlotKind, readonly number[]>> = {
  residential: [0, 5, 7, 11, 18, 34], commercial: [0, 5, 9, 14, 24, 42], industrial: [0, 6, 8, 11, 14],
};
const PLOT_MODEL_PREFIX: Readonly<Record<PlotKind, string>> = { residential: 'res', commercial: 'com', industrial: 'ind' };
/** A building's turn so its front (+Z) faces its road: north, east, south, west (src/plots.ts plotFacing) */
const FACING_ROTATION = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
/** How big the ruler's buildings beside a curved road are drawn, as a share of their tiles (owner, 14 Oct 2026: "scale
 * ของแต่ละ tool ใหญ่ไป"): their real size on a city map's 16 m tiles (TileSnapshot.atRealSize), the same share on
 * other maps */
export const BUILDING_SCALE = 10 / 16;
/** Tiling pieces fill their tiles at any scale; everything else is drawn at its real size on a real-scale city map */
const TILING_KINDS: ReadonlySet<string> = new Set(['terrain', 'road', 'rail', 'power', 'shore', 'debug']);
/** Proportional scale adjustments on real-scale city maps so power plants, hospitals, waste facilities, high-rise plots,
 * and the district office (ruler_house) maintain clear, realistic architectural hierarchy relative to houses and roads. */
const CITY_MODEL_SCALE: Readonly<Record<string, number>> = {
  'power.coal': 0.75,
  'power.solar': 0.85,
  'power.wind': 0.85,
  'power.gas': 0.78,
  'power.hydro': 0.85,
  'power.nuclear': 0.70,
  'waste.waste_power_plant': 0.80,
  'waste.incinerator': 0.82,
  'waste.recycling_plant': 0.90,
  'waste.wastewater_plant': 0.90,
  'waste.landfill': 0.90,
  'civic.regional_hospital': 0.92,
  'civic.provincial_hospital': 0.95,
  'civic.community_hospital': 1.0,
  'svc.hospital': 0.95,
  'civic.ruler_house': 1.0,
  'water.works': 0.95,
  'svc.fire': 1.0,
  'svc.police': 1.0,
  'svc.stadium': 0.90,
  'port.seaport': 0.90,
  'port.airport': 0.90,
};

/** The nearest point of a road's middle line, the way it runs there and how far the road reaches either side */
export type RoadNear = { x: number; z: number; tx: number; tz: number; reach: number };

/** How big the program's model of a plant on a 3 × 3 or a 2 × 2 is drawn (src/plantBlocks.ts): made for the old 4 × 4
 * (39 units), it is drawn as every building of n tiles is, 10 units a tile less half a unit clear of its edge all round */
export const plantScale = (n: number): number => (n * 10 - 1) / 39;
/** ... and on a city map it fills its 16 m tiles as it fills the 10-unit ones, not at the share the old block drew it at
 * (CITY_MODEL_SCALE) */
export const PLANT_SHARE = 16 / 10;
/** The share of its model's size a placement is drawn at on a city map: its own, or its id's (CITY_MODEL_SCALE) */
export const shareOf = (p: Placement): number => p.share ?? (p.id ? CITY_MODEL_SCALE[p.id] ?? 1 : 1);
/** Where a building of size tiles whose tiles' middle is (x, z) stands against that road, drawn at fill (default BUILDING_SCALE):
 * its middle and its turn, its front to the road */
export function poseAgainstRoad(x: number, z: number, size: number, near: RoadNear, fill = BUILDING_SCALE): { x: number; z: number; rotation: number } {
  const half = size * 5 * fill;
  let nx = -near.tz, nz = near.tx;
  if (nx * (x - near.x) + nz * (z - near.z) < 0) { nx = -nx; nz = -nz; }
  const gap = near.reach + .6 + half;
  return { x: near.x + nx * gap, z: near.z + nz * gap, rotation: Math.atan2(-nx, -nz) };
}
/** A building's front stands this far (world units) from the edge of the road it faces */
export const ROAD_GAP = .4;
/** How far at most a building is slid along the way it faces to stand against its road (world units: 2.5 tiles) */
const SLIDE_MAX = 25;
/** How far past the edge of the ground it holds a building's drawn front may be slid to its road (metres): over the
 * road's own tile beside a square block, where the road is drawn narrower than its tile, and no further */
export const SLIDE_PAST_M = 1.5;

/**
 * How far to slide a building along the way it faces (its front (sin, cos) of its turn) so its front, `front` world units
 * ahead of its middle (x, z), stands ROAD_GAP from the edge of the road it faces, as Cities: Skylines stands a building
 * (owner, 21 Oct 2026: "object ก็ไม่ชิดกับถนน"): on a slanted road the square block of tiles the game gives a building
 * must keep off the road's staircase of tiles, so the place it was put down stands back from the road, the ruler's
 * house a quarter of a tile to a whole tile with a driveway reaching out to it; and an era model drawn deeper than its
 * place stood over the road. Only a road running across its front counts, looked for ahead of it, the nearest first;
 * 0 when there is none within SLIDE_MAX, so a building beside no road, or at a corner with its side to the road, stays
 * where it was put.
 */
export function slideToRoad(x: number, z: number, rotation: number, front: number,
                            snap: (x: number, z: number, reach: number) => RoadNear | null): number {
  const fx = Math.sin(rotation), fz = Math.cos(rotation);
  for (let ahead = 0; ahead <= SLIDE_MAX; ahead += 5) {
    const near = snap(x + fx * (front + ahead), z + fz * (front + ahead), 6);
    // ... a road across its front, not one along its side
    if (!near || Math.abs(near.tx * fx + near.tz * fz) > 0.35) continue;
    const middle = (near.x - x) * fx + (near.z - z) * fz;
    if (middle <= 0) continue;
    const slide = middle - near.reach - ROAD_GAP - front;
    if (Math.abs(slide) <= SLIDE_MAX) return slide;
  }
  return 0;
}
/** How much of its lot the era model of the ruler's house fills at each level, 1–6 (owner, 21 Oct 2026: its level and
 * wings had gone from the 3D view since the era models came): it grows grander as it rises, leaving the ring round it
 * for its wings */
export const HOUSE_ERA_SCALES = [0.65, 0.674, 0.698, 0.722, 0.746, 0.77] as const;
/** The era house's own fence stands this share of the way from its lot's middle to the lot's edge (art/buildings) */
const HOUSE_FENCE_SHARE = 23.4 / 24;
/** Where each wing stands round the house, [x, z] in the era lot's metres from the house's middle, front +Z, given `ring`,
 * how far the middle of the free ring between the house's fence and the lot's edge lies from the middle: the house's
 * front stands against its road (slideToRoad), so none stands in front of it (owner, 21 Oct 2026): the granary, the
 * treasury and the offices down the sides, the council hall, the garden, the culture court and the tower in a row behind,
 * each keeping its place whatever else is built. Each is set by the middle of its model's footprint
 * (models/civic/ruler-house.ts), so it sits in the middle of the ring. */
const WING_PLACES: Readonly<Record<RulerHouseWing, (ring: number) => readonly [number, number]>> = {
  granary: ring => [-ring + 0.3, 6], planning_office: ring => [-ring, -8],
  treasury: ring => [ring, 6], trade_office: ring => [ring, -8],
  council_hall: ring => [-18, -ring - 0.1], front_garden: ring => [-6, -ring + 0.45],
  culture_court: ring => [6, -ring + 0.52], warning_tower: ring => [18, -ring - 0.19],
};
/** Far-view heights of the wings (their models are 3–14 m) */
const WING_HEIGHTS: Readonly<Record<RulerHouseWing, number>> = { council_hall: 4, treasury: 4, planning_office: 4,
  warning_tower: 14, granary: 5, culture_court: 4, front_garden: 4, trade_office: 6 };
/** The industrial model each kind of mine (src/mining.ts MINE_KINDS) borrows until prompt M1 gives mines their own: an oil
 * well, a potash or a rare-earth works the plant of tanks, towers and pipe racks, a gem field a small regional workshop, a
 * dug pit the processing hall with its tanks and chimney */
export const MINE_STAND_INS: Readonly<Record<MineKind, string>> = {
  limestone: 'ind.block_0_3', tin: 'ind.block_0_3', zinc: 'ind.block_0_3', gold: 'ind.block_0_3', lignite: 'ind.block_0_3',
  potash: 'ind.block_1_3', rareEarth: 'ind.block_1_3', petroleum: 'ind.block_1_3', gems: 'ind.block_0_2',
};
/** Far-view heights of the schools and hospitals on the civic 3 × 3 (their models are 6–34 m at the highest point) */
const SCHOOL_HEIGHTS: Readonly<Record<string, number>> = { kindergarten: 4, primary_school: 7, secondary_school: 10,
  vocational_college: 8, university: 10, ...HOSPITAL_HEIGHTS };
export class TileSnapshot implements CityMapReader {
  roadLevel: 1 | 2 | 3 | ((x:number,y:number)=>1|2|3) = 2;
  /** World units a metre on a real-scale city map (src/roadGeometry.ts realUnits), null on any other map */
  realUnits: number | null = null;
  /** Whether newly grown or upgraded plots play through the 3D construction sequence (stage_1 -> stage_2 -> closed) */
  enableConstruction = false;
  private initialSync = true;
  /** The map's count of tile changes when it was last gone over (src/gameMap.js changeCount), -1 before */
  private seenChanges = -1;
  private nowSec = 0;
  readonly construction = new Map<number, { startSec: number; stage: 'stage_1' | 'stage_2' }>();
  /** The live map, read for whether homes, shops and factories are painted tile by tile (src/plots.ts) and its roads' levels */
  source: Pick<CityMapReader, 'paintedZones' | 'roadLevels' | 'roadPieces' | 'roadPaths' | 'roadGraph' | 'railGraph' | 'buildings' | 'tileSizeM' | 'civicKinds' | 'rulerHouse' | 'landCover' | 'wasteKinds' | 'powerKinds' | 'mineKinds' | 'stationKinds' | 'sites'> | null = null;
  get paintedZones(): boolean { return this.source?.paintedZones === true; }
  get roadLevels(): Uint8Array | null { return this.source?.roadLevels ?? null; }
  get roadPieces(): Uint16Array | null { return this.source?.roadPieces ?? null; }
  get roadPaths(): CityMapReader['roadPaths'] { return this.source?.roadPaths ?? null; }
  /** The roads in metres and metres a tile, so a plot finds its road as the simulation does (src/plots.ts nearestRoad) */
  get roadGraph(): CityMapReader['roadGraph'] { return this.source?.roadGraph ?? null; }
  get tileSizeM(): number | null { return this.source?.tileSizeM ?? null; }
  readonly values: Uint16Array; readonly flags: Uint16Array; readonly coverage: Int32Array;
  private readonly levelsCopy: Uint8Array;
  constructor(readonly width: number, readonly height: number) {
    this.values = new Uint16Array(width*height); this.flags = new Uint16Array(width*height);
    this.levelsCopy = new Uint8Array(width*height);
    this.coverage = new Int32Array(width*height); this.coverage.fill(-1);
  }
  getTileValue(x:number,y:number):number { return this.values[y*this.width+x]; }
  getTileFlags(x:number,y:number):number { return this.flags[y*this.width+x]; }
  sync(map: CityMapReader): number[] {
    const changed: number[] = []; let zonesChanged = false;
    const rl = map.roadLevels;
    // Called every frame: while no tile has changed since the last look (the map counts them), only a road's level can
    // have, which the road tools keep beside the tiles, so the whole map is not gone over (about 26 ms a frame on a
    // 480 x 480 city map before)
    const count = map.changeCount ? map.changeCount() : -1;
    // ... and a building moved on its tiles (the move tool) changes no tile: its centre is looked at again
    changed.push(...this.posesMoved(map));
    // ... and a big building's site that came or was finished changes no tile either (src/construction.ts)
    changed.push(...this.sitesMoved(map));
    // ... and a plot of the list that grew, joined or went, which the tile it is counted at may not show (plotsMoved)
    changed.push(...this.plotsMoved());
    if (count >= 0 && count === this.seenChanges && !this.initialSync) {
      if (rl) for (let i = 0; i < rl.length; i++) if (rl[i] !== this.levelsCopy[i]) { this.levelsCopy[i] = rl[i]; changed.push(i); }
      changed.push(...this.paintMoved(map));
      return changed;
    }
    this.seenChanges = count;
    const trackBuild = this.enableConstruction && !this.initialSync && this.paintedZones;
    const raw = map.rawTileAt ? map.rawTileAt.bind(map) : null;
    for(let i=0;i<this.values.length;i++) {
      let v: number, f: number;
      if (raw) { const tile = raw(i); v = tile & BIT_MASK; f = tile & (ZONEBIT|POWERBIT); }
      else { const x=i%this.width,y=Math.floor(i/this.width); v=map.getTileValue(x,y); f=map.getTileFlags(x,y) & (ZONEBIT|POWERBIT); }
      const lv = rl ? rl[i] : 0;
      if(v!==this.values[i]||f!==this.flags[i]||lv!==this.levelsCopy[i]) {
        if (trackBuild && v !== this.values[i]) {
          const oldPlot = readPlotValue(this.values[i]);
          const newPlot = readPlotValue(v);
          if (newPlot && newPlot.level > 0 && (!oldPlot || newPlot.level > oldPlot.level || newPlot.value > oldPlot.value)) {
            this.construction.set(i, { startSec: this.nowSec, stage: 'stage_1' });
          } else if (!newPlot || newPlot.level <= 0) {
            this.construction.delete(i);
          }
        }
        changed.push(i);
        if (v !== this.values[i]) this.planStale = true;
        if ((f|this.flags[i]) & ZONEBIT) zonesChanged=true;
        this.values[i]=v; this.flags[i]=f; this.levelsCopy[i]=lv;
      }
    }
    const first = this.initialSync;
    this.initialSync = false;
    if(zonesChanged) this.coverZones();
    if (first) this.paintSeen = (map as { zoneCellsVersion?: number }).zoneCellsVersion ?? 0;
    else changed.push(...this.paintMoved(map));
    return changed;
  }
  /** The list's count of changes when last looked at, and what each tile the plots are counted at drew then */
  private plotsSeen = -1;
  private plotSigns = new Map<number, string>();
  /** The tiles whose plots of the list changed since the last look (src/plotBuildings.ts): each is drawn from the tile
   * it is counted at, which a change to it need not touch */
  private plotsMoved(): number[] {
    const list = this.plotList();
    if (!list || list.version === this.plotsSeen) return [];
    this.plotsSeen = list.version;
    const signs = new Map<number, string>();
    for (const [anchor, ids] of list.byAnchor) {
      signs.set(anchor, ids.map(id => { const p = list.get(id); return p ? `${id}:${p.level}:${builtLevel(p)}:${this.stageOf(list,p)}:${decayOf(p,list.now)}:${p.value}:${p.style}:${p.columns.join(',')}` : ''; }).join(';'));
    }
    const moved: number[] = [];
    for (const [anchor, sign] of signs) if (this.plotSigns.get(anchor) !== sign) moved.push(anchor);
    for (const anchor of this.plotSigns.keys()) if (!signs.has(anchor)) moved.push(anchor);
    this.plotSigns = signs;
    return moved;
  }
  /** The painted cells' count of changes when last looked at (src/zoneCells.ts zoneCellsVersion), and the plots'
   * frontage worked out from them (frontage.ts), again when a tile or the paint changes */
  private paintSeen = 0;
  private plan: FrontagePlan | null = null;
  private planStale = true;
  /** The plots whose frontage buildings the paint changed since the last look: painting cells beside a grown plot
   * changes no tile, but adds a bay to its terrace or makes its run a house's */
  private paintMoved(map: CityMapReader): number[] {
    const paint = (map as { zoneCellsVersion?: number }).zoneCellsVersion ?? 0;
    if (paint === this.paintSeen) return [];
    this.paintSeen = paint;
    // (the plan last worked out, even when tiles have changed since: a plot growing makes it stale, and a brush stroke
    // changes plots, so taking none then called every painted plot of the city moved, some 400 tiles a step of a drag,
    // and every chunk with a plot in it was built again; owner, 23 Oct 2026)
    const before = this.plan;
    this.planStale = true;
    if (!this.frontageOn()) return [];
    const now = this.frontagePlan();
    if (!now) return [];
    const moved: number[] = [];
    const columnsOf = (plan: FrontagePlan | null, tile: number): string =>
      (plan?.byOwner.get(tile) ?? []).map(k => { const c = plan!.columns[k]; return `${c.x.toFixed(2)},${c.z.toFixed(2)}`; }).join(';');
    for (const tile of new Set([...(before?.byOwner.keys() ?? []), ...now.byOwner.keys()]))
      if (!before || columnsOf(before, tile) !== columnsOf(now, tile)) moved.push(tile);
    return moved;
  }
  /** Whether plots are drawn by their frontage: on a map painted in cells, once the era models with frontage kinds
   * are in */
  private frontageOn(): boolean {
    return Boolean(this.eraModels?.hasFrontage && (this.source as CellMap | null)?.cellZones && this.paintedZones);
  }
  /** The columns of painted cells and the plots that draw them (frontage.ts), worked out once per change */
  frontagePlan(): FrontagePlan | null {
    if (!this.planStale) return this.plan;
    this.planStale = false;
    const source = this.source as CellMap | null;
    this.plan = source ? mapFrontagePlan(source, tile => {
      const v = this.values[tile];
      return this.flags[tile] & ZONEBIT ? null : plotKindOfValue(v);
    }) : null;
    return this.plan;
  }
  /** What the plot on a tile is to its frontage, null when there is none */
  private frontagePlotAt(tile: number): FrontagePlot | null {
    const x = tile % this.width, y = Math.floor(tile / this.width), plot = plotOf(this, x, y);
    return plot ? { kind: plot.kind, level: plot.level, lot: lotOf(this, x, y) !== null, era: this.eraOf(tile) } : null;
  }
  /**
   * A painted plot drawn by its frontage (frontage.ts, docs/METRE_DRAWING_PLAN.md 3.3): its shophouse bays, one on each
   * painted cell along its road and joined into a terrace with the next plot's, or its 12 m house, each at its real
   * size against the road; null when nothing fits or a model is missing, so the plot keeps its full-tile model.
   */
  private frontage(p: Placement | null): Placement | null {
    if (!p || p.footprint[0] !== 1 || p.index < 0 || (p.kind !== 'residential' && p.kind !== 'commercial') ||
      !p.id?.startsWith('era.') || !this.frontageOn()) return null;
    const plan = this.frontagePlan(), plot = plan ? this.frontagePlotAt(p.index) : null;
    if (!plan || !plot) return null;
    const metre = unitsPerMetre(tileMetres(this.source!));
    const pieces = frontagePieces(plan, p.index, plot, metre, tile => this.frontagePlotAt(tile));
    if (!pieces?.length) return null;
    const region = p.options.region ?? 'central', era = plot.era;
    const placed: Placement[] = [];
    for (const piece of pieces) {
      const height = this.eraModels!.height(era, region, piece.kind);
      if (height === null) return null;
      placed.push(new RoadsidePlacement({ ...p, id: eraModelId(era, piece.kind), x: piece.x, z: piece.z, rotation: piece.rotation,
        height, scale: metre, fill: metre, eraKind: piece.kind,
        options: { ...p.options, seed: 0, variant: 0, state: 'closed', worldOrigin: [piece.x, piece.z], worldRotationY: piece.rotation } }));
    }
    const first = pieces[0], last = pieces[pieces.length - 1];
    const ground = { x: (first.x + last.x) / 2, z: (first.z + last.z) / 2, rotation: first.rotation,
      width: Math.hypot(last.x - first.x, last.z - first.z) + first.width, depth: first.depth };
    const [main, ...parts] = placed;
    return new FrontagePlacement({ ...main }, ground, parts);
  }
  /** The map's count of changes to its buildings when last looked at, and where each one stood then, by centre tile */
  private posesSeen = -1;
  private poseCopy = new Map<number, string>();
  /** The centre tiles of the buildings put down in metres that moved, came or went since the last look */
  private posesMoved(map: CityMapReader): number[] {
    const placed = map.buildings;
    if (!placed?.all || placed.version === undefined || placed.version === this.posesSeen) return [];
    this.posesSeen = placed.version;
    const now = new Map<number, string>(), moved: number[] = [];
    for (const b of placed.all()) {
      const key = `${b.x},${b.z},${b.rot}`;
      now.set(b.tile, key);
      if (!this.initialSync && this.poseCopy.get(b.tile) !== key) moved.push(b.tile);
    }
    if (!this.initialSync) for (const tile of this.poseCopy.keys()) if (!now.has(tile)) moved.push(tile);
    this.poseCopy = now;
    return moved;
  }
  /** The centre tiles of the construction sites when last looked at, sorted and joined */
  private sitesSeen = '';
  /** The centre tiles whose construction site came or went since the last look (src/construction.ts map.sites): a site
   * finished changes no tile, but its building is drawn in its place */
  private sitesMoved(map: CityMapReader): number[] {
    const keys = map.sites ? Object.keys(map.sites).sort() : [];
    const sign = keys.join(',');
    if (sign === this.sitesSeen) return [];
    const before = new Set(this.sitesSeen ? this.sitesSeen.split(',') : []), now = new Set(keys);
    this.sitesSeen = sign;
    if (this.initialSync) return [];
    return [...[...before].filter(k => !now.has(k)), ...keys.filter(k => !before.has(k))].map(Number);
  }
  /** Advances active 3D plot construction sequences (stage_1 foundation -> stage_2 scaffolding/crane -> finished building). */
  stepConstruction(seconds: number): number[] {
    this.nowSec = seconds;
    if (this.construction.size === 0) return [];
    const transitioned: number[] = [];
    for (const [i, entry] of this.construction.entries()) {
      const elapsed = seconds - entry.startSec;
      if (elapsed >= 4.8) {
        this.construction.delete(i);
        transitioned.push(i);
      } else if (elapsed >= 2.0 && entry.stage === 'stage_1') {
        entry.stage = 'stage_2';
        transitioned.push(i);
      }
    }
    return transitioned;
  }
  coverZones(): void {
    this.coverage.fill(-1);
    for(let i=0;i<this.flags.length;i++) if(this.flags[i]&ZONEBIT) {
      // A building turned to a slanted road covers its turned outline's tiles, not its square (src/buildings/turnedFootprint.ts)
      const turned=this.source?turnedTilesOf(this.source as unknown as FootprintMap,i,this.values[i]):null;
      if(turned){for(const j of turned)if(this.coverage[j]===-1)this.coverage[j]=i;continue;}
      const entry=TILE_TABLE[this.values[i]] ?? debug(),[w,h]=entry.footprint;
      const x=i%this.width-(w>1?1:0), y=Math.floor(i/this.width)-(h>1?1:0);
      for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) if(x+dx>=0&&y+dy>=0&&x+dx<this.width&&y+dy<this.height) {
        const j=(y+dy)*this.width+x+dx; if(this.coverage[j]===-1) this.coverage[j]=i;
      }
    }
  }
  mask(x:number,y:number, predicate:(v:number)=>boolean):number {
    let mask=0; for(const[dx,dy,bit]of SIDES) if(x+dx>=0&&y+dy>=0&&x+dx<this.width&&y+dy<this.height&&predicate(this.getTileValue(x+dx,y+dy))) mask|=bit;
    return mask;
  }
  /** A plain road corner's staircase, so its road bends there: packed as `staircase` in models/road/centreline.ts. */
  staircase(x:number,y:number):number {
    if(!isPlainRoad(this.getTileValue(x,y)))return 0;
    const step=(px:number,py:number,side:number):[number,number]=>{const[dx,dy]=SIDES.find(s=>s[2]===side)!;return[px+dx,py+dy];};
    return staircaseOf(this.mask(x,y,isRoad),(side,far)=>{let[nx,ny]=step(x,y,side);if(far)[nx,ny]=step(nx,ny,far);
      return nx>=0&&ny>=0&&nx<this.width&&ny<this.height&&isPlainRoad(this.getTileValue(nx,ny))?this.mask(nx,ny,isRoad):null;});
  }
  /** A rail corner's staircase, as staircase() for roads. */
  railStaircase(x:number,y:number):number {
    const step=(px:number,py:number,side:number):[number,number]=>{const[dx,dy]=SIDES.find(s=>s[2]===side)!;return[px+dx,py+dy];};
    return staircaseOf(this.mask(x,y,isRail),(side,far)=>{let[nx,ny]=step(x,y,side);if(far)[nx,ny]=step(nx,ny,far);
      return nx>=0&&ny>=0&&nx<this.width&&ny<this.height&&isRail(this.getTileValue(nx,ny))?this.mask(nx,ny,isRail):null;});
  }
  private portRotation(x:number,y:number,size:number):number {
    const left=x-1,top=y-1,scores=[0,0,0,0];
    for(let n=0;n<size;n++) {
      const points=[[left+n,top-1],[left+size,top+n],[left+n,top+size],[left-1,top+n]];
      points.forEach(([px,py],side)=>{if(px>=0&&py>=0&&px<this.width&&py<this.height&&isWaterNeighbor(this.getTileValue(px,py)))scores[side]++;});
    }
    // The +Z quay defaults south; equal water coverage keeps that deterministic orientation.
    let side=2;for(const candidate of [0,1,3])if(scores[candidate]>scores[side])side=candidate;
    return [Math.PI,Math.PI/2,0,-Math.PI/2][side];
  }
  /** The ruler's house on its civic 3 × 3 (RENDERER_SPEC 6H): its level and wings, once its model is registered. */
  private housePlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null {
    const house=this.source?.rulerHouse;
    if(this.values[i]!==CIVIC||this.source?.civicKinds?.[i]!=='ruler_house'||!house||house.x!==x||house.y!==y||!registry['civic.ruler_house'])return null;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id:'civic.ruler_house',kind:'services',footprint:[3,3],height:14+house.level*3,color:0xa2b8b4,
      water:false,rotation:0,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,
        variant:house.level,state:[...(house.wings??[])].sort().join(','),waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:0}});
  }
  /** The side of a building centred at x, y (size 1, 3, 4 or 6 tiles) with the most road beside it: 0 north, 1 east,
   * 2 south, 3 west; south when it has none or a tie with the south. */
  roadSide(x:number,y:number,size:number):number {
    const left=x-(size>1?1:0),top=y-(size>1?1:0),scores=[0,0,0,0];
    for(let n=0;n<size;n++){
      const points=[[left+n,top-1],[left+size,top+n],[left+n,top+size],[left-1,top+n]];
      points.forEach(([px,py],side)=>{if(px>=0&&py>=0&&px<this.width&&py<this.height&&isRoad(this.getTileValue(px,py)))scores[side]++;});
    }
    let side=2;for(const candidate of [1,3,0])if(scores[candidate]>scores[side])side=candidate;
    return side;
  }
  /**
   * A big building still being built (src/construction.ts): its construction site in its place, the size of its tiles
   * (3 x 3, 4 x 4 or the airport's 6 x 6), with a tower crane on one of four tiles or more or of half a year's work or
   * more, turned toward its road; null when the building on these tiles is done.
   */
  private sitePlacement(i:number,x:number,y:number,size:number,region:RegionId):Placement|null {
    const site=this.source?.sites?.[i];
    if(!site||size<3)return null;
    const s=size>=6?6:size>=4?4:size>=3?3:2,id=siteId(s);
    if(!registry[id])return null;
    const crane=s>=4||(UNLOCKS[site.tool]?.months??0)>=6?1:0;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel,rotation=FACING_ROTATION[this.roadSide(x,y,s)];
    const cx=(x-1+s/2)*10,cz=(y-1+s/2)*10;
    return new Placement({index:i,x:cx,z:cz,id,kind:'services',footprint:[s,s],height:crane?16:6,color:RAMPS.sand[400],
      water:false,rotation,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:0,
        variant:crane,state:'closed',waterMask:0,landMask:15,worldOrigin:[cx,cz],worldRotationY:rotation}});
  }
  /** A regional power plant on tiles 745–760 (centre 750, src/powerPlants.ts): `power.solar`, `power.wind`, `power.gas`,
   * `power.hydro`, or `power.coal` (`lignite`), picked from `gameMap.powerKinds` and turned toward its road. */
  private powerPlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null {
    // The old 4 × 4, or a plant on only the tiles its model covers (src/plantBlocks.ts): a 3 × 3 drawn with its era's
    // model where its era has one, a 2 × 2 always drawn by the program; each a nuclear one when its kind says so
    const v=this.values[i],n=v===POWERPLANT?4:v===PLANT3?3:v===PLANT2?2:0;
    if(!n)return null;
    const pk=this.source?.powerKinds?.[i]??'lignite';
    const id=pk==='lignite'?'power.coal':`power.${pk}`;
    if(!registry[id])return null;
    const heights:Record<string,number>={lignite:44,solar:8,wind:36,gas:28,hydro:16};
    const colors:Record<string,number>={lignite:0xa2b8b4,solar:0x365b8c,wind:0xdbe3e6,gas:0xb5bfc4,hydro:0x7ea1b5};
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel,rotation=FACING_ROTATION[this.roadSide(x,y,n)];
    const cx=(x-1+n/2)*10,cz=(y-1+n/2)*10;
    // The program's models are made for the old 4 × 4: on a smaller block it is drawn to fill it (plantScale), and on a
    // city map its 16 m tiles (PLANT_SHARE)
    const p=new Placement({index:i,x:cx,z:cz,id,kind:'services',footprint:[n,n],height:(heights[pk]??(pk==='nuclear'?55:30))*n/4,
      color:colors[pk]??0xa2b8b4,water:false,rotation,scale:n<4?plantScale(n):1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,
        seed:hash%SEED_BUCKETS,variant:0,state:'closed',waterMask:0,landMask:15,worldOrigin:[cx,cz],worldRotationY:rotation}});
    if(n<4){p.share=PLANT_SHARE;if(n===2)p.procedural=true;}
    return p;
  }
  /** A temple on the civic 3 × 3 (src/temples.ts): `civic.temple` at its level, drawn with its era's `temple_<level>` model once
   * the era models have loaded (toEra), its gate toward its road; its wall is its model's, so it has no fence of compounds.ts */
  private templePlacement(i:number,x:number,y:number,region:RegionId):Placement|null {
    if(this.values[i]!==CIVIC||this.source?.civicKinds?.[i]!=='temple'||!registry[TEMPLE_ID])return null;
    const temples=(this.source as {temples?:{temples:ReadonlyArray<{tile:number;level:number}>}|null}).temples;
    const level=Math.max(1,Math.min(3,temples?.temples.find(t=>t.tile===i)?.level??1));
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel,rotation=FACING_ROTATION[this.roadSide(x,y,3)];
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id:TEMPLE_ID,eraKind:`temple_${level}`,kind:'services',footprint:[3,3],
      height:8+level*4,color:RAMPS.sand[100],water:false,rotation,scale:1,powered:false,options:{region,roadLevel,seed:0,variant:level,
        state:'closed',waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
  /** A school or hospital on the civic 3 × 3 (RENDERER_SPEC 6H): `civic.<kind>` from civicKinds once that model is registered, its
   * gate toward its road. The ruler's house keeps its own placement; a kind without a model stays generic. */
  private civicPlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null {
    const kind=this.source?.civicKinds?.[i];
    if(this.values[i]!==CIVIC||!kind||kind==='ruler_house'||!registry[`civic.${kind}`])return null;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel,rotation=FACING_ROTATION[this.roadSide(x,y,3)];
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id:`civic.${kind}`,kind:'services',footprint:[3,3],height:SCHOOL_HEIGHTS[kind]??12,color:0xb8ad94,
      water:false,rotation,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,
        variant:0,state:'closed',waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
  /** A rubbish or wastewater plant on tiles 992–1000 (RENDERER_SPEC 6I): `waste.<kind>` from wasteKinds (no record is a landfill) once
   * that model is registered, its gate toward its road. */
  private wastePlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null {
    if(this.values[i]!==WASTE)return null;
    const kind=this.source?.wasteKinds?.[i]??'landfill';
    if(!registry[`waste.${kind}`])return null;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel,rotation=FACING_ROTATION[this.roadSide(x,y,3)];
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id:`waste.${kind}`,kind:'services',footprint:[3,3],height:WASTE_HEIGHTS[kind as keyof typeof WASTE_HEIGHTS]??12,color:0xa8a291,
      water:false,rotation,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,
        variant:0,state:'closed',waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
  /** Extended 3 × 3 buildings (mines, farms, harbours, stations) mapped to registered 3D models so none stay coarse cubes. */
  private extendedPlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null {
    const v=this.values[i];
    if(v!==MINE&&v!==FARM&&v!==HARBOUR&&v!==STATION)return null;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    const rotation=v===HARBOUR?this.portRotation(x,y,3):FACING_ROTATION[this.roadSide(x,y,3)];
    let id='ind.block_0_0',kind='industrial',height=9,color=0xc7a473,eraKind:string|undefined;
    if(v===MINE){
      id=MINE_STAND_INS[mineKindAt(this.source?.mineKinds,i)];height=12;
    }else if(v===FARM){
      // ... the fields' cooperative, rice mill or cold store, by the fields round it (src/farmZone.ts hubKind)
      const hub=this.source?hubKind(this.source as unknown as FieldMap,x,y):'cooperative';
      id=HUB_MODELS[hub];height=7;color=0x9ba873;
    }else if(v===HARBOUR){
      id='ind.block_0_1';kind='transport';height=9;color=0x9aa8aa;
    }else if(v===STATION){
      const sk=this.source?.stationKinds?.[i]??'train_station';eraKind=`station.${sk}`;
      id=sk==='hsr_station'?'com.block_3_3':sk==='metro_station'?'com.block_2_2':'civic.vocational_college';
      kind='transport';height=10;color=0x9aa8aa;
    }
    if(!registry[id])return null;
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id,kind,eraKind,footprint:[3,3],height,color,
      water:false,rotation,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,
        variant:0,state:'closed',waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
  /** A lot's one building over its four plots (src/plots.ts lotOf), from its top-left tile; null on its other tiles. */
  private lotPlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null|undefined {
    const lot=lotOf(this,x,y);if(!lot)return undefined;if(lot.x!==x||lot.y!==y)return null;
    const prefix=PLOT_MODEL_PREFIX[lot.kind],named=`lot.${prefix}_${lot.level}`,single=`plot.${prefix}_${lot.level}`;
    // Until a lot has a model of its own, the plot's building, bigger
    const id=registry[named]?named:registry[single]?single:null,scale=registry[named]?1:1.6;
    const rotation=FACING_ROTATION[lotFacing(this,lot)],cx=(x+LOT_SIZE/2)*10,cz=(y+LOT_SIZE/2)*10;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    const state=this.construction.get(i)?.stage??'closed';
    return new Placement({index:i,x:cx,z:cz,id,kind:lot.kind,eraKind:plotEraKind(lot.kind,lot.level,true),footprint:[LOT_SIZE,LOT_SIZE],height:(PLOT_HEIGHTS[lot.kind][lot.level]??20)*scale,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[lot.kind],water:false,rotation,scale,
      powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant:lot.value,state,
        waterMask:0,landMask:15,worldOrigin:[cx,cz],worldRotationY:rotation}});
  }
  /** The plots of the list where the city keeps them as one (src/plotBuildings.ts), or null */
  private plotList():PlotBuildings|null {
    const s=this.source as unknown as PlotListMap|null;
    return s&&usesPlotList(s)&&this.paintedZones?s.plotBuildings??null:null;
  }
  /**
   * The buildings of the plots counted at tile i (src/plotBuildings.ts, docs/NO_GRID_PLAN.md 3B): each plot's shophouse
   * bays or 12 m house along its own columns (frontage.ts), or its one model standing on them, its front against the
   * road, no wider than they are; null where none counted here has a building
   */
  /** The stage a plot of the list's building is drawn at (src/plotBuildings.ts constructionStage): going up over its months
   * (owner, 24 Oct 2026: "ต้องมีการเริ่มก่อสร้างด้วย ไม่ใช่หายแว๊บขึ้นมาเลย"), else finished */
  private stageOf(list:PlotBuildings,plot:PlotBuilding):'stage_1'|'stage_2'|'closed' {
    return this.enableConstruction?constructionStage(constructionShare(plot,list.now)):'closed';
  }
  private listPlacement(i:number,region:RegionId,list:PlotBuildings):Placement|null {
    // (a building its people left still stands, as built: builtLevel)
    const plots=list.atAnchor(i).filter(p=>builtLevel(p)>0);
    if(!plots.length||!this.source)return null;
    const metre=unitsPerMetre(tileMetres(this.source)),cu=CELL_M*metre,placed:Placement[]=[];
    let ground:FrontageGround|null=null;
    const frontPlot=(p:PlotBuilding):FrontagePlot=>({kind:p.kind,level:builtLevel(p),lot:p.columns.length>=LOT_COLUMNS,era:this.eraOf(list.places.get(p.id)?.anchor??i)});
    for(const plot of plots){
      const place=list.places.get(plot.id);
      const own=place?this.plotGround(list,plot):null;
      if(!place||!own)continue;
      // (the ground and far box of them all: from the first plot's left end to the last's right end along its road)
      if(!ground)ground={...own};
      else{
        const g:FrontageGround=ground,rx:number=Math.cos(g.rotation),rz:number=-Math.sin(g.rotation),half=g.width/2;
        const a=(g.x-own.x)*rx+(g.z-own.z)*rz;
        const lo=Math.min(-half,-a-own.width/2),hi=Math.max(half,-a+own.width/2),mid=(lo+hi)/2;
        ground={x:g.x+rx*mid,z:g.z+rz*mid,rotation:g.rotation,width:hi-lo,depth:g.depth};
      }
      const fp=frontPlot(plot);
      const building=this.stageOf(list,plot)!=='closed';
      const pieces=this.eraModels?.hasFrontage&&!building?listFrontagePieces(list.columns,cu,place.cols,fp,metre,k=>{
        const other=list.ofColumn(k);return other?frontPlot(other):null;}):null;
      if(pieces?.length){
        let ok=true;const mine:Placement[]=[];
        for(const piece of pieces){
          const height=this.eraModels!.height(fp.era,region,piece.kind);
          if(height===null){ok=false;break;}
          const base=this.listModel(i,plot,region,own);
          if(!base){ok=false;break;}
          mine.push(new RoadsidePlacement({...base,powered:base.powered&&!isVacant(plot),weather:base.weather,id:eraModelId(fp.era,piece.kind),x:piece.x,z:piece.z,rotation:piece.rotation,
            height,scale:metre,fill:metre,eraKind:piece.kind,
            options:{...base.options,seed:0,variant:0,state:'closed',worldOrigin:[piece.x,piece.z],worldRotationY:piece.rotation}}));
        }
        if(ok){placed.push(...mine);continue;}
      }
      const one=this.listModel(i,plot,region,own);
      if(one)placed.push(one);
    }
    // A run-down empty building's rubbish by its door (src/plotBuildings.ts decayOf): a small heap of rubble on its ground,
    // gone when it is bulldozed (owner, 24 Oct 2026: "อาคารที่คนย้ายออก ให้ผุพัง มีกองขยะ")
    for(const plot of plots){
      if(decayOf(plot,list.now)<3||!placed.length)continue;
      const own=this.plotGround(list,plot);if(!own)continue;
      const metre=unitsPerMetre(tileMetres(this.source)),fx=-Math.sin(own.rotation),fz=-Math.cos(own.rotation),ax=Math.cos(own.rotation),az=-Math.sin(own.rotation);
      const x=own.x-fx*(own.depth/2-2*metre)+ax*own.width*.3,z=own.z-fz*(own.depth/2-2*metre)+az*own.width*.3;
      placed.push(new Placement({index:i,x,z,id:'terrain.rubble',kind:'terrain',footprint:[1,1],height:.6,color:0x8a7f6a,water:false,
        rotation:own.rotation,scale:.28*Math.max(.6,metre*1.6),powered:false,options:{region,seed:plot.id%SEED_BUCKETS,variant:plot.id%4,state:'closed',
          waterMask:0,landMask:15,worldOrigin:[x,z],worldRotationY:own.rotation}}));
    }
    if(!placed.length||!ground)return null;
    const [main,...parts]=placed;
    return new FrontagePlacement({...main},ground,parts);
  }
  /** The ground a plot of the list stands on, from its columns (world units, turned to face its road): as wide as they
   * run along the road, a plot deep from the road's edge; null when it stands nowhere */
  private plotGround(list:PlotBuildings,plot:PlotBuilding):FrontageGround|null {
    const place=list.places.get(plot.id);
    if(!place||!place.cols.length||!this.source)return null;
    const metre=unitsPerMetre(tileMetres(this.source)),cu=CELL_M*metre;
    const cols=place.cols.map(k=>list.columns[k]),first=cols[0],last=cols[cols.length-1];
    let nx=0,nz=0;for(const c of cols){nx+=c.nx;nz+=c.nz;}
    const len=Math.hypot(nx,nz)||1;nx/=len;nz/=len;
    const rotation=Math.atan2(-nx,-nz),width=Math.hypot(last.x-first.x,last.z-first.z)+cu;
    // its front edge's middle: the front row's middles less half a cell, toward the road
    const fx=(first.x+last.x)/2-nx*cu/2,fz=(first.z+last.z)/2-nz*cu/2,depth=FRONTAGE_DEPTH_M*metre;
    return {x:fx+nx*depth/2,z:fz+nz*depth/2,rotation,width,depth};
  }
  /** The ground of the plot of the list a tile shows (src/plotBuildings.ts), for the inspector's mark (index.ts
   * objectGround): the plot's own, whichever tile of it was clicked; null where the plots are no list or none is there */
  listPlotGround(index:number):FrontageGround|null {
    const list=this.plotList(),plot=list?.shownAt(index)??null;
    return list&&plot?this.plotGround(list,plot):null;
  }
  /** A plot of the list's one model, standing on its columns (own: the ground they make, world units), its front against
   * the road, drawn no wider than they are */
  private listModel(i:number,plot:PlotBuilding,region:RegionId,own:FrontageGround):Placement|null {
    // its building as built (people who left leave it standing, dark: isVacant), or its construction site in the era's
    // way of building while it goes up (models/plot/construction.ts)
    const level=builtLevel(plot),top=level>=PLOT_TOP[plot.kind],size=top?LOT_SIZE:1,list=this.plotList();
    const stage=list?this.stageOf(list,plot):'closed',state=stage==='closed'?'closed':`${stage}:e${this.eraOf(list?.places.get(plot.id)?.anchor??i)}`;
    const named=`plot.${PLOT_MODEL_PREFIX[plot.kind]}_${level}`;
    const id=plot.kind==='residential'&&level===1&&stage==='closed'?TILE_TABLE[plotTile(plot.kind,1,plot.value,plot.style)]?.id??null:registry[named]?named:null;
    const x=i%this.width,y=Math.floor(i/this.width);
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    let p:Placement|null=new Placement({index:i,x:own.x,z:own.z,id,kind:plot.kind,eraKind:plotEraKind(plot.kind,level,top),
      footprint:[size,size],height:PLOT_HEIGHTS[plot.kind][level]??6,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[plot.kind],water:false,rotation:own.rotation,scale:1,
      powered:Boolean(this.flags[i]&POWERBIT)&&!isVacant(plot),options:{region,roadLevel,seed:(plot.id*2654435761>>>0)%SEED_BUCKETS,variant:plot.value,
        state,waterMask:0,landMask:15,worldOrigin:[own.x,own.z],worldRotationY:own.rotation}});
    p=this.atRealSize(this.toEra(p));
    if(!p)return null;
    // ... weathered as it stands empty: none at first, half once weathered, all once run-down (decayOf)
    const decay=list?decayOf(plot,list.now):0;if(decay>=2)p.weather=decay>=3?1:.5;
    const factor=this.realUnits?shareOf(p):1,scale=BUILDING_SCALE*factor;
    // as deep as its model: an era model is in metres, a tile 16 m deep, the others 10 model units a tile
    const deep=size*(p.id?.startsWith('era.')?16:10)*scale,wide=deep;
    const fit=Math.min(1,own.width/Math.max(1e-6,wide));
    // ... its front at the plot's front edge: from the plot's middle away from the road by its depth less the plot's
    const nx=-Math.sin(own.rotation),nz=-Math.cos(own.rotation),shift=deep*fit/2-own.depth/2;
    return p.againstRoad(own.x+nx*shift,own.z+nz*shift,own.rotation,scale*fit);
  }
  /** A painted plot's building, facing its road, or null for an empty plot, whose painted ground is enough. */
  private plotPlacement(i:number,x:number,y:number,plot:Plot,region:RegionId,hash:number):Placement|null {
    if(plot.level<=0)return null;
    const lot=this.lotPlacement(i,x,y,region,hash);if(lot!==undefined)return lot;
    const named=`plot.${PLOT_MODEL_PREFIX[plot.kind]}_${plot.level}`;
    const id=plot.kind==='residential'&&plot.level===1?TILE_TABLE[this.values[i]]?.id??null:registry[named]?named:null;
    const rotation=FACING_ROTATION[plotFacing(this,x,y)];
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    const state=this.construction.get(i)?.stage??'closed';
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id,kind:plot.kind,eraKind:plotEraKind(plot.kind,plot.level,false),footprint:[1,1],height:PLOT_HEIGHTS[plot.kind][plot.level]??6,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[plot.kind],water:false,rotation,scale:1,
      powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant:plot.value,state,
        waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
  /** The era models once their index has loaded (eraBuildings.ts); null keeps every building procedural */
  eraModels:EraModels|null=null;
  /** The era a building on tile i is drawn in: the map's own record for that tile when it keeps one (`buildingEras`,
   * 1-5), else the city's era (src/era.ts) */
  eraOf(i:number):number {
    const map=this.source as {era?:unknown;buildingEras?:ArrayLike<number>|null}|null;
    const own=map?.buildingEras?.[i]??0;
    return own>=1&&own<=5?own:mapEra(map);
  }
  /** A building drawn with its era's model when there is one for it (eraBuildings.ts): its id becomes `era.<n>.<kind>`,
   * its height the model's, and on a map that is not real-scale it is drawn at 10/16, as the model's tile is 16 m */
  private toEra(p:Placement|null):Placement|null {
    if(!p||!this.eraModels||p.index<0)return p;
    const state=p.options.state;
    if(state?.startsWith('stage_')||p.procedural)return p;
    const era=this.eraOf(p.index),kind=eraKindFor(p.id,p.eraKind,era);
    if(!kind)return p;
    const height=this.eraModels.height(era,p.options.region??'central',kind);
    if(height===null)return p;
    // (a 3 × 3 plant drawn by its era's model is drawn as the era models are, at their size: plantBlocks.ts)
    if(p.share!==undefined){p.scale=1;p.share=undefined;}
    p.id=eraModelId(era,kind);p.height=height;p.options={...p.options,seed:0,variant:0,state:'closed'};
    if(!this.realUnits){p.scale*=BUILDING_SCALE;p.fill=(p.fill??1)*BUILDING_SCALE;}
    return p;
  }
  /**
   * The ruler's house drawn with its era's model (RENDERER_SPEC 6H; owner, 21 Oct 2026): the model a little bigger at
   * each level (HOUSE_ERA_SCALES) and each wing it has built standing round it on the lot (WING_PLACES), as parts of its
   * placement, turned with it. The era models have the house alone, so without this its level and wings did not show.
   * Its middle, turn and lot stay the house's, so its ground, driveway and kept pose are as before; its front is its
   * fence's, which toRoadEdge stands against the road.
   */
  private houseCompound(p:Placement|null):Placement|null {
    const house=this.source?.rulerHouse;
    if(!p||!house||p.index!==house.y*this.width+house.x||!p.id?.startsWith('era.')||!p.id.endsWith('.ruler_house'))return p;
    const level=Math.min(6,Math.max(1,Math.round(house.level||1))),grow=HOUSE_ERA_SCALES[level-1];
    // The era model is in metres (3 tiles of 16 m) and drawn at `metre` world units a metre; the wings' models too
    const metre=p.scale,half=1.5*(this.eraModels?.index.tileMetres??16),ring=half*(1+grow*HOUSE_FENCE_SHARE)/2;
    p.scale=metre*grow;p.height*=grow;p.front=half*grow*HOUSE_FENCE_SHARE*metre;
    // ... its wings reaching to its lot's edge beside and behind it, the lot as far as they go
    if(house.wings?.length){p.side=half*metre;p.back=half*metre;}
    const cos=Math.cos(p.rotation),sin=Math.sin(p.rotation);
    p.parts=parseRulerWings((house.wings??[]).join(',')).map(wing=>{
      const [u,v]=WING_PLACES[wing](ring),x=p.x+(u*cos+v*sin)*metre,z=p.z+(-u*sin+v*cos)*metre;
      return new RoadsidePlacement({index:p.index,x,z,id:rulerWingId(wing),kind:'services',footprint:[1,1],height:WING_HEIGHTS[wing],
        color:p.color,water:false,rotation:p.rotation,scale:metre,fill:p.fill,powered:p.powered,
        options:{...p.options,seed:0,variant:0,state:'closed',worldOrigin:[x,z],worldRotationY:p.rotation}});
    });
    return p;
  }
  /** Plain roads and railways are drawn as smooth curves (roadCurves.ts): their tiles have no model of their own here,
   * only the far view's ground, so nothing covers the curve */
  curves=false;
  /** The nearest point of a road's middle line within reach (world units), the way it runs and how far the road reaches
   * either side (roadCurves.ts nearest), so the ruler's buildings stand against the curved roads */
  roadSnap:((x:number,z:number,reach:number)=>RoadNear|null)|null=null;
  placement(i:number,region:RegionId):Placement|null {
    // The farm zone's fields are drawn by their own layer (farmFields.ts), not as a tile's dirt
    if(isFieldValue(this.values[i]))return null;
    // Where the plots are a list (src/plotBuildings.ts), each is drawn once, on its own columns, from the tile it is
    // counted at; the other tiles it shows draw nothing of it
    const list=this.plotList();
    if(list&&!(this.flags[i]&ZONEBIT)&&plotKindOfValue(this.values[i])!==null)return this.listPlacement(i,region,list);
    if(this.curves&&isPowerCrossing(this.values[i]))return this.wiresOnly(i,region);
    if(this.curves&&(isCurved(this.values[i])||(this.values[i]===0||isWoods(this.values[i]))&&this.besideCurve(i)))return null;
    const p=this.narrowBridge(this.atRealSize(this.toEra(this.placementOf(i,region,this.values[i]))));
    const front=this.frontage(p);
    if(front)return front;
    return this.toRoadEdge(this.houseCompound(p&&this.curves&&this.roadSnap?this.againstRoad(p):p));
  }
  /**
   * A building of the ruler's stood with its front against the edge of the road it faces (slideToRoad), its parts (the
   * house's wings) with it; homes, shops and factories stand by their painted cells (cellPlotPose), and a building with no
   * road across its front stays where it is. Its front is kept on the placement for its lot and driveway (roadCurves.ts).
   */
  private toRoadEdge(p:Placement|null):Placement|null {
    if(!p||!p.posed||['residential','commercial','industrial'].includes(p.kind))return p;
    const front=p.front??this.frontOf(p);
    p.front=front;
    if(!this.roadSnap)return p;
    // ... never further than SLIDE_PAST_M past the ground it holds, so what is drawn of it stays inside its fence
    // (compounds.ts; LOOK_BOOK "ที่ที่อาคารจองไว้แต่ดูว่างเปล่า"): a square block behind a road's second row of tiles
    // keeps its building, with a driveway out to the road
    const limit=this.slideLimit(p,front);
    const slide=Math.min(slideToRoad(p.x,p.z,p.rotation,front,this.roadSnap),limit??Infinity);
    if(Math.abs(slide)<1e-3)return p;
    const dx=Math.sin(p.rotation)*slide,dz=Math.cos(p.rotation)*slide;
    for(const q of [p,...(p.parts??[])]){q.x+=dx;q.z+=dz;q.options={...q.options,worldOrigin:[q.x,q.z]};}
    return p;
  }
  /** The ground the building of the ruler's whose centre tile is i holds (metres): its outline when its tiles were laid
   * by it, else its square block of tiles (src/buildings/turnedFootprint.ts laidOutline); null when the map keeps no
   * record of it (gameMap.buildings) or it is one tile */
  private heldOutline(i:number):Outline|null {
    const map=this.source,b=map?.buildings?.atTile(i);
    const size=b?.size??0;
    if(!map||!b||size<2)return null;
    const held=laidOutline(map as unknown as FootprintMap,b as unknown as PlacedBuilding);
    if(held)return held;
    const metres=tileMetres(map),left=i%this.width-1,top=Math.floor(i/this.width)-1;
    return outlineOf((left+size/2)*metres,(top+size/2)*metres,0,size,metres);
  }
  /** How far a building may be slid ahead to its road (world units): until its drawn front stands SLIDE_PAST_M past the
   * ground it holds (heldOutline); null for a building the map keeps no record of */
  private slideLimit(p:Placement,front:number):number|null {
    const held=this.heldOutline(p.index);
    if(!held)return null;
    const units=unitsPerMetre(tileMetres(this.source!)),fx=Math.sin(p.rotation),fz=Math.cos(p.rotation);
    // how far the held ground reaches ahead of the drawn middle, the way the building faces
    const reach=held.hu*Math.abs(held.ux*fx+held.uz*fz)+held.hv*Math.abs(held.vx*fx+held.vz*fz);
    const ahead=(held.x*units-p.x)*fx+(held.z*units-p.z)*fz+reach*units;
    return Math.max(0,ahead+SLIDE_PAST_M*units-front);
  }
  /**
   * The square block of tiles a building of the ruler's (two tiles a side and up) stands on, on a real-scale map, when
   * the 3D view would otherwise draw it turned or slid past them: one put down a tile at a time and never turned, or kept
   * turned or slid off its block before its tiles followed (its kept pose not its tiles', laidOutline). Its middle in world units
   * and its kept turn; null for the rest. Such a building is drawn on that block, square to it (owner, 21 Oct 2026: "ถ้า
   * พื้นที่ที่กันไว้ ก็ควรจะมีพื้นที่กั้นไว้นะ"; docs/NO_GRID_PLAN.md 3A): the auto player's house was drawn turned to its
   * road on a square block and fence, its lawn past the fence.
   */
  private squareBlock(i:number,size:number):{x:number;z:number;rot:number|null}|null {
    const map=this.source,b=map?.buildings?.atTile(i);
    if(!this.realUnits||!map||!b||b.size!==size||!TURNED_SIZES.has(size))return null;
    if(laidOutline(map as unknown as FootprintMap,b as unknown as PlacedBuilding))return null;
    return {x:(i%this.width-1+size/2)*10,z:(Math.floor(i/this.width)-1+size/2)*10,rot:b.rot};
  }
  /** How far ahead of its middle a building's front stands as drawn (world units): an era model is in metres, its tiles
   * 16 m each less half a metre clear (art/buildings/PLAN.md), the others 10 model units a tile less half a unit clear
   * (their sites are 29 units on 3 tiles), filling `fill` of it */
  private frontOf(p:Placement):number {
    const era=parseEraId(p.id),kind=era?this.eraModels?.index.kinds[era.kind]:undefined;
    if(kind)return (kind.tiles*(this.eraModels!.index.tileMetres??16)/2-.5)*p.scale;
    return (Math.max(p.footprint[0],p.footprint[1])*5-.5)*(p.fill??1);
  }
  /** A power line over a curved road: its poles and wires alone, the road drawn by the curve under them */
  private wiresOnly(i:number,region:RegionId):Placement|null {
    const p=this.placementOf(i,region,this.values[i]);
    if(!p)return null;
    p.id='road.power_crossing';p.kind='power';p.options={...p.options,state:'wires'};
    return p;
  }
  /**
   * On a real-scale city map a model's metres are the map's (owner, 15 Oct 2026: "ย่อของในภาพ 3D ให้เท่าของจริง"): a
   * 16 m tile is drawn 10 units, so a building, a park or a stop is drawn at 10/16 of its model and covers that share of
   * its tiles. Roads, railways, power lines and the ground still fill their tiles.
   */
  private atRealSize(p:Placement|null):Placement|null {
    const units=this.realUnits;
    if(!p||!units||units>=1||TILING_KINDS.has(p.kind))return p;
    const factor=shareOf(p);
    p.scale*=units*factor;p.fill=units*factor;p.height*=factor;return p;
  }
  /**
   * A building of the ruler's (3 × 3 and up) beside a road, as Cities: Skylines sets one: turned to face the road and
   * stood against its edge, along its curve (owner, 14 Oct 2026: "ทำไมที่ว่าการอำเภอ ไม่ snap กับถนน"). Its tiles are
   * the game's as before; only where it is drawn moves.
   */
  /**
   * The pose to keep for the building whose centre is tile index i ([x, z, turn] in world units, kept in
   * gameMap.buildings by game.js keepBuildingPoses), when it was never turned: the way it stands now against its nearest road, so a road drawn later
   * nearer to it never turns it (owner, 20 Oct 2026: "สิ่งก่อสร้างที่วาดแล้วห้ามขยับอีก"). Homes, shops and factories grow
   * with their zones and are left alone; null when it is not a building standing against a road.
   */
  poseToKeep(i:number,region:RegionId='central'):[number,number,number]|null {
    // A building on its square block of tiles is kept there, square to them (squareBlock), also when it was kept turned
    // past them before (the turn kept then is put right): its block, so its kept outline is its tiles' and nothing the
    // simulation reads changes
    const held=this.source?.buildings?.atTile(i)?.size??0,block=held?this.squareBlock(i,held):null;
    if(block){const turn=this.blockTurn(block,held);return turn===null?null:[block.x,block.z,turn];}
    if(this.placedPose(i))return null;
    const p=this.placement(i,region);
    if(!p||!p.posed||['residential','commercial','industrial'].includes(p.kind))return null;
    const size=Math.max(p.footprint[0],p.footprint[1]);
    const factor=this.realUnits?shareOf(p):1;
    // againstRoad moves a kept pose out by this much for a model drawn bigger: take it off again
    const delta=size*5*BUILDING_SCALE*(factor-1),nx=-Math.sin(p.rotation),nz=-Math.cos(p.rotation);
    return [Math.round((p.x-nx*delta)*100)/100,Math.round((p.z-nz*delta)*100)/100,Math.round(p.rotation*1000)/1000];
  }
  /** The middle and turn of the building whose centre tile is i (gameMap.buildings), in world units: [x, z, turn];
   * null when there is none, or it was never turned (from before the metres: it stands against its nearest road) */
  private placedPose(i:number):[number,number,number]|null {
    const b=this.source?.buildings?.atTile(i);
    if(!b||b.rot===null)return null;
    const units=unitsPerMetre(tileMetres(this.source!));
    return [b.x*units,b.z*units,b.rot];
  }
  /** Whether the building whose centre tile is i was laid turned, its tiles its turned outline's
   * (src/buildings/turnedFootprint.ts laidOutline) */
  private laidTurned(i:number):boolean {
    const b=this.source?.buildings?.atTile(i);
    return Boolean(b&&laidOutline(this.source as unknown as FootprintMap,b as unknown as PlacedBuilding));
  }
  /** The turn of a building on its square block (squareBlock): the quarter turn nearest the one kept for it, else nearest
   * facing the road beside it, else null (no road near) */
  private blockTurn(block:{x:number;z:number;rot:number|null},size:number):number|null {
    if(block.rot!==null)return quarterTurn(block.rot);
    const near=this.roadSnap?.(block.x,block.z,size*5+28)??null;
    if(!near)return null;
    let nx=-near.tz,nz=near.tx;
    if(nx*(block.x-near.x)+nz*(block.z-near.z)<0){nx=-nx;nz=-nz;}
    return quarterTurn(Math.atan2(-nx,-nz));
  }
  private againstRoad(p:Placement):Placement {
    const size=Math.max(p.footprint[0],p.footprint[1]);
    const zoned=p.kind==='residential'||p.kind==='commercial'||p.kind==='industrial';
    // Every building (owner, 15 Oct 2026: "tool ทุก tool จะต้อง snap กับ ถนน") and every grown plot/lot/zone stands
    // aligned with and facing its road; not the ground, roads, railways, power lines and shores
    // (a 2 x 2 laid turned to its road stands at its kept pose as a 3 x 3 does: docs/NO_GRID_PLAN.md 3A.1)
    if(['terrain','road','rail','shore','debug','veg','park'].includes(p.kind)||
      (!zoned&&size<3&&!['services','transport'].includes(p.kind)||p.kind==='power'&&size<3)&&!this.laidTurned(p.index))return p;
    const factor=this.realUnits?shareOf(p):1;
    const scale=BUILDING_SCALE*factor;
    // On its square block of tiles, square to them, facing the side its road is on (squareBlock)
    const block=this.squareBlock(p.index,size);
    if(block){const turn=this.blockTurn(block,size);return turn===null?p:p.againstRoad(block.x,block.z,turn,scale);}
    // Where the player put it down in metres, or where the game kept it standing (gameMap.buildings)
    const kept=this.placedPose(p.index);
    if(kept){
      const rot=kept[2],nx=-Math.sin(rot),nz=-Math.cos(rot),delta=size*5*BUILDING_SCALE*(factor-1);
      return p.againstRoad(kept[0]+nx*delta,kept[1]+nz*delta,rot,scale);
    }
    // Half its depth: an era model is in metres, a tile 16 m deep, the others 10 model units a tile (scale turns
    // either into world units), so an era building stands its whole plot deep from the road's edge, not 3 m into it
    const depthHalf=size*(p.id?.startsWith('era.')?8:5)*scale;
    if(zoned&&size<3&&(this.source as CellMap|null)?.cellZones){
      const tx=p.index%this.width,ty=Math.floor(p.index/this.width);
      const cellPose=cellPlotPose(this.source as unknown as CellMap,tx,ty,size,scale,depthHalf);
      if(cellPose)return p.againstRoad(cellPose.x,cellPose.z,cellPose.rotation,scale);
    }
    const near=this.roadSnap!(p.x,p.z,size*5+28);
    if(!near)return p;
    if(zoned&&size<3){
      let nx=-near.tz,nz=near.tx;
      if(nx*(p.x-near.x)+nz*(p.z-near.z)<0){nx=-nx;nz=-nz;}
      const gap=near.reach+.4+depthHalf;
      return p.againstRoad(near.x+nx*gap,near.z+nz*gap,Math.atan2(-nx,-nz),scale);
    }
    // Drawn smaller than its tiles (owner, 14 Oct 2026: "ลด scale ของที่ว่าการอำเภอ ลงอีก"), its front against the road
    const {x,z,rotation}=poseAgainstRoad(p.x,p.z,size,near,scale);
    return p.againstRoad(x,z,rotation,scale);
  }
  /**
   * A bridge on a real-scale city map, as narrow as the road or railway drawn up to it on either side (owner, 15 Oct
   * 2026: the roads were their real width but a bridge still the whole 16 m tile, so each one widened into a block): a
   * road bridge to its level's reach, shoulders and all, a railway bridge to the rails' scale. Its length still spans
   * the tile, where the lines stop.
   */
  private narrowBridge(p:Placement|null):Placement|null {
    const units=this.realUnits;
    if(!p||!units||!this.curves)return p;
    if(p.id==='rail.bridge'){p.across=Math.min(1,units);return p;}
    // A road bridge of any surface, laterite's too, and a drawbridge
    if(!p.id||!/^road\.(laterite_)?(draw)?bridge$/.test(p.id))return p;
    // The map's own level of the road, 1 laterite … 8 tollway (src/roadLevels.ts), asphalt where it has none
    const level=this.roadLevels?.[p.index]||2;
    p.across=Math.min(1,roadReach(level,units)/roadReach(level));
    return p;
  }
  /** Open land beside a curved road, which the curve may cross: its fields' raised ground would hide the road */
  private besideCurve(i:number):boolean {
    const x=i%this.width,y=Math.floor(i/this.width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;
      if((dx||dy)&&nx>=0&&ny>=0&&nx<this.width&&ny<this.height&&isCurved(this.values[ny*this.width+nx]))return true;}
    return false;
  }
  private placementOf(i:number,region:RegionId,v:number):Placement|null {
    if(this.coverage[i]!==-1&&this.coverage[i]!==i) return null;
    const x=i%this.width,y=Math.floor(i/this.width),entry=TILE_TABLE[v]??debug(), hash=tileSeed(x,y);
    const zone=Boolean(this.flags[i]&ZONEBIT),[w,h]=zone?entry.footprint:[1,1];
    const plot=this.paintedZones&&!zone?plotOf(this,x,y):null;
    if(plot)return this.plotPlacement(i,x,y,plot,region,hash);
    // A big building still being built is its construction site until it is done (src/construction.ts)
    const site=zone?this.sitePlacement(i,x,y,w,region):null;
    if(site)return site;
    const house=zone?this.housePlacement(i,x,y,region,hash):null;
    if(house)return house;
    const power=zone?this.powerPlacement(i,x,y,region,hash):null;
    if(power)return power;
    const temple=zone?this.templePlacement(i,x,y,region):null;
    if(temple)return temple;
    const school=zone?this.civicPlacement(i,x,y,region,hash):null;
    if(school)return school;
    const waste=zone?this.wastePlacement(i,x,y,region,hash):null;
    if(waste)return waste;
    const extended=zone?this.extendedPlacement(i,x,y,region,hash):null;
    if(extended)return extended;
    let id=entry.id,rotation=0,variant=0,state='closed',kind=entry.kind;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    const special = (horizontal:boolean):void => { rotation=horizontal?-Math.PI/2:0; };
    if(isRoad(v)) {
      kind='road';
      if(v===64||v===65) { id='road.bridge'; special(v===64); }
      else if(v===77||v===78||v===239) { id='road.power_crossing'; special(v===77); }
      else if(v===237||v===238) {id='road.rail_crossing'; special(v===238);}
      else if(v>=828&&v<=832||v>=948&&v<=951) {id='road.drawbridge'; special(v<948);state='open';}
      else {const pick=roadForMask(this.mask(x,y,isRoad),roadLevel);id=pick.id;rotation=pick.rotationY;
        if(id.endsWith('corner'))variant=staircaseVariant(this.staircase(x,y),pick.quarterTurns);}
      if(roadLevel===1&&id&&!id.includes('laterite_'))id=id.replace('road.','road.laterite_');
    } else if(isRail(v)) {
      kind='rail';
      if(v===224||v===225) {id='rail.bridge';special(v===224);}
      else if(v===221||v===222) {id='rail.power_crossing';special(v===221);}
      else {const pick=railForMask(this.mask(x,y,isRail))??{id:'rail.end',rotationY:0,quarterTurns:0};id=pick.id;rotation=pick.rotationY;
        // A slanted line's corners run straight across (models/rail/track.ts stairPath)
        if(id==='rail.corner')variant=staircaseVariant(this.railStaircase(x,y),pick.quarterTurns)&3;}
    } else if(isPower(v)) {
      kind='power'; if(v===208||v===209){id='power.water';special(v===208);}
      else {const pick=powerForMask(this.mask(x,y,isPower))??{id:'power.end',rotationY:0};id=pick.id;rotation=pick.rotationY;
        if(this.realUnits)state='open';}
    } else if(v>=5&&v<=20) {kind='shore';id='terrain.shore';variant=this.mask(x,y,n=>!isWaterNeighbor(n));}
    else if(isWoods(v)) {variant=this.mask(x,y,isWoods);}
    else if(v===0||v>=44&&v<=51) {variant=(hash>>>2)&3;if(v===0&&this.paintedZones)state=LAND_COVER_STATES[this.source?.landCover?.[i]??0]??'grass';}
    if(id==='svc.stadium')state=v>=795&&v<=810?'game':'empty';
    if(id==='port.seaport'&&zone)rotation=this.portRotation(x,y,w);
    // The water works' gate and the water tower's ladder face their road (RENDERER_SPEC 6C)
    if(id==='water.works'&&zone||id==='water.tower')rotation=FACING_ROTATION[this.roadSide(x,y,id==='water.tower'?1:3)];
    // A constituent tile without a centre is damaged ground, not another copy of its zone.
    if(!zone&&(entry.footprint[0]>1||entry.footprint[1]>1)&&kind!=='debug') {id='terrain.dirt';kind='terrain';}
    const water=isWater(v)||v===208||v===209;
    const height=id?.endsWith('zone_empty')?.12:id==='water.works'?7:id==='water.tower'?9:id==='power.coal'?44:id==='power.nuclear'?55:id==='port.seaport'?21:id==='port.airport'?20.5:kind==='commercial'?Math.min(145,5+Math.max(0,entry.density)*24):kind==='residential'?4+Math.max(0,entry.density)*18:kind==='industrial'?5+Math.max(0,entry.density)*4:v===1021?3:kind==='services'||kind==='transport'?12:kind==='debug'?4:0.1;
    const colors:Record<string,number>={residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473,services:0xa2b8b4,transport:0x9aa8aa,road:0x4a5255,rail:0x9b998b,power:0xa29280,shore:0xb09972,debug:0xbf6f93};
    const turn=Math.round(-rotation/(Math.PI/2))&3,station=[y*10,-(x+1)*10,-(y+1)*10,x*10][turn];
    const sleeperOffset=Math.round(((station%.6+.6)%.6)*1e6)/1e6;
    return new Placement({index:i,x:(x-(w>1?1:0)+w/2)*10,z:(y-(h>1?1:0)+h/2)*10,id,kind,
      footprint:[w,h],height,color:kind==='road'&&roadLevel===1?0xbc7043:colors[kind]??(isWoods(v)?0x719765:0xa99472),water,rotation,
      scale:kind==='debug'?1/3:1,powered:Boolean(this.flags[i]&POWERBIT),
      options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant,state,waterMask:this.mask(x,y,isWaterNeighbor),landMask:this.mask(x,y,n=>!isWaterNeighbor(n)),
        ...(kind==='rail'?{sleeperOffset}:{}),worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
}
export function prototypeKey(p:PlacementFields):string {
  const o=p.options;
  const shareSeed=p.id?.startsWith('plot.')||p.id?.startsWith('lot.')||p.id?.startsWith('res.')||p.id?.startsWith('com.')||p.id?.startsWith('ind.');
  const seed=shareSeed?0:o.seed;
  return [p.id,seed,o.region,o.variant,o.state,p.id==='terrain.woods'?o.waterMask??0:0,
    p.id==='terrain.water'?o.landMask??0:0,p.kind==='rail'?o.sleeperOffset??0:0].join('|');
}
