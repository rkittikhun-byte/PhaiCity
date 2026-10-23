/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { cityTerrainDetailMaterial } from '../materials/library.js';
import { terrainDetailUniforms } from '../materials/terrain-detail.js';
import type { CityHeightField } from './heightfield.js';
import { isWaterNeighbor } from './tileModels.js';
import { GRADE_STEPS } from '../../terrain/groundGrade.js';

export const DETAIL_PATCH_TILES = 8;
export const MAX_DETAIL_PATCHES = 9;
export const DETAIL_LIFT = 0.002;
type CornerShade = (x: number, y: number, wet: boolean, out: Color) => number;
interface Patch {
  x: number; y: number; width: number; height: number; divisions: number; cursor: number;
  positions: Float32Array; normals: Float32Array; colors: Float32Array; outside: Float32Array;
  mesh?: Mesh;
}

/** A bounded 3×3 window of 2 m / 4 m terrain. Far ground remains visible during every rebuild.
 * Vertices sample the SAME triangles as buildings and picking: subdivision adds shading detail, not invented DEM data.
 */
export class TerrainDetail {
  readonly root = new Group();
  readonly patches = new Map<string, Patch>();
  private selection = '';
  private shade = new Color();
  private corners = Array.from({ length: 4 }, () => new Color());
  private normal = new Vector3();
  constructor(private terrain: CityHeightField, private cornerShade: CornerShade) {
    this.root.name = 'city/terrain-detail';
  }
  private create(x: number, y: number, divisions: number): Patch {
    const width = Math.min(DETAIL_PATCH_TILES, this.terrain.snapshot.width-x);
    const height = Math.min(DETAIL_PATCH_TILES, this.terrain.snapshot.height-y);
    const count = width*height*(divisions+1)**2;
    return { x, y, width, height, divisions, cursor: 0, positions: new Float32Array(count*3),
      normals: new Float32Array(count*3), colors: new Float32Array(count*3), outside: new Float32Array(count) };
  }
  private remove(key: string, patch: Patch): void {
    if (patch.mesh) { this.root.remove(patch.mesh); patch.mesh.geometry.dispose(); }
    this.patches.delete(key);
  }
  private select(target: Vector3, distance: number): void {
    const tileMetres = this.terrain.map.tileSizeM ?? 0;
    const enabled = this.terrain.enabled && tileMetres > 0 && tileMetres <= 40 && distance < 850;
    // Hysteresis keeps a stationary camera near the LOD boundary from repeatedly rebuilding the window.
    const previous = this.patches.values().next().value as Patch | undefined;
    const fine = distance < (previous?.divisions === 8 ? 410 : 350);
    const divisions = enabled ? Math.min(8, 2**Math.max(0, Math.ceil(Math.log2(tileMetres/(fine?2:4))))) : 0;
    const px = Math.floor(target.x/(DETAIL_PATCH_TILES*10)), py = Math.floor(target.z/(DETAIL_PATCH_TILES*10));
    const selection = `${px}:${py}:${divisions}`;
    if (selection === this.selection) return;
    this.selection = selection;
    const wanted = new Map<string, [number,number]>();
    if (divisions) for (let y = py-1; y <= py+1; y++) for (let x = px-1; x <= px+1; x++) {
      const tx = x*DETAIL_PATCH_TILES, ty = y*DETAIL_PATCH_TILES;
      if (tx >= 0 && ty >= 0 && tx < this.terrain.snapshot.width && ty < this.terrain.snapshot.height) wanted.set(`${tx}:${ty}`, [tx,ty]);
    }
    for (const [key,patch] of this.patches) if (!wanted.has(key) || patch.divisions !== divisions) this.remove(key,patch);
    for (const [key,[x,y]] of wanted) if (!this.patches.has(key)) this.patches.set(key,this.create(x,y,divisions));
  }
  private tile(p: Patch): void {
    const x = p.x+p.cursor%p.width, y = p.y+Math.floor(p.cursor/p.width), d = p.divisions, stride = d+1;
    const index = y*this.terrain.snapshot.width+x, wet = isWaterNeighbor(this.terrain.snapshot.values[index]);
    const coordinates = [[x,y],[x+1,y],[x,y+1],[x+1,y+1]];
    const outside = coordinates.map(([cx,cy],i) => this.cornerShade(cx,cy,wet,this.corners[i]));
    const flat = Number.isFinite(this.terrain.flatHeight(index)) || wet, reach = this.terrain.graded(index) ? 10/GRADE_STEPS/2 : 5;
    for (let row = 0; row <= d; row++) for (let column = 0; column <= d; column++) {
      const u = column/d, v = row/d, wx = (x+u)*10, wz = (y+v)*10;
      const vertex = p.cursor*stride*stride+row*stride+column, offset = vertex*3;
      p.positions.set([wx,this.terrain.sampleTile(x,y,wx,wz)+DETAIL_LIFT,wz],offset);
      // A common world-space derivative makes neighbouring patches light identically at their shared edge.
      // (on ground levelled under a building or plot, over a shorter reach, so its flat pad is lit flat to its edge)
      if (flat) this.normal.set(0,1,0);
      else this.normal.set(this.terrain.sample(wx-reach,wz)-this.terrain.sample(wx+reach,wz),2*reach,
        this.terrain.sample(wx,wz-reach)-this.terrain.sample(wx,wz+reach)).normalize();
      this.normal.toArray(p.normals,offset);
      const weights = [(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];
      this.shade.setRGB(0,0,0); let beyond = 0;
      for (let i = 0; i < 4; i++) {
        this.shade.r += this.corners[i].r*weights[i]; this.shade.g += this.corners[i].g*weights[i];
        this.shade.b += this.corners[i].b*weights[i]; beyond += outside[i]*weights[i];
      }
      this.shade.toArray(p.colors,offset); p.outside[vertex] = beyond;
    }
    p.cursor++;
  }
  private publish(p: Patch): void {
    const d = p.divisions, stride = d+1, vertices = p.positions.length/3;
    const indices = new Uint16Array(p.width*p.height*d*d*6);
    let at = 0;
    for (let tile = 0; tile < p.width*p.height; tile++) for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      const a = tile*stride*stride+y*stride+x, b = a+1, c = a+stride;
      indices.set([a,c,b,b,c,c+1],at); at += 6;
    }
    const geometry = new BufferGeometry().setIndex(new BufferAttribute(indices,1));
    geometry.setAttribute('position',new Float32BufferAttribute(p.positions,3));
    geometry.setAttribute('normal',new Float32BufferAttribute(p.normals,3));
    geometry.setAttribute('color',new Float32BufferAttribute(p.colors,3));
    geometry.setAttribute('cityOutside',new Float32BufferAttribute(p.outside,1));
    for (const [name,size] of [['instanceDetail',1],['cityGround',1],['cityTerrain',4],['cityBridgeDepth',1]] as const)
      geometry.setAttribute(name,new Float32BufferAttribute(new Float32Array(vertices*size).fill(name==='cityGround'?1:0),size));
    geometry.computeBoundingSphere();
    p.mesh = new Mesh(geometry,cityTerrainDetailMaterial()); p.mesh.name = `terrain-detail:${p.x}:${p.y}`;
    p.mesh.receiveShadow = true; p.mesh.castShadow = false; this.root.add(p.mesh);
  }
  update(target: Vector3, distance: number, now: () => number, deadline: number): void {
    terrainDetailUniforms.cityTerrainFocus.value.set(target.x,target.z,distance);
    terrainDetailUniforms.cityMetresPerUnit.value = (this.terrain.map.tileSizeM ?? 16)/10;
    this.select(target,distance);
    const pending = [...this.patches.values()].filter(p => !p.mesh).sort((a,b) =>
      Math.hypot(a.x*10+40-target.x,a.y*10+40-target.z)-Math.hypot(b.x*10+40-target.x,b.y*10+40-target.z));
    for (const patch of pending) {
      while (patch.cursor < patch.width*patch.height && now() < deadline) this.tile(patch);
      if (patch.cursor === patch.width*patch.height) this.publish(patch);
      if (now() >= deadline) break;
    }
  }
  dirty(indices: readonly number[]): void {
    const width = this.terrain.snapshot.width;
    for (const [key,patch] of [...this.patches]) if (indices.some(i => {
      const x = i%width, y = Math.floor(i/width);
      return x >= patch.x-1 && x <= patch.x+patch.width && y >= patch.y-1 && y <= patch.y+patch.height;
    })) {
      this.remove(key,patch); this.patches.set(key,this.create(patch.x,patch.y,patch.divisions));
    }
  }
  get pending(): number { return [...this.patches.values()].filter(p => !p.mesh).length; }
  dispose(): void { for (const [key,patch] of this.patches) this.remove(key,patch); this.selection = ''; }
}
