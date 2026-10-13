/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, OctahedronGeometry, InstancedBufferAttribute,
  InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { cityCoarseSurfaceMaterial, provinceEdgeMaterial } from '../materials/library.js';
import { mergeGeometry } from '../util/geometry.js';
import { lateriteColour, lateriteDistance } from '../models/road/laterite.js';
import { isRoad, isRail, isWaterNeighbor, isWoods, tileSeed, TileSnapshot } from './tileModels.js';
import { CityHeightField } from './heightfield.js';
import type { Placement } from './types.js';
const SIZE=32, matrix=new Matrix4(), color=new Color();
interface SurfaceChunk { x:number;y:number;group:Group;land:Mesh;trees:InstancedMesh;buildings:InstancedMesh;cursor:number;dirty:boolean;
  positions:number[];colors:number[];outside:number[];fade:number[];ranges:Map<number,[number,number]>;treeSlots:Map<number,number>;buildingSlots:Map<number,number>;
  publishedRanges:Map<number,[number,number]>;publishedTrees:Map<number,number>;publishedBuildings:Map<number,number>;
  foliageFade:number;
  treeCount:number;buildingCount:number;treeMatrices:Float32Array;buildingMatrices:Float32Array;treeOutside:Float32Array;buildingOutside:Float32Array;buildingColors:Float32Array }
