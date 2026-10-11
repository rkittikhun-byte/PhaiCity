/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  ACESFilmicToneMapping, BackSide, Box3, BoxGeometry, BufferGeometry, Color, DirectionalLight,
  Fog, GridHelper, Group, HemisphereLight, LineBasicMaterial, LineLoop, Mesh,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial,
  SphereGeometry, SRGBColorSpace, Texture, Vector3, WebGLRenderer, PMREMGenerator,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { TILE_M } from '../constants.js';
import { getMaterial, getPreviewGround, MATERIAL_KEYS, MaterialKey, materialTextureStatus, setNightMode, SHOPHOUSE_PASTELS, whenMaterialReady } from '../materials/library.js';
import { DAY_SKY_URL, TEXTURE_CATALOG } from '../materials/catalog.js';
import { FICTIONAL_THAI_SIGNS, thaiSign } from '../materials/signs.js';
import { ModelOptions, ModelRegistration, registry } from '../models/registry.js';
import { applyWorldUV, countDrawCalls, countTriangles, disposeModel } from '../util/geometry.js';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing gallery element: ${id}`);
  return found as T;
}

interface View {
  id: string;
  kind: 'model' | 'material' | 'sign';
  entry: ModelRegistration;
  scene: Scene;
  camera: PerspectiveCamera;
  root: Group;
  region: HTMLElement;
  sun: DirectionalLight;
  ambient: HemisphereLight;
  grid: GridHelper;
  outline: LineLoop;
  metrics?: HTMLElement;
}

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
  const seed = element<HTMLInputElement>('seed');
  const variant = element<HTMLInputElement>('variant');
  const state = element<HTMLInputElement>('state');
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
  let activeTab: 'models' | 'materials' = 'models';
  let environment: Texture | undefined;
  let environmentTarget: ReturnType<PMREMGenerator['fromEquirectangular']> | undefined;
  let disposed = false;

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
    };
  }

  function frameModel(view: View): void {
    const bounds = new Box3().setFromObject(view.root);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    if (bounds.isEmpty()) { size.set(10, 10, 10); center.set(0, 5, 0); }
    const rect = view.region.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
    const halfVerticalFov = view.camera.fov * Math.PI / 360;
    const halfFov = Math.min(halfVerticalFov, Math.atan(Math.tan(halfVerticalFov) * aspect));
    const distance = Math.max(size.length() / 2, view.kind === 'model' ? TILE_M / 2 : 1) / Math.sin(halfFov) * 1.12;
    view.camera.position.copy(center).add(new Vector3(0.65, 0.85, 0.85).normalize().multiplyScalar(distance));
    view.camera.lookAt(center);
    if (selected === view && controls) {
      controls.target.copy(center);
      controls.minDistance = Math.max(size.length() * 0.2, 2);
      controls.maxDistance = distance * 6;
      controls.update();
    }
  }

  function updateMetrics(view: View): void {
    const triangles = countTriangles(view.root), calls = countDrawCalls(view.root);
    if (view.metrics) view.metrics.textContent = `${view.entry.category} · ${triangles.toLocaleString()} triangles · ${calls} draw call${calls === 1 ? '' : 's'}`;
    if (selected === view) {
      element('detail-id').textContent = view.id;
      element('detail-category').textContent = view.kind === 'model' ? view.entry.category : view.kind === 'material' ? 'วัสดุ PBR · 1K' : 'ป้ายภาษาไทย · Sarabun';
      element('detail-triangles').textContent = triangles.toLocaleString();
      element('detail-calls').textContent = String(calls);
      element('detail-footprint').textContent = view.kind === 'model' ? `${view.entry.footprint.join(' × ')} tiles` : 'ตัวอย่างผิว';
      element('detail-budget').textContent = view.kind === 'model' ? view.entry.budget.toLocaleString() : '—';
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
      view.scene.fog = new Fog(horizon, 180, 1400);
      view.sun.color.setHex(night.checked ? 0xb0c7e6 : 0xffe3b0);
      view.sun.intensity = night.checked ? 0.35 : 3.4;
      view.ambient.intensity = night.checked ? 0.3 : 1.25;
      view.scene.environment = night.checked ? null : environment ?? null;
      view.scene.environmentIntensity = 0.65;
      view.sun.position.set(-Math.cos(elevation) * 180 * 0.8, Math.sin(elevation) * 180, Math.cos(elevation) * 180 * 0.6);
      view.grid.visible = gridToggle.checked && view.kind === 'model';
      view.outline.visible = footprintToggle.checked && view.kind === 'model';
    });
  }

  function createView(id: string, entry: ModelRegistration, region: HTMLElement, metrics?: HTMLElement, kind: View['kind'] = 'model'): View {
    const scene = new Scene();
    const root = entry.factory(options());
    scene.add(root, new Mesh(skyGeometry, skyMaterial));
    const ground = new Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
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
    const view = { id, kind, entry, scene, root, region, camera, sun, ambient, grid, outline, metrics };
    views.push(view);
    frameModel(view);
    updateMetrics(view);
    return view;
  }

  function freeView(view: View): void {
    disposeModel(view.root);
    view.grid.geometry.dispose();
    view.grid.material.dispose();
    view.outline.geometry.dispose();
    view.sun.shadow.dispose();
  }

  function showLibrary(): void {
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
    updateStateChoices();
  }

  function showModel(view: View): void {
    element('library').hidden = true;
    element('materials').hidden = true;
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
    showLibrary();
    views.forEach(freeView);
    views.length = 0;
    cards.replaceChildren();
    element('material-cards').replaceChildren();
    element('sign-cards').replaceChildren();
    if (activeTab === 'materials') {
      buildMaterials();
      updateLighting();
      return;
    }
    Object.entries(registry).filter(([, entry]) => category.value === 'all' || category.value === entry.category).forEach(([id, entry]) => {
      const card = document.createElement('button');
      card.className = 'model-card';
      card.type = 'button';
      card.setAttribute('aria-label', `ดู ${id}`);
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
    element('model-count').textContent = `${views.length} โมเดล · 1 หน่วย = 1 เมตร`;
    element('empty').hidden = views.length > 0;
    updateStateChoices();
    updateLighting();
  }

  function rebuildModels(): void {
    const opts = options();
    views.filter(view => view.kind === 'model').forEach(view => {
      view.scene.remove(view.root);
      disposeModel(view.root);
      view.root = view.entry.factory(opts);
      view.scene.add(view.root);
      updateMetrics(view);
    });
  }

  function sampleRegistration(factory: () => Group): ModelRegistration {
    return { factory, category: 'ui', footprint: [1, 1], tiles: [], budget: 3000 };
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

  function sampleCard(id: string, title: string, factory: () => Group, parent: HTMLElement, kind: View['kind']): HTMLElement {
    const card = document.createElement('article'); card.className = 'material-card';
    const preview = document.createElement('div'); preview.className = 'preview';
    preview.tabIndex = 0; preview.setAttribute('role', 'button'); preview.setAttribute('aria-label', `ดู ${id}`);
    const caption = document.createElement('div'); caption.className = 'caption';
    const label = document.createElement('strong'); label.className = 'material-label'; label.textContent = title;
    const name = document.createElement('small'); name.textContent = id;
    const status = document.createElement('small'); status.textContent = 'กำลังโหลด';
    caption.append(label, name, status); card.append(preview, caption); parent.append(card);
    const view = createView(id, sampleRegistration(factory), preview, undefined, kind);
    const open = () => showModel(view);
    preview.addEventListener('click', open);
    preview.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    return status;
  }

  function buildMaterials(): void {
    MATERIAL_KEYS.forEach(key => {
      const definition = TEXTURE_CATALOG[key];
      const status = sampleCard(key, definition.label, () => materialSample(key), element('material-cards'), 'material');
      const source = document.createElement('a'); source.href = definition.sources[0];
      source.textContent = 'ที่มา CC0 ↗'; source.target = '_blank'; source.rel = 'noopener';
      status.parentElement!.append(source);
      void whenMaterialReady(key).then(() => {
        status.textContent = materialTextureStatus(key) === 'ready' ? 'PBR · 1K · CC0' : 'โหลด texture ไม่สำเร็จ · แสดงสีพื้น';
      });
    });
    element('pastels').replaceChildren(...SHOPHOUSE_PASTELS.map(pastel => {
      const swatch = document.createElement('span'); swatch.className = 'swatch';
      const dot = document.createElement('i'); dot.style.backgroundColor = `#${pastel.color.toString(16).padStart(6, '0')}`;
      swatch.append(dot, document.createTextNode(pastel.label)); return swatch;
    }));
    const signExamples = [
      { id: 'sign.horizontal', title: 'ป้ายหน้าร้าน', text: 'ก๋วยเตี๋ยวบ้านสวน', size: [4, 1] as const, layout: 'horizontal' as const, lit: false },
      { id: 'sign.vertical', title: 'ป้ายแนวตั้ง', text: 'ห้อง\nว่าง', size: [1, 3.5] as const, layout: 'vertical' as const, lit: false },
      { id: 'sign.lit', title: 'ป้ายมีแสง', text: 'ครัวลมเย็น', size: [3.5, 1.2] as const, layout: 'horizontal' as const, lit: true },
    ];
    signExamples.forEach(example => {
      const status = sampleCard(example.id, example.title, () => {
        const root = new Group();
        const mesh = new Mesh(new PlaneGeometry(...example.size), thaiSign(example.text, '#f3e8c7', '#25493e', example.size, example));
        mesh.position.y = example.size[1] / 2 + 0.25;
        mesh.castShadow = true; root.add(mesh); return root;
      }, element('sign-cards'), 'sign');
      status.textContent = example.text + (example.lit ? ' · เปิดกลางคืนเพื่อดูแสง' : '');
    });
    element('back').textContent = '← วัสดุทั้งหมด';
  }

  function switchTab(tab: 'models' | 'materials'): void {
    activeTab = tab;
    ['models', 'materials'].forEach(name => {
      const button = element(name + '-tab');
      button.setAttribute('aria-selected', String(tab === name)); button.tabIndex = tab === name ? 0 : -1;
    });
    [category, seed, variant, state, gridToggle, footprintToggle].forEach(input => {
      input.disabled = tab !== 'models';
      (input.closest('label') as HTMLLabelElement).hidden = tab !== 'models';
    });
    element('back').textContent = tab === 'models' ? '← โมเดลทั้งหมด' : '← วัสดุทั้งหมด';
    buildLibrary();
  }

  Array.from(new Set(Object.values(registry).map(entry => entry.category))).sort().forEach(name => {
    const option = document.createElement('option');
    option.value = option.textContent = name;
    category.append(option);
  });
  category.addEventListener('change', buildLibrary);
  [seed, variant, state].forEach(input => input.addEventListener('change', rebuildModels));
  [sunAngle, night, gridToggle, footprintToggle].forEach(input => input.addEventListener('input', updateLighting));
  element('back').addEventListener('click', showLibrary);
  element('reset-camera').addEventListener('click', () => { if (selected) frameModel(selected); });
  element('models-tab').addEventListener('click', () => switchTab('models'));
  element('materials-tab').addEventListener('click', () => switchTab('materials'));
  ['models', 'materials'].forEach(name => element(name + '-tab').addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); switchTab(activeTab === 'models' ? 'materials' : 'models'); element(activeTab + '-tab').focus();
    }
  }));
  buildLibrary();

  // IBL is local and lazy; the gradient sky remains readable at both day and night.
  new HDRLoader().load(DAY_SKY_URL, texture => {
    if (disposed) { texture.dispose(); return; }
    const generator = new PMREMGenerator(renderer);
    environmentTarget = generator.fromEquirectangular(texture);
    environment = environmentTarget.texture;
    texture.dispose(); generator.dispose();
    element('sky-status').textContent = 'แสงท้องฟ้า HDRI 1K · Poly Haven · CC0';
    updateLighting();
  }, undefined, () => { element('sky-status').textContent = 'โหลด HDRI ไม่สำเร็จ · ใช้แสงท้องฟ้าสีพื้น'; });

  // One WebGL context for the entire library; scissor each visible thumbnail or inspector.
  function render(): void {
    frame = requestAnimationFrame(render);
    if (width !== innerWidth || height !== innerHeight) {
      width = innerWidth; height = innerHeight;
      renderer.setSize(width, height);
    }
    controls?.update();
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
  message.textContent = `เปิดภาพ 3D ไม่สำเร็จ กรุณาตรวจว่าเบราว์เซอร์รองรับ WebGL 2: ${error instanceof Error ? error.message : String(error)}`;
}
