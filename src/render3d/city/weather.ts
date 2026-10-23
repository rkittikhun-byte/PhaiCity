/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The weather in the 3D view (owner, 20 Oct 2026: "มีฝนที่ฝนตก ตกหนัก แดดออก ฟ้ามืดด้วย ก็น่าจะดี"; src/weather.ts).
// The simulation chooses the month's weather and keeps it on the map; the game turns it into the sky now, with a rain
// spell two or three times an era (src/rainSpells.ts; owner, 21 Oct 2026: "ฝนตกบ่อยเกินไปมากๆ"), and the view only
// reads that, never writes it, and eases its look in over a few seconds: the clouds gather before the rain falls, the rain stops before
// they part, the ground stays wet a while after. What it draws: streaks of rain in a box that follows the camera (one draw of lines
// moved on the graphics card, cheap enough for a notebook), a darker sky and haze under the clouds (index.ts
// applyDayNight, sky.ts), wet ground, roofs and roads (materials/library.ts setCityWetness), lightning in a storm, fog
// that closes in, thickest in the morning, and the brown haze of burning fields.
import { BufferAttribute, BufferGeometry, Color, type Group, LineSegments, Material, Mesh, MeshStandardMaterial,
  type Object3D, ShaderMaterial, Vector3, type Camera } from 'three';
import type { Weather } from '../../weather.js';
import { fogAtHour } from '../../rainSpells.js';
import { SCENE } from '../../theme/tokens.js';
import { gameFeel } from '../../gameFeel.js';

/** What the view shows of the weather this frame, each 0–1 */
export interface WeatherLook {
  /** Cloud cover, and how stormy (dark, with lightning) */
  cloud: number; storm: number;
  /** How hard it rains, how thick the fog (after the hour of the day thins it) and the smoke */
  rain: number; fog: number; smoke: number;
  /** How wet the ground is: it gets wet in the rain and dries after it */
  wet: number;
  /** A flash of lightning */
  flash: number;
}

/** A clear day: how a city looks before its weather is read */
export const CLEAR_LOOK: Readonly<WeatherLook> = { cloud: 0.15, storm: 0, rain: 0, fog: 0, smoke: 0, wet: 0, flash: 0 };

// How fast each part follows the month's weather is the owner's (data/game-feel.json "weather", src/gameFeel.ts): about
// 20 s for the clouds to gather and the rain to set in or stop, about half a minute for fog (owner, 23 Oct 2026: "ฝนตก
// มีหมอก มันเร็วไป"; it was 3 to 6 s), and the ground wet in a downpour and dry about a minute after it

/** The rain falls once the clouds have gathered to this share of the month's cover */
const RAIN_WAITS_FOR = 0.85;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How much of the month's fog hangs at an hour (src/rainSpells.ts) */
export { fogAtHour };

/** One frame of the look following the map's weather (none: a clear day), over dt seconds at an hour of the day */
export function easeLook(look: WeatherLook, weather: Readonly<Weather> | null, dt: number, sunAngle: number): void {
  // (how fast each part follows, a share a second, and the ground wets and dries: the owner's, src/gameFeel.ts)
  const ease = gameFeel().weather;
  const step = (rate: number): number => 1 - Math.exp(-rate * Math.max(0, dt));
  const cloud = weather ? weather.cloud : CLEAR_LOOK.cloud;
  look.cloud += (cloud - look.cloud) * step(ease.cloud);
  // The rain waits for its clouds
  const rain = weather && look.cloud >= cloud * RAIN_WAITS_FOR ? weather.rain : 0;
  look.rain += (rain - look.rain) * step(ease.rain);
  look.storm += ((weather?.kind === 'storm' ? 1 : 0) - look.storm) * step(ease.storm);
  look.fog += ((weather ? weather.fog * fogAtHour(sunAngle) : 0) - look.fog) * step(ease.fog);
  look.smoke += ((weather ? weather.smoke : 0) - look.smoke) * step(ease.smoke);
  look.wet = clamp01(look.rain > 0.05 ? look.wet + look.rain * ease.wetting * dt : look.wet - ease.drying * dt);
}

// --- Rain ----------------------------------------------------------------------------------------------------------

/** The most drops at once, in a downpour */
export const MAX_DROPS = 5000;

