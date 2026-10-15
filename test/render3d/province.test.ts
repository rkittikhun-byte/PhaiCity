/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Euler, Matrix4, Mesh, PerspectiveCamera, Quaternion, Ray, Vector3, WebGLRenderer } from 'three';
import { CityHeightField, HILL_EXAGGERATION, provinceColor } from '../../src/render3d/city/heightfield.js';
import { CityCamera } from '../../src/render3d/city/camera.js';
import { BUILDING_SCALE, TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { halfWidth, realUnits, roadReach } from '../../src/roadGeometry.js';
import { ProvinceSurface } from '../../src/render3d/city/province-surface.js';
import { Placement, RoadsidePlacement } from '../../src/render3d/city/placement.js';
import { CityView3D } from '../../src/render3d/city/index.js';
import { pickTile } from '../../src/render3d/city/picking.js';
import { registry } from '../../src/render3d/models/registry.js';
import { roadForMask } from '../../src/render3d/models/road/interfaces.js';
import { LATERITE_KINDS } from '../../src/render3d/models/road/laterite.js';
import { cityLODMaterial, citySurfaceMaterial, isLibraryMaterial } from '../../src/render3d/materials/library.js';
import { countTriangles, disposeModel, visibleBounds } from '../../src/render3d/util/geometry.js';
import { ZONEBIT } from '../../src/tileFlags.js';
import { ProvinceTestCity } from '../../src/render3d/gallery/province-city.js';
import type { CityMapReader, CityViewSetup } from '../../src/render3d/city/types.js';
function fixture(width=7,height=7){
  const values=new Uint16Array(width*height),flags=new Uint16Array(width*height),heights=new Float32Array(width*height),insideProvince=new Uint8Array(width*height).fill(1);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)heights[y*width+x]=x*20+y*10+10;
  const map={width,height,values,flags,heights,insideProvince,tileSizeM:100,town:{x:2,y:3},getTileValue:(x:number,y:number)=>values[y*width+x],getTileFlags:(x:number,y:number)=>flags[y*width+x]};
  const build=(reader:CityMapReader=map)=>{const snapshot=new TileSnapshot(width,height);snapshot.sync(reader);snapshot.coverZones();return new CityHeightField(snapshot,reader);};
  return{map,build};
}
describe('Province ground and appearance',()=>{
  it('dims all outside RGB channels and reduces saturation, retaining inside colours',()=>{
    expect(provinceColor([1,.4,.1],false)).toEqual([1,.4,.1]);const outside=provinceColor([1,.4,.1],true);
    expect(outside[0]-outside[2]).toBeCloseTo(.9*.35*.45);expect(provinceColor([1,1,1],true)).toEqual([.45,.45,.45]);
    const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <dithering_fragment>',uniforms:{}};
    cityLODMaterial(citySurfaceMaterial(),true).onBeforeCompile(shader as never,{} as never);
    expect(shader.fragmentShader).toContain('*0.45');expect(shader.vertexShader).toContain('cityProvince = cityOutside');
  });
  it('follows the mask transitions as one smoothed, continuous line, with no map perimeter',()=>{
    // Inside: (0,0), (1,0), (0,1). The edge steps from (2,0) down to (2,1), across to (1,1) and down to (1,2)
    const f=fixture(3,2);f.map.insideProvince.set([1,1,0,1,0,0]);const t=f.build();
    const segments=t.boundary();expect(segments.length%6).toBe(0);
    expect(segments.length/6).toBeGreaterThan(3); // the three tile edges, their corners cut
    const n=segments.length;
    expect([segments[0],segments[2]]).toEqual([20,0]);expect([segments[n-3],segments[n-1]]).toEqual([10,20]);
    for(let k=6;k<n;k+=6)expect([segments[k],segments[k+2]]).toEqual([segments[k-3],segments[k-1]]);
    const points:string[]=[];for(let k=0;k<n;k+=3)points.push(`${segments[k]},${segments[k+2]}`);
    expect(points).not.toContain('20,10');expect(points).not.toContain('10,10'); // no square corners left
    expect(f.build({...f.map,insideProvince:null}).boundary()).toEqual([]);
    f.map.insideProvince.fill(1);expect(f.build().boundary()).toEqual([]);
  });
  it('null mask treats all tiles as inside; null heights preserve flat practice ground',()=>{
    const f=fixture(),t=f.build({...f.map,insideProvince:null,heights:null});
    expect(t.province).toBe(false);expect(t.enabled).toBe(false);expect(t.inside(0,0)).toBe(true);
    expect([...t.corners].every(h=>h===0)).toBe(true);expect(t.sample(30,40)).toBe(0);
  });
  it('scales real metres once, averages corners and keeps picking on the rendered triangles',()=>{
    const f=fixture(),t=f.build();expect(t.tileHeights[1]).toBeCloseTo(20*10/100*HILL_EXAGGERATION);
    expect(t.corner(2,2)).toBeCloseTo((t.tileHeights[8]+t.tileHeights[9]+t.tileHeights[15]+t.tileHeights[16])/4);
    const p=t.intersect(new Ray(new Vector3(25,200,35),new Vector3(0,-1,0)))!;expect(p.y).toBeCloseTo(t.sample(25,35));
    const camera=new PerspectiveCamera(38,1,1,1000);camera.position.set(25,150,35);camera.lookAt(25,t.sample(25,35),35);camera.updateProjectionMatrix();
    expect(pickTile(camera,400,400,800,800,7,7,t)).toEqual({x:2,y:3});
  });
  it('flattens all footprint vertices to their mean and never writes source fields',()=>{
    const f=fixture(),i=3*7+3;f.map.values[i]=244;f.map.flags[i]=ZONEBIT;
    const before=new Float32Array(f.map.heights),mask=new Uint8Array(f.map.insideProvince),t=f.build(),level=t.tileHeights[i];
    for(let y=2;y<=5;y++)for(let x=2;x<=5;x++)expect(t.corner(x,y)).toBeCloseTo(level);
    expect(f.map.heights).toEqual(before);expect(f.map.insideProvince).toEqual(mask);
  });
  it('keeps adjoining lots flat at their own means, closes the step and picks its visible retaining wall',()=>{
    const f=fixture(7,4);for(const x of[1,4]){f.map.values[7+x]=244;f.map.flags[7+x]=ZONEBIT;}
    const t=f.build(),left=t.tileHeights[8],right=t.tileHeights[11];
    for(let y=0;y<3;y++)for(let x=0;x<6;x++)expect(t.tileCorners(x,y)).toEqual(Array(4).fill(x<3?left:right));
    expect(t.sampleTile(2,1,30,15)).toBeCloseTo(left);expect(t.sampleTile(3,1,30,15)).toBeCloseTo(right);
    const wall=t.intersect(new Ray(new Vector3(15,(left+right)/2,15),new Vector3(1,0,0)))!;
    expect(wall.x).toBeCloseTo(30,3);expect(Math.floor(wall.x/10)).toBe(3);expect(wall.y).toBeCloseTo((left+right)/2);
    expect(t.walls(3,1).length).toBeGreaterThan(0);
  });
  it('flattens standalone houses and invalidates a new house even without a zone flag',()=>{
    const f=fixture(),t=f.build();f.map.values[3*7+3]=249;
    const raised=t.update(t.snapshot.sync(f.map));expect(raised).toContain(3*7+3);
    expect(t.tileCorners(3,3)).toEqual(Array(4).fill(t.tileHeights[3*7+3]));
  });
  it('connected river/lake tiles have one level, with sea at zero and a flat bridge deck',()=>{
    const f=fixture();for(let y=0;y<7;y++)f.map.values[y*7+3]=2;f.map.values[3*7+3]=65;
    const t=f.build();const water=[...t.water].filter(Number.isFinite);expect(new Set(water).size).toBe(1);
    expect(t.corner(3,3)).toBe(t.corner(4,4));expect(t.base(3*7+3)).toBeGreaterThanOrEqual(water[0]);
    f.map.heights[3]=0;expect([...f.build().water].filter(Number.isFinite).every(h=>h===0)).toBe(true);
  });
  it('invalidates the entire affected water component when a new low tile joins it, leaving road-only height unchanged',()=>{
    const f=fixture();f.map.values[2*7+3]=2;f.map.values[3*7+3]=2;const t=f.build();
    f.map.values[4*7+3]=66;expect(t.update(t.snapshot.sync(f.map))).toEqual([]);
    f.map.values[1*7+3]=2;const affected=t.update(t.snapshot.sync(f.map));expect(affected).toContain(3*7+3);
    expect(t.water[2*7+3]).toBe(t.water[1*7+3]);
  });
  it('home starts at the town, follows raised ground, resets there and falls back to map centre',()=>{
    const f=fixture(),t=f.build(),n=new CityCamera(7,7,()=>0,true,t);
    expect(n.target.x).toBe(25);expect(n.target.z).toBe(35);expect(n.target.y).toBeCloseTo(t.sample(25,35));
    n.pan(30,10,800);n.reset();expect(n.target.x).toBe(25);
    const flat=new CityCamera(7,7,()=>0,true,f.build({...f.map,town:null,heights:null}));expect(flat.target).toEqual(new Vector3(35,0,35));
  });
  it('at the closest the zoom walks on toward the middle of the view, and the camera may look nearly level',()=>{
    const n=new CityCamera(40,40,()=>0,true);n.minDistance=5;n.distance=5;n.camera.aspect=1;n.update(0);
    const z=n.target.z;n.zoom(-200,400,400,800,800);
    expect(n.distance).toBe(5);expect(n.target.z).toBeLessThan(z-1);
    // Past the horizon the camera stays and looks up into the sky
    n.rotate(0,-1000);expect(n.pitch).toBeCloseTo(-60*Math.PI/180);
    const look=new Vector3();n.camera.getWorldDirection(look);expect(Math.asin(look.y)).toBeCloseTo(60*Math.PI/180,2);
  });
  it('the 2D view looks straight down from far, showing the same width of ground, and tilting leaves it flat',()=>{
    const n=new CityCamera(40,40,()=>0,true);n.camera.aspect=1;n.distance=300;n.update(0);
    n.setFlat(true);const look=new Vector3();n.camera.getWorldDirection(look);
    expect(look.y).toBeLessThan(-0.999);expect(n.camera.fov).toBe(2);
    const width=2*(n.camera.position.y-n.target.y)*Math.tan(n.camera.fov/2*Math.PI/180);
    expect(width).toBeCloseTo(2*300*Math.tan(19*Math.PI/180),0);
    const pitch=n.pitch;n.rotate(0,200);expect(n.pitch).toBe(pitch);
    n.setFlat(false);expect(n.camera.fov).toBe(38);
  });
  it('camera clearance uses the absolute top of buildings on raised ground',()=>{
    const f=fixture(),t=f.build(),n=new CityCamera(7,7,()=>0,true,t);n.distance=60;
    const top=t.sample(n.target.x,n.target.z)+100;n.update(0,top);
    expect(n.camera.position.y).toBeCloseTo(top+8);expect(n.target.y).toBeCloseTo(t.sample(n.target.x,n.target.z));
  });
  it('surface chunks carry the outside flag for ground, trees, road and rail, with bounded/cullable draws',()=>{
    const f=fixture(4,4);f.map.insideProvince.fill(0);f.map.values[0]=37;f.map.values[1]=66;f.map.values[2]=226;const t=f.build();t.snapshot.roadLevel=1;
    const surface=new ProvinceSurface(t.snapshot,t);
    try{surface.finish();for(const c of surface.chunks){expect(c.land.frustumCulled).toBe(true);expect(c.trees.frustumCulled).toBe(true);
      expect([...c.land.geometry.getAttribute('cityOutside').array].every(v=>v===1)).toBe(true);
      expect(c.land.geometry.getAttribute('position').count).toBeGreaterThan(4*4*6);
    }}finally{surface.dispose();}
  });
  it('a building stood against its road keeps its smaller size and its turn in the far box',()=>{
    const f=fixture(),t=f.build(),surface=new ProvinceSurface(t.snapshot,t);
    try{const turn=Math.PI/5;
      const house=new Placement({index:24,x:35,z:35,id:'civic.ruler_house',options:{} as never,rotation:0,footprint:[3,3],height:10,color:0xffffff,
        kind:'civic',water:false,scale:1,powered:true});
      // The plain placement's box fills its tiles; stood against a road, the same building's box is as small and turned
      expect(house.farBox(new Matrix4(),10,.8).elements[0]).toBeCloseTo(29.2);
      const posed=house.againstRoad(35,35,turn,.6);expect(posed).toBeInstanceOf(RoadsidePlacement);expect(posed.posed).toBe(true);
      surface.set(24,posed);
      // A tool's outline stands as the building it puts down will
      expect(Placement.ofTool(3,35,35).againstRoad(40,30,turn,.6).ground()).toMatchObject({x:40,z:30,rotation:turn,width:18,depth:18});
      surface.dirty([24]);surface.finish();
      const c=surface.chunks[0],m=new Matrix4(),position=new Vector3(),rotation=new Quaternion(),size=new Vector3();
      c.buildings.getMatrixAt(c.buildings.count-1,m);m.decompose(position,rotation,size);
      expect(size.x).toBeCloseTo((30-.8)*.6);expect(size.y).toBeCloseTo(6);
      expect(new Euler().setFromQuaternion(rotation).y).toBeCloseTo(turn);
    }finally{surface.dispose();}
  });
  it('every building stands against its road, a one-tile one and a power plant too, but not a power line (owner: "tool ทุก tool จะต้อง snap กับ ถนน")',()=>{
    const s=new TileSnapshot(9,9);s.realUnits=realUnits(16);s.curves=true;
    // A road along x = 45 (world units), running north-south
    s.roadSnap=(x,z,reach)=>Math.abs(x-45)<=reach?{x:45,z,tx:0,tz:1,reach:1.5}:null;
    s.values[4*9+3]=1020;s.values[4*9+6]=210;
    const tower=s.placement(4*9+3,'central')!,wire=s.placement(4*9+6,'central')!;
    expect(tower).toBeInstanceOf(RoadsidePlacement);expect(tower.fill).toBeCloseTo(BUILDING_SCALE);
    expect(Math.abs(tower.x-45)).toBeCloseTo(1.5+.6+5*BUILDING_SCALE);
    expect(wire).not.toBeInstanceOf(RoadsidePlacement);
  });
  it('on a real-scale city map things are drawn at their real size, and roads and the ground still fill their tiles',()=>{
    // A 16 m tile is drawn 10 units: a water tower's model at 10/16, a laterite road 5 m wide (owner, 15 Oct 2026)
    const s=new TileSnapshot(5,5);s.values[12]=1020;s.values[6]=66;s.realUnits=realUnits(16);
    const tower=s.placement(12,'central')!,road=s.placement(6,'central')!;
    expect(tower.scale).toBeCloseTo(.625);expect(tower.fill).toBeCloseTo(.625);
    expect(tower.farBox(new Matrix4(),9,0).elements[0]).toBeCloseTo(6.25);expect(tower.ground().width).toBeCloseTo(6.25);
    expect(road.scale).toBe(1);expect(road.fill).toBeUndefined();
    // Stood against its road it is not made smaller twice
    const posed=tower.againstRoad(25,25,0,BUILDING_SCALE);expect(posed.scale).toBeCloseTo(.625);expect(posed.fill).toBeCloseTo(.625);
    expect(halfWidth(1,realUnits(16))*2).toBeCloseTo(5*.625);expect(roadReach(2,realUnits(16))).toBeCloseTo((3+1)*.625);
    // Other maps keep their old widths and sizes
    expect(realUnits(null)).toBeNull();expect(realUnits(600)).toBeNull();expect(halfWidth(1,realUnits(600))).toBe(3.5);
  });
  it('keeps the complete previous ground and forest visible during a sliced rebuild',()=>{
    const f=fixture(4,4);f.map.values[0]=37;const t=f.build(),surface=new ProvinceSurface(t.snapshot,t);
    try{surface.finish();const c=surface.chunks[0],geometry=c.land.geometry,count=c.trees.count;
      f.map.values[0]=0;const changed=t.snapshot.sync(f.map);surface.dirty(changed);
      expect(c.land.geometry).toBe(geometry);expect(c.trees.count).toBe(count);
      surface.finish();expect(c.land.geometry).not.toBe(geometry);expect(c.trees.count).toBe(0);
    }finally{surface.dispose();}
  });
  it('fades forest silhouettes through a large zoom step instead of removing a whole chunk instantly',()=>{
    const f=fixture(4,4);f.map.values[0]=37;const t=f.build(),surface=new ProvinceSurface(t.snapshot,t);let time=0;
    try{surface.finish();const target=new Vector3(15,0,15),c=surface.chunks[0];surface.update(target,240,()=>time,time);
      time=16;surface.update(target,2200,()=>time,time);expect(c.trees.visible).toBe(true);
      const fade=c.trees.geometry.getAttribute('instanceDetail').getX(0);expect(fade).toBeGreaterThan(0);expect(fade).toBeLessThan(1);
      surface.fade(0,0);expect(c.trees.geometry.getAttribute('instanceDetail').getX(0)).toBe(fade);
      for(let n=0;n<5;n++){time+=100;surface.update(target,2200,()=>time,time);}expect(c.trees.visible).toBe(false);
      time+=16;surface.update(target,240,()=>time,time);expect(c.trees.visible).toBe(true);
    }finally{surface.dispose();}
  });
  it('provides a 300×300 irregular fixture with town, forest, crossing, bridges, a ridge and water',()=>{
    const map=new ProvinceTestCity();expect(map.values.length).toBe(90000);expect(map.values).toContain(238);expect(map.values).toContain(64);
    expect(new Set(map.insideProvince).size).toBe(2);expect(Math.max(...map.heights)).toBeGreaterThan(1000);
  });
  it('CityView resetView uses the town and leaves every game field untouched',()=>{
    const f=fixture(),overlay={blockSize:2,worldGet:()=>0},canvas={style:{cssText:''},addEventListener:jest.fn(),removeEventListener:jest.fn(),remove:jest.fn()} as unknown as HTMLCanvasElement;
    const renderer={setPixelRatio:jest.fn(),setSize:jest.fn(),shadowMap:{},info:{render:{calls:0,triangles:0}},render:jest.fn(),dispose:jest.fn()} as unknown as WebGLRenderer;
    const setup:CityViewSetup={map:f.map,container:{clientWidth:800,clientHeight:600,append:jest.fn()} as unknown as HTMLElement,region:'central',date:()=>({month:0,year:2026}),overlays:{trafficDensityMap:overlay,pollutionDensityMap:overlay,landValueMap:overlay}};
    const before=f.map.heights.slice(),view=new CityView3D(setup,{canvas,rendererFactory:()=>renderer,provider:{request:jest.fn(),take:()=>[],dispose:jest.fn()},now:()=>0,headless:true});
    try{view.navigation.wholeMap();view.resetView();expect(view.navigation.target.x).toBe(25);expect(view.navigation.target.z).toBe(35);view.paint(null,[],true);expect(f.map.heights).toEqual(before);}finally{view.dispose();}
  });
  it('keeps the backing plane below deep inland water, including after a terrain update',()=>{
    const f=fixture();f.map.heights.fill(100);f.map.values[24]=2;f.map.heights[24]=1;
    const overlay={blockSize:2,worldGet:()=>0},canvas={style:{cssText:''},addEventListener:jest.fn(),removeEventListener:jest.fn(),remove:jest.fn()} as unknown as HTMLCanvasElement;
    const renderer={setPixelRatio:jest.fn(),setSize:jest.fn(),shadowMap:{},info:{render:{calls:0,triangles:0}},render:jest.fn(),dispose:jest.fn()} as unknown as WebGLRenderer;
    const setup:CityViewSetup={map:f.map,container:{clientWidth:800,clientHeight:600,append:jest.fn()} as unknown as HTMLElement,region:'central',date:()=>({month:0,year:2026}),overlays:{trafficDensityMap:overlay,pollutionDensityMap:overlay,landValueMap:overlay}};
    const view=new CityView3D(setup,{canvas,rendererFactory:()=>renderer,provider:{request:jest.fn(),take:()=>[],dispose:jest.fn()},now:()=>0,headless:true});
    try{const bed=view.scene.children.find(n=>n instanceof Mesh) as Mesh;expect(bed.geometry.getAttribute('position').getY(0)).toBeLessThan(view.terrain.water[24]);
      f.map.values[24]=0;view.paint(null,[],true);expect(bed.geometry.getAttribute('position').getY(0)).toBeCloseTo(view.terrain.min-3.015,4);
    }finally{view.dispose();}
  });
});
describe('Laterite road family',()=>{
  it('selects road levels per tile without changing the game map or claiming duplicate tile numbers',()=>{
    const f=fixture(4,4);f.map.values[0]=66;f.map.values[1]=66;const t=f.build();t.snapshot.roadLevel=x=>x===0?1:2;
    expect(t.snapshot.placement(0,'central')?.id).toContain('laterite_');expect(t.snapshot.placement(1,'central')?.id).not.toContain('laterite_');expect(f.map.values[0]).toBe(66);
  });
  it.each(Array.from({length:16},(_,i)=>i))('resolves mask %i to the laterite set, keeping asphalt available',mask=>{
    expect(registry[roadForMask(mask,1).id]).toBeDefined();expect(roadForMask(mask,2).id).not.toContain('laterite');
  });
  it.each(LATERITE_KINDS)('%s is registered, bounded, within budget and library-owned',kind=>{
    const id=`road.laterite_${kind}`,entry=registry[id],root=entry.factory({seed:1,region:'north'});
    try{expect(root.name).toBe(id);expect(root.userData.roadLevel).toBe(1);expect(entry.tiles).toEqual([]);expect(countTriangles(root)).toBeLessThanOrEqual(entry.budget);
      const bounds=visibleBounds(root);expect(bounds.min.x).toBeGreaterThanOrEqual(-5.01);expect(bounds.max.x).toBeLessThanOrEqual(5.01);
      const materials=new Set();root.traverseVisible(node=>{if(node instanceof Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material]){expect(materials.has(material)).toBe(false);materials.add(material);expect(isLibraryMaterial(material)).toBe(true);}});
    }finally{disposeModel(root);}
  });
});
