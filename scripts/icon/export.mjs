// PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
// Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

// The icon's sizes from its Blender renders (art/icon/build_icon.py), with nothing but Node:
//
//   node scripts/icon/export.mjs [--large art/icon/icon_1024.png] [--small art/icon/icon_small_1024.png]
//
// writes favicon.ico (16, 32 and 48), assets/icons/app/icon-32.png, -180.png (apple-touch-icon), -192.png and -512.png,
// and manifest.webmanifest, whose colours come from the theme (src/theme/tokens.ts). The large render gives 180 px and
// up; the small one, drawn with a thicker ink line so it survives, gives 48 px and down. Each size is an area average
// of the render in linear light, then a light sharpening for the small sizes.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// PNG -------------------------------------------------------------------------------------------------------------------

/** An 8-bit RGB or RGBA, non-interlaced PNG as {width, height, data: RGBA bytes}. */
export function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`);
  let pos = 8, width = 0, height = 0, type = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('latin1', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || (type !== 6 && type !== 2) || body[12] !== 0) throw new Error(`${file}: only 8-bit RGB(A), not interlaced`);
    } else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[y * stride + i - bpp] : 0, b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= bpp && y > 0 ? px[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 255;
    }
  }
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let k = 0; k < 3; k++) data[i * 4 + k] = px[i * bpp + k];
    data[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255;
  }
  return { width, height, data };
}

function chunk(kind, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(kind, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
}

/** An RGBA image as PNG bytes. */
export function pngBytes({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** PNG images (each at most 256 px) in one .ico, the way every browser and Windows read them. */
export function icoBytes(images) {
  const pngs = images.map(pngBytes), head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((img, i) => {
    const at = 6 + 16 * i;
    head[at] = img.width & 255;
    head[at + 1] = img.height & 255;
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(pngs[i].length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += pngs[i].length;
  });
  return Buffer.concat([head, ...pngs]);
}

// resampling ------------------------------------------------------------------------------------------------------------

const toLinear = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** One axis of an area average: each output sample is the mean of the input span it covers. */
function boxAxis(src, n, m, lines, get, set) {
  const scale = n / m;
  for (let line = 0; line < lines; line++) {
    for (let o = 0; o < m; o++) {
      const a = o * scale, b = a + scale, sum = [0, 0, 0, 0];
      for (let i = Math.floor(a); i < Math.ceil(b); i++) {
        const w = Math.min(b, i + 1) - Math.max(a, i);
        const v = get(src, line, i);
        for (let k = 0; k < 4; k++) sum[k] += v[k] * w;
      }
      set(line, o, sum.map(s => s / scale));
    }
  }
}

/** The image at size x size: premultiplied linear light, averaged, then (sharpen > 0) a small unsharp mask. */
export function resize(img, size, sharpen = 0) {
  const { width: w, height: h, data } = img;
  const lin = new Float64Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    for (let k = 0; k < 3; k++) lin[i * 4 + k] = toLinear(data[i * 4 + k] / 255) * a;
    lin[i * 4 + 3] = a;
  }
  const mid = new Float64Array(size * h * 4), out = new Float64Array(size * size * 4);
  boxAxis(lin, w, size, h, (s, y, x) => s.subarray((y * w + x) * 4, (y * w + x) * 4 + 4),
    (y, x, v) => mid.set(v, (y * size + x) * 4));
  boxAxis(mid, h, size, size, (s, x, y) => s.subarray((y * size + x) * 4, (y * size + x) * 4 + 4),
    (x, y, v) => out.set(v, (y * size + x) * 4));
  let px = out;
  if (sharpen > 0) {
    px = new Float64Array(out.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      for (let k = 0; k < 4; k++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
          sum += out[(yy * size + xx) * 4 + k];
          n++;
        }
        const v = out[(y * size + x) * 4 + k];
        px[(y * size + x) * 4 + k] = v + sharpen * (v - sum / n);
      }
    }
  }
  const bytes = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = Math.min(1, Math.max(0, px[i * 4 + 3]));
    for (let k = 0; k < 3; k++) {
      const c = a > 0 ? Math.min(1, Math.max(0, px[i * 4 + k] / a)) : 0;
      bytes[i * 4 + k] = Math.round(toSrgb(c) * 255);
    }
    bytes[i * 4 + 3] = Math.round(a * 255);
  }
  return { width: size, height: size, data: bytes };
}

/** The image centred on an opaque square of colour (0xRRGGBB) size px wide. */
export function onColour(img, size, colour) {
  const data = Buffer.alloc(size * size * 4), bg = [colour >> 16 & 255, colour >> 8 & 255, colour & 255];
  const off = (size - img.width) >> 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = (y * size + x) * 4, sx = x - off, sy = y - off;
    const inside = sx >= 0 && sy >= 0 && sx < img.width && sy < img.height, s = (sy * img.width + sx) * 4;
    const a = inside ? img.data[s + 3] / 255 : 0;
    for (let k = 0; k < 3; k++) {
      const c = toLinear((inside ? img.data[s + k] : 0) / 255) * a + toLinear(bg[k] / 255) * (1 - a);
      data[d + k] = Math.round(toSrgb(c) * 255);
    }
    data[d + 3] = 255;
  }
  return { width: size, height: size, data };
}

// the icon's files ------------------------------------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2), opt = name => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const large = readPng(path.resolve(ROOT, opt('large') ?? 'art/icon/icon_1024.png'));
  const small = readPng(path.resolve(ROOT, opt('small') ?? 'art/icon/icon_small_1024.png'));
  const dir = path.join(ROOT, 'assets/icons/app');
  fs.mkdirSync(dir, { recursive: true });
  const SHARPEN = { 16: 0.5, 32: 0.35, 48: 0.25 };
  const smallSize = size => resize(small, size, SHARPEN[size] ?? 0);
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), icoBytes([16, 32, 48].map(smallSize)));
  fs.writeFileSync(path.join(dir, 'icon-32.png'), pngBytes(smallSize(32)));
  for (const size of [192, 512]) fs.writeFileSync(path.join(dir, `icon-${size}.png`), pngBytes(resize(large, size)));
  // the pages' paper (sand.100) behind the icon while the game loads and under the apple-touch-icon, which iOS would
  // fill with black; the accent (clay.500) for the browser's bar
  const { RAMPS } = await import('../../src/theme/tokens.ts');
  fs.writeFileSync(path.join(dir, 'icon-180.png'), pngBytes(onColour(resize(large, 160), 180, RAMPS.sand[100])));
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const background = hex(RAMPS.sand[100]), theme = hex(RAMPS.clay[500]);
  const manifest = {
    name: 'PhaiCity', short_name: 'PhaiCity', start_url: './', display: 'fullscreen',
    background_color: background, theme_color: theme,
    icons: [192, 512].map(size => ({ src: `assets/icons/app/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png' })),
  };
  fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('favicon.ico, assets/icons/app/icon-{32,180,192,512}.png, manifest.webmanifest');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
