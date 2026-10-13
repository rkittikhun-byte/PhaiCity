/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, OctahedronGeometry, InstancedBufferAttribute,
  InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { cityCoarseSurfaceMaterial, provinceEdgeMaterial, setProvinceMask } from '../materials/library.js';
import { mergeGeometry } from '../util/geometry.js';
import { LATERITE_EDGE, lateriteColour, lateriteShape } from '../models/road/laterite.js';
import { alongRoad, bends, clipTriangle, roadDistance, roadShape } from '../models/road/centreline.js';
import { ROAD_SECTION } from '../models/road/interfaces.js';
import { isRoad, isRail, isWaterNeighbor, isWoods, tileSeed, TileSnapshot } from './tileModels.js';
import { CityHeightField } from './heightfield.js';
import type { Placement } from './types.js';
const SIZE=32, matrix=new Matrix4(), color=new Color(), scratch=new Color();
type RoadPoint=readonly [number,number,number];
interface SurfaceChunk { x:number;y:number;group:Group;land:Mesh;trees:InstancedMesh;buildings:InstancedMesh;cursor:number;dirty:boolean;
  positions:number[];colors:number[];outside:number[];fade:number[];ground:number[];ranges:Map<number,[number,number]>;treeSlots:Map<number,number>;buildingSlots:Map<number,number>;
  publishedRanges:Map<number,[number,number]>;publishedTrees:Map<number,number>;publishedBuildings:Map<number,number>;
  foliageFade:number;
  treeCount:number;buildingCount:number;treeMatrices:Float32Array;buildingMatrices:Float32Array;treeOutside:Float32Array;buildingOutside:Float32Array;buildingColors:Float32Array }
function attributes(geometry:BufferGeometry,count:number,instanced=false):void {
  const attribute=instanced?InstancedBufferAttribute:Float32BufferAttribute;
  geometry.setAttribute('instanceDetail',new attribute(new Float32Array(count),1));
  geometry.setAttribute('cityOutside',new attribute(new Float32Array(count),1));
  geometry.setAttribute('cityGround',new attribute(new Float32Array(count),1));
  geometry.setAttribute('cityTerrain',new attribute(new Float32Array(count*4),4));
  geometry.setAttribute('cityBridgeDepth',new attribute(new Float32Array(count),1));
}
function treeGeometry():BufferGeometry {
  const crown=new OctahedronGeometry(1,0).scale(2.6,2.7,2.6).translate(0,3.5,0),vertices:number[]=[];
  for(let i=0;i<4;i++){const a=i*Math.PI/2,b=a+Math.PI/2;vertices.push(0,2,0,.3*Math.cos(b),0,.3*Math.sin(b),.3*Math.cos(a),0,.3*Math.sin(a));}
  const trunk=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));trunk.computeVertexNormals();
  for(const[g,c]of[[crown,0x6e985f],[trunk,0x796348]]as const)g.setAttribute('color',new Float32BufferAttribute(Array.from({length:g.getAttribute('position').count},()=>new Color(c).toArray()).flat(),3));
  const geometry=mergeGeometry([crown,trunk]);crown.dispose();trunk.dispose();return geometry;
}
/** Two-layer chunks: continuous ground and instanced silhouettes. Only crossed/visible chunks reach the GPU.
 * Initial 4-tile patches appear immediately; full-resolution tiles are filled in bounded paint slices.
 */
