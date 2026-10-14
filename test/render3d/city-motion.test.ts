/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, Group, InstancedMesh, Vector3, WebGLRenderer } from 'three';
import { CityChunks } from '../../src/render3d/city/chunks.js';
import { CityView3D } from '../../src/render3d/city/index.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { Placement } from '../../src/render3d/city/placement.js';
import { cityLODDepthMaterial, cityLODMaterial, getMaterial, getPreviewGround, isLibraryMaterial } from '../../src/render3d/materials/library.js';
import type { CityViewSetup } from '../../src/render3d/city/types.js';

function mapReader(width=64,height=16) {return{width,height,getTileValue:()=>0,getTileFlags:()=>0};}

function detailFixture(kind:'radius'|'budget'|'dirt') {
  let time=0;const map={...mapReader(),getTileValue:(x:number,y:number)=>kind!=='dirt'&&x===0&&y===0?66:0},snapshot=new TileSnapshot(map.width,map.height);snapshot.sync(map);
  const chunks=new CityChunks(snapshot,'central',{request:jest.fn(),take:()=>[],dispose:jest.fn()},()=>time);
  chunks.finishMapLOD();const geometry=new BoxGeometry(1,1,1),p=snapshot.placement(0,'central')!;
  // Isolate boundaries using real selection/instancing, with one-call transferred prototypes.
  for(const chunk of chunks.chunks){chunk.batches.forEach(b=>chunks.root.remove(b.group));chunk.batches=[];}
  const positions=kind==='budget'?[101,301]:kind==='dirt'?[235]:[285];
  const batches=positions.map((x,i)=>({key:`fixture-${i}`,group:new Group(),calls:0,selected:false,fade:0,
    placements:[new Placement({...p,index:i,x,z:80,id:kind==='dirt'?'terrain.dirt':'road.straight',kind:kind==='dirt'?'terrain':'road',footprint:[1,1] as const})]}));
  for(const b of batches){chunks.root.add(b.group);chunks.prototypes.set(b.key,{height:1,parts:[{geometry,material:getMaterial('plaster_white')}]});}
  chunks.chunks[0].batches=batches;if(kind==='budget')chunks.drawBudget=1;
  const target=new Vector3(200,0,80),distance=kind==='budget'?400:154;
  chunks.update(null,target,distance);const flips=batches.map(()=>0),previous=batches.map(b=>b.selected);
  return{chunks,batches,flips,previous,target,distance,step(frame:number){time+=16;target.x=200+(frame%2)*2;chunks.update(null,target,distance);
    batches.forEach((b,i)=>{if(b.selected!==previous[i])flips[i]++;previous[i]=b.selected;});},update(x:number,ms=16){time+=ms;target.x=x;chunks.update(null,target,distance);},dispose(){chunks.dispose();}};
}

function viewFixture(cost=24) {
  Object.defineProperty(globalThis,'devicePixelRatio',{configurable:true,value:2});
  let time=0,ratio=2,renderCost=cost;const events:string[]=[],listeners=new Map<string,EventListener>();
  const canvas={style:{cssText:''},addEventListener:(type:string,fn:EventListener)=>listeners.set(type,fn),removeEventListener:jest.fn(),remove:jest.fn()} as unknown as HTMLCanvasElement;
  const renderer={setPixelRatio:jest.fn((value:number)=>{ratio=value;events.push('resize');}),getPixelRatio:()=>ratio,setSize:jest.fn(),shadowMap:{},
    info:{render:{calls:3,triangles:20}},render:jest.fn(()=>{events.push('render');time+=renderCost;}),dispose:jest.fn()} as unknown as WebGLRenderer;
  const container={clientWidth:800,clientHeight:600,append:jest.fn()} as unknown as HTMLElement;
  const overlay={blockSize:2,worldGet:()=>0},setup:CityViewSetup={container,map:mapReader(200,16),region:'central',overlays:{trafficDensityMap:overlay,pollutionDensityMap:overlay,landValueMap:overlay},date:()=>({month:0,year:2026})};
  const view=new CityView3D(setup,{canvas,rendererFactory:()=>renderer,provider:{request:jest.fn(),take:()=>[],dispose:jest.fn()},now:()=>time,headless:true});
  view.chunks.finishMapLOD();view.chunks.update=jest.fn();
  // Exercise adaptation with a mock GPU while keeping browser asset loading disabled.
  (view as unknown as {headless:boolean}).headless=false;
  events.length=0;(renderer.setPixelRatio as jest.Mock).mockClear();
  return{view,renderer,events,listeners,advance(ms=16){time+=ms;},cost(value:number){renderCost=value;},get time(){return time;},paint(){view.paint(null,null,true);}};
}

