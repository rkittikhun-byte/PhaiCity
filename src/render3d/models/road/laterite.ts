/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Group } from 'three';
import type { ModelOptions } from '../registry.js';
import { citySurfaceMaterial, getMaterial, roadConcrete } from '../../materials/library.js';
import { countTriangles } from '../../util/geometry.js';
import { RoadBuilder } from './builder.js';
import { BASIC_MASKS } from './interfaces.js';
import { crossingHeight, crossingSignals, createDrawbridge, railway } from './special.js';
import { crossingPowerLines } from './power-lines.js';
import { point } from '../vegetation/builder.js';
import { alongRoad, clipTriangle, roadDistance, RoadShape, roadShape } from './centreline.js';
export const LATERITE_KINDS = ['straight','corner','t','cross','end','single','bridge','drawbridge','rail_crossing','power_crossing'] as const;
export type LateriteKind = typeof LATERITE_KINDS[number];
/**
 * Laterite stops this far from its centre line (a 7 m road); the land shows beyond, so the tiles' squares never
 * show. A diagonal passes 3.54 m from each step's corner, so the road stays on its own tiles.
 */
export const LATERITE_EDGE=3.5;
/**
 * A laterite tile's road, shared by the model and the far-view paint: lone turns are rounded, staircases cut
 * diagonally (models/road/centreline.ts).
 */
export const lateriteShape=(mask:number,diagonal=0,far=0):RoadShape=>roadShape(mask,diagonal,true,far);
// Broad low-contrast wheel tracks, a sunlit crown and dusty shoulders; no painted lines. The colours blend into
// each other, so a road crossing the vertex grid at a slant shades evenly instead of in beads.
const LATERITE_PROFILE:readonly (readonly [number,number])[]=[[.4,0xbf7546],[1.1,0x884322],[1.45,0x884322],[2.1,0xab512b],[2.7,0xb9743f],[3.2,0xb58153]];
const lateriteFrom=new Color(),lateriteTo=new Color();
export function lateriteColour(distance:number):Color {
  const next=LATERITE_PROFILE.findIndex(([d])=>distance<d);
  if(next===0)return new Color(LATERITE_PROFILE[0][1]);
  if(next<0)return new Color(LATERITE_PROFILE[LATERITE_PROFILE.length-1][1]);
  const[d0,c0]=LATERITE_PROFILE[next-1],[d1,c1]=LATERITE_PROFILE[next];
  return new Color().lerpColors(lateriteFrom.setHex(c0),lateriteTo.setHex(c1),(distance-d0)/(d1-d0));
}
type EarthPoint=readonly [number,number,number];
function earth(builder:RoadBuilder,shape:RoadShape,crossing=false):void {
  const positions:number[]=[],colours:number[]=[],uv:number[]=[];
  const grid=8,at=(px:number,pz:number):EarthPoint=>[px,pz,roadDistance(px,pz,shape)];
  const points=Array.from({length:(grid+1)**2},(_,n)=>at((n%(grid+1))*10/grid-5,Math.floor(n/(grid+1))*10/grid-5));
  const corner=(x:number,z:number):EarthPoint=>points[z*(grid+1)+x];
  // Each triangle is cut where the laterite ends, along the curve between its corners.
  const between=(a:EarthPoint,b:EarthPoint,t:number):EarthPoint=>at(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
  for(let z=0;z<grid;z++)for(let x=0;x<grid;x++)for(const triangle of alongRoad(corner(x,z),corner(x+1,z),corner(x,z+1),corner(x+1,z+1)))
    for(const piece of clipTriangle(triangle,p=>p[2]-LATERITE_EDGE,between))for(const[px,pz,d]of piece){
      const crown=.04*Math.max(0,1-d/3.5)*Math.min(1,(5-Math.abs(px))*2,(5-Math.abs(pz))*2);
      positions.push(px,(crossing?crossingHeight(pz):0)+crown,pz);colours.push(...lateriteColour(d).toArray());uv.push((px+5)/10,(pz+5)/10);
    }
  const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3))
    .setAttribute('color',new Float32BufferAttribute(colours,3)).setAttribute('uv',new Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();builder.add(geometry,citySurfaceMaterial());
  // Seeded gravel is sparse and confined to the shoulders, leaving joints perfectly flush.
  const seed=builder.options.seed??0;
  for(let n=0;n<14;n++){
    const x=((n*37+seed*13)%89)/10-4.4,z=((n*53+seed*19)%89)/10-4.4;
    const d=roadDistance(x,z,shape);if(d>2.3&&d<LATERITE_EDGE-.25)builder.box(point(x,(crossing?crossingHeight(z):0)+.025,z),point(.09,.05,.13),getMaterial('gravel_ballast'));
  }
}
export function createLateriteRoad(kind:LateriteKind,options:ModelOptions={}):Group {
  const id=`road.laterite_${kind}`;
  if(kind==='drawbridge'){
    const root=createDrawbridge(options,[]);root.name=id;root.userData.id=id;root.userData.roadLevel=1;
    // Concrete leaf without lane paint; preserve the articulated leaf and bridge states.
    root.traverse(node=>{node.name=node.name.replace('road.drawbridge',id);if('material'in node){const mesh=node as import('three').Mesh;if(!Array.isArray(mesh.material)){
      if(mesh.material===getMaterial('road_marking_white'))mesh.visible=false;
      if(mesh.material===getMaterial('asphalt'))mesh.material=roadConcrete(0xb9b3a6);
    }}});root.userData.triangles=countTriangles(root);return root;
  }
  const root=new Group();root.name=id;const mask=kind in BASIC_MASKS?BASIC_MASKS[kind as keyof typeof BASIC_MASKS]:5;
  // A corner's variant names its staircase steps (models/road/centreline.ts `staircaseVariant`).
  const variant=kind==='corner'?options.variant??0:0,shape=lateriteShape(mask,variant&3,variant>>2&3);
  for(const state of kind==='rail_crossing'?['closed','open']:['closed']){
    const builder=new RoadBuilder(options);
    if(kind==='bridge'){
      builder.box(point(0,-.16,0),point(10,.32,10),roadConcrete());
      for(const x of [-4.8,4.8]){
        builder.box(point(x,.8,0),point(.08,.10,10),getMaterial('metal_steel'));
        for(const z of [-4,-2,0,2,4])builder.box(point(x,.4,z),point(.09,.8,.09),getMaterial('metal_steel'));
      }
      for(const z of [-4,4])for(const x of [-3,3])builder.box(point(x,-1.5,z),point(.5,3,.5),roadConcrete());
    }else{
      earth(builder,shape,kind==='rail_crossing');
      if(kind==='rail_crossing'){railway(builder);crossingSignals(builder,state==='open');}
      if(kind==='power_crossing')root.add(...crossingPowerLines(builder,id));
    }
    const group=builder.finishRoad(id,[],mask);
    if(kind==='rail_crossing'){group.name=`state_${state}`;group.visible=state===(options.state==='open'?'open':'closed');}
    root.add(group);
  }
  root.userData={...root.children.find(n=>n.userData.id)?.userData,id,category:'road',footprint:[1,1],tiles:[],region:options.region??'central',regionTier:'R3',connections:mask,roadLevel:1,
    triangles:countTriangles(root),...(kind==='bridge'?{deckY:0,riverbedY:-3}:{}),worldOrigin:[...(options.worldOrigin??[0,0])]};
  return root;
}
