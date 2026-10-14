/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A stretch of road as an object (owner, 14 Oct 2026: "ทำเลย เพราะทุกอย่าง คือ object"): the road from one junction or
// end to the next, as the 3D view draws it along one smooth line (src/roadGeometry.ts), with the zone cells that face
// it (src/zoneCells.ts). Clicking any tile of it shows the whole stretch: its name, its level, how long it is, how busy
// and what it costs to keep. It is found from the map's road tiles each time, so it needs nothing saved.

import { networkOf, smoothLine } from "../roadGeometry";
import { CityObject } from "./cityObject";

export interface RoadMap {
  readonly width: number;
  readonly height: number;
  readonly tileSizeM?: number | null;
  readonly roadLevels?: Uint8Array | null;
  getTileValue(x: number, y: number): number;
}

export class RoadSegment extends CityObject {
  readonly kind = "road";
  readonly sector = "central";
  private readonly own: Set<number>;
  /**
   * @param id Its lowest tile's index, which it keeps while the stretch stands as it is
   * @param tiles Its tiles in order along it
   * @param level Its road level (src/roadLevels.ts)
   * @param lengthM How long its line is, in metres
   */
  constructor(id: number, readonly tiles: readonly number[], readonly level: number, readonly lengthM: number,
    private readonly width: number) {
    const middle = tiles[Math.floor(tiles.length / 2)];
    super(id, middle % width, Math.floor(middle / width), 1);
    this.own = new Set(tiles);
  }
  override covers(x: number, y: number): boolean { return this.own.has(y * this.width + x); }
  /** Its tiles as points, for an outline along it */
  get points(): Array<{ x: number; y: number }> {
    return this.tiles.map((i) => ({ x: i % this.width, y: Math.floor(i / this.width) }));
  }
}

/** A stretch's id: its lowest tile */
export const segmentId = (tiles: readonly number[]): number => Math.min(...tiles);

/** Every stretch of road on the map */
export function roadSegments(map: RoadMap): RoadSegment[] {
  const levels = map.roadLevels, metresPerUnit = (map.tileSizeM || 16) / 10;
  const network = networkOf({ width: map.width, height: map.height,
    value: (i) => map.getTileValue(i % map.width, Math.floor(i / map.width)), level: (i) => levels?.[i] ?? 1 }, false);
  return network.stretches.filter((stretch) => stretch.tiles.length > 1).map((stretch) => {
    const line = smoothLine(stretch.points);
    let length = 0;
    for (let i = 1; i < line.length; i++) length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    return new RoadSegment(segmentId(stretch.tiles), stretch.tiles, stretch.level, Math.round(length * metresPerUnit), map.width);
  });
}

/** The stretch of road a tile is on, the longest where several meet at a junction; null off the roads */
export function roadSegmentAt(map: RoadMap, x: number, y: number): RoadSegment | null {
  let best: RoadSegment | null = null;
  for (const segment of roadSegments(map)) {
    if (segment.covers(x, y) && (!best || segment.tiles.length > best.tiles.length)) best = segment;
  }
  return best;
}
