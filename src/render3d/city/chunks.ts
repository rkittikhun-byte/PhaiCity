/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, type BufferGeometry, type Camera, Color, DynamicDrawUsage, Frustum, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, Vector3 } from 'three';
import { cityLODDepthMaterial, cityLODMaterial, cityWorldMaterial, getMaterial, getPreviewGround } from '../materials/library.js';
import { CHUNK_TILES, Placement } from './types.js';
import { TileSnapshot, prototypeKey } from './tileModels.js';
import { decodePrototype, Prototype, PrototypeProvider } from './prototypes.js';
import type { RegionId } from '../regional/types.js';
import type { TileRect } from '../../cityView.js';
import type { CityHeightField } from './heightfield.js';
import { ProvinceSurface } from './province-surface.js';
import { frustumOf, ModelPool, poolPlacements, type PoolPlacements } from './pools.js';
interface Batch { group:Group; placements:Placement[]; key:string; calls:number; selected:boolean;fade:number;
  /** The pool that draws it with the other batches of its model when the model has levels of detail (pools.ts, lod.ts),
   * and what the pool keeps of its placements */
  pool?:ModelPool; pooled?:PoolPlacements }
interface Chunk {id:number;x:number;y:number;cursor:number;dirty:boolean;placements:Placement[];batches:Batch[];version:number}
const zero=new Matrix4().makeScale(0,0,0),matrix=new Matrix4(),color=new Color();
/** The fewest tiles a frame scans for their models, however slow the frame (CityChunks.update) */
export const MIN_CELLS=64;
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
  /** The batches drawn or fading (selected, or fade above 0): the only ones each frame goes over after choosing, of the
   * tens of thousands a real-scale city map has */
  private readonly active=new Set<Batch>();
  private lastCandidateTarget=new Vector3(-9999,-9999,-9999);
  private lastCandidateDistance=-9999;
  private cachedCandidates:{b:Batch;range:number;order:number}[]=[];
  private batchesDirty=true;
  readonly surfaces?:ProvinceSurface;
  /** Levels of detail (lod.ts, pools.ts): whether a model with lighter levels has its batches drawn together by distance;
   * the camera, how many pixels a world unit one unit from it takes on the screen (0: every model whole) and the sun's
   * shadow camera, which the view sets; the sun's shadow frustum, whose pass alone draws the pools' shadows; each model's
   * pool, and how often the pools were filled again */
  lodOn=true;camera:Camera|null=null;pixelsPerUnit=0;shadowCamera:Camera|null=null;shadowFrustum:(()=>unknown)|null=null;
  readonly pools=new Map<string,ModelPool>();poolFills=0;
  private readonly poolRoot=new Group();private lodWas=true;private lastPixels=0;
  private readonly poolView={frustum:null as Frustum|null,eye:new Vector3(NaN,NaN,NaN),shadow:null as Frustum|null,pixelsPerUnit:0};
  private readonly viewFrustum=new Frustum();private readonly sunFrustum=new Frustum();
  private readonly lastView=new Float32Array(16);private readonly lastSun=new Float32Array(16);
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
    if(terrain?.province){this.surfaces=new ProvinceSurface(snapshot,terrain);this.root.add(this.surfaces.root);this.drawBudget=Math.min(320,this.maxDrawBudget);}
    // Cheap complete ground is available before a single detailed model is built.
    for(let i=0;i<n;i++) {const x=i%snapshot.width,y=Math.floor(i/snapshot.width),water=snapshot.values[i]>=2&&snapshot.values[i]<=20;
      matrix.makeScale(10,.06,10).setPosition((x+.5)*10,water?-.63:.01,(y+.5)*10);
      if(water){const slot=this.water.count++;this.waterSlots[i]=slot;this.water.setMatrixAt(slot,matrix);}
      matrix.makeScale(10,1,10).setPosition((x+.5)*10,-.025,(y+.5)*10);this.ground.setMatrixAt(i,water?zero:matrix);
    }
    for(let y=0;y<snapshot.height;y+=CHUNK_TILES)for(let x=0;x<snapshot.width;x+=CHUNK_TILES)
      this.chunks.push({id:this.chunks.length,x,y,cursor:0,dirty:true,placements:[],batches:[],version:0});
    this.poolRoot.name='city/pools';this.root.add(this.poolRoot);
  }
  dirty(indices:readonly number[]):void {
    this.surfaces?.dirty(indices);
    const ids=new Set<number>();
    for(const i of indices){const x=i%this.snapshot.width,y=Math.floor(i/this.snapshot.width);
      // Neighbour masks and old/new building footprints can straddle chunk boundaries.
      for(let cy=Math.floor(Math.max(0,y-6)/16);cy<=Math.floor(Math.min(this.snapshot.height-1,y+6)/16);cy++)
        for(let cx=Math.floor(Math.max(0,x-6)/16);cx<=Math.floor(Math.min(this.snapshot.width-1,x+6)/16);cx++)ids.add(cy*this.columns+cx);
    }
    const eager=indices.length<=64&&(this.snapshot.realUnits??1)<1;
    for(const id of ids){
      const chunk=this.chunks[id];
      const wasVisible=eager?new Set(chunk.batches.filter(b=>b.selected||b.fade>0).map(b=>b.key)):undefined;
      chunk.dirty=true;chunk.cursor=0;chunk.placements=[];chunk.version++;this.clear(chunk);
      if(eager&&wasVisible&&wasVisible.size>0){
        while(chunk.cursor<256)this.cell(chunk,chunk.cursor++);
        this.finish(chunk,wasVisible);
      }
    }
    // Only a change sorts the batches by distance again: the view calls this every frame, mostly with nothing, and over
    // a town of thousands of plots the sort took some 20 ms a frame
    if(ids.size)this.batchesDirty=true;
  }
  /** Every chunk built again, for a change that reaches every building at once: the era models arriving or the city
   * moving to a new era (eraBuildings.ts) */
  refreshAll():void {
    for(const chunk of this.chunks){chunk.dirty=true;chunk.cursor=0;chunk.placements=[];chunk.version++;this.clear(chunk);}
    this.surfaces?.dirty(Array.from({length:this.snapshot.width*this.snapshot.height},(_,i)=>i));
    this.batchesDirty=true;
  }
  private coarseMatrix(p:Placement):Matrix4 {
    const zone=p.footprint[0]>1, protoH=this.prototypes.get(prototypeKey(p))?.height;
    const rawH=zone?(protoH!==undefined?protoH*(p.height/Math.max(1,protoH)):p.height):p.id?.startsWith('plot.')||p.kind==='residential'||p.kind==='commercial'||p.kind==='industrial'?p.height:p.kind==='veg'?1:p.id==='terrain.woods'?5:p.water?.06:Math.max(.06,p.kind==='debug'?4:.12);
    const height=zone&&protoH!==undefined&&!this.snapshot.realUnits?protoH:rawH;
    const inset=p.id?.startsWith('plot.')||p.id?.startsWith('lot.')||p.kind==='residential'||p.kind==='commercial'||p.kind==='industrial'?1.6:zone?1.2:0;
    // Water lies a little under the ground; everything else is the placement's own box (placement.ts)
    return p.water?matrix.makeScale(p.footprint[0]*10,height,p.footprint[1]*10).setPosition(p.x,(p.baseY??0)-.63,p.z):p.farBox(matrix,height,inset);
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
    for(const batch of chunk.batches){for(const p of batch.placements){this.showCoarse(p,true);this.coarseFade(p,0);}this.leavePool(batch);this.active.delete(batch);batch.group.traverse(n=>{if(n instanceof InstancedMesh){n.geometry.dispose();n.dispose();}});this.root.remove(batch.group);}
    chunk.batches=[];
    this.batchesDirty=true;
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
  private finish(chunk:Chunk,wasVisible?:Set<string>):void {
    const groups=new Map<string,Placement[]>();
    for(const p of chunk.placements)if(p.id){const key=prototypeKey(p),g=groups.get(key)??[];g.push(p);groups.set(key,g);}
    // (every batch with the same fields from the start, so the loops over them stay quick)
    chunk.batches=Array.from(groups,([key,placements])=>({key,placements,group:new Group(),calls:0,selected:false,fade:0,pool:undefined,pooled:undefined}));
    for(const b of chunk.batches){
      const proto=wasVisible&&(wasVisible.has(b.key)||['residential','commercial','industrial','services','transport'].includes(b.placements[0].kind))?this.prototypes.get(b.key):undefined;
      if(proto){
        b.selected=true;b.fade=1;this.instantiate(b,proto);b.group.visible=true;this.active.add(b);
        for(const p of b.placements){this.showCoarse(p,false);this.coarseFade(p,1);}
        // A batch is in the scene only while it is drawn (update), and a pooled one's pool draws it (pools.ts): the
        // renderer and the shadow pass go over every object in the scene each frame, and a town has tens of thousands
        if(!b.pool)this.root.add(b.group);
      } else {
        b.group.visible=false;
      }
    }
    chunk.dirty=false;
    this.batchesDirty=true;
  }
  private cell(chunk:Chunk,n:number):void {
    const x=chunk.x+n%16,y=chunk.y+Math.floor(n/16);if(x>=this.snapshot.width||y>=this.snapshot.height)return;
    const i=y*this.snapshot.width+x,p=this.snapshot.placement(i,this.region);this.setCoarse(i,p);if(p)chunk.placements.push(p);
    // ... and the other buildings of its tile (a terrace of shophouse bays, frontage.ts), on its ground
    if(p?.parts)for(const part of p.parts){part.baseY=p.baseY;part.outside=p.outside;chunk.placements.push(part);}
    const v=this.snapshot.values[i],wet=v>=2&&v<=20||v===64||v===65||v===224||v===225||v===208||v===209||v>=828&&v<=832||v>=948&&v<=951;
    matrix.makeScale(10,1,10).setPosition((x+.5)*10,-.025,(y+.5)*10);this.ground.setMatrixAt(i,wet?zero:matrix);
  }
  finishMapLOD():void {
    for(const chunk of this.chunks)if(chunk.dirty){while(chunk.cursor<256)this.cell(chunk,chunk.cursor++);this.finish(chunk);}
    this.solid.instanceMatrix.needsUpdate=true;this.water.instanceMatrix.needsUpdate=true;this.ground.instanceMatrix.needsUpdate=true;
    if(this.solid.instanceColor)this.solid.instanceColor.needsUpdate=true;
    this.surfaces?.finish();
  }
  /** A part's instanced mesh for a batch over `geometry` (the part's own or a lighter level's), its own copy so its
   * per-instance attributes are its own, with room for every placement of the batch */
  private partMesh(batch:Batch,part:Prototype['parts'][number],geometry:BufferGeometry):InstancedMesh {
    const g=geometry.clone(),count=batch.placements.length;
    g.setAttribute('cityOutside',new InstancedBufferAttribute(new Float32Array(count),1));g.setAttribute('cityTerrain',new InstancedBufferAttribute(new Float32Array(count*4),4));g.setAttribute('cityBridgeDepth',new InstancedBufferAttribute(new Float32Array(count),1));
    const mesh=new InstancedMesh(g,cityLODMaterial(part.material),count);mesh.customDepthMaterial=cityLODDepthMaterial(mesh.material as typeof part.material);
    mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(count*3).fill(1),3).setUsage(DynamicDrawUsage);
    mesh.castShadow=part.castShadow??true;mesh.receiveShadow=part.receiveShadow??true;
    return mesh;
  }
  /** Puts the batch's placements `members` (indices into its placements, the first n) into a mesh, in that order */
  private fill(mesh:InstancedMesh,batch:Batch,members:ArrayLike<number>,n:number):void {
    const g=mesh.geometry,province=g.getAttribute('cityOutside') as InstancedBufferAttribute,slopes=g.getAttribute('cityTerrain') as InstancedBufferAttribute,bridgeDepth=g.getAttribute('cityBridgeDepth') as InstancedBufferAttribute;
    for(let i=0;i<n;i++){const p=batch.placements[members[i]],base=p.baseY??0;p.modelMatrix(matrix);mesh.setMatrixAt(i,matrix);mesh.instanceColor!.setX(i,batch.fade);
      province.setX(i,p.outside?1:0);
      bridgeDepth.setX(i,this.terrain?.enabled&&isBridge(p)&&Number.isFinite(this.terrain.water[p.index])?Math.max(0,base-this.terrain.water[p.index]):0);
      if(this.terrain?.enabled&&(p.kind==='road'||p.kind==='rail'||p.id==='terrain.dirt')&&!isBridge(p)){
        const x=Math.floor(p.x/10),y=Math.floor(p.z/10);slopes.setXYZW(i,this.terrain.corner(x,y)-base,this.terrain.corner(x+1,y)-base,this.terrain.corner(x,y+1)-base,this.terrain.corner(x+1,y+1)-base);
      }else slopes.setXYZW(i,0,0,0,0);
    }
    mesh.count=n;mesh.visible=n>0;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;province.needsUpdate=true;slopes.needsUpdate=true;bridgeDepth.needsUpdate=true;
    mesh.computeBoundingSphere();if(mesh.boundingSphere){let extent=0;for(let i=0;i<n*4;i++)extent=Math.max(extent,Math.abs(slopes.array[i]));for(let i=0;i<n;i++)extent=Math.max(extent,bridgeDepth.array[i]);mesh.boundingSphere.radius+=extent;}
  }
  private instantiate(batch:Batch,prototype:Prototype):void {
    // Dirt uses the same continuous ground at every distance; only grass and stones change detail.
    const drawn=prototype.parts.map((_,j)=>j).filter(j=>!((batch.placements[0].id==='terrain.dirt'||this.surfaces)&&prototype.parts[j].ground));
    // A model with levels of detail or a shadow of its own (an era building) is drawn with every other batch of it, by
    // its pool (pools.ts)
    if(this.lodOn&&(prototype.lods?.length||prototype.shadow)&&drawn.length){
      let pool=this.pools.get(batch.key);
      if(!pool){pool=new ModelPool(prototype,drawn,frustum=>this.shadowFrustum?.()===frustum);this.pools.set(batch.key,pool);this.poolRoot.add(pool.root);}
      batch.pool=pool;batch.pooled=poolPlacements(batch.placements,prototype);pool.members.add(batch);pool.dirty=true;
      batch.group.removeFromParent();batch.calls=pool.calls;return;
    }
    const all=Int32Array.from({length:batch.placements.length},(_,i)=>i);
    for(const j of drawn){const mesh=this.partMesh(batch,prototype.parts[j],prototype.parts[j].geometry);batch.group.add(mesh);this.fill(mesh,batch,all,all.length);}
    batch.calls=batch.group.children.length;
    if(batch.group.visible&&batch.group.parent!==this.root)this.root.add(batch.group);
  }
  /** A batch out of its pool, which draws without it from the next fill */
  private leavePool(batch:Batch):void {
    if(!batch.pool)return;
    batch.pool.members.delete(batch);batch.pool.dirty=true;batch.pool=undefined;batch.pooled=undefined;batch.calls=0;
  }
  /** Every batch of a model with levels of detail built again, the other way, when they are turned on or off */
  private relevel():void {
    for(const chunk of this.chunks)for(const b of chunk.batches){
      const proto=this.prototypes.get(b.key);if(!b.pool&&!(b.calls&&(proto?.lods?.length||proto?.shadow)))continue;
      this.leavePool(b);b.group.traverse(n=>{if(n instanceof InstancedMesh){n.geometry.dispose();n.dispose();}});b.group.clear();b.calls=0;
    }
    this.batchesDirty=true;
  }
  update(visible:TileRect|null,target:Vector3,distance:number):void {
    // Reserve one millisecond of the four-millisecond slice for batch selection / GPU buffer handoff.
    const start=this.now(),deadline=start+3;
    const priority=(c:Chunk):number=>{const inView=visible&&c.x<=visible.x1&&c.x+16>visible.x0&&c.y<=visible.y1&&c.y+16>visible.y0;
      return Math.hypot(c.x*10+80-target.x,c.y*10+80-target.z)+(inView?0:100000);};
    const work=this.chunks.filter(c=>c.dirty).map(c=>({c,rank:priority(c)})).sort((a,b)=>a.rank-b.rank);
    // The scan's slice starts once the work is sorted, and scans a few tiles whatever the clock says: on a real-scale
    // city map's 900 chunks the sort alone took the whole millisecond, so no chunk was ever scanned and no model shown
    // (owner, 18 Oct 2026: the level crossing on the Khon Kaen map never appeared)
    const coarseDeadline=this.surfaces?this.now()+1:deadline;let scanned=0;
    for(const{c:chunk}of work){while(chunk.cursor<256&&(scanned<MIN_CELLS||this.now()<coarseDeadline)){this.cell(chunk,chunk.cursor++);scanned++;}
      if(chunk.cursor===256)this.finish(chunk);if(scanned>=MIN_CELLS&&this.now()>=coarseDeadline)break;}
    // Province terrain and worker handoff each get a slice while distant chunks are still being built.
    // ... the far ground's trees light where the camera is far enough (province-surface.ts, lod.ts)
    if(this.surfaces&&this.camera){this.surfaces.eye.setFromMatrixPosition(this.camera.matrixWorld);this.surfaces.pixelsPerUnit=this.lodOn?this.pixelsPerUnit:0;}
    this.surfaces?.update(target,distance,this.now,Math.max(start+2,this.now()+.5));
    // Decode small transferred buffers incrementally; heavy factories never run on the UI thread.
    this.pendingResults.push(...this.provider.take());
    // ... at least one a frame, as the slices before it can use up the whole budget on a slow frame
    let decoded=0;
    while(this.pendingResults.length&&(decoded++<1||this.now()<deadline)){const result=this.pendingResults.shift()!;
      if(result.error){this.failed.add(result.key);console.warn('City model skipped:',result.key,result.error);}
      else try {
        this.prototypes.set(result.key,decodePrototype(result));
        for(const chunk of this.chunks)for(const batch of chunk.batches)if(batch.key===result.key&&batch.fade===0)
          for(const p of batch.placements){const slot=(p.water?this.waterSlots:this.solidSlots)[p.index];if(slot>=0)(p.water?this.water:this.solid).setMatrixAt(slot,this.coarseMatrix(p));}
        this.coarseDirty=true;
      } catch(error){this.failed.add(result.key);console.warn('City model skipped:',result.key,String(error));}
    }
    const wideCity=Boolean(this.surfaces&&(this.snapshot.realUnits??1)<1);
    const radius=wideCity?Math.min(950,Math.max(520,distance*1.55)):Math.min(280,Math.max(85,distance*.55)),margin=wideCity?35:25;
    const moved=this.batchesDirty||target.distanceToSquared(this.lastCandidateTarget)>9||Math.abs(distance-this.lastCandidateDistance)>8;
    if(moved){
      this.lastCandidateTarget.copy(target);this.lastCandidateDistance=distance;this.batchesDirty=false;
      const nearby=this.chunks.filter(c=>Math.abs(c.x*10+80-target.x)<radius+margin+114&&Math.abs(c.y*10+80-target.z)<radius+margin+114);
      const candidates:{b:Batch;range:number;order:number}[]=[];
      for(const c of nearby){
        for(const b of c.batches){
          let range=Infinity;
          for(const p of b.placements){const d=Math.hypot(p.x-target.x,p.z-target.z);if(d<range)range=d;}
          // ... its kind's rank worked out once, not in every comparison of the sort (thousands of batches in a big town)
          candidates.push({b,range,order:range+chunkRank(b.placements[0])-(b.selected?margin:0)});
        }
      }
      candidates.sort((a,b)=>a.order-b.order);
      this.cachedCandidates=candidates;
    }
    const candidates=this.cachedCandidates;
    const preferred=new Set<Batch>();let preferredCalls=0,instantiated=0;
    for(const{b,range}of candidates){
      if(this.surfaces&&(b.placements[0].id==='terrain.woods'||b.placements[0].id==='terrain.dirt'||b.placements[0].kind==='shore'||b.placements[0].water||b.placements[0].outside&&b.placements[0].kind==='terrain'))continue;
      const detailRadius=b.placements[0].id==='terrain.dirt'?35:b.placements[0].id==='terrain.woods'&&this.surfaces?180:radius;
      if(distance<=(b.selected?(wideCity?2200:1400):(wideCity?2000:1300))&&range<detailRadius+(b.selected?margin:0)){
        const proto=this.prototypes.get(b.key);
        if(!proto&&!this.failed.has(b.key)&&!this.requested.has(b.key)){const p=b.placements[0];this.requested.add(b.key);this.provider.request({key:b.key,id:p.id!,options:p.options});}
        if(proto&&!b.calls&&(instantiated<6||this.now()<deadline)){this.instantiate(b,proto);instantiated++;}
        if(b.calls&&preferredCalls+b.calls<=this.drawBudget){preferred.add(b);preferredCalls+=b.calls;}
      }
    }
    const active=this.active,dt=Math.max(0,Math.min(100,start-this.lastUpdate));this.lastUpdate=start;
    const select=(b:Batch,show:boolean):void=>{if(b.selected!==show){this.detailSwaps++;if(b.placements[0].id==='terrain.dirt')this.dirtSwaps++;b.selected=show;if(show)active.add(b);}};
    for(const b of active)if(b.selected&&!preferred.has(b))select(b,false);
    // Outgoing batches finish fading before their draw calls are lent to incoming detail.
    let reserved=0;
    for(const b of active)reserved+=b.selected||b.fade>0?b.calls:0;
    for(const{b}of candidates)if(preferred.has(b)&&!b.selected&&reserved+(b.fade>0?0:b.calls)<=this.drawBudget){reserved+=b.fade>0?0:b.calls;select(b,true);}
    let calls=0;
    for(const b of active){
      const fade=Math.max(0,Math.min(1,b.fade+(b.selected?dt:-dt)/350));
      if(fade!==b.fade){b.fade=fade;for(const child of b.group.children){const mesh=child as InstancedMesh;for(let i=0;i<mesh.count;i++)mesh.instanceColor!.setX(i,fade);mesh.instanceColor!.needsUpdate=true;}
        for(const p of b.placements){this.showCoarse(p,fade<1);this.coarseFade(p,fade);}
        if(b.pool)b.pool.dirty=true;}
      const shown=b.selected||b.fade>0;
      if(shown!==b.group.visible){if(b.pool)b.pool.dirty=true;else if(shown)this.root.add(b.group);else this.root.remove(b.group);}
      b.group.visible=shown;if(b.group.visible)calls+=b.calls;else active.delete(b);
    }
    // The pools fill again when a batch of theirs came, went or faded, or the camera or the sun's shadow moved: each
    // building at its level of detail, and only those in sight (pools.ts)
    if(this.lodOn!==this.lodWas){this.lodWas=this.lodOn;this.relevel();}
    if(this.pools.size){
      const view=this.poolView,camera=this.camera;
      let moved=Math.abs(this.pixelsPerUnit-this.lastPixels)>this.lastPixels*.01;if(moved)this.lastPixels=this.pixelsPerUnit;
      if(camera){moved=frustumOf(camera,this.viewFrustum,this.lastView)||moved;view.frustum=this.viewFrustum;view.eye.setFromMatrixPosition(camera.matrixWorld);}
      if(this.shadowCamera){moved=frustumOf(this.shadowCamera,this.sunFrustum,this.lastSun)||moved;view.shadow=this.sunFrustum;}
      view.pixelsPerUnit=this.lodOn?this.pixelsPerUnit:0;
      for(const pool of this.pools.values())if(moved||pool.dirty){pool.refill(view);this.poolFills++;}
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
  get maxDrawBudget():number{return this.surfaces?((this.snapshot.realUnits??1)<1?380:300):180;}
  get pendingModels():number{return this.requested.size-this.prototypes.size-this.failed.size;}
  roadsNear(target:Vector3):Placement[] {
    const roads:Placement[]=[];
    for(const c of this.chunks)if(Math.abs(c.x*10+80-target.x)<334&&Math.abs(c.y*10+80-target.z)<334)
      for(const p of c.placements)if(p.kind==='road'&&p.id?.endsWith('straight')&&Math.abs(p.x-target.x)<220&&Math.abs(p.z-target.z)<220)roads.push(p);
    return roads.sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z)).slice(0,64);
  }
  mapLOD(show:boolean):void {
    this.poolRoot.visible=!show;
    if(this.surfaces)this.surfaces.terrainDetail.root.visible=!show;
    for(const chunk of this.chunks)for(const batch of chunk.batches)if(batch.selected||batch.fade>0){batch.group.visible=!show;batch.placements.forEach(p=>{this.showCoarse(p,show||batch.fade<1);this.coarseFade(p,show?0:batch.fade);});}
    this.solid.instanceMatrix.needsUpdate=true;this.water.instanceMatrix.needsUpdate=true;
    this.solidDetail.needsUpdate=true;this.waterDetail.needsUpdate=true;
  }
  dispose():void {this.provider.dispose();this.chunks.forEach(c=>this.clear(c));this.pools.forEach(pool=>pool.dispose());this.pools.clear();this.surfaces?.dispose();for(const p of this.prototypes.values()){p.parts.forEach(part=>part.geometry.dispose());p.lods?.forEach(l=>l.parts.forEach(g=>g?.dispose()));p.shadow?.forEach(g=>g?.dispose());}this.prototypes.clear();this.solid.dispose();this.water.dispose();this.ground.dispose();this.geometry.dispose();this.waterGeometry.dispose();this.groundGeometry.dispose();this.root.clear();this.coarse.clear();this.hidden.clear();this.chunks.length=0;this.requested.clear();this.failed.clear();this.pendingResults.length=0;}
}
function isBridge(p:Placement):boolean {return !!p.id?.includes('bridge');}
function chunkRank(p:Placement):number {
  return p.footprint[0]>1?-180:['residential','commercial','industrial','services','transport'].includes(p.kind)?-160:p.kind==='road'&&(p.id?.includes('crossing')||p.id?.includes('bridge'))?-150:p.kind==='road'||p.kind==='rail'||p.kind==='power'?-95:p.id==='terrain.woods'?-40:0;
}
