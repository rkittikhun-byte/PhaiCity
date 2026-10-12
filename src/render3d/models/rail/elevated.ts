/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Material, PlaneGeometry } from 'three';
import { getMaterial, paintedSteel, roadConcrete } from '../../materials/library.js';
import { point } from '../vegetation/builder.js';
import type { ModelOptions } from '../registry.js';
import { bedOutline, RailBuilder, railForMask, RAIL_MASKS, trackPaths, TrackKind, TrackPath } from './track.js';

export type ElevatedStyle = 'hsr' | 'metro';
export type ElevatedKind = TrackKind | 'ramp';
export const ELEVATED_KINDS = ['straight', 'corner', 't', 'cross', 'end', 'ramp'] as const;
export const ELEVATED_STYLES = ['hsr', 'metro'] as const;
export const ELEVATED_INTERFACE = Object.freeze({ gauge: 1.435, trackCenters: [-1.65, 1.65],
  railWidth: 0.08, headAboveDeck: 0.42, deckWidth: 7.8, sleeperSpacing: 0.6 });
export const ELEVATED_HEIGHTS = Object.freeze({ hsr: 12, metro: 10 });

export function elevatedRailForMask(style: ElevatedStyle, mask: number): ReturnType<typeof railForMask> {
  const base = railForMask(mask); return base ? { ...base, id: base.id.replace('rail.', `rail.${style}_`) } : undefined;
}

export function rampVariant(value = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(2, Math.trunc(value))) : 0;
}

/** Sweep a rectangular section; every rail is measured at its inside head edge. */
function sweep(b: RailBuilder, path: TrackPath, offset: number, width: number,
  bottom: number, top: number, height: (z: number) => number, material: Material, topOnly = false): void {
  const segments = path.name === 'NE' ? 6 : 1, vertices: number[] = [];
  const sections = Array.from({ length: segments + 1 }, (_, i) => {
    const p = path.at(i * path.length / segments);
    return [[offset - width / 2, bottom], [offset + width / 2, bottom],
      [offset + width / 2, top], [offset - width / 2, top]].map(([d, y]) => {
      const z = p.z + p.nz * d; return [p.x + p.nx * d, height(z) + y, z];
    });
  });
  for (let i = 0; i < segments; i++) for (let j = 0; j < 4; j++) {
    if (topOnly && j !== 2) continue;
    const k = (j + 1) % 4, a = sections[i][j], c = sections[i + 1][k],
      d = sections[i][k], e = sections[i + 1][j];
    if (path.name === 'WE') vertices.push(...a, ...e, ...c, ...a, ...c, ...d);
    else vertices.push(...a, ...c, ...e, ...a, ...d, ...c);
  }
  for (const [i, reverse] of [[0, path.name !== 'WE'], [segments, path.name === 'WE']] as const) {
    if (topOnly) continue;
    const s = sections[i];
    for (const [a, c, d] of [[0, 1, 2], [0, 2, 3]]) vertices.push(...s[a], ...s[reverse ? d : c], ...s[reverse ? c : d]);
  }
  const g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals(); b.world(g, material);
}

