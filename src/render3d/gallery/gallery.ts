/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  ACESFilmicToneMapping, BackSide, BoxGeometry, BufferGeometry, Color, DirectionalLight,
  Fog, GridHelper, Group, HemisphereLight, LineBasicMaterial, LineLoop, Mesh,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial,
  SphereGeometry, SRGBColorSpace, Texture, Vector3, WebGLRenderer, PMREMGenerator,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { TILE_M, WATER_Y } from '../constants.js';
import { getMaterial, getPreviewGround, MATERIAL_KEYS, MaterialKey, materialTextureStatus, setNightMode, SHOPHOUSE_PASTELS, updateRoadSignals, updateCommercialDisplays, whenMaterialReady } from '../materials/library.js';
import { DAY_SKY_URL, TEXTURE_CATALOG } from '../materials/catalog.js';
import { FICTIONAL_THAI_SIGNS, thaiSign } from '../materials/signs.js';
import { ModelFactory, ModelOptions, ModelRegistration, registry } from '../models/registry.js';
import type { RegionId } from '../regional/types.js';
import { applyWorldUV, countDrawCalls, countTriangles, disposeModel, visibleBounds } from '../util/geometry.js';
import { scrollWaterNormals } from '../util/water-animation.js';
import { terrainNeighbors } from './terrain-neighbors.js';
import { roadNeighbors } from './road-neighbors.js';
import { railNeighbors } from './rail-neighbors.js';
import { powerNeighbors } from './power-neighbors.js';
import { CABLE_PREVIEW, CABLE_PREVIEW_ID, disposeCableBridgePreview } from './cable-bridge-preview.js';
import { ELEVATED_PREVIEWS } from './elevated-preview.js';
import { getRegionKit, REGIONS } from '../regional/index.js';
import { regionalSamples, regionLineup } from './regional-preview.js';
import { buildIconGallery } from './icons.js';
import { animateCommercialModels } from '../models/commercial/landmarks.js';
import { CityView3D, createCityView3D } from '../city/index.js';
import { TestCity, testCitySetup, testCitySprites, moveTestSprites } from '../city/test-city.js';
import type { ToolHover } from '../../cityView.js';

