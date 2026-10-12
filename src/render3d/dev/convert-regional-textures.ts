/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

/** Dev only: node src/render3d/dev/convert-regional-textures.ts --input RAW --output NEW
 * RAW/<source>/{color,normal,orm}.png. Poly Haven ARM is already R=AO,G=roughness,B=metalness.
 * A directory containing only normal.png refreshes an existing set from its original scan.
 * Inspect NEW before copying maps into assets/textures/sources; originals never ship.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const value = (flag: string): string => {
    const i = args.indexOf(flag);
    if (i < 0 || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Required: ${flag}`);
    return resolve(args[i + 1]);
  };
  const input = value('--input'), output = value('--output');
  if (input === output) throw new Error('Output must be a new directory');
  await mkdir(output); // Refuse to overwrite an existing output directory.
  for (const entry of await readdir(input, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dest = join(output, entry.name); await mkdir(dest);
    const maps = await readdir(join(input, entry.name));
    for (const map of ['color', 'normal', 'orm']) {
      if (!maps.includes(`${map}.png`)) continue;
      const src = join(input, entry.name, `${map}.png`), metadata = await sharp(src).metadata();
      if (![metadata.width, metadata.height].every(n => n !== undefined && n >= 1024 && n <= 1025)) throw new Error(`Expected original 1K map: ${src}`);
      // High-quality normals retain local slope detail; scalar ORM avoids chroma subsampling.
      await sharp(src).jpeg({ quality: map === 'normal' ? 86 : map === 'color' ? 82 : 80,
        chromaSubsampling: map === 'orm' ? '4:4:4' : '4:2:0', mozjpeg: true }).toFile(join(dest, `${map}.jpg`));
      process.stdout.write(`${entry.name}/${map}.jpg ${(await stat(join(dest, `${map}.jpg`))).size} bytes\n`);
    }
  }
}
void main().catch(error => { process.stderr.write(`${String(error)}\n`); process.exitCode = 1; });
