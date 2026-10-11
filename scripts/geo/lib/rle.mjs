/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run-length encoding for preset map cells (GEO_SPEC section 5): "count:code,count:code,...".

export function encodeRle(cells) {
  const runs = [];
  let current = null;
  let count = 0;
  for (const code of cells) {
    if (code === current) {
      count++;
    } else {
      if (count > 0) runs.push(`${count}:${current}`);
      current = code;
      count = 1;
    }
  }
  if (count > 0) runs.push(`${count}:${current}`);
  return runs.join(',');
}

export function decodeRle(encoded, expectedLength) {
  const cells = [];
  if (encoded.length > 0) {
    for (const run of encoded.split(',')) {
      const [countText, codeText] = run.split(':');
      const count = Number(countText);
      const code = Number(codeText);
      if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(code)) {
        throw new Error(`Bad RLE run "${run}"`);
      }
      for (let i = 0; i < count; i++) cells.push(code);
    }
  }
  if (expectedLength !== undefined && cells.length !== expectedLength) {
    throw new Error(`RLE decoded to ${cells.length} cells, expected ${expectedLength}`);
  }
  return cells;
}
