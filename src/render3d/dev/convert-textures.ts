/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

/** Dev-only: node src/render3d/dev/convert-textures.ts --input RAW --output NEW.
 * RAW contains one directory per credited source, with color.jpg, normal.jpg,
 * roughness.jpg and optional ao.jpg, metalness.jpg, alpha.jpg. PNG inputs work too.
 * Keep provider downloads outside assets/; always convert originals, never outputs.
 * NEW must not exist. Inspect its size and gallery results before installing it.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const option = (name: string): string => {
    const index = args.indexOf(name);
    if (index < 0 || !args[index + 1]) throw new Error(`Missing ${name}`);
    return resolve(args[index + 1]);
  };
  const input = option('--input'), output = option('--output');
  const contains = (parent: string, child: string): boolean => {
    const path = relative(parent, child);
    return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
  };
  if (contains(input, output) || contains(output, input)) throw new Error('Input and output must be separate directories');
  const sources = (await readdir(input, { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
  if (!sources.length) throw new Error('No source directories');
  // Non-recursive creation deliberately refuses to overwrite an existing output.
  await mkdir(output);
  const hashes = new Map<string, string>();
  let total = 0, count = 0;
  async function save(path: string, bytes: Buffer): Promise<void> {
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hashes.has(hash)) throw new Error(`Duplicate output: ${path} and ${hashes.get(hash)}`);
    hashes.set(hash, path);
    await writeFile(path, bytes);
    total += bytes.length; count++;
  }
  for (const source of sources) {
    const raw = join(input, source.name), target = join(output, source.name);
    const files = await readdir(raw);
    const find = (channel: string): string | undefined => {
      const file = files.find(name => name === `${channel}.jpg` || name === `${channel}.png`);
      return file ? join(raw, file) : undefined;
    };
    const normal = find('normal'), roughness = find('roughness');
    if (!normal || !roughness) throw new Error(`${source.name}: normal and roughness are required`);
    const metadata = await sharp(normal).metadata();
    const width = metadata.width!, height = metadata.height!;
    if (Math.max(width, height) < 1024 || Math.max(width, height) > 1025) throw new Error(`${source.name}: expected 1K inputs`);
    await mkdir(target);
    const color = find('color');
    if (color) await save(join(target, 'color.jpg'), await sharp(color).jpeg({ quality: 82, chromaSubsampling: source.name === 'Leaf001' ? '4:4:4' : '4:2:0', mozjpeg: true }).toBuffer());
    // Preserve normal-vector chroma detail; default 4:2:0 would blur the X/Y slopes.
    await save(join(target, 'normal.jpg'), await sharp(normal).jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer());
    const channels = await Promise.all(['ao', 'roughness', 'metalness'].map(async (channel, index) => {
      const file = find(channel);
      if (!file) return Buffer.alloc(width * height, index === 2 ? 0 : 255);
      const decoded = await sharp(await readFile(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      if (decoded.info.width !== width || decoded.info.height !== height) throw new Error(`${source.name}: mismatched ${channel} dimensions`);
      // Match three.js sampling (AO red, roughness green, metalness blue).
      const component = decoded.info.channels === 1 ? 0 : index;
      return Buffer.from(Array.from({ length: width * height }, (_, pixel) => decoded.data[pixel * decoded.info.channels + component]));
    }));
    const orm = Buffer.alloc(width * height * 3);
    for (let pixel = 0; pixel < width * height; pixel++) for (let channel = 0; channel < 3; channel++) orm[pixel * 3 + channel] = channels[channel][pixel];
    // R=AO, G=roughness, B=metalness. 4:4:4 avoids spatial chroma subsampling.
    await save(join(target, 'orm.jpg'), await sharp(orm, { raw: { width, height, channels: 3 } }).jpeg({ quality: 80, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer());
    const alpha = find('alpha');
    if (alpha) await save(join(target, 'alpha.webp'), await sharp(alpha).webp({ lossless: true, effort: 6 }).toBuffer());
    console.log(`${source.name}: ${width} x ${height}`);
  }
  console.log(`${count} files, ${total.toLocaleString('en-US')} bytes (${(total / 1_000_000).toFixed(2)} MB), excluding the unchanged HDRI`);
  if (total > 15_000_000) throw new Error('Texture output exceeds the 15 MB budget');
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
