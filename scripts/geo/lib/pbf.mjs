/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// A small reader for OpenStreetMap PBF files (https://wiki.openstreetmap.org/wiki/PBF_Format): just enough to read a
// country extract for the geography pipeline (GEO_SPEC section 3) without adding a dependency. It walks the file's
// data blocks and hands out dense nodes, ways and relations; strings and coordinates are only decoded when asked for.

import zlib from 'node:zlib';

const decoder = new TextDecoder();

/** Protocol buffer fields, read straight from bytes. */
class Reader {
  constructor(bytes, start = 0, end = bytes.length) {
    this.bytes = bytes;
    this.pos = start;
    this.end = end;
  }

  get done() {
    return this.pos >= this.end;
  }

  /** An unsigned varint as a Number (exact below 2^53, which OSM ids and coordinates stay under). */
  varint() {
    const bytes = this.bytes;
    let byte = bytes[this.pos++];
    let value = byte & 0x7f;
    let factor = 128;
    while (byte >= 0x80) {
      byte = bytes[this.pos++];
      value += (byte & 0x7f) * factor;
      factor *= 128;
    }
    return value;
  }

  /** A zigzag-encoded signed varint (sint32, sint64). */
  signed() {
    const value = this.varint();
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  }

  /** The start and end of a length-delimited field, moving past it. */
  span() {
    const length = this.varint();
    const start = this.pos;
    this.pos += length;
    return [start, this.pos];
  }

  skip(wire) {
    if (wire === 0) {
      this.varint();
    } else if (wire === 1) {
      this.pos += 8;
    } else if (wire === 2) {
      // Not "this.pos += this.varint()": that reads pos before the varint has moved it
      const length = this.varint();
      this.pos += length;
    } else if (wire === 5) {
      this.pos += 4;
    } else {
      throw new Error(`PBF: unknown wire type ${wire}`);
    }
  }
}

/** The numbers of a packed repeated varint field. */
function packed(bytes, [start, end], signed = false) {
  const reader = new Reader(bytes, start, end);
  const values = [];
  while (!reader.done) values.push(signed ? reader.signed() : reader.varint());
  return values;
}

/** The numbers of a packed, delta-coded sint64 field (ids and coordinates), as a Float64Array. */
function deltas(bytes, [start, end]) {
  const reader = new Reader(bytes, start, end);
  const values = [];
  let value = 0;
  while (!reader.done) {
    value += reader.signed();
    values.push(value);
  }
  return Float64Array.from(values);
}

/** Every data block of a PBF file (a Buffer) as decompressed bytes, one at a time. */
export function* dataBlocks(file) {
  let pos = 0;
  while (pos < file.length) {
    const headerLength = file.readUInt32BE(pos);
    pos += 4;
    let type = '';
    let dataSize = 0;
    const header = new Reader(file, pos, pos + headerLength);
    while (!header.done) {
      const key = header.varint();
      const field = key >>> 3;
      if (field === 1) {
        const [start, end] = header.span();
        type = decoder.decode(file.subarray(start, end));
      } else if (field === 3) {
        dataSize = header.varint();
      } else {
        header.skip(key & 7);
      }
    }
    pos += headerLength;
    const blob = new Reader(file, pos, pos + dataSize);
    pos += dataSize;
    if (type !== 'OSMData') continue;
    let data = null;
    while (!blob.done) {
      const key = blob.varint();
      const field = key >>> 3;
      if (field === 1) {
        const [start, end] = blob.span();
        data = file.subarray(start, end);
      } else if (field === 3) {
        const [start, end] = blob.span();
        data = zlib.inflateSync(file.subarray(start, end));
      } else if (field === 4 || field === 6 || field === 7) {
        throw new Error('PBF: only raw and zlib blocks are supported');
      } else {
        blob.skip(key & 7);
      }
    }
    if (data) yield data;
  }
}

/**
 * Reads one data block, calling only the handlers given:
 * - nodes(ids, lats, lons, tagsOf, hasString): every node of the block, coordinates in degrees; tagsOf(i) gives node
 *   i's tags, and hasString(value) whether any tag of the block uses that string
 * - way(way): { id, tag(key), tags(), refs() } for each way
 * - relation(relation): { id, tag(key), tags(), members() } with members [{ type, id, role }]
 */
