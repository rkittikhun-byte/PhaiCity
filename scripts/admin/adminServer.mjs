/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The admin page's endpoint on the dev server only (webpack.config.js, npm run dev; never in a build): the owner sees
// and sets each region's and province's rules and resources on admin.html, and saving writes the two data files in
// the project, which git keeps the history of (docs/PROVINCE_PROFILE.md). Once the game is online the same page talks
// to the server's database instead (ONLINE_PLAN 5.2).
//
// GET  /__admin/data  the two files as they are on disk
// POST /__admin/save  { rules, profiles }: both checked with the game's own checks (src/provinceRules.ts,
//                     src/geo/provinceResources.ts) and written only when nothing is wrong
//
// Only this machine's own pages may save: a request must come from a localhost page, as JSON, and be small.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BODY = 1024 * 1024;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** JSON laid out like the hand-written data files: short objects and lists on one line, the rest one key a line. */
// lead: how far along its line the value starts (the indent, or past its key)
export function formatJson(value, indent = 0, width = 118, lead = indent) {
  const inline = (v) => {
    if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
    if (v && typeof v === 'object') {
      const entries = Object.entries(v);
      return entries.length ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
    }
    return JSON.stringify(v);
  };
  const flat = inline(value);
  // Long text stays on one line, as in the hand-written files
  if (!value || typeof value !== 'object' || lead + flat.length <= width) return flat;
  const pad = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => pad + formatJson(v, indent + 2, width)).join(',\n')}\n${' '.repeat(indent)}]`;
  }
  const lines = Object.entries(value).map(([k, v]) => {
    const key = `${JSON.stringify(k)}: `;
    return pad + key + formatJson(v, indent + 2, width, indent + 2 + key.length);
  });
  return `{\n${lines.join(',\n')}\n${' '.repeat(indent)}}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Adds the two routes to the dev server's app. root: the project folder. */
export function addAdminRoutes(app, root) {
  const files = {
    rules: path.join(root, 'data', 'province-rules.json'),
    profiles: path.join(root, 'data', 'province-profiles.json'),
  };
  // The game's own checks, run here as they are (Node 22.18+ strips their types), loaded on the first save
  const loadChecks = () => Promise.all([
    import(pathToFileURL(path.join(root, 'src', 'provinceRules.ts')).href),
    import(pathToFileURL(path.join(root, 'src', 'geo', 'provinceResources.ts')).href),
  ]);

  app.get('/__admin/data', (req, res) => {
    try {
      send(res, 200, {
        rules: JSON.parse(fs.readFileSync(files.rules, 'utf8')),
        profiles: JSON.parse(fs.readFileSync(files.profiles, 'utf8')),
      });
    } catch (error) {
      send(res, 500, { problems: [String(error.message)] });
    }
  });

  app.post('/__admin/save', async (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !LOCAL_ORIGIN.test(origin) || !/^application\/json\b/.test(req.headers['content-type'] ?? '')) {
      send(res, 403, { problems: ['only this machine\'s admin page may save'] });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (error) {
      send(res, 400, { problems: ['not JSON, or too large'] });
      return;
    }
    let checkRulesData, checkProfilesData;
    try {
      [{ checkRulesData }, { checkProfilesData }] = await loadChecks();
    } catch (error) {
      send(res, 500, { problems: [`the checks could not load (Node 22.18 or newer is needed): ${error.message}`] });
      return;
    }
    const problems = [...checkRulesData(body?.rules).problems, ...checkProfilesData(body?.profiles).problems];
    if (problems.length > 0) {
      send(res, 400, { problems });
      return;
    }
    // Each file keeps the line endings it has on this machine
    for (const [file, value] of [[files.rules, body.rules], [files.profiles, body.profiles]]) {
      const crlf = fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('\r\n');
      const text = formatJson(value) + '\n';
      fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text);
    }
    send(res, 200, { saved: [path.relative(root, files.rules), path.relative(root, files.profiles)] });
  });
}
