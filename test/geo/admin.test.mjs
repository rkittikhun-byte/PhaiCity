/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run with: npm run test:geo
// The admin page's endpoint on the dev server (scripts/admin/adminServer.mjs): what it lets save, what it refuses,
// and the layout it writes the data files in.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { addAdminRoutes, formatJson } from '../../scripts/admin/adminServer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A project folder with copies of the two data files and the game's checks, to save into. */
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phaicity-admin-'));
  for (const file of ['data/province-rules.json', 'data/province-profiles.json', 'src/provinceRules.ts',
    'src/geo/provinceResources.ts']) {
    fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  }
  return dir;
}

/** The routes added to a stand-in for the dev server's app. */
function routes(root) {
  const handlers = {};
  addAdminRoutes({ get: (url, fn) => { handlers[`GET ${url}`] = fn; }, post: (url, fn) => { handlers[`POST ${url}`] = fn; } }, root);
  return handlers;
}

async function call(handler, { headers = {}, body = '' } = {}) {
  const req = Readable.from([Buffer.from(body)]);
  req.headers = headers;
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, body: '', end(text) { this.body = text; } };
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

const LOCAL = { origin: 'http://localhost:8080', 'content-type': 'application/json' };

describe('the admin endpoint', () => {
  test('lays the data files out as they are written by hand', () => {
    for (const file of ['data/province-rules.json', 'data/province-profiles.json']) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
      assert.equal(formatJson(JSON.parse(text)) + '\n', text);
    }
  });

  test('gives the two files as they are', async () => {
    const root = sandbox();
    const { status, json } = await call(routes(root)['GET /__admin/data']);
    assert.equal(status, 200);
    assert.equal(json.rules.version, 1);
    assert.ok(json.profiles.provinces['TH-52']);
  });

  test('saves checked files from a page on this machine, keeping the comments', async () => {
    const root = sandbox();
    const handlers = routes(root);
    const { json: files } = await call(handlers['GET /__admin/data']);
    files.rules.provinces['TH-52'] = { demand: { commercial: 1.6 } };
    files.profiles.provinces['TH-52'].levels = { tourism: 4 };
    const { status } = await call(handlers['POST /__admin/save'], { headers: LOCAL, body: JSON.stringify(files) });
    assert.equal(status, 200);
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'data/province-rules.json'), 'utf8'));
    assert.deepEqual(saved.provinces['TH-52'], { demand: { commercial: 1.6 } });
    assert.ok(saved._note && saved.regions.north._note);
    const profiles = JSON.parse(fs.readFileSync(path.join(root, 'data/province-profiles.json'), 'utf8'));
    assert.deepEqual(profiles.provinces['TH-52'].levels, { tourism: 4 });
  });

  test('refuses other sites, other kinds of body and wrong values, and then writes nothing', async () => {
    const root = sandbox();
    const handlers = routes(root);
    const before = fs.readFileSync(path.join(root, 'data/province-rules.json'), 'utf8');
    const { json: files } = await call(handlers['GET /__admin/data']);
    const body = JSON.stringify(files);
    assert.equal((await call(handlers['POST /__admin/save'], { headers: { ...LOCAL, origin: 'https://example.com' }, body })).status, 403);
    assert.equal((await call(handlers['POST /__admin/save'], { headers: { origin: LOCAL.origin, 'content-type': 'text/plain' }, body })).status, 403);
    assert.equal((await call(handlers['POST /__admin/save'], { headers: { 'content-type': 'application/json' }, body })).status, 403);
    files.rules.regions.north.demand = { commercial: 9 };
    const bad = await call(handlers['POST /__admin/save'], { headers: LOCAL, body: JSON.stringify(files) });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.json.problems, ['regions.north.demand.commercial: must be 0.1–5']);
    assert.equal(fs.readFileSync(path.join(root, 'data/province-rules.json'), 'utf8'), before);
  });
});
