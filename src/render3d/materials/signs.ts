/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { CanvasTexture, Color, ColorRepresentation, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { getMaterial, signMaterial } from './library.js';

export interface SignOptions {
  layout?: 'horizontal' | 'vertical';
  lit?: boolean;
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
