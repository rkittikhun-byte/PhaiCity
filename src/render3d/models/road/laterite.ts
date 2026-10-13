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
export const LATERITE_KINDS = ['straight','corner','t','cross','end','single','bridge','drawbridge','rail_crossing','power_crossing'] as const;
export type LateriteKind = typeof LATERITE_KINDS[number];
/** Distance to the connected centre lines; common to the model and its inexpensive city representation. */
export function lateriteDistance(x:number,z:number,mask:number):number {
  let distance=Math.hypot(x,z);
  if(mask&1&&z<=0||mask&4&&z>=0)distance=Math.min(distance,Math.abs(x));
  if(mask&2&&x>=0||mask&8&&x<=0)distance=Math.min(distance,Math.abs(z));
  return distance;
}
export function lateriteColour(distance:number):Color {
  // Broad low-contrast wheel tracks, a sunlit crown and dusty shoulders; no painted lines.
  return new Color(distance>3.5?0xb58153:distance>2.8?0xb9743f:Math.abs(distance-1.55)<.4?0x884322:distance<.75?0xbf7546:0xab512b);
}
function earth(builder:RoadBuilder,mask:number,crossing=false):void {
  const positions:number[]=[],colours:number[]=[],uv:number[]=[];
  const grid=8;
  for(let z=0;z<grid;z++)for(let x=0;x<grid;x++)for(const[a,b]of[[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]){
    const px=(x+a)*10/grid-5,pz=(z+b)*10/grid-5,d=lateriteDistance(px,pz,mask);
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
    if(lateriteDistance(x,z,mask)>2.6)builder.box(point(x,(crossing?crossingHeight(z):0)+.025,z),point(.09,.05,.13),getMaterial('gravel_ballast'));
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
      earth(builder,mask,kind==='rail_crossing');
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
