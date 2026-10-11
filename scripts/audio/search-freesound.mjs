/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// node scripts/audio/search-freesound.mjs <min seconds> <max seconds> <query> [<query> ...]
// Lists CC0 sounds on Freesound for each query, without downloading anything, so the owner can choose
// before scripts/audio/fetch-freesound.mjs fetches them. Reads FREESOUND_API_KEY from .env, never prints it.

import fs from 'node:fs';

const [min, max, ...queries] = process.argv.slice(2);
const key = (fs.readFileSync('.env', 'utf8').match(/^FREESOUND_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key || queries.length === 0) {
  console.error('Usage: node scripts/audio/search-freesound.mjs <min s> <max s> <query>... (needs FREESOUND_API_KEY in .env)');
  process.exit(1);
}

const seen = new Set();
for (const query of queries) {
  const filter = `license:"Creative Commons 0" duration:[${Number(min)} TO ${Number(max)}]`;
  const url = 'https://freesound.org/apiv2/search/text/?' + new URLSearchParams({
    query, filter, fields: 'id,name,username,duration,num_downloads,avg_rating,tags', page_size: '12', sort: 'rating_desc',
  });
  const response = await fetch(`${url}&token=${encodeURIComponent(key)}`);
  if (!response.ok) {
    console.log(`## ${query}: API ${response.status}`);
    continue;
  }
  const { count, results } = await response.json();
  console.log(`## ${query} (${count} CC0 results)`);
  for (const sound of results) {
    if (seen.has(sound.id)) continue;
    seen.add(sound.id);
    const tags = (sound.tags || []).slice(0, 6).join(' ');
    console.log(`${sound.id}\t${Math.round(sound.duration)}s\t${(sound.avg_rating || 0).toFixed(1)}★\t${sound.num_downloads}↓\t${sound.username}\t${sound.name}\t[${tags}]`);
  }
}
