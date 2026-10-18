/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { registry } from '../models/registry.js';
import { roadForMask } from '../models/road/interfaces.js';
import { LAND_COVER_STATES } from '../models/terrain/terrain.js';
import { staircase as staircaseOf, staircaseVariant } from '../models/road/centreline.js';
import { railForMask } from '../models/rail/track.js';
import { powerForMask } from '../models/power/power.js';
import { POWERBIT, ZONEBIT } from '../../tileFlags.js';
import { cellPlotPose, type CellMap } from '../../zoneCells.js';
import { CIVIC, FARM, HARBOUR, MINE, POWERPLANT, STATION, WASTE } from '../../tileValues.js';
import { HOSPITAL_HEIGHTS } from '../models/civic/hospitals.js';
import { WASTE_HEIGHTS } from '../models/waste/waste.js';
import { LOT_SIZE, lotFacing, lotOf, type Plot, type PlotKind, plotFacing, plotOf, readPlotValue } from '../../plots.js';
import type { CityMapReader } from './types.js';
import { Placement, type PlacementFields } from './placement.js';
import { roadReach } from '../../roadGeometry.js';
import { SEED_BUCKETS } from './types.js';
import type { RegionId } from '../regional/types.js';

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
  // PhaiCity: a bus or songthaew stop (src/transit.ts) shows a songthaew waiting until the stop has a model of its own
  table[1021] = { kind:'transport', id:'veh.songthaew', footprint:[1,1], density:0 };
  return Object.freeze(table.map(entry=>Object.freeze(entry)));
}
export const TILE_TABLE = makeTileTable();
export const tileSeed = (x: number, y: number): number => {
  let h = Math.imul(x | 0, 0x45d9f3b) ^ Math.imul(y | 0, 0x27d4eb2d);
  h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (h ^ h >>> 16) >>> 0;
};
export const isRoad = (v: number): boolean => v >= 64 && v <= 206 || v === 237 || v === 238 || v >= 828 && v <= 832 || v >= 948 && v <= 951 || v === 239;
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

/** Where a building of size tiles whose tiles' middle is (x, z) stands against that road, drawn at fill (default BUILDING_SCALE):
 * its middle and its turn, its front to the road */
