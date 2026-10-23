/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, OctahedronGeometry, InstancedBufferAttribute,
  InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { cityCoarseSurfaceMaterial, cityCoarseTreeMaterial, provinceEdgeMaterial, setProvinceMask } from '../materials/library.js';
import { mergeGeometry } from '../util/geometry.js';
import { LATERITE_EDGE, lateriteColour, lateriteShape } from '../models/road/laterite.js';
import { alongRoad, bends, clipTriangle, roadDistance, roadShape } from '../models/road/centreline.js';
import { ROAD_SECTION } from '../models/road/interfaces.js';
import { COMBASE, HOSPITALBASE, INDBASE, PORTBASE, RESBASE } from '../../tileValues.js';
import { type LandMap, ownsLand } from '../../landBlocks.js';
import { isCurved, isPower, isRoad, isRail, isWaterNeighbor, isWoods, tileSeed, TileSnapshot } from './tileModels.js';
import { CityHeightField } from './heightfield.js';
import { ZONE_GRID_CELLS } from './overlay.js';
import type { Placement } from './types.js';
import { TerrainDetail } from './terrain-detail.js';
import { besideCanal } from './canals.js';
import { LOD_HYSTERESIS, lodDistance } from './lod.js';
import { GRADE_STEPS } from '../../terrain/groundGrade.js';
const SIZE=32, matrix=new Matrix4(), color=new Color(), scratch=new Color();
/** How much lighter or darker the open land of a real-scale city map is at (x, z) world units: a few overlapping waves
 * some 50 to 120 m long, so the ground varies as fields do and no tile's square shows (owner, 21 Oct 2026) */
export function smoothPatch(x:number,z:number):number {
  return (Math.sin(x*.061+z*.023)+Math.sin(z*.052-x*.031+1.7)+Math.sin((x+z)*.037+4.1))*.008;
}
/** The fewest tiles of the far ground a frame fills in, however slow the frame (ProvinceSurface.update) */
const MIN_FILL=32;
type RoadPoint=readonly [number,number,number];
/** The zones' paint (docs/CITY_SCALE.md), how much of it shows over the ground, and the gap that draws the grid */
/** The open land's covers far away (scripts/geo/lib/landCover.mjs): paddy, field, orchard, grass, wetland, village, built-up */
const COVER_COLOURS:Record<number,number>={1:0x7aa84a,2:0x8e5f3f,3:0x5a7d3c,4:0x89a052,5:0x5f8068,6:0x6b8a4a,7:0x8a9568};
const ZONE_PAINT={residential:new Color(0x3fae4a),commercial:new Color(0x3a7bd5),industrial:new Color(0xe0b020)};
const ZONE_PAINT_SHARE=.55,ZONE_GAP=.45,MAX_TREES=SIZE*SIZE*5;
interface SurfaceChunk { x:number;y:number;group:Group;land:Mesh;trees:InstancedMesh;buildings:InstancedMesh;cursor:number;dirty:boolean;
  /** Its trees' geometry, whole and light (treeGeometry), the light one drawn while the chunk is far enough for it to
   * change no tree by more than a pixel; the largest a tree of it is scaled, building and as published */
  fullTrees:BufferGeometry;lightTrees:BufferGeometry;light:boolean;treeScale:number;publishedTreeScale:number;
  positions:number[];colors:number[];outside:number[];fade:number[];ground:number[];ranges:Map<number,[number,number]>;treeSlots:Map<number,[number,number]>;buildingSlots:Map<number,number>;
  publishedRanges:Map<number,[number,number]>;publishedTrees:Map<number,[number,number]>;publishedBuildings:Map<number,number>;
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
function colorPart(g:BufferGeometry,hex:number):BufferGeometry {
  const nonIndexed=g.index?g.toNonIndexed():g;if(nonIndexed!==g)g.dispose();
  const count=nonIndexed.getAttribute('position').count,c=new Color(hex),arr=new Float32Array(count*3);
  for(let i=0;i<count;i++){arr[i*3]=c.r;arr[i*3+1]=c.g;arr[i*3+2]=c.b;}
  nonIndexed.setAttribute('color',new Float32BufferAttribute(arr,3));return nonIndexed;
}
/** The far trees' foliage puffs: middle, size and colour of each (treeGeometry) */
const TREE_PUFFS:readonly [number,number,number,number,number,number,number][]=[
  [0,3.35,0,2.7,1.55,2.7,0x2e5b26],
  [-1.7,3.8,-1.1,2.15,1.5,2.15,0x3a6b2e],
  [1.75,3.85,-1.0,2.1,1.5,2.1,0x417634],
  [-1.1,3.95,1.65,2.15,1.5,2.15,0x477f39],
  [1.45,4.0,1.45,2.05,1.45,2.05,0x4f8a3f],
  [-0.9,4.7,-0.6,2.25,1.55,2.25,0x5a9947],
  [0.9,4.8,-0.5,2.15,1.5,2.15,0x63a54e],
  [0.0,4.9,0.85,2.15,1.55,2.15,0x6db357],
  [0.0,5.45,0.0,1.85,1.4,1.85,0x7fc965],
];
/**
 * How far the light tree (treeGeometry(0)) lies from the whole one at most, in the tree's own units: a puff once
 * subdivided has each edge's middle pushed out to its sphere, 1 - cos 45° = 0.293 of its radius beyond the plain
 * octahedron's edge, the most its two surfaces part, times the puff's largest axis
 */
export const LIGHT_TREE_ERROR=(1-Math.SQRT1_2)*Math.max(...TREE_PUFFS.map(([,,,sx,sy,sz])=>Math.max(sx,sy,sz)));
/** A far tree: a tapered trunk with four boughs and nine overlapping puffs, each an octahedron subdivided once (288
 * triangles in all), or not at all for the light tree (72), with the same smooth shading */
function treeGeometry(detail:0|1=1):BufferGeometry {
  const vertices:number[]=[];
  // Tapered 6-sided trunk with root flare and 4 spreading upper boughs
  for(let i=0;i<6;i++){const a=i*Math.PI/3,b=a+Math.PI/3,r0=.42,r1=.18;
    vertices.push(r1*Math.cos(a),2.8,r1*Math.sin(a),r0*Math.cos(b),0,r0*Math.sin(b),r0*Math.cos(a),0,r0*Math.sin(a));
    vertices.push(r1*Math.cos(a),2.8,r1*Math.sin(a),r1*Math.cos(b),2.8,r1*Math.sin(b),r0*Math.cos(b),0,r0*Math.sin(b));}
  for(let k=0;k<4;k++){const a=k*Math.PI/2+.3,dx=Math.cos(a)*1.75,dz=Math.sin(a)*1.75;
    vertices.push(-.14*Math.sin(a),2.1,.14*Math.cos(a),.14*Math.sin(a),2.1,-.14*Math.cos(a),dx,3.7,dz);}
  const trunk=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));trunk.computeVertexNormals();
  const parts:BufferGeometry[]=[colorPart(trunk,0x54402d)];
  // 9 overlapping foliage puffs with OctahedronGeometry(1, 1) (288 triangles total, 7x faster GPU vertex shading)
  for(const[px,py,pz,sx,sy,sz,hex]of TREE_PUFFS){
    const puff=new OctahedronGeometry(1,detail);
    // ... shaded smooth either way: the normal of a point of the unit puff is the way out to it
    if(!detail){const position=puff.getAttribute('position'),normal=puff.getAttribute('normal');
      for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i),l=Math.hypot(x,y,z)||1;normal.setXYZ(i,x/l,y/l,z/l);}}
    puff.scale(sx,sy,sz).translate(px,py,pz);
    parts.push(colorPart(puff,hex));
  }
  const geometry=mergeGeometry(parts);parts.forEach(p=>p.dispose());return geometry;
}
/** Two-layer chunks: continuous ground and instanced silhouettes. Only crossed/visible chunks reach the GPU.
 * Initial 4-tile patches appear immediately; full-resolution tiles are filled in bounded paint slices.
 */
