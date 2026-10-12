/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A small reader for the elevation GeoTIFFs the pipeline uses (Copernicus DEM, GEO_SPEC section 3), without adding a
// dependency: one band of 32-bit floats or 16-bit integers, in strips or tiles, uncompressed or deflated, with the
// horizontal or floating-point predictor, and a plain lat/lon georeference (pixel scale and tie point).

import zlib from 'node:zlib';

const TAG = {
  width: 256, height: 257, bitsPerSample: 258, compression: 259, rowsPerStrip: 278, stripOffsets: 273,
  stripByteCounts: 279, predictor: 317, tileWidth: 322, tileHeight: 323, tileOffsets: 324, tileByteCounts: 325,
  sampleFormat: 339, pixelScale: 33550, tiePoint: 33922, noData: 42113,
};
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };

/**
 * Reads a GeoTIFF (a Buffer) into { width, height, data: Float32Array, west, north, dx, dy, noData }, where pixel
 * (x, y) covers lon west + x·dx … and lat north − y·dy ….
 */
export function readGeoTiff(file) {
  const little = file.toString('latin1', 0, 2) === 'II';
  const u16 = (at) => (little ? file.readUInt16LE(at) : file.readUInt16BE(at));
  const u32 = (at) => (little ? file.readUInt32LE(at) : file.readUInt32BE(at));
  const f64 = (at) => (little ? file.readDoubleLE(at) : file.readDoubleBE(at));
  if (u16(2) !== 42) throw new Error('GeoTIFF: only classic TIFF files are read');

  // The first image's fields; the overviews of a cloud-optimised file come after it
  const ifd = u32(4);
  const fields = new Map();
  for (let i = 0, count = u16(ifd); i < count; i++) {
    const entry = ifd + 2 + i * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const n = u32(entry + 4);
    const size = (TYPE_SIZE[type] ?? 1) * n;
    const at = size <= 4 ? entry + 8 : u32(entry + 8);
    const values = [];
    for (let k = 0; k < n; k++) {
      if (type === 3) values.push(u16(at + 2 * k));
      else if (type === 4) values.push(u32(at + 4 * k));
      else if (type === 12) values.push(f64(at + 8 * k));
      else if (type === 2) { values.push(file.toString('latin1', at, at + n).replace(/\0+$/, '')); break; }
      else values.push(file[at + k]);
    }
    fields.set(tag, values);
  }
  const one = (tag, fallback) => fields.get(tag)?.[0] ?? fallback;

  const width = one(TAG.width);
  const height = one(TAG.height);
  const bits = one(TAG.bitsPerSample, 8);
  const format = one(TAG.sampleFormat, 1); // 1 unsigned, 2 signed, 3 float
  const compression = one(TAG.compression, 1);
  const predictor = one(TAG.predictor, 1);
  if (![1, 8, 32946].includes(compression)) throw new Error(`GeoTIFF: compression ${compression} is not read`);
  if (!(format === 3 && bits === 32) && !(bits === 16)) throw new Error(`GeoTIFF: ${bits}-bit samples (format ${format}) are not read`);

  const tiled = fields.has(TAG.tileOffsets);
  const blockWidth = tiled ? one(TAG.tileWidth) : width;
  const blockHeight = tiled ? one(TAG.tileHeight) : one(TAG.rowsPerStrip, height);
  const offsets = fields.get(tiled ? TAG.tileOffsets : TAG.stripOffsets);
  const counts = fields.get(tiled ? TAG.tileByteCounts : TAG.stripByteCounts);
  const across = Math.ceil(width / blockWidth);
  const bytesPerSample = bits / 8;

  const data = new Float32Array(width * height);
  for (let block = 0; block < offsets.length; block++) {
    let bytes = file.subarray(offsets[block], offsets[block] + counts[block]);
    if (compression !== 1) bytes = zlib.inflateSync(bytes);
    const rows = Math.min(blockHeight, height - Math.floor(block / across) * blockHeight);
    const samples = undoPredictor(bytes, predictor, blockWidth, blockHeight, bytesPerSample, little);
    const x0 = (block % across) * blockWidth;
    const y0 = Math.floor(block / across) * blockHeight;
    const view = new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < blockWidth && x0 + x < width; x++) {
        const at = (y * blockWidth + x) * bytesPerSample;
        let value;
        if (predictor === 3) value = view.getFloat32(at, false); // floating-point predictor: bytes rebuilt big-endian
        else if (bits === 32) value = view.getFloat32(at, little);
        else value = format === 2 ? view.getInt16(at, little) : view.getUint16(at, little);
        data[(y0 + y) * width + x0 + x] = value;
      }
    }
  }

  const [dx, dy] = fields.get(TAG.pixelScale) ?? [1, 1];
  const tie = fields.get(TAG.tiePoint) ?? [0, 0, 0, 0, 0, 0];
  const noDataText = fields.get(TAG.noData)?.[0];
  return {
    width,
    height,
    data,
    west: tie[3] - tie[0] * dx,
    north: tie[4] + tie[1] * dy,
    dx,
    dy,
    noData: noDataText === undefined ? null : Number(noDataText),
  };
}

/** Undoes the TIFF predictor of one block: 2 adds each sample to the one before it, 3 also un-shuffles float bytes. */
function undoPredictor(bytes, predictor, blockWidth, blockHeight, bytesPerSample, little) {
  if (predictor === 1) return bytes;
  const out = Buffer.from(bytes);
  if (predictor === 2) {
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    for (let y = 0; y < blockHeight; y++) {
      for (let x = 1; x < blockWidth; x++) {
        const at = (y * blockWidth + x) * bytesPerSample;
        if (bytesPerSample === 2) view.setUint16(at, (view.getUint16(at, little) + view.getUint16(at - 2, little)) & 0xffff, little);
        else view.setUint32(at, (view.getUint32(at, little) + view.getUint32(at - 4, little)) >>> 0, little);
      }
    }
    return out;
  }
  // Floating point: each row's bytes are differenced, then grouped by byte position (most significant first)
  const rowBytes = blockWidth * bytesPerSample;
  const row = Buffer.alloc(rowBytes);
  for (let y = 0; y < blockHeight; y++) {
    const start = y * rowBytes;
    for (let i = 1; i < rowBytes; i++) out[start + i] = (out[start + i] + out[start + i - 1]) & 0xff;
    for (let x = 0; x < blockWidth; x++) {
      for (let b = 0; b < bytesPerSample; b++) row[x * bytesPerSample + b] = out[start + b * blockWidth + x];
    }
    row.copy(out, start);
  }
  return out;
}

/** The elevation at a point, from the nearest pixel; null outside the image or on a no-data pixel. */
export function heightAt(image, lat, lon) {
  const x = Math.floor((lon - image.west) / image.dx);
  const y = Math.floor((image.north - lat) / image.dy);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const value = image.data[y * image.width + x];
  return image.noData !== null && value === image.noData ? null : value;
}