describe('steady detail during camera motion',()=>{
  it.each(['radius','budget','dirt'] as const)('does not churn at the %s boundary over 200 two-metre steps',kind=>{
    const f=detailFixture(kind);try{for(let frame=0;frame<200;frame++)f.step(frame);
      console.log(`Motion ${kind}: total swaps=${f.flips.reduce((a,b)=>a+b,0)}, max per batch=${Math.max(...f.flips)}`);
      expect(Math.max(...f.flips)).toBeLessThanOrEqual(1);
    }finally{f.dispose();}
  });
  it('keeps detail through the 25 m margin and fades it out beyond that margin',()=>{
    const f=detailFixture('radius');try{
      f.update(202,100);for(let i=0;i<4;i++)f.update(202,100);
      const b=f.batches[0];expect(b.fade).toBe(1);f.update(180);expect(b.selected).toBe(true);
      f.update(170);expect(b.selected).toBe(false);expect(b.fade).toBeGreaterThan(0);expect(b.fade).toBeLessThan(1);expect(b.group.visible).toBe(true);
      const mesh=b.group.children[0] as InstancedMesh;expect(mesh.instanceColor!.getX(0)).toBeCloseTo(b.fade);
      const matrixVersion=f.chunks.solid.instanceMatrix.version;f.update(170);
      expect(f.chunks.solid.instanceMatrix.version).toBe(matrixVersion);
      for(let i=0;i<4;i++)f.update(170,100);expect(b.fade).toBe(0);expect(b.group.visible).toBe(false);
    }finally{f.dispose();}
  });
  it('swaps each departing batch at most once on a continuous 400 m pan, at 2 m per frame',()=>{
    const f=detailFixture('radius');try{
      const b=f.batches[0];b.placements[0].x=485;f.chunks.chunks[0].x=32;
      f.update(402,100);for(let i=0;i<4;i++)f.update(402,100);
      let previous=b.selected,swaps=0;
      for(let frame=1;frame<=200;frame++){f.update(402-frame*2);if(b.selected!==previous)swaps++;previous=b.selected;}
      expect(swaps).toBe(1);
    }finally{f.dispose();}
  });
  it('lends the budget to a clearly closer batch only after outgoing detail has faded',()=>{
    const f=detailFixture('budget');try{
      for(let i=0;i<4;i++)f.update(200,100);expect(f.batches[0].fade).toBe(1);
      f.update(250);expect(f.batches[0].selected).toBe(false);expect(f.batches[1].selected).toBe(false);
      for(let i=0;i<6;i++){f.update(250,100);expect(f.chunks.detailCalls).toBeLessThanOrEqual(1);}
      expect(f.batches[1].selected).toBe(true);
    }finally{f.dispose();}
  });
  it('uses complementary fade coverage for colour and shadow without changing the shared material',()=>{
    const base=getMaterial('asphalt'),detail=cityLODMaterial(base),coarse=cityLODMaterial(getPreviewGround(),true),depth=cityLODDepthMaterial(detail);
    expect(isLibraryMaterial(detail)).toBe(true);expect(isLibraryMaterial(depth)).toBe(true);expect(detail).not.toBe(base);
    expect(coarse.map).toBe(getPreviewGround().map);expect(detail.userData.cityWorldUV).toBe(false);
    for(const material of [detail,coarse,depth]){
      const shader={uniforms:{},vertexShader:'#include <common>\n#include <uv_vertex>\n#include <begin_vertex>\n#include <color_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>'};
      material.onBeforeCompile(shader as never,{} as never);
      expect(shader.vertexShader).toContain(material===coarse?'attribute float instanceDetail':'cityDetail = instanceColor.r');expect(shader.fragmentShader).toContain('discard');
      if(material!==coarse)expect(shader.vertexShader).not.toMatch(/vColor\.(?:xyz|rgb)\s*\*=\s*instanceColor/);
      if(material===detail)expect(shader.vertexShader).toContain('#undef USE_INSTANCING_COLOR');
      expect((shader.vertexShader.match(/vec3 cityP =/g)??[]).length).toBeLessThanOrEqual(1);
      expect(shader.fragmentShader).toContain(material===coarse?'threshold < cityDetail':'threshold >= cityDetail');
    }
  });
  it('keeps the dirt ground constant while fading only its decoration',()=>{
    const f=detailFixture('dirt');try{
      const b=f.batches[0],proto=f.chunks.prototypes.get(b.key)!;proto.parts.unshift({...proto.parts[0],ground:true});
      f.update(202);expect(b.calls).toBe(1);expect(b.group.children).toHaveLength(1);expect(b.fade).toBeGreaterThan(0);
    }finally{f.dispose();}
  });
});