export class ProvinceSurface {
  readonly root=new Group();readonly chunks:SurfaceChunk[]=[];
  private edge:LineSegments2;private treeSource=treeGeometry();private boxSource=new BoxGeometry(1,1,1);
  private placements=new Map<number,Placement>();private detail=new Map<number,number>();private columns:number;
  private lastUpdate?:number;
  constructor(readonly snapshot:TileSnapshot,readonly terrain:CityHeightField) {
    this.boxSource.setAttribute('color',new Float32BufferAttribute(new Float32Array(this.boxSource.getAttribute('position').count*3).fill(1),3));
    this.columns=Math.ceil(snapshot.width/SIZE);
    // The shade outside the province and the edges of the water follow smooth curves drawn from these masks
    // (materials/library.ts)
    const outside=new Uint8Array(snapshot.width*snapshot.height),water=new Uint8Array(snapshot.width*snapshot.height);
    for(let y=0;y<snapshot.height;y++)for(let x=0;x<snapshot.width;x++){const i=y*snapshot.width+x;
      if(!terrain.inside(x,y))outside[i]=255;if(isWaterNeighbor(snapshot.values[i]))water[i]=255;}
    setProvinceMask(outside,snapshot.width,snapshot.height,water);
    const boundary=terrain.boundary(),edgeGeometry=new LineSegmentsGeometry();if(boundary.length)edgeGeometry.setPositions(boundary);
    this.edge=new LineSegments2(edgeGeometry,provinceEdgeMaterial());this.edge.visible=boundary.length>0;this.edge.renderOrder=20;this.edge.frustumCulled=false;this.root.add(this.edge);
    for(let y=0;y<snapshot.height;y+=SIZE)for(let x=0;x<snapshot.width;x+=SIZE){
      const group=new Group(),land=new Mesh(new BufferGeometry(),cityCoarseSurfaceMaterial());land.receiveShadow=true;
      const trees=new InstancedMesh(this.treeSource.clone(),cityCoarseSurfaceMaterial(),SIZE*SIZE);
      const buildings=new InstancedMesh(this.boxSource.clone(),cityCoarseSurfaceMaterial(),SIZE*SIZE);
      for(const mesh of[trees,buildings]){attributes(mesh.geometry,SIZE*SIZE,true);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;}
      group.add(land,trees,buildings);this.root.add(group);
      const chunk:SurfaceChunk={x,y,group,land,trees,buildings,cursor:0,dirty:true,positions:[],colors:[],outside:[],fade:[],ground:[],ranges:new Map(),treeSlots:new Map(),buildingSlots:new Map(),
        publishedRanges:new Map(),publishedTrees:new Map(),publishedBuildings:new Map(),foliageFade:0,treeCount:0,buildingCount:0,treeMatrices:new Float32Array(SIZE*SIZE*16),buildingMatrices:new Float32Array(SIZE*SIZE*16),treeOutside:new Float32Array(SIZE*SIZE),buildingOutside:new Float32Array(SIZE*SIZE),buildingColors:new Float32Array(SIZE*SIZE*3)};
      this.chunks.push(chunk);
      for(let yy=y;yy<Math.min(y+SIZE,snapshot.height);yy+=4)for(let xx=x;xx<Math.min(x+SIZE,snapshot.width);xx+=4)
        this.quad(chunk,xx*10,yy*10,Math.min(xx+4,snapshot.width)*10,Math.min(yy+4,snapshot.height)*10,()=>new Color(0xb49b71),(x,z)=>terrain.sample(x,z),yy*snapshot.width+xx,false);
      this.publish(chunk);this.resetBuffers(chunk);
    }
  }
  private resetBuffers(c:SurfaceChunk):void {c.positions=[];c.colors=[];c.outside=[];c.fade=[];c.ground=[];c.ranges=new Map();c.treeSlots=new Map();c.buildingSlots=new Map();c.treeCount=0;c.buildingCount=0;}
  private quad(c:SurfaceChunk,x0:number,z0:number,x1:number,z1:number,shade:(x:number,z:number)=>Color,height:(x:number,z:number)=>number,index:number,overlay:boolean):void {
    for(const[x,z]of[[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]){
      c.positions.push(x,height(x,z)+(overlay?.025:0),z);c.colors.push(...shade(x,z).toArray());
      const tx=Math.min(this.snapshot.width-1,Math.floor((x0+x1)/20)),ty=Math.min(this.snapshot.height-1,Math.floor((z0+z1)/20));
      c.outside.push(this.terrain.inside(tx,ty)?0:1);c.fade.push(overlay?this.detail.get(index)??0:0);c.ground.push(0);
    }
  }
  /** A tile's own ground colour: water, woods or open land, the land a little lighter or darker in 3-tile patches. */
  private tileShade(x:number,y:number,out:Color):Color {
    const v=this.snapshot.values[y*this.snapshot.width+x],wet=isWaterNeighbor(v);
    out.setHex(wet?0x487c89:isWoods(v)?0x88966b:0xb49b71);
    if(!wet)out.offsetHSL(0,0,(tileSeed(Math.floor(x/3),Math.floor(y/3))%9-4)*.006);
    return out;
  }
  /**
   * A corner shared by up to four tiles: their colours blended (only tiles as wet as this one, so shores stay clean) and
   * how much of it lies outside the province, 0–1. Blended corners turn the steps between woods, fields and the
   * province's edge into soft slopes (owner, 13 Oct 2026: "ยังมีเหลี่ยมๆ อยู่").
   */
  private corner(cx:number,cy:number,wet:boolean,out:Color):number {
    const {width:w,height:h,values}=this.snapshot;let r=0,g=0,b=0,n=0,outside=0,tiles=0;
    for(let y=cy-1;y<=cy;y++)for(let x=cx-1;x<=cx;x++){
      if(x<0||y<0||x>=w||y>=h)continue;tiles++;if(!this.terrain.inside(x,y))outside++;
      if(isWaterNeighbor(values[y*w+x])!==wet)continue;this.tileShade(x,y,scratch);r+=scratch.r;g+=scratch.g;b+=scratch.b;n++;
    }
    if(n)out.setRGB(r/n,g/n,b/n);return tiles?outside/tiles:0;
  }
  /** A tile's ground: four triangles round its centre, the centre in the tile's own colour, the corners blended. */
  private ground(c:SurfaceChunk,x:number,y:number,wet:boolean,height:(x:number,z:number)=>number):void {
    const own=this.tileShade(x,y,new Color()),ownOutside=this.terrain.inside(x,y)?0:1,cx=(x+.5)*10,cz=(y+.5)*10;
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([px,py])=>{
      const shade=own.clone(),outside=this.corner(px,py,wet,shade);return{x:px*10,z:py*10,shade,outside};});
    for(let k=0;k<4;k++){const a=corners[k],b=corners[(k+1)%4];
      for(const p of[{x:cx,z:cz,shade:own,outside:ownOutside},b,a]){
        c.positions.push(p.x,height(p.x,p.z),p.z);c.colors.push(p.shade.r,p.shade.g,p.shade.b);c.outside.push(p.outside);c.fade.push(0);c.ground.push(1);}}
  }
  /**
   * A road tile's paint over the ground: 2.5 m squares coloured by the distance to the tile's centre lines and cut
   * where the road ends along them, so turns and staircases read as curves and diagonals from afar as well as close
   * up (models/road/centreline.ts). Laterite stops at its verge; asphalt fills the tile with its pavements unless it bends.
   */
  private road(c:SurfaceChunk,x:number,y:number,i:number,mask:number,level:number,bridge:boolean,height:(x:number,z:number)=>number):void {
    const laterite=level===1&&!bridge,steps=bridge?0:this.snapshot.staircase(x,y),diagonal=steps&15;
    const shape=laterite?lateriteShape(mask,diagonal,steps>>4):roadShape(mask,diagonal,false,steps>>4);
    const edge=bridge?Infinity:laterite?LATERITE_EDGE:bends(mask,diagonal,false)?ROAD_SECTION.carriageway/2:Infinity;
    const cx=(x+.5)*10,cz=(y+.5)*10,outside=this.terrain.inside(x,y)?0:1,fade=this.detail.get(i)??0;
    const at=(px:number,pz:number):RoadPoint=>[px,pz,roadDistance(px-cx,pz-cz,shape)];
    const between=(a:RoadPoint,b:RoadPoint,t:number):RoadPoint=>at(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
    const points=Array.from({length:25},(_,n)=>at(x*10+n%5*2.5,y*10+Math.floor(n/5)*2.5)),p=(dx:number,dy:number):RoadPoint=>points[dy*5+dx];
    // Squares split across the ground's own fold would dip into a hollow tile by up to an eighth of its twist.
    const t=this.terrain,twist=bridge?0:t.corner(x+1,y)+t.corner(x,y+1)-t.corner(x,y)-t.corner(x+1,y+1),lift=.025+Math.max(0,twist)/8;
    for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)for(const triangle of alongRoad(p(dx,dy),p(dx+1,dy),p(dx,dy+1),p(dx+1,dy+1)))
      for(const piece of clipTriangle(triangle,q=>q[2]-edge,between))for(const[px,pz,d]of piece){
        c.positions.push(px,height(px,pz)+lift,pz);
        c.colors.push(...(bridge?scratch.setHex(0xa6a196):laterite?lateriteColour(d):scratch.setHex(d>ROAD_SECTION.carriageway/2?0xa39c8f:0x555959)).toArray());
        c.outside.push(outside);c.fade.push(fade);c.ground.push(0);
      }
  }
  private cell(c:SurfaceChunk,n:number):void {
    const x=c.x+n%SIZE,y=c.y+Math.floor(n/SIZE),{width:w,height:h,values}=this.snapshot;if(x>=w||y>=h)return;
    const i=y*w+x,v=values[i],outside=!this.terrain.inside(x,y),wet=isWaterNeighbor(v),woods=isWoods(v);
    const ground=wet?this.terrain.water[i]:undefined;
    this.ground(c,x,y,wet,(xx,zz)=>wet?ground!:this.terrain.sampleTile(x,y,xx,zz));
    for(const[x0,z0,top0,bottom0,x1,z1,top1,bottom1]of this.terrain.walls(x,y)){
      const vertices=[[x0,top0,z0],[x0,bottom0,z0],[x1,bottom1,z1],[x1,top1,z1]];
      for(const n of[0,2,1,0,3,2]){c.positions.push(...vertices[n]);c.colors.push(...new Color(0x9c927e).toArray());c.outside.push(outside?1:0);c.fade.push(0);c.ground.push(0);}
    }
    const p=this.placements.get(i)??this.snapshot.placement(i,'central');
    if(p){p.baseY=this.terrain.base(i);p.outside=outside;}
    if(isRoad(v)||isRail(v)){
      const start=c.fade.length,mask=this.snapshot.mask(x,y,isRoad(v)?isRoad:isRail),bridge=wet;
      const height=(xx:number,zz:number)=>bridge?this.terrain.base(i):this.terrain.sampleTile(x,y,xx,zz);
      if(isRoad(v)){
        const level=typeof this.snapshot.roadLevel==='function'?this.snapshot.roadLevel(x,y):this.snapshot.roadLevel;
        this.road(c,x,y,i,mask,level,bridge,height);
      }else{
        const cx=(x+.5)*10,cz=(y+.5)*10;
        for(const[bit,dx,dz]of[[1,0,-1],[2,1,0],[4,0,1],[8,-1,0]])if(mask&bit||mask===0&&bit===1){
          const x0=dx?Math.min(cx,cx+dx*5):cx-1.6,x1=dx?Math.max(cx,cx+dx*5):cx+1.6,z0=dz?Math.min(cz,cz+dz*5):cz-1.6,z1=dz?Math.max(cz,cz+dz*5):cz+1.6;
          this.quad(c,x0,z0,x1,z1,()=>new Color(0x8f472a),height,i,true);
          for(const side of[-1,1])this.quad(c,dx?x0:cx+side*.5-.055,dz?z0:cz+side*.5-.055,dx?x1:cx+side*.5+.055,dz?z1:cz+side*.5+.055,()=>new Color(0x969f99),(xx,zz)=>height(xx,zz)+.15,i,true);
        }
      }
      c.ranges.set(i,[start,c.fade.length]);
    }
    if(woods&&(!outside||tileSeed(x,y)%2===0)){
      // Trees wander over most of their tile, so the woods' edge does not line up with the tiles
      const slot=c.treeCount++;c.treeSlots.set(i,slot);const seed=tileSeed(x,y),scale=.75+seed%7*.07;
      const tx=(x+.5)*10+((seed>>>8)%101/100-.5)*7,tz=(y+.5)*10+((seed>>>16)%101/100-.5)*7;
      matrix.makeScale(scale,scale,scale).setPosition(tx,this.terrain.sample(tx,tz),tz);c.treeMatrices.set(matrix.elements,slot*16);
      c.treeOutside[slot]=outside?1:0;
    }else if(p&&p.id&&p.id!=='terrain.dirt'&&!woods&&!wet&&!isRoad(v)&&!isRail(v)&&p.kind!=='power'&&p.kind!=='shore'){
      const slot=c.buildingCount++;c.buildingSlots.set(i,slot);const height=Math.max(.2,p.height);
      matrix.makeScale(p.footprint[0]*10-.8,height,p.footprint[1]*10-.8).setPosition(p.x,(p.baseY??0)+height/2,p.z);c.buildingMatrices.set(matrix.elements,slot*16);color.setHex(p.color).toArray(c.buildingColors,slot*3);
      c.buildingOutside[slot]=outside?1:0;
    }
  }
  private publish(c:SurfaceChunk):void {
    for(const[i,[start,end]]of c.ranges)for(let n=start;n<end;n++)c.fade[n]=this.detail.get(i)??0;
    const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(c.positions,3)).setAttribute('color',new Float32BufferAttribute(c.colors,3));
    attributes(geometry,c.outside.length);geometry.setAttribute('cityOutside',new Float32BufferAttribute(c.outside,1));geometry.setAttribute('instanceDetail',new Float32BufferAttribute(c.fade,1));geometry.setAttribute('cityGround',new Float32BufferAttribute(c.ground,1));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();c.land.geometry.dispose();c.land.geometry=geometry;
    c.trees.count=c.treeCount;c.buildings.count=c.buildingCount;
    (c.trees.instanceMatrix.array as Float32Array).set(c.treeMatrices);(c.buildings.instanceMatrix.array as Float32Array).set(c.buildingMatrices);
    c.buildings.instanceColor=new InstancedBufferAttribute(c.buildingColors.slice(),3);
    (c.trees.geometry.getAttribute('cityOutside').array as Float32Array).set(c.treeOutside);(c.buildings.geometry.getAttribute('cityOutside').array as Float32Array).set(c.buildingOutside);
    c.publishedRanges=c.ranges;c.publishedTrees=c.treeSlots;c.publishedBuildings=c.buildingSlots;
    for(const[mesh,slots]of[[c.trees,c.publishedTrees],[c.buildings,c.publishedBuildings]]as const){const a=mesh.geometry.getAttribute('instanceDetail');for(const[i,slot]of slots)a.setX(slot,Math.max(this.detail.get(i)??0,mesh===c.trees?c.foliageFade:0));a.needsUpdate=true;}
    for(const m of[c.trees,c.buildings]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;
      m.geometry.getAttribute('cityOutside').needsUpdate=true;m.computeBoundingSphere();}
  }
  set(index:number,p:Placement|null):void {if(p){p.baseY=this.terrain.base(index);p.outside=!this.terrain.inside(index%this.snapshot.width,Math.floor(index/this.snapshot.width));this.placements.set(index,p);}else this.placements.delete(index);}
  dirty(indices:readonly number[]):void {
    if(!indices.length)return;
    const affected=new Set<SurfaceChunk>();
    for(const i of indices){const x=i%this.snapshot.width,y=Math.floor(i/this.snapshot.width);
      for(let yy=Math.floor(Math.max(0,y-6)/SIZE);yy<=Math.floor(Math.min(this.snapshot.height-1,y+6)/SIZE);yy++)
        for(let xx=Math.floor(Math.max(0,x-6)/SIZE);xx<=Math.floor(Math.min(this.snapshot.width-1,x+6)/SIZE);xx++)affected.add(this.chunks[yy*this.columns+xx]);}
    // Keep the previous GPU buffers visible until the complete replacement is ready.
    for(const c of affected){c.dirty=true;c.cursor=0;this.resetBuffers(c);}
    this.edge.geometry.dispose();const boundary=this.terrain.boundary();this.edge.geometry=new LineSegmentsGeometry();if(boundary.length)this.edge.geometry.setPositions(boundary);this.edge.visible=boundary.length>0;
  }
  update(target:Vector3,distance:number,now:()=>number,deadline:number):void {
    const time=now(),dt=Math.max(0,Math.min(100,time-(this.lastUpdate??time-16)));this.lastUpdate=time;
    const dirty=this.chunks.filter(c=>c.dirty).sort((a,b)=>Math.hypot(a.x*10+160-target.x,a.y*10+160-target.z)-Math.hypot(b.x*10+160-target.x,b.y*10+160-target.z));
    for(const c of dirty){while(c.cursor<SIZE*SIZE&&now()<deadline)this.cell(c,c.cursor++);
      if(c.cursor===SIZE*SIZE){this.publish(c);c.dirty=false;}if(now()>=deadline)break;}
    for(const c of this.chunks){const range=Math.hypot(c.x*10+160-target.x,c.y*10+160-target.z);
      const wanted=Math.max(0,Math.min(1,Math.max((distance-1400)/400,(range-800)/250)));
      const fade=c.foliageFade+Math.max(-dt/350,Math.min(dt/350,wanted-c.foliageFade));
      if(fade!==c.foliageFade){c.foliageFade=fade;const a=c.trees.geometry.getAttribute('instanceDetail');(a.array as Float32Array).fill(fade);a.needsUpdate=true;}
      c.trees.visible=fade<1;
    }
  }
  fade(index:number,fade:number):void {
    this.detail.set(index,fade);const x=index%this.snapshot.width,y=Math.floor(index/this.snapshot.width),c=this.chunks[Math.floor(y/SIZE)*this.columns+Math.floor(x/SIZE)];
    for(const[mesh,slots]of[[c.trees,c.publishedTrees],[c.buildings,c.publishedBuildings]]as const){const slot=slots.get(index);if(slot!==undefined){mesh.geometry.getAttribute('instanceDetail').setX(slot,Math.max(fade,mesh===c.trees?c.foliageFade:0));mesh.geometry.getAttribute('instanceDetail').needsUpdate=true;}}
    const range=c.publishedRanges.get(index);if(range){const attr=c.land.geometry.getAttribute('instanceDetail');for(let i=range[0];i<range[1];i++)attr.setX(i,fade);attr.needsUpdate=true;}
  }
  get pending():number{return this.chunks.filter(c=>c.dirty).length;}
  finish():void {for(const c of this.chunks)if(c.dirty){while(c.cursor<SIZE*SIZE)this.cell(c,c.cursor++);this.publish(c);c.dirty=false;}}
  dispose():void {for(const c of this.chunks){c.land.geometry.dispose();for(const m of[c.trees,c.buildings]){m.geometry.dispose();m.dispose();}}this.edge.geometry.dispose();this.treeSource.dispose();this.boxSource.dispose();this.root.clear();this.placements.clear();this.detail.clear();}
}
