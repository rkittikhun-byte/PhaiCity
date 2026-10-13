/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The art export page (art-export.html, dev server only; docs/3d/ART_ARCHIVE.md, owner 13 Oct 2026). Codex's 3D models
// are code, so the owner keeps snapshots of them as files: this page builds every model in the registry, in every
// region for the regional tiers (R1, R2) and in each of its variants and states, and sends each to the dev server as a
// glTF file in a new run of the art archive (scripts/art/artServer.mjs); npm run art:blend then gathers the run into a
// Blender library.
//
// It only reads the models: it calls their factories as the gallery does, and gives each mesh its own copy of the
// material whose texture maps are stand-ins naming the project's texture files. The files then point at one shared
// copy of each texture in the run (assets/textures/…) instead of carrying their own, which keeps a run small.
// Textures drawn in code (Thai signs, cement patterns, water ripples) and the normal maps, which glTF wants with the
// green channel flipped, are written once a run in generated/, named by their content; each model's geometry goes
// beside it as <name>.bin.

import { Material, Mesh, MeshStandardMaterial, Object3D, REVISION, Source, Texture } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { TILE_M } from '../render3d/constants.js';
import { MATERIAL_KEYS, whenMaterialReady } from '../render3d/materials/library.js';
import { loadThaiSignFont } from '../render3d/materials/signs.js';
import { registry } from '../render3d/models/registry.js';
import type { ModelRegistration } from '../render3d/models/registry.js';
import { REGIONS } from '../render3d/regional/types.js';
import type { RegionId } from '../render3d/regional/types.js';

export interface ExportJob {
  id: string;
  entry: ModelRegistration;
  region?: RegionId;
  variant?: number;
  state?: string;
  /** The model's name in the archive: its id, then @region, -v<variant> and -<state> when it has them */
  name: string;
  /** Where it goes inside the run */
  file: string;
}

/** Every model to export: debug models left out, regional ones once per region when regional is on. */
export function exportJobs(regional = true): ExportJob[] {
  const jobs: ExportJob[] = [];
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.category === 'debug') continue;
    const regions: Array<RegionId | undefined> = regional && entry.regionTier !== 'R3' ? [...REGIONS] : [undefined];
    const variants: Array<number | undefined> = entry.variants ? [...entry.variants] : [undefined];
    const states: Array<string | undefined> = entry.states ? [...entry.states] : [undefined];
    for (const region of regions) {
      for (const variant of variants) {
        for (const state of states) {
          const name = id + (region ? `@${region}` : '') + (variant !== undefined ? `-v${variant}` : '')
            + (state ? `-${state}` : '');
          jobs.push({ id, entry, region, variant, state, name, file: `models/${entry.category}/${name}.gltf` });
        }
      }
    }
  }
  return jobs;
}

/** The project file a texture was loaded from (assets/textures/…), or null for one drawn in code. */
export function textureFile(texture: Texture, base = location.href): string | null {
  const src = (texture.image as { src?: unknown } | null)?.src;
  if (typeof src !== 'string') return null;
  const file = decodeURIComponent(new URL(src, base).pathname).replace(/^\/+/, '');
  return file.startsWith('assets/textures/') ? file : null;
}

/**
 * The maps that take stand-ins. Not normal maps: glTF wants the other green channel than three.js draws without
 * tangents, so the exporter writes a flipped copy of each normal image (once a run, in generated/, see unpackFile).
 */