export function readBlock(bytes, { nodes = null, way = null, relation = null }) {
  const block = new Reader(bytes);
  let strings = null;
  const groups = [];
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;
  while (!block.done) {
    const key = block.varint();
    const field = key >>> 3;
    if (field === 1) strings = block.span();
    else if (field === 2) groups.push(block.span());
    else if (field === 17) granularity = block.varint();
    else if (field === 19) latOffset = block.varint();
    else if (field === 20) lonOffset = block.varint();
    else block.skip(key & 7);
  }

  // The string table, decoded only as far as needed
  const stringSpans = [];
  if (strings) {
    const table = new Reader(bytes, strings[0], strings[1]);
    while (!table.done) {
      const key = table.varint();
      if (key >>> 3 === 1) stringSpans.push(table.span());
      else table.skip(key & 7);
    }
  }
  const decoded = new Map();
  const str = (index) => {
    let value = decoded.get(index);
    if (value === undefined) {
      const span = stringSpans[index];
      value = span ? decoder.decode(bytes.subarray(span[0], span[1])) : '';
      decoded.set(index, value);
    }
    return value;
  };
  const degrees = (value, offset) => (offset + granularity * value) * 1e-9;

  // Whether the block uses a string at all: a quick test before decoding every node's tags
  const hasString = (value) => {
    for (let i = 0; i < stringSpans.length; i++) if (str(i) === value) return true;
    return false;
  };

  for (const [groupStart, groupEnd] of groups) {
    const group = new Reader(bytes, groupStart, groupEnd);
    while (!group.done) {
      const key = group.varint();
      const field = key >>> 3;
      const span = (key & 7) === 2 ? group.span() : null;
      if (!span) {
        group.skip(key & 7);
      } else if (field === 2 && nodes) {
        readDense(bytes, span, str, degrees, latOffset, lonOffset, nodes, hasString);
      } else if (field === 3 && way) {
        way(readElement(bytes, span, str, 'way'));
      } else if (field === 4 && relation) {
        relation(readElement(bytes, span, str, 'relation'));
      }
    }
  }
}

function readDense(bytes, [start, end], str, degrees, latOffset, lonOffset, handler, hasString) {
  const reader = new Reader(bytes, start, end);
  let ids = null;
  let lats = null;
  let lons = null;
  let keysVals = null;
  while (!reader.done) {
    const key = reader.varint();
    const field = key >>> 3;
    if (field === 1) ids = reader.span();
    else if (field === 8) lats = reader.span();
    else if (field === 9) lons = reader.span();
    else if (field === 10) keysVals = reader.span();
    else reader.skip(key & 7);
  }
  if (!ids) return;
  const idValues = deltas(bytes, ids);
  const latValues = deltas(bytes, lats);
  const lonValues = deltas(bytes, lons);
  for (let i = 0; i < idValues.length; i++) {
    latValues[i] = degrees(latValues[i], latOffset);
    lonValues[i] = degrees(lonValues[i], lonOffset);
  }
  // Tags: key, value, key, value, … 0 after each node; only split up when asked for
  let tagStarts = null;
  const tagsOf = (index) => {
    if (!keysVals) return {};
    if (!tagStarts) {
      const all = packed(bytes, keysVals);
      tagStarts = [];
      let i = 0;
      for (let n = 0; n < idValues.length; n++) {
        const tags = {};
        while (i < all.length && all[i] !== 0) {
          tags[str(all[i])] = str(all[i + 1]);
          i += 2;
        }
        i++;
        tagStarts.push(tags);
      }
    }
    return tagStarts[index] ?? {};
  };
  handler(idValues, latValues, lonValues, tagsOf, hasString);
}

/** A way or relation with its fields found, and decoded only when asked for. */
function readElement(bytes, [start, end], str, kind) {
  const reader = new Reader(bytes, start, end);
  let id = 0;
  let keys = null;
  let vals = null;
  let refs = null;
  let roles = null;
  let memberIds = null;
  let types = null;
  while (!reader.done) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1 && wire === 0) id = reader.varint();
    else if (field === 2) keys = reader.span();
    else if (field === 3) vals = reader.span();
    else if (field === 8 && kind === 'way') refs = reader.span();
    else if (field === 8) roles = reader.span();
    else if (field === 9 && kind === 'relation') memberIds = reader.span();
    else if (field === 10 && kind === 'relation') types = reader.span();
    else reader.skip(wire);
  }
  let keyList = null;
  let valueList = null;
  const lists = () => {
    if (!keyList) {
      keyList = keys ? packed(bytes, keys) : [];
      valueList = vals ? packed(bytes, vals) : [];
    }
  };
  const element = {
    id,
    tag(name) {
      lists();
      for (let i = 0; i < keyList.length; i++) if (str(keyList[i]) === name) return str(valueList[i]);
      return undefined;
    },
    tags() {
      lists();
      const tags = {};
      for (let i = 0; i < keyList.length; i++) tags[str(keyList[i])] = str(valueList[i]);
      return tags;
    },
  };
  if (kind === 'way') {
    element.refs = () => (refs ? deltas(bytes, refs) : new Float64Array(0));
  } else {
    element.members = () => {
      const ids = memberIds ? deltas(bytes, memberIds) : new Float64Array(0);
      const roleIndexes = roles ? packed(bytes, roles) : [];
      const typeCodes = types ? packed(bytes, types) : [];
      return [...ids].map((memberId, i) => ({
        type: ['node', 'way', 'relation'][typeCodes[i]] ?? 'node',
        id: memberId,
        role: str(roleIndexes[i]),
      }));
    };
  }
  return element;
}