const RAIN_VERTEX = `
uniform vec3 base;
uniform vec3 size;
uniform float time;
uniform float fall;
uniform float streak;
uniform vec3 slant;
uniform vec3 eye;
attribute float tail;
varying float vAlpha;
void main() {
  // Each drop keeps its place in the world on a lattice as big as the box, so the camera never drags the rain along;
  // it falls through the box, drifting with the wind, and comes round again at the top
  vec3 seed = position;
  float y = mod(seed.y * size.y - time * fall * (0.8 + 0.4 * seed.x) - base.y, size.y);
  vec2 drift = slant.xz / max(0.2, -slant.y) * (size.y - y);
  vec3 p = vec3(base.x + mod(seed.x * size.x + drift.x - base.x, size.x), base.y + y,
    base.z + mod(seed.z * size.z + drift.y - base.z, size.z));
  // ... as a streak along the way it falls, its tail fainter than its head
  p -= slant * streak * tail;
  vec3 q = (p - base) / size;
  vec3 edge = min(q, 1.0 - q);
  vAlpha = smoothstep(0.0, 0.12, min(edge.x, min(edge.y, edge.z))) * mix(1.0, 0.2, tail);
  // ... and none right in front of the camera, where a drop would streak across the whole screen
  vAlpha *= smoothstep(0.03, 0.1, length(p - eye) / size.x);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const RAIN_FRAGMENT = `
