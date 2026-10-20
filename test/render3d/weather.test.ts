/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The weather in the 3D view (src/render3d/city/weather.ts): eased from the map's weather, clouds before rain, wet
// ground that dries after, lightning only in a storm, rain round the camera, and the map's weather only ever read.
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Color, Group, Mesh, MeshStandardMaterial, BoxGeometry, PerspectiveCamera, WebGLRenderer } from 'three';
import { CityView3D, type CityViewSetup } from '../../src/render3d/city/index.js';
import { CLEAR_LOOK, CityWeather, easeLook, fogAtHour, Lightning, MAX_DROPS, RainStreaks, wetMaterials,
  type WeatherLook } from '../../src/render3d/city/weather.js';
import type { Weather } from '../../src/weather.js';

const storm: Weather = { kind: 'storm', rain: 0.9, cloud: 1, fog: 0, smoke: 0, seed: 1 };
const sunny: Weather = { kind: 'sunny', rain: 0, cloud: 0.2, fog: 0, smoke: 0, seed: 1 };
const run = (look: WeatherLook, weather: Weather | null, seconds: number, sunAngle = Math.PI / 2): void => {
  for (let t = 0; t < seconds; t += 1 / 30) easeLook(look, weather, 1 / 30, sunAngle);
};

describe('3D weather', () => {
  it('gathers the clouds before the rain falls, wets the ground, and dries it slowly after', () => {
    const look = { ...CLEAR_LOOK };
    run(look, storm, 0.5);
    expect(look.cloud).toBeGreaterThan(CLEAR_LOOK.cloud);
    expect(look.rain).toBe(0);
    run(look, storm, 5);
    expect(look.cloud).toBeGreaterThan(0.95);
    expect(look.rain).toBeGreaterThan(0.7);
    expect(look.storm).toBeGreaterThan(0.9);
    expect(look.wet).toBeGreaterThan(0.5);
    run(look, sunny, 4);
    expect(look.rain).toBeLessThan(0.05);
    expect(look.wet).toBeGreaterThan(0.3);
    run(look, sunny, 30);
    expect(look.wet).toBe(0);
  });

  it('thickens the fog at dawn and thins it by day', () => {
    expect(fogAtHour(0)).toBe(1);
    expect(fogAtHour(Math.PI / 2)).toBeLessThan(0.5);
    expect(fogAtHour(Math.PI * 1.5)).toBeGreaterThan(fogAtHour(Math.PI / 2));
    const look = { ...CLEAR_LOOK }, fog: Weather = { ...sunny, kind: 'fog', fog: 0.8 };
    run(look, fog, 20, 0.1);
    const dawn = look.fog;
    run(look, fog, 20, Math.PI / 2);
    expect(look.fog).toBeLessThan(dawn);
  });

  it('flashes lightning only in a storm, gently for a player who asks for less motion', () => {
    const quiet = new Lightning(), loud = new Lightning(), gentle = new Lightning(true);
    let calm = 0, flashes = 0, soft = 0;
    for (let t = 0; t < 30; t += 1 / 60) {
      calm = Math.max(calm, quiet.update(t, 0));
      flashes = Math.max(flashes, loud.update(t, 1));
      soft = Math.max(soft, gentle.update(t, 1));
    }
    expect(calm).toBe(0);
    expect(flashes).toBeGreaterThan(0.8);
    expect(soft).toBeGreaterThan(0);
    expect(soft).toBeLessThanOrEqual(0.3);
  });

  it('draws as many drops as the rain is hard, round the camera, and none in the dry', () => {
    const rain = new RainStreaks(), camera = new PerspectiveCamera(40, 1, 1, 5000);
    camera.position.set(100, 200, 300); camera.lookAt(100, 0, 100); camera.updateMatrixWorld();
    const wind = { x: 1, y: 0, strength: 0.5 };
    try {
      rain.update(camera, 300, 1, 0, wind, 1);
      expect(rain.mesh.visible).toBe(false);
      rain.update(camera, 300, 1, 0.4, wind, 1);
      const some = rain.mesh.geometry.drawRange.count;
      rain.update(camera, 300, 1, 1, wind, 1);
      expect(rain.mesh.visible).toBe(true);
      expect(some).toBeGreaterThan(0);
      expect(rain.mesh.geometry.drawRange.count).toBeGreaterThan(some);
      expect(rain.mesh.geometry.drawRange.count).toBeLessThanOrEqual(MAX_DROPS * 2);
    } finally { rain.dispose(); }
  });

  it('wets the plain road materials from their dry look and gives it back', () => {
    const material = new MeshStandardMaterial({ color: new Color(0.5, 0.5, 0.5), roughness: 0.9 });
    const root = new Group(); root.add(new Mesh(new BoxGeometry(), material), new Mesh(new BoxGeometry(), material));
    wetMaterials(root, 1);
    expect(material.roughness).toBeLessThan(0.5);
    expect(material.color.r).toBeLessThan(0.5);
    wetMaterials(root, 0);
    expect(material.roughness).toBeCloseTo(0.9);
    expect(material.color.r).toBeCloseTo(0.5);
  });

  it('only reads the map\'s weather: a frozen weather goes through many frames of the view untouched', () => {
    let time = 0;
    const canvas = { id: '', style: { cssText: '' }, addEventListener: jest.fn(), removeEventListener: jest.fn(), remove: jest.fn(),
      toDataURL: () => 'data:image/png;base64,test', getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLCanvasElement;
    const renderer = { setPixelRatio: jest.fn(), setSize: jest.fn(), shadowMap: {}, info: { render: { calls: 3, triangles: 20 } },
      render: jest.fn(), dispose: jest.fn(), getPixelRatio: () => 1 } as unknown as WebGLRenderer;
    const width = 12, height = 12, values = new Uint16Array(width * height);
    const weather = Object.freeze({ ...storm });
    const reader = { width, height, weather, getTileValue: (x: number, y: number) => values[y * width + x], getTileFlags: () => 0 };
    const overlay = { blockSize: 2, worldGet: () => 0 }, provider = { request: jest.fn(), take: () => [], dispose: jest.fn() };
    const setup: CityViewSetup = { container: { clientWidth: 800, clientHeight: 600, append: jest.fn() } as unknown as HTMLElement,
      map: reader, region: 'northeast', overlays: { trafficDensityMap: overlay, pollutionDensityMap: overlay, landValueMap: overlay },
      date: () => ({ month: 8, year: 1900 }) };
    const view = new CityView3D(setup, { canvas, rendererFactory: () => renderer, provider, now: () => time, headless: true });
    try {
      for (let frame = 0; frame < 120; frame++) { time += 50; view.paint(null, null, frame % 3 === 0); }
      expect(reader.weather).toEqual(storm);
      expect(Object.isFrozen(reader.weather)).toBe(true);
    } finally { view.dispose(); }
  });

  it('nothing in the 3D view writes a weather back', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? files(resolve(dir, entry.name)) : entry.name.endsWith('.ts') ? [resolve(dir, entry.name)] : []);
    for (const file of files(resolve('src/render3d'))) {
      // (the view's own weather object is its own: this.weather)
      const source = readFileSync(file, 'utf8').replace(/this\.weather\s*=/g, '');
      expect(source).not.toMatch(/\.weather\s*=[^=]/);
    }
  });

  it('opens a city straight into its weather, then eases', () => {
    const weather = new CityWeather();
    try {
      const look = weather.update(storm, 0.016, Math.PI / 2);
      expect(look.cloud).toBe(1);
      expect(look.rain).toBeCloseTo(0.9);
      const next = weather.update(sunny, 0.5, Math.PI / 2);
      expect(next.cloud).toBeLessThan(1);
      expect(next.cloud).toBeGreaterThan(sunny.cloud);
    } finally { weather.dispose(); }
  });
});
