/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, OrthographicCamera,
  Mesh, PlaneGeometry, PCFShadowMap, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, WebGLRenderTarget } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { CityView, ToolHover, TilePoint, TileRect } from '../../cityView.js';
import { DAY_SKY_URL } from '../materials/catalog.js';
import { getMaterial, tint, updateRoadSignals, updateCommercialDisplays, updateTransportClock } from '../materials/library.js';
import { applyWorldUV } from '../util/geometry.js';
import { CityCamera } from './camera.js';
import { pickTile, visibleTileRect } from './picking.js';
import { CityChunks } from './chunks.js';
import { TileSnapshot } from './tileModels.js';
import { CitySprites } from './sprites.js';
import { ToolOutline } from './overlay.js';
import { browserPrototypeProvider } from './worker-provider.js';
import type { PrototypeProvider } from './prototypes.js';
import type { CityViewSetup } from './types.js';
export type { CityViewSetup, CityMapReader, BlockMapReader } from './types.js';
export interface CityMetrics { frameMs:number;intervalMs:number;drawCalls:number;triangles:number;pendingChunks:number;pendingModels:number;unknownTiles:number;rebuildMs:number;firstFrameMs:number;detailSwaps:number;dirtSwaps:number;pixelRatioChanges:number }
export interface CityViewDependencies {
  canvas?:HTMLCanvasElement; rendererFactory?:(canvas:HTMLCanvasElement)=>WebGLRenderer;
  provider?:PrototypeProvider;now?:()=>number;headless?:boolean;
}
/** No animation loop or game state mutations: the game owns paint(), including while paused. */
export class CityView3D implements CityView {
  readonly kind='3d' as const;readonly scene=new Scene();readonly navigation:CityCamera;readonly chunks:CityChunks;
  readonly metrics:CityMetrics={frameMs:0,intervalMs:0,drawCalls:0,triangles:0,pendingChunks:0,pendingModels:0,unknownTiles:0,rebuildMs:0,firstFrameMs:0,detailSwaps:0,dirtSwaps:0,pixelRatioChanges:0};
  readonly canvas:HTMLCanvasElement;readonly renderer:WebGLRenderer;
  private snapshot:TileSnapshot;private sprites=new CitySprites();private outline:ToolOutline;
  private sun=new DirectionalLight(0xffe4bc,3.3);private now:()=>number;private disposed=false;private resizeObserver?:ResizeObserver;
  private listeners:{type:string;listener:EventListener}[]=[];private drag:{button:number;x:number;y:number}|null=null;
  private last:number;private created:number;private seconds=0;private frameTimes:number[]=[];private intervals:number[]=[];
  private environment?:WebGLRenderTarget;private pixelWidth=0;private pixelHeight=0;private headless:boolean;
  private qualityFrames=0;private lastQualityChange:number;private lastMotion:number;private fastSince:number|null=null;
  private cameraPose:number[]=[];
  private bed:Mesh;
  constructor(readonly setup:CityViewSetup,dependencies:CityViewDependencies={}) {
    this.now=dependencies.now??(()=>performance.now());this.created=this.now();this.last=this.created;this.headless=dependencies.headless??false;
    this.lastQualityChange=this.created;this.lastMotion=this.created;
    if(!Number.isInteger(setup.map.width)||!Number.isInteger(setup.map.height)||setup.map.width<=0||setup.map.height<=0)throw new RangeError('A city map must have positive integer dimensions');
    this.canvas=dependencies.canvas??document.createElement('canvas');this.canvas.id='MicropolisCanvas';
    this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    // Construct WebGL and the worker before appending: startup failures leave no orphan canvas for the 2D fallback.
    this.renderer=dependencies.rendererFactory?.(this.canvas)??new WebGLRenderer({canvas:this.canvas,antialias:true,preserveDrawingBuffer:true});
    let provider:PrototypeProvider;
    try{provider=dependencies.provider??browserPrototypeProvider();}catch(error){this.renderer.dispose();throw error;}
    this.navigation=new CityCamera(setup.map.width,setup.map.height,this.now,typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.cameraPose=this.navigation.camera.matrixWorld.elements.slice();
    this.snapshot=new TileSnapshot(setup.map.width,setup.map.height);this.snapshot.sync(setup.map);this.snapshot.coverZones();
    this.chunks=new CityChunks(this.snapshot,setup.region,provider,this.now);this.outline=new ToolOutline(setup.map.width,setup.map.height);
    const bedGeometry=new PlaneGeometry(setup.map.width*10,setup.map.height*10).rotateX(-Math.PI/2).translate(setup.map.width*5,-3.015,setup.map.height*5);
    this.bed=new Mesh(applyWorldUV(bedGeometry,1),tint('dirt_laterite',0x4c5543));bedGeometry.dispose();this.scene.add(this.bed);
    this.scene.add(this.chunks.root,this.sprites.root,this.outline.root);
    this.scene.background=new Color(0xc8dde2);this.scene.fog=new Fog(0xc8dde2,2400,7000);
    this.scene.add(new HemisphereLight(0xd7edff,0xb5a385,1.2),this.sun,this.sun.target);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.15;
    this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,2));
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=PCFShadowMap;
    setup.container.append(this.canvas);this.resize();this.bindMouse();
    if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>{if(!this.disposed){this.resize();this.render();}});this.resizeObserver.observe(setup.container);}
    if(!this.headless)this.loadSky();
    this.render();this.metrics.firstFrameMs=this.now()-this.created;
  }
  get width():number{return this.setup.container.clientWidth;}
  get height():number{return this.setup.container.clientHeight;}
  private resize():void {
    if(this.pixelWidth===this.width&&this.pixelHeight===this.height)return;this.pixelWidth=this.width;this.pixelHeight=this.height;
    this.renderer.setSize(Math.max(1,this.width),Math.max(1,this.height),false);this.navigation.camera.aspect=Math.max(1,this.width)/Math.max(1,this.height);this.navigation.camera.updateProjectionMatrix();
  }
  private loadSky():void {
    new HDRLoader().load(DAY_SKY_URL,texture=>{if(this.disposed){texture.dispose();return;}
      const pmrem=new PMREMGenerator(this.renderer);this.environment=pmrem.fromEquirectangular(texture);this.scene.environment=this.environment.texture;texture.dispose();pmrem.dispose();
    },undefined,()=>{ /* Warm sun and the hemisphere light are the HDRI fallback. */ });
  }
  private bindMouse():void {
    const listen=(type:string,fn:EventListener):void=>{this.canvas.addEventListener(type,fn,{passive:false});this.listeners.push({type,listener:fn});};
    listen('contextmenu',e=>e.preventDefault());
    listen('pointerdown',e=>{const p=e as PointerEvent;if(p.button!==1&&p.button!==2)return;e.preventDefault();this.drag={button:p.button,x:p.clientX,y:p.clientY};this.canvas.setPointerCapture?.(p.pointerId);});
    listen('pointermove',e=>{const p=e as PointerEvent;if(!this.drag)return;const dx=p.clientX-this.drag.x,dy=p.clientY-this.drag.y;
      if(this.drag.button===2)this.navigation.rotate(dx,dy);else this.navigation.pan(dx,dy,this.height);this.drag.x=p.clientX;this.drag.y=p.clientY;});
    listen('pointerup',()=>{this.drag=null;});listen('pointercancel',()=>{this.drag=null;});
    listen('wheel',e=>{const w=e as WheelEvent;w.preventDefault();const rect=this.canvas.getBoundingClientRect();
      this.navigation.zoom(w.deltaY*(w.deltaMode===1?16:w.deltaMode===2?this.height:1),w.clientX-rect.left,w.clientY-rect.top,this.width,this.height);});
  }
  paint(hover:ToolHover|null,sprites:unknown[]|null,isPaused:boolean):void {
    if(this.disposed)return;const start=this.now(),dt=Math.max(0,Math.min(.1,(start-this.last)/1000)),interval=start-this.last;this.last=start;
    this.resize();this.chunks.dirty(this.snapshot.sync(this.setup.map));
    this.navigation.update(start,this.chunks.tallestNear(this.navigation.target));
    const pose=this.navigation.camera.matrixWorld.elements;
    if(this.drag||this.navigation.isAnimating(start)||pose.some((value,i)=>Math.abs(value-this.cameraPose[i])>1e-6))this.lastMotion=start;
    this.lastMotion=Math.max(this.lastMotion,this.navigation.lastInteractionAt);this.cameraPose=pose.slice();
    this.chunks.update(this.visibleTiles(),this.navigation.target,this.navigation.distance);
    this.outline.update(hover);this.sprites.update(sprites,dt,isPaused,this.navigation.distance>950?[]:this.chunks.roadsNear(this.navigation.target),this.setup.overlays.trafficDensityMap,this.seconds);
    if(!isPaused){this.seconds+=dt;updateRoadSignals(this.seconds);updateCommercialDisplays(this.seconds);updateTransportClock(this.seconds);
      const normal=getMaterial('water_river').normalMap;if(normal)normal.offset.set((this.seconds*.014)%1,(this.seconds*.008)%1);}
    this.render();this.frameTimes.push(this.now()-start);this.intervals.push(interval);if(this.frameTimes.length>120)this.frameTimes.shift();if(this.intervals.length>120)this.intervals.shift();
    this.metrics.frameMs=this.frameTimes.reduce((a,b)=>a+b,0)/this.frameTimes.length;
    this.metrics.intervalMs=this.intervals.reduce((a,b)=>a+b,0)/this.intervals.length;
    this.metrics.drawCalls=this.renderer.info.render.calls;this.metrics.triangles=this.renderer.info.render.triangles;
    this.metrics.pendingChunks=this.chunks.pendingChunks;this.metrics.unknownTiles=this.chunks.unknownTiles;this.metrics.rebuildMs=this.chunks.rebuildMs;
    this.metrics.pendingModels=this.chunks.pendingModels;
    this.metrics.detailSwaps=this.chunks.detailSwaps;this.metrics.dirtSwaps=this.chunks.dirtSwaps;
    if(this.metrics.frameMs<9){if(this.fastSince===null)this.fastSince=start;}else this.fastSince=null;
    // Adapt only after navigation settles, using fresh samples at each quality level.
    if(!this.headless&&++this.qualityFrames%30===0&&this.frameTimes.length===120&&!this.metrics.pendingChunks&&!this.metrics.pendingModels
      &&start-this.lastMotion>=1000&&start-this.lastQualityChange>=3000){
      const ratio=this.renderer.getPixelRatio(),limit=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,2);
      let nextRatio=ratio,nextBudget=this.chunks.drawBudget;
      if(this.metrics.frameMs>22){if(ratio>1)nextRatio=Math.max(1,ratio-.25);else nextBudget=Math.max(60,nextBudget-12);}
      else if(this.fastSince!==null&&start-this.fastSince>=10000&&start-this.lastQualityChange>=10000){
        if(nextBudget<180)nextBudget=Math.min(180,nextBudget+6);else if(ratio<limit)nextRatio=Math.min(limit,ratio+.25);
      }
      if(nextRatio!==ratio||nextBudget!==this.chunks.drawBudget){
        this.chunks.drawBudget=nextBudget;this.lastQualityChange=start;this.fastSince=null;this.frameTimes=[];this.intervals=[];this.qualityFrames=0;
        if(nextRatio!==ratio){this.renderer.setPixelRatio(nextRatio);this.metrics.pixelRatioChanges++;this.render();}
      }
    }
  }
  private render():void {
    const t=this.navigation.target,span=Math.min(450,Math.max(130,this.navigation.distance*.75));
    this.sun.position.set(t.x-180,380,t.z+160);this.sun.target.position.copy(t);
    const c=this.sun.shadow.camera;c.left=-span;c.right=span;c.top=span;c.bottom=-span;c.near=1;c.far=900;c.updateProjectionMatrix();
    this.renderer.render(this.scene,this.navigation.camera);
  }
  tileAt(x:number,y:number):TilePoint|null{return pickTile(this.navigation.camera,x,y,this.width,this.height,this.setup.map.width,this.setup.map.height);}
  visibleTiles():TileRect|null{return visibleTileRect(this.navigation.camera,this.width,this.height,this.setup.map.width,this.setup.map.height,this.navigation.camera.far);}
  moveNorth():void{this.navigation.move('north');}moveEast():void{this.navigation.move('east');}moveSouth():void{this.navigation.move('south');}moveWest():void{this.navigation.move('west');}
  /** Public pixel-delta adapter for the game's no-tool left drag. */
  pan(dx:number,dy:number):void {this.navigation.pan(dx,dy,this.height);}
  centreOn(x:number,y:number):void{this.navigation.centreOn(x,y);}shake():void{this.navigation.shake();}
  screenshotVisible():string{if(this.disposed)return '';this.render();return this.canvas.toDataURL('image/png');}
  screenshotMap():string {
    if(this.disposed)return '';if(this.headless)return this.canvas.toDataURL('image/png');
    this.chunks.dirty(this.snapshot.sync(this.setup.map));this.chunks.finishMapLOD();
    const w=this.setup.map.width*10,h=this.setup.map.height*10,scale=Math.min(4096/Math.max(w,h),.8),width=Math.ceil(w*scale),height=Math.ceil(h*scale);
    const camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,1,10000);camera.position.set(w/2,4000,h/2);camera.up.set(0,0,-1);camera.lookAt(w/2,0,h/2);
    const target=new WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4),previous=this.renderer.getRenderTarget(),outline=this.outline.root.visible;
    target.texture.colorSpace=SRGBColorSpace;
    try {
      this.outline.root.visible=false;this.scene.fog=null;
      // Map snapshots use the complete low-detail province, not only the nearby detailed chunks.
      this.chunks.mapLOD(true);this.renderer.setRenderTarget(target);this.renderer.render(this.scene,camera);this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)return this.screenshotVisible();
      const image=context.createImageData(width,height);for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);context.putImageData(image,0,0);return canvas.toDataURL('image/png');
    }finally{this.renderer.setRenderTarget(previous);target.dispose();this.chunks.mapLOD(false);this.outline.root.visible=outline;this.scene.fog=new Fog(0xc8dde2,2400,7000);}
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.resizeObserver?.disconnect();this.listeners.forEach(({type,listener})=>this.canvas.removeEventListener(type,listener));
    this.chunks.dispose();this.sprites.dispose();this.outline.dispose();this.bed.geometry.dispose();this.environment?.dispose();this.sun.shadow.dispose();this.scene.clear();this.renderer.dispose();this.canvas.remove();
  }
}
export function createCityView3D(setup:CityViewSetup):CityView3D{return new CityView3D(setup);}
