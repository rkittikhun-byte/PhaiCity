/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The art archive's endpoint on the dev server only (webpack.config.js, npm run dev; never in a build). Codex's 3D
// models are code (src/render3d/models), so the owner keeps snapshots of them as files that Blender opens
// (docs/3d/ART_ARCHIVE.md, owner 13 Oct 2026): art-export.html builds every registered model and sends each here as a
// glTF file, and npm run art:blend gathers one run into a .blend library. The archive lives outside the project, in
// phaicity-art beside its main folder, because it is large and is not source.
//
// GET  /__art/info                    { archive }: where runs go
// POST /__art/start                   { run, dir }: a new folder exports/<date>_<time>_<commit>/ for one run
// POST /__art/file?run=&path=         a file's bytes, written at that path inside the run (a model's .gltf and .bin,
//                                     a texture drawn in code as .png or .jpg, the manifest and the README)
// POST /__art/textures?run=           ["assets/textures/…", …] (JSON): copies those files from the project into the run
//
// Only this machine's own pages may write, and only inside the run's own folder.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BODY = 64 * 1024 * 1024;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
/** A run's folder name: 2026-10-13_1530_3daa1c8, with _2, _3 … when one minute holds more than one run */
const RUN = /^\d{4}-\d{2}-\d{2}_\d{4}_[0-9a-z]{4,40}(_\d+)?$/;
const FILE = /^[A-Za-z0-9_.@-]+(\/[A-Za-z0-9_.@-]+)*\.(gltf|bin|png|jpg|json|md|txt)$/;
/** What a run may copy from the project: the texture files the models use, and their credits */
const COPYABLE = /^assets\/(textures\/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)|CREDITS\.md)$/;

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** The archive: PHAICITY_ART_DIR if set, else phaicity-art beside the project's main folder (worktrees share it). */
export function artRoot(root) {
  if (process.env.PHAICITY_ART_DIR) return path.resolve(process.env.PHAICITY_ART_DIR);
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const main = common ? path.dirname(common) : path.resolve(root);
  return path.join(path.dirname(main), 'phaicity-art');
}

/** The newest run in the archive, or null. */
export function latestRun(archive) {
  const exports = path.join(archive, 'exports');
  if (!fs.existsSync(exports)) return null;
  const runs = fs.readdirSync(exports).filter((name) => RUN.test(name)
    && fs.existsSync(path.join(exports, name, 'manifest.json'))).sort();
  return runs.length ? path.join(exports, runs[runs.length - 1]) : null;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** A path inside dir, or null when it would leave it. */
function inside(dir, relative) {
  const target = path.resolve(dir, relative);
  return target.startsWith(dir + path.sep) ? target : null;
}

function stamp(date = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}_${two(date.getHours())}${two(date.getMinutes())}`;
}

export function addArtRoutes(app, root) {
  const archive = artRoot(root);
  const query = (req) => new URL(req.url, 'http://localhost').searchParams;
  const runDir = (run) => (run && RUN.test(run) ? path.join(archive, 'exports', run) : null);
  const allowed = (req, res, types) => {
    const origin = req.headers.origin;
    const type = req.headers['content-type'] ?? '';
    if (!origin || !LOCAL_ORIGIN.test(origin) || !types.some((t) => type.startsWith(t))) {
      send(res, 403, { problem: 'only this machine\'s art export page may write' });
      return false;
    }
    return true;
  };

  app.get('/__art/info', (req, res) => send(res, 200, { archive }));

  app.post('/__art/start', (req, res) => {
    if (!allowed(req, res, ['application/json'])) return;
    const commit = git(root, ['rev-parse', '--short', 'HEAD']) || 'nogit';
    const base = `${stamp()}_${commit}`;
    let run = base;
    for (let n = 2; fs.existsSync(path.join(archive, 'exports', run)); n++) run = `${base}_${n}`;
    const dir = path.join(archive, 'exports', run);
    try {
      fs.mkdirSync(dir, { recursive: true });
      send(res, 200, { run, dir, commit });
    } catch (error) {
      send(res, 500, { problem: String(error.message) });
    }
  });

  app.post('/__art/file', async (req, res) => {
    if (!allowed(req, res, ['application/octet-stream', 'application/json', 'text/plain'])) return;
    const params = query(req);
    const dir = runDir(params.get('run'));
    const relative = params.get('path') ?? '';
    const target = dir && FILE.test(relative) && !relative.split('/').includes('..') ? inside(dir, relative) : null;
    if (!dir || !fs.existsSync(dir) || !target) {
      send(res, 400, { problem: 'no such run, or a path outside it' });
      return;
    }
    try {
      const body = await readBody(req);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
      send(res, 200, { bytes: body.length });
    } catch (error) {
      send(res, 400, { problem: String(error.message) });
    }
  });

  app.post('/__art/textures', async (req, res) => {
    if (!allowed(req, res, ['application/json'])) return;
    const dir = runDir(query(req).get('run'));
    if (!dir || !fs.existsSync(dir)) {
      send(res, 400, { problem: 'no such run' });
      return;
    }
    let files;
    try {
      files = JSON.parse((await readBody(req)).toString('utf8'));
    } catch {
      send(res, 400, { problem: 'not JSON' });
      return;
    }
    if (!Array.isArray(files) || files.some((file) => typeof file !== 'string' || !COPYABLE.test(file)
        || file.split('/').includes('..'))) {
      send(res, 400, { problem: 'only files under assets/textures, and assets/CREDITS.md' });
      return;
    }
    const missing = [];
    let bytes = 0;
    for (const file of files) {
      const source = inside(path.resolve(root), file);
      const target = inside(dir, file);
      if (!source || !target || !fs.existsSync(source)) {
        missing.push(file);
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
      bytes += fs.statSync(target).size;
    }
    send(res, 200, { copied: files.length - missing.length, missing, bytes });
  });
}
