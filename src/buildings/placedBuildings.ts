/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's buildings where they were put down, in metres (docs/METRE_DRAWING_PLAN.md 4.2, step 2.1): each one's
// middle, its turn and its size, as the player saw it before the click, kept beside the tiles the simulation reads. Its
// tiles are worked out from it, the square block of its size round the tile its middle lies on (blockOf), never moved
// to another place; the 3D view stands its model there, read from here (step 2.4, tileModels.ts againstRoad). Homes,
// shops and factories grow on their zones and are not here. Plain code, no DOM: metres from the map's corner, x east, z south.

/** A building put down by the player */
export interface PlacedBuilding {
  readonly id: number;
  /** The tool that put it down (src/gameTools.js) */
  readonly tool: string;
  /** Its middle (metres) and its turn (radians, as the view turns a model: its front faces (-sin, -cos)) */
  readonly x: number;
  readonly z: number;
  readonly rot: number;
  /** Tiles a side of its block, and the index of the block's centre tile (one in from its top left, the tile itself
   * for a one-tile building) */
  readonly size: number;
  readonly tile: number;
}

/** The block of tiles a building of size tiles whose middle is (x, z) metres takes: its top left and its centre tile
 * (one in from the top left), on tiles tileSizeM metres across */
export function blockOf(x: number, z: number, size: number, tileSizeM: number): { left: number; top: number; cx: number; cy: number } {
  const left = Math.round(x / tileSizeM - size / 2), top = Math.round(z / tileSizeM - size / 2), offset = size > 1 ? 1 : 0;
  return { left, top, cx: left + offset, cy: top + offset };
}

const round = (v: number, places: number): number => Math.round(v * 10 ** places) / 10 ** places;

/** The buildings the player put down, by id, ids counting up */
export class PlacedBuildings {
  private readonly items = new Map<number, PlacedBuilding>();
  /** The same by centre tile, as the 3D view looks them up for every tile it draws */
  private readonly byTile = new Map<number, PlacedBuilding>();
  private next = 1;

  /** Puts a building down, in place of any whose centre tile was the same; its id */
  add(building: Omit<PlacedBuilding, "id">): PlacedBuilding {
    const old = this.byTile.get(building.tile);
    if (old) this.items.delete(old.id);
    const placed: PlacedBuilding = { ...building, id: this.next++, x: round(building.x, 2), z: round(building.z, 2),
      rot: round(building.rot, 4) };
    this.items.set(placed.id, placed);
    this.byTile.set(placed.tile, placed);
    return placed;
  }

  remove(id: number): void {
    const b = this.items.get(id);
    if (!b) return;
    this.items.delete(id);
    if (this.byTile.get(b.tile) === b) this.byTile.delete(b.tile);
  }

  /** The building whose centre tile is this one, if any */
  atTile(tile: number): PlacedBuilding | undefined {
    return this.byTile.get(tile);
  }

  all(): PlacedBuilding[] {
    return [...this.items.values()].sort((a, b) => a.id - b.id);
  }

  get size(): number {
    return this.items.size;
  }

  /** As a save keeps them: [id, tool, x, z, rot, size, tile] each, and the next id; only those keep() keeps */
  toJSON(keep: (b: PlacedBuilding) => boolean = () => true): { buildings: Array<[number, string, number, number, number, number, number]>; next: number } {
    return { buildings: this.all().filter(keep).map((b) => [b.id, b.tool, b.x, b.z, b.rot, b.size, b.tile]), next: this.next };
  }

  /** From toJSON's data; what does not read as such is left out */
  static fromJSON(data: unknown): PlacedBuildings {
    const out = new PlacedBuildings();
    const saved = data as { buildings?: unknown; next?: unknown } | null;
    if (!saved || !Array.isArray(saved.buildings)) return out;
    for (const row of saved.buildings) {
      if (!Array.isArray(row) || row.length < 7) continue;
      const [id, tool, x, z, rot, size, tile] = row;
      if (![id, x, z, rot, size, tile].every((n) => typeof n === "number" && Number.isFinite(n)) || typeof tool !== "string") continue;
      const b = { id, tool, x, z, rot, size, tile };
      out.items.set(id, b);
      out.byTile.set(tile, b);
      out.next = Math.max(out.next, id + 1);
    }
    if (typeof saved.next === "number" && saved.next > out.next) out.next = saved.next;
    return out;
  }
}