uniform vec3 colour;
uniform float opacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(colour, opacity * vAlpha);
  #include <colorspace_fragment>
}`;

/** Streaks of rain round the camera: up to MAX_DROPS lines, every one moved on the graphics card */
export class RainStreaks {
  readonly mesh: LineSegments;
  private readonly material: ShaderMaterial;
  private readonly forward = new Vector3();
  private readonly centre = new Vector3();
  constructor() {
    const seeds = new Float32Array(MAX_DROPS * 2 * 3), tails = new Float32Array(MAX_DROPS * 2);
    // The same drops every time (the view's own little generator: nothing here touches the city's chances)
    let state = 0x2545f491;
    const next = (): number => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < MAX_DROPS; i++) {
      const x = next(), y = next(), z = next();
      for (let end = 0; end < 2; end++) { seeds.set([x, y, z], (i * 2 + end) * 3); tails[i * 2 + end] = end; }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(seeds, 3));
    geometry.setAttribute('tail', new BufferAttribute(tails, 1));
    geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      vertexShader: RAIN_VERTEX, fragmentShader: RAIN_FRAGMENT, transparent: true, depthWrite: false, fog: false,
      uniforms: {
        base: { value: new Vector3() }, size: { value: new Vector3(1, 1, 1) }, time: { value: 0 }, fall: { value: 1 },
        streak: { value: 1 }, slant: { value: new Vector3(0, -1, 0) }, eye: { value: new Vector3() }, colour: { value: new Color(SCENE.weather.rain) },
        opacity: { value: 0 },
      },
    });
    this.mesh = new LineSegments(geometry, this.material);
    this.mesh.name = 'weather:rain'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.visible = false;
  }
  /**
   * The rain this frame: rain 0–1 sets how many drops and how long; the box sits between the camera and what it looks
   * at, as big as the view, so the rain looks the same near the street and from high up. wind: where it blows on the
   * map (x east, z south) and how hard, 0–1; light: how lit the drops are, 0 (night) to 1.
   */
  update(camera: Camera, distance: number, seconds: number, rain: number, wind: { x: number; y: number; strength: number },
      light: number): void {
    const drops = Math.round(MAX_DROPS * clamp01(rain * 1.15));
    this.mesh.visible = drops > 0;
    if (!this.mesh.visible) return;
    this.mesh.geometry.setDrawRange(0, drops * 2);
    const u = this.material.uniforms;
    const span = Math.min(1600, Math.max(24, distance * 1.1)), tall = span * 0.7;
    camera.getWorldDirection(this.forward);
    const centre = this.centre.copy(camera.position).addScaledVector(this.forward, distance * 0.45);
    (u.size.value as Vector3).set(span, tall, span);
    (u.base.value as Vector3).set(centre.x - span / 2, centre.y - tall / 2, centre.z - span / 2);
    u.time.value = seconds;
    u.fall.value = tall * 1.4;
    u.streak.value = tall * 0.04 * (0.7 + 0.5 * rain);
    (u.eye.value as Vector3).copy(camera.position);
    // The way the drops fall: down, and with the wind (src/wind.ts: x east, y south on the map, which is z here)
    (u.slant.value as Vector3).set(wind.x * wind.strength * 0.35, -1, wind.y * wind.strength * 0.35).normalize();
    // ... dimmer by night, when only the city's lights catch them
    (u.colour.value as Color).set(SCENE.weather.rain).multiplyScalar(0.2 + 0.8 * clamp01(light));
    u.opacity.value = (0.38 + 0.32 * rain) * (0.55 + 0.45 * clamp01(light));
  }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); }
}

// --- Lightning -----------------------------------------------------------------------------------------------------

/**
 * Flashes of lightning in a storm, a few seconds apart, each two quick strokes; softer for a player who asks for less
 * motion. Real seconds, so a paused storm still flickers.
 */
export class Lightning {
  private nextAt = 3;
  private flashAt = -10;
  private state = 0x9e3779b9;
  constructor(private readonly gentle = false) {}
  private random(): number { return (this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0) / 4294967296; }
  /** The flash now, 0–1, at these seconds and this much storm */
  update(seconds: number, storm: number): number {
    if (storm < 0.5) { this.nextAt = Math.max(this.nextAt, seconds + 1); return 0; }
    if (seconds >= this.nextAt) { this.flashAt = seconds; this.nextAt = seconds + (2.5 + this.random() * 6) / storm; }
    const t = seconds - this.flashAt;
    if (t < 0 || t > 0.5) return 0;
    const stroke = Math.max(0, 1 - t / 0.09) + (t > 0.15 ? Math.max(0, 0.7 - (t - 0.15) / 0.14) : 0);
    return clamp01(stroke) * storm * (this.gentle ? 0.3 : 1);
  }
}

// --- Wet roads -----------------------------------------------------------------------------------------------------

/**
 * Wets the plain materials under root that the city shaders do not (the roads and rails drawn along their lines,
 * roadCurves.ts): darker and glossier, from the dry look they had, kept in their userData.
 */
export function wetMaterials(root: Object3D, wet: number): void {
  const seen = new Set<Material>();
  root.traverse((object) => {
    const material = (object as Mesh).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      if (seen.has(m) || !(m instanceof MeshStandardMaterial) || m.userData.cityLODWrapper || m.userData.cityUVWrapper) continue;
      seen.add(m);
      const dry = (m.userData.weatherDry ??= { roughness: m.roughness, colour: m.color.clone() }) as
        { roughness: number; colour: Color };
      m.roughness = dry.roughness * (1 - 0.55 * wet);
      m.color.copy(dry.colour).multiplyScalar(1 - 0.28 * wet);
    }
  });
}

// --- The whole of it -----------------------------------------------------------------------------------------------

/** The weather of the 3D view: its look, eased from the map's weather, the rain and the lightning */
export class CityWeather {
  readonly look: WeatherLook = { ...CLEAR_LOOK };
  readonly rain = new RainStreaks();
  private readonly lightning: Lightning;
  private seconds = 0;
  private wetShown = 0;
  private started = false;
  constructor(gentle = false) { this.lightning = new Lightning(gentle); }
  get root(): LineSegments { return this.rain.mesh; }
  /**
   * The weather this frame: weather is the map's (read only), dt the real seconds since the last frame, sunAngle the
   * hour (src/dayClock.ts). A city opens in its weather at once; after that it eases.
   */
  update(weather: Readonly<Weather> | null, dt: number, sunAngle: number): WeatherLook {
    this.seconds += dt;
    if (!this.started && weather) {
      this.started = true;
      Object.assign(this.look, { cloud: weather.cloud, rain: weather.rain, storm: weather.kind === 'storm' ? 1 : 0,
        fog: weather.fog * fogAtHour(sunAngle), smoke: weather.smoke, wet: weather.rain > 0 ? 0.6 : 0 });
    } else {
      easeLook(this.look, weather, dt, sunAngle);
    }
    this.look.flash = this.lightning.update(this.seconds, this.look.storm);
    return this.look;
  }
  /** Moves the rain round the camera (hidden for the flat map camera) */
  place(camera: Camera, distance: number, wind: { x: number; y: number; strength: number }, light: number,
      hidden: boolean): void {
    if (hidden) { this.rain.mesh.visible = false; return; }
    this.rain.update(camera, distance, this.seconds, this.look.rain, wind, light);
  }
  /** Wets the roads under root when the ground's wetness has changed enough to see */
  wetRoads(root: Group | Object3D, force = false): void {
    if (!force && Math.abs(this.look.wet - this.wetShown) < 0.02) return;
    this.wetShown = this.look.wet;
    wetMaterials(root, this.look.wet);
  }
  dispose(): void { this.rain.dispose(); }
}
