/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Rasterizers for the preset map builder. They work on a "fine" grid of square cells
// (several per game tile) holding 0/1, with geometry given as segments in projected meters
// [x1, y1, x2, y2] (see projection.mjs). Coverage per game tile is counted afterwards.

export function createMask(width, height) {
  return { width, height, data: new Uint8Array(width * height) };
}

export function orMask(target, source) {
  for (let i = 0; i < target.data.length; i++) {
    if (source.data[i]) target.data[i] = 1;
  }
}

// Even-odd scanline fill of one area feature (all its rings' segments together, holes included).
// Rows that cross an odd number of edges come from an unclosed ring; they are skipped
// rather than filled, so broken data cannot paint streaks across the map.
export function fillPolygon(mask, cellM, segments) {
  if (segments.length === 0) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y1, , y2] of segments) {
    minY = Math.min(minY, y1, y2);
    maxY = Math.max(maxY, y1, y2);
  }
  const firstRow = Math.max(0, Math.floor(minY / cellM - 0.5));
  const lastRow = Math.min(mask.height - 1, Math.ceil(maxY / cellM - 0.5));
  const crossings = [];

  for (let row = firstRow; row <= lastRow; row++) {
    const y = (row + 0.5) * cellM;
    crossings.length = 0;
    for (const [x1, y1, x2, y2] of segments) {
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        crossings.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    if (crossings.length < 2 || crossings.length % 2 !== 0) continue;
    crossings.sort((a, b) => a - b);
    for (let k = 0; k < crossings.length; k += 2) {
      const firstColumn = Math.max(0, Math.ceil(crossings[k] / cellM - 0.5));
      const lastColumn = Math.min(mask.width - 1, Math.floor(crossings[k + 1] / cellM - 0.5));
      for (let column = firstColumn; column <= lastColumn; column++) {
        mask.data[row * mask.width + column] = 1;
      }
    }
  }
}

// Marks every cell whose center lies within halfWidthM of the segment.
export function strokeSegment(mask, cellM, [x1, y1, x2, y2], halfWidthM) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const firstColumn = Math.max(0, Math.floor((Math.min(x1, x2) - halfWidthM) / cellM));
  const lastColumn = Math.min(mask.width - 1, Math.floor((Math.max(x1, x2) + halfWidthM) / cellM));
  const firstRow = Math.max(0, Math.floor((Math.min(y1, y2) - halfWidthM) / cellM));
  const lastRow = Math.min(mask.height - 1, Math.floor((Math.max(y1, y2) + halfWidthM) / cellM));
  const limit = halfWidthM * halfWidthM;

  for (let row = firstRow; row <= lastRow; row++) {
    const py = (row + 0.5) * cellM;
    for (let column = firstColumn; column <= lastColumn; column++) {
      const px = (column + 0.5) * cellM;
      let t = lengthSquared > 0 ? ((px - x1) * dx + (py - y1) * dy) / lengthSquared : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = px - (x1 + t * dx);
      const ey = py - (y1 + t * dy);
      if (ex * ex + ey * ey <= limit) mask.data[row * mask.width + column] = 1;
    }
  }
}

// Visits every grid cell the segment passes through, adding a connector cell whenever
// the path steps diagonally, so the visited cells are always 4-connected.
export function traceSegmentCells([x1, y1, x2, y2], cellM, width, height, visit) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(length / (cellM / 8)));
  let lastColumn = null;
  let lastRow = null;
  const visitInBounds = (column, row) => {
    if (column >= 0 && column < width && row >= 0 && row < height) visit(column, row);
  };

  for (let step = 0; step <= steps; step++) {
    const x = x1 + (x2 - x1) * step / steps;
    const y = y1 + (y2 - y1) * step / steps;
    const column = Math.floor(x / cellM);
    const row = Math.floor(y / cellM);
    if (column === lastColumn && row === lastRow) continue;
    if (lastColumn !== null && Math.abs(column - lastColumn) + Math.abs(row - lastRow) === 2) {
      visitInBounds(column, lastRow);
    }
    visitInBounds(column, row);
    lastColumn = column;
    lastRow = row;
  }
}

// Builds the sea from OSM coastline segments, which have land on the left and water on the
// right of their direction. The coastline is drawn as a barrier, the remaining cells are split
// into connected regions, and each region becomes sea when more coastline segments have their
// water side in it than their land side. Returns null when there is no coastline nearby.
export function seaFromCoastline(width, height, cellM, coastSegments) {
  if (coastSegments.length === 0) return null;
  const barrier = new Uint8Array(width * height);
  for (const segment of coastSegments) {
    traceSegmentCells(segment, cellM, width, height, (column, row) => {
      barrier[row * width + column] = 1;
    });
  }

  const labels = labelRegions(width, height, (index) => barrier[index] === 0);
  const waterVotes = new Map();
  const landVotes = new Map();
  const vote = (votes, x, y) => {
    const column = Math.floor(x / cellM);
    const row = Math.floor(y / cellM);
    if (column < 0 || column >= width || row < 0 || row >= height) return;
    const label = labels[row * width + column];
    if (label >= 0) votes.set(label, (votes.get(label) || 0) + 1);
  };

  const offset = 2 * cellM;
  for (const [x1, y1, x2, y2] of coastSegments) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length === 0) continue;
    // Right-hand normal in a y-down frame: walking east (1, 0) gives south (0, 1).
    const nx = -(y2 - y1) / length;
    const ny = (x2 - x1) / length;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    vote(waterVotes, mx + nx * offset, my + ny * offset);
    vote(landVotes, mx - nx * offset, my - ny * offset);
  }

  const sea = createMask(width, height);
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    if (label >= 0 && (waterVotes.get(label) || 0) > (landVotes.get(label) || 0)) sea.data[index] = 1;
  }
  // Barrier cells take the majority of their 4 neighbors.
  for (let index = 0; index < barrier.length; index++) {
    if (!barrier[index]) continue;
    const column = index % width;
    const row = Math.floor(index / width);
    let seaNeighbors = 0;
    let neighbors = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = column + dc;
      const r = row + dr;
      if (c < 0 || c >= width || r < 0 || r >= height || barrier[r * width + c]) continue;
      neighbors++;
      seaNeighbors += sea.data[r * width + c];
    }
    if (neighbors > 0 && seaNeighbors * 2 > neighbors) sea.data[index] = 1;
  }
  return sea;
}

// 4-connected component labels for cells where include(index) is true; -1 elsewhere.
export function labelRegions(width, height, include) {
  const labels = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let next = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== -1 || !include(start)) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = next;
    while (head < tail) {
      const index = queue[head++];
      const column = index % width;
      const row = (index - column) / width;
      const neighbors = [
        column > 0 ? index - 1 : -1,
        column < width - 1 ? index + 1 : -1,
        row > 0 ? index - width : -1,
        row < height - 1 ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && labels[neighbor] === -1 && include(neighbor)) {
          labels[neighbor] = next;
          queue[tail++] = neighbor;
        }
      }
    }
    next++;
  }
  return labels;
}

// Fraction of fine cells set in each game tile (fine grid = tiles × factor in both directions).
export function tileCoverage(mask, factor, tilesWide, tilesHigh) {
  const coverage = new Float32Array(tilesWide * tilesHigh);
  const perTile = factor * factor;
  for (let row = 0; row < mask.height; row++) {
    const tileRow = Math.floor(row / factor);
    for (let column = 0; column < mask.width; column++) {
      if (mask.data[row * mask.width + column]) {
        coverage[tileRow * tilesWide + Math.floor(column / factor)] += 1 / perTile;
      }
    }
  }
  return coverage;
}
