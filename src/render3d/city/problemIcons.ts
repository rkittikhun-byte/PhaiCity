/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Icons over the plots that cannot grow for want of power, water or a road (docs/MUEANG_CS_PLAN.md M1.1, owner 16 Oct
// 2026: "the player always knows why", as Cities: Skylines shows over its buildings). It only reads why each plot is
// held back, as the simulation's last scan found it (gameMap.plotWhy, src/plots.ts PLOT_WHY); the inspector card says
// the rest in words. One small round icon per plot, the same size on screen at any distance, drawn over the city.

import { BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, Points, PointsMaterial, SRGBColorSpace } from 'three';
import { PLOT_WHY } from '../../plots.js';
import type { CityHeightField } from './heightfield.js';

/** The reasons drawn, with the icon's colours */
const SHOWN = [
  { why: 'power', ring: '#d9a21b', glyph: 'bolt' },
  { why: 'water', ring: '#2f86c4', glyph: 'drop' },
  { why: 'road', ring: '#8a8f94', glyph: 'bar' },
] as const;
/** How often the icons follow the scan (seconds), how high over the ground they float (world units), their size (px) */
const REFRESH = 2;
const LIFT = 9;
const SIZE = 22;

interface IconMap { readonly width: number; readonly height: number; plotWhy?: Uint8Array | null }

/** A round icon on a canvas: a coloured ring on white and its glyph */
function iconTexture(ring: string, glyph: 'bolt' | 'drop' | 'bar'): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.beginPath(); c.arc(32, 32, 28, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
  c.lineWidth = 7; c.strokeStyle = ring; c.stroke();
  c.fillStyle = ring; c.beginPath();
  if (glyph === 'bolt') { c.moveTo(36, 12); c.lineTo(20, 36); c.lineTo(31, 36); c.lineTo(27, 52); c.lineTo(44, 27); c.lineTo(33, 27); c.closePath(); }
  else if (glyph === 'drop') { c.moveTo(32, 13); c.bezierCurveTo(44, 30, 46, 36, 46, 40); c.arc(32, 40, 14, 0, Math.PI); c.bezierCurveTo(18, 36, 20, 30, 32, 13); }
  else { c.rect(17, 28, 30, 9); }
  c.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export class ProblemIcons {
  /** The icons, which the view draws over its finished picture, after the diorama lens (index.ts drawOverlay): signs,
   * not lights, so its glow never takes their white for a lamp at night */
  readonly root = new Group();
  /** How many icons stand now */
  shown = 0;
  private readonly points: Points[] = [];
  private last = -Infinity;

  constructor(private readonly map: IconMap, private readonly terrain: CityHeightField) {
    this.root.name = 'problem_icons';
    for (const { ring, glyph } of SHOWN) {
      const material = new PointsMaterial({ size: SIZE, sizeAttenuation: false, map: iconTexture(ring, glyph), transparent: true,
        depthTest: false, depthWrite: false, alphaTest: 0.1 });
      const points = new Points(new BufferGeometry(), material);
      points.renderOrder = 10; points.frustumCulled = false;
      this.points.push(points); this.root.add(points);
    }
  }

  /** Each frame: the icons again when the scan has had time to move on (seconds: the view's clock) */
  update(seconds: number): void {
    if (seconds - this.last < REFRESH) return;
    this.last = seconds;
    const why = this.map.plotWhy, { width } = this.map;
    this.shown = 0;
    SHOWN.forEach(({ why: reason }, n) => {
      const code = PLOT_WHY.indexOf(reason), positions: number[] = [];
      if (why) {
        for (let i = 0; i < why.length; i++) {
          if (why[i] !== code) continue;
          const x = (i % width + 0.5) * 10, z = (Math.floor(i / width) + 0.5) * 10;
          positions.push(x, this.terrain.sample(x, z) + LIFT, z);
        }
      }
      const geometry = this.points[n].geometry;
      this.shown += positions.length / 3;
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
    });
  }

  dispose(): void {
    for (const points of this.points) { points.geometry.dispose(); const m = points.material as PointsMaterial; m.map?.dispose(); m.dispose(); }
    this.root.clear();
  }
}
