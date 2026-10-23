/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Ray, Vector3 } from 'three';
import { CityHeightField } from '../../src/render3d/city/heightfield.js';
import { GridHeights, groundHeight } from '../../src/render3d/city/roadBuild.js';
import { TileSnapshot } from '../../src/render3d/city/tileModels.js';
import type { PlacedBuilding } from '../../src/buildings/placedBuildings.js';

/** A real-scale city map on a slope rising east and south, a road along z = 12 tiles, and a building facing it */
function fixture(width = 24, height = 24, tileSizeM = 16) {
  const values = new Uint16Array(width*height), flags = new Uint16Array(width*height);
  const heights = Float32Array.from(values, (_,i) => 150+(i%width)*0.8+Math.floor(i/width)*0.5);
  let list: PlacedBuilding[] = [{ id: 1, tool: 'police', x: 8.5*tileSizeM, z: 10.5*tileSizeM, rot: 0, size: 3, tile: 10*width+8 }];
  const buildings = { version: 1, all: () => list, atTile: (t: number) => list.find(b => b.tile === t) };
  const roadGraph = { version: 1, nearest: (p: readonly [number,number], reach: number) =>
    Math.abs(p[1]-12*tileSizeM) <= reach ? { point: [p[0],12*tileSizeM] as [number,number] } : null };
  const map = { width, height, heights, tileSizeM, cellZones: true, buildings, roadGraph,
    getTileValue: (x: number,y: number) => values[y*width+x], getTileFlags: (x: number,y: number) => flags[y*width+x],
    getTile: (x: number,y: number) => ({ isZone: () => list.some(b => b.tile === y*width+x) }) };
  const snapshot = new TileSnapshot(width,height); snapshot.sync(map as never); snapshot.coverZones();
  const terrain = new CityHeightField(snapshot,map as never);
  return { terrain, map, remove: () => { list = []; buildings.version++; } };
}

describe('the 3D ground levelled under a building (src/terrain/groundGrade.ts)', () => {
  it("draws the building's yard flat at its road, and the model stands on it", () => {
    const { terrain } = fixture();
    expect(terrain.grade?.all()).toHaveLength(1);
    const level = terrain.grade!.all()[0].level;
    // world units: 10 a tile; the yard is tiles 7-9 across and 9-11 deep
    for (const [x,z] of [[71,91],[85,105],[99,119],[80,100]]) expect(terrain.sample(x,z)).toBeCloseTo(level,6);
    expect(terrain.standOn(10*24+8,85,105)).toBeCloseTo(level,6);
    // the road's ground where the front meets it is the same level (the road at z = 120)
    expect(groundHeight(terrain,24,24,85,120)).toBeCloseTo(level,4);
    // the picked ground is the drawn one
    const hit = terrain.intersect(new Ray(new Vector3(85,500,105),new Vector3(0,-1,0)));
    expect(hit!.y).toBeCloseTo(level,4);
  });
  it("sends the roads' worker the same levelled ground", () => {
    const { terrain } = fixture(), grid = new GridHeights(terrain.grid());
    for (let x = 60; x < 120; x += 1.7) for (let z = 80; z < 140; z += 2.3) {
      const tx = Math.floor(x/10), tz = Math.floor(z/10);
      expect(grid.sampleTile(tx,tz,x,z)).toBeCloseTo(terrain.sampleTile(tx,tz,x,z),5);
      expect(groundHeight(grid,24,24,x,z)).toBeCloseTo(groundHeight(terrain,24,24,x,z),5);
    }
  });
  it("levels nothing again when a zone's tiles change but the pads do not (a plot growing)", () => {
    const { terrain } = fixture(), samples = new Map(terrain.grade!.tiles), snapshot = terrain.snapshot as unknown as { coverage: Int32Array };
    // a tile far from the building joins a zone
    const i = 3*24+3; snapshot.coverage[i] = i;
    const changed = terrain.update([i]);
    expect(changed.length).toBeLessThan(10);
    for (const [k,t] of samples) expect(terrain.grade!.tiles.get(k)).toBe(t);
  });
  it('eases back to the hills without a step, and gives the ground back when the building goes', () => {
    const { terrain, remove } = fixture();
    // walking east out of the yard a world unit at a time
    let last = terrain.sample(85,105);
    for (let x = 86; x < 160; x++) { const h = terrain.sample(x,105); expect(Math.abs(h-last)).toBeLessThan(.4); last = h; }
    const levelled = [...terrain.grade!.tiles.keys()], version = terrain.version;
    remove();
    const changed = terrain.update([]);
    expect(changed.sort((a,b) => a-b)).toEqual(levelled.sort((a,b) => a-b));
    expect(terrain.grade!.tiles.size).toBe(0);
    expect(terrain.version).toBeGreaterThan(version);
    expect(terrain.update([])).toEqual([]);
  });
});