function guideway(b: RailBuilder, kind: TrackKind, style: ElevatedStyle, height: (z: number) => number): void {
  const outline = bedOutline(kind, ELEVATED_INTERFACE.deckWidth / 2), depth = style === 'hsr' ? 1.2 : 0.55;
  const concrete = roadConcrete(), steel = getMaterial('metal_steel');
  b.polygon(outline, concrete, (_x, z) => height(z));
  const walls: number[] = []; let perimeterDistance = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], c = outline[(i + 1) % outline.length];
    const bottomA = Math.max(0, height(a[1]) - depth), bottomC = Math.max(0, height(c[1]) - depth);
    walls.push(a[0], bottomA, a[1], c[0], height(c[1]), c[1], a[0], height(a[1]), a[1],
      a[0], bottomA, a[1], c[0], bottomC, c[1], c[0], height(c[1]), c[1]);
    // Connected tile edges stay open, including maintenance walkways and barriers.
    if ((Math.abs(a[0]) === 5 && a[0] === c[0]) || (Math.abs(a[1]) === 5 && a[1] === c[1])) continue;
    const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const path: TrackPath = { name: 'edge', length, at: s => ({ x: a[0] + (c[0] - a[0]) * s / length,
      z: a[1] + (c[1] - a[1]) * s / length, nx: (c[1] - a[1]) / length, nz: -(c[0] - a[0]) / length }) };
    if (style === 'hsr') {
      // Two-sided sheet panels share corner vertices, avoiding dozens of hidden box caps.
      for (const [bottom, top, material] of [[0, 0.65, concrete], [0.65, 1.9, paintedSteel(0x9aaca3)],
        [1.9, 1.98, steel]] as const) {
        const p = [point(a[0], height(a[1]) + bottom, a[1]), point(c[0], height(c[1]) + bottom, c[1]),
          point(c[0], height(c[1]) + top, c[1]), point(a[0], height(a[1]) + top, a[1])];
        const vertices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2].flatMap(i => p[i].toArray());
        const panel = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
        panel.computeVertexNormals(); b.world(panel, material);
      }
    } else {
      // Follow the union perimeter; route-wise strips would cross live rails at a T/cross.
      sweep(b, path, 0.4, 0.6, 0.03, 0.12, height, concrete, true);
      for (const y of [0.53, 1.04]) {
        const p = [point(a[0], height(a[1]) + y - 0.03, a[1]), point(c[0], height(c[1]) + y - 0.03, c[1]),
          point(c[0], height(c[1]) + y + 0.03, c[1]), point(a[0], height(a[1]) + y + 0.03, a[1])];
        const vertices = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2].flatMap(i => p[i].toArray());
        const g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(vertices, 3));
        g.computeVertexNormals(); b.world(g, steel);
      }
      for (let s = (2 - perimeterDistance % 2) % 2; s < length; s += 2) {
        const p = path.at(s); b.box(point(p.x, height(p.z) + 0.54, p.z), point(0.06, 1.07, 0.06), steel);
      }
      perimeterDistance += length;
    }
  }
  const g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(walls, 3));
  g.computeVertexNormals(); b.world(g, concrete);
  // Box-girder underside; winding is reversed after planar triangulation.
  const start = b.parts.length;
  b.polygon(outline, concrete, (_x, z) => Math.max(0, height(z) - depth));
  const bottom = b.parts[start].geometry, p = bottom.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    const a = point(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, a.x, a.y, a.z);
  }
  bottom.computeVertexNormals();
  const pierTop = Math.max(0, height(0) - depth);
  b.box(point(0, 0.2, 0), point(2.5, 0.4, 2.5), concrete);
  if (style === 'hsr') {
    b.cylinder(point(0, (pierTop + 0.4) / 2, 0), 0.7, Math.max(0.01, pierTop - 0.4), concrete, 12);
    b.box(point(0, pierTop - 0.25, 0), point(4.2, 0.5, 1.6), concrete);
  } else {
    b.box(point(0, (pierTop + 0.4) / 2, 0), point(0.95, Math.max(0.01, pierTop - 0.4), 1.2), concrete);
    b.box(point(0, pierTop - 0.3, 0), point(6.4, 0.6, 1.3), concrete);
  }
}