describe('steady adaptive quality',()=>{
  it('never changes pixel ratio while the camera target moves',()=>{
    const f=viewFixture();try{for(let frame=0;frame<200;frame++){f.advance();f.view.navigation.target.x+=2;f.paint();}
      console.log(`Moving quality: DPR changes=${(f.renderer.setPixelRatio as jest.Mock).mock.calls.length}`);
      expect(f.renderer.setPixelRatio).not.toHaveBeenCalled();
    }finally{f.view.dispose();}
  });
  it('renders after every pixel ratio change before paint returns',()=>{
    const f=viewFixture();try{for(let frame=0;frame<200;frame++){f.advance();f.events.length=0;f.paint();if(f.events.includes('resize')){
      console.log(`Quality change at ${f.time} ms: ${f.events.join(' -> ')}`);
      expect(f.events[f.events.length-1]).toBe('render');}}
      expect(f.renderer.setPixelRatio).toHaveBeenCalled();
    }finally{f.view.dispose();}
  });
  it.each(['pan','turn','pitch','zoom','fly','shake'] as const)('holds both resolution and draw budget during %s',motion=>{
    const f=viewFixture();try{
      for(let frame=0;frame<200;frame++){
        f.advance();const n=f.view.navigation;
        if(motion==='pan')f.view.pan(1,0);if(motion==='turn')n.rotate(1,0);if(motion==='pitch')n.rotate(0,1);
        if(motion==='zoom')n.zoom(1,400,300,800,600);if(motion==='fly')n.centreOn(frame%2?10:40,25);if(motion==='shake')n.shake();
        f.paint();expect(f.view.chunks.drawBudget).toBe(180);
      }
      expect(f.renderer.setPixelRatio).not.toHaveBeenCalled();
    }finally{f.view.dispose();}
  });
  it('waits one second after motion, three seconds between changes and clears old samples',()=>{
    const f=viewFixture();try{
      for(let frame=0;frame<150;frame++){f.advance();f.view.navigation.target.x+=2;f.paint();}
      for(let frame=0;frame<24;frame++){f.advance();f.paint();}expect(f.renderer.setPixelRatio).not.toHaveBeenCalled();
      f.advance(1000);for(let frame=0;frame<30;frame++){f.advance();f.paint();if((f.renderer.setPixelRatio as jest.Mock).mock.calls.length)break;}
      expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(1);
      expect((f.view as unknown as {frameTimes:number[];intervals:number[]}).frameTimes).toHaveLength(0);
      expect((f.view as unknown as {intervals:number[]}).intervals).toHaveLength(0);
      f.cost(1);for(let frame=0;frame<120;frame++){f.advance();f.paint();}expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(1);
      // Fresh, fast samples prevent the old 24 ms frames from causing another downgrade.
      for(let frame=0;frame<150;frame++){f.advance();f.paint();}expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(1);
      f.advance(10000);for(let frame=0;frame<30;frame++){f.advance();f.paint();if((f.renderer.setPixelRatio as jest.Mock).mock.calls.length>1)break;}
      expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(2);expect(f.renderer.getPixelRatio()).toBe(2);
    }finally{f.view.dispose();}
  });
  it('keeps protecting frame time at DPR 1 by lowering the draw budget, with the same cooldown',()=>{
    const f=viewFixture();try{
      f.renderer.setPixelRatio(1);(f.renderer.setPixelRatio as jest.Mock).mockClear();
      for(let frame=0;frame<120;frame++){f.advance();f.paint();}expect(f.view.chunks.drawBudget).toBe(168);
      for(let frame=0;frame<60;frame++){f.advance();f.paint();}expect(f.view.chunks.drawBudget).toBe(168);
      for(let frame=0;frame<60;frame++){f.advance();f.paint();}expect(f.view.chunks.drawBudget).toBe(156);
      expect(f.renderer.setPixelRatio).not.toHaveBeenCalled();
    }finally{f.view.dispose();}
  });
  it('cannot lower again within three seconds even when 120 fresh samples are already ready',()=>{
    const f=viewFixture();try{
      for(let frame=0;frame<150;frame++)f.paint();expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(1);
      for(let frame=0;frame<120;frame++)f.paint();expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(1);
      for(let frame=0;frame<30;frame++)f.paint();expect(f.renderer.setPixelRatio).toHaveBeenCalledTimes(2);
    }finally{f.view.dispose();}
  });
});
