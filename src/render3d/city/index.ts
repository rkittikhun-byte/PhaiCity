/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, OrthographicCamera,
  Mesh, PlaneGeometry, PCFSoftShadowMap, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, WebGLRenderTarget } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { CityView, ToolHover, TilePoint, TileRect } from '../../cityView.js';
import { DAY_SKY_URL } from '../materials/catalog.js';
import { cityBedMaterial, getMaterial, setCityWind, setNightMode, tint, updateRoadSignals, updateCommercialDisplays, updateTransportClock } from '../materials/library.js';
import { seasonWind } from '../../wind.js';
import { applyWorldUV } from '../util/geometry.js';
import { CityCamera } from './camera.js';
import { groundAt, pickTile, visibleTileRect } from './picking.js';
import { CityChunks } from './chunks.js';
import { TileSnapshot } from './tileModels.js';
import { CityHeightField } from './heightfield.js';
import { CitySprites } from './sprites.js';
import { ToolOutline, ZoneGrid } from './overlay.js';
import { SkyDome } from './sky.js';
import { StreetLabels } from './streetLabels.js';
import { ProvinceBackdropView } from './provinceBackdrop.js';
import { RoadCurves } from './roadCurves.js';
import { ZoneCellsView } from './zoneCellsView.js';
import { LayerOverlay } from './layerOverlay.js';
import { CityBuses } from './buses.js';
import { CityFoliage, CityPedestrians, CityRoadTraffic } from './pedestrians.js';
import { ProblemIcons } from './problemIcons.js';
import type { CellMap } from '../../zoneCells.js';
import { realUnits } from '../../roadGeometry.js';
import { browserPrototypeProvider } from './worker-provider.js';
import type { PrototypeProvider } from './prototypes.js';
import type { CityViewSetup } from './types.js';
export type { CityViewSetup, CityMapReader, BlockMapReader } from './types.js';
export { CityFoliage, CityPedestrians, CityRoadTraffic } from './pedestrians.js';
export interface CityMetrics { frameMs:number;intervalMs:number;drawCalls:number;triangles:number;pendingChunks:number;pendingModels:number;unknownTiles:number;rebuildMs:number;firstFrameMs:number;detailSwaps:number;dirtSwaps:number;pixelRatioChanges:number }
export interface CityViewDependencies {
  canvas?:HTMLCanvasElement; rendererFactory?:(canvas:HTMLCanvasElement)=>WebGLRenderer;
  provider?:PrototypeProvider;now?:()=>number;headless?:boolean;
  /** A native-resolution benchmark can cap supersampling independently of the host display. */
  pixelRatioLimit?:number;
}

const cDayHaze = new Color(0xc8dde2);
const cNightHaze = new Color(0x121722);
const cTwilightHaze = new Color(0xdf8456);
const cHemiSkyDay = new Color(0xd7edff);
const cHemiSkyNight = new Color(0x4c68a8);
const cHemiSkyTwilight = new Color(0xf6b080);
const cHemiGndDay = new Color(0xb5a385);
const cHemiGndNight = new Color(0x181f2c);
const cHemiGndTwilight = new Color(0x6a402d);
const cSunDay = new Color(0xffe4bc);
const cSunNight = new Color(0x9bb8ff);
const cSunTwilight = new Color(0xff7a33);
const cZenithDay = new Color(0x4f8fd0);
const cZenithNight = new Color(0x060b18);
const cZenithTwilight = new Color(0x2c3b68);
const cHorizonDay = new Color(0xd5e6ef);
const cHorizonNight = new Color(0x151c2d);
const cHorizonTwilight = new Color(0xfb8b51);
const tHaze = new Color();
const tSky = new Color();
const tGnd = new Color();
const tSun = new Color();
const tZenith = new Color();
const tHorizon = new Color();

