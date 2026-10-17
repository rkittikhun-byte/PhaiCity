/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The sky over the city (owner 13 Oct 2026, after Cities: Skylines' views): a dome round the camera, deep blue
// overhead and pale at the horizon, with soft clouds that drift with the game's seconds. It draws behind everything,
// takes no fog and no light, and is only scenery.
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

const VERTEX = `
varying vec3 vDirection;
void main() {
  vDirection = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // on the far plane, behind everything
}`;

const FRAGMENT = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 haze;
uniform float time;
varying vec3 vDirection;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amplitude = 0.5;
  for (int octave = 0; octave < 5; octave++) { sum += amplitude * noise(p); p *= 2.03; amplitude *= 0.5; }
  return sum;
}
void main() {
  vec3 d = normalize(vDirection);
  float up = max(d.y, 0.0);
  vec3 sky = mix(horizon, zenith, pow(up, 0.55));
  // Clouds on a plane high above: flatter and thinner towards the horizon
  vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(time * 0.004, time * 0.0015);
  float cover = smoothstep(0.52, 0.78, fbm(uv)) * smoothstep(0.0, 0.18, d.y);
  float shade = 0.82 + 0.18 * fbm(uv * 2.3 + 7.0);
  sky = mix(sky, vec3(shade), cover * 0.85);
  // Below the horizon only haze, which the fog meets
  sky = mix(haze, sky, smoothstep(-0.02, 0.06, d.y));
  gl_FragColor = vec4(sky, 1.0);
}`;

export class SkyDome {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  constructor(radius: number, haze: Color) {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT, side: BackSide, depthWrite: false, depthTest: true, fog: false,
      uniforms: {
        zenith: { value: new Color(0x4f8fd0) }, horizon: { value: new Color(0xd5e6ef) }, haze: { value: haze.clone() },
        time: { value: 0 },
      },
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 32, 16), this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -10;
  }
  /** Keeps the dome round the camera and moves the clouds on. */
  update(camera: Vector3, seconds: number): void {
    this.mesh.position.copy(camera);
    this.material.uniforms.time.value = seconds;
  }
  /** Updates zenith, horizon and haze colors for smooth day/night transitions. */
  setColors(zenith: Color, horizon: Color, haze: Color): void {
    this.material.uniforms.zenith.value.copy(zenith);
    this.material.uniforms.horizon.value.copy(horizon);
    this.material.uniforms.haze.value.copy(haze);
  }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); }
}