export class ProvinceSurface {
  readonly root=new Group();readonly chunks:SurfaceChunk[]=[];
  readonly terrainDetail:TerrainDetail;
  private edge:LineSegments2;private treeSource=treeGeometry();private lightTreeSource=treeGeometry(0);private boxSource=new BoxGeometry(1,1,1);
  /** Where the camera is and the screen's pixels per world unit one unit from it (lod.ts), which the chunks set; with
   * them a far chunk's trees are drawn light */
  readonly eye=new Vector3(NaN,NaN,NaN);pixelsPerUnit=0;
  private placements=new Map<number,Placement>();private detail=new Map<number,number>();private columns:number;
  private lastUpdate?:number;
  constructor(readonly snapshot:TileSnapshot,readonly terrain:CityHeightField) {
    this.terrainDetail=new TerrainDetail(terrain,(x,y,wet,out)=>this.corner(x,y,wet,out));
    this.root.add(this.terrainDetail.root);
    this.boxSource.setAttribute('color',new Float32BufferAttribute(new Float32Array(this.boxSource.getAttribute('position').count*3).fill(1),3));
    this.columns=Math.ceil(snapshot.width/SIZE);
    this.updateMask();
    const boundary=terrain.boundary(),edgeGeometry=new LineSegmentsGeometry();if(boundary.length)edgeGeometry.setPositions(boundary);
    this.edge=new LineSegments2(edgeGeometry,provinceEdgeMaterial());this.edge.visible=boundary.length>0;this.edge.renderOrder=20;this.edge.frustumCulled=false;this.root.add(this.edge);
    const under=this.underGround();
    for(let y=0;y<snapshot.height;y+=SIZE)for(let x=0;x<snapshot.width;x+=SIZE){
      const group=new Group(),land=new Mesh(new BufferGeometry(),cityCoarseSurfaceMaterial());land.receiveShadow=true;
      const trees=new InstancedMesh(this.treeSource.clone(),cityCoarseTreeMaterial(),MAX_TREES);
      const buildings=new InstancedMesh(this.boxSource.clone(),cityCoarseSurfaceMaterial(),SIZE*SIZE);
      attributes(trees.geometry,MAX_TREES,true);trees.count=0;trees.receiveShadow=true;trees.castShadow=false;
      // ... and the light trees over the same per-tree attributes, so either draws the same trees
      const fullTrees=trees.geometry,lightTrees=this.lightTreeSource.clone();
      for(const name of['instanceDetail','cityOutside','cityGround','cityTerrain','cityBridgeDepth'])lightTrees.setAttribute(name,fullTrees.getAttribute(name));
      attributes(buildings.geometry,SIZE*SIZE,true);buildings.count=0;buildings.receiveShadow=true;buildings.castShadow=false;
      group.add(land,trees,buildings);this.root.add(group);
      const chunk:SurfaceChunk={x,y,group,land,trees,buildings,cursor:0,dirty:true,fullTrees,lightTrees,light:false,treeScale:0,publishedTreeScale:0,positions:[],colors:[],outside:[],fade:[],ground:[],ranges:new Map(),treeSlots:new Map(),buildingSlots:new Map(),
        publishedRanges:new Map(),publishedTrees:new Map(),publishedBuildings:new Map(),foliageFade:0,treeCount:0,buildingCount:0,treeMatrices:new Float32Array(MAX_TREES*16),buildingMatrices:new Float32Array(SIZE*SIZE*16),treeOutside:new Float32Array(MAX_TREES),buildingOutside:new Float32Array(SIZE*SIZE),buildingColors:new Float32Array(SIZE*SIZE*3)};
      this.chunks.push(chunk);
      for(let yy=y;yy<Math.min(y+SIZE,snapshot.height);yy+=4)for(let xx=x;xx<Math.min(x+SIZE,snapshot.width);xx+=4)
        this.quad(chunk,xx*10,yy*10,Math.min(xx+4,snapshot.width)*10,Math.min(yy+4,snapshot.height)*10,()=>new Color(this.landColour()),under,yy*snapshot.width+xx,false);
      this.publish(chunk);this.resetBuffers(chunk);
    }
  }
  /**
   * The height of the first, coarse ground (4 × 4 tiles a quad, until a chunk's own tiles are filled in): at each of its
   * corners the lowest ground of the quads round it, so it lies under the real ground everywhere and never over the
   * roads, railways and models standing on that (owner, 18 Oct 2026: in a hollow of the Khon Kaen map, quads sampled
   * only at their corners hid a level crossing and the railway and road either side of it).
   */
  private underGround():(x:number,z:number)=>number {
    const {snapshot,terrain}=this;
    if(!terrain.enabled)return(x,z)=>terrain.sample(x,z);
    const columns=Math.ceil(snapshot.width/4),rows=Math.ceil(snapshot.height/4),lowest=new Float32Array(columns*rows).fill(Infinity);
    for(let y=0;y<snapshot.height;y++)for(let x=0;x<snapshot.width;x++){const n=Math.floor(y/4)*columns+Math.floor(x/4);
      lowest[n]=Math.min(lowest[n],terrain.tileLowest(x,y));}
    const corners=new Float32Array((columns+1)*(rows+1));
    for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){let low=Infinity;
      for(const[px,py]of[[x-1,y-1],[x,y-1],[x-1,y],[x,y]])if(px>=0&&py>=0&&px<columns&&py<rows)low=Math.min(low,lowest[py*columns+px]);
      corners[y*(columns+1)+x]=low;}
    // A quad's corner is a multiple of 40 world units, or the map's edge where a quad is cut short
    return(x,z)=>corners[Math.min(rows,Math.ceil(z/40-1e-6))*(columns+1)+Math.min(columns,Math.ceil(x/40-1e-6))];
  }
  /**
   * The shade outside the province, the edges of the water and the land not yet bought (src/landBlocks.ts) follow
   * smooth curves drawn from these masks (materials/library.ts); again whenever the city buys land.
   */
  updateMask():void {
    const {snapshot,terrain}=this,n=snapshot.width*snapshot.height,land=terrain.map as unknown as LandMap;
    const outside=new Uint8Array(n),water=new Uint8Array(n),unowned=land.landBlocks?new Uint8Array(n):undefined;
    for(let y=0;y<snapshot.height;y++)for(let x=0;x<snapshot.width;x++){const i=y*snapshot.width+x;
      if(!terrain.inside(x,y))outside[i]=255;if(isWaterNeighbor(snapshot.values[i]))water[i]=255;
      if(unowned&&!ownsLand(land,x,y))unowned[i]=255;}
    setProvinceMask(outside,snapshot.width,snapshot.height,water,unowned);
  }
  private resetBuffers(c:SurfaceChunk):void {c.treeScale=0;c.positions=[];c.colors=[];c.outside=[];c.fade=[];c.ground=[];c.ranges=new Map();c.treeSlots=new Map();c.buildingSlots=new Map();c.treeCount=0;c.buildingCount=0;}
  private quad(c:SurfaceChunk,x0:number,z0:number,x1:number,z1:number,shade:(x:number,z:number)=>Color,height:(x:number,z:number)=>number,index:number,overlay:boolean):void {
    for(const[x,z]of[[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]){
      c.positions.push(x,height(x,z)+(overlay?.025:0),z);c.colors.push(...shade(x,z).toArray());
      const tx=Math.min(this.snapshot.width-1,Math.floor((x0+x1)/20)),ty=Math.min(this.snapshot.height-1,Math.floor((z0+z1)/20));
      c.outside.push(this.terrain.inside(tx,ty)?0:1);c.fade.push(overlay?this.detail.get(index)??0:0);c.ground.push(0);
    }
  }
  /** A straight band of half-width w from a to b over the ground, its faces up. */
  private band(c:SurfaceChunk,a:readonly [number,number],b:readonly [number,number],w:number,colour:Color,height:(x:number,z:number)=>number,index:number):void {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/length*w,nz=(b[0]-a[0])/length*w;
    const corners=[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz]];
    for(const[p,q,r]of[[0,1,2],[2,1,3]].map(t=>t.map(n=>corners[n]))){
      const up=(q[1]-p[1])*(r[0]-p[0])-(q[0]-p[0])*(r[1]-p[1])>=0;
      for(const[x,z]of up?[p,q,r]:[p,r,q]){
        c.positions.push(x,height(x,z)+.025,z);c.colors.push(colour.r,colour.g,colour.b);
        const tx=Math.min(this.snapshot.width-1,Math.max(0,Math.floor(x/10))),ty=Math.min(this.snapshot.height-1,Math.max(0,Math.floor(z/10)));
        c.outside.push(this.terrain.inside(tx,ty)?0:1);c.fade.push(this.detail.get(index)??0);c.ground.push(0);
      }
    }
  }
  /** A tile's own ground colour: water, woods or open land, the land a little lighter or darker in 3-tile patches. */
  /** Open land: laterite on a province map; grass on a real-scale city map, as the land round a town looks close up */
  private landColour():number {return this.snapshot.paintedZones?0x7a9150:0xb49b71;}
  private neighbourCover(x:number,y:number):number {
    const {width:w,height:h,values}=this.snapshot,counts=new Map<number,number>();
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h||isCurved(values[ny*w+nx]))continue;
      const cover=this.snapshot.source?.landCover?.[ny*w+nx]??0;if(cover)counts.set(cover,(counts.get(cover)??0)+1);}
    let best=0,most=0;for(const[cover,n]of counts)if(n>most){best=cover;most=n;}
    return best;
  }
  private tileShade(x:number,y:number,out:Color):Color {
    const v=this.snapshot.values[y*this.snapshot.width+x],wet=isWaterNeighbor(v),city=this.snapshot.paintedZones;
    let cover=this.snapshot.source?.landCover?.[y*this.snapshot.width+x]??0;
    // Under a curved road the land is its neighbours', so no staircase of bare ground shows beside it
    // ... and under a power line its neighbours' too, as its poles stand on the land (tileModels.ts power 'open')
    if(!cover&&this.snapshot.curves&&(isCurved(v)||isPower(v)))cover=this.neighbourCover(x,y);
    out.setHex(wet?0x487c89:isWoods(v)?(city?0x4f6d3b:0x88966b):cover?COVER_COLOURS[cover]??this.landColour():this.landColour());
    // ... a little lighter or darker in 3-tile patches on a province map; on a real-scale city map the patches would be a
    // 48 m checkerboard (owner, 21 Oct 2026: "ทำไมยังเห็นรอยเป็นช่องๆ อยู่"), so there the ground varies smoothly instead
    // (ground, smoothPatch)
    if(!wet&&!city){const patch=tileSeed(Math.floor(x/3),Math.floor(y/3));out.offsetHSL(0,0,(patch%9-4)*.006);}
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
    }
    // ... on a real-scale city map the open land's colour blended over the 4 × 4 tiles round the corner and varied in soft
    // patches (smoothPatch), so a field's or a wood's edge along a slanted road fades over a tile or two instead of
    // stepping tile by tile, and no square shows (owner, 21 Oct 2026: "ทำไมยังเห็นรอยเป็นช่องๆ อยู่")
    const reach=this.snapshot.paintedZones&&!wet?2:1;
    for(let y=cy-reach;y<cy+reach;y++)for(let x=cx-reach;x<cx+reach;x++){
      if(x<0||y<0||x>=w||y>=h||isWaterNeighbor(values[y*w+x])!==wet)continue;
      this.tileShade(x,y,scratch);r+=scratch.r;g+=scratch.g;b+=scratch.b;n++;
    }
    if(n)out.setRGB(r/n,g/n,b/n);
    if(reach>1)out.offsetHSL(0,0,smoothPatch(cx*10,cy*10));
    return tiles?outside/tiles:0;
  }
  /** A tile's ground: four triangles round its centre, the centre in the tile's own colour, the corners blended. */
  private ground(c:SurfaceChunk,x:number,y:number,wet:boolean,height:(x:number,z:number)=>number):void {
    const own=this.tileShade(x,y,new Color()),ownOutside=this.terrain.inside(x,y)?0:1,cx=(x+.5)*10,cz=(y+.5)*10;
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([px,py])=>{
      const shade=own.clone(),outside=this.corner(px,py,wet,shade);return{x:px*10,z:py*10,shade,outside};});
    // ... on a city map its middle the corners' blend too, as the near ground's (terrain-detail.ts) is, so no tile shows
    if(this.snapshot.paintedZones&&!wet)own.setRGB(0,0,0).add(corners[0].shade).add(corners[1].shade).add(corners[2].shade).add(corners[3].shade).multiplyScalar(.25);
    // ... levelled under a building or plot (src/terrain/groundGrade.ts): the squares of its finer samples, each split as
    // the samples are, its colour blended from its corners'
    if(!wet&&this.terrain.graded(y*this.snapshot.width+x)){
      const steps=GRADE_STEPS,size=10/steps,shade=new Color(),c0=corners[0],c1=corners[1],c2=corners[2],c3=corners[3];
      const vertex=(px:number,pz:number):void=>{const u=(px-x*10)/10,v=(pz-y*10)/10,w0=(1-u)*(1-v),w1=u*(1-v),w2=u*v,w3=(1-u)*v;
        shade.setRGB(c0.shade.r*w0+c1.shade.r*w1+c2.shade.r*w2+c3.shade.r*w3,c0.shade.g*w0+c1.shade.g*w1+c2.shade.g*w2+c3.shade.g*w3,c0.shade.b*w0+c1.shade.b*w1+c2.shade.b*w2+c3.shade.b*w3);
        c.positions.push(px,height(px,pz),pz);c.colors.push(shade.r,shade.g,shade.b);c.outside.push(c0.outside*w0+c1.outside*w1+c2.outside*w2+c3.outside*w3);c.fade.push(0);c.ground.push(1);};
      for(let r=0;r<steps;r++)for(let q=0;q<steps;q++){const x0=x*10+q*size,z0=y*10+r*size,x1=x0+size,z1=z0+size;
        // (counter-clockwise from above, as the four triangles below)
        vertex(x0,z0);vertex(x0,z1);vertex(x1,z0);vertex(x1,z0);vertex(x0,z1);vertex(x1,z1);}
      return;
    }
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
    // A bridge on a real-scale city map is as narrow as its road (TileSnapshot.narrowBridge) and its model has its own
    // deck: painting the whole tile would show round it as a block
    if(bridge&&this.snapshot.curves&&this.snapshot.realUnits)return;
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
    // Zones are painted cell by cell, as in Cities: Skylines (docs/CITY_SCALE.md): green homes, blue shops, yellow
    // factories, each tile a square a little inside its edges so the grid shows between them
    const zone=v>=RESBASE&&v<HOSPITALBASE?ZONE_PAINT.residential:v>=COMBASE&&v<INDBASE?ZONE_PAINT.commercial:v>=INDBASE&&v<PORTBASE?ZONE_PAINT.industrial:null;
    // A city map's painted zones show 8 m cells, 2 × 2 a tile, unless road-aligned cellZones (zoneCellsView.ts) draw them
    const cellZones=(this.snapshot.source as {cellZones?:boolean}|null)?.cellZones===true;
    if(zone&&!wet&&!cellZones){const paint=this.tileShade(x,y,new Color()).lerp(zone,ZONE_PAINT_SHARE),cells=this.snapshot.paintedZones?ZONE_GRID_CELLS:1,size=10/cells,gap=cells>1?.32:ZONE_GAP;
      for(let cy=0;cy<cells;cy++)for(let cx=0;cx<cells;cx++){const x0=x*10+cx*size+gap,z0=y*10+cy*size+gap,x1=x*10+(cx+1)*size-gap,z1=y*10+(cy+1)*size-gap;
        for(const[px,pz]of[[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]){c.positions.push(px,this.terrain.sampleTile(x,y,px,pz)+.015,pz);c.colors.push(paint.r,paint.g,paint.b);c.outside.push(outside?1:0);c.fade.push(0);c.ground.push(0);}}}
    for(const[x0,z0,top0,bottom0,x1,z1,top1,bottom1]of this.terrain.walls(x,y)){
      const vertices=[[x0,top0,z0],[x0,bottom0,z0],[x1,bottom1,z1],[x1,top1,z1]];
      for(const n of[0,2,1,0,3,2]){c.positions.push(...vertices[n]);c.colors.push(...new Color(0x9c927e).toArray());c.outside.push(outside?1:0);c.fade.push(0);c.ground.push(0);}
    }
    const p=this.placements.get(i)??this.snapshot.placement(i,'central');
    if(p){p.baseY=this.terrain.standOn(i,p.x,p.z);p.outside=outside;}
    // Plain roads and railways are smooth curves of their own (roadCurves.ts)
    if((isRoad(v)||isRail(v))&&!(this.snapshot.curves&&isCurved(v))){
      const start=c.fade.length,mask=this.snapshot.mask(x,y,isRoad(v)?isRoad:isRail),bridge=wet;
      const height=(xx:number,zz:number)=>bridge?this.terrain.base(i):this.terrain.sampleTile(x,y,xx,zz);
      if(isRoad(v)){
        const level=typeof this.snapshot.roadLevel==='function'?this.snapshot.roadLevel(x,y):this.snapshot.roadLevel;
        this.road(c,x,y,i,mask,level,bridge,height);
      }else if(this.snapshot.railStaircase(x,y)&15){
        // A corner of a slanted line: straight across from one side's middle to the other's, so the line reads as one
        // diagonal from afar as well as close up (models/rail/track.ts stairPath)
        const cx=(x+.5)*10,cz=(y+.5)*10,ends=([[1,0,-5],[2,5,0],[4,0,5],[8,-5,0]] as const).filter(([bit])=>mask&bit).map(([,dx,dz])=>[cx+dx,cz+dz] as const);
        const length=Math.hypot(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]),ox=-(ends[1][1]-ends[0][1])/length,oz=(ends[1][0]-ends[0][0])/length;
        this.band(c,ends[0],ends[1],1.6,new Color(0x8f472a),height,i);
        for(const side of[-.5,.5])this.band(c,[ends[0][0]+ox*side,ends[0][1]+oz*side],[ends[1][0]+ox*side,ends[1][1]+oz*side],.055,new Color(0x969f99),(xx,zz)=>height(xx,zz)+.15,i);
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
    const cover=this.snapshot.source?.landCover?.[i]??0;
    const hasLandCover=Boolean(this.snapshot.source?.landCover);
    if(woods&&(!outside||tileSeed(x,y)%2===0)){
      // Multi-tree cluster per forest tile
      const seed=tileSeed(x,y),realScale=this.snapshot.realUnits??1;
      const count=outside?2:this.snapshot.realUnits?4:3+(seed%2);
      const startSlot=c.treeCount;
      const offsets:readonly [number,number][]=[[0,0],[-2.7,-2.4],[2.6,-2.3],[-2.4,2.6],[2.6,2.4],[0,-3.3],[0,3.3],[-3.2,0]];
      for(let k=0;k<count&&c.treeCount<MAX_TREES;k++){
        const slot=c.treeCount++,hSeed=tileSeed(x*7+k*13,y*11+k*17);
        const [ox,oz]=offsets[k%offsets.length];
        const jx=((hSeed>>>4)%101/100-.5)*1.8,jz=((hSeed>>>12)%101/100-.5)*1.8;
        const tx=(x+.5)*10+ox+jx,tz=(y+.5)*10+oz+jz;
        const s=realScale*(.82+(hSeed%9)*.07)*(k===0?1.2:1);
        const sy=s*(.92+((hSeed>>>8)%7)*.05);c.treeScale=Math.max(c.treeScale,s,sy);
        matrix.makeRotationY((hSeed%16)*Math.PI/8).scale(new Vector3(s,sy,s)).setPosition(tx,this.terrain.sample(tx,tz),tz);
        c.treeMatrices.set(matrix.elements,slot*16);
        c.treeOutside[slot]=outside?1:0;
      }
      if(c.treeCount>startSlot)c.treeSlots.set(i,[startSlot,c.treeCount-startSlot]);
    }else if(hasLandCover&&v===0&&!wet&&(!outside||tileSeed(x,y)%3===0)&&!besideCanal(this.snapshot,i)){
      // (none on a canal or its banks, canals.ts)
      // Real-scale city landscape trees: orchards (3), villages (6), parks/meadows (4), wetlands (5), paddy dikes (1) & field borders (2)
      const seed=tileSeed(x,y),realScale=this.snapshot.realUnits??1;
      const count=cover===3?3:cover===6?2:cover===4||cover===5?(seed%3===0?2:1):cover===1||cover===2?(seed%5<2?1:0):(seed%4===0?1:0);
      if(count>0){
        const startSlot=c.treeCount;
        const orchardOffsets:readonly [number,number][]=[[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]];
        for(let k=0;k<count&&c.treeCount<MAX_TREES;k++){
          const slot=c.treeCount++,hSeed=tileSeed(x*13+k*19,y*17+k*23);
          let ox=0,oz=0;
          if(cover===3){[ox,oz]=orchardOffsets[k%4];}
          else if(cover===1||cover===2){
            // Along the north or west paddy dike / field boundary (ต้นไม้หัวไร่ปลายนา / ต้นตาลตามคันนา)
            const onNorth=(hSeed&1)===0;
            ox=onNorth?((hSeed>>>4)%101/100-.5)*7.5:-4.1+((hSeed>>>4)%21/100);
            oz=onNorth?-4.1+((hSeed>>>8)%21/100):((hSeed>>>8)%101/100-.5)*7.5;
          }else{
            ox=((hSeed>>>4)%101/100-.5)*6.8;
            oz=((hSeed>>>12)%101/100-.5)*6.8;
          }
          const tx=(x+.5)*10+ox,tz=(y+.5)*10+oz;
          const baseScale=cover===3?.78:cover===1||cover===2?.88:.85;
          const s=realScale*(baseScale+(hSeed%7)*.055);
          const sy=s*(cover===1&&hSeed%3===0?1.35:.95+((hSeed>>>7)%5)*.05);c.treeScale=Math.max(c.treeScale,s,sy);
          matrix.makeRotationY((hSeed%16)*Math.PI/8).scale(new Vector3(s,sy,s)).setPosition(tx,this.terrain.sample(tx,tz),tz);
          c.treeMatrices.set(matrix.elements,slot*16);
          c.treeOutside[slot]=outside?1:0;
        }
        if(c.treeCount>startSlot)c.treeSlots.set(i,[startSlot,c.treeCount-startSlot]);
      }
    }else if(p&&p.id&&p.id!=='terrain.dirt'&&!woods&&!wet&&!isRoad(v)&&!isRail(v)&&p.kind!=='power'&&p.kind!=='shore'){
      // Its box as the placement itself draws it (placement.ts): a building stood against its road is as small and as
      // turned as its model
      const slot=c.buildingCount++;c.buildingSlots.set(i,slot);
      const inset=p.id.startsWith('plot.')||p.id.startsWith('lot.')?1.4:.8;
      p.farBox(matrix,Math.max(.2,p.height),inset);c.buildingMatrices.set(matrix.elements,slot*16);color.setHex(p.color).toArray(c.buildingColors,slot*3);
      c.buildingOutside[slot]=outside?1:0;
    }
  }
  private publish(c:SurfaceChunk):void {
    for(const[i,[start,end]]of c.ranges)for(let n=start;n<end;n++)c.fade[n]=this.detail.get(i)??0;
    const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(c.positions,3)).setAttribute('color',new Float32BufferAttribute(c.colors,3));
    attributes(geometry,c.outside.length);geometry.setAttribute('cityOutside',new Float32BufferAttribute(c.outside,1));geometry.setAttribute('instanceDetail',new Float32BufferAttribute(c.fade,1));geometry.setAttribute('cityGround',new Float32BufferAttribute(c.ground,1));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();c.land.geometry.dispose();c.land.geometry=geometry;
    c.trees.count=c.treeCount;c.buildings.count=c.buildingCount;c.publishedTreeScale=c.treeScale;
    (c.trees.instanceMatrix.array as Float32Array).set(c.treeMatrices);(c.buildings.instanceMatrix.array as Float32Array).set(c.buildingMatrices);
    c.buildings.instanceColor=new InstancedBufferAttribute(c.buildingColors.slice(),3);
    (c.trees.geometry.getAttribute('cityOutside').array as Float32Array).set(c.treeOutside);(c.buildings.geometry.getAttribute('cityOutside').array as Float32Array).set(c.buildingOutside);
    c.publishedRanges=c.ranges;c.publishedTrees=c.treeSlots;c.publishedBuildings=c.buildingSlots;
    {const a=c.trees.geometry.getAttribute('instanceDetail');
      for(const[i,[start,len]]of c.publishedTrees){const f=Math.max(this.detail.get(i)??0,c.foliageFade);for(let s=start;s<start+len;s++)a.setX(s,f);}
      a.needsUpdate=true;}
    {const a=c.buildings.geometry.getAttribute('instanceDetail');
      for(const[i,slot]of c.publishedBuildings)a.setX(slot,this.detail.get(i)??0);
      a.needsUpdate=true;}
    for(const m of[c.trees,c.buildings]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;
      m.geometry.getAttribute('cityOutside').needsUpdate=true;m.computeBoundingSphere();}
  }
  set(index:number,p:Placement|null):void {if(p){p.baseY=this.terrain.standOn(index,p.x,p.z);p.outside=!this.terrain.inside(index%this.snapshot.width,Math.floor(index/this.snapshot.width));this.placements.set(index,p);}else this.placements.delete(index);}
  dirty(indices:readonly number[]):void {
    if(!indices.length)return;
    this.terrainDetail.dirty(indices);
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
    this.terrainDetail.update(target,distance,now,Math.min(deadline,time+.6));
    const dirty=this.chunks.filter(c=>c.dirty).sort((a,b)=>Math.hypot(a.x*10+160-target.x,a.y*10+160-target.z)-Math.hypot(b.x*10+160-target.x,b.y*10+160-target.z));
    // A few tiles a frame whatever the clock says, so the coarse first ground is always being replaced (CityChunks.update)
    let filled=0;
    for(const c of dirty){while(c.cursor<SIZE*SIZE&&(filled<MIN_FILL||now()<deadline)){this.cell(c,c.cursor++);filled++;}
      if(c.cursor===SIZE*SIZE){this.publish(c);c.dirty=false;}if(filled>=MIN_FILL&&now()>=deadline)break;}
    for(const c of this.chunks){const range=Math.hypot(c.x*10+160-target.x,c.y*10+160-target.z);
      const wanted=Math.max(0,Math.min(1,Math.max((distance-1400)/400,(range-800)/250)));
      const fade=c.foliageFade+Math.max(-dt/350,Math.min(dt/350,wanted-c.foliageFade));
      if(Math.abs(fade-c.foliageFade)>=.025||((fade===0||fade===1)&&fade!==c.foliageFade)){c.foliageFade=fade;const a=c.trees.geometry.getAttribute('instanceDetail');(a.array as Float32Array).fill(fade,0,c.treeCount);a.needsUpdate=true;}
      c.trees.visible=fade<1;
      // Far enough that the light tree moves no tree by more than a pixel: the light one, until it is nearer again
      // (whole without the screen's scale, before the view says it or with the levels of detail off)
      const light=this.pixelsPerUnit>0&&Number.isFinite(this.eye.x)&&c.treeCount>0&&
        this.chunkDistance(c)>=lodDistance(LIGHT_TREE_ERROR*c.publishedTreeScale,this.pixelsPerUnit)*(c.light?1-LOD_HYSTERESIS:1+LOD_HYSTERESIS);
      if(light!==c.light){c.light=light;c.trees.geometry=light?c.lightTrees:c.fullTrees;this.treeSwaps++;}
    }
  }
  /** How often a chunk's trees went light or whole again */
  treeSwaps=0;
  /** From the camera to the nearest point of a chunk, its ground to the tops of its tallest trees (world units) */
  private chunkDistance(c:SurfaceChunk):number {
    const {width,height}=this.snapshot,e=this.eye,x0=c.x*10,x1=Math.min(width,c.x+SIZE)*10,z0=c.y*10,z1=Math.min(height,c.y+SIZE)*10;
    const y0=this.terrain.min,y1=this.terrain.max+8*Math.max(1,c.publishedTreeScale);
    const dx=Math.max(x0-e.x,0,e.x-x1),dy=Math.max(y0-e.y,0,e.y-y1),dz=Math.max(z0-e.z,0,e.z-z1);
    return Math.hypot(dx,dy,dz);
  }
  fade(index:number,fade:number):void {
    this.detail.set(index,fade);const x=index%this.snapshot.width,y=Math.floor(index/this.snapshot.width),c=this.chunks[Math.floor(y/SIZE)*this.columns+Math.floor(x/SIZE)];
    const treeSpan=c.publishedTrees.get(index);
    if(treeSpan!==undefined){const a=c.trees.geometry.getAttribute('instanceDetail'),f=Math.max(fade,c.foliageFade);for(let s=treeSpan[0];s<treeSpan[0]+treeSpan[1];s++)a.setX(s,f);a.needsUpdate=true;}
    const bSlot=c.publishedBuildings.get(index);
    if(bSlot!==undefined){const a=c.buildings.geometry.getAttribute('instanceDetail');a.setX(bSlot,fade);a.needsUpdate=true;}
    const range=c.publishedRanges.get(index);if(range){const attr=c.land.geometry.getAttribute('instanceDetail');for(let i=range[0];i<range[1];i++)attr.setX(i,fade);attr.needsUpdate=true;}
  }
  get pending():number{return this.chunks.filter(c=>c.dirty).length+this.terrainDetail.pending;}
  finish():void {for(const c of this.chunks)if(c.dirty){while(c.cursor<SIZE*SIZE)this.cell(c,c.cursor++);this.publish(c);c.dirty=false;}}
  dispose():void {this.terrainDetail.dispose();for(const c of this.chunks){c.land.geometry.dispose();c.fullTrees.dispose();c.lightTrees.dispose();for(const m of[c.trees,c.buildings]){m.geometry.dispose();m.dispose();}}this.lightTreeSource.dispose();this.edge.geometry.dispose();this.treeSource.dispose();this.boxSource.dispose();this.root.clear();this.placements.clear();this.detail.clear();}
}