/** No animation loop or game state mutations: the game owns paint(), including while paused. */
export class CityView3D implements CityView {
  readonly kind='3d' as const;readonly scene=new Scene();readonly navigation:CityCamera;readonly chunks:CityChunks;
  readonly metrics:CityMetrics={frameMs:0,intervalMs:0,drawCalls:0,triangles:0,pendingChunks:0,pendingModels:0,unknownTiles:0,rebuildMs:0,firstFrameMs:0,detailSwaps:0,dirtSwaps:0,pixelRatioChanges:0};
  readonly canvas:HTMLCanvasElement;readonly renderer:WebGLRenderer;
  readonly terrain:CityHeightField;
  readonly pixelRatioLimit:number;
  private snapshot:TileSnapshot;private sprites=new CitySprites();private pedestrians:CityPedestrians;private roadTraffic:CityRoadTraffic;private foliage:CityFoliage;private outline:ToolOutline;private zones:ZoneGrid;
  private sun=new DirectionalLight(0xffe4bc,3.3);private hemi=new HemisphereLight(0xd7edff,0xb5a385,1.25);private now:()=>number;private disposed=false;private resizeObserver?:ResizeObserver;
  private listeners:{type:string;listener:EventListener}[]=[];private drag:{button:number;x:number;y:number}|null=null;
  private last:number;private created:number;private seconds=0;private frameTimes:number[]=[];private intervals:number[]=[];
  private environment?:WebGLRenderTarget;private pixelWidth=0;private pixelHeight=0;private headless:boolean;
  private qualityFrames=0;private lastQualityChange:number;private lastMotion:number;private fastSince:number|null=null;
  private cameraPose:number[]=[];
  private streets?:StreetLabels;private province?:ProvinceBackdropView;private curves:RoadCurves;private cells?:ZoneCellsView;private layer?:LayerOverlay;private buses?:CityBuses;private problems?:ProblemIcons;
  private bed:Mesh;private bedDrop:number;private wideBed:boolean;private sky:SkyDome;private fog:Fog;private fogNear:number;private fogFar:number;private wind={x:0,y:0,strength:0};private swaySeconds=0;private houseSign='';
  private darkMode=false;
  private dayNightMode:'auto'|'day'|'night'='auto';
  private readonly CYCLE_DURATION=180;
  private sunAngle=Math.PI*0.35;
  private lastNightFactor=-1;
  constructor(readonly setup:CityViewSetup,dependencies:CityViewDependencies={}) {
    this.now=dependencies.now??(()=>performance.now());this.created=this.now();this.last=this.created;this.headless=dependencies.headless??false;
    this.pixelRatioLimit=Math.max(1,Math.min(1.25,dependencies.pixelRatioLimit??1.25));
    this.lastQualityChange=this.created;this.lastMotion=this.created;
    if(!Number.isInteger(setup.map.width)||!Number.isInteger(setup.map.height)||setup.map.width<=0||setup.map.height<=0)throw new RangeError('A city map must have positive integer dimensions');
    this.canvas=dependencies.canvas??document.createElement('canvas');this.canvas.id='MicropolisCanvas';
    this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    // Construct WebGL and the worker before appending: startup failures leave no orphan canvas for the 2D fallback.
    this.renderer=dependencies.rendererFactory?.(this.canvas)??new WebGLRenderer({canvas:this.canvas,antialias:true,preserveDrawingBuffer:true});
    let provider:PrototypeProvider;
    try{provider=dependencies.provider??browserPrototypeProvider();}catch(error){this.renderer.dispose();throw error;}
    this.snapshot=new TileSnapshot(setup.map.width,setup.map.height);this.snapshot.source=setup.map;this.snapshot.enableConstruction=!this.headless;this.snapshot.sync(setup.map);this.snapshot.coverZones();
    this.snapshot.roadLevel=setup.roadLevel??1;
    // A real-scale city map's things at their real size (tileModels.ts atRealSize, roadGeometry.ts realUnits)
    this.snapshot.realUnits=realUnits(setup.map.tileSizeM);this.sprites.size=Math.min(1,this.snapshot.realUnits??1);
    // Plain roads and railways as smooth curves rather than tile by tile (roadCurves.ts; owner, 14 Oct 2026)
    this.snapshot.curves=true;
    this.terrain=new CityHeightField(this.snapshot,setup.map);
    this.curves=new RoadCurves(this.snapshot,this.terrain);this.snapshot.roadSnap=(x,z,reach)=>this.curves.nearest(x,z,reach);
    this.pedestrians=new CityPedestrians(this.snapshot,this.terrain,this.sprites.size);
    this.roadTraffic=new CityRoadTraffic(this.snapshot,this.terrain,setup.region,this.sprites.size);
    this.foliage=new CityFoliage(this.snapshot,this.terrain,setup.region,this.sprites.size);
    this.navigation=new CityCamera(setup.map.width,setup.map.height,this.now,typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches,this.terrain);
    // On a real-scale city map the camera comes down to the street
    if((setup.map.tileSizeM??0)>0&&(setup.map.tileSizeM??0)<=40){this.navigation.minDistance=5;this.navigation.clearance=1.1;}
    this.cameraPose=this.navigation.camera.matrixWorld.elements.slice();
    this.chunks=new CityChunks(this.snapshot,setup.region,provider,this.now,this.terrain);this.outline=new ToolOutline(setup.map.width,setup.map.height,this.terrain);
    this.zones=new ZoneGrid(setup.map,this.terrain,this.now);
    // On a map painted a cell at a time, its zone cells along the roads (zoneCellsView.ts) take the zone grid's place
    if((setup.map as unknown as CellMap).cellZones){this.cells=new ZoneCellsView(setup.map as unknown as CellMap,this.terrain);this.scene.add(this.cells.root);}
    // Under the map, the bed; a real-scale city map's runs far past its edges in the land's colour, into the haze, so
    // the land seems to go on (docs/CITY_SCALE.md)
    // ... unless the province itself lies round it (provinceBackdrop.ts)
    const wide=(setup.map.tileSizeM??0)>0&&(setup.map.tileSizeM??0)<=40;this.wideBed=wide;this.bedDrop=wide?.4:3.015;const spread=wide&&!setup.province?9:1;
    const bedGeometry=new PlaneGeometry(setup.map.width*10*spread,setup.map.height*10*spread).rotateX(-Math.PI/2).translate(setup.map.width*5,this.terrain.min-this.bedDrop,setup.map.height*5);
    this.bed=new Mesh(applyWorldUV(bedGeometry,1),wide?cityBedMaterial(0x7a9150):tint('dirt_laterite',0x4c5543));bedGeometry.dispose();this.scene.add(this.bed);
    this.outline.snap=this.snapshot.roadSnap;this.outline.lotOf=(index)=>this.curves.lotAt(index);this.outline.scaledBuildings=Boolean((setup.map as unknown as CellMap).cellZones);
    this.scene.add(this.chunks.root,this.curves.root,this.sprites.root,this.pedestrians.root,this.roadTraffic.root,this.foliage.root,this.outline.root,this.zones.root);
    // Street names along the roads (src/streetNames.ts), when the game says how to write them
    if(setup.streetName){this.streets=new StreetLabels(setup.map,setup.streetName,this.terrain,this.now);this.scene.add(this.streets.root);}
    // The whole province round a district's map, so the wheel zooms out over all of it (provinceBackdrop.ts)
    if(setup.province){this.province=new ProvinceBackdropView(setup.province.backdrop,setup.province.district,this.terrain);this.scene.add(this.province.root);
      this.navigation.maxDistance=Math.max(this.navigation.maxDistance,this.province.span*2);}
    // A sky with clouds, and haze into the distance; a real-scale city map's haze comes nearer (docs/CITY_SCALE.md)
    const haze=new Color(0xc8dde2),city=(setup.map.tileSizeM??0)>0&&(setup.map.tileSizeM??0)<=40;
    this.fogNear=city?900:2400;this.fogFar=city?5500:7000;this.fog=new Fog(haze,this.fogNear,this.fogFar);
    this.scene.background=haze;this.scene.fog=this.fog;this.sky=new SkyDome(9000,haze);this.scene.add(this.sky.mesh);
    this.scene.add(this.hemi,this.sun,this.sun.target);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.00035;this.sun.shadow.normalBias=.06;
    this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,this.pixelRatioLimit));
    this.renderer.outputColorSpace=SRGBColorSpace;this.renderer.toneMapping=ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=PCFSoftShadowMap;
    setup.container.append(this.canvas);this.resize();this.bindMouse();
    if(typeof ResizeObserver!=='undefined'){this.resizeObserver=new ResizeObserver(()=>{if(!this.disposed){this.resize();this.render();}});this.resizeObserver.observe(setup.container);}
    if(!this.headless)this.loadSky();
    this.render();this.metrics.firstFrameMs=this.now()-this.created;
  }
  /** Continuous day/night and twilight color interpolation (GC-free, zero allocations) */
  private applyDayNight(nightFactor:number,twilight:number,sunAngle?:number):void {
    const wasDark=this.darkMode;
    this.darkMode=nightFactor>0.5;
    if(sunAngle!==undefined)this.sunAngle=sunAngle;
    if(Math.abs(nightFactor-this.lastNightFactor)<0.002&&wasDark===this.darkMode)return;
    this.lastNightFactor=nightFactor;

    tHaze.copy(cDayHaze).lerp(cNightHaze,nightFactor).lerp(cTwilightHaze,twilight*0.65);
    this.fog.color.copy(tHaze);this.scene.background=tHaze;

    tSky.copy(cHemiSkyDay).lerp(cHemiSkyNight,nightFactor).lerp(cHemiSkyTwilight,twilight*0.7);
    tGnd.copy(cHemiGndDay).lerp(cHemiGndNight,nightFactor).lerp(cHemiGndTwilight,twilight*0.7);
    this.hemi.color.copy(tSky);this.hemi.groundColor.copy(tGnd);
    this.hemi.intensity=(1.25*(1-nightFactor)+0.65*nightFactor)+twilight*0.2;

    tSun.copy(cSunDay).lerp(cSunNight,nightFactor).lerp(cSunTwilight,twilight*0.85);
    this.sun.color.copy(tSun);this.sun.intensity=Math.max(0.7,3.3*(1-nightFactor)+1.2*nightFactor);

    tZenith.copy(cZenithDay).lerp(cZenithNight,nightFactor).lerp(cZenithTwilight,twilight*0.75);
    tHorizon.copy(cHorizonDay).lerp(cHorizonNight,nightFactor).lerp(cHorizonTwilight,twilight*0.85);
    this.sky.setColors(tZenith,tHorizon,tHaze);

    setNightMode(this.darkMode, nightFactor);

    if(wasDark!==this.darkMode){
      this.bed.material=this.wideBed?cityBedMaterial(this.darkMode?0x1b222e:0x7a9150):tint('dirt_laterite',this.darkMode?0x1a2028:0x4c5543);
    }
  }
  private updateDayNight():void {
    if(this.dayNightMode==='day'){this.applyDayNight(0,0,Math.PI*0.35);return;}
    if(this.dayNightMode==='night'){this.applyDayNight(1,0,-Math.PI*0.5);return;}
    const phase=(this.seconds/this.CYCLE_DURATION)%1.0;
    const angle=phase*Math.PI*2;
    const elevation=Math.sin(angle);
    const nightFactor=Math.max(0,Math.min(1,(-elevation+0.18)/0.36));
    const twilight=Math.max(0,1-Math.abs(elevation)/0.22);
    this.applyDayNight(nightFactor,twilight,angle);
  }
  /** Switch between Day Mode, Dark Mode and Auto Day/Night Cycle */
  setDarkMode(on:boolean):void {
    this.dayNightMode=on?'night':'day';
    this.lastNightFactor=-1;
    this.updateDayNight();
    this.render();
  }
  toggleDarkMode():boolean {
    if(this.dayNightMode==='auto')this.dayNightMode='day';
    else if(this.dayNightMode==='day')this.dayNightMode='night';
    else this.dayNightMode='auto';
    this.lastNightFactor=-1;
    this.updateDayNight();
    this.render();
    return this.darkMode;
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
      if(this.drag.button===2){if(p.shiftKey)this.navigation.rotate(dx,dy);else this.navigation.pan(dx,dy,this.height);}
      else this.navigation.pan(dx,dy,this.height);this.drag.x=p.clientX;this.drag.y=p.clientY;});
    listen('pointerup',()=>{this.drag=null;});listen('pointercancel',()=>{this.drag=null;});
    listen('wheel',e=>{const w=e as WheelEvent;w.preventDefault();const rect=this.canvas.getBoundingClientRect();
      if(w.ctrlKey){this.navigation.zoom(w.deltaY*4,w.clientX-rect.left,w.clientY-rect.top,this.width,this.height);}
      else{this.navigation.zoom(w.deltaY*(w.deltaMode===1?16:w.deltaMode===2?this.height:1),w.clientX-rect.left,w.clientY-rect.top,this.width,this.height);}});
  }
  /** Shows the tiles that can take painted zones along the roads (src/plots.ts), while a brush or a road tool is in hand. */
  zoneGrid(on:boolean):void {if(this.cells)this.cells.show(on);else this.zones.show(on);}
  pointAt(x:number,y:number):{x:number;y:number}|null{const p=groundAt(this.navigation.camera,x,y,this.width,this.height,this.terrain);
    return p&&p.x>=0&&p.z>=0&&p.x<this.setup.map.width*10&&p.z<this.setup.map.height*10?{x:p.x/10,y:p.z/10}:null;}
  /** A layer of the city map over the ground, or none (layerOverlay.ts) */
  showLayer(tiles:HTMLCanvasElement|null):void {
    if(!this.layer){if(!tiles)return;this.layer=new LayerOverlay(this.setup.map.width,this.setup.map.height,this.terrain);this.scene.add(this.layer.root);}
    this.layer.show(tiles);
  }
  /** The player's language changed: write the street names again. */
  relabelStreets():void {this.streets?.relabel();}
  /** The city bought land (src/landBlocks.ts): shade what it still has not. */
  landChanged():void {this.chunks.surfaces?.updateMask();this.cells?.refresh();}
  paint(hover:ToolHover|null,sprites:unknown[]|null,isPaused:boolean):void {
    if(this.disposed)return;const start=this.now(),dt=Math.max(0,Math.min(.1,(start-this.last)/1000)),interval=start-this.last;this.last=start;
    this.resize();const synced=this.snapshot.sync(this.setup.map),built=this.snapshot.stepConstruction(this.seconds);
    const changed=built.length?[...new Set([...synced,...built])]:synced;
    // The ruler's house rises a level or takes a wing without its tiles changing: rebuild it when it does
    {const house=this.setup.map.rulerHouse,sign=house?`${house.x},${house.y},${house.level},${(house.wings??[]).join(',')}`:'';
      if(sign!==this.houseSign){this.houseSign=sign;if(house)changed.push(house.y*this.setup.map.width+house.x);}}
    const raised=this.terrain.update(changed);this.chunks.dirty(raised.length?[...new Set([...changed,...raised])]:changed);
    if(changed.length||raised.length){this.curves.update(changed,raised);this.foliage.invalidate();}
    if(changed.length&&this.cells)this.cells.refresh();
    if(raised.length){const p=this.bed.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,this.terrain.min-this.bedDrop);p.needsUpdate=true;this.bed.geometry.computeBoundingSphere();}
    // The camera stays over what stands under it, not over what it looks at, so it can come down and look across the
    // city to the horizon (owner, 14 Oct 2026: "มุมเงยหน้า สุดแค่ตรงนี้เอง")
    this.navigation.update(start,this.chunks.tallestNear(this.navigation.camera.position,24));
    const pose=this.navigation.camera.matrixWorld.elements;
    let poseMoved=false;
    for(let i=0;i<16;i++){if(Math.abs(pose[i]-this.cameraPose[i])>1e-6){poseMoved=true;this.cameraPose[i]=pose[i];}}
    if(this.drag||this.navigation.isAnimating(start)||poseMoved)this.lastMotion=start;
    this.lastMotion=Math.max(this.lastMotion,this.navigation.lastInteractionAt);
    const visible=this.visibleTiles();this.chunks.update(visible,this.navigation.target,this.navigation.distance);
    this.streets?.update(this.navigation.camera,this.navigation.distance,visible);
    this.outline.update(hover&&hover.cellPoint!==undefined?null:hover);this.zones.update(changed.length>0);
    this.cells?.update(hover?.cellPoint??null,hover?.colour??null,hover?.cellKeys??null);
    // Icons over the plots held back for want of power, water or a road (problemIcons.ts)
    const whyMap=this.setup.map as unknown as {width:number;height:number;plotWhy?:Uint8Array|null};
    if(whyMap.plotWhy){if(!this.problems){this.problems=new ProblemIcons(whyMap,this.terrain);this.scene.add(this.problems.root);}this.problems.update(this.seconds);}
    // The city's buses driving their roads (buses.ts)
    const busMap=this.setup.map as unknown as {width:number;buses?:number[]};
    if(busMap.buses?.length){if(!this.buses){this.buses=new CityBuses(busMap,this.terrain,this.sprites.size);this.scene.add(this.buses.root);}
      this.buses.update(this.curves.drawnLines,this.seconds);}
    this.pedestrians.update(this.curves.drawnLines,this.navigation.target,this.navigation.distance,this.seconds);
    this.roadTraffic.update(this.curves.drawnLines,this.navigation.target,this.navigation.distance,this.seconds,this.setup.overlays.trafficDensityMap);
    this.foliage.update(this.curves.drawnLines,this.navigation.target,this.navigation.distance);
    this.sprites.update(sprites,dt,isPaused,[],this.setup.overlays.trafficDensityMap,this.seconds,(x,z)=>this.terrain.sample(x,z));
    if(!isPaused){this.seconds+=dt;updateRoadSignals(this.seconds);updateCommercialDisplays(this.seconds);updateTransportClock(this.seconds);
      const normal=getMaterial('water_river').normalMap;if(normal)normal.offset.set((this.seconds*.014)%1,(this.seconds*.008)%1);}
    this.updateDayNight();
    this.sky.update(this.navigation.camera.position,this.seconds);
    // The 2D view looks from far above, past the sky and the haze: a clear map
    this.sky.mesh.visible=!this.navigation.flat;this.scene.fog=this.navigation.flat?null:this.fog;
    // The haze keeps its distance from the camera, so the whole map seen from high up stays clear, and further over a
    // whole province, so its far side still shows
    const hazeOut=this.province?2:1;this.fog.near=this.fogNear+this.navigation.distance*.9*hazeOut;this.fog.far=this.fogFar+this.navigation.distance*1.5*hazeOut;
    // The season's wind sways the trees (src/wind.ts); it eases in rather than jumping when the month turns
    {const wind=seasonWind(this.setup.date().month,this.setup.windLevel??2),ease=Math.min(1,dt*.5);
      this.wind.x+=(wind.x-this.wind.x)*ease;this.wind.y+=(wind.y-this.wind.y)*ease;this.wind.strength+=(wind.strength-this.wind.strength)*ease;
      setCityWind(this.wind.x,this.wind.y,isPaused?this.wind.strength*.5:this.wind.strength,this.seconds+this.swaySeconds);if(isPaused)this.swaySeconds+=dt;}
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
      const ratio=this.renderer.getPixelRatio(),limit=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,this.pixelRatioLimit);
      const realScale=(this.snapshot.realUnits??1)<1,minRatio=1,minBudget=realScale?180:60;
      let nextRatio=ratio,nextBudget=this.chunks.drawBudget;
      if(this.metrics.frameMs>22){if(ratio>minRatio)nextRatio=Math.max(minRatio,ratio-.25);else nextBudget=Math.max(minBudget,nextBudget-12);}
      else if(this.fastSince!==null&&start-this.fastSince>=10000&&start-this.lastQualityChange>=10000){
        if(nextBudget<this.chunks.maxDrawBudget)nextBudget=Math.min(this.chunks.maxDrawBudget,nextBudget+6);else if(ratio<limit)nextRatio=Math.min(limit,ratio+.25);
      }
      if(nextRatio!==ratio||nextBudget!==this.chunks.drawBudget){
        this.chunks.drawBudget=nextBudget;this.lastQualityChange=start;this.fastSince=null;this.frameTimes=[];this.intervals=[];this.qualityFrames=0;
        if(nextRatio!==ratio){this.renderer.setPixelRatio(nextRatio);this.metrics.pixelRatioChanges++;this.render();}
      }
    }
  }
  private render():void {
    const t=this.navigation.target,span=Math.min(340,Math.max(85,this.navigation.distance*.58));
    const steppedAngle=Math.round(this.sunAngle*30)/30;
    const sunHeight=Math.max(120,Math.sin(steppedAngle)*400),sunX=Math.cos(steppedAngle)*260;
    const sx=t.x+sunX,sy=t.y+sunHeight,sz=t.z+160;
    if(Math.abs(sx-this.sun.position.x)>1.5||Math.abs(sy-this.sun.position.y)>1.5||Math.abs(sz-this.sun.position.z)>1.5){
      this.sun.position.set(sx,sy,sz);this.sun.target.position.copy(t);
    }
    const c=this.sun.shadow.camera;
    if(Math.abs(c.left-(-span))>3){
      c.left=-span;c.right=span;c.top=span;c.bottom=-span;c.near=1;c.far=900;c.updateProjectionMatrix();
    }
    this.renderer.render(this.scene,this.navigation.camera);
  }
  tileAt(x:number,y:number):TilePoint|null{return pickTile(this.navigation.camera,x,y,this.width,this.height,this.setup.map.width,this.setup.map.height,this.terrain);}
  visibleTiles():TileRect|null{return visibleTileRect(this.navigation.camera,this.width,this.height,this.setup.map.width,this.setup.map.height,this.navigation.camera.far,this.terrain);}
  moveNorth():void{this.navigation.move('north');}moveEast():void{this.navigation.move('east');}moveSouth():void{this.navigation.move('south');}moveWest():void{this.navigation.move('west');}
  /** Public pixel-delta adapter for the game's no-tool left drag. */
  pan(dx:number,dy:number):void {this.navigation.pan(dx,dy,this.height);}
  resetView():void {this.navigation.reset();}
  centreOn(x:number,y:number):void{this.navigation.centreOn(x,y);}shake():void{this.navigation.shake();}
  screenshotVisible():string{if(this.disposed)return '';this.render();return this.canvas.toDataURL('image/png');}
  screenshotMap():string {
    if(this.disposed)return '';if(this.headless)return this.canvas.toDataURL('image/png');
    this.chunks.dirty(this.snapshot.sync(this.setup.map));this.chunks.finishMapLOD();
    const w=this.setup.map.width*10,h=this.setup.map.height*10,scale=Math.min(4096/Math.max(w,h),.8),width=Math.ceil(w*scale),height=Math.ceil(h*scale);
    const camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,1,10000);camera.position.set(w/2,4000,h/2);camera.up.set(0,0,-1);camera.lookAt(w/2,0,h/2);
    const target=new WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4),previous=this.renderer.getRenderTarget(),outline=this.outline.root.visible,zones=this.zones.root.visible,streets=this.streets?.root.visible??false;
    target.texture.colorSpace=SRGBColorSpace;
    try {
      this.outline.root.visible=false;this.zones.root.visible=false;if(this.streets)this.streets.root.visible=false;if(this.province)this.province.root.visible=false;this.sky.mesh.visible=false;this.scene.fog=null;
      // Map snapshots use the complete low-detail province, not only the nearby detailed chunks.
      this.chunks.mapLOD(true);this.renderer.setRenderTarget(target);this.renderer.render(this.scene,camera);this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)return this.screenshotVisible();
      const image=context.createImageData(width,height);for(let y=0;y<height;y++)image.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);context.putImageData(image,0,0);return canvas.toDataURL('image/png');
    }finally{this.renderer.setRenderTarget(previous);target.dispose();this.chunks.mapLOD(false);this.outline.root.visible=outline;this.zones.root.visible=zones;if(this.streets)this.streets.root.visible=streets;this.sky.mesh.visible=true;if(this.province)this.province.root.visible=true;this.scene.fog=this.fog;}
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.resizeObserver?.disconnect();this.listeners.forEach(({type,listener})=>this.canvas.removeEventListener(type,listener));
    this.chunks.dispose();this.sprites.dispose();this.pedestrians.dispose();this.roadTraffic.dispose();this.foliage.dispose();this.outline.dispose();this.zones.dispose();this.cells?.dispose();this.layer?.dispose();this.buses?.dispose();this.problems?.dispose();this.streets?.dispose();this.province?.dispose();this.curves.dispose();this.sky.dispose();this.bed.geometry.dispose();this.environment?.dispose();this.sun.shadow.dispose();this.scene.clear();this.renderer.dispose();this.canvas.remove();
  }
}
export function createCityView3D(setup:CityViewSetup):CityView3D{return new CityView3D(setup);}