export function poseAgainstRoad(x: number, z: number, size: number, near: RoadNear, fill = BUILDING_SCALE): { x: number; z: number; rotation: number } {
  const half = size * 5 * fill;
  let nx = -near.tz, nz = near.tx;
  if (nx * (x - near.x) + nz * (z - near.z) < 0) { nx = -nx; nz = -nz; }
  const gap = near.reach + .6 + half;
  return { x: near.x + nx * gap, z: near.z + nz * gap, rotation: Math.atan2(-nx, -nz) };
}
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
  private nowSec = 0;
  readonly construction = new Map<number, { startSec: number; stage: 'stage_1' | 'stage_2' }>();
  /** The live map, read for whether homes, shops and factories are painted tile by tile (src/plots.ts) and its roads' levels */
  source: Pick<CityMapReader, 'paintedZones' | 'roadLevels' | 'roadPieces' | 'roadPaths' | 'civicKinds' | 'rulerHouse' | 'landCover' | 'wasteKinds' | 'powerKinds' | 'mineKinds' | 'stationKinds'> | null = null;
  get paintedZones(): boolean { return this.source?.paintedZones === true; }
  get roadLevels(): Uint8Array | null { return this.source?.roadLevels ?? null; }
  get roadPieces(): Uint16Array | null { return this.source?.roadPieces ?? null; }
  get roadPaths(): CityMapReader['roadPaths'] { return this.source?.roadPaths ?? null; }
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
    const trackBuild = this.enableConstruction && !this.initialSync && this.paintedZones;
    for(let i=0;i<this.values.length;i++) {
      const x=i%this.width,y=Math.floor(i/this.width),v=map.getTileValue(x,y),f=map.getTileFlags(x,y) & (ZONEBIT|POWERBIT);
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
        if ((f|this.flags[i]) & ZONEBIT) zonesChanged=true;
        this.values[i]=v; this.flags[i]=f; this.levelsCopy[i]=lv;
      }
    }
    this.initialSync = false;
    if(zonesChanged) this.coverZones(); return changed;
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
  /** A regional power plant on tiles 745–760 (centre 750, src/powerPlants.ts): `power.solar`, `power.wind`, `power.gas`,
   * `power.hydro`, or `power.coal` (`lignite`), picked from `gameMap.powerKinds` and turned toward its road. */
  private powerPlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null {
    if(this.values[i]!==POWERPLANT)return null;
    const pk=this.source?.powerKinds?.[i]??'lignite';
    const id=pk==='lignite'?'power.coal':`power.${pk}`;
    if(!registry[id])return null;
    const heights:Record<string,number>={lignite:44,solar:8,wind:36,gas:28,hydro:16};
    const colors:Record<string,number>={lignite:0xa2b8b4,solar:0x365b8c,wind:0xdbe3e6,gas:0xb5bfc4,hydro:0x7ea1b5};
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel,rotation=FACING_ROTATION[this.roadSide(x,y,4)];
    const cx=(x+1)*10,cz=(y+1)*10;
    return new Placement({index:i,x:cx,z:cz,id,kind:'services',footprint:[4,4],height:heights[pk]??30,color:colors[pk]??0xa2b8b4,
      water:false,rotation,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,
        variant:0,state:'closed',waterMask:0,landMask:15,worldOrigin:[cx,cz],worldRotationY:rotation}});
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
    let id='ind.block_0_0',kind='industrial',height=9,color=0xc7a473;
    if(v===MINE){
      const mk=this.source?.mineKinds?.[i]??'limestone_quarry';
      id=mk==='oil_gas_well'||mk==='salt_works'?'ind.block_1_2':mk==='gem_mine'?'ind.block_0_2':'ind.block_0_3';
      height=12;
    }else if(v===FARM){
      id='ind.block_0_0';height=7;color=0x9ba873;
    }else if(v===HARBOUR){
      id='ind.block_0_1';kind='transport';height=9;color=0x9aa8aa;
    }else if(v===STATION){
      const sk=this.source?.stationKinds?.[i]??'train_station';
      id=sk==='hsr_station'?'com.block_3_3':sk==='metro_station'?'com.block_2_2':'civic.vocational_college';
      kind='transport';height=10;color=0x9aa8aa;
    }
    if(!registry[id])return null;
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id,kind,footprint:[3,3],height,color,
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
    return new Placement({index:i,x:cx,z:cz,id,kind:lot.kind,footprint:[LOT_SIZE,LOT_SIZE],height:(PLOT_HEIGHTS[lot.kind][lot.level]??20)*scale,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[lot.kind],water:false,rotation,scale,
      powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant:lot.value,state,
        waterMask:0,landMask:15,worldOrigin:[cx,cz],worldRotationY:rotation}});
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
    return new Placement({index:i,x:(x+.5)*10,z:(y+.5)*10,id,kind:plot.kind,footprint:[1,1],height:PLOT_HEIGHTS[plot.kind][plot.level]??6,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[plot.kind],water:false,rotation,scale:1,
      powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant:plot.value,state,
        waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}});
  }
  /** Plain roads and railways are drawn as smooth curves (roadCurves.ts): their tiles have no model of their own here,
   * only the far view's ground, so nothing covers the curve */
  curves=false;
  /** The nearest point of a road's middle line within reach (world units), the way it runs and how far the road reaches
   * either side (roadCurves.ts nearest), so the ruler's buildings stand against the curved roads */
  roadSnap:((x:number,z:number,reach:number)=>RoadNear|null)|null=null;
  placement(i:number,region:RegionId):Placement|null {
    if(this.curves&&isPowerCrossing(this.values[i]))return this.wiresOnly(i,region);
    if(this.curves&&(isCurved(this.values[i])||(this.values[i]===0||isWoods(this.values[i]))&&this.besideCurve(i)))return null;
    const p=this.narrowBridge(this.atRealSize(this.placementOf(i,region,this.values[i])));
    return p&&this.curves&&this.roadSnap?this.againstRoad(p):p;
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
    const factor=p.id?(CITY_MODEL_SCALE[p.id]??1):1;
    p.scale*=units*factor;p.fill=units*factor;p.height*=factor;return p;
  }
  /**
   * A building of the ruler's (3 × 3 and up) beside a road, as Cities: Skylines sets one: turned to face the road and
   * stood against its edge, along its curve (owner, 14 Oct 2026: "ทำไมที่ว่าการอำเภอ ไม่ snap กับถนน"). Its tiles are
   * the game's as before; only where it is drawn moves.
   */
  private againstRoad(p:Placement):Placement {
    const size=Math.max(p.footprint[0],p.footprint[1]);
    const zoned=p.kind==='residential'||p.kind==='commercial'||p.kind==='industrial';
    // Every building (owner, 15 Oct 2026: "tool ทุก tool จะต้อง snap กับ ถนน") and every grown plot/lot/zone stands
    // aligned with and facing its road; not the ground, roads, railways, power lines and shores
    if(['terrain','road','rail','shore','debug','veg','park'].includes(p.kind)||
      !zoned&&size<3&&!['services','transport'].includes(p.kind)||p.kind==='power'&&size<3)return p;
    const factor=this.realUnits&&p.id?(CITY_MODEL_SCALE[p.id]??1):1;
    const scale=BUILDING_SCALE*factor;
    // Where the player slid it along its road, kept with the city (src/game.js buildingPose)
    const kept=(this.source as {buildingPoses?:Record<string,[number,number,number]>}|null)?.buildingPoses?.[p.index];
    if(kept){
      const rot=kept[2],nx=-Math.sin(rot),nz=-Math.cos(rot),delta=size*5*BUILDING_SCALE*(factor-1);
      return p.againstRoad(kept[0]+nx*delta,kept[1]+nz*delta,rot,scale);
    }
    if(zoned&&size<3&&(this.source as CellMap|null)?.cellZones){
      const tx=p.index%this.width,ty=Math.floor(p.index/this.width);
      const cellPose=cellPlotPose(this.source as unknown as CellMap,tx,ty,size,scale);
      if(cellPose)return p.againstRoad(cellPose.x,cellPose.z,cellPose.rotation,scale);
    }
    const near=this.roadSnap!(p.x,p.z,size*5+28);
    if(!near)return p;
    if(zoned&&size<3){
      let nx=-near.tz,nz=near.tx;
      if(nx*(p.x-near.x)+nz*(p.z-near.z)<0){nx=-nx;nz=-nz;}
      const half=size*5*scale;
      const gap=near.reach+.4+half;
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
    const house=zone?this.housePlacement(i,x,y,region,hash):null;
    if(house)return house;
    const power=zone?this.powerPlacement(i,x,y,region,hash):null;
    if(power)return power;
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
