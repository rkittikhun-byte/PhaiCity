/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, PerspectiveCamera, Vector3, WebGLRenderer, InstancedMesh } from 'three';
import { clipToMap, missingViewFunctions, toolFootprint } from '../../src/cityView.js';
import { POWERBIT, ZONEBIT } from '../../src/tileFlags.js';
import { CityView3D, CityViewSetup } from '../../src/render3d/city/index.js';
import { CityCamera } from '../../src/render3d/city/camera.js';
import { TileSnapshot, TILE_TABLE, makeTileTable, prototypeKey, tileSeed } from '../../src/render3d/city/tileModels.js';
import { groundAt, pickTile, visibleTileRect } from '../../src/render3d/city/picking.js';
import { CitySprites, spritePosition } from '../../src/render3d/city/sprites.js';
import { TestCity } from '../../src/render3d/city/test-city.js';
import { CityChunks } from '../../src/render3d/city/chunks.js';
import type { PrototypeRequest, SerializedPrototype } from '../../src/render3d/city/prototypes.js';
import { cityWorldMaterial, getMaterial } from '../../src/render3d/materials/library.js';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

function map(width=20,height=20) {
  const values=new Uint16Array(width*height),flags=new Uint16Array(width*height);
  return{width,height,values,flags,getTileValue(x:number,y:number){if(x<0||y<0||x>=width||y>=height)throw Error('bounds');return values[y*width+x];},
    getTileFlags(x:number,y:number){if(x<0||y<0||x>=width||y>=height)throw Error('bounds');return flags[y*width+x];}};
}
describe('3D tile model resolution and coverage',()=>{
  it('resolves all 1024 values once, with only explicitly shared mask families',()=>{
    expect(makeTileTable()).toEqual(TILE_TABLE);expect(TILE_TABLE).toHaveLength(1024);
    TILE_TABLE.forEach(e=>expect(e.id!==null||e.footprint[0]>1).toBe(true));
    expect(TILE_TABLE[228].kind).toBe('rail');expect(TILE_TABLE[212].kind).toBe('power');
  });
  it.each([[3,265],[4,750],[6,716]])('covers a %i×%i-sized building from the centre offset (1,1)',(size,value)=>{
    const m=map(),x=15,y=15,i=y*m.width+x;m.values[i]=value;m.flags[i]=ZONEBIT;
    const snapshot=new TileSnapshot(m.width,m.height);snapshot.sync(m);
    let count=0;for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++){
      const j=(y-1+dy)*m.width+x-1+dx;expect(snapshot.coverage[j]).toBe(i);if(snapshot.placement(j,'central'))count++;
    }expect(count).toBe(1);
    const placement=snapshot.placement(i,'central')!;expect(placement.x).toBe((x-1+size/2)*10);expect(placement.z).toBe((y-1+size/2)*10);
  });
  it('clips zones at map edges and restores covered cells after demolition',()=>{
    const m=map(8,7);m.values[0]=716;m.flags[0]=ZONEBIT;const s=new TileSnapshot(8,7);s.sync(m);
    expect([...s.coverage].filter(i=>i===0)).toHaveLength(25);m.flags[0]=0;m.values[0]=0;s.sync(m);expect([...s.coverage].every(i=>i===-1)).toBe(true);
  });
  it('places every registered centre once and falls back to density-scaled industry blocks',()=>{
    const m=map();m.values[5*20+5]=607;m.flags[5*20+5]=ZONEBIT|POWERBIT;
    m.values[10*20+10]=652;m.flags[10*20+10]=ZONEBIT;
    const s=new TileSnapshot(20,20);s.sync(m);expect(s.placement(105,'south')?.id).toBe('com.block_3_4');
    expect(s.placement(210,'south')).toMatchObject({id:null,kind:'industrial',height:17,footprint:[3,3]});
  });
  it.each(Array.from({length:16},(_,i)=>i))('selects road topology for mask %i without reading beyond the map',mask=>{
    const m=map(3,3);m.values[4]=66;[[1,1],[5,2],[7,4],[3,8]].forEach(([i,bit])=>{m.values[i]=mask&bit?66:0;});
    const s=new TileSnapshot(3,3);s.sync(m);expect(s.mask(1,1,v=>v===66)).toBe(mask);expect(s.placement(4,'central')!.id).toMatch(/^road\./);
    expect(()=>s.placement(0,'central')).not.toThrow();
  });
  it('traffic 80–206 uses plain roads; rail/power/shore/woods use neighbour masks',()=>{
    const m=map(3,3),s=new TileSnapshot(3,3);for(let v=80;v<=206;v++){m.values[4]=v;s.sync(m);expect(s.placement(4,'central')!.id).toMatch(/^road\.(single|end|straight|corner|t|cross)$/);}
    for(const [v,id]of[[228,'rail.end'],[212,'power.end'],[5,'terrain.shore'],[37,'terrain.woods']] as const){m.values[4]=v;s.sync(m);expect(s.placement(4,'central')!.id).toBe(id);}
  });
  it('detects neighbour, centre and power changes without modifying the reader',()=>{
    const m=map(),s=new TileSnapshot(20,20);s.sync(m);expect(s.sync(m)).toEqual([]);
    m.values[0]=77;m.flags[0]=POWERBIT;expect(s.sync(m)).toEqual([0]);expect(m.values[0]).toBe(77);expect(s.sync(m)).toEqual([]);
  });
  it('keeps narrow canals broad and treats bridges as water neighbours instead of river-closing banks',()=>{
    const m=map(3,3);m.values[4]=2;m.values[1]=64;m.values[7]=2;const s=new TileSnapshot(3,3);s.sync(m);
    expect(s.placement(4,'central')!.options.landMask).toBe(10);expect(s.placement(4,'central')!.options.waterMask).toBe(5);
  });
  it('uses coordinate-only seeds and reproducible seed buckets/models in all six regions',()=>{
    const m=new TestCity(),a=new TileSnapshot(200,200),b=new TileSnapshot(200,200);a.sync(m);b.sync(m);
    for(const region of ['north','northeast','central','east','west','south'] as const)for(const i of [0,100,6500,20140,21135,32000])expect(a.placement(i,region)).toEqual(b.placement(i,region));
    const p=a.placement(0,'central')!;expect(p.options.seed).toBe(tileSeed(0,0)%4);expect(prototypeKey({...p,x:100,z:200,options:{...p.options,worldOrigin:[100,200]}})).toBe(prototypeKey(p));
  });
});
describe('3D camera and raycasting mathematics',()=>{
  function camera(x=105,z=105){const c=new PerspectiveCamera(38,1,1,3000);c.position.set(x,150,z+100);c.lookAt(x,0,z);c.updateProjectionMatrix();c.updateMatrixWorld();return c;}
  it.each([[105,105,10,10],[5,5,0,0],[195,195,19,19]])('picks a known camera target at %i/%i',(x,z,tx,ty)=>{
    expect(pickTile(camera(x,z),400,400,800,800,20,20)).toEqual({x:tx,y:ty});
  });
  it('rejects sky, pixels outside the canvas and positions beyond the map',()=>{
    const c=camera(400,400);expect(pickTile(c,400,400,800,800,20,20)).toBeNull();expect(groundAt(c,-1,0,800,800)).toBeNull();
    c.position.set(100,10,100);c.lookAt(100,100,0);c.updateMatrixWorld();expect(pickTile(c,400,400,800,800,20,20)).toBeNull();
  });
  it('computes top-down frustum corners and clips sound/sprite coverage',()=>{
    const c=new PerspectiveCamera(90,1,1,3000);c.position.set(100,100,100);c.up.set(0,0,-1);c.lookAt(100,0,100);c.updateMatrixWorld();
    expect(visibleTileRect(c,800,800,20,20,3000)).toEqual({x0:0,y0:0,x1:19,y1:19});
    expect(clipToMap(toolFootprint({tile:{x:0,y:0},size:3,colour:'lime'}),20,20)).toEqual({x0:0,y0:0,x1:1,y1:1});
  });
  it('moves with elapsed real time, in screen directions after rotation, and caps long gaps',()=>{
    let time=0;const n=new CityCamera(200,200,()=>time);n.heading=Math.PI/2;const start=n.target.clone();n.move('north');time=16;n.move('north');expect(n.target.x).toBeLessThan(start.x);expect(n.target.z).toBeCloseTo(start.z);
    const before=n.target.clone();for(let i=0;i<100;i++)n.move('north');expect(n.target).toEqual(before);
    time=10000;n.move('north');expect(n.target.distanceTo(before)).toBeLessThanOrEqual(n.distance*.32*.05+1e-8);
  });
  it('centres within 550 ms, jumps for reduced motion and keeps pitch/zoom within limits',()=>{
    let time=0;const n=new CityCamera(20,20,()=>time);n.centreOn(2,3);time=300;n.update(time);expect(n.target.x).toBeGreaterThan(25);time=550;n.update(time);expect(n.target).toEqual(new Vector3(25,0,35));
    const r=new CityCamera(20,20,()=>time,true);r.centreOn(-10,200);expect(r.target).toEqual(new Vector3(0,0,200));n.rotate(0,10000);expect(n.pitch).toBeCloseTo(85*Math.PI/180);
    for(let i=0;i<20;i++)n.zoom(-300,400,400,800,800);expect(n.distance).toBe(60);n.update(time,149);expect(n.camera.position.y).toBeGreaterThan(149);
  });
  it('converts sprite centres, offsets and correct flight/water heights without changing sprites',()=>{
    const sprite=Object.freeze({type:2,x:160,y:320,xOffset:-16,yOffset:-16,width:32,height:32,frame:1});expect(spritePosition(sprite)).toEqual(new Vector3(100,60,200));
    expect(spritePosition({...sprite,type:4}).y).toBe(-.6);expect(spritePosition({...sprite,type:3}).y).toBe(120);
  });
});
describe('3D CityView lifecycle',()=>{
  it('freezes both sprite position and heading while paused, and uses the registered debug model for unknown types',()=>{
    const sprites=new CitySprites(),sprite={type:1,x:160,y:160,frame:1};
    try{
      sprites.update([sprite],.1,false);const mesh=sprites.root.children[0] as InstancedMesh,before=Array.from(mesh.instanceMatrix.array).slice(0,16);
      sprite.x=300;sprite.frame=3;sprites.update([sprite],.1,true);expect(Array.from(mesh.instanceMatrix.array).slice(0,16)).toEqual(before);
      sprites.update([{type:999,x:160,y:160}],.1,false);const debug=sprites.root.children[1] as InstancedMesh;
      expect(debug.count).toBe(1);expect(debug.geometry.getAttribute('position').count).toBeGreaterThan(24);
    }finally{sprites.dispose();}
  });
  it('instantiates transferred prototypes, replaces coarse instances and invalidates neighbouring chunks',()=>{
    const m=map(33,17),s=new TileSnapshot(33,17);m.values[8*33+15]=66;m.values[8*33+16]=66;s.sync(m);
    const geometry=new BoxGeometry(1,1,1),ready:SerializedPrototype[]=[],requests:PrototypeRequest[]=[];
    const provider={request(r:PrototypeRequest){requests.push(r);ready.push({key:r.key,height:1,parts:[{index:new Uint32Array(geometry.index!.array),
      attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([key,a])=>[key,{array:new Float32Array(a.array),size:a.itemSize}])),
      material:{key:'plaster_white',name:'plaster_white',color:0xffffff,data:{materialKey:'plaster_white'}}}]});},take(){return ready.splice(0);},dispose:jest.fn()};
    const c=new CityChunks(s,'central',provider,()=>0),target=new Vector3(160,0,80);
    try{
      c.update({x0:0,y0:0,x1:32,y1:16},target,400);expect(requests.length).toBeGreaterThan(0);
      c.update({x0:0,y0:0,x1:32,y1:16},target,400);expect(c.detailCalls).toBeGreaterThan(0);expect(c.detailCalls).toBeLessThanOrEqual(180);
      expect(c.root.children.some(n=>n.children.some(child=>child instanceof InstancedMesh))).toBe(true);
      expect(c.pendingChunks).toBe(0);expect(c.pendingModels).toBe(0);c.mapLOD(true);c.mapLOD(false);
      m.values[8*33+15]=0;c.dirty(s.sync(m));expect(c.pendingChunks).toBeGreaterThanOrEqual(2);
      c.update({x0:0,y0:0,x1:32,y1:16},target,400);expect(s.placement(8*33+16,'central')?.id).toBe('road.single');
      c.update({x0:0,y0:0,x1:32,y1:16},target,3000);expect(c.detailCalls).toBe(0);
    }finally{c.dispose();geometry.dispose();}expect(provider.dispose).toHaveBeenCalledTimes(1);
  });
  it('keeps world UV projection in the instancing shader but preserves sign and leaf atlas coordinates',()=>{
    const source=getMaterial('dirt_laterite'),material=cityWorldMaterial(source);
    expect(cityWorldMaterial(source)).toBe(material);expect(cityWorldMaterial(getMaterial('foliage_tropical'))).toBe(getMaterial('foliage_tropical'));
    expect(cityWorldMaterial(getMaterial('sign_thai'))).toBe(getMaterial('sign_thai'));
    const shader={vertexShader:'#include <uv_vertex>',fragmentShader:'',uniforms:{}};material.onBeforeCompile(shader as never,{} as never);
    expect(shader.vertexShader).toContain('instanceMatrix * vec4(position');expect(shader.vertexShader).toContain('cityP.xz');
  });
  it('implements every function; keeps left input untouched, freezes animations and disposes once',()=>{
    let time=0;const events=new Map<string,EventListener>();const canvas={id:'',style:{cssText:''},addEventListener:(type:string,fn:EventListener)=>events.set(type,fn),
      removeEventListener:jest.fn(),remove:jest.fn(),toDataURL:()=> 'data:image/png;base64,test',getBoundingClientRect:()=>({left:0,top:0})} as unknown as HTMLCanvasElement;
    const renderer={setPixelRatio:jest.fn(),setSize:jest.fn(),shadowMap:{},info:{render:{calls:3,triangles:20}},render:jest.fn(),dispose:jest.fn()} as unknown as WebGLRenderer;
    const reader=map(17,19),overlay={blockSize:2,worldGet:()=>0},provider={request:jest.fn(),take:()=>[],dispose:jest.fn()};
    const setup:CityViewSetup={container:{clientWidth:800,clientHeight:600,append:jest.fn()} as unknown as HTMLElement,map:reader,region:'central',overlays:{trafficDensityMap:overlay,pollutionDensityMap:overlay,landValueMap:overlay},date:()=>({month:0,year:1900})};
    const view=new CityView3D(setup,{canvas,rendererFactory:()=>renderer,provider,now:()=>time,headless:true});
    expect(missingViewFunctions(view)).toEqual([]);expect(canvas.id).toBe('MicropolisCanvas');expect(view.kind).toBe('3d');expect(view.width).toBe(800);expect(view.height).toBe(600);
    const start=view.navigation.target.clone();events.get('pointerdown')!({button:0,preventDefault:()=>{throw Error('left input intercepted');}} as unknown as Event);
    expect(view.navigation.target).toEqual(start);time=16;view.paint({tile:{x:0,y:0},size:3,colour:'lime'},[],true);
    expect(view.tileAt(400,300)).toEqual({x:8,y:9});expect(view.visibleTiles()).not.toBeNull();expect(view.screenshotVisible()).toMatch(/^data:image\/png/);expect(view.screenshotMap()).toMatch(/^data:image\/png/);
    expect(view.chunks.chunks).toHaveLength(4);expect([...reader.values].every(v=>v===0)).toBe(true);view.shake();time=600;view.paint(null,null,false);
    view.dispose();view.dispose();expect(provider.dispose).toHaveBeenCalledTimes(1);expect(renderer.dispose).toHaveBeenCalledTimes(1);expect(canvas.remove).toHaveBeenCalledTimes(1);
  });
  it('city sources contain no unseeded randomness, storage or autonomous frame loop',()=>{
    const dir=resolve('src/render3d/city');for(const name of readdirSync(dir).filter(n=>n.endsWith('.ts'))){const source=readFileSync(resolve(dir,name),'utf8');expect(source).not.toMatch(/Math\.random\s*\(|localStorage|requestAnimationFrame\s*\(/);}
  });
});
