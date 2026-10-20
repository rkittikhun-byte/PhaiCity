/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Box3, Ray, Vector3 } from 'three';
import type { HeightGrid } from './roadBuild.js';
import type { CityMapReader } from './types.js';
import { isWaterNeighbor, TileSnapshot, TILE_TABLE } from './tileModels.js';
import { ZONEBIT } from '../../tileFlags.js';
import { plotOf } from '../../plots.js';
import { isCityTileSize, unitsPerMetre as metreUnits } from '../../units.js';

/** Shared scale for DEM, ground, models, camera and picking (RENDERER_SPEC 6B). */
export const HILL_EXAGGERATION = 4;
/** A real-scale city map (16 m a tile, docs/CITY_SCALE.md) shows its ground nearly as it is */
export const CITY_HILL_EXAGGERATION = 1.5;
export const OUTSIDE_BRIGHTNESS = .45;
const NO_WALLS:readonly (readonly number[])[]=[];
const BUILDING_KINDS=new Set(['residential','commercial','industrial','services','transport','park']);
export function provinceColor(rgb: readonly number[], outside: boolean): number[] {
  if (!outside) return [...rgb];
  const luma = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  return rgb.map(c => (c * .35 + luma * .65) * OUTSIDE_BRIGHTNESS);
}
export class CityHeightField {
  readonly tileHeights: Float32Array;
  readonly corners: Float32Array;
  readonly water: Float32Array;
  readonly enabled: boolean;
  /** The ground height (metres) the map's lowest land stands at, and world units a metre of height: for laying
   * other ground (the province round a district, provinceBackdrop.ts) at the same scale */
  baseMetres = 0;
  unitsPerMetre = 0;
  readonly province: boolean;
  readonly mask: Uint8Array | null;
  readonly town: { readonly x: number; readonly y: number } | null;
  version = 0; min = 0; max = 0;
  private wet:Uint8Array;private zones:Int32Array;
  private single:Uint8Array;private pads:Float32Array;
  constructor(readonly snapshot: TileSnapshot, readonly map: CityMapReader) {
    const n = snapshot.width * snapshot.height;
    this.enabled = !!map.heights && map.heights.length === n && !!map.tileSizeM && map.tileSizeM > 0;
    this.mask = map.insideProvince?.length === n ? map.insideProvince : null;
    this.province = this.enabled || !!this.mask;
    this.town = map.town ?? null;
    this.tileHeights = new Float32Array(n); this.water = new Float32Array(n).fill(NaN);
    this.wet=new Uint8Array(n);this.zones=new Int32Array(n);
    this.single=new Uint8Array(n);this.pads=new Float32Array(n).fill(NaN);
    this.corners = new Float32Array((snapshot.width + 1) * (snapshot.height + 1));
    if (this.enabled) {
      let lowest = Infinity;
      for (let i = 0; i < n; i++) if (!isWaterNeighbor(snapshot.values[i])) lowest = Math.min(lowest, Math.max(0, map.heights![i]));
      if (!Number.isFinite(lowest)) lowest = 0;
      this.baseMetres = lowest;
      this.unitsPerMetre = metreUnits(map.tileSizeM!) * (isCityTileSize(map.tileSizeM) ? CITY_HILL_EXAGGERATION : HILL_EXAGGERATION);
      for (let i = 0; i < n; i++) this.tileHeights[i] = (Math.max(0, map.heights![i]) - lowest) * this.unitsPerMetre;
    }
    this.rebuild();
  }
  inside(x: number, y: number): boolean { return !this.mask || this.mask[y * this.snapshot.width + x] !== 0; }
  /** A copy of the numbers the ground is sampled from, for building the roads in a worker (roadBuild.ts GridHeights) */
  grid(): HeightGrid {
    return { width: this.snapshot.width, height: this.snapshot.height, enabled: this.enabled, pads: this.pads.slice(),
      corners: this.corners.slice(), mask: this.mask ? this.mask.slice() : null };
  }
  /** A one-tile building, whose ground is levelled: a house, or a painted plot's building (src/plots.ts). */
  private isSingle(i:number):boolean {
    if((this.map as {cellZones?:boolean}).cellZones)return false;
    if(singleBuilding(this.snapshot.values[i]))return true;
    if(!this.snapshot.paintedZones)return false;
    const w=this.snapshot.width,plot=plotOf(this.snapshot,i%w,Math.floor(i/w));return !!plot&&plot.level>0;
  }
  update(indices:readonly number[]):number[] {
    if(!this.enabled||!indices.some(i=>this.wet[i]!==Number(isWaterNeighbor(this.snapshot.values[i]))||this.zones[i]!==this.snapshot.coverage[i]||this.single[i]!==Number(this.isSingle(i))))return [];
    const before=this.corners.slice(),water=this.water.slice(),pads=this.pads.slice();this.rebuild();const changed:number[]=[],w=this.snapshot.width;
    for(let i=0;i<this.tileHeights.length;i++){
      const x=i%w,y=Math.floor(i/w),a=y*(w+1)+x;
      if([a,a+1,a+w+1,a+w+2].some(j=>before[j]!==this.corners[j])||!Object.is(water[i],this.water[i])||!Object.is(pads[i],this.pads[i]))changed.push(i);
    }
    return changed;
  }
  /** Connected water shares its lowest shoreline, preventing steps along a river. */
  rebuild(): void {
    const { width: w, height: h, values, coverage, flags } = this.snapshot;
    this.pads.fill(NaN);
    for(let i=0;i<values.length;i++){this.wet[i]=Number(isWaterNeighbor(values[i]));this.zones[i]=coverage[i];this.single[i]=Number(this.isSingle(i));}
    this.water.fill(NaN);
    const queue = new Int32Array(w * h), visited = new Uint8Array(w * h);
    for (let i = 0; i < values.length; i++) if (!visited[i] && isWaterNeighbor(values[i])) {
      let head = 0, tail = 1, level = this.enabled ? this.tileHeights[i] : -.6, sea = false;
      queue[0] = i; visited[i] = 1;
      while (head < tail) {
        const j = queue[head++], x = j % w, y = Math.floor(j / w);
        if (this.enabled) { level = Math.min(level, this.tileHeights[j]); if (this.map.heights![j] <= 0) sea = true; }
        for (const k of [x ? j - 1 : -1, x + 1 < w ? j + 1 : -1, y ? j - w : -1, y + 1 < h ? j + w : -1])
          if (k >= 0 && !visited[k] && isWaterNeighbor(values[k])) { visited[k] = 1; queue[tail++] = k; }
      }
      if (sea) level = 0;
      for (let j = 0; j < tail; j++) this.water[queue[j]] = level;
    }
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      let sum = 0, count = 0, water = Infinity;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) {
        const i = (y + dy) * w + x + dx; sum += this.tileHeights[i]; count++;
        if (Number.isFinite(this.water[i])) water = Math.min(water, this.water[i]);
      }
      this.corners[y * (w + 1) + x] = this.enabled ? water < Infinity ? water : sum / count : 0;
    }
    // Flatten every corner of a zone, including the perimeter; adjacent terrain supplies the transition.
    // On cellZones maps, buildings are rotated against roads and have their own foundation/plinth, so axis-aligned tile pads are skipped.
    if (!(this.map as {cellZones?:boolean}).cellZones) {
      const sums = new Map<number, { sum: number; count: number }>();
      for (let i = 0; i < coverage.length; i++) if (coverage[i] >= 0) {
        const c = coverage[i], s = sums.get(c) ?? { sum: 0, count: 0 }; s.sum += this.tileHeights[i]; s.count++; sums.set(c, s);
      }
      for (let i = 0; i < coverage.length; i++) if (coverage[i] >= 0 && flags[coverage[i]] & ZONEBIT) {
        const s = sums.get(coverage[i])!, level = s.sum / s.count, x = i % w, y = Math.floor(i / w);
        this.pads[i]=level;
        for (const j of [y * (w + 1) + x, y * (w + 1) + x + 1, (y + 1) * (w + 1) + x, (y + 1) * (w + 1) + x + 1]) this.corners[j] = level;
      }
      for(let i=0;i<values.length;i++)if(coverage[i]<0&&this.single[i]){
        this.pads[i]=this.tileHeights[i];const x=i%w,y=Math.floor(i/w);
        for(const j of[y*(w+1)+x,y*(w+1)+x+1,(y+1)*(w+1)+x,(y+1)*(w+1)+x+1])this.corners[j]=this.pads[i];
      }
    }
    this.min = 0; this.max = 0;
    for (const c of this.corners) { this.min = Math.min(this.min, c); this.max = Math.max(this.max, c); }
    for(const c of this.pads)if(Number.isFinite(c)){this.min=Math.min(this.min,c);this.max=Math.max(this.max,c);}
    this.version++;
  }
  corner(x: number, y: number): number { return this.corners[Math.max(0, Math.min(this.snapshot.height, y)) * (this.snapshot.width + 1) + Math.max(0, Math.min(this.snapshot.width, x))]; }
  flatHeight(index:number):number {return this.pads[index];}
  tileCorners(x:number,y:number):[number,number,number,number] {
    const flat=this.pads[y*this.snapshot.width+x];
    return Number.isFinite(flat)?[flat,flat,flat,flat]:[this.corner(x,y),this.corner(x+1,y),this.corner(x,y+1),this.corner(x+1,y+1)];
  }
  /** Separate lot pads can share an edge at different levels. Retaining walls close that seam. */
  walls(x:number,y:number):readonly (readonly number[])[] {
    if(!this.enabled)return NO_WALLS;
    const{width:w,height:h}=this.snapshot,i=y*w+x;
    if(!Number.isFinite(this.pads[i])&&!(x>0&&Number.isFinite(this.pads[i-1])||x+1<w&&Number.isFinite(this.pads[i+1])||y>0&&Number.isFinite(this.pads[i-w])||y+1<h&&Number.isFinite(this.pads[i+w])))return NO_WALLS;
    const own=this.tileCorners(x,y),result:number[][]=[];
    const edges=[[0,-1,0,1,2,3,x*10,y*10,(x+1)*10,y*10],[1,0,1,3,0,2,(x+1)*10,y*10,(x+1)*10,(y+1)*10],
      [0,1,3,2,1,0,(x+1)*10,(y+1)*10,x*10,(y+1)*10],[-1,0,2,0,3,1,x*10,(y+1)*10,x*10,y*10]];
    for(const[dx,dy,a,b,c,d,x0,z0,x1,z1]of edges){const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=w||ny>=h||!Number.isFinite(this.pads[y*w+x])&&!Number.isFinite(this.pads[ny*w+nx]))continue;
      const next=this.tileCorners(nx,ny),da=own[a]-next[c],db=own[b]-next[d];if(Math.max(da,db)<1e-5)continue;
      let start=0,end=1;if(da<0)start=da/(da-db);if(db<0)end=da/(da-db);
      const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
      result.push([lerp(x0,x1,start),lerp(z0,z1,start),lerp(own[a],own[b],start),lerp(next[c],next[d],start),
        lerp(x0,x1,end),lerp(z0,z1,end),lerp(own[a],own[b],end),lerp(next[c],next[d],end)]);
    }
    return result;
  }
  sample(x: number, z: number): number {
    if (!this.enabled) return 0;
    const tx = Math.max(0, Math.min(this.snapshot.width - 1e-6, x / 10)), ty = Math.max(0, Math.min(this.snapshot.height - 1e-6, z / 10));
    return this.sampleTile(Math.floor(tx),Math.floor(ty),tx*10,ty*10);
  }
  sampleTile(ix:number,iy:number,x:number,z:number):number {
    if(!this.enabled)return 0;
    const u=Math.max(0,Math.min(1,x/10-ix)),v=Math.max(0,Math.min(1,z/10-iy));
    const flat=this.pads[iy*this.snapshot.width+ix];if(Number.isFinite(flat))return flat;
    const a = this.corner(ix, iy), b = this.corner(ix + 1, iy), c = this.corner(ix, iy + 1), d = this.corner(ix + 1, iy + 1);
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - v) * (b - d) + (1 - u) * (c - d);
  }
  /** A bridge run uses one bank-to-bank deck elevation, even over a sloping riverbed. */
  base(index: number): number {
    const { width: w, height: h, values } = this.snapshot, x = index % w, y = Math.floor(index / w), value = values[index];
    const bridge = value === 64 || value === 65 || value === 224 || value === 225 || value >= 828 && value <= 832 || value >= 948 && value <= 951;
    if (!this.enabled) return 0;
    if (!bridge) return this.sample((x + .5) * 10, (y + .5) * 10);
    const horizontal = value === 64 || value === 224 || value >= 828 && value <= 832, dx = horizontal ? 1 : 0, dy = horizontal ? 0 : 1;
    let level = this.water[index];
    for (const sign of [-1, 1]) {
      let xx = x, yy = y;
      while (xx >= 0 && yy >= 0 && xx < w && yy < h && isWaterNeighbor(values[yy * w + xx])) { xx += dx * sign; yy += dy * sign; }
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) level = Math.max(level, this.sample((xx + .5) * 10, (yy + .5) * 10));
    }
    return Number.isFinite(level) ? level : this.sample((x + .5) * 10, (y + .5) * 10);
  }
  /** DDA traverses crossed tiles only, then intersects the same two triangles as the visible ground. */
  intersect(ray: Ray): Vector3 | null {
    const { width: w, height: h } = this.snapshot;
    const entry = ray.intersectBox(new Box3(new Vector3(0, this.min - 1, 0), new Vector3(w * 10, this.max + 1, h * 10)), new Vector3());
    if (!entry) return null;
    const start = ray.origin.x >= 0 && ray.origin.z >= 0 && ray.origin.x < w * 10 && ray.origin.z < h * 10 && ray.origin.y >= this.min - 1 && ray.origin.y <= this.max + 1 ? ray.origin : entry;
    let x = Math.max(0, Math.min(w - 1, Math.floor(start.x / 10))), y = Math.max(0, Math.min(h - 1, Math.floor(start.z / 10)));
    const sx = ray.direction.x >= 0 ? 1 : -1, sy = ray.direction.z >= 0 ? 1 : -1;
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), d = new Vector3(), hit = new Vector3();
    for (let n = 0; n < w + h + 4 && x >= 0 && y >= 0 && x < w && y < h; n++) {
      const corners=this.tileCorners(x,y);a.set(x*10,corners[0],y*10);b.set((x+1)*10,corners[1],y*10);
      c.set(x*10,corners[2],(y+1)*10);d.set((x+1)*10,corners[3],(y+1)*10);
      let nearest:Vector3|null=null,best=Infinity;
      const triangle=(a:Vector3,b:Vector3,c:Vector3):void=>{if(ray.intersectTriangle(a,b,c,false,hit)){const distance=ray.origin.distanceToSquared(hit);if(distance<best){best=distance;nearest=hit.clone();}}};
      triangle(a,c,b);triangle(b,c,d);
      for(const[x0,z0,top0,bottom0,x1,z1,top1,bottom1]of this.walls(x,y)){
        a.set(x0,top0,z0);b.set(x0,bottom0,z0);c.set(x1,bottom1,z1);d.set(x1,top1,z1);triangle(a,b,c);triangle(a,c,d);
      }
      if(nearest){const p=nearest as Vector3;p.x=Math.max(x*10+1e-5,Math.min((x+1)*10-1e-5,p.x));p.z=Math.max(y*10+1e-5,Math.min((y+1)*10-1e-5,p.z));return p;}
      const tx = ray.direction.x === 0 ? Infinity : (((sx > 0 ? x + 1 : x) * 10) - ray.origin.x) / ray.direction.x;
      const ty = ray.direction.z === 0 ? Infinity : (((sy > 0 ? y + 1 : y) * 10) - ray.origin.z) / ray.direction.z;
      if (tx === Infinity && ty === Infinity) break;
      if (tx <= ty) x += sx; else y += sy;
    }
    return null;
  }
  /**
   * The province's edge as line segments a little above the ground. The tile edges between inside and outside are
   * walked into lines and their corners cut twice (Chaikin), so the edge curves like a real border instead of stepping
   * from tile to tile (owner, 13 Oct 2026).
   */
  boundary(): number[] {
    if (!this.mask) return [];
    const { width: w, height: h } = this.snapshot, stride = w + 1;
    const links = new Map<number, number[]>();
    const link = (a: number, b: number): void => {
      for (const [from, to] of [[a, b], [b, a]]) { const list = links.get(from); if (list) list.push(to); else links.set(from, [to]); }
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x + 1 < w && this.inside(x, y) !== this.inside(x + 1, y)) link(y * stride + x + 1, (y + 1) * stride + x + 1);
      if (y + 1 < h && this.inside(x, y) !== this.inside(x, y + 1)) link((y + 1) * stride + x, (y + 1) * stride + x + 1);
    }
    const used = new Set<string>(), pair = (a: number, b: number): string => a < b ? `${a}:${b}` : `${b}:${a}`;
    const lines: number[][] = [];
    const walk = (start: number, next: number): void => {
      const line = [start, next]; used.add(pair(start, next));
      for (let at = next; at !== start;) {
        const ends = links.get(at) ?? [];
        // A line stops where it meets others (a crossing of four edges) or ends
        if (ends.length !== 2) break;
        const onward = ends.find((end) => !used.has(pair(at, end)));
        if (onward === undefined) break;
        used.add(pair(at, onward)); line.push(onward); at = onward;
      }
      lines.push(line);
    };
    // Lines with ends first, then the closed rings that are left
    for (const [start, ends] of links) if (ends.length !== 2) for (const end of ends) if (!used.has(pair(start, end))) walk(start, end);
    for (const [start, ends] of links) for (const end of ends) if (!used.has(pair(start, end))) walk(start, end);
    const vertices: number[] = [];
    for (const line of lines) {
      const closed = line.length > 3 && line[0] === line[line.length - 1];
      let points = line.map((k) => [(k % stride) * 10, Math.floor(k / stride) * 10]);
      if (closed) points.pop();
      for (let pass = 0; pass < 2; pass++) points = chaikin(points, closed);
      const count = closed ? points.length : points.length - 1;
      for (let k = 0; k < count; k++) {
        const [x0, z0] = points[k], [x1, z1] = points[(k + 1) % points.length];
        vertices.push(x0, this.sample(x0, z0) + .2, z0, x1, this.sample(x1, z1) + .2, z1);
      }
    }
    return vertices;
  }
}
/** One pass of Chaikin's corner cutting: each segment keeps its middle half; an open line keeps its ends. */
function chaikin(points: number[][], closed: boolean): number[][] {
  if (points.length < 3) return points;
  const result: number[][] = closed ? [] : [points[0]];
  const count = closed ? points.length : points.length - 1;
  for (let k = 0; k < count; k++) {
    const [x0, z0] = points[k], [x1, z1] = points[(k + 1) % points.length];
    result.push([x0 * .75 + x1 * .25, z0 * .75 + z1 * .25], [x0 * .25 + x1 * .75, z0 * .25 + z1 * .75]);
  }
  if (!closed) result.push(points[points.length - 1]);
  return result;
}
function singleBuilding(value:number):boolean {const entry=TILE_TABLE[value];return !!entry?.id&&entry.footprint[0]===1&&BUILDING_KINDS.has(entry.kind);}