function attributes(geometry:BufferGeometry,count:number,instanced=false):void {
  const attribute=instanced?InstancedBufferAttribute:Float32BufferAttribute;
  geometry.setAttribute('instanceDetail',new attribute(new Float32Array(count),1));
  geometry.setAttribute('cityOutside',new attribute(new Float32Array(count),1));
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
    const boundary=terrain.boundary(),edgeGeometry=new LineSegmentsGeometry();if(boundary.length)edgeGeometry.setPositions(boundary);
    this.edge=new LineSegments2(edgeGeometry,provinceEdgeMaterial());this.edge.visible=boundary.length>0;this.edge.renderOrder=20;this.edge.frustumCulled=false;this.root.add(this.edge);
    for(let y=0;y<snapshot.height;y+=SIZE)for(let x=0;x<snapshot.width;x+=SIZE){
      const group=new Group(),land=new Mesh(new BufferGeometry(),cityCoarseSurfaceMaterial());land.receiveShadow=true;
      const trees=new InstancedMesh(this.treeSource.clone(),cityCoarseSurfaceMaterial(),SIZE*SIZE);
      const buildings=new InstancedMesh(this.boxSource.clone(),cityCoarseSurfaceMaterial(),SIZE*SIZE);
      for(const mesh of[trees,buildings]){attributes(mesh.geometry,SIZE*SIZE,true);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;}
      group.add(land,trees,buildings);this.root.add(group);
      const chunk:SurfaceChunk={x,y,group,land,trees,buildings,cursor:0,dirty:true,positions:[],colors:[],outside:[],fade:[],ranges:new Map(),treeSlots:new Map(),buildingSlots:new Map(),
        publishedRanges:new Map(),publishedTrees:new Map(),publishedBuildings:new Map(),foliageFade:0,treeCount:0,buildingCount:0,treeMatrices:new Float32Array(SIZE*SIZE*16),buildingMatrices:new Float32Array(SIZE*SIZE*16),treeOutside:new Float32Array(SIZE*SIZE),buildingOutside:new Float32Array(SIZE*SIZE),buildingColors:new Float32Array(SIZE*SIZE*3)};
      this.chunks.push(chunk);
      for(let yy=y;yy<Math.min(y+SIZE,snapshot.height);yy+=4)for(let xx=x;xx<Math.min(x+SIZE,snapshot.width);xx+=4)
        this.quad(chunk,xx*10,yy*10,Math.min(xx+4,snapshot.width)*10,Math.min(yy+4,snapshot.height)*10,()=>new Color(0xb49b71),(x,z)=>terrain.sample(x,z),yy*snapshot.width+xx,false);
      this.publish(chunk);this.resetBuffers(chunk);
    }
  }
  private resetBuffers(c:SurfaceChunk):void {c.positions=[];c.colors=[];c.outside=[];c.fade=[];c.ranges=new Map();c.treeSlots=new Map();c.buildingSlots=new Map();c.treeCount=0;c.buildingCount=0;}
  private quad(c:SurfaceChunk,x0:number,z0:number,x1:number,z1:number,shade:(x:number,z:number)=>Color,height:(x:number,z:number)=>number,index:number,overlay:boolean):void {
    for(const[x,z]of[[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]){
      c.positions.push(x,height(x,z)+(overlay?.025:0),z);c.colors.push(...shade(x,z).toArray());
      const tx=Math.min(this.snapshot.width-1,Math.floor((x0+x1)/20)),ty=Math.min(this.snapshot.height-1,Math.floor((z0+z1)/20));
      c.outside.push(this.terrain.inside(tx,ty)?0:1);c.fade.push(overlay?this.detail.get(index)??0:0);
    }
  }
  private cell(c:SurfaceChunk,n:number):void {
    const x=c.x+n%SIZE,y=c.y+Math.floor(n/SIZE),{width:w,height:h,values}=this.snapshot;if(x>=w||y>=h)return;
    const i=y*w+x,v=values[i],outside=!this.terrain.inside(x,y),wet=isWaterNeighbor(v),woods=isWoods(v);
    const ground=wet?this.terrain.water[i]:undefined;
    const shade=new Color(wet?0x487c89:woods?0x88966b:0xb49b71);
    if(!wet){const variation=(tileSeed(Math.floor(x/3),Math.floor(y/3))%9-4)*.006;shade.offsetHSL(0,0,variation);}
    this.quad(c,x*10,y*10,(x+1)*10,(y+1)*10,()=>shade,(xx,zz)=>wet?ground!:this.terrain.sampleTile(x,y,xx,zz),i,false);
    for(const[x0,z0,top0,bottom0,x1,z1,top1,bottom1]of this.terrain.walls(x,y)){
      const vertices=[[x0,top0,z0],[x0,bottom0,z0],[x1,bottom1,z1],[x1,top1,z1]];
      for(const n of[0,2,1,0,3,2]){c.positions.push(...vertices[n]);c.colors.push(...new Color(0x9c927e).toArray());c.outside.push(outside?1:0);c.fade.push(0);}
    }
    const p=this.placements.get(i)??this.snapshot.placement(i,'central');
    if(p){p.baseY=this.terrain.base(i);p.outside=outside;}
    if(isRoad(v)||isRail(v)){
      const start=c.fade.length,mask=this.snapshot.mask(x,y,isRoad(v)?isRoad:isRail),bridge=wet;
      const height=(xx:number,zz:number)=>bridge?this.terrain.base(i):this.terrain.sampleTile(x,y,xx,zz);
      if(isRoad(v)){
        const level=typeof this.snapshot.roadLevel==='function'?this.snapshot.roadLevel(x,y):this.snapshot.roadLevel;
        for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)this.quad(c,x*10+dx*2.5,y*10+dy*2.5,x*10+(dx+1)*2.5,y*10+(dy+1)*2.5,
          (xx,zz)=>bridge?new Color(0xa6a196):level===1?lateriteColour(lateriteDistance(xx-(x+.5)*10,zz-(y+.5)*10,mask)):new Color(0x555959),height,i,true);
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
      const slot=c.treeCount++;c.treeSlots.set(i,slot);const seed=tileSeed(x,y),scale=.8+seed%5*.08;
      const tx=(x+.5)*10+((seed>>>8)%101/100-.5)*3,tz=(y+.5)*10+((seed>>>16)%101/100-.5)*3;
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
    attributes(geometry,c.outside.length);geometry.setAttribute('cityOutside',new Float32BufferAttribute(c.outside,1));geometry.setAttribute('instanceDetail',new Float32BufferAttribute(c.fade,1));
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
