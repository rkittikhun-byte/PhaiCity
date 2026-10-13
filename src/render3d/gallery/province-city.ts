/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Group } from 'three';
import { POWERBIT, ZONEBIT } from '../../tileFlags.js';
import { MapGenerator } from '../../mapGenerator.js';
import { decodePresetCells, decodePresetLayer, decodePresetHeights, PresetMap } from '../../geo/presetMap.js';
import type { CityMapReader } from '../city/types.js';
import { tileSeed } from '../city/tileModels.js';
import { ModelRegistration, registry } from '../models/registry.js';
import { LATERITE_KINDS } from '../models/road/laterite.js';
export class ProvinceTestCity implements CityMapReader {
  readonly width=300;readonly height=300;readonly values=new Uint16Array(90000);readonly flags=new Uint16Array(90000);
  readonly insideProvince=new Uint8Array(90000);readonly heights=new Float32Array(90000);readonly tileSizeM=400;
  readonly town={x:155,y:165};
  constructor(){
    for(let y=0;y<300;y++)for(let x=0;x<300;x++){
      const i=y*300+x,r=106+13*Math.sin(y*.055)+8*Math.sin(y*.13),river=Math.abs(x-178-3*Math.sin(y*.04))<2.5,lake=(x-147)**2+(y-115)**2<81;
      this.insideProvince[i]=(x-150)**2/(r*r)+(y-150)**2/(117*117)<1?1:0;
      this.heights[i]=20+1800*Math.exp(-(((x-111)/15)**2))*(.55+.45*Math.sin(y*.012)**2)+150*Math.exp(-(((y-65)/19)**2));
      this.values[i]=river||lake?2:x<137||x>235||y<92?37:tileSeed(x,y)%19===0?37:0;
      if(river)this.heights[i]=18+(y%7)*.2;if(lake)this.heights[i]=24+(x%3);
    }
    // One laterite exit road, a north/south railway, a crossing, and a bank-to-bank bridge.
    for(let x=25;x<292;x++)this.values[165*300+x]=this.values[165*300+x]===2?64:66;
    for(let y=20;y<282;y++)this.values[y*300+163]=this.values[y*300+163]===2?225:227;
    this.values[165*300+163]=238;
    // Staircases: one stepping diagonally south-west from the main road, one rising a tile for every two east.
    for(let k=0;k<26;k++)for(const x of[140-k,139-k])this.values[(166+k)*300+x]=66;
    this.values[164*300+190]=66;
    for(let k=0,x=190,y=163;k<18;k++){this.values[y*300+x]=66;this.values[y*300+x+1]=66;this.values[y*300+x+2]=66;x+=2;y--;}
    for(const[x,y,value,size]of[[151,160,244,3],[157,159,265,3],[151,170,427,3],[158,171,774,3],[143,167,765,3],[111,171,265,3]]){
      const first=value-size-1;
      for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++)this.values[(y-1+dy)*300+x-1+dx]=first+dy*size+dx;
      this.values[y*300+x]=value;this.flags[y*300+x]=ZONEBIT|POWERBIT;
    }
  }
  getTileValue(x:number,y:number):number{return this.values[y*300+x];}
  getTileFlags(x:number,y:number):number{return this.flags[y*300+x];}
}
/** Read-only use of the game's preset builder: identical shore smoothing and network connections. */
export async function realProvinceCity(id='TH-50'):Promise<CityMapReader>{
  const response=await fetch(`data/maps/${id}.json`);if(!response.ok)throw Error(`Map unavailable: ${id}`);
  const preset=await response.json() as PresetMap,heights=await decodePresetHeights(preset);
  const map=MapGenerator.fromPresetCells(preset.width,preset.height,decodePresetCells(preset),preset.transport?decodePresetLayer(preset.transport,preset.width,preset.height):null);
  // Expose a read-only facade rather than writing province fields onto a game map.
  return {width:map.width,height:map.height,insideProvince:preset.inside?decodePresetLayer(preset.inside,preset.width,preset.height):null,town:preset.town??null,heights,tileSizeM:preset.tileSizeM,
    getTileValue:(x,y)=>map.getTileValue(x,y),getTileFlags:(x,y)=>map.getTileFlags(x,y)};
}
export const ROAD_LEVELS_PREVIEW:ModelRegistration={
  category:'road',footprint:[20,3],tiles:[],regionTier:'R3',budget:30000,tiling:true,
  factory(options={}){
    const root=new Group();root.name='preview.road_levels';
    LATERITE_KINDS.forEach((kind,i)=>{for(const[level,z]of[[1,-10],[2,10]]){
      const id=`road.${level===1?'laterite_':''}${kind}`,piece=registry[id].factory({...options,roadLevel:level as 1|2});piece.position.set((i-4.5)*15,0,z);root.add(piece);
    }});root.userData={id:root.name,category:'road',footprint:[20,3],tiles:[],regionTier:'R3'};return root;
  },
};
