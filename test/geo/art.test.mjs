/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Run with: npm run test:geo
// The art archive's endpoint on the dev server (scripts/art/artServer.mjs, docs/3d/ART_ARCHIVE.md): where runs go,
// what it writes and copies, and what it refuses.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { addArtRoutes, artRoot, latestRun } from '../../scripts/art/artServer.mjs';
import { findBlender } from '../../scripts/blender/run.mjs';

/** A project with one texture and the credits, and an empty archive for it, set through PHAICITY_ART_DIR. */
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phaicity-art-root-'));
  fs.mkdirSync(path.join(root, 'assets/textures/sources/bamboo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/textures/sources/bamboo/color.jpg'), 'jpeg bytes');
  fs.writeFileSync(path.join(root, 'assets/CREDITS.md'), '# Credits\n');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'not for the archive');
  const archive = fs.mkdtempSync(path.join(os.tmpdir(), 'phaicity-art-archive-'));
  process.env.PHAICITY_ART_DIR = archive;
  const handlers = {};
  addArtRoutes({
    get: (url, fn) => { handlers[`GET ${url}`] = fn; },
    post: (url, fn) => { handlers[`POST ${url}`] = fn; },
  }, root);
  delete process.env.PHAICITY_ART_DIR;
  return { root, archive, handlers };
}

async function call(handler, { url = '/', headers = {}, body = '' } = {}) {
  const req = Readable.from([Buffer.from(body)]);
  req.url = url;
  req.headers = headers;
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, body: '', end(text) { this.body = text; } };
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

const JSON_LOCAL = { origin: 'http://localhost:8080', 'content-type': 'application/json' };
const BYTES_LOCAL = { origin: 'http://localhost:8080', 'content-type': 'application/octet-stream' };

describe('the art archive endpoint', () => {
  test('keeps the archive beside the project, or where PHAICITY_ART_DIR says', () => {
    const { archive, handlers } = sandbox();
    assert.ok(handlers['GET /__art/info']);
    process.env.PHAICITY_ART_DIR = archive;
    assert.equal(artRoot('/anywhere'), path.resolve(archive));
    delete process.env.PHAICITY_ART_DIR;
    const outside = artRoot(fs.mkdtempSync(path.join(os.tmpdir(), 'phaicity-not-git-')));
    assert.equal(path.basename(outside), 'phaicity-art');
  });

  test('starts a run, writes its files and copies the textures it names', async () => {
    const { archive, handlers } = sandbox();
    const start = await call(handlers['POST /__art/start'], { headers: JSON_LOCAL, body: '{}' });
    assert.equal(start.status, 200);
    const { run } = start.json;
    const dir = path.join(archive, 'exports', run);
    assert.ok(fs.existsSync(dir));

    const file = await call(handlers['POST /__art/file'], {
      url: `/__art/file?run=${run}&path=${encodeURIComponent('models/residential/res.house_0@north.gltf')}`,
      headers: BYTES_LOCAL, body: '{"asset":{}}',
    });
    assert.equal(file.status, 200);
    assert.equal(fs.readFileSync(path.join(dir, 'models/residential/res.house_0@north.gltf'), 'utf8'), '{"asset":{}}');

    const copied = await call(handlers['POST /__art/textures'], {
      url: `/__art/textures?run=${run}`, headers: JSON_LOCAL,
      body: JSON.stringify(['assets/textures/sources/bamboo/color.jpg', 'assets/CREDITS.md',
        'assets/textures/sources/none/color.jpg']),
    });
    assert.equal(copied.status, 200);
    assert.equal(copied.json.copied, 2);
    assert.deepEqual(copied.json.missing, ['assets/textures/sources/none/color.jpg']);
    assert.equal(fs.readFileSync(path.join(dir, 'assets/textures/sources/bamboo/color.jpg'), 'utf8'), 'jpeg bytes');

    fs.writeFileSync(path.join(dir, 'manifest.json'), '{}');
    assert.equal(latestRun(archive), dir);
  });

  test('refuses other sites, paths outside the run, other kinds of file, and files outside the textures', async () => {
    const { archive, handlers } = sandbox();
    const other = await call(handlers['POST /__art/start'], {
      headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(other.status, 403);
    assert.equal(fs.existsSync(path.join(archive, 'exports')), false);

    const { json: { run } } = await call(handlers['POST /__art/start'], { headers: JSON_LOCAL, body: '{}' });
    for (const bad of ['../escape.gltf', 'models/../../escape.gltf', 'models/run.exe', '/etc/passwd.json']) {
      const reply = await call(handlers['POST /__art/file'], {
        url: `/__art/file?run=${run}&path=${encodeURIComponent(bad)}`, headers: BYTES_LOCAL, body: 'x',
      });
      assert.equal(reply.status, 400, bad);
    }
    const noRun = await call(handlers['POST /__art/file'], {
      url: `/__art/file?run=..&path=a.gltf`, headers: BYTES_LOCAL, body: 'x',
    });
    assert.equal(noRun.status, 400);
    for (const bad of [['secret.txt'], ['assets/textures/../../secret.txt'], [42]]) {
      const reply = await call(handlers['POST /__art/textures'], {
        url: `/__art/textures?run=${run}`, headers: JSON_LOCAL, body: JSON.stringify(bad),
      });
      assert.equal(reply.status, 400, JSON.stringify(bad));
    }
    assert.equal(fs.existsSync(path.join(archive, 'escape.gltf')), false);
    assert.equal(fs.existsSync(path.join(archive, 'exports', run, 'secret.txt')), false);
  });

  test('finds Blender where BLENDER says first', () => {
    process.env.BLENDER = 'C:/somewhere/blender.exe';
    assert.equal(findBlender(), 'C:/somewhere/blender.exe');
    delete process.env.BLENDER;
  });
});
