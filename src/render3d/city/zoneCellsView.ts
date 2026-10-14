/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The zone cells along the roads (src/zoneCells.ts) on a map painted a cell at a time, as Cities: Skylines shows its
// zoning: every painted cell in its zone's colour on the ground, always; the empty cells as a pale grid while a zone
// brush is in hand; the cell under the brush picked out. It reads the map and never writes it.
import { Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { ownsLand, type LandMap } from '../../landBlocks.js';
import { cellAt, cellsOf, type CellLayout, type CellMap } from '../../zoneCells.js';
import type { CityHeightField } from './heightfield.js';

/** The zones' colours, as the zone buttons wear them */
const ZONE_COLOURS = [0, 0x4fbf5a, 0x3f86d8, 0xe2b83c];
const LIFT = 0.35, FILL = 0.84;

export class ZoneCellsView {
  readonly root = new Group();
  private layout: CellLayout | null = null;
  private painted: InstancedMesh | null = null;
  private empty: InstancedMesh | null = null;
  private readonly hover: Mesh;
  private readonly plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly paintMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  /** The empty cells: white squares, as Cities: Skylines draws its zoning grid */
  private readonly gridMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  private readonly hoverMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  private showing = false;
  private version = -1;

  constructor(private readonly map: CellMap & { zoneCellsVersion?: number }, private readonly terrain: CityHeightField) {
    this.root.name = 'zone_cells';
    this.root.renderOrder = 9;
    this.hover = new Mesh(this.plane, this.hoverMaterial);
    this.hover.visible = false;
    this.hover.renderOrder = 12;
    this.root.add(this.hover);
    this.refresh();
  }

  /** The empty cells show while a zone brush is in hand */
  show(on: boolean): void {
    this.showing = on;
    if (this.empty) this.empty.visible = on;
    if (!on) this.hover.visible = false;
  }

  /** The roads, the land or the buildings changed: lay the cells again */
  refresh(): void {
    const map = this.map;
    const inside = (x: number, y: number): boolean => !map.insideProvince || map.insideProvince[y * map.width + x] === 1;
    const layout = cellsOf(map, (x, y) => ownsLand(map as unknown as LandMap, x, y) && inside(x, y));
    if (layout === this.layout) return;
    this.layout = layout;
    this.drawGrid();
    this.drawPaint();
  }

  /** Each frame: the paint, if it changed, and the cell under the brush (a point in tiles, or null) */
  update(point: { x: number; y: number } | null, colour: string | null): void {
    if ((this.map.zoneCellsVersion ?? 0) !== this.version) this.drawPaint();
    const cell = point && this.layout && this.showing ? cellAt(this.layout, this.map.width, point.x * 10, point.y * 10) : null;
    this.hover.visible = cell !== null;
    if (cell && this.layout) {
      const size = this.layout.cellUnits;
      this.hover.position.set(cell.x, this.height(cell.x, cell.z) + LIFT + 0.02, cell.z);
      this.hover.rotation.y = cell.angle;
      this.hover.scale.set(size, 1, size);
      if (colour) this.hoverMaterial.color.set(colour);
    }
  }

  dispose(): void {
    for (const mesh of [this.painted, this.empty]) if (mesh) mesh.dispose();
    this.plane.dispose(); this.paintMaterial.dispose(); this.hoverMaterial.dispose(); this.gridMaterial.dispose();
    this.root.clear();
  }

  private height(x: number, z: number): number {
    const tx = Math.max(0, Math.min(this.map.width - 1, Math.floor(x / 10)));
    const tz = Math.max(0, Math.min(this.map.height - 1, Math.floor(z / 10)));
    return this.terrain.sampleTile(tx, tz, x, z);
  }

  /** One mesh of cells, flat on the ground along their roads, each in its colour if coloured */
  private cellMesh(cells: CellLayout['cells'], material: MeshBasicMaterial,
    colourOf: ((key: number) => number) | null): InstancedMesh {
    const layout = this.layout!, mesh = new InstancedMesh(this.plane, material, cells.length);
    const matrix = new Matrix4(), turn = new Quaternion(), place = new Vector3(), up = new Vector3(0, 1, 0);
    const size = new Vector3(layout.cellUnits * FILL, 1, layout.cellUnits * FILL), colour = new Color();
    cells.forEach((cell, n) => {
      place.set(cell.x, this.height(cell.x, cell.z) + LIFT, cell.z);
      turn.setFromAxisAngle(up, cell.angle);
      mesh.setMatrixAt(n, matrix.compose(place, turn, size));
      if (colourOf) mesh.setColorAt(n, colour.setHex(colourOf(cell.key)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Every cell, pale, for the brush: built only when the layout changes */
  private drawGrid(): void {
    if (this.empty) { this.root.remove(this.empty); this.empty.dispose(); this.empty = null; }
    const layout = this.layout;
    if (!layout || !layout.cells.length) return;
    this.empty = this.cellMesh(layout.cells, this.gridMaterial, null);
    this.empty.visible = this.showing;
    this.root.add(this.empty);
  }

  /** The painted cells in their zones' colours, over the grid: built again when the paint changes */
  private drawPaint(): void {
    this.version = this.map.zoneCellsVersion ?? 0;
    if (this.painted) { this.root.remove(this.painted); this.painted.dispose(); this.painted = null; }
    const layout = this.layout, paint = this.map.zoneCells;
    if (!layout || !paint || !paint.size) return;
    const painted = layout.cells.filter((cell) => paint.has(cell.key));
    if (!painted.length) return;
    this.painted = this.cellMesh(painted, this.paintMaterial, (key) => ZONE_COLOURS[paint.get(key) ?? 0] ?? 0xffffff);
    this.painted.renderOrder = 10;
    this.root.add(this.painted);
  }
}
