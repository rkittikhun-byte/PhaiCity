/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The zone cells along the roads (src/zoneCells.ts) on a map painted a cell at a time, as Cities: Skylines shows its
// zoning: every painted cell in its zone's colour on the ground, always; the empty cells as a pale grid while a zone
// brush is in hand; the cell under the brush picked out. It reads the map and never writes it.
import { Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { ownsLand, type LandMap } from '../../landBlocks.js';
import { cellAt, cellsOf, plotCells, plotTileOfCell, type CellLayout, type CellMap } from '../../zoneCells.js';
import type { CityHeightField } from './heightfield.js';

/** The zones' colours, as the zone buttons wear them */
const ZONE_COLOURS = [0, 0x4fbf5a, 0x3f86d8, 0xe2b83c];
const LIFT = 0.22, FILL = 0.98;

export class ZoneCellsView {
  readonly root = new Group();
  private layout: CellLayout | null = null;
  private painted: InstancedMesh | null = null;
  private readonly hoverGroup = new Group();
  private readonly lotPad: Mesh;
  private readonly lotBorder: Mesh;
  private readonly plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly paintMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
  // The brush's lot and the dragged area are drawn over everything on the map, as the tools' outlines are
  // (materials/library.ts cityToolMaterial; owner, 18 Oct 2026)
  private readonly hoverMaterial = new MeshBasicMaterial({ color: 0x4fbf5a, transparent: true, opacity: 0.70,
    depthWrite: false, depthTest: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12 });
  private readonly borderMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90,
    depthWrite: false, depthTest: false, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -12 });
  private showing = false;
  private area: InstancedMesh | null = null;
  private areaKey = '';
  private version = -1;

  constructor(private readonly map: CellMap & { zoneCellsVersion?: number }, private readonly terrain: CityHeightField) {
    this.root.name = 'zone_cells';
    this.root.renderOrder = 20;

    // Ground-hugging road-snapped lot preview (no floating mid-air planes that look offset from angled camera views)
    this.hoverGroup.visible = false;
    this.hoverGroup.renderOrder = 25;

    this.lotPad = new Mesh(this.plane, this.hoverMaterial);
    this.lotPad.scale.set(9.6, 1, 9.6);
    this.lotPad.renderOrder = 25;

    this.lotBorder = new Mesh(this.plane, this.borderMaterial);
    this.lotBorder.scale.set(10.0, 1, 10.0);
    this.lotBorder.position.y = -0.005;
    this.lotBorder.renderOrder = 24;

    this.hoverGroup.add(this.lotBorder, this.lotPad);
    this.root.add(this.hoverGroup);
    this.refresh();
  }

  /** Show lot paint and road-snapped lot preview while a zone brush is in hand */
  show(on: boolean): void {
    const changed = this.showing !== on;
    this.showing = on;
    this.paintMaterial.opacity = on ? 0.68 : 0.48;
    if (!on) this.hoverGroup.visible = false;
    if (changed) this.drawPaint();
  }

  /** The roads, the land or the buildings changed: lay the cells again */
  refresh(): void {
    const map = this.map;
    const inside = (x: number, y: number): boolean => !map.insideProvince || map.insideProvince[y * map.width + x] === 1;
    const layout = cellsOf(map, (x, y) => ownsLand(map as unknown as LandMap, x, y) && inside(x, y));
    if (layout !== this.layout) {
      this.layout = layout;
    }
    this.drawPaint();
  }

  /** Each frame: the paint, if it changed, and the road-snapped lot under the brush, or every cell in
   * the rectangle it drags */
  update(point: { x: number; y: number } | null, colour: string | null, area: readonly number[] | null = null): void {
    if ((this.map.zoneCellsVersion ?? 0) !== this.version) this.drawPaint();
    const rawCell = !area && point && this.layout && this.showing
      ? cellAt(this.layout, this.map.width, point.x * 10, point.y * 10)
      : null;
    if (area && this.showing) {
      this.hoverGroup.visible = false;
      this.showArea(area, colour);
      return;
    }
    if (!rawCell || !this.layout) {
      this.hoverGroup.visible = false;
      this.showArea(null, colour);
      return;
    }
    // Highlight the exact road-snapped plot cells on the ground that a click will paint (game.js paintCellStroke)
    const hoverKeys = plotCells(this.layout, this.map.width, rawCell, this.layout.cellUnits * 2.1).map((cell) => cell.key);
    this.hoverGroup.visible = false;
    this.showArea(hoverKeys, colour);
  }

  /** The cells a dragged rectangle or hovered lot will paint, in the brush's colour */
  private showArea(area: readonly number[] | null, colour: string | null): void {
    const key = area ? `${area.length}:${area[0] ?? ''}:${area[area.length - 1] ?? ''}:${colour}` : '';
    if (key === this.areaKey) return;
    this.areaKey = key;
    if (this.area) { this.root.remove(this.area); this.area.dispose(); this.area = null; }
    if (!area || !this.layout) return;
    const layout = this.layout;
    const cells = area.map((k) => layout.byKey.get(k)).filter((i): i is number => i !== undefined).map((i) => layout.cells[i]);
    if (!cells.length) return;
    if (colour) this.hoverMaterial.color.set(colour);
    this.area = this.cellMesh(cells, this.hoverMaterial, null);
    this.area.renderOrder = 25;
    this.area.position.y = 0.05;
    this.root.add(this.area);
  }

  dispose(): void {
    for (const mesh of [this.painted, this.area]) if (mesh) mesh.dispose();
    this.plane.dispose();
    this.paintMaterial.dispose();
    this.hoverMaterial.dispose();
    this.borderMaterial.dispose();
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
      // ... a cell a road cut short only as long as it is (src/zoneCells.ts span)
      size.z = layout.cellUnits * FILL * (cell.span ?? 1);
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

  /** The painted cells in their zones' colours: built again when the paint or built state changes.
   * Cells under already-grown buildings are hidden unless holding a zone tool so buildings stand on clean ground. */
  private drawPaint(): void {
    this.version = this.map.zoneCellsVersion ?? 0;
    if (this.painted) { this.root.remove(this.painted); this.painted.dispose(); this.painted = null; }
    const layout = this.layout, paint = this.map.zoneCells;
    if (!layout || !paint || !paint.size) return;
    const isUnbuiltTile = (tileIdx: number): boolean => {
      if (tileIdx < 0) return true;
      const v = this.map.getTileValue(tileIdx % this.map.width, Math.floor(tileIdx / this.map.width));
      return v === 0 || (v >= 21 && v <= 51) || v === 240 || v === 423 || v === 612;
    };
    const painted = layout.cells.filter((cell) => {
      if (!paint.has(cell.key)) return false;
      if (this.showing) return true;
      return isUnbuiltTile(plotTileOfCell(this.map, cell));
    });
    if (!painted.length) return;
    this.painted = this.cellMesh(painted, this.paintMaterial, (key) => ZONE_COLOURS[paint.get(key) ?? 0] ?? 0xffffff);
    this.painted.renderOrder = 21;
    this.root.add(this.painted);
  }
}
