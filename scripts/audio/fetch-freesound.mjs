/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// node scripts/audio/fetch-freesound.mjs <rawDir> <id> [<id> ...]
// Downloads the high-quality OGG preview of each Freesound id into <rawDir>/freesound/, but only
// when the API reports a CC0 license. Reads FREESOUND_API_KEY from .env and never prints it.
// Writes <rawDir>/freesound/sources.json for assets/audio/CREDITS.md.

import fs from 'node:fs';
import path from 'node:path';

const [rawDir, ...ids] = process.argv.slice(2);
const key = (fs.readFileSync('.env', 'utf8').match(/^FREESOUND_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!rawDir || ids.length === 0 || !key) {
  console.error('Usage: node scripts/audio/fetch-freesound.mjs <rawDir> <id>... (needs FREESOUND_API_KEY in .env)');
  process.exit(1);
}

const outDir = path.join(rawDir, 'freesound');
const sourcesFile = path.join(outDir, 'sources.json');
fs.mkdirSync(outDir, { recursive: true });
const sources = fs.existsSync(sourcesFile) ? JSON.parse(fs.readFileSync(sourcesFile, 'utf8')) : {};
const CC0 = /publicdomain\/zero\/1\.0/;

for (const id of ids) {
  const api = `https://freesound.org/apiv2/sounds/${id}/?fields=id,name,username,license,url,previews,duration`;
  const response = await fetch(`${api}&token=${encodeURIComponent(key)}`);
  if (!response.ok) {
    console.log(`${id}\tSKIP\tAPI ${response.status}`);
    continue;
  }
  const sound = await response.json();
  if (!CC0.test(sound.license)) {
    console.log(`${id}\tSKIP\tnot CC0: ${sound.license}`);
    continue;
  }
  const safeName = sound.name.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 50);
  const file = `${id}_${safeName}.ogg`;
  const audio = await fetch(sound.previews['preview-hq-ogg']);
  fs.writeFileSync(path.join(outDir, file), Buffer.from(await audio.arrayBuffer()));
  sources[id] = {
    file, name: sound.name, author: sound.username, license: sound.license, url: sound.url,
    duration: sound.duration, downloadedAt: new Date().toISOString(),
  };
  console.log(`${id}\tOK\t${file} (${sound.duration.toFixed(1)} s, by ${sound.username})`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

fs.writeFileSync(sourcesFile, JSON.stringify(sources, null, 2) + '\n');
