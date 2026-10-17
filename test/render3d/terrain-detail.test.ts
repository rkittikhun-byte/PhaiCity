/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Color, Mesh, ShaderLib, Vector3, WebGLRenderer } from 'three';
import { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { DETAIL_LIFT, MAX_DETAIL_PATCHES, TerrainDetail } from '../../src/render3d/city/terrain-detail.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import { cityTerrainDetailMaterial, isLibraryMaterial } from '../../src/render3d/materials/library.js';

function fixture(width = 24, height = 24, tileSizeM = 16) {
  const values = new Uint16Array(width*height), flags = new Uint16Array(width*height);
  const heights = Float32Array.from(values, (_,i) => 140+Math.sin(i%width/3)*8+Math.floor(i/width)*0.4);
  const insideProvince = new Uint8Array(width*height).fill(1);
  const map = { width, height, heights, tileSizeM, insideProvince, cellZones: true,
    getTileValue: (x: number,y: number) => values[y*width+x], getTileFlags: (x: number,y: number) => flags[y*width+x] };
  const snapshot = new TileSnapshot(width,height); snapshot.sync(map); snapshot.coverZones();
  const terrain = new CityHeightField(snapshot,map);
  const detail = new TerrainDetail(terrain, (x,y,_wet,out) => { out.setRGB(x/width,0.3,y/height); return 0; });
  return { detail, terrain, map, values, snapshot };
}
const focus = new Vector3(120,0,120), noTime = () => 0;
describe('camera-local terrain resolution', () => {
  it('bounds 2 m ground to nine patches, preserves the DEM and follows the picked surface', () => {
    const {detail,terrain,map} = fixture(), before = map.heights.slice();
    try {
      detail.update(focus,250,noTime,1);
      expect(detail.patches.size).toBe(MAX_DETAIL_PATCHES);
      expect(detail.root.children).toHaveLength(MAX_DETAIL_PATCHES);
      let triangles = 0;
      for (const child of detail.root.children) {
        const mesh = child as Mesh, g = mesh.geometry, position = g.getAttribute('position');
        expect(isLibraryMaterial(mesh.material as never)).toBe(true);
        triangles += g.index!.count/3;
        expect(position.getX(1)-position.getX(0)).toBe(1.25); // 2 real metres, 10 world units per 16 m tile.
        for (let i = 0; i < position.count; i += 73) expect(position.getY(i)-DETAIL_LIFT)
          .toBeCloseTo(terrain.sample(position.getX(i),position.getZ(i)),4);
        expect(g.boundingSphere?.radius).toBeGreaterThan(0);
      }
      expect(triangles).toBe(73728); expect(map.heights).toEqual(before);
    } finally { detail.dispose(); }
  });
  it('keeps patch-edge heights and normals identical, including their interior tile seams', () => {
    const {detail} = fixture();
    try {
      detail.update(focus,250,noTime,1);
      const vertices = new Map<string,number[]>();
      let seamCount = 0, mismatches = 0;
      for (const child of detail.root.children) {
        const geometry = (child as Mesh).geometry, p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
        for (let i = 0; i < p.count; i++) {
          const key = `${p.getX(i)}:${p.getZ(i)}`, next = [p.getY(i),n.getX(i),n.getY(i),n.getZ(i)];
          const previous = vertices.get(key);
          if (previous) { seamCount++; if (next.some((value,j) => value !== previous[j])) mismatches++; }
          else vertices.set(key,next);
        }
      }
      expect(seamCount).toBeGreaterThan(1000); expect(mismatches).toBe(0);
    } finally { detail.dispose(); }
  });
  it('reduces mesh cost at distance, uses hysteresis, and frees all geometry outside the detail range', () => {
    const {detail} = fixture();
    try {
      detail.update(focus,250,noTime,1);
      const fine = detail.root.children[0] as Mesh, disposed = jest.spyOn(fine.geometry,'dispose');
      detail.update(focus,395,noTime,1); expect(detail.root.children[0]).toBe(fine);
      detail.update(focus,600,noTime,1); expect(disposed).toHaveBeenCalledTimes(1);
      expect((detail.root.children[0] as Mesh).geometry.index!.count/3).toBe(2048);
      const medium = detail.root.children[0]; detail.update(focus,380,noTime,1); expect(detail.root.children[0]).toBe(medium);
      detail.update(focus,900,noTime,1); expect(detail.root.children).toHaveLength(0); expect(detail.patches.size).toBe(0);
    } finally { detail.dispose(); }
  });
  it('builds within a time slice, rebuilds changed land and disposes patches left behind by a pan', () => {
    const {detail,values,snapshot,terrain,map} = fixture(48,24); let clock = 0;
    try {
      detail.update(focus,250,() => clock += 0.1,0.7);
      expect(detail.pending).toBeGreaterThan(0); expect(detail.root.children).toHaveLength(0);
      detail.update(focus,250,noTime,1);
      const old = detail.root.children[0] as Mesh, disposed = jest.spyOn(old.geometry,'dispose');
      values[12*map.width+12] = 2;
      const changed = snapshot.sync(map); terrain.update(changed); detail.dirty(changed);
      expect(detail.pending).toBeGreaterThan(0); detail.update(focus,250,noTime,1);
      detail.update(new Vector3(360,0,120),250,noTime,1);
      expect(disposed).toHaveBeenCalledTimes(1); expect(detail.patches.size).toBeLessThanOrEqual(MAX_DETAIL_PATCHES);
      for (const child of detail.root.children) expect((child as Mesh).geometry.getAttribute('position').getX(0)).toBeGreaterThanOrEqual(240);
    } finally { detail.dispose(); }
  });
  it('does not allocate detailed meshes for province-scale or heightless practice maps', () => {
    const {detail,map,snapshot} = fixture(24,24,600);
    const flat = new TerrainDetail(new CityHeightField(snapshot,{...map,heights:null}),(_x,_y,_wet,out) => { out.setHex(0x7a9150); return 0; });
    try {
      detail.update(focus,100,noTime,1); expect(detail.patches.size).toBe(0);
      flat.update(focus,100,noTime,1); expect(flat.patches.size).toBe(0);
    } finally { detail.dispose(); flat.dispose(); }
  });
  it('keeps lake surfaces and existing house pads level without lifting roads or changing simulation tiles', () => {
    const {detail,map,values,snapshot,terrain} = fixture(8,8);
    map.cellZones = false; values[10] = 2; values[27] = 249;
    const changed = snapshot.sync(map); terrain.update(changed);
    const before = values.slice();
    try {
      detail.update(new Vector3(40,0,40),200,noTime,1);
      const p = (detail.root.children[0] as Mesh).geometry.getAttribute('position'), perTile = 81;
      expect(Number.isFinite(terrain.flatHeight(27))).toBe(true);
      for (const [tile,height] of [[10,terrain.water[10]],[27,terrain.flatHeight(27)]]) {
        let error = 0;
        for (let v = tile*perTile; v < (tile+1)*perTile; v++) error = Math.max(error,Math.abs(p.getY(v)-DETAIL_LIFT-height));
        expect(error).toBeLessThan(0.00001);
      }
      expect(values).toEqual(before);
    } finally { detail.dispose(); }
  });
  it('composes province masks, ground scans and PBR normals without changing the shared standard shader', () => {
    const base = ShaderLib.standard, material = cityTerrainDetailMaterial();
    const shader = { vertexShader: base.vertexShader, fragmentShader: base.fragmentShader, uniforms: {} };
    material.onBeforeCompile(shader as never,{} as WebGLRenderer);
    expect(shader.fragmentShader).toContain('cityUnowned');
    expect(shader.fragmentShader).toContain('cityGrassScan');
    expect(shader.fragmentShader).toContain('groundShore');
    expect(shader.fragmentShader).toContain('mat3(viewMatrix)*vec3(groundBump.x');
    expect(base.fragmentShader).not.toContain('cityGrassScan');
    expect(new Color(material.color)).toEqual(new Color(0xffffff));
  });
});
