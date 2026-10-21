/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// era-buildings.html: every era building (art/buildings, assets/models/buildings) by era and region, the whole set
// in rows or one at a time to orbit, by day or by night, drawn with the city's own material (eraBuildingMaterial).
// The frontage kinds (frontage.ts: shophouse bays and the 12 m house) show alone, or as the city stands them: a terrace
// of bays side by side (left end, middles taking turns, right end) beside the bay that stands alone.

import {
  AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight, Group, Mesh, PerspectiveCamera, PlaneGeometry,
  MeshStandardMaterial, SRGBColorSpace, Scene, Vector3, WebGLRenderer, Box3, ACESFilmicToneMapping, Color,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { DRACO_DECODER_PATH, ERA_BUILDINGS_BASE, ERA_KINDS, FRONTAGE_KINDS, eraKindFor, loadEraIndex, serializeEraScene } from '../city/eraBuildings.js';
import { FENCED_BY_YARD, PLANT_YARDS } from '../city/plantYards.js';
import { registry } from '../models/registry.js';
import { createPlantYard, holeState, YARD_KINDS, YARD_MAIN_SHARE, YARD_TILE_METRES, YARD_TILES, type YardKind } from '../models/services/plant-yard.js';
import { RAMPS } from '../../theme/tokens.js';
import { eraBuildingMaterial, setNightMode } from '../materials/library.js';
import { SCENE } from '../../theme/tokens.js';

const NAMES: Record<string, [string, string]> = {
  home_1: ['บ้าน ระดับ 1', 'Home, level 1'], home_2: ['บ้าน ระดับ 2', 'Home, level 2'], home_3: ['บ้าน ระดับ 3', 'Home, level 3'],
  home_4: ['บ้าน ระดับ 4', 'Home, level 4'], home_5: ['บ้าน ระดับ 5 (2×2)', 'Home, level 5 (2×2)'],
  shop_1: ['ร้าน ระดับ 1', 'Shop, level 1'], shop_2: ['ร้าน ระดับ 2', 'Shop, level 2'], shop_3: ['ร้าน ระดับ 3', 'Shop, level 3'],
  shop_4: ['ร้าน ระดับ 4', 'Shop, level 4'], shop_5: ['ร้าน ระดับ 5 (2×2)', 'Shop, level 5 (2×2)'],
  factory_1: ['โรงงาน ระดับ 1', 'Factory, level 1'], factory_2: ['โรงงาน ระดับ 2', 'Factory, level 2'],
  factory_3: ['โรงงาน ระดับ 3', 'Factory, level 3'], factory_4: ['โรงงาน ระดับ 4 (2×2)', 'Factory, level 4 (2×2)'],
  ruler_house: ['จวนเจ้าเมือง', 'Ruler’s house'], school: ['โรงเรียน', 'School'], hospital: ['โรงพยาบาล', 'Hospital'],
  police: ['สถานีตำรวจ', 'Police'], fire: ['ดับเพลิง', 'Fire'], water_works: ['ประปา', 'Water works'],
  power_plant: ['โรงไฟฟ้า', 'Power plant'], waste: ['จัดการขยะ', 'Waste'], station: ['สถานี', 'Station'],
  market: ['ตลาด', 'Market'],
  terrace1: ['ตึกแถว (แถวเตี้ย) ต่อกัน', 'Terrace, lower row'], terrace2: ['ตึกแถว (แถวสูง) ต่อกัน', 'Terrace, taller row'],
  house12_1: ['บ้านหน้ากว้าง 12 ม. ระดับต้น', '12 m house, lower levels'],
  house12_2: ['บ้านหน้ากว้าง 12 ม. ระดับสูง', '12 m house, higher levels'],
};
const PLACE_NAMES: Record<string, [string, string]> = {
  one: ['คูหาเดียว', 'alone'], left: ['ห้องหัว ซ้าย', 'left end'], mid: ['ห้องกลาง', 'middle'],
  mid2: ['ห้องกลาง แบบ 2', 'middle (2)'], right: ['ห้องท้าย ขวา', 'right end'],
};
for (const kind of FRONTAGE_KINDS) {
  const m = /^bay(\d)_(\w+)$/.exec(kind);
  if (m) NAMES[kind] = [`ตึกแถว${m[1] === '1' ? 'เตี้ย' : 'สูง'} ${PLACE_NAMES[m[2]][0]}`, `Shophouse bay (${m[1] === '1' ? 'lower' : 'taller'} row), ${PLACE_NAMES[m[2]][1]}`];
}
/** A terrace as the city stands one (frontage.ts): left end, the two middles in turn, right end, and the bay alone */
const TERRACE = ['left', 'mid', 'mid2', 'mid', 'mid2', 'right'];
const terraceOf = (row: string): string[] => [...TERRACE.map(p => `bay${row}_${p}`), `bay${row}_one`];
/** The plant yards (models/services/plant-yard.ts): each plant as the city draws it on its block, with or without its yard */
const YARD_NAMES: Record<YardKind, [string, string]> = {
  coal: ['โรงไฟฟ้าลิกไนต์', 'Lignite plant'], gas: ['โรงไฟฟ้าก๊าซ', 'Gas plant'], solar: ['โซลาร์ฟาร์ม', 'Solar farm'],
  wind: ['ฟาร์มกังหันลม', 'Wind farm'], hydro: ['เขื่อนพลังน้ำ', 'Dam'], nuclear: ['โรงไฟฟ้านิวเคลียร์', 'Nuclear plant'],
  water: ['ประปา', 'Water works'], waste_power: ['โรงไฟฟ้าจากขยะ', 'Waste power plant'],
};
NAMES.yards = ['ลานโรงไฟฟ้าและประปา ทั้งหมด', 'Every plant yard'];
for (const kind of YARD_KINDS) NAMES[`yard_${kind}`] = YARD_NAMES[kind];
const PLANT_OF = Object.fromEntries(Object.entries(PLANT_YARDS).map(([id, kind]) => [kind, id])) as Record<YardKind, string>;
const GROUPS: [string, string, string][] = [['home', 'บ้าน', 'Homes'], ['shop', 'ร้านค้า', 'Shops'],
  ['frontage', 'ตามหน้ากว้างที่ทา (ช่อง 4 ม.)', 'By painted frontage (4 m cells)'],
  ['factory', 'โรงงาน', 'Factories'], ['service', 'บริการเมือง', 'Services'],
  ['yard', 'ลานโรงไฟฟ้าและประปา (บล็อกเต็ม)', 'Plant yards (the whole block)']];

function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
let thai = true;

function translate(): void {
  document.documentElement.lang = thai ? 'th' : 'en';
  document.querySelectorAll<HTMLElement>('[data-th]').forEach(node => { node.textContent = thai ? node.dataset.th! : node.dataset.en!; });
}

async function start(): Promise<void> {
  const stage = el<HTMLDivElement>('stage');
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  stage.prepend(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color(SCENE.sky.haze);
  const camera = new PerspectiveCamera(35, 1, 0.5, 4000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  const sun = new DirectionalLight(SCENE.light.sun, 2.4);
  sun.position.set(-120, 220, 160); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, far: 900 });
  const ambient = new AmbientLight(SCENE.light.ambient, 1.1);
  scene.add(sun, ambient);
  const ground = new Mesh(new PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
    new MeshStandardMaterial({ color: SCENE.palette.sky.shade, roughness: 1 }));
  ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
  const shown = new Group(); scene.add(shown);

  const draco = new DRACOLoader(); draco.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const index = await loadEraIndex();
  const readout = el<HTMLParagraphElement>('readout');
  if (!index) { readout.textContent = 'assets/models/buildings/index.json ?'; return; }
  const cache = new Map<string, Promise<Group>>();

  function model(era: string, region: string, kind: string): Promise<Group> {
    const key = `${era}/${region}/${kind}`;
    let found = cache.get(key);
    if (!found) {
      found = loader.loadAsync(`${ERA_BUILDINGS_BASE}era${era}/${region}/${kind}.glb`).then(gltf => {
        const proto = serializeEraScene(key, gltf.scene), group = new Group();
        for (const part of proto.parts) {
          const geometry = new BufferGeometry();
          for (const [name, a] of Object.entries(part.attributes)) geometry.setAttribute(name, new BufferAttribute(a.array, a.size));
          if (part.index) geometry.setIndex(new BufferAttribute(part.index, 1));
          const mesh = new Mesh(geometry, eraBuildingMaterial(part.material.data.eraBuilding === 'windows'));
          mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
        }
        return group;
      });
      cache.set(key, found);
    }
    return found.then(group => group.clone());
  }

  function frame(): void {
    const box = new Box3().setFromObject(shown), centre = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
    const reach = Math.max(size.x, size.z, size.y * 1.4, 12);
    controls.target.copy(centre);
    camera.position.copy(centre).add(new Vector3(-0.75, 0.62, 0.95).normalize().multiplyScalar(reach * 1.5));
    camera.near = reach / 200; camera.far = reach * 20; camera.updateProjectionMatrix();
  }

  /**
   * A plant as the city draws it against its road (tileModels.ts, plantYards.ts): its building, an era model when its
   * era has one, else its procedural model at the share of its tiles the city draws it, its front at its block's front
   * (+Z), on its block's ground, and its yard round it; in metres
   */
  async function plantBlock(kind: YardKind, era: number, region: string, yard: boolean): Promise<Group> {
    const out = new Group(), tiles = YARD_TILES[kind], half = tiles * YARD_TILE_METRES / 2, plant = PLANT_OF[kind];
    const ground = new Mesh(new PlaneGeometry(2 * half, 2 * half).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: RAMPS.sand[300], roughness: 1 }));
    ground.position.y = 0.01; ground.receiveShadow = true; out.add(ground);
    const eraKind = eraKindFor(plant, undefined, era), have = eraKind ? index!.buildings[`era${era}`]?.[region]?.[eraKind] : undefined;
    let main: Group, hw: number;
    if (eraKind && have) {
      main = await model(String(era), region, eraKind);
      hw = index!.kinds[eraKind].tiles * YARD_TILE_METRES / 2 - 0.5;
    } else {
      const share = YARD_MAIN_SHARE[kind];
      main = registry[plant].factory({ region: region as never, seed: 1, state: yard && FENCED_BY_YARD.has(plant) ? 'yard' : 'closed' });
      main.scale.setScalar(share);
      hw = (tiles * 5 - 0.5) * share;
    }
    const c = half - hw;
    main.position.z = c; out.add(main);
    if (yard) {
      const root = createPlantYard(kind, { variant: era, state: holeState({ hw, c }) });
      root.scale.setScalar(YARD_TILE_METRES / 10);
      root.traverse(o => { if ((o as Mesh).isMesh) { (o as Mesh).castShadow = true; (o as Mesh).receiveShadow = true; } });
      out.add(root);
    }
    return out;
  }

  let token = 0, current = 'all';
  async function show(kind: string): Promise<void> {
    current = kind;
    const mine = ++token, era = el<HTMLSelectElement>('era').value, region = el<HTMLSelectElement>('region').value;
    document.querySelectorAll<HTMLButtonElement>('nav button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    if (kind === 'yards' || kind.startsWith('yard_')) {
      readout.textContent = thai ? 'กำลังโหลด…' : 'Loading…';
      const kinds = kind === 'yards' ? [...YARD_KINDS] : [kind.slice(5) as YardKind], yard = el<HTMLSelectElement>('yard').value === 'on';
      const blocks = await Promise.all(kinds.map(k => plantBlock(k, Number(era), region, yard)));
      if (mine !== token) return;
      shown.clear();
      blocks.forEach((g, i) => { g.position.set((i % 4) * 80, 0, Math.floor(i / 4) * 80); shown.add(g); });
      frame();
      readout.textContent = (thai ? NAMES[kind][0] : NAMES[kind][1]) + (thai ? ` · ยุค ${era} · บล็อก ${YARD_TILES[kinds[0]]} × ${YARD_TILES[kinds[0]]} ช่อง`
        : ` · era ${era} · a ${YARD_TILES[kinds[0]]} × ${YARD_TILES[kinds[0]]} block`) + (yard ? '' : thai ? ' · ไม่มีลาน' : ' · without its yard');
      return;
    }
    const have = index!.buildings[`era${era}`]?.[region] ?? {};
    const frontage = Boolean(have.bay1_one);
    const terrace = /^terrace(\d)$/.exec(kind);
    const kinds = kind === 'all' ? [...ERA_KINDS, ...(frontage ? [...terraceOf('1'), ...terraceOf('2'), 'house12_1', 'house12_2'] : [])]
      : terrace ? terraceOf(terrace[1]) : [kind];
    readout.textContent = thai ? 'กำลังโหลด…' : 'Loading…';
    const groups = await Promise.all(kinds.map(k => have[k] ? model(era, region, k) : Promise.resolve(new Group())));
    if (mine !== token) return;
    shown.clear();
    const cursor: Record<number, number> = {};
    kinds.forEach((k, i) => {
      const g = groups[i], tiles = index!.kinds[k]?.tiles ?? 1, size = index!.kinds[k]?.width ?? tiles * 16;
      const front = (FRONTAGE_KINDS as readonly string[]).includes(k);
      if (kind === 'all' || terrace) {
        // the frontage kinds in rows of their own in front of the set, each terrace's bays flush side by side
        const row = front ? (k.startsWith('bay1') ? 4 : k.startsWith('bay2') ? 5 : 6) : k.startsWith('home') ? 0 : k.startsWith('shop') ? 1 : k.startsWith('factory') ? 2 : 3;
        const x = cursor[row] ?? 0, alone = k.endsWith('_one');
        const gap = alone ? 4 : 0;
        g.position.set(x + gap + size / 2, 0, row < 3 ? row * 40 : row === 3 ? 0 : terrace ? 0 : 60 + (row - 4) * 24);
        if (row === 3) { const n = ERA_KINDS.indexOf(k as typeof ERA_KINDS[number]) - 14; g.position.set(260 + (n % 5) * 54, 0, Math.floor(n / 5) * 54); }
        if (row === 6) g.position.x = (cursor[6] ?? 0) + size / 2;
        cursor[row] = x + gap + size + (front && !alone ? 0 : 5);
      }
      shown.add(g);
    });
    frame();
    const entry = kind === 'all' || terrace ? null : have[kind];
    const width = index!.kinds[kind]?.width;
    readout.textContent = entry ? `${thai ? NAMES[kind][0] : NAMES[kind][1]} · ${entry.height} ${thai ? 'ม.' : 'm'}${width ? ` · ${thai ? 'หน้ากว้าง' : 'frontage'} ${width} ${thai ? 'ม.' : 'm'}` : ''} · ${entry.triangles.toLocaleString()} ${thai ? 'สามเหลี่ยม' : 'triangles'}`
      : terrace ? (thai ? NAMES[kind][0] : NAMES[kind][1]) + (frontage ? '' : thai ? ' · ยังไม่มีในยุคและภาคนี้' : ' · not built for this era and region yet')
      : (thai ? `${frontage ? 36 : 24} แบบของยุคและภาคนี้` : `All ${frontage ? 36 : 24} of this era and region`);
  }

  const nav = el<HTMLElement>('kinds');
  const all = document.createElement('button');
  all.dataset.kind = 'all'; all.dataset.th = 'ทั้งชุด'; all.dataset.en = 'Whole set'; all.addEventListener('click', () => show('all'));
  nav.append(all);
  for (const [prefix, th, en] of GROUPS) {
    const h = document.createElement('h2'); h.dataset.th = th; h.dataset.en = en; nav.append(h);
    if (prefix === 'yard') {
      for (const kind of ['yards', ...YARD_KINDS.map(k => `yard_${k}`)]) {
        const b = document.createElement('button');
        b.dataset.kind = kind; b.dataset.th = NAMES[kind][0]; b.dataset.en = NAMES[kind][1];
        b.addEventListener('click', () => show(kind));
        nav.append(b);
      }
      continue;
    }
    if (prefix === 'frontage') {
      for (const kind of ['terrace1', 'terrace2', ...FRONTAGE_KINDS]) {
        const b = document.createElement('button');
        b.dataset.kind = kind; b.dataset.th = NAMES[kind][0]; b.dataset.en = NAMES[kind][1];
        b.addEventListener('click', () => show(kind));
        nav.append(b);
      }
      continue;
    }
    for (const kind of ERA_KINDS) {
      const service = !/^(home|shop|factory)_/.test(kind);
      if (prefix === 'service' ? !service : !kind.startsWith(prefix)) continue;
      const b = document.createElement('button');
      b.dataset.kind = kind; b.dataset.th = NAMES[kind][0]; b.dataset.en = NAMES[kind][1];
      b.addEventListener('click', () => show(kind));
      nav.append(b);
    }
  }
  const params = new URLSearchParams(location.search);
  if (params.get('era')) el<HTMLSelectElement>('era').value = params.get('era')!;
  if (params.get('region')) el<HTMLSelectElement>('region').value = params.get('region')!;
  el('era').addEventListener('change', () => show(current));
  el('region').addEventListener('change', () => show(current));
  el('yard').addEventListener('change', () => show(current));
  el('time').addEventListener('change', () => {
    const night = el<HTMLSelectElement>('time').value === 'night';
    setNightMode(night);
    sun.intensity = night ? 0.15 : 2.4; ambient.intensity = night ? 0.25 : 1.1;
    scene.background = new Color(night ? SCENE.outline.colour : SCENE.sky.haze);
  });
  el('language').addEventListener('change', () => { thai = el<HTMLSelectElement>('language').value === 'th'; translate(); show(current); });
  translate();

  function resize(): void {
    const w = stage.clientWidth, h = Math.max(480, stage.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  await show(params.get('kind') ?? 'all');
}

void start();
