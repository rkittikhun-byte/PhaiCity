/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
*
* This code is released under the GNU GPL v3, with some additional terms.
* Please see the files LICENSE and COPYING for details. Alternatively,
* consult http://micropolisjs.graememcc.co.uk/LICENSE and
* http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
*
*/

import * as TileFlags from "./tileFlags";
import { DIRT, TILE_COUNT, TILE_INVALID } from "./tileValues";

// I think I want to change this soon. Most of the tile properties, (e.g. whether
// it is a zone, population, conductiveness, pollution emitted) are completely defined
// by the tile value. I think we want a set of prototype objects that are essentially
// immutable, and a TileCreator() function that returns an object with the correct proto
// tile, where mutable state such as animation can live.
//
// This would allow us to cull the getTile/getValue pattern repeated ad nauseum all over the
// code. One could also have the map then track zones, so that populationDensityScan no longer
// needs to perform another full map scan.

type TilePredicateKey = {[K in keyof Tile]: Tile[K] extends () => boolean ? K : never; }[keyof Tile];

export class Tile {

  /**
   * How many times any tile's value or flags have changed (or a tile was made): whatever keeps a copy of the map,
   * such as the 3D view, need not go over every tile again while this stays the same (GameMap changeCount,
   * src/render3d/city/tileModels.ts TileSnapshot.sync). It only counts; the game never reads it.
   */
  static changes = 0;

  private value: number;

  /** PhaiCity: the value and flags together, the tile's own, or for a map's tile the map's cell (MapTile,
   *  docs/NO_GRID_PLAN.md 5.4) */
  protected get raw(): number {
    return this.value;
  }

  protected set raw(next: number) {
    this.value = next;
  }

  constructor(value: number = DIRT, flags: number = 0) {
    // PhaiCity: a map's tile reads and writes the map's own cell: nothing to check, keep or count (MapTile)
    if ((new.target as unknown) === MapTile) {
      this.value = 0;
      return;
    }
    this.validateArguments(value, flags, "Tile constructor");
    this.value = value | flags;
    Tile.changes++;
  }

  getValue(): number {
    return this.valueFromCombinedValue(this.raw);
  }

  getFlags(): number {
    return this.flagsFromCombinedValue(this.raw);
  }

  getRawValue(): number {
    // TODO: Can we remove the caller of this to avoid leaking this implementation detail?
    return this.raw;
  }

  addFlags(flags: number) {
    this.validateFlags(flags, "addFlags");

    if (flags === TileFlags.NOFLAGS) {
      return;
    }

    this.change(this.raw | flags);
  }

  setValue(desiredValue: number) {
    if (desiredValue < TILE_INVALID) {
      throw new Error(`setValue called with out-of-range value ${desiredValue}`);
    }

    // TODO: Fix cases where this can be called with a "combined" value + flags value so we can simplify
    const value = this.valueFromCombinedValue(desiredValue);
    const bitMask = this.flagsToSetFromCombinedValue(desiredValue);
    this.set(value, bitMask);
  }

  setFlags(flags: number) {
    this.validateFlags(flags, "setFlags");

    const existingValue = this.raw & ~TileFlags.ALLBITS;
    this.change(existingValue | flags);
  }

  removeFlags(flags: number) {
    this.validateFlags(flags, "removeFlags");

    if (flags === TileFlags.NOFLAGS) {
      return;
    }

    this.change(this.raw & ~flags);
  }

  setFrom(tile: Tile) {
    this.change(tile.raw);
  }

  /** PhaiCity: the value and flags together, as setFrom takes them from a tile (a map's scan copying a cell into its
   *  scratch tile, GameMap getTile) */
  setRaw(raw: number) {
    this.change(raw);
  }

  set(value: number, flags: number) {
    this.validateArguments(value, flags, "set");

    this.change(value | flags);
  }

  /** Every write goes through here, so Tile.changes counts each real change */
  private change(next: number) {
    if (next === this.raw) {
      return;
    }

    this.raw = next;
    Tile.changes++;
  }

  isAnimated(): boolean {
    return this.checkBits(TileFlags.ANIMBIT);
  }

  isBulldozable(): boolean {
    return this.checkBits(TileFlags.BULLBIT);
  }

  isConductive(): boolean {
    return this.checkBits(TileFlags.CONDBIT);
  }

  isCombustible(): boolean {
    return this.checkBits(TileFlags.BURNBIT);
  }

  isPowered(): boolean {
    return this.checkBits(TileFlags.POWERBIT);
  }

  isZone(): boolean {
    return this.checkBits(TileFlags.ZONEBIT);
  }

  toString(): string {
    const qualities = ["animated", "bulldozable", "combustible", "conductive", "powered", "zone"];
    const qualitiesText = qualities.map((quality) => this.getQualityText(quality)).join(", ");

    const tileValue = this.getValue();
    return `Tile# ${tileValue}: ${qualitiesText}`;
  }

  private getQualityText(quality: string): string {
    const predicate = this.predicateForQuality(quality);
    const qualityValue = this[predicate]();
    return `${quality}: ${this.summariseBoolean(qualityValue)}`;
  }

  private predicateForQuality(quality: string): TilePredicateKey {
    return `is${quality[0].toUpperCase()}${quality.slice(1)}` as TilePredicateKey;
  }

  private summariseBoolean(bool: boolean): string {
    return bool ? `✔` : `✘`;
  }

  private valueFromCombinedValue(value: number): number {
    return value & TileFlags.BIT_MASK;
  }

  private flagsFromCombinedValue(value: number): number {
    return value & TileFlags.ALLBITS;
  }

  private flagsToSetFromCombinedValue(value: number): number {
    const embeddedFlags = this.flagsFromCombinedValue(value);
    return embeddedFlags > 0 ? embeddedFlags : this.getFlags();
  }

  private checkBits(flag: number): boolean {
    return (this.raw & flag) > 0;
  }

  private validateArguments(value: number, flags: number, context: string) {
    this.validateValue(value, context);
    this.validateFlags(flags, context);
  }

  private validateValue(value: number, context: string) {
    if (this.valueIsInvalid(value)) {
      throw new Error(`${context} called with out-of-range value ${value}`);
    }
  }

  private validateFlags(flags: number, context: string) {
    if (this.flagsAreInvalid(flags)) {
      throw new Error(`${context} called with out-of-range flags 0x${flags.toString(16)}`);
    }
  }

  private valueIsInvalid(value: number): boolean {
    return value < TILE_INVALID || value >= TILE_COUNT;
  }

  private flagsAreInvalid(flags: number): boolean {
    return flags !== 0 && (flags < TileFlags.BIT_START || (flags & ~TileFlags.ALLBITS) !== 0);
  }
}

/**
 * PhaiCity: a tile of a map that keeps its tiles as numbers, 16 bits each (GameMap, docs/NO_GRID_PLAN.md 5.4): it
 * reads and writes the map's cell, so while it is kept it is that tile, as the object the map once kept for each tile
 * was. The map makes one only when a tile is asked for, so a map of millions of tiles is a few megabytes.
 */
export class MapTile extends Tile {
  private readonly cells: Uint16Array;
  private readonly index: number;

  constructor(cells: Uint16Array, index: number) {
    super();
    this.cells = cells;
    this.index = index;
  }

  protected get raw(): number {
    return this.cells[this.index];
  }

  protected set raw(next: number) {
    this.cells[this.index] = next;
  }
}
