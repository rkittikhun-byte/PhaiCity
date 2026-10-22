/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, BufferGeometry, CircleGeometry, Float32BufferAttribute, Group, Mesh, PlaneGeometry, RingGeometry } from 'three';
import { clipToMap, toolFootprint, ToolHover } from '../../cityView.js';
import type { TilePoint } from '../../cityView.js';
import { isOpenLand, PLOT_REACH } from '../../plots.js';
import { isRoadTile, roadLevelAt, servesZones } from '../../roadLevels.js';
import { cityDrawMaterial, cityToolMaterial, cityZoneGridMaterial } from '../materials/library.js';
import type { CityHeightField } from './heightfield.js';
import { smoothLine, type Point } from './roadCurves.js';
import { BUILDING_SCALE, poseAgainstRoad, type RoadNear, slideToRoad } from './tileModels.js';
import { Placement } from './placement.js';
import type { CityMapReader } from './types.js';

/**
 * Flat squares on the ground: each tile split into cells×cells squares, each inset by gap from its edges so the gaps
 * read as lines, lifted above the ground and following the terrain.
 */
function groundSquares(tiles: readonly TilePoint[], cells: number, gap: number, lift: number,
                       terrain?: CityHeightField): BufferGeometry {
  const positions: number[] = [];
  const size = 10 / cells;
  const height = (x: number, z: number): number => (terrain?.enabled ? terrain.sample(x, z) : 0) + lift;
  for (const tile of tiles) {
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const x0 = tile.x * 10 + cx * size + gap, x1 = tile.x * 10 + (cx + 1) * size - gap;
        const z0 = tile.y * 10 + cy * size + gap, z1 = tile.y * 10 + (cy + 1) * size - gap;
        const a = [x0, height(x0, z0), z0], b = [x0, height(x0, z1), z1];
        const c = [x1, height(x1, z0), z0], d = [x1, height(x1, z1), z1];
        positions.push(...a, ...b, ...c, ...c, ...b, ...d);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Four-cornered patches lying on the ground (corners in order round it), each cut into pieces about half a tile across so
 * it follows the terrain, lifted above it */
function groundQuads(quads: ReadonlyArray<readonly Point[]>, lift: number, terrain?: CityHeightField): BufferGeometry {
  const positions: number[] = [];
  const height = (x: number, z: number): number => (terrain?.enabled ? terrain.sample(x, z) : 0) + lift;
  for (const [a, b, , d] of quads) {
    const along = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5)), across = Math.max(1, Math.ceil(Math.hypot(d[0] - a[0], d[1] - a[1]) / 5));
    const at = (s: number, t: number): [number, number, number] => {
      const x = a[0] + (b[0] - a[0]) * s + (d[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * s + (d[1] - a[1]) * t;
      return [x, height(x, z), z];
    };
    for (let row = 0; row < across; row++) for (let column = 0; column < along; column++) {
      const p = at(column / along, row / across), q = at((column + 1) / along, row / across);
      const r = at((column + 1) / along, (row + 1) / across), s = at(column / along, (row + 1) / across);
      // Facing up whichever way round the corners come
      const up = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
      const [first, second] = up >= 0 ? [[p, q, r], [p, r, s]] : [[p, r, q], [p, s, r]];
      positions.push(...first.flat(), ...second.flat());
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A dashed line down the middle of a drawn path: a short dash on every other tile, along the way the path goes. */
function centreDashes(tiles: readonly TilePoint[], lift: number, terrain?: CityHeightField): BufferGeometry {
  const positions: number[] = [];
  const height = (x: number, z: number): number => (terrain?.enabled ? terrain.sample(x, z) : 0) + lift;
  for (let i = 0; i < tiles.length; i += 2) {
    const next = tiles[i + 1] ?? tiles[i - 1];
    const along = next && next.x !== tiles[i].x ? 'x' : 'z';
    const cx = (tiles[i].x + .5) * 10, cz = (tiles[i].y + .5) * 10;
    const [hx, hz] = along === 'x' ? [2.6, .45] : [.45, 2.6];
    const a = [cx - hx, height(cx - hx, cz - hz), cz - hz], b = [cx - hx, height(cx - hx, cz + hz), cz + hz];
    const c = [cx + hx, height(cx + hx, cz - hz), cz - hz], d = [cx + hx, height(cx + hx, cz + hz), cz + hz];
    positions.push(...a, ...b, ...c, ...c, ...b, ...d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A line being drawn as the road it will be (owner, 14 Oct 2026: "การวาดถนน ทำไมมันเป็นช่องแบบนี้นะ"): a see-through
 * band along the same smooth curve the finished road takes (roadCurves.ts), with dashes down its middle, as Cities:
 * Skylines shows a road before it is built. The tiles it builds on are still the path's.
 */
function ghostRoad(tiles: readonly TilePoint[], lift: number, terrain?: CityHeightField,
  start?: { x: number; y: number } | null, end?: { x: number; y: number } | null, straight = false,
  controls?: readonly TilePoint[] | null, halfW = 3.6, refused?: ((x: number, z: number) => boolean) | null):
  { band: BufferGeometry; dashes: BufferGeometry; refused: BufferGeometry } {
  // From the marked start to the marked end (on the middle of the roads they join), through the tiles between
  const middles = tiles.map((t): Point => [(t.x + .5) * 10, (t.y + .5) * 10]);
  if (start && middles.length) middles[0] = [start.x * 10, start.y * 10];
  if (end && middles.length > 1) middles[middles.length - 1] = [end.x * 10, end.y * 10];
  // A line drawn by clicks is the very curve through its points (src/drawPaths.ts bezier), from the marked start to
  // the marked end; the straight mode one straight line; free drawing follows its tiles, smoothed
  let line: Point[];
  if (controls && controls.length > 1) {
    const at: Point[] = controls.map((c): Point => [(c.x + .5) * 10, (c.y + .5) * 10]);
    if (start) at[0] = [start.x * 10, start.y * 10];
    if (end) at[at.length - 1] = [end.x * 10, end.y * 10];
    line = [];
    for (let k = 0; k <= 64; k++) {
      let level = at.map((p): Point => [p[0], p[1]]);
      while (level.length > 1) level = level.slice(1).map((p, i): Point => [level[i][0] + (p[0] - level[i][0]) * k / 64, level[i][1] + (p[1] - level[i][1]) * k / 64]);
      line.push(level[0]);
    }
  } else line = straight && middles.length > 1 ? smoothLine([middles[0], middles[middles.length - 1]]) : smoothLine(middles);
  const height = (x: number, z: number): number => (terrain?.enabled ? terrain.sample(x, z) : 0) + lift;
  const band: number[] = [], dashes: number[] = [], red: number[] = [];
  const side = (i: number): [number, number] => {
    const [ax, az] = line[Math.max(0, i - 1)], [bx, bz] = line[Math.min(line.length - 1, i + 1)], length = Math.hypot(bx - ax, bz - az) || 1;
    return [-(bz - az) / length, (bx - ax) / length];
  };
  // Faces up: a and b at one end, c and d at the other
  const quad = (out: number[], a: number[], b: number[], c: number[], d: number[]): void => { out.push(...a, ...c, ...b, ...b, ...c, ...d); };
  let along = 0;
  const w = halfW, d = Math.min(.3, halfW * .12), ew = Math.min(.22, halfW * .08);
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1], [bx, bz] = line[i], [nax, naz] = side(i - 1), [nbx, nbz] = side(i);
    quad(band, [ax + nax * w, height(ax + nax * w, az + naz * w), az + naz * w], [ax - nax * w, height(ax - nax * w, az - naz * w), az - naz * w],
      [bx + nbx * w, height(bx + nbx * w, bz + nbz * w), bz + nbz * w], [bx - nbx * w, height(bx - nbx * w, bz - nbz * w), bz - nbz * w]);
    // ... the stretch that cannot be built, in red, as wide as the road and along its curve, never a tile's square
    // (owner, 21 Oct 2026: "ที่สังเกต ช่อง หรือ ตารางยังไม่หายไปเลย")
    if (refused?.((ax + bx) / 2, (az + bz) / 2)) {
      quad(red, [ax + nax * w, height(ax + nax * w, az + naz * w) + .04, az + naz * w], [ax - nax * w, height(ax - nax * w, az - naz * w) + .04, az - naz * w],
        [bx + nbx * w, height(bx + nbx * w, bz + nbz * w) + .04, bz + nbz * w], [bx - nbx * w, height(bx - nbx * w, bz - nbz * w) + .04, bz - nbz * w]);
    }
    // Outer white shoulder lines for sharp visibility on terrain
    quad(dashes, [ax + nax * w, height(ax + nax * w, az + naz * w) + .06, az + naz * w], [ax + nax * (w - ew), height(ax + nax * (w - ew), az + naz * (w - ew)) + .06, az + naz * (w - ew)],
      [bx + nbx * w, height(bx + nbx * w, bz + nbz * w) + .06, bz + nbz * w], [bx + nbx * (w - ew), height(bx + nbx * (w - ew), bz + nbz * (w - ew)) + .06, bz + nbz * (w - ew)]);
    quad(dashes, [ax - nax * (w - ew), height(ax - nax * (w - ew), az - naz * (w - ew)) + .06, az - naz * (w - ew)], [ax - nax * w, height(ax - nax * w, az - naz * w) + .06, az - naz * w],
      [bx - nbx * (w - ew), height(bx - nbx * (w - ew), bz - nbz * (w - ew)) + .06, bz - nbz * (w - ew)], [bx - nbx * w, height(bx - nbx * w, bz - nbz * w) + .06, bz - nbz * w]);
    // A dash on every other 5 units of its length
    const length = Math.hypot(bx - ax, bz - az);
    if (Math.floor(along / 5) % 2 === 0) {
      quad(dashes, [ax + nax * d, height(ax, az) + .06, az + naz * d], [ax - nax * d, height(ax, az) + .06, az - naz * d],
        [bx + nbx * d, height(bx, bz) + .06, bz + nbz * d], [bx - nbx * d, height(bx, bz) + .06, bz - nbz * d]);
    }
    along += length;
  }
  const geometry = (positions: number[]): BufferGeometry => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  };
  return { band: geometry(band), dashes: geometry(dashes), refused: geometry(red) };
}

/** Thin strips along the sides of a four-cornered patch, width w inside its edge: an outline that lies on the ground */
function edgeStrips(quad: readonly Point[], w: number): Point[][] {
  const cx = quad.reduce((a, p) => a + p[0], 0) / quad.length, cz = quad.reduce((a, p) => a + p[1], 0) / quad.length;
  const inward = (p: Point): Point => {
    const dx = cx - p[0], dz = cz - p[1], d = Math.hypot(dx, dz) || 1;
    return [p[0] + dx / d * w * Math.SQRT2, p[1] + dz / d * w * Math.SQRT2];
  };
  return quad.map((a, i) => {
    const b = quad[(i + 1) % quad.length];
    return [a as Point, b as Point, inward(b as Point), inward(a as Point)];
  });
}

/** Whether a point (x, z) lies inside a four-cornered patch on the ground (its corners in order round it) */
function insideQuad(quad: readonly Point[], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < quad.length; i++) {
    const [ax, az] = quad[i], [bx, bz] = quad[(i + 1) % quad.length], cross = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** Split a rectangle or grid tile set into contiguous horizontal and vertical road runs so each run renders at the exact road width. */
function gridRuns(tiles: readonly TilePoint[]): TilePoint[][] {
  const byRow = new Map<number, number[]>(), byCol = new Map<number, number[]>();
  for (const t of tiles) {
    let row = byRow.get(t.y); if (!row) { row = []; byRow.set(t.y, row); } row.push(t.x);
    let col = byCol.get(t.x); if (!col) { col = []; byCol.set(t.x, col); } col.push(t.y);
  }
  const runs: TilePoint[][] = [];
  for (const [y, xs] of byRow) {
    xs.sort((a, b) => a - b);
    let run: TilePoint[] = [];
    for (let i = 0; i < xs.length; i++) {
      if (i > 0 && xs[i] === xs[i - 1]) continue;
      if (run.length && xs[i] !== run[run.length - 1].x + 1) { if (run.length > 1) runs.push(run); run = []; }
      run.push({ x: xs[i], y });
    }
    if (run.length > 1) runs.push(run);
  }
  for (const [x, ys] of byCol) {
    ys.sort((a, b) => a - b);
    let run: TilePoint[] = [];
    for (let i = 0; i < ys.length; i++) {
      if (i > 0 && ys[i] === ys[i - 1]) continue;
      if (run.length && ys[i] !== run[run.length - 1].y + 1) { if (run.length > 1) runs.push(run); run = []; }
      run.push({ x, y: ys[i] });
    }
    if (run.length > 1) runs.push(run);
  }
  return runs;
}

export class ToolOutline {
  readonly root=new Group();private signature='';
  /** The nearest road (roadCurves.ts nearest), so a building's outline stands against it as the building will */
  snap:((x:number,z:number,reach:number)=>RoadNear|null)|null=null;
  /** Whether buildings are drawn at BUILDING_SCALE (a map painted a cell at a time), so the outline is that size too */
  scaledBuildings=false;
  /** The ground of the object whose tile (y * width + x) this is, as it is drawn and turned (its lot, a plot's or a
   * terrace's run, a building's ground), its corners in world units; null for open land, woods, water and roads */
  objectOf:((index:number)=>readonly Point[]|null)|null=null;
  /** The lot a building's tile (y * width + x) lies on, its corners in world units (roadCurves.ts lotAt) */
  lotOf:((index:number)=>readonly Point[]|null)|null=null;
  /** The stretches of drawn road and railway lying on these tiles (index y × width + x), as patches on the ground, and the
   * tiles they cover: what the bulldozer's red shows instead of whole tiles (index.ts) */
  roadStrips:((tiles:ReadonlySet<number>)=>{quads:Point[][];covered:ReadonlySet<number>})|null=null;
  constructor(private width:number,private height:number,private terrain?:CityHeightField) {this.root.renderOrder=25;}
  update(hover:ToolHover|null):void {
    const r=hover?clipToMap(toolFootprint(hover),this.width,this.height):null;
    // A drawn line, grid or fill is shown tile by tile; its signature is a hash, as it may be long
    let path=0;for(const t of hover?.path??[])path=(Math.imul(path,31)+t.x*1009+t.y)|0;
    const marker=hover?.linePoint?[Math.round(hover.linePoint.x*20),Math.round(hover.linePoint.y*20)]:null;
    const signature=JSON.stringify([r,hover?.pose??null,hover?.straight??false,hover?.controls??null,hover?.colour,this.terrain?.version,hover?.path?.length??0,path,hover?.line??false,marker,hover?.lineStart??null,hover?.cursorPoint??null,hover?.blocked?.length??0,hover?.snapDots?.length??0,hover?.snapDots?.[0]??null,hover?.snapKind??null,hover?.snapWay??null,hover?.snapGuide??null,Math.round(hover?.tilePixels??0),hover?.roadWidth??0,hover?.drawMode??'',hover?.doze??false,hover?.inspect?[Math.round(hover.inspect.x*20),Math.round(hover.inspect.y*20)]:null,hover?.inspectPath?.length??0]);if(signature===this.signature)return;this.signature=signature;this.clear();
    if(!r||!hover)return;
    if(hover.inspect){this.inspected(hover);return;}
    const halfW=hover.roadWidth?hover.roadWidth*.5:3.6;
    // A dot on each road tile near the mouse where a click may join it, its dead ends ringed, all under the marker of
    // where the click lands, which stays the boldest (src/game.js snapDots)
    if(hover.snapDots?.length){const r0=Math.max(.9,Math.min(2.1,halfW)),px=10/Math.max(1,hover.tilePixels??40);
      // ... a few pixels across whatever the zoom: dots about 7, ends' rings about 17
      const dot=Math.max(r0*.24,3.5*px),inner=Math.max(r0*.42,6*px),outer=Math.max(r0*.6,8.5*px);
      const dots=hover.snapDots.filter(d=>!d.end&&!d.node),ends=hover.snapDots.filter(d=>d.end),nodes=hover.snapDots.filter(d=>d.node);
      if(dots.length){const mesh=new Mesh(this.discs(dots,0,dot,.7),cityToolMaterial('#ffffff',true));mesh.renderOrder=25;this.root.add(mesh);}
      if(ends.length){const mesh=new Mesh(this.discs(ends,inner,outer,.71),cityToolMaterial('#ffffff'));mesh.renderOrder=25;this.root.add(mesh);
        const fill=new Mesh(this.discs(ends,0,inner,.7),cityToolMaterial(hover.colour,true));fill.renderOrder=25;this.root.add(fill);}
      // ... and its junctions as diamonds, a shape of their own (src/roads/roadSnap.ts)
      if(nodes.length){const mesh=new Mesh(this.discs(nodes,inner*1.15,outer*1.2,.71,4),cityToolMaterial('#ffffff'));mesh.renderOrder=25;this.root.add(mesh);
        const fill=new Mesh(this.discs(nodes,0,inner*1.15,.7,4),cityToolMaterial(hover.colour,true));fill.renderOrder=25;this.root.add(fill);}}
    // A road or railway tool's small marker where it would start or end, on a road's middle line when near one
    if(hover.linePoint){const x=hover.linePoint.x*10,z=hover.linePoint.y*10,y=(this.terrain?.enabled?this.terrain.sample(x,z):0)+.75;
      // ... the boldest mark there, about 26 pixels across at least whatever the zoom: a thick white ring edged dark, so it
      // reads on any road or ground, round the tool's colour, and a white point on the very spot the click lands
      const r0=Math.max(.9,Math.min(2.1,halfW),13*10/Math.max(1,hover.tilePixels??1e9));
      this.landingMarker(hover,x,y,z,r0,halfW);
      // ... where the mouse is when a snap moves the click: a faint ring, dashed to where it lands (src/drawReadout.ts)
      if(hover.cursorPoint)this.cursorLink(hover.cursorPoint,{x,z},r0);
      // ... and the line's first point, A, ringed until the line is built
      if(hover.lineStart){const ax=hover.lineStart.x*10,az=hover.lineStart.y*10,ay=(this.terrain?.enabled?this.terrain.sample(ax,az):0)+.78;
        const pin=new Mesh(new RingGeometry(r0*1.15,r0*1.45,28).rotateX(-Math.PI/2),cityToolMaterial('#ffffff'));pin.position.set(ax,ay,az);pin.renderOrder=27;
        this.root.add(pin);}
      if(!hover.path||hover.path.length<2)return;}
    if(hover.path&&hover.path.length>0){
      // What it could not build on (src/game.js estimateTiles), so a line never comes out broken unseen: a building's tile
      // as that building's lot, turned with its road as the building stands (roadCurves.ts lots; owner, 18 Oct 2026); a
      // line's other refused tiles as the stretch of the line over them, red along its curve and as wide as the road
      // (ghostRoad), never a tile's square (owner, 21 Oct 2026: "ที่สังเกต ช่อง หรือ ตารางยังไม่หายไปเลย")
      const blocked=(hover.blocked??[]).filter(t=>t.x>=0&&t.y>=0&&t.x<this.width&&t.y<this.height);
      const lots=new Set<readonly Point[]>(),squares:TilePoint[]=[],refusedTiles=new Set<number>();
      for(const t of blocked){const lot=this.lotOf?.(t.y*this.width+t.x)??null;if(lot)lots.add(lot);else squares.push(t);refusedTiles.add(t.y*this.width+t.x);}
      // ... a stretch refused where the road as wide as it is drawn would lie on a refused tile, or in a building's lot
      const refused=blocked.length?(x:number,z:number):boolean=>{const m=halfW*.7;
        for(const[ox,oz]of[[0,0],[m,0],[-m,0],[0,m],[0,-m]])if(refusedTiles.has(Math.floor((z+oz)/10)*this.width+Math.floor((x+ox)/10)))return true;
        return [...lots].some(lot=>insideQuad(lot,x,z));}:null;
      const redMaterial=cityToolMaterial('#e0453a',true);
      if(squares.length&&!hover.line){const red=new Mesh(groundSquares(squares,1,.12,.8,this.terrain),redMaterial);red.renderOrder=27;this.root.add(red);}
      if(lots.size){const red=new Mesh(groundQuads([...lots],.8,this.terrain),redMaterial);red.renderOrder=27;this.root.add(red);}
      // A see-through band over every tile it would build on; a line also gets a dashed middle, as Cities: Skylines draws
      const tiles=hover.path.filter(t=>t.x>=0&&t.y>=0&&t.x<this.width&&t.y<this.height);
      if(hover.line&&tiles.length>1&&(hover.drawMode==='rectangle'||hover.drawMode==='grid')){
        const runs=gridRuns(tiles);
        if(runs.length){
          const bandMat=cityDrawMaterial(hover.colour),dashMat=cityToolMaterial('#ffffff');
          for(const run of runs){
            const ghost=ghostRoad(run,.65,this.terrain,null,null,true,null,halfW,refused);
            const band=new Mesh(ghost.band,bandMat);band.renderOrder=25;
            const dashes=new Mesh(ghost.dashes,dashMat);dashes.renderOrder=26;
            const red=new Mesh(ghost.refused,cityToolMaterial('#c81e14'));red.renderOrder=28;
            this.root.add(band,dashes,red);
          }
          return;
        }
      }
      // A line drawn tile by tile is shown as the smooth road it becomes (ghostRoad); a fill as its tiles
      if(hover.line&&tiles.length>1){const ghost=ghostRoad(tiles,.65,this.terrain,hover.lineStart,hover.linePoint,hover.straight===true,hover.controls,halfW,refused);
        const band=new Mesh(ghost.band,cityDrawMaterial(hover.colour));band.renderOrder=25;
        const dashes=new Mesh(ghost.dashes,cityToolMaterial('#ffffff'));dashes.renderOrder=26;
        const red=new Mesh(ghost.refused,cityToolMaterial('#c81e14'));red.renderOrder=28;this.root.add(band,dashes,red);return;}
      // The bulldozer's red follows the road it takes, as wide as the road, not the tiles' squares off it (owner, 20 Oct 2026:
      // "รื้อถอน ทำไมเป็นช่องสี่เหลี่ยม ออกจากถนน เยอะมาก")
      let squaresLeft=tiles;
      if(hover.doze&&this.roadStrips){
        const strips=this.roadStrips(new Set(tiles.map(t=>t.y*this.width+t.x)));
        if(strips.quads.length){const red=new Mesh(groundQuads(strips.quads,.7,this.terrain),cityDrawMaterial(hover.colour));red.renderOrder=25;this.root.add(red);}
        squaresLeft=tiles.filter(t=>!strips.covered.has(t.y*this.width+t.x));
      }
      // ... and a building it takes as the building's own outline, turned with it, not its tiles' squares
      if(this.lotOf){const taken=new Set<readonly Point[]>();
        squaresLeft=squaresLeft.filter(t=>{const lot=this.lotOf!(t.y*this.width+t.x);if(lot)taken.add(lot);return !lot;});
        if(taken.size){const lot=new Mesh(groundQuads([...taken],.7,this.terrain),cityDrawMaterial(hover.colour));lot.renderOrder=25;this.root.add(lot);}}
      if(squaresLeft.length){const band=new Mesh(groundSquares(squaresLeft,1,hover.line?0:.3,.65,this.terrain),cityDrawMaterial(hover.colour));band.renderOrder=25;
        this.root.add(band);}
      if(hover.line){const dashes=new Mesh(centreDashes(tiles,.72,this.terrain),cityToolMaterial('#ffffff'));dashes.renderOrder=26;this.root.add(dashes);}
      return;
    }
    const x=(r.x0+r.x1+1)*5,z=(r.y0+r.y1+1)*5;
    // A building's outline at the size it is drawn (owner, 15 Oct 2026: "ขนาดของ rect ของ tools ก่อนที่จะวาง ต้องเท่ากับ
    // ขนาดของ tool นั้นๆ และ snap กับถนน")
    const shrink=hover.building?(hover.fill??1):this.scaledBuildings&&hover.size>=3?BUILDING_SCALE:1;
    const w=(r.x1-r.x0+1)*10*shrink,d=(r.y1-r.y0+1)*10*shrink;
    const size=hover.size;
    // When hovering over a road with a 1x1 tool (query, bulldozer, road_upgrade), fit the outline rect to the road's actual width and angle
    if(size===1&&!hover.building&&!hover.linePoint&&this.snap){
      const roadNear=this.snap(x,z,5);
      if(roadNear){
        const rw=Math.max(2.6,roadNear.reach*2),rd=10,rot=Math.atan2(roadNear.tx,roadNear.tz);
        const ground=this.terrain?.enabled?this.terrain.sample(roadNear.x,roadNear.z):0;
        const frame=new Group();frame.position.set(roadNear.x,ground+.6,roadNear.z);frame.rotation.y=rot;
        const fill=new Mesh(new PlaneGeometry(rw,rd).rotateX(-Math.PI/2),cityToolMaterial(hover.colour,true));fill.renderOrder=10;frame.add(fill);
        const edge=cityToolMaterial('#ffffff'),t=.32;
        for(const[lw,ld,sx,sz]of[[rw+t,t,0,-rd/2],[rw+t,t,0,rd/2],[t,rd+t,-rw/2,0],[t,rd+t,rw/2,0]]){
          const line=new Mesh(new BoxGeometry(lw,.06,ld),edge);line.position.set(sx,.04,sz);line.renderOrder=11;frame.add(line);}
        this.root.add(frame);
        return;
      }
    }
    // A one-tile tool pointing at a building (the query tool, the bulldozer's click): the building's own outline, turned
    // with it, not the square of the tile under the mouse
    const lotHere=size===1&&!hover.building&&this.lotOf?this.lotOf(r.y0*this.width+r.x0):null;
    if(lotHere){const fill=new Mesh(groundQuads([lotHere],.7,this.terrain),cityToolMaterial(hover.colour,true));fill.renderOrder=25;this.root.add(fill);return;}
    // A building of 3 x 3 and up beside a road: turned to face it and stood against its edge, at the size it is drawn
    // (owner, 14 Oct 2026: "ช่วงที่จะวาด ก็ต้อง snap กับถนนเลย")
    const near=(hover.building??size>=3)&&!hover.cellPoint&&!hover.pose&&this.snap?this.snap(x,z,size*5+14):null;
    if(near||hover.pose){
      // The building the tool would put down, stood against its road as the city view will draw it (placement.ts)
      const pose=hover.pose?{x:hover.pose[0],z:hover.pose[1],rotation:hover.pose[2]}:poseAgainstRoad(x,z,size,near!);
      // (a 3 x 3 put down where the game posed it shows the outline it takes, its whole block turned with it, fenced
      // as it will be: src/buildings/turnedFootprint.ts)
      const whole=size===3&&!!hover.pose;
      const g=Placement.ofTool(size,x,z).againstRoad(pose.x,pose.z,pose.rotation,whole?1:BUILDING_SCALE).ground();
      // ... its front against the road it faces, as the building will stand (tileModels.ts toRoadEdge)
      const slide=this.snap&&!whole?slideToRoad(g.x,g.z,g.rotation,g.depth/2,this.snap):0;
      g.x+=Math.sin(g.rotation)*slide;g.z+=Math.cos(g.rotation)*slide;
      const ground=this.terrain?.enabled?this.terrain.sample(g.x,g.z):0;
      const frame=new Group();frame.position.set(g.x,ground+.6,g.z);frame.rotation.y=g.rotation;
      const fill=new Mesh(new PlaneGeometry(g.width,g.depth).rotateX(-Math.PI/2),cityToolMaterial(hover.colour,true));fill.renderOrder=10;frame.add(fill);
      // A bold white edge, which shows on any ground (owner: "เส้นมันจาง มองไม่เห็น")
      const edge=cityToolMaterial('#ffffff'),t=.4,sw=g.width,sd=g.depth;
      for(const[lw,ld,sx,sz]of[[sw+t,t,0,-sd/2],[sw+t,t,0,sd/2],[t,sd+t,-sw/2,0],[t,sd+t,sw/2,0]]){
        const line=new Mesh(new BoxGeometry(lw,.06,ld),edge);line.position.set(sx,.04,sz);line.renderOrder=11;frame.add(line);}
      this.root.add(frame);
      return;
    }
    const elevation=(sx:number,sz:number):number=>this.terrain?.sample(Math.max(r.x0*10+.0001,Math.min((r.x1+1)*10-.0001,sx)),Math.max(r.y0*10+.0001,Math.min((r.y1+1)*10-.0001,sz)))??0;
    const material=cityToolMaterial(hover.colour),fill=new Mesh(new PlaneGeometry(w,d).rotateX(-Math.PI/2),cityToolMaterial(hover.colour,true));
    if(this.terrain?.enabled){const p=fill.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,elevation(x+p.getX(i),z+p.getZ(i)));fill.geometry.computeVertexNormals();}
    fill.position.set(x,.65,z);fill.renderOrder=25;this.root.add(fill);
    for(const[sw,sd,sx,sz]of[[w,.35,x,z-d/2],[w,.35,x,z+d/2],[.35,d,x-w/2,z],[.35,d,x+w/2,z]]){
      const line=new Mesh(new BoxGeometry(sw,.025,sd),material);
      if(this.terrain?.enabled){const p=line.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+elevation(sx+p.getX(i),sz+p.getZ(i)));line.geometry.computeVertexNormals();}
      line.position.set(sx,.68,sz);line.renderOrder=26;this.root.add(line);
    }
  }
  /**
   * Where a road, railway or canal tool's click lands (x, y, z in world units), in the look of what it lands on (owner,
   * 22 Oct 2026: the player sees where A or B will land before the click; src/roads/roadSnap.ts SnapKind): a diamond on
   * a junction, a ring filled with the tool's colour on a road's end, a white dot on a point along a road, a bar across
   * the road on its middle line, a small ring on a dashed guideline beside a road, and a plain small ring with a point
   * where it lands where the mouse is (or on a straight way from the last point). Each white edged dark, so it reads on
   * any road or ground. A tool that does not say (the upgrade tool) keeps the ring.
   */
  private landingMarker(hover:ToolHover,x:number,y:number,z:number,r0:number,halfW:number):void {
    const kind=hover.snapKind===undefined?'end':hover.snapKind,flat=(g:BufferGeometry):BufferGeometry=>g.rotateX(-Math.PI/2);
    const add=(geometry:BufferGeometry,colour:string,lift:number,order:number,soft=false):void=>{
      const mesh=new Mesh(geometry,cityToolMaterial(colour,soft));mesh.position.set(x,y+lift,z);mesh.renderOrder=order;this.root.add(mesh);};
    if(kind==='node'){
      // ... a diamond, its corners out along the map's axes, as the dots mark junctions
      const d=r0*1.25;
      add(flat(new CircleGeometry(d*.7,4)),hover.colour,0,26,true);
      add(flat(new RingGeometry(d*.62,d*1.12,4)),'#22303a',.01,26);
      add(flat(new RingGeometry(d*.7,d,4)),'#ffffff',.02,26.5);
      add(flat(new CircleGeometry(r0*.18,12)),'#ffffff',.02,26.5);
    }else if(kind==='end'){
      add(flat(new CircleGeometry(r0*.7,20)),hover.colour,0,26,true);
      add(flat(new RingGeometry(r0*.62,r0*1.12,28)),'#22303a',.01,26);
      add(flat(new RingGeometry(r0*.7,r0,28)),'#ffffff',.02,26.5);
      add(flat(new CircleGeometry(r0*.18,12)),'#ffffff',.02,26.5);
    }else if(kind==='mark'){
      add(flat(new CircleGeometry(r0*.75,20)),'#22303a',.01,26);
      add(flat(new CircleGeometry(r0*.55,20)),'#ffffff',.02,26.5);
    }else if(kind==='road'&&hover.snapWay){
      // ... a bar across the road, a little wider than it, where the line will meet its middle
      const across=Math.atan2(-hover.snapWay.y,hover.snapWay.x),long=Math.max(halfW,r0)*2.3,thick=Math.max(.28,r0*.32);
      const bar=(w:number,d:number,colour:string,lift:number,order:number):void=>{
        const mesh=new Mesh(new BoxGeometry(w,.05,d),cityToolMaterial(colour));mesh.position.set(x,y+lift,z);mesh.rotation.y=across;
        mesh.renderOrder=order;this.root.add(mesh);};
      bar(thick+r0*.16,long+r0*.16,'#22303a',.01,26);
      bar(thick,long,'#ffffff',.03,26.5);
      add(flat(new CircleGeometry(r0*.32,16)),hover.colour,.05,27);
    }else if(kind==='guide'&&hover.snapGuide&&hover.snapGuide.length>1){
      // ... the guideline, dashed, and a small ring on it
      const [a,b]=hover.snapGuide,ax=a.x*10,az=a.y*10,dx=b.x*10-ax,dz=b.y*10-az,length=Math.hypot(dx,dz),dash=Math.max(.8,r0*.6);
      const ground=(px:number,pz:number):number=>(this.terrain?.enabled?this.terrain.sample(px,pz):0)+.74;
      for(let s=0;s+dash<=length;s+=dash*2){const px=ax+dx*(s+dash/2)/length,pz=az+dz*(s+dash/2)/length;
        const piece=new Mesh(new BoxGeometry(.22,.04,dash),cityToolMaterial('#ffffff'));piece.position.set(px,ground(px,pz),pz);
        piece.rotation.y=Math.atan2(dx,dz);piece.renderOrder=26;this.root.add(piece);}
      add(flat(new RingGeometry(r0*.5,r0*.85,24)),'#22303a',.01,26);
      add(flat(new RingGeometry(r0*.56,r0*.78,24)),'#ffffff',.02,26.5);
      add(flat(new CircleGeometry(r0*.16,12)),'#ffffff',.02,26.5);
    }else{
      add(flat(new RingGeometry(r0*.42,r0*.72,24)),'#22303a',.01,26);
      add(flat(new RingGeometry(r0*.48,r0*.66,24)),'#ffffff',.02,26.5);
      add(flat(new CircleGeometry(r0*.16,12)),'#ffffff',.02,26.5);
    }
  }
  /**
   * What the inspector points at or opened (ToolHover.inspect), never as a tile (owner, 22 Oct 2026): an object by its own
   * ground as drawn and turned, in the tool's colour with a white edge, as its outline was when it was put down; a road by
   * the stretch of it drawn on its tiles (the card's whole stretch once opened); plain ground by a soft round mark at the
   * very point, in metres.
   */
  private inspected(hover:ToolHover):void {
    const point=hover.inspect!,tx=Math.floor(point.x),ty=Math.floor(point.y),index=ty*this.width+tx;
    const shape=tx>=0&&ty>=0&&tx<this.width&&ty<this.height?this.objectOf?.(index)??this.lotOf?.(index)??null:null;
    if(shape){
      const fill=new Mesh(groundQuads([shape],.7,this.terrain),cityToolMaterial(hover.colour,true));fill.renderOrder=25;
      const edge=new Mesh(groundQuads(edgeStrips(shape,.35),.72,this.terrain),cityToolMaterial('#ffffff'));edge.renderOrder=26;
      this.root.add(fill,edge);return;
    }
    const tiles=new Set((hover.inspectPath??[{x:tx,y:ty}]).map(t=>t.y*this.width+t.x));
    const strips=this.roadStrips?.(tiles);
    if(strips?.quads.length){const road=new Mesh(groundQuads(strips.quads,.7,this.terrain),cityToolMaterial(hover.colour,true));road.renderOrder=25;this.root.add(road);return;}
    const x=point.x*10,z=point.y*10,y=(this.terrain?.enabled?this.terrain.sample(x,z):0)+.7;
    const disc=new Mesh(new CircleGeometry(3.2,32).rotateX(-Math.PI/2),cityToolMaterial(hover.colour,true));disc.position.set(x,y,z);disc.renderOrder=25;
    const ring=new Mesh(new RingGeometry(3.2,3.75,40).rotateX(-Math.PI/2),cityToolMaterial('#ffffff',true));ring.position.set(x,y+.01,z);ring.renderOrder=26;
    this.root.add(disc,ring);
  }
  /** Flat rings (or discs, from 0) round points in tiles, on the ground, all in one geometry; sides 4 for diamonds */
  private discs(points:ReadonlyArray<{x:number;y:number}>,inner:number,outer:number,lift:number,sides=16):BufferGeometry {
    const positions:number[]=[],n=sides,ground=(x:number,z:number):number=>(this.terrain?.enabled?this.terrain.sample(x,z):0)+lift;
    for(const p of points){const cx=p.x*10,cz=p.y*10,y=ground(cx,cz);
      for(let k=0;k<n;k++){const a=k/n*Math.PI*2,b=(k+1)/n*Math.PI*2;
        const ia:[number,number,number]=[cx+Math.cos(a)*inner,y,cz+Math.sin(a)*inner],ib:[number,number,number]=[cx+Math.cos(b)*inner,y,cz+Math.sin(b)*inner];
        const oa:[number,number,number]=[cx+Math.cos(a)*outer,y,cz+Math.sin(a)*outer],ob:[number,number,number]=[cx+Math.cos(b)*outer,y,cz+Math.sin(b)*outer];
        positions.push(...ia,...ob,...oa,...ia,...ib,...ob);}}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    return geometry;
  }
  /** A faint ring where the mouse is (tiles), and dashes from it to where the click lands (world units) */
  private cursorLink(cursor:{x:number;y:number},land:{x:number;z:number},r0:number):void {
    const cx=cursor.x*10,cz=cursor.y*10,ground=(x:number,z:number):number=>(this.terrain?.enabled?this.terrain.sample(x,z):0)+.74;
    const faint=new Mesh(new RingGeometry(r0*.55,r0*.8,24).rotateX(-Math.PI/2),cityToolMaterial('#ffffff',true));faint.position.set(cx,ground(cx,cz),cz);faint.renderOrder=26;
    this.root.add(faint);
    const dx=land.x-cx,dz=land.z-cz,length=Math.hypot(dx,dz),dash=Math.max(.6,r0*.5),turn=Math.atan2(dx,dz);
    for(let s=r0*.8;s+dash<length-r0;s+=dash*2){const x=cx+dx*(s+dash/2)/length,z=cz+dz*(s+dash/2)/length;
      const piece=new Mesh(new BoxGeometry(.18,.04,dash),cityToolMaterial('#ffffff'));piece.position.set(x,ground(x,z),z);piece.rotation.y=turn;piece.renderOrder=26;this.root.add(piece);}
  }
  private clear():void {this.root.traverse(n=>{if(n instanceof Mesh)n.geometry.dispose();});this.root.clear();}
  dispose():void {this.clear();}
}

/** The cells of the zone grid a tile is split into: 8 m cells on a 16 m tile, as Cities: Skylines' (owner 13 Oct 2026) */
export const ZONE_GRID_CELLS = 2;

/**
 * The grid of tiles that can take painted zones (src/plots.ts): bare land within reach of a road, shown along the roads
 * while a zone brush or a road tool is in hand (CityView.zoneGrid), each tile as 2 × 2 pale cells. It only reads the
 * map, and builds again a moment after the map changes.
 */
export class ZoneGrid {
  readonly root=new Group();private on=false;private stale=true;private builtAt=-Infinity;
  constructor(private map:CityMapReader,private terrain?:CityHeightField,private now:()=>number=()=>performance.now()) {
    this.root.visible=false;this.root.renderOrder=9;
  }
  show(on:boolean):void {this.on=on;this.root.visible=on;if(on)this.stale=true;}
  /** changed: whether any tile changed since the last frame. */
  update(changed:boolean):void {
    if(changed)this.stale=true;
    const time=this.now();
    if(!this.on||!this.stale||time-this.builtAt<350)return;
    this.stale=false;this.builtAt=time;this.clear();
    const cells=this.cells();
    if(cells.length)this.root.add(new Mesh(groundSquares(cells,ZONE_GRID_CELLS,.32,.22,this.terrain),cityZoneGridMaterial()));
  }
  /** Bare land that a road reaches straight along a row or a column, PLOT_REACH tiles at most. */
  private cells():TilePoint[] {
    const {width,height}=this.map,reached=new Uint8Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(!isRoadTile(this.map.getTileValue(x,y))||!servesZones(roadLevelAt(this.map,x,y)))continue;
      for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])for(let d=1;d<=PLOT_REACH;d++){
        const nx=x+dx*d,ny=y+dy*d;if(nx<0||ny<0||nx>=width||ny>=height)break;reached[ny*width+nx]=1;
      }
    }
    const cells:TilePoint[]=[];
    for(let i=0;i<reached.length;i++){const x=i%width,y=(i-x)/width;if(reached[i]&&isOpenLand(this.map.getTileValue(x,y)))cells.push({x,y});}
    return cells;
  }
  private clear():void {this.root.traverse(n=>{if(n instanceof Mesh)n.geometry.dispose();});this.root.clear();}
  dispose():void {this.clear();}
}
