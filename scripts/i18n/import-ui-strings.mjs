/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// npm run i18n:import
// Reads the reviewed translation table in docs/i18n/UI_STRINGS.md and writes src/i18n/strings.ts.
// The doc is the source of truth: edit translations there, then re-run this script.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = path.join(ROOT, 'docs', 'i18n', 'UI_STRINGS.md');
const TARGET = path.join(ROOT, 'src', 'i18n', 'strings.ts');

// Decisions recorded at the top of UI_STRINGS.md
const THAI_REPLACEMENTS = [['พาณิชยกรรม', 'พาณิชย์']];

const unquote = (cell) => cell.trim().replace(/^`(.*)`$/s, '$1').trim();

function parseRows(markdown) {
  const entries = new Map();
  const problems = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\|\s*`[a-z]/.test(line)) continue;
    const cells = line.split('|').slice(1, -1);
    if (cells.length < 5) {
      problems.push(`too few columns: ${line.slice(0, 80)}`);
      continue;
    }
    const [key, file, current, en, th] = cells.map(unquote);
    if (!/^[a-z][a-z0-9_.]*$/.test(key)) {
      problems.push(`bad key "${key}"`);
      continue;
    }
    let thai = th;
    for (const [from, to] of THAI_REPLACEMENTS) thai = thai.split(from).join(to);
    if (entries.has(key)) problems.push(`duplicate key ${key} (later row wins)`);
    entries.set(key, { file, current, en, th: thai });
  }
  return { entries, problems };
}

function main() {
  const { entries, problems } = parseRows(fs.readFileSync(SOURCE, 'utf8'));
  const body = [...entries.entries()]
    .map(([key, e]) => `  ${JSON.stringify(key)}: { en: ${JSON.stringify(e.en)}, th: ${JSON.stringify(e.th)} },`)
    .join('\n');

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, `/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// GENERATED from docs/i18n/UI_STRINGS.md by scripts/i18n/import-ui-strings.mjs. Do not edit by hand:
// change the translation table in the doc, then run "npm run i18n:import".

export interface Translation {
  en: string;
  th: string;
}

export const STRINGS: Record<string, Translation> = {
${body}
};
`);

  console.log(`Wrote ${entries.size} strings to ${path.relative(ROOT, TARGET)}`);
  for (const problem of problems) console.log(`  warning: ${problem}`);
}

main();
