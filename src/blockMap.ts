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

type TransformationFunction = (n: number) => number;

const ID: TransformationFunction = (n) => n;

/*
 *
 * BlockMaps are data maps where each entry corresponds to data representing a block of tiles in the original
 * game map.
 *
 */

export class BlockMap {

  // tslint:disable-next-line:variable-name
  private _width: number;
  // tslint:disable-next-line:variable-name
  private _height: number;
  private data: number[] = [];

  // Construct a block map. Takes three integers: the game map's width and height, and the block size (i.e. how many
  // tiles in each direction should map to the same block). The BlockMap entries will be initialised to zero.
  constructor(readonly gameMapWidth: number, readonly gameMapHeight: number, readonly blockSize: number) {
    this._width = this.convertToBlockCount(this.gameMapWidth);
    this._height = this.convertToBlockCount(this.gameMapHeight);
    this.clear();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  public get(blockX: number, blockY: number): number {
    const index = this.toIndex(blockX, blockY);
    return this.data[index];
  }

  public set(blockX: number, blockY: number, value: number) {
    const index = this.toIndex(blockX, blockY);
    this.data[index] = value;
  }

  // PhaiCity: the simulation asks these of every tile each month (land value, pollution, crime, the services' cover):
  // the block worked out in place, with no object made for its coordinate and no Math call, the same block as before
  // (docs/NO_GRID_PLAN.md 5.1)
  public worldGet(worldX: number, worldY: number): number {
    return this.data[this._width * this.toBlockIndex(worldY) + this.toBlockIndex(worldX)];
  }

  public worldSet(worldX: number, worldY: number, value: number) {
    this.data[this._width * this.toBlockIndex(worldY) + this.toBlockIndex(worldX)] = value;
  }

  public clear() {
    const data = this.data, width = this._width, height = this._height;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) data[width * y + x] = 0;
    }
  }

  public copyFrom(source: BlockMap, transform: TransformationFunction = ID) {
    if (this.hasIncompatibleDimensions(source)) {
      console.warn("Copying from incompatible blockMap!");
    }

    // (x then y, the order it always went, for a transform that counts what it is given)
    const data = this.data, width = this._width, height = this._height;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) data[width * y + x] = transform(source.get(x, y));
    }
  }

  private convertToBlockCount(value: number) {
    return Math.floor((value + this.blockSize - 1) / this.blockSize);
  }

  private hasIncompatibleDimensions(map: BlockMap): boolean {
    return map.gameMapHeight !== this.gameMapHeight ||
           map.gameMapWidth !== this.gameMapWidth ||
           map.blockSize !== this.blockSize;
  }

  private toBlockIndex(worldIndex: number): number {
    // Math.floor by `| 0`, one less below 0 where it cut a fraction off toward 0
    const q = worldIndex / this.blockSize, i = q | 0;
    return i > q ? i - 1 : i;
  }

  private toIndex(blockX: number, blockY: number) {
    return this._width * blockY + blockX;
  }
}
