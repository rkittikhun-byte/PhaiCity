/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Vector3 } from 'three';
import { cityLODDepthMaterial, cityLODMaterial, cityWorldMaterial, getMaterial, getPreviewGround } from '../materials/library.js';
import { CHUNK_TILES, Placement } from './types.js';
import { TileSnapshot, prototypeKey } from './tileModels.js';
import { decodePrototype, Prototype, PrototypeProvider } from './prototypes.js';
import type { RegionId } from '../regional/types.js';
import type { TileRect } from '../../cityView.js';
import type { CityHeightField } from './heightfield.js';
import { ProvinceSurface } from './province-surface.js';
interface Batch { group:Group; placements:Placement[]; key:string; calls:number; selected:boolean;fade:number }
interface Chunk {id:number;x:number;y:number;cursor:number;dirty:boolean;placements:Placement[];batches:Batch[];version:number}
const zero=new Matrix4().makeScale(0,0,0),matrix=new Matrix4(),color=new Color();
export class CityChunks {
  readonly root=new Group();readonly solid:InstancedMesh;readonly water:InstancedMesh;readonly ground:InstancedMesh;
  readonly chunks:Chunk[]=[];readonly prototypes=new Map<string,Prototype>();
  private requested=new Set<string>();private failed=new Set<string>();
  private readonly geometry=new BoxGeometry(1,1,1);private coarseDirty=false;private fadeDirty=false;
  private readonly groundGeometry=new PlaneGeometry(1,1).rotateX(-Math.PI/2);
  private coarse=new Map<number,Placement>();private hidden=new Set<number>();
  private solidSlots:Int32Array;private waterSlots:Int32Array;private freeSolid:number[]=[];private freeWater:number[]=[];
  private solidDetail:InstancedBufferAttribute;private waterDetail:InstancedBufferAttribute;private waterGeometry:BoxGeometry;
  private lastUpdate:number;
  readonly columns:number;unknownTiles=0;rebuildMs=0;detailCalls=0;
  drawBudget=180;detailSwaps=0;dirtSwaps=0;
  readonly surfaces?:ProvinceSurface;
  constructor(readonly snapshot:TileSnapshot,readonly region:RegionId,private provider:PrototypeProvider,private now:()=>number,readonly terrain?:CityHeightField) {
    const n=snapshot.width*snapshot.height;this.columns=Math.ceil(snapshot.width/CHUNK_TILES);
    this.lastUpdate=this.now();this.waterGeometry=this.geometry.clone();
    this.solidDetail=new InstancedBufferAttribute(new Float32Array(n),1).setUsage(DynamicDrawUsage);
    this.waterDetail=new InstancedBufferAttribute(new Float32Array(n),1).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('instanceDetail',this.solidDetail);this.waterGeometry.setAttribute('instanceDetail',this.waterDetail);
    for(const geometry of[this.geometry,this.waterGeometry]){geometry.setAttribute('cityOutside',new InstancedBufferAttribute(new Float32Array(n),1));geometry.setAttribute('cityTerrain',new InstancedBufferAttribute(new Float32Array(n*4),4));geometry.setAttribute('cityBridgeDepth',new InstancedBufferAttribute(new Float32Array(n),1));}
    this.solidSlots=new Int32Array(n).fill(-1);this.waterSlots=new Int32Array(n).fill(-1);
    this.solid=new InstancedMesh(this.geometry,cityLODMaterial(getPreviewGround(),true),n);this.water=new InstancedMesh(this.waterGeometry,cityLODMaterial(getMaterial('water_river'),true),n);
    this.ground=new InstancedMesh(this.groundGeometry,cityWorldMaterial(getMaterial('dirt_laterite')),n);
    this.solid.count=0;this.water.count=0;
    for(const mesh of [this.solid,this.water,this.ground]){mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=true;if(!terrain?.province)this.root.add(mesh);}
    if(terrain?.province){this.surfaces=new ProvinceSurface(snapshot,terrain);this.root.add(this.surfaces.root);this.drawBudget=this.maxDrawBudget;}
    // Cheap complete ground is available before a single detailed model is built.
    for(let i=0;i<n;i++) {const x=i%snapshot.width,y=Math.floor(i/snapshot.width),water=snapshot.values[i]>=2&&snapshot.values[i]<=20;
      matrix.makeScale(10,.06,10).setPosition((x+.5)*10,water?-.63:.01,(y+.5)*10);
      if(water){const slot=this.water.count++;this.waterSlots[i]=slot;this.water.setMatrixAt(slot,matrix);}
      matrix.makeScale(10,1,10).setPosition((x+.5)*10,-.025,(y+.5)*10);this.ground.setMatrixAt(i,water?zero:matrix);
    }
    for(let y=0;y<snapshot.height;y+=CHUNK_TILES)for(let x=0;x<snapshot.width;x+=CHUNK_TILES)
      this.chunks.push({id:this.chunks.length,x,y,cursor:0,dirty:true,placements:[],batches:[],version:0});
  }
  dirty(indices:readonly number[]):void {
    this.surfaces?.dirty(indices);
    const ids=new Set<number>();
    for(const i of indices){const x=i%this.snapshot.width,y=Math.floor(i/this.snapshot.width);
      // Neighbour masks and old/new building footprints can straddle chunk boundaries.
      for(let cy=Math.floor(Math.max(0,y-6)/16);cy<=Math.floor(Math.min(this.snapshot.height-1,y+6)/16);cy++)
        for(let cx=Math.floor(Math.max(0,x-6)/16);cx<=Math.floor(Math.min(this.snapshot.width-1,x+6)/16);cx++)ids.add(cy*this.columns+cx);
    }
    for(const id of ids){const chunk=this.chunks[id];chunk.dirty=true;chunk.cursor=0;chunk.placements=[];chunk.version++;this.clear(chunk);}
  }
  private coarseMatrix(p:Placement):Matrix4 {
    const zone=p.footprint[0]>1, height=zone?(this.prototypes.get(prototypeKey(p))?.height??p.height):p.id?.startsWith('plot.')?p.height:p.kind==='veg'?1:p.id==='terrain.woods'?5:p.water?.06:Math.max(.06,p.kind==='debug'?4:.12);
    // Water lies a little under the ground; everything else is the placement's own box (placement.ts)
    return p.water?matrix.makeScale(p.footprint[0]*10,height,p.footprint[1]*10).setPosition(p.x,(p.baseY??0)-.63,p.z):p.farBox(matrix,height,zone?1:0);
  }
  private setCoarse(index:number,p:Placement|null):void {
    this.surfaces?.set(index,p);
    if(this.coarse.get(index)?.kind==='debug')this.unknownTiles--;
    if(p?.kind==='debug')this.unknownTiles++;
    this.hidden.delete(index);this.coarse.delete(index);
    const active=p&&p.id!=='terrain.dirt';
    const bridge=p?.id?.endsWith('bridge');
    for(const [mesh,slots,free,needed]of [[this.solid,this.solidSlots,this.freeSolid,active&&!p?.water],[this.water,this.waterSlots,this.freeWater,active&&(p?.water||bridge)]] as const){
      if(!needed&&slots[index]>=0){mesh.setMatrixAt(slots[index],zero);free.push(slots[index]);slots[index]=-1;}
    }
    if(p){this.coarse.set(index,p);if(active){const mesh=p.water?this.water:this.solid,slots=p.water?this.waterSlots:this.solidSlots,free=p.water?this.freeWater:this.freeSolid;
      if(slots[index]<0)slots[index]=free.pop()??mesh.count++;
      const slot=slots[index];(p.water?this.waterDetail:this.solidDetail).setX(slot,0);mesh.setMatrixAt(slot,this.coarseMatrix(p));if(!p.water)this.solid.setColorAt(slot,color.setHex(p.color));}}
    if(p&&bridge){if(this.waterSlots[index]<0)this.waterSlots[index]=this.freeWater.pop()??this.water.count++;
      matrix.makeScale(10,.06,10).setPosition(p.x,-.63,p.z);this.water.setMatrixAt(this.waterSlots[index],matrix);this.waterDetail.setX(this.waterSlots[index],0);}
    this.coarseDirty=true;
  }
  private clear(chunk:Chunk):void {
    for(const batch of chunk.batches){for(const p of batch.placements){this.showCoarse(p,true);this.coarseFade(p,0);}batch.group.traverse(n=>{if(n instanceof InstancedMesh){n.geometry.dispose();n.dispose();}});this.root.remove(batch.group);}
    chunk.batches=[];
  }
  private showCoarse(p:Placement,show:boolean):void {
    if(show===!this.hidden.has(p.index))return;
    const slot=(p.water?this.waterSlots:this.solidSlots)[p.index];
    if(slot>=0)(p.water?this.water:this.solid).setMatrixAt(slot,show?this.coarseMatrix(p):zero);
    if(show)this.hidden.delete(p.index);else this.hidden.add(p.index);this.coarseDirty=true;
  }
  private coarseFade(p:Placement,fade:number):void {
    this.surfaces?.fade(p.index,fade);
    const slot=(p.water?this.waterSlots:this.solidSlots)[p.index];
    if(slot>=0){(p.water?this.waterDetail:this.solidDetail).setX(slot,fade);this.fadeDirty=true;}
  }
  private finish(chunk:Chunk):void {
    const groups=new Map<string,Placement[]>();
    for(const p of chunk.placements)if(p.id){const key=prototypeKey(p),g=groups.get(key)??[];g.push(p);groups.set(key,g);}
    chunk.batches=Array.from(groups,([key,placements])=>({key,placements,group:new Group(),calls:0,selected:false,fade:0}));
    chunk.batches.forEach(b=>{b.group.visible=false;this.root.add(b.group);});chunk.dirty=false;
  }
  private cell(chunk:Chunk,n:number):void {
    const x=chunk.x+n%16,y=chunk.y+Math.floor(n/16);if(x>=this.snapshot.width||y>=this.snapshot.height)return;
    const i=y*this.snapshot.width+x,p=this.snapshot.placement(i,this.region);this.setCoarse(i,p);if(p)chunk.placements.push(p);
    const v=this.snapshot.values[i],wet=v>=2&&v<=20||v===64||v===65||v===224||v===225||v===208||v===209||v>=828&&v<=832||v>=948&&v<=951;
    matrix.makeScale(10,1,10).setPosition((x+.5)*10,-.025,(y+.5)*10);this.ground.setMatrixAt(i,wet?zero:matrix);
  }
  finishMapLOD():void {
    for(const chunk of this.chunks)if(chunk.dirty){while(chunk.cursor<256)this.cell(chunk,chunk.cursor++);this.finish(chunk);}
    this.solid.instanceMatrix.needsUpdate=true;this.water.instanceMatrix.needsUpdate=true;this.ground.instanceMatrix.needsUpdate=true;
    if(this.solid.instanceColor)this.solid.instanceColor.needsUpdate=true;
    this.surfaces?.finish();
  }
  private instantiate(batch:Batch,prototype:Prototype):void {
    for(const part of prototype.parts){
      // Dirt uses the same continuous ground at every distance; only grass and stones change detail.
      if((batch.placements[0].id==='terrain.dirt'||this.surfaces)&&part.ground)continue;
      const geometry=part.geometry.clone(),count=batch.placements.length;
      const province=new InstancedBufferAttribute(new Float32Array(count),1),slopes=new InstancedBufferAttribute(new Float32Array(count*4),4),bridgeDepth=new InstancedBufferAttribute(new Float32Array(count),1);
      geometry.setAttribute('cityOutside',province);geometry.setAttribute('cityTerrain',slopes);geometry.setAttribute('cityBridgeDepth',bridgeDepth);
      const mesh=new InstancedMesh(geometry,cityLODMaterial(part.material),count);mesh.customDepthMaterial=cityLODDepthMaterial(mesh.material as typeof part.material);
      mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(batch.placements.length*3).fill(1),3).setUsage(DynamicDrawUsage);
      for(let i=0;i<batch.placements.length;i++)mesh.instanceColor.setX(i,batch.fade);
      mesh.castShadow=part.castShadow??true;mesh.receiveShadow=part.receiveShadow??true;
      for(let i=0;i<batch.placements.length;i++){const p=batch.placements[i],base=p.baseY??0;p.modelMatrix(matrix);mesh.setMatrixAt(i,matrix);
        province.setX(i,p.outside?1:0);
        if(this.terrain?.enabled&&isBridge(p)&&Number.isFinite(this.terrain.water[p.index]))bridgeDepth.setX(i,Math.max(0,base-this.terrain.water[p.index]));
        if(this.terrain?.enabled&&(p.kind==='road'||p.kind==='rail'||p.id==='terrain.dirt')&&!isBridge(p)){
          const x=Math.floor(p.x/10),y=Math.floor(p.z/10);slopes.setXYZW(i,this.terrain.corner(x,y)-base,this.terrain.corner(x+1,y)-base,this.terrain.corner(x,y+1)-base,this.terrain.corner(x+1,y+1)-base);
        }
      }
      mesh.computeBoundingSphere();if(mesh.boundingSphere){let extent=0;for(const value of slopes.array)extent=Math.max(extent,Math.abs(value));for(const value of bridgeDepth.array)extent=Math.max(extent,value);mesh.boundingSphere.radius+=extent;}
      batch.group.add(mesh);
    }batch.calls=batch.group.children.length;
  }
  update(visible:TileRect|null,target:Vector3,distance:number):void {
    // Reserve one millisecond of the four-millisecond slice for batch selection / GPU buffer handoff.
    const start=this.now(),deadline=start+3,coarseDeadline=this.surfaces?start+1:deadline;
    const priority=(c:Chunk):number=>{const inView=visible&&c.x<=visible.x1&&c.x+16>visible.x0&&c.y<=visible.y1&&c.y+16>visible.y0;
      return Math.hypot(c.x*10+80-target.x,c.y*10+80-target.z)+(inView?0:100000);};
    const work=this.chunks.filter(c=>c.dirty).sort((a,b)=>priority(a)-priority(b));
    for(const chunk of work){while(chunk.cursor<256&&this.now()<coarseDeadline)this.cell(chunk,chunk.cursor++);
      if(chunk.cursor===256)this.finish(chunk);if(this.now()>=coarseDeadline)break;}
    // Province terrain and worker handoff each get a slice while distant chunks are still being built.
    this.surfaces?.update(target,distance,this.now,start+2);
    // Decode small transferred buffers incrementally; heavy factories never run on the UI thread.
    this.pendingResults.push(...this.provider.take());
    while(this.pendingResults.length&&this.now()<deadline){const result=this.pendingResults.shift()!;
      if(result.error){this.failed.add(result.key);console.warn('City model skipped:',result.key,result.error);}
      else try {
        this.prototypes.set(result.key,decodePrototype(result));
        for(const chunk of this.chunks)for(const batch of chunk.batches)if(batch.key===result.key&&batch.fade===0)
          for(const p of batch.placements){const slot=(p.water?this.waterSlots:this.solidSlots)[p.index];if(slot>=0)(p.water?this.water:this.solid).setMatrixAt(slot,this.coarseMatrix(p));}
        this.coarseDirty=true;
      } catch(error){this.failed.add(result.key);console.warn('City model skipped:',result.key,String(error));}
    }
    const radius=Math.min(230,Math.max(85,distance*.55)),margin=25;
    const nearby=this.chunks.filter(c=>Math.abs(c.x*10+80-target.x)<radius+margin+114&&Math.abs(c.y*10+80-target.z)<radius+margin+114);
    const candidates=nearby.flatMap(c=>c.batches).map(b=>{let range=Infinity;for(const p of b.placements)range=Math.min(range,Math.hypot(p.x-target.x,p.z-target.z));return{b,range};});
    const rank=(p:Placement):number=>p.footprint[0]>1?-180:p.kind==='road'&&(p.id?.includes('crossing')||p.id?.includes('bridge'))?-150:p.kind==='road'||p.kind==='rail'||p.kind==='power'?-95:p.id==='terrain.woods'?-40:0;
    // An incumbent keeps its place until a challenger is at least 25 m closer (with the same model priority).
    candidates.sort((a,b)=>a.range+rank(a.b.placements[0])-(a.b.selected?margin:0)
      -b.range-rank(b.b.placements[0])+(b.b.selected?margin:0));
    const preferred=new Set<Batch>();let preferredCalls=0;
    for(const{b,range}of candidates){
      if(this.surfaces&&(b.placements[0].id==='terrain.woods'||b.placements[0].id==='terrain.dirt'&&distance>(b.selected?145:120)||b.placements[0].kind==='shore'||b.placements[0].water||b.placements[0].outside&&b.placements[0].kind==='terrain'))continue;
      const detailRadius=b.placements[0].id==='terrain.dirt'?35:radius;
      if(distance<=(b.selected?1000:950)&&range<detailRadius+(b.selected?margin:0)){
        const proto=this.prototypes.get(b.key);
        if(!proto&&!this.failed.has(b.key)&&!this.requested.has(b.key)){const p=b.placements[0];this.requested.add(b.key);this.provider.request({key:b.key,id:p.id!,options:p.options});}
        if(proto&&!b.calls&&this.now()<deadline)this.instantiate(b,proto);
        if(b.calls&&preferredCalls+b.calls<=this.drawBudget){preferred.add(b);preferredCalls+=b.calls;}
      }
    }
    const all=this.chunks.flatMap(c=>c.batches),dt=Math.max(0,Math.min(100,start-this.lastUpdate));this.lastUpdate=start;
    const select=(b:Batch,show:boolean):void=>{if(b.selected!==show){this.detailSwaps++;if(b.placements[0].id==='terrain.dirt')this.dirtSwaps++;b.selected=show;}};
    for(const b of all)if(b.selected&&!preferred.has(b))select(b,false);
    // Outgoing batches finish fading before their draw calls are lent to incoming detail.
    let reserved=all.reduce((sum,b)=>sum+(b.selected||b.fade>0?b.calls:0),0);
    for(const{b}of candidates)if(preferred.has(b)&&!b.selected&&reserved+(b.fade>0?0:b.calls)<=this.drawBudget){reserved+=b.fade>0?0:b.calls;select(b,true);}
    let calls=0;
    for(const b of all){
      const fade=Math.max(0,Math.min(1,b.fade+(b.selected?dt:-dt)/350));
      if(fade!==b.fade){b.fade=fade;for(const child of b.group.children){const mesh=child as InstancedMesh;for(let i=0;i<mesh.count;i++)mesh.instanceColor!.setX(i,fade);mesh.instanceColor!.needsUpdate=true;}
        for(const p of b.placements){this.showCoarse(p,fade<1);this.coarseFade(p,fade);}}
      b.group.visible=b.selected||b.fade>0;if(b.group.visible)calls+=b.calls;
    }
    if(this.coarseDirty){this.solid.instanceMatrix.needsUpdate=true;this.water.instanceMatrix.needsUpdate=true;this.ground.instanceMatrix.needsUpdate=true;
      this.solidDetail.needsUpdate=true;this.waterDetail.needsUpdate=true;if(this.solid.instanceColor)this.solid.instanceColor.needsUpdate=true;this.coarseDirty=false;}
    if(this.fadeDirty){this.solidDetail.needsUpdate=true;this.waterDetail.needsUpdate=true;this.fadeDirty=false;}
    this.detailCalls=calls;this.rebuildMs=this.now()-start;
  }
  private pendingResults:ReturnType<PrototypeProvider['take']>=[];
  /** The top of what stands within reach of a point, easing out to the ground at that reach: how high the camera over
   * it must stay so it never looks from inside a building */
  tallestNear(target:Vector3,reach=80):number {
    const ground=this.terrain?.enabled?this.terrain.sample(target.x,target.z):0;let max=ground;
    for(const chunk of this.chunks)if(Math.abs(chunk.x*10+80-target.x)<114+reach&&Math.abs(chunk.y*10+80-target.z)<114+reach)
      for(const p of chunk.placements){const distance=Math.max(0,Math.abs(p.x-target.x)-p.footprint[0]*5,Math.abs(p.z-target.z)-p.footprint[1]*5);
        if(distance<reach){const t=1-distance/reach,ease=t*t*(3-2*t),top=(p.baseY??0)+(this.prototypes.get(prototypeKey(p))?.height??p.height)*(p.fill??1);max=Math.max(max,ground+(top-ground)*ease);}}
    return max;
  }
  get pendingChunks():number{return this.chunks.filter(c=>c.dirty).length+(this.surfaces?.pending??0);}
  get maxDrawBudget():number{return this.surfaces?100:180;}
  get pendingModels():number{return this.requested.size-this.prototypes.size-this.failed.size;}
  roadsNear(target:Vector3):Placement[] {
    const roads:Placement[]=[];
    for(const c of this.chunks)if(Math.abs(c.x*10+80-target.x)<334&&Math.abs(c.y*10+80-target.z)<334)
      for(const p of c.placements)if(p.kind==='road'&&p.id?.endsWith('straight')&&Math.abs(p.x-target.x)<220&&Math.abs(p.z-target.z)<220)roads.push(p);
    return roads.sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z)).slice(0,64);
  }
  mapLOD(show:boolean):void {
    for(const chunk of this.chunks)for(const batch of chunk.batches)if(batch.selected||batch.fade>0){batch.group.visible=!show;batch.placements.forEach(p=>{this.showCoarse(p,show||batch.fade<1);this.coarseFade(p,show?0:batch.fade);});}
    this.solid.instanceMatrix.needsUpdate=true;this.water.instanceMatrix.needsUpdate=true;
    this.solidDetail.needsUpdate=true;this.waterDetail.needsUpdate=true;
  }
  dispose():void {this.provider.dispose();this.chunks.forEach(c=>this.clear(c));this.surfaces?.dispose();for(const p of this.prototypes.values())p.parts.forEach(part=>part.geometry.dispose());this.prototypes.clear();this.solid.dispose();this.water.dispose();this.ground.dispose();this.geometry.dispose();this.waterGeometry.dispose();this.groundGeometry.dispose();this.root.clear();this.coarse.clear();this.hidden.clear();this.chunks.length=0;this.requested.clear();this.failed.clear();this.pendingResults.length=0;}
}
function isBridge(p:Placement):boolean {return !!p.id?.includes('bridge');}