const STAND_IN_SLOTS = ['map', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap'] as const;
/** Every texture a material may carry into the file, MeshPhysicalMaterial's included */
const ALL_SLOTS = [...STAND_IN_SLOTS, 'normalMap', 'roughnessMap', 'metalnessMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'transmissionMap', 'thicknessMap',
  'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap'] as const;

/** Whether the exporter can read a texture's pixels: an image still loading, or none at all, it cannot. */
export function exportable(texture: Texture): boolean {
  const image = texture.image as { width?: number; data?: unknown } | null | undefined;
  if (!image) return false;
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return image.complete && image.naturalWidth > 0;
  }
  if (image.data) return true;
  return (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement)
    || (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
    || (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas);
}

/**
 * A material's name for the file. A Thai sign's material is named by its whole atlas, a list of every sign's text,
 * size and colours; in Blender, which cuts names at 63 bytes, it becomes "sign_thai · <its first sign>".
 */
export function readableName(name: string): string {
  const atlas = /^sign_thai:atlas:(\[[\s\S]*\])$/.exec(name);
  if (!atlas) return name;
  try {
    const signs = JSON.parse(atlas[1]) as Array<{ text?: unknown }>;
    const first = signs.map((sign) => sign.text).find((text): text is string => typeof text === 'string' && text !== '');
    return first ? `sign_thai · ${first}` : 'sign_thai';
  } catch {
    return 'sign_thai';
  }
}

/** Copies of materials whose maps are stand-ins naming texture files, made once each for the whole run. */
export class StandIns {
  /** Every texture file a model of this run uses */
  readonly files = new Set<string>();
  /** Textures left out because they had no pixels to read: material name and slot */
  readonly dropped = new Set<string>();
  private readonly textures = new Map<Texture, Texture>();
  private readonly images = new Map<string, HTMLCanvasElement>();
  private readonly materials = new Map<Material, Material>();
  private readonly canvases = new Map<Texture, Texture>();

  /**
   * A texture whose pixels are an array (the water's ripples) as one drawn on a canvas, which every step of the
   * exporter can read (flipping a normal map draws its image). RGBA or single-channel bytes or 0–1 floats.
   */
  drawable(texture: Texture): Texture {
    const image = texture.image as { data?: ArrayLike<number>; width?: number; height?: number } | null | undefined;
    if (!image?.data || !image.width || !image.height) return texture;
    const known = this.canvases.get(texture);
    if (known) return known;
    const { data, width, height } = image;
    const channels = data.length / (width * height);
    const floats = data instanceof Float32Array || data instanceof Float64Array;
    if (channels !== 4 && channels !== 1) return texture;
    const pixels = new ImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      for (let c = 0; c < 4; c++) {
        const value = channels === 4 ? data[i * 4 + c] : c === 3 ? (floats ? 1 : 255) : data[i];
        pixels.data[i * 4 + c] = floats ? Math.round(value * 255) : value;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.putImageData(pixels, 0, 0);
    const copy = texture.clone();
    copy.source = new Source(canvas);
    this.canvases.set(texture, copy);
    return copy;
  }

  texture(original: Texture): Texture {
    const file = textureFile(original);
    if (!file) return original;
    const known = this.textures.get(original);
    if (known) return known;
    // One tiny image a file, so the exporter writes each file once however many textures use it
    let image = this.images.get(file);
    if (!image) {
      image = document.createElement('canvas');
      image.width = image.height = 1;
      this.images.set(file, image);
    }
    const standIn = new Texture(image);
    standIn.name = file;
    standIn.repeat.copy(original.repeat);
    standIn.offset.copy(original.offset);
    standIn.center.copy(original.center);
    standIn.rotation = original.rotation;
    standIn.wrapS = original.wrapS;
    standIn.wrapT = original.wrapT;
    standIn.magFilter = original.magFilter;
    standIn.minFilter = original.minFilter;
    standIn.flipY = original.flipY;
    standIn.channel = original.channel;
    standIn.colorSpace = original.colorSpace;
    this.textures.set(original, standIn);
    this.files.add(file);
    return standIn;
  }

  material(original: Material): Material {
    if (!(original instanceof MeshStandardMaterial)) return original;
    const known = this.materials.get(original);
    if (known) return known;
    const copy = original.clone();
    copy.name = readableName(original.name);
    for (const slot of STAND_IN_SLOTS) {
      const texture = copy[slot];
      if (texture) copy[slot] = this.texture(texture);
    }
    // One image for roughness and metalness (the ORM scans) is written as it is. Two separate images the exporter
    // would combine through a canvas, which a stand-in cannot feed, so those keep their own pixels.
    const rough = copy.roughnessMap;
    const metal = copy.metalnessMap;
    if (rough && (rough === metal || (metal && textureFile(rough) !== null && textureFile(rough) === textureFile(metal)))) {
      copy.roughnessMap = copy.metalnessMap = this.texture(rough);
    }
    const slots = copy as unknown as Record<string, Texture | null | undefined>;
    for (const slot of ALL_SLOTS) {
      const texture = slots[slot];
      if (!texture) continue;
      const readable = slots[slot] = this.drawable(texture);
      if (!exportable(readable)) {
        slots[slot] = null;
        this.dropped.add(`${original.name || original.type}.${slot}`);
      }
    }
    this.materials.set(original, copy);
    return copy;
  }
}

/** Gives a freshly built model the run's material copies, and counts its triangles. */
export function prepareModel(model: Object3D, standIns: StandIns): number {
  let triangles = 0;
  model.traverse((object) => {
    const mesh = object as Mesh & { isInstancedMesh?: boolean; count?: number };
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => standIns.material(material))
      : standIns.material(mesh.material);
    const geometry = mesh.geometry;
    const vertices = geometry.index ? geometry.index.count : geometry.getAttribute('position')?.count ?? 0;
    triangles += Math.floor(vertices / 3) * (mesh.isInstancedMesh ? mesh.count ?? 1 : 1);
  });
  return triangles;
}

interface GltfJson {
  asset: Record<string, unknown>;
  buffers?: Array<{ uri?: string; byteLength: number }>;
  images?: Array<{ uri?: string; mimeType?: string; name?: string }>;
  textures?: Array<{ name?: string; source?: number }>;
}

/** Points the images of stand-in textures at the run's shared texture files (the file sits two folders down). */
export function shareTextures(json: GltfJson, prefix = '../../'): void {
  const images = json.images ?? [];
  for (const texture of json.textures ?? []) {
    const file = texture.name;
    if (typeof file !== 'string' || !file.startsWith('assets/textures/') || texture.source === undefined) continue;
    images[texture.source] = {
      name: file.replace(/^assets\/textures\//, ''),
      uri: encodeURI(prefix + file),
      mimeType: file.endsWith('.png') ? 'image/png' : 'image/jpeg',
    };
  }
}

type Upload = (file: string, body: string | Uint8Array) => Promise<void>;

const hex = (digest: ArrayBuffer): string =>
  Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Moves what the exporter packed into a model's file out beside it: the geometry into <name>.bin next to the file, and
 * each image drawn in code into generated/<hash>.png (or .jpg), written once a run however many models use it.
 * Returns the bytes written.
 */
export async function unpackFile(json: GltfJson, job: Pick<ExportJob, 'name' | 'file'>, upload: Upload,
    written: Set<string>): Promise<number> {
  let bytes = 0;
  const folder = job.file.slice(0, job.file.lastIndexOf('/') + 1);
  const depth = '../'.repeat(folder.split('/').length - 1);
  for (const [index, buffer] of (json.buffers ?? []).entries()) {
    if (!buffer.uri?.startsWith('data:')) continue;
    const data = new Uint8Array(await (await fetch(buffer.uri)).arrayBuffer());
    const name = `${job.name}${index ? `_${index}` : ''}.bin`;
    await upload(folder + name, data);
    buffer.uri = encodeURIComponent(name);
    bytes += data.length;
  }
  for (const image of json.images ?? []) {
    if (!image.uri?.startsWith('data:')) continue;
    const type = image.uri.slice(5, image.uri.indexOf(';'));
    const data = new Uint8Array(await (await fetch(image.uri)).arrayBuffer());
    const file = `generated/${hex(await crypto.subtle.digest('SHA-256', data)).slice(0, 24)}.${type === 'image/jpeg' ? 'jpg' : 'png'}`;
    if (!written.has(file)) {
      await upload(file, data);
      written.add(file);
      bytes += data.length;
    }
    image.uri = depth + file;
    image.mimeType = type;
  }
  return bytes;
}

/** A turn of the event loop that background tabs do not slow down (unlike setTimeout). */
const nextTask = (): Promise<void> => new Promise((resolve) => {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => resolve();
  channel.port2.postMessage(null);
});

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const reply = await response.json() as T & { problem?: string };
  if (!response.ok) throw new Error(reply.problem ?? `HTTP ${response.status}`);
  return reply;
}

async function upload(run: string, file: string, body: string | Uint8Array): Promise<void> {
  const response = await fetch(`/__art/file?run=${encodeURIComponent(run)}&path=${encodeURIComponent(file)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body,
  });
  if (!response.ok) throw new Error(((await response.json()) as { problem?: string }).problem ?? `HTTP ${response.status}`);
}

function readme(run: string, commit: string, count: number): string {
  return [
    `# PhaiCity 3D models: ${run}`,
    '',
    `Every model of PhaiCity's 3D view at commit ${commit}, exported by art-export.html (three.js r${REVISION}).`,
    `Units are metres; one map tile is ${TILE_M} m. ${count} models in models/<category>/ (each a .gltf with its`,
    'geometry in a .bin beside it). The textures they share are in assets/textures/, and the ones the game draws in',
    'code (Thai signs, patterns) in generated/. npm run art:blend builds phaicity-models.blend from this folder.',
    '',
    'The models come from the PhaiCity source code (GNU GPL v3, see LICENSE and COPYING in the project).',
    'The textures are CC0; their sources are listed in assets/CREDITS.md.',
    '',
  ].join('\n');
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

async function runExport(regional: boolean, say: (text: string) => void, step: (done: number, all: number) => void) {
  say('กำลังโหลด texture และฟอนต์ป้าย…');
  await loadThaiSignFont();
  await Promise.all(MATERIAL_KEYS.map((key) => whenMaterialReady(key)));
  const { run, dir, commit } = await postJson<{ run: string; dir: string; commit: string }>('/__art/start', {});
  say(`เริ่มรอบ ${run}`);
  const jobs = exportJobs(regional);
  const standIns = new StandIns();
  const exporter = new GLTFExporter();
  const models: Array<Record<string, unknown>> = [];
  const failures: Array<{ file: string; error: string }> = [];
  const generated = new Set<string>();
  const send: Upload = (file, body) => upload(run, file, body);
  let bytes = 0;
  for (const [index, job] of jobs.entries()) {
    try {
      const model = job.entry.factory({ seed: 1, region: job.region, variant: job.variant, state: job.state });
      model.name = job.name;
      // Tinted copies and Thai signs finish their late updates first
      await nextTask();
      const triangles = prepareModel(model, standIns);
      const json = await exporter.parseAsync(model, { binary: false, onlyVisible: true, maxTextureSize: 1024 }) as unknown as GltfJson;
      shareTextures(json);
      const extra = await unpackFile(json, job, send, generated);
      json.asset.extras = { phaicity: { id: job.id, region: job.region ?? null, variant: job.variant ?? null,
        state: job.state ?? null, commit } };
      const body = JSON.stringify(json);
      await upload(run, job.file, body);
      bytes += body.length + extra;
      models.push({
        file: job.file, name: job.name, id: job.id, category: job.entry.category, region: job.region ?? null,
        variant: job.variant ?? null, state: job.state ?? null, regionTier: job.entry.regionTier,
        footprint: job.entry.footprint, tiles: job.entry.tiles, triangles,
      });
    } catch (error) {
      failures.push({ file: job.file, error: String(error) });
      say(`ไม่สำเร็จ: ${job.name} (${String(error)})`);
    }
    step(index + 1, jobs.length);
  }
  const textures = await postJson<{ copied: number; missing: string[]; bytes: number }>(
    `/__art/textures?run=${encodeURIComponent(run)}`, [...standIns.files].sort().concat('assets/CREDITS.md'));
  for (const file of textures.missing) say(`ไม่พบไฟล์ ${file}`);
  await upload(run, 'manifest.json', JSON.stringify({
    version: 1, run, commit, created: new Date().toISOString(), three: REVISION, tileMeters: TILE_M, regional,
    models, failures, textures: [...standIns.files].sort(), generated: [...generated].sort(),
    dropped: [...standIns.dropped].sort(),
  }, null, 1));
  for (const slot of standIns.dropped) say(`ข้าม texture ที่ไม่มีภาพ: ${slot}`);
  await upload(run, 'README.md', readme(run, commit, models.length));
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  say(`เสร็จ: ${models.length} โมเดล (${mb(bytes)} MB) texture ${textures.copied} ไฟล์ (${mb(textures.bytes)} MB)`
    + `${failures.length ? ` ไม่สำเร็จ ${failures.length}` : ''}`);
  say(`อยู่ที่ ${dir}`);
  say('สร้างไฟล์ Blender: npm run art:blend');
}

function install(): void {
  const regional = element<HTMLInputElement>('regional');
  const start = element<HTMLButtonElement>('start');
  const count = element('count');
  const progress = element<HTMLProgressElement>('progress');
  const log = element('log');
  const say = (text: string) => {
    const line = document.createElement('li');
    line.textContent = text;
    log.appendChild(line);
  };
  const showCount = () => {
    const jobs = exportJobs(regional.checked);
    count.textContent = `${jobs.length} ไฟล์ จาก ${new Set(jobs.map((job) => job.id)).size} โมเดล`;
  };
  regional.addEventListener('change', showCount);
  showCount();
  void fetch('/__art/info').then((response) => response.json()).then((info: { archive: string }) => {
    element('archive').textContent = info.archive;
  }).catch(() => { element('archive').textContent = 'ต่อ dev server ไม่ได้ (npm run dev)'; });
  start.addEventListener('click', () => {
    start.disabled = regional.disabled = true;
    log.replaceChildren();
    progress.value = 0;
    void runExport(regional.checked, say, (done, all) => {
      progress.max = all;
      progress.value = done;
    }).catch((error) => say(`หยุด: ${String(error)}`)).finally(() => {
      start.disabled = regional.disabled = false;
    });
  });
}

if (typeof document !== 'undefined' && document.getElementById('artExport')) install();
