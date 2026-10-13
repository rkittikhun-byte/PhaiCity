/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run art:blend [-- <run folder>]: builds phaicity-models.blend from an art export run (docs/3d/ART_ARCHIVE.md),
// the newest run in the archive unless one is named. Blender comes from BLENDER, the PATH, or the usual install
// folders on Windows; it runs in the background (no window) with scripts/blender/build_library.py.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artRoot, latestRun } from '../art/artServer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

/** "Blender 5.2" before "Blender 4.10" before "Blender 4.2" */
function newestFirst(a, b) {
  const numbers = (name) => (name.match(/\d+/g) ?? []).map(Number);
  const [x, y] = [numbers(a), numbers(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
  }
  return 0;
}

export function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const lookup = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' });
  if (lookup.status === 0 && lookup.stdout.trim()) return lookup.stdout.split(/\r?\n/)[0].trim();
  if (process.platform === 'win32') {
    for (const drive of ['C:', 'D:', 'E:']) {
      const base = path.join(`${drive}${path.sep}`, 'Program Files', 'Blender Foundation');
      if (!fs.existsSync(base)) continue;
      for (const version of fs.readdirSync(base).filter((name) => /^Blender \d/.test(name)).sort(newestFirst)) {
        const exe = path.join(base, version, 'blender.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

function main() {
  const run = process.argv[2] ? path.resolve(process.argv[2]) : latestRun(artRoot(root));
  if (!run || !fs.existsSync(path.join(run, 'manifest.json'))) {
    console.error('No export run found. Start npm run dev, open /art-export.html and export first.');
    process.exit(1);
  }
  const blender = findBlender();
  if (!blender) {
    console.error('Blender not found: install it, or set BLENDER to blender.exe.');
    process.exit(1);
  }
  console.log(`Blender: ${blender}\nRun: ${run}`);
  const result = spawnSync(blender, ['-b', '--factory-startup', '--python-exit-code', '1',
    '-P', path.join(here, 'build_library.py'), '--', run], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
