/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { registry } from '../models/registry.js';
import { roadForMask } from '../models/road/interfaces.js';
import { staircase as staircaseOf, staircaseVariant } from '../models/road/centreline.js';
import { railForMask } from '../models/rail/track.js';
import { powerForMask } from '../models/power/power.js';
import { POWERBIT, ZONEBIT } from '../../tileFlags.js';
import { CIVIC } from '../../tileValues.js';
import { LOT_SIZE, lotFacing, lotOf, type Plot, type PlotKind, plotFacing, plotOf } from '../../plots.js';
import type { CityMapReader, Placement } from './types.js';
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
  for (let start = 956; start <= 1010; start += 9) for (let i=0;i<9;i++) table[start+i] = { kind:'services', id:null, footprint:[3,3], density:1 };
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
export const isPower = (v: number): boolean => v >= 208 && v <= 222 || v === 77 || v === 78 || v === 239;
export const isWater = (v: number): boolean => v >= 2 && v <= 20;
export const isWaterNeighbor = (v:number):boolean => isWater(v)||v===64||v===65||v===208||v===209||v===224||v===225||v>=828&&v<=832||v>=948&&v<=951;
export const isWoods = (v: number): boolean => v >= 21 && v <= 39;
const SIDES = [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]] as const;
/** Heights of the painted plots' buildings by level (src/plots.ts), for the far view's boxes and the camera */
const PLOT_HEIGHTS: Readonly<Record<PlotKind, readonly number[]>> = {
  residential: [0, 6, 8, 14, 26, 66], commercial: [0, 6, 11, 17, 36, 92], industrial: [0, 7, 9, 12, 16],
};
const PLOT_MODEL_PREFIX: Readonly<Record<PlotKind, string>> = { residential: 'res', commercial: 'com', industrial: 'ind' };
/** A building's turn so its front (+Z) faces its road: north, east, south, west (src/plots.ts plotFacing) */
const FACING_ROTATION = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
export class TileSnapshot implements CityMapReader {
  roadLevel: 1 | 2 | 3 | ((x:number,y:number)=>1|2|3) = 2;
  /** The live map, read for whether homes, shops and factories are painted tile by tile (src/plots.ts) and its roads' levels */
  source: Pick<CityMapReader, 'paintedZones' | 'roadLevels' | 'civicKinds' | 'rulerHouse'> | null = null;
  get paintedZones(): boolean { return this.source?.paintedZones === true; }
  get roadLevels(): Uint8Array | null { return this.source?.roadLevels ?? null; }
  readonly values: Uint16Array; readonly flags: Uint16Array; readonly coverage: Int32Array;
  constructor(readonly width: number, readonly height: number) {
    this.values = new Uint16Array(width*height); this.flags = new Uint16Array(width*height);
    this.coverage = new Int32Array(width*height); this.coverage.fill(-1);
  }
  getTileValue(x:number,y:number):number { return this.values[y*this.width+x]; }
  getTileFlags(x:number,y:number):number { return this.flags[y*this.width+x]; }
  sync(map: CityMapReader): number[] {
    const changed: number[] = []; let zonesChanged = false;
    for(let i=0;i<this.values.length;i++) {
      const x=i%this.width,y=Math.floor(i/this.width),v=map.getTileValue(x,y),f=map.getTileFlags(x,y) & (ZONEBIT|POWERBIT);
      if(v!==this.values[i]||f!==this.flags[i]) { changed.push(i); if ((f|this.flags[i]) & ZONEBIT) zonesChanged=true; this.values[i]=v; this.flags[i]=f; }
    }
    if(zonesChanged) this.coverZones(); return changed;
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
    return {index:i,x:(x+.5)*10,z:(y+.5)*10,id:'civic.ruler_house',kind:'services',footprint:[3,3],height:14+house.level*3,color:0xa2b8b4,
      water:false,rotation:0,scale:1,powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,
        variant:house.level,state:[...(house.wings??[])].sort().join(','),waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:0}};
  }
  /** A lot's one building over its four plots (src/plots.ts lotOf), from its top-left tile; null on its other tiles. */
  private lotPlacement(i:number,x:number,y:number,region:RegionId,hash:number):Placement|null|undefined {
    const lot=lotOf(this,x,y);if(!lot)return undefined;if(lot.x!==x||lot.y!==y)return null;
    const prefix=PLOT_MODEL_PREFIX[lot.kind],named=`lot.${prefix}_${lot.level}`,single=`plot.${prefix}_${lot.level}`;
    // Until a lot has a model of its own, the plot's building, bigger
    const id=registry[named]?named:registry[single]?single:null,scale=registry[named]?1:1.6;
    const rotation=FACING_ROTATION[lotFacing(this,lot)],cx=(x+LOT_SIZE/2)*10,cz=(y+LOT_SIZE/2)*10;
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    return {index:i,x:cx,z:cz,id,kind:lot.kind,footprint:[LOT_SIZE,LOT_SIZE],height:(PLOT_HEIGHTS[lot.kind][lot.level]??20)*scale,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[lot.kind],water:false,rotation,scale,
      powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant:lot.value,state:'closed',
        waterMask:0,landMask:15,worldOrigin:[cx,cz],worldRotationY:rotation}};
  }
  /** A painted plot's building, facing its road, or null for an empty plot, whose painted ground is enough. */
  private plotPlacement(i:number,x:number,y:number,plot:Plot,region:RegionId,hash:number):Placement|null {
    if(plot.level<=0)return null;
    const lot=this.lotPlacement(i,x,y,region,hash);if(lot!==undefined)return lot;
    const named=`plot.${PLOT_MODEL_PREFIX[plot.kind]}_${plot.level}`;
    const id=plot.kind==='residential'&&plot.level===1?TILE_TABLE[this.values[i]]?.id??null:registry[named]?named:null;
    const rotation=FACING_ROTATION[plotFacing(this,x,y)];
    const roadLevel=typeof this.roadLevel==='function'?this.roadLevel(x,y):this.roadLevel;
    return {index:i,x:(x+.5)*10,z:(y+.5)*10,id,kind:plot.kind,footprint:[1,1],height:PLOT_HEIGHTS[plot.kind][plot.level]??6,
      color:{residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473}[plot.kind],water:false,rotation,scale:1,
      powered:Boolean(this.flags[i]&POWERBIT),options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant:plot.value,state:'closed',
        waterMask:0,landMask:15,worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}};
  }
  placement(i:number,region:RegionId):Placement|null {
    if(this.coverage[i]!==-1&&this.coverage[i]!==i) return null;
    const x=i%this.width,y=Math.floor(i/this.width),v=this.values[i],entry=TILE_TABLE[v]??debug(), hash=tileSeed(x,y);
    const zone=Boolean(this.flags[i]&ZONEBIT),[w,h]=zone?entry.footprint:[1,1];
    const plot=this.paintedZones&&!zone?plotOf(this,x,y):null;
    if(plot)return this.plotPlacement(i,x,y,plot,region,hash);
    const house=zone?this.housePlacement(i,x,y,region,hash):null;
    if(house)return house;
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
      else {const pick=railForMask(this.mask(x,y,isRail))??{id:'rail.end',rotationY:0};id=pick.id;rotation=pick.rotationY;}
    } else if(isPower(v)) {
      kind='power'; if(v===208||v===209){id='power.water';special(v===208);}
      else {const pick=powerForMask(this.mask(x,y,isPower))??{id:'power.end',rotationY:0};id=pick.id;rotation=pick.rotationY;}
    } else if(v>=5&&v<=20) {kind='shore';id='terrain.shore';variant=this.mask(x,y,n=>!isWaterNeighbor(n));}
    else if(isWoods(v)) {variant=this.mask(x,y,isWoods);}
    else if(v===0||v>=44&&v<=51) {variant=(hash>>>2)&3;if(v===0&&this.paintedZones)state='grass';}
    if(id==='svc.stadium')state=v>=795&&v<=810?'game':'empty';
    if(id==='port.seaport'&&zone)rotation=this.portRotation(x,y,w);
    // A constituent tile without a centre is damaged ground, not another copy of its zone.
    if(!zone&&(entry.footprint[0]>1||entry.footprint[1]>1)&&kind!=='debug') {id='terrain.dirt';kind='terrain';}
    const water=isWater(v)||v===208||v===209;
    const height=id?.endsWith('zone_empty')?.12:id==='power.coal'?44:id==='power.nuclear'?55:id==='port.seaport'?21:id==='port.airport'?20.5:kind==='commercial'?Math.min(145,5+Math.max(0,entry.density)*24):kind==='residential'?4+Math.max(0,entry.density)*18:kind==='industrial'?5+Math.max(0,entry.density)*4:v===1021?3:kind==='services'||kind==='transport'?12:kind==='debug'?4:0.1;
    const colors:Record<string,number>={residential:0x78a58a,commercial:0x718cb0,industrial:0xc7a473,services:0xa2b8b4,transport:0x9aa8aa,road:0x4a5255,rail:0x9b998b,power:0xa29280,shore:0xb09972,debug:0xbf6f93};
    const turn=Math.round(-rotation/(Math.PI/2))&3,station=[y*10,-(x+1)*10,-(y+1)*10,x*10][turn];
    const sleeperOffset=Math.round(((station%.6+.6)%.6)*1e6)/1e6;
    return {index:i,x:(x-(w>1?1:0)+w/2)*10,z:(y-(h>1?1:0)+h/2)*10,id,kind,
      footprint:[w,h],height,color:kind==='road'&&roadLevel===1?0xbc7043:colors[kind]??(isWoods(v)?0x719765:0xa99472),water,rotation,
      scale:kind==='debug'?1/3:1,powered:Boolean(this.flags[i]&POWERBIT),
      options:{region,roadLevel,seed:hash%SEED_BUCKETS,variant,state,waterMask:this.mask(x,y,isWaterNeighbor),landMask:this.mask(x,y,n=>!isWaterNeighbor(n)),
        ...(kind==='rail'?{sleeperOffset}:{}),worldOrigin:[(x+.5)*10,(y+.5)*10],worldRotationY:rotation}};
  }
}
export function prototypeKey(p:Placement):string {
  const o=p.options; return [p.id,o.seed,o.region,o.variant,o.state,p.id==='terrain.woods'?o.waterMask??0:0,
    p.id==='terrain.water'?o.landMask??0:0,p.kind==='rail'?o.sleeperOffset??0:0].join('|');
}