const modelNeighbors = (id: string, options: ModelOptions): Group => id.startsWith('road.')
  ? roadNeighbors(id, options) : id.startsWith('rail.') ? railNeighbors(id, options)
    : id.startsWith('power.') ? powerNeighbors(id, options) : terrainNeighbors(id, options);

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing gallery element: ${id}`);
  return found as T;
}

let language: 'th' | 'en' = 'th';
const words = (thai: string, english: string): string => language === 'th' ? thai : english;
const englishName = (id: string): string => id.replace(/_/g, ' ');
function localText(node: HTMLElement, thai: string, english: string): void {
  node.dataset.th = thai; node.dataset.en = english; node.textContent = words(thai, english);
}
function translatePage(): void {
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>('[data-th]').forEach(node => { node.textContent = words(node.dataset.th!, node.dataset.en!); });
  document.querySelectorAll<HTMLElement>('[data-th-aria]').forEach(node => { node.setAttribute('aria-label', words(node.dataset.thAria!, node.dataset.enAria!)); });
  document.title = `PhaiCity — ${words('แกลเลอรีโมเดล', 'Model Gallery')}`;
}

interface View {
  id: string;
  kind: 'model' | 'assembly' | 'material' | 'sign' | 'kit' | 'lineup';
  entry: ModelRegistration;
  scene: Scene;
  camera: PerspectiveCamera;
  root: Group;
  neighbors: Group;
  region: HTMLElement;
  sun: DirectionalLight;
  ambient: HemisphereLight;
  grid: GridHelper;
  outline: LineLoop;
  metrics?: HTMLElement;
}

const isModelView = (view: Pick<View, 'kind'>): boolean => ['model', 'assembly', 'kit', 'lineup'].includes(view.kind);
const freeRoot = (view: View): void => view.id === CABLE_PREVIEW_ID ? disposeCableBridgePreview(view.root) : disposeModel(view.root);

function startGallery(): void {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.domElement.className = 'render-surface';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  document.body.append(renderer.domElement);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.autoClear = false;

  const category = element<HTMLSelectElement>('category');
  const regionPicker = element<HTMLSelectElement>('region');
  const languagePicker = element<HTMLSelectElement>('language');
  const seed = element<HTMLInputElement>('seed');
  const variant = element<HTMLInputElement>('variant');
  const state = element<HTMLInputElement>('state');
  const landMask = element<HTMLInputElement>('land-mask');
  const waterMask = element<HTMLInputElement>('water-mask');
  const bankStyle = element<HTMLSelectElement>('bank-style');
  const neighborToggle = element<HTMLInputElement>('neighbors');
  const sunAngle = element<HTMLInputElement>('sun-angle');
  const night = element<HTMLInputElement>('night');
  const gridToggle = element<HTMLInputElement>('grid');
  const footprintToggle = element<HTMLInputElement>('footprint');
  const cards = element('cards');
  const stage = element('stage');
  const views: View[] = [];
  let selected: View | undefined;
  let controls: OrbitControls | undefined;
  let frame = 0;
  let width = 0, height = 0;
  const tabs = ['models', 'materials', 'regions', 'city', 'icons'] as const;
  type GalleryTab = typeof tabs[number];
  let activeTab: GalleryTab = 'models';
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const startTab = tabs.find(tab => tab === requestedTab) ?? 'models';
  let cityView: CityView3D | undefined;
  const cityMap = new TestCity(), citySprites = testCitySprites();
  let cityHover: ToolHover | null = null, cityPaused = false, citySeconds = 0, cityLast = performance.now(), cityReadout = 0;
  let cityMotion: {start:number;last:number;started:boolean;swaps:number;dirt:number;ratios:number;cpu:number[];intervals:number[]} | undefined;
  function buildCity(): void {
    cityMotion=undefined;element<HTMLButtonElement>('city-motion').disabled=false;element('city-motion-metrics').textContent='';
    cityView?.dispose();cityView=createCityView3D(testCitySetup(element('city-stage'),regionPicker.value as RegionId,cityMap));
    cityLast=performance.now();
  }
  let environment: Texture | undefined;
  let gallerySkyStarted = false;
  let environmentTarget: ReturnType<PMREMGenerator['fromEquirectangular']> | undefined;
  let disposed = false;
  let rebuildTimer: number | undefined;

  // Shared backdrop: a clear blue zenith fading into humid, pale horizon haze.
  const skyGeometry = new SphereGeometry(1800, 24, 12);
  const skyMaterial = new ShaderMaterial({
    side: BackSide, depthWrite: false,
    uniforms: { top: { value: new Color(0x7fbae0) }, horizon: { value: new Color(0xdce6da) } },
    vertexShader: `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 skyDirection;
      void main() {
        float h = pow(max(normalize(skyDirection).y, 0.0), 0.45);
        gl_FragColor = vec4(mix(horizon, top, h), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const groundPlane = new PlaneGeometry(3500, 3500);
  const groundGeometry = applyWorldUV(groundPlane, 1);
  groundPlane.dispose();
  const groundMaterial = getPreviewGround();
  const outlineMaterial = new LineBasicMaterial({ color: 0x246f56, depthTest: false });

  function options(): ModelOptions {
    const seedValue = Number(seed.value), variantValue = Number(variant.value);
    return {
      seed: Number.isFinite(seedValue) ? Math.trunc(seedValue) >>> 0 : 1,
      variant: Number.isFinite(variantValue) ? Math.max(0, Math.min(15, Math.trunc(variantValue))) : 0,
      state: state.value.trim() || undefined,
      region: regionPicker.value as RegionId,
      landMask: Number(landMask.value) & 15,
      waterMask: Number(waterMask.value) & 15,
      bankStyle: bankStyle.value === 'auto' ? undefined : bankStyle.value as ModelOptions['bankStyle'],
    };
  }

  function frameModel(view: View): void {
    const bounds = visibleBounds(view.root);
    if (view.neighbors.children.length) bounds.union(visibleBounds(view.neighbors));
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    if (bounds.isEmpty()) { size.set(10, 10, 10); center.set(0, 5, 0); }
    const rect = view.region.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
    const halfVerticalFov = view.camera.fov * Math.PI / 360;
    const halfFov = Math.min(halfVerticalFov, Math.atan(Math.tan(halfVerticalFov) * aspect));
    let distance = Math.max(size.length() / 2, isModelView(view) ? TILE_M / 2 : 1) / Math.sin(halfFov) * 1.12;
    const direction = new Vector3(0.65, 0.85, 0.85).normalize();
    if (view.kind === 'assembly' || view.kind === 'lineup' || ['veh.train_hsr', 'veh.metro'].includes(view.id)) {
      // Fit the long span in screen space, with a broadside view of both cable fans.
      direction.set(1, 0.7, 0.25).normalize();
      if (view.kind === 'lineup') direction.set(0.08, 0.85, 1).normalize();
      const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
      const up = new Vector3().crossVectors(direction, right);
      distance = 0;
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const corner = new Vector3(x * size.x / 2, y * size.y / 2, z * size.z / 2);
        distance = Math.max(distance, corner.dot(direction) + Math.max(
          Math.abs(corner.dot(right)) / (Math.tan(halfVerticalFov) * aspect),
          Math.abs(corner.dot(up)) / Math.tan(halfVerticalFov)));
      }
      distance *= 1.12;
    }
    view.camera.position.copy(center).add(direction.multiplyScalar(distance));
    view.camera.lookAt(center);
    if (selected === view && controls) {
      controls.target.copy(center);
      controls.minDistance = Math.max(size.length() * 0.2, 2);
      controls.maxDistance = distance * 6;
      controls.update();
    }
  }

  function updateMetrics(view: View): void {
    const triangles = countTriangles(view.root), calls = countDrawCalls(view.root) + (view.id === CABLE_PREVIEW_ID ? 1 : 0);
    if (view.metrics) localText(view.metrics, `${view.entry.category} · ${triangles.toLocaleString()} สามเหลี่ยม · ${calls} draw calls`, `${view.entry.category} · ${triangles.toLocaleString()} triangles · ${calls} draw calls`);
    if (selected === view) {
      element('detail-id').textContent = view.id;
      element('detail-category').textContent = view.kind === 'assembly' ? view.id === CABLE_PREVIEW_ID
        ? words('สะพานขึง · 21 ช่อง · สายขึง 40 เส้น', 'Cable bridge · 21 tiles · 40 stays')
        : words('ทางลาด 3 ช่อง + รางยกระดับ 1 ช่อง', '3 ramp tiles + 1 level viaduct tile')
        : view.kind === 'lineup' ? words('เหนือ · อีสาน · กลาง · ตะวันออก · ตะวันตก · ใต้', 'North · Northeast · Central · East · West · South')
          : view.kind === 'kit' ? words('ชิ้นส่วนชุดภาค', 'Regional kit component')
            : view.kind === 'model' ? `${view.entry.category} · ${view.entry.regionTier} · ${regionPicker.selectedOptions[0].textContent}` : view.kind === 'material' ? words('วัสดุ PBR · 1K', 'PBR material · 1K') : words('ป้ายภาษาไทย · Sarabun', 'Thai sign · Sarabun');
      element('detail-triangles').textContent = triangles.toLocaleString();
      if (view.kind === 'model' && view.root.userData.variantLabel) element('detail-category').textContent +=
        ` · ${words(view.root.userData.variantLabel, view.root.userData.variantLabelEn)} · ${view.root.userData.floors} ${words('ชั้น', 'floors')}`;
      element('detail-calls').textContent = String(calls);
      element('detail-footprint').textContent = isModelView(view) ? `${view.entry.footprint.join(' × ')} ${words('ช่อง', 'tiles')}` : words('ตัวอย่างผิว', 'Surface sample');
      element('detail-budget').textContent = view.kind === 'model' ? view.entry.budget.toLocaleString() : '—';
      element('assembly-note').hidden = view.id !== CABLE_PREVIEW_ID;
      element('six-regions').hidden = view.kind !== 'model' || view.entry.regionTier === 'R3';
    }
  }

  function updateLighting(): void {
    setNightMode(night.checked);
    document.body.dataset.night = String(night.checked);
    const elevation = Number(sunAngle.value) * Math.PI / 180;
    element('sun-value').textContent = `${sunAngle.value}°`;
    const top = night.checked ? 0x10253c : 0x7fbae0;
    const horizon = night.checked ? 0x273c49 : 0xdce6da;
    skyMaterial.uniforms.top.value.setHex(top);
    skyMaterial.uniforms.horizon.value.setHex(horizon);
    views.forEach(view => {
      view.scene.fog = new Fog(horizon, view.kind === 'assembly' ? 400 : 180, 1400);
      view.sun.color.setHex(night.checked ? 0xb0c7e6 : 0xffe3b0);
      view.sun.intensity = night.checked ? 0.35 : 3.4;
      view.ambient.intensity = night.checked ? 0.3 : 1.25;
      view.scene.environment = night.checked ? null : environment ?? null;
      view.scene.environmentIntensity = 0.65;
      view.sun.position.set(-Math.cos(elevation) * 180 * 0.8, Math.sin(elevation) * 180, Math.cos(elevation) * 180 * 0.6);
      view.grid.visible = gridToggle.checked && isModelView(view);
      view.outline.visible = footprintToggle.checked && isModelView(view);
    });
  }

  function createView(id: string, entry: ModelRegistration, region: HTMLElement, metrics?: HTMLElement, kind: View['kind'] = 'model'): View {
    const scene = new Scene();
    const root = entry.factory(options());
    const neighbors = kind === 'model' && region === stage && neighborToggle.checked
      ? modelNeighbors(id, options()) : new Group();
    scene.add(neighbors);
    scene.add(root, new Mesh(skyGeometry, skyMaterial));
    const waterside = entry.ground === 'shore' || entry.ground === 'water' || entry.ground === 'bridge';
    const terrainWater = waterside && id.startsWith('terrain.');
    const ground = new Mesh(groundGeometry, waterside && !terrainWater ? getMaterial('water_river') : groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = terrainWater ? -3.015 : waterside ? WATER_Y - 0.015 : -0.015;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new GridHelper(400, 400 / TILE_M, 0x657c74, 0x9ba89a);
    grid.position.y = 0.005;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);
    const w = entry.footprint[0] * TILE_M / 2, d = entry.footprint[1] * TILE_M / 2;
    const outline = new LineLoop(new BufferGeometry().setFromPoints([
      new Vector3(-w, 0.03, -d), new Vector3(w, 0.03, -d),
      new Vector3(w, 0.03, d), new Vector3(-w, 0.03, d),
    ]), outlineMaterial);
    scene.add(outline);
    const sun = new DirectionalLight(0xffe3b0, 3.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const extent = Math.max(w, d, 25) * 1.5;
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 0.5, far: 500 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.025;
    const ambient = new HemisphereLight(0xc6e6ff, 0x9a805c, 1.25);
    scene.add(sun, sun.target, ambient);
    const camera = new PerspectiveCamera(38, 1, 0.1, 4000);
    const view = { id, kind, entry, scene, root, neighbors, region, camera, sun, ambient, grid, outline, metrics };
    views.push(view);
    frameModel(view);
    updateMetrics(view);
    return view;
  }

  function freeView(view: View): void {
    freeRoot(view);
    disposeModel(view.neighbors);
    view.grid.geometry.dispose();
    view.grid.material.dispose();
    view.outline.geometry.dispose();
    view.sun.shadow.dispose();
  }

  function showLibrary(refresh = true): void {
    controls?.dispose();
    controls = undefined;
    if (selected) {
      freeView(selected);
      views.splice(views.indexOf(selected), 1);
      selected = undefined;
    }
    element('detail').hidden = true;
    element('library').hidden = activeTab !== 'models';
    element('materials').hidden = activeTab !== 'materials';
    element('regions').hidden = activeTab !== 'regions';
    element('city').hidden = activeTab !== 'city';
    element('icons').hidden = activeTab !== 'icons';
    if (refresh && activeTab !== 'materials') rebuildModels();
    updateStateChoices();
  }

  function showModel(view: Pick<View, 'id' | 'entry' | 'kind'>): void {
    if (selected) { controls?.dispose(); freeView(selected); views.splice(views.indexOf(selected), 1); selected = undefined; }
    if (view.entry.states?.length && !view.entry.states.includes(state.value)) state.value = view.entry.states[0];
    element('library').hidden = true;
    element('materials').hidden = true;
    element('regions').hidden = true;
    element('detail').hidden = false;
    selected = createView(view.id, view.entry, stage, undefined, view.kind);
    controls = new OrbitControls(selected.camera, stage);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    frameModel(selected);
    updateMetrics(selected);
    updateStateChoices();
    updateLighting();
  }

  function updateStateChoices(): void {
    const states = new Set(views.filter(view => !selected || view === selected).flatMap(view => view.entry.states ?? []));
    element('states').replaceChildren(...Array.from(states, name => {
      const option = document.createElement('option');
      option.value = name;
      return option;
    }));
  }

  function buildLibrary(): void {
    showLibrary(false);
    views.forEach(freeView);
    views.length = 0;
    cards.replaceChildren();
    element('material-cards').replaceChildren();
    element('sign-cards').replaceChildren();
    element('region-houses').replaceChildren();
    element('region-components').replaceChildren();
    cityView?.dispose();cityView=undefined;renderer.domElement.hidden=activeTab==='city'||activeTab==='icons';
    if(activeTab==='icons'){buildIconGallery(element('icon-cards'),localText);return;}
    if(activeTab==='city'){buildCity();return;}
    if (activeTab === 'materials') {
      buildMaterials();
      updateLighting();
      return;
    }
    if (activeTab === 'regions') { buildRegions(); updateLighting(); return; }
    Object.entries(registry).filter(([, entry]) => category.value === 'all' || category.value === entry.category).forEach(([id, entry]) => {
      const card = document.createElement('button');
      card.className = 'model-card';
      card.type = 'button';
      card.dataset.thAria = `ดู ${id}`; card.dataset.enAria = `View ${id}`;
      card.setAttribute('aria-label', words(`ดู ${id}`, `View ${id}`));
      const preview = document.createElement('div');
      preview.className = 'preview';
      const caption = document.createElement('div');
      caption.className = 'caption';
      const title = document.createElement('strong');
      title.textContent = id;
      const metrics = document.createElement('small');
      caption.append(title, metrics);
      card.append(preview, caption);
      cards.append(card);
      const view = createView(id, entry, preview, metrics);
      card.addEventListener('click', () => showModel(view));
    });
    localText(element('model-count'), `${views.length} โมเดล · 1 หน่วย = 1 เมตร`, `${views.length} models · 1 unit = 1 meter`);
    element('empty').hidden = views.length > 0;
    updateStateChoices();
    updateLighting();
  }

  function rebuildModels(): void {
    window.clearTimeout(rebuildTimer); rebuildTimer = undefined;
    const opts = options();
    (selected ? [selected] : views).filter(isModelView).forEach(view => {
      view.scene.remove(view.root);
      freeRoot(view);
      view.root = view.entry.factory(opts);
      view.scene.add(view.root);
      view.scene.remove(view.neighbors); disposeModel(view.neighbors);
      view.neighbors = view.kind === 'model' && selected === view && neighborToggle.checked ? modelNeighbors(view.id, opts) : new Group();
      view.scene.add(view.neighbors);
      frameModel(view);
      updateMetrics(view);
    });
  }

  function queueRebuild(): void {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(rebuildModels, 80);
  }

  function sampleRegistration(factory: ModelFactory): ModelRegistration {
    return { factory, category: 'ui', footprint: [1, 1], tiles: [], budget: 3000, regionTier: 'R3' };
  }

  function materialSample(key: MaterialKey): Group {
    const group = new Group();
    const material = key === 'sign_thai' ? thaiSign(FICTIONAL_THAI_SIGNS[0], '#eee2bd', '#275346', [2, 1]) : getMaterial(key);
    const sphereGeometry = new SphereGeometry(1, 32, 20);
    // Sphere UVs normally cover one full wrap; express both axes in metres.
    const uv = sphereGeometry.getAttribute('uv');
    if (key !== 'sign_thai') for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2, uv.getY(i) * Math.PI);
    const sphere = new Mesh(sphereGeometry, material);
    sphere.position.set(-1.3, 1.05, 0);
    const box = new BoxGeometry(2, 0.12, 2);
    const tileGeometry = applyWorldUV(box, 1); box.dispose();
    const tile = new Mesh(tileGeometry, material);
    tile.position.set(1.3, 0.1, 0);
    if (key === 'sign_thai') {
      // Sign UVs map its whole canvas rather than repeating at metre intervals.
      tile.geometry.dispose(); tile.geometry = new BoxGeometry(2, 0.12, 2);
    }
    [sphere, tile].forEach(mesh => { mesh.castShadow = mesh.receiveShadow = true; });
    group.add(sphere, tile);
    return group;
  }

  function sampleCard(id: string, title: string, factory: ModelFactory, parent: HTMLElement, kind: View['kind'], englishTitle = englishName(id)): HTMLElement {
    const card = document.createElement('article'); card.className = 'material-card';
    const preview = document.createElement('div'); preview.className = 'preview';
    preview.tabIndex = 0; preview.setAttribute('role', 'button'); preview.dataset.thAria = `ดู ${id}`; preview.dataset.enAria = `View ${id}`;
    preview.setAttribute('aria-label', words(`ดู ${id}`, `View ${id}`));
    const caption = document.createElement('div'); caption.className = 'caption';
    const label = document.createElement('strong'); label.className = 'material-label'; localText(label, title, englishTitle);
    const name = document.createElement('small'); name.textContent = id;
    const status = document.createElement('small'); localText(status, 'กำลังโหลด', 'Loading');
    caption.append(label, name, status); card.append(preview, caption); parent.append(card);
    const view = createView(id, sampleRegistration(factory), preview, kind === 'kit' ? status : undefined, kind);
    const open = () => showModel(view);
    preview.addEventListener('click', open);
    preview.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    return status;
  }

  function buildRegions(): void {
    REGIONS.forEach(region => {
      const kit = getRegionKit(region);
      sampleCard(`debug.region_house.${region}`, kit.label, opts => registry['debug.region_house'].factory({ ...opts, region }),
        element('region-houses'), 'kit', kit.labelEn);
    });
    const kit = getRegionKit(options().region);
    localText(element('region-heading'), `${kit.label} · หลังคา / ผนัง / เครื่องประดับ / ของใช้`, `${kit.labelEn} · roofs / walls / ornaments / props`);
    regionalSamples(options()).forEach(sample => sampleCard(sample.id, sample.th, sample.factory, element('region-components'), 'kit', sample.en));
    localText(element('back'), '← ชุดภาคทั้งหมด', '← All region kits');
  }

  function buildMaterials(): void {
    MATERIAL_KEYS.forEach(key => {
      const definition = TEXTURE_CATALOG[key];
      const status = sampleCard(key, definition.label, () => materialSample(key), element('material-cards'), 'material');
      const source = document.createElement('a'); source.href = definition.sources[0];
      localText(source, 'ที่มา CC0 ↗', 'CC0 source ↗'); source.target = '_blank'; source.rel = 'noopener';
      status.parentElement!.append(source);
      void whenMaterialReady(key).then(() => {
        const ready = materialTextureStatus(key) === 'ready';
        localText(status, ready ? 'PBR · 1K · CC0' : 'โหลด texture ไม่สำเร็จ · แสดงสีพื้น', ready ? 'PBR · 1K · CC0' : 'Texture unavailable · flat color fallback');
      });
    });
    element('pastels').replaceChildren(...SHOPHOUSE_PASTELS.map(pastel => {
      const swatch = document.createElement('span'); swatch.className = 'swatch';
      const dot = document.createElement('i'); dot.style.backgroundColor = `#${pastel.color.toString(16).padStart(6, '0')}`;
      const name = document.createElement('span'); localText(name, pastel.label, englishName(pastel.name)); swatch.append(dot, name); return swatch;
    }));
    const signExamples = [
      { id: 'sign.horizontal', title: 'ป้ายหน้าร้าน', english: 'Shop-front sign', text: 'ก๋วยเตี๋ยวบ้านสวน', size: [4, 1] as const, layout: 'horizontal' as const, lit: false },
      { id: 'sign.vertical', title: 'ป้ายแนวตั้ง', english: 'Vertical sign', text: 'ห้อง\nว่าง', size: [1, 3.5] as const, layout: 'vertical' as const, lit: false },
      { id: 'sign.lit', title: 'ป้ายมีแสง', english: 'Lit sign', text: 'ครัวลมเย็น', size: [3.5, 1.2] as const, layout: 'horizontal' as const, lit: true },
    ];
    signExamples.forEach(example => {
      const status = sampleCard(example.id, example.title, () => {
        const root = new Group();
        const mesh = new Mesh(new PlaneGeometry(...example.size), thaiSign(example.text, '#f3e8c7', '#25493e', example.size, example));
        mesh.position.y = example.size[1] / 2 + 0.25;
        mesh.castShadow = true; root.add(mesh); return root;
      }, element('sign-cards'), 'sign', example.english);
      localText(status, example.text + (example.lit ? ' · เปิดกลางคืนเพื่อดูแสง' : ''), example.text + (example.lit ? ' · switch to night to see illumination' : ''));
    });
    localText(element('back'), '← วัสดุทั้งหมด', '← All materials');
  }

  function switchTab(tab: GalleryTab): void {
    activeTab = tab;
    tabs.forEach(name => {
      const button = element(name + '-tab');
      button.setAttribute('aria-selected', String(tab === name)); button.tabIndex = tab === name ? 0 : -1;
    });
    [category, regionPicker, seed, variant, state, landMask, waterMask, bankStyle, neighborToggle, gridToggle, footprintToggle].forEach(input => {
      const show = tab === 'models' || tab === 'city' && input === regionPicker || tab === 'regions' && [regionPicker, seed, gridToggle, footprintToggle].includes(input as typeof regionPicker);
      input.disabled = !show;
      (input.closest('label') as HTMLLabelElement).hidden = !show;
    });
    for(const input of [sunAngle,night]) (input.closest('label') as HTMLLabelElement).hidden=tab==='city'||tab==='icons';
    document.querySelector<HTMLElement>('.toolbar')!.hidden=tab==='icons';
    localText(element('back'), tab === 'models' ? '← โมเดลทั้งหมด' : tab === 'materials' ? '← วัสดุทั้งหมด' : '← ชุดภาคทั้งหมด', tab === 'models' ? '← All models' : tab === 'materials' ? '← All materials' : '← All region kits');
    buildLibrary();
    translatePage();
    if(tab!=='city'&&tab!=='icons')loadGallerySky();
  }

  Array.from(new Set(Object.values(registry).map(entry => entry.category))).sort().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    localText(option, name === 'commercial' ? 'พาณิชย์ (commercial)' : name === 'industrial' ? 'อุตสาหกรรม (industrial)' : name === 'services' ? 'โรงพยาบาลและบริการ (services)' : name === 'residential' ? 'บ้าน (residential)' : name === 'veg' ? 'ต้นไม้ (veg)' : name === 'park' ? 'สวน (park)' : name === 'terrain' ? 'ภูมิประเทศ (terrain)' : name === 'road' ? 'ถนนและสะพาน (road)' : name === 'rail' ? 'ทางรถไฟ (rail)' : name === 'power' ? 'เสาไฟและสายไฟ (power)' : name === 'veh' ? 'ยานพาหนะ (veh)' : name === 'debug' ? 'ตัวอย่าง (debug)' : englishName(name), englishName(name));
    category.append(option);
  });
  category.addEventListener('change', buildLibrary);
  [seed, variant, state, landMask, waterMask, bankStyle].forEach(input => input.addEventListener('change', rebuildModels));
  regionPicker.addEventListener('change', () => activeTab === 'city' ? buildCity() : activeTab === 'regions' ? buildLibrary() : rebuildModels());
  neighborToggle.addEventListener('change', rebuildModels);
  [seed, variant, state, landMask, waterMask].forEach(input => input.addEventListener('input', queueRebuild));
  languagePicker.addEventListener('change', () => {
    language = languagePicker.value === 'en' ? 'en' : 'th';
    translatePage(); views.forEach(updateMetrics);
  });
  [sunAngle, night, gridToggle, footprintToggle].forEach(input => input.addEventListener('input', updateLighting));
  element('back').addEventListener('click', () => showLibrary());
  element('reset-camera').addEventListener('click', () => { if (selected) frameModel(selected); });
  element('models-tab').addEventListener('click', () => switchTab('models'));
  element('materials-tab').addEventListener('click', () => switchTab('materials'));
  element('regions-tab').addEventListener('click', () => switchTab('regions'));
  element('city-tab').addEventListener('click', () => switchTab('city'));
  element('icons-tab').addEventListener('click', () => switchTab('icons'));
  element('city-default').addEventListener('click',()=>cityView?.navigation.reset());
  element('city-motion').addEventListener('click',()=>{
    if(!cityView)return;cityView.navigation.reset();const time=performance.now(),m=cityView.metrics;
    cityMotion={start:time+500,last:time+500,started:false,swaps:m.detailSwaps,dirt:m.dirtSwaps,ratios:m.pixelRatioChanges,cpu:[],intervals:[]};
    localText(element('city-motion-metrics'),'กำลังเตรียมมุมเริ่มต้น…','Preparing the starting view…');
    element<HTMLButtonElement>('city-motion').disabled=true;
  });
  element('city-benchmark').addEventListener('click',()=>{const stage=element('city-stage');stage.style.boxSizing='content-box';stage.style.width='1920px';stage.style.height='1080px';stage.style.maxHeight='none';});
  element('city-whole').addEventListener('click',()=>cityView?.navigation.wholeMap());
  element('city-towers').addEventListener('click',()=>cityView?.centreOn(135,105));
  element('city-pause').addEventListener('click',()=>{cityPaused=!cityPaused;localText(element('city-pause'),cityPaused?'เดินภาพเคลื่อนไหวต่อ':'หยุดภาพเคลื่อนไหว',cityPaused?'Resume animations':'Pause animations');});
  element('city-shot').addEventListener('click',()=>{if(cityView){const image=element<HTMLImageElement>('city-map-shot');image.src=cityView.screenshotMap();image.hidden=false;}});
  element('city-stage').addEventListener('pointermove',event=>{if(!cityView)return;const r=cityView.canvas.getBoundingClientRect(),tile=cityView.tileAt(event.clientX-r.left,event.clientY-r.top);cityHover=tile?{tile,size:3,colour:'lime'}:null;});
  element('city-stage').addEventListener('pointerleave',()=>{cityHover=null;});
  element('six-regions').addEventListener('click', () => {
    if (selected && selected.kind === 'model') showModel({ id: `preview.six_regions.${selected.id}`, entry: regionLineup(selected.entry), kind: 'lineup' });
  });
  element('region-lineup').addEventListener('click', () => showModel({ id: 'preview.six_regions.debug.region_house', entry: regionLineup(registry['debug.region_house']), kind: 'lineup' }));
  element('cable-bridge-preview').addEventListener('click', () => showModel({ id: CABLE_PREVIEW_ID, entry: CABLE_PREVIEW, kind: 'assembly' }));
  for (const style of ['hsr', 'metro']) element(`${style}-ramp-preview`).addEventListener('click', () => {
    const id = `preview.${style}_ramp`; showModel({ id, entry: ELEVATED_PREVIEWS[id], kind: 'assembly' });
  });
  tabs.forEach(name => element(name + '-tab').addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); switchTab(tabs[(tabs.indexOf(activeTab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]); element(activeTab + '-tab').focus();
    }
  }));
  switchTab(startTab);
  localText(element('back'), '← โมเดลทั้งหมด', '← All models');
  localText(element('sky-status'), 'กำลังโหลดแสงท้องฟ้า HDRI 1K', 'Loading 1K daytime HDRI');
  const ariaLabels: readonly [string, string, string][] = [
    ['nav', 'ประเภทตัวอย่าง', 'Sample type'], ['.toolbar', 'ตัวเลือกแสดงโมเดล', 'Model display options'],
    ['#detail', 'ดูโมเดลเดี่ยว', 'Model inspector'], ['#stage', 'โมเดล 3D หมุนและซูมได้', 'Orbitable 3D model'],
    ['#city-stage', 'เมือง 3D', '3D city'],
    ['#sun-angle', 'มุมสูงดวงอาทิตย์', 'Sun elevation'],
  ];
  ariaLabels.forEach(([selector, th, en]) => { const node = document.querySelector<HTMLElement>(selector)!; node.dataset.thAria = th; node.dataset.enAria = en; });
  translatePage();

  // IBL is local and lazy; the gradient sky remains readable at both day and night.
  function loadGallerySky():void {
    if(gallerySkyStarted)return;gallerySkyStarted=true;
    new HDRLoader().load(DAY_SKY_URL, texture => {
    if (disposed) { texture.dispose(); return; }
    const generator = new PMREMGenerator(renderer);
    environmentTarget = generator.fromEquirectangular(texture);
    environment = environmentTarget.texture;
    texture.dispose(); generator.dispose();
    localText(element('sky-status'), 'แสงท้องฟ้า HDRI 1K · Poly Haven · CC0', '1K daytime HDRI · Poly Haven · CC0');
    updateLighting();
    }, undefined, () => { localText(element('sky-status'), 'โหลด HDRI ไม่สำเร็จ · ใช้แสงท้องฟ้าสีพื้น', 'HDRI unavailable · gradient sky fallback'); });
  }
  if(startTab!=='city'&&startTab!=='icons')loadGallerySky();

  // One WebGL context for the entire library; scissor each visible thumbnail or inspector.
  function render(): void {
    frame = requestAnimationFrame(render);
    if(activeTab==='icons')return;
    if(activeTab==='city'&&cityView){
      const time=performance.now(),frameInterval=time-cityLast;if(!cityPaused)citySeconds+=Math.min(.1,frameInterval/1000);cityLast=time;
      if(cityMotion&&!cityMotion.started&&time>=cityMotion.start&&!cityView.metrics.pendingChunks&&!cityView.metrics.pendingModels){
        const run=cityMotion,m=cityView.metrics;run.started=true;run.start=time;run.last=time;run.swaps=m.detailSwaps;run.dirt=m.dirtSwaps;run.ratios=m.pixelRatioChanges;
      }
      if(cityMotion?.started){
        const n=cityView.navigation,dt=Math.max(0,(Math.min(time,cityMotion.start+10000)-cityMotion.last)/1000);
        const scale=n.distance*2*Math.tan(19*Math.PI/180)/Math.max(1,cityView.height);
        n.pan(-40*dt*Math.cos(n.heading)/scale,-40*dt*Math.sin(n.heading)/scale,cityView.height);n.rotate(-20*dt,0);cityMotion.last=time;
      }
      moveTestSprites(citySprites,citySeconds);cityView.paint(cityHover,citySprites,cityPaused);
      if(cityMotion?.started){
        const run=cityMotion,m=cityView.metrics;run.cpu.push(performance.now()-time);run.intervals.push(frameInterval);
        const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
        const elapsed=Math.min(10,(time-run.start)/1000),swaps=m.detailSwaps-run.swaps,dirt=m.dirtSwaps-run.dirt,ratios=m.pixelRatioChanges-run.ratios;
        localText(element('city-motion-metrics'),`กล้อง ${elapsed.toFixed(1)}/10 s · CPU เฉลี่ย ${mean(run.cpu).toFixed(1)} ms · Frame เฉลี่ย ${mean(run.intervals).toFixed(1)} ms · สลับรายละเอียด ${swaps} (ดิน ${dirt}) · เปลี่ยน DPR ${ratios}`,
          `Camera ${elapsed.toFixed(1)}/10 s · Mean CPU ${mean(run.cpu).toFixed(1)} ms · Mean frame ${mean(run.intervals).toFixed(1)} ms · Detail swaps ${swaps} (dirt ${dirt}) · DPR changes ${ratios}`);
        if(elapsed===10){cityMotion=undefined;element<HTMLButtonElement>('city-motion').disabled=false;}
      }
      if(time-cityReadout>500){cityReadout=time;const m=cityView.metrics;
        localText(element('city-metrics'),`Frame ${m.intervalMs.toFixed(1)} ms · CPU ${m.frameMs.toFixed(1)} ms · ${m.drawCalls} draw calls · ${Math.round(m.triangles).toLocaleString()} triangles · chunk ค้าง ${m.pendingChunks} · model ค้าง ${m.pendingModels} · unknown ${m.unknownTiles} · rebuild ${m.rebuildMs.toFixed(1)} ms · first frame ${m.firstFrameMs.toFixed(0)} ms · ${cityView.width}×${cityView.height} · DPR ${cityView.renderer.getPixelRatio()}`,
          `Frame ${m.intervalMs.toFixed(1)} ms · CPU ${m.frameMs.toFixed(1)} ms · ${m.drawCalls} draw calls · ${Math.round(m.triangles).toLocaleString()} triangles · ${m.pendingChunks} pending chunks · ${m.pendingModels} pending models · ${m.unknownTiles} unknown · rebuild ${m.rebuildMs.toFixed(1)} ms · first frame ${m.firstFrameMs.toFixed(0)} ms · ${cityView.width}×${cityView.height} · DPR ${cityView.renderer.getPixelRatio()}`);
      }return;
    }
    if (width !== innerWidth || height !== innerHeight) {
      width = innerWidth; height = innerHeight;
      renderer.setSize(width, height);
    }
    controls?.update();
    const seconds = performance.now() / 1000, activeViews = selected ? [selected] : views;
    scrollWaterNormals(activeViews.flatMap(view => [view.root, view.neighbors]), seconds);
    updateRoadSignals(seconds); updateCommercialDisplays(seconds);
    animateCommercialModels(activeViews.map(view => view.root), seconds);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const view of selected ? [selected] : views) {
      const rect = view.region.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
      view.camera.aspect = rect.width / rect.height;
      view.camera.updateProjectionMatrix();
      renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height);
      renderer.setScissor(Math.max(rect.left, 0), Math.max(height - rect.bottom, 0),
        Math.min(rect.right, width) - Math.max(rect.left, 0), Math.min(rect.bottom, height) - Math.max(rect.top, 0));
      renderer.clear();
      renderer.render(view.scene, view.camera);
    }
  }
  render();
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    disposed = true;
    cityView?.dispose();
    window.clearTimeout(rebuildTimer);
    cancelAnimationFrame(frame);
    controls?.dispose();
    views.forEach(freeView);
    skyGeometry.dispose(); skyMaterial.dispose(); groundGeometry.dispose(); outlineMaterial.dispose();
    renderer.dispose();
    environmentTarget?.dispose();
  });
}

try {
  startGallery();
} catch (error) {
  const message = element('error');
  message.hidden = false;
  localText(message, `เปิดภาพ 3D ไม่สำเร็จ กรุณาตรวจว่าเบราว์เซอร์รองรับ WebGL 2: ${error instanceof Error ? error.message : String(error)}`, `Cannot open 3D. Check browser support for WebGL 2: ${error instanceof Error ? error.message : String(error)}`);
}
