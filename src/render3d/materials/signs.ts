/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { CanvasTexture, Color, ColorRepresentation, DoubleSide, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { getMaterial, signMaterial } from './library.js';

export interface SignOptions {
  layout?: 'horizontal' | 'vertical';
  lit?: boolean;
}

export interface AtlasSign extends SignOptions {
  text: string;
  background?: number;
  foreground?: number;
  size?: readonly [number, number];
}
export interface ThaiSignAtlas {
  material: MeshStandardMaterial;
  rects: readonly (readonly [number, number, number, number])[];
}

/** Different shop names share one batch. A padded cell keeps mipmaps off adjacent signs. */
export function thaiSignAtlas(entries: readonly AtlasSign[]): ThaiSignAtlas {
  if (!entries.length || entries.length > 36) throw new RangeError('A sign atlas needs 1–36 panels');
  entries.forEach(entry => {
    if (entry.size && !entry.size.every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Sign dimensions must be positive finite metres');
  });
  const columns = Math.ceil(Math.sqrt(entries.length)), rows = Math.ceil(entries.length / columns), cell = 512, padding = 8;
  const rects = entries.map((_, i) => {
    const x = i % columns, y = Math.floor(i / columns);
    return [(x + padding / cell) / columns, 1 - (y + 1 - padding / cell) / rows,
      (x + 1 - padding / cell) / columns, 1 - (y + padding / cell) / rows] as const;
  });
  const material = signMaterial(`atlas:${JSON.stringify(entries)}`, mat => {
    mat.color.setHex(0xffffff); mat.side = DoubleSide; mat.userData.keepColorMap = true;
    mat.userData.signAtlas = entries.map(entry => ({ ...entry })); mat.userData.litSign = entries.some(entry => entry.lit);
    if (mat.userData.litSign) mat.emissive.setHex(0xffffff);
    if (typeof document === 'undefined') return;
    try {
      const canvas = document.createElement('canvas'); canvas.width = columns * cell; canvas.height = rows * cell;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; mat.map = texture;
      const glowCanvas = document.createElement('canvas'); glowCanvas.width = canvas.width; glowCanvas.height = canvas.height;
      // Ordinary shop signs need no second GPU texture; only lit atlases need an emission mask.
      const glow = mat.userData.litSign ? glowCanvas.getContext('2d') : null;
      const glowTexture = glow ? new CanvasTexture(glowCanvas) : undefined;
      if (glowTexture) { glowTexture.colorSpace = SRGBColorSpace; mat.emissiveMap = glowTexture; }
      const paint = (font: string): void => {
        ctx.fillStyle = '#e4ddc3'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (glow) { glow.fillStyle = '#000'; glow.fillRect(0, 0, canvas.width, canvas.height); }
        entries.forEach((entry, i) => {
          const x = (i % columns) * cell, y = Math.floor(i / columns) * cell;
          ctx.fillStyle = `#${new Color(entry.background ?? 0xe4ddc3).getHexString()}`; ctx.fillRect(x, y, cell, cell);
          const vertical = entry.layout === 'vertical', size = entry.size ?? (vertical ? [1, 4] : [4, 1]);
          const lines = vertical ? clusters(entry.text.replace(/\s/g, '')) : entry.text.split('\n');
          // Text is pre-compensated for the physical panel's aspect ratio.
          let fontSize = 380 / Math.max(lines.length, 1);
          ctx.font = `700 ${fontSize}px ${font}`;
          const widest = Math.max(1, ...lines.map(line => ctx.measureText(line).width));
          const horizontalScale = size[1] / size[0];
          fontSize *= Math.min(1, 440 / (widest * horizontalScale));
          ctx.save(); ctx.translate(x + cell / 2, y); ctx.scale(horizontalScale, 1);
          ctx.fillStyle = `#${new Color(entry.foreground ?? 0x173f35).getHexString()}`;
          ctx.font = `700 ${fontSize}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          lines.forEach((line, n) => ctx.fillText(line, 0, 60 + 392 * (n + 0.5) / lines.length)); ctx.restore();
          if (entry.lit && glow) glow.drawImage(canvas, x, y, cell, cell, x, y, cell, cell);
        });
        texture.needsUpdate = true; if (glowTexture) glowTexture.needsUpdate = true; mat.needsUpdate = true;
      };
      paint('sans-serif'); void loadThaiSignFont().then(ready => { if (ready) paint('"PhaiCity Sign"'); });
    } catch { /* Canvas unavailable: retain a shared flat fallback. */ }
  });
  return { material, rects };
}

export const FICTIONAL_THAI_SIGNS = Object.freeze([
  'ข้าวมันไก่', 'ก๋วยเตี๋ยวบ้านสวน', 'ข้าวแกงริมคลอง', 'ครัวลมเย็น', 'ร้านน้ำชา',
  'ขนมไทยบ้านอุ่น', 'กาแฟใต้ต้นไม้', 'น้ำผลไม้สด', 'โจ๊กยามเช้า', 'หมูปิ้งหน้าซอย',
  'ซ่อมรถ', 'ซ่อมจักรยาน', 'ปะยาง', 'ซ่อมเครื่องใช้ไฟฟ้า', 'ร้านอะไหล่',
  'ซักรีด', 'ตัดเย็บเสื้อผ้า', 'ร้านตัดผม', 'เสริมสวย', 'ร้านถ่ายเอกสาร',
  'เครื่องเขียน', 'หนังสือมือสอง', 'ของชำ', 'ผักสด', 'ผลไม้ตามฤดู',
  'ร้านดอกไม้', 'ต้นไม้และกระถาง', 'อาหารสัตว์', 'ร้านทอง', 'นาฬิกาและแว่นตา',
  'ห้องว่าง', 'หอพักลมสบาย', 'บ้านพักรายวัน', 'ให้เช่า', 'รับฝากของ',
  'วัสดุก่อสร้าง', 'ร้านผ้า', 'ของใช้ในบ้าน', 'ตลาดชุมชน', 'โรงพยาบาล',
]);

let fonts: Promise<boolean> | undefined;

/** Bundled OFL font; the promise is created only when a sign is first requested. */
export function loadThaiSignFont(): Promise<boolean> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve(false);
  if (fonts) return fonts;
  fonts = Promise.all(['Regular', 'Bold'].map(async (weight) => {
    const face = new FontFace('PhaiCity Sign', `url(assets/fonts/Sarabun-${weight}.ttf)`, { weight: weight === 'Bold' ? '700' : '400' });
    await face.load();
    document.fonts.add(face);
  })).then(() => true).catch(() => false);
  return fonts;
}

function clusters(text: string): string[] {
  const api = Intl as unknown as {
    Segmenter?: new (locale: string, options: { granularity: string }) => { segment: (value: string) => Iterable<{ segment: string }> };
  };
  if (api.Segmenter) return Array.from(new api.Segmenter('th', { granularity: 'grapheme' }).segment(text), item => item.segment);
  return text.match(/[^\p{M}]\p{M}*/gu) ?? [];
}

/** Size is [width, height] in metres; apply to a mesh with those same dimensions. */
export function thaiSign(
  text: string,
  background: ColorRepresentation = 0xe4ddc3,
  foreground: ColorRepresentation = 0x173f35,
  size: readonly [number, number] = [4, 1],
  options: SignOptions = {},
): MeshStandardMaterial {
  if (!size.every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Sign dimensions must be positive finite metres');
  const bg = new Color(background), fg = new Color(foreground);
  const layout = options.layout ?? 'horizontal', lit = options.lit ?? false;
  // Preserve the default flat fallback shared by headless model factories.
  if (typeof document === 'undefined' && bg.getHex() === 0xe4ddc3 && !lit) return getMaterial('sign_thai');
  const token = JSON.stringify([text, bg.getHexString(), fg.getHexString(), size, layout, lit]);
  return signMaterial(token, material => {
    material.color.copy(bg);
    material.userData.sign = { text, size: [...size], layout, lit };
    material.userData.litSign = lit;
    if (lit) material.emissive.copy(bg);
    if (typeof document === 'undefined') return;
    // Keep the flat fallback until the Thai font has actually loaded.
    void loadThaiSignFont().then(ready => {
      if (!ready) return;
      try {
        const canvas = document.createElement('canvas');
        const factor = 1024 / Math.max(...size);
        canvas.width = Math.max(32, Math.round(size[0] * factor));
        canvas.height = Math.max(32, Math.round(size[1] * factor));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = `#${bg.getHexString()}`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const lines = layout === 'vertical'
          ? (text.includes('\n') ? text.split('\n') : clusters(text.replace(/\s/g, '')))
          : text.split('\n');
        const padding = Math.min(canvas.width, canvas.height) * 0.12;
        const usableHeight = canvas.height - padding * 2;
        let fontSize = usableHeight / Math.max(lines.length, 1) * 0.68;
        ctx.font = `700 ${fontSize}px "PhaiCity Sign"`;
        const widest = Math.max(1, ...lines.map(line => ctx.measureText(line).width));
        fontSize *= Math.min(1, (canvas.width - padding * 2) / widest);
        ctx.font = `700 ${fontSize}px "PhaiCity Sign"`;
        ctx.fillStyle = `#${fg.getHexString()}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, padding + usableHeight * (i + 0.5) / lines.length));
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        material.map = texture;
        material.color.setHex(0xffffff);
        material.userData.keepColorMap = true;
        if (lit) {
          material.emissive.setHex(0xffffff);
          material.emissiveMap = texture;
        }
        material.needsUpdate = true;
      } catch { /* Canvas unavailable: keep the flat background. */ }
    });
  });
}

/** One atlas for the government hospital: Thai name (upper half), green H (middle), Thai flag (lower quarter).
 * Sharing the atlas keeps the hospital within eight library-material batches. No phone numbers or protected emblems.
 */
export function hospitalAtlas(): MeshStandardMaterial {
  return signMaterial('hospital-atlas-v1', material => {
    material.color.setHex(0xffffff); material.side = DoubleSide; material.userData.keepColorMap = true;
    material.userData.hospitalAtlas = { text: 'โรงพยาบาล', mark: 'H', markColor: 0x26704d, flagBands: ['red', 'white', 'blue', 'white', 'red'] };
    if (typeof document === 'undefined') return;
    try {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; material.map = texture;
      const paint = (font: string): void => {
        ctx.fillStyle = '#f4f5ed'; ctx.fillRect(0, 0, 1024, 1024);
        ctx.fillStyle = '#26704d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `700 102px ${font}`; ctx.fillText('โรงพยาบาล', 512, 250, 940);
        ctx.font = `700 206px ${font}`; ctx.fillText('H', 512, 638);
        const stripes = ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], weights = [1, 1, 2, 1, 1];
        let y = 768; stripes.forEach((color, i) => { ctx.fillStyle = color; const h = 256 * weights[i] / 6; ctx.fillRect(0, y, 1024, h + 1); y += h; });
        texture.needsUpdate = true; material.needsUpdate = true;
      };
      paint('sans-serif'); void loadThaiSignFont().then(ready => { if (ready) paint('"PhaiCity Sign"'); });
    } catch { /* Canvas unavailable: retain the shared white fallback. */ }
  });
}