function dualTracks(b: RailBuilder, kind: TrackKind, style: ElevatedStyle, height: (z: number) => number): void {
  const steel = getMaterial('metal_steel'), concrete = roadConcrete();
  const sleeper = new BoxGeometry(2.15, 0.12, 0.22);
  try {
    for (const path of trackPaths(kind)) {
      for (const center of ELEVATED_INTERFACE.trackCenters) {
        for (const side of [-1, 1]) {
          const offset = center + side * (ELEVATED_INTERFACE.gauge + ELEVATED_INTERFACE.railWidth) / 2;
          sweep(b, path, offset, 0.08, 0.32, 0.42, height, steel);
        }
        if (style === 'metro')
          sweep(b, path, center + Math.sign(center) * 1.08, 0.12, 0.18, 0.27, height, paintedSteel(0xe4d3ac));
        const start = b.options.sleeperOffset ?? (b.options.worldOrigin?.[path.name === 'WE' ? 0 : 1] ?? 0) - 5;
        const phase = ((-start % 0.6) + 0.6) % 0.6;
        for (let s = phase - 0.6; s <= path.length + 0.11; s += 0.6) {
          if (s < -0.11) continue;
          const p = path.at(s), x = p.x + center * p.nx, z = p.z + center * p.nz;
          // The junction apron uses slab track, avoiding intersecting duplicate sleepers.
          if ((kind === 't' && path.name === 'NE' && p.x < 3.1) ||
            (kind === 'cross' && path.name === 'WE' && Math.abs(p.x) < 3.1)) continue;
          const source = sleeper.clone().rotateY(-Math.atan2(p.nz, p.nx)).translate(x, 0.22, z);
          const positions = source.getAttribute('position');
          for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) + height(positions.getZ(i)));
          source.computeVertexNormals(); b.world(source, concrete);
          b.sleepers.push({ x, z, station: start + s, width: 2.15, path: `${path.name}/${center}` });
        }
      }
    }
  } finally { sleeper.dispose(); }
}

export function createElevatedRail(style: ElevatedStyle, piece: ElevatedKind, options: ModelOptions = {}): Group {
  const b = new RailBuilder(options), kind = piece === 'ramp' ? 'straight' : piece;
  const variant = rampVariant(options.variant), level = ELEVATED_HEIGHTS[style];
  const height = (z: number): number => piece === 'ramp' ? level * (variant + (z + 5) / 10) / 3 : level;
  b.world(new PlaneGeometry(10, 10).rotateX(-Math.PI / 2), getMaterial('dirt_laterite'));
  guideway(b, kind, style, height); dualTracks(b, kind, style, height);
  if (style === 'hsr') {
    const steel = getMaterial('metal_steel'), primary = trackPaths(kind)[0], p = primary.at(primary.length / 2);
    const mastX = p.x - 3.25 * p.nx, mastZ = p.z - 3.25 * p.nz;
    b.box(point(mastX, height(mastZ) + 3.1, mastZ), point(0.16, 6.2, 0.16), steel);
    const arm = new BoxGeometry(6.7, 0.12, 0.12).rotateY(-Math.atan2(p.nz, p.nx)).translate(p.x, 6.1, p.z);
    const armPositions = arm.getAttribute('position');
    for (let i = 0; i < armPositions.count; i++) armPositions.setY(i, armPositions.getY(i) + height(armPositions.getZ(i)));
    arm.computeVertexNormals(); b.world(arm, steel);
    for (const path of trackPaths(kind)) for (const center of ELEVATED_INTERFACE.trackCenters) {
      sweep(b, path, center, 0.04, 6, 6.04, height, steel);
      const p = path.at(path.length / 2);
      b.box(point(p.x + center * p.nx, height(p.z + center * p.nz) + 6.07, p.z + center * p.nz), point(0.08, 0.18, 0.08), steel);
    }
  }
  if (kind === 'end') for (const center of ELEVATED_INTERFACE.trackCenters) {
    b.box(point(center, level + 0.8, 1.2), point(1.9, 0.25, 0.2), paintedSteel(0x9aaca3));
    b.box(point(center, level + 0.45, 1.2), point(0.3, 0.65, 0.4), getMaterial('metal_steel'));
  }
  const root = b.finishRail(`rail.${style}_${piece}`, [], RAIL_MASKS[kind]);
  root.userData.rail = { ...ELEVATED_INTERFACE, style, deckY: height(0), destinationDeckY: level,
    headY: height(0) + 0.42, catenaryAboveDeck: style === 'hsr' ? 6 : undefined,
    ...(piece === 'ramp' ? { ramp: variant, deckStart: height(-5), deckEnd: height(5),
      headStart: height(-5) + 0.42, headEnd: height(5) + 0.42, slope: level / 30 } : {}) };
  return root;
}
