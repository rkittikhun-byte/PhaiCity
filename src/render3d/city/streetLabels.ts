/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// Street names written along the roads, as in Cities: Skylines (src/streetNames.ts names them): white letters lying
// on the road, turned to read left to right from wherever the camera looks, shown only near the ground. It reads the
// map and never writes it.
import { CanvasTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';
import type { Camera } from 'three';
import type { TileRect } from '../../cityView.js';
import { findStreets, labelSpots, type Street, type StreetMap } from '../../streetNames.js';
import { loadThaiSignFont } from '../materials/signs.js';
import type { CityHeightField } from './heightfield.js';

/** Turns a street into the words to write (the game translates them, src/i18n `street.*`). */
export type StreetText = (street: Street) => string;

/** Names show nearer than this camera distance and fade out over the last part of it */
export const LABEL_DISTANCE = 720;
const FADE_FROM = 520, TEXT_HEIGHT = 3.4, PX = 64, MAX_LABELS = 160, CHECK_MS = 2000, SPACE_TILES = 5;

interface Label { mesh: Mesh; text: string; street: Street; x: number; z: number; angle: number; length: number }
interface Text { texture: CanvasTexture; aspect: number; users: number }

export class StreetLabels {
  readonly root = new Group();
  private streets: Street[] = [];
  private spots: Array<{ key: string; street: Street; x: number; y: number; angle: number; run: number }> = [];
  private labels = new Map<string, Label>();
  private texts = new Map<string, Text>();
  private signature = '';
  private checked = -Infinity;
  private rect = '';
  private font = '"PhaiCity Sign", sans-serif';
  private fontReady = false;
  private right = new Vector3();
  constructor(private map: StreetMap, private text: StreetText, private terrain?: CityHeightField, private now: () => number = () => performance.now()) {
    this.root.name = 'street_labels';
    if (typeof document !== 'undefined') void loadThaiSignFont().then(ready => { this.fontReady = ready; if (ready) this.relabel(); });
  }
  /** The language changed, or the font arrived: write every name again. */
  relabel(): void {
    for (const label of this.labels.values()) this.drop(label);
    this.labels.clear(); this.rect = '';
  }
  update(camera: Camera, distance: number, visible: TileRect | null): void {
    const time = this.now();
    if (time - this.checked >= CHECK_MS) { this.checked = time; this.refresh(); }
    const show = distance < LABEL_DISTANCE && !!visible && this.spots.length > 0;
    this.root.visible = show;
    if (!show || !visible) return;
    const opacity = distance <= FADE_FROM ? 1 : 1 - (distance - FADE_FROM) / (LABEL_DISTANCE - FADE_FROM);
    const rect = `${visible.x0},${visible.y0},${visible.x1},${visible.y1}`;
    if (rect !== this.rect) { this.rect = rect; this.place(visible); }
    camera.updateMatrixWorld(); this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    for (const label of this.labels.values()) {
      // Turn the words to read left to right on screen, and tilt them with the slope of the road
      const flip = Math.cos(label.angle) * this.right.x + Math.sin(label.angle) * this.right.z < 0;
      const angle = flip ? label.angle + Math.PI : label.angle, half = label.length / 2;
      const rise = this.terrain ? this.height(label.x + Math.cos(angle) * half, label.z + Math.sin(angle) * half)
        - this.height(label.x - Math.cos(angle) * half, label.z - Math.sin(angle) * half) : 0;
      label.mesh.rotation.set(0, -angle, Math.atan2(rise, label.length));
      (label.mesh.material as MeshBasicMaterial).opacity = opacity;
    }
  }
  dispose(): void {
    this.relabel();
    for (const text of this.texts.values()) text.texture.dispose();
    this.texts.clear();
  }
  /** Read the streets again when the roads have changed (a cheap look at every tile every two seconds). */
  private refresh(): void {
    const { width, height } = this.map, levels = this.map.roadLevels;
    let hash = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = this.map.getTileValue(x, y);
      if (v >= 64 && v < 208) hash = Math.imul(hash ^ (y * width + x + 1) ^ ((levels?.[y * width + x] ?? 1) << 24), 0x01000193) >>> 0;
    }
    const signature = String(hash);
    if (signature === this.signature) return;
    this.signature = signature;
    this.streets = findStreets(this.map);
    this.spots = this.streets.flatMap(street => labelSpots(street, width).map((spot, i) => ({ key: `${street.id}:${i}`, street, ...spot })));
    this.relabel();
  }
  private place(visible: TileRect): void {
    const margin = 4, inside: typeof this.spots = [];
    // Bigger streets come first (src/streetNames.ts sorts them); a name too near one already written is left off
    for (const s of this.spots) {
      if (inside.length >= MAX_LABELS) break;
      if (s.x < visible.x0 - margin || s.y < visible.y0 - margin || s.x > visible.x1 + 1 + margin || s.y > visible.y1 + 1 + margin) continue;
      if (inside.some(o => Math.hypot(o.x - s.x, o.y - s.y) < SPACE_TILES)) continue;
      inside.push(s);
    }
    const keep = new Set(inside.map(s => s.key));
    for (const [key, label] of this.labels) if (!keep.has(key)) { this.drop(label); this.labels.delete(key); }
    for (const spot of inside) {
      const words = this.text(spot.street), old = this.labels.get(spot.key);
      if (old && old.text === words && old.street === spot.street) continue;
      if (old) this.drop(old);
      const text = this.texture(words), heightM = TEXT_HEIGHT, length = heightM * text.aspect;
      // A name longer than its straight stretch is left off rather than bent over a corner
      if (length > spot.run * 10 + 6) { this.texts.get(words)!.users--; continue; }
      const geometry = new PlaneGeometry(length, heightM).rotateX(-Math.PI / 2);
      const material = new MeshBasicMaterial({ map: text.texture, transparent: true, depthWrite: false, polygonOffset: true,
        polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const mesh = new Mesh(geometry, material), x = spot.x * 10, z = spot.y * 10;
      mesh.rotation.order = 'YZX'; mesh.renderOrder = 5; mesh.name = `street_label_${spot.street.id}`;
      mesh.position.set(x, this.baseAt(spot.x, spot.y) + .6, z);
      this.root.add(mesh);
      this.labels.set(spot.key, { mesh, text: words, street: spot.street, x, z, angle: spot.angle, length });
    }
  }
  private texture(words: string): Text {
    const cached = this.texts.get(words);
    if (cached) { cached.users++; return cached; }
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null, ctx = canvas?.getContext('2d') ?? null;
    let aspect = Math.max(2, words.length * .55);
    if (canvas && ctx) {
      const font = `500 ${PX * .62}px ${this.fontReady ? this.font : 'sans-serif'}`;
      ctx.font = font; const w = Math.ceil(ctx.measureText(words).width + PX * .5);
      canvas.width = w; canvas.height = PX; aspect = w / PX;
      ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = PX * .14; ctx.strokeStyle = 'rgba(28,38,44,.78)';
      ctx.strokeText(words, w / 2, PX * .54); ctx.fillStyle = '#fbfaf3'; ctx.fillText(words, w / 2, PX * .54);
    }
    const texture = new CanvasTexture(canvas ?? undefined as unknown as HTMLCanvasElement);
    texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.generateMipmaps = false;
    const text = { texture, aspect, users: 1 };
    this.texts.set(words, text);
    return text;
  }
  private drop(label: Label): void {
    label.mesh.geometry.dispose(); (label.mesh.material as MeshBasicMaterial).dispose(); label.mesh.removeFromParent();
    const text = this.texts.get(label.text);
    if (text && --text.users <= 0) { text.texture.dispose(); this.texts.delete(label.text); }
  }
  private baseAt(x: number, y: number): number {
    if (!this.terrain) return 0;
    const tx = Math.min(this.map.width - 1, Math.max(0, Math.floor(x))), ty = Math.min(this.map.height - 1, Math.max(0, Math.floor(y)));
    return this.terrain.base(ty * this.map.width + tx);
  }
  /** The road's own height under a world point (a bridge's deck, not the riverbed) */
  private height(x: number, z: number): number { return this.baseAt(x / 10, z / 10); }
}
