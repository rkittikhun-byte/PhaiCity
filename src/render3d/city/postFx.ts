/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The diorama lens over the city (docs/METRE_DRAWING_PLAN.md section 6, docs/3d/RENDERER_SPEC.md 8A): the look of the
// concept art (assets/concept) on a WebGL notebook. The city is drawn once, smoothed by the card's multisampling, into
// a picture that keeps its light above white; then, from that picture and its depth:
// - contact shadows (ambient occlusion from the depth alone, half size, blurred along the depth): corners, eaves and the
//   foot of every wall go the concept's lavender, never black, and fade in the haze;
// - the glow of what shines brighter than white (lamps, windows and lanterns at night, the low sun, glints off water),
//   a chain of ever smaller pictures blurred and added back, warm by night;
// - a tilt-shift: the top and bottom of the picture soften into a blurred copy, so the city looks like a model, with a
//   faint darker edge;
// and one last pass puts them together, maps the light to the screen (ACES, as the renderer does without the lens) and
// draws to the canvas, so screenshots keep working. Every pass but the first and the last is half size or smaller.
// The view (index.ts) says which effects are on (quality.ts) and how they look this frame (PostLook: the hour, the
// weather, the camera); this file only draws. Without WebGL 2 and pictures in half floats it is never made, and the view
// draws straight to the screen as before; headless tests never make it either.
import { BufferAttribute, BufferGeometry, Camera, Color, DepthTexture, HalfFloatType, LinearFilter, Mesh, NoBlending,
  OrthographicCamera, RGBFormat, RGFormat, ShaderMaterial, UnsignedInt101111Type, Vector2, WebGLRenderTarget, type PerspectiveCamera, type Scene, type Texture,
  type WebGLRenderer } from 'three';
import { NO_EFFECTS, type PostEffects } from './quality.js';

/** How the lens looks this frame (index.ts postLook) */
export interface PostLook {
  /** Contact shadows: how dark (0-1), how far round each point they reach in world units, and the colour they go */
  ao: { strength: number; radius: number; tint: Color };
  /** The glow: what is bright enough to glow (above `threshold`, softly over `knee`), how strongly, how wide (0-1),
   * and its colour */
  bloom: { threshold: number; knee: number; strength: number; spread: number; tint: Color };
  /** The tilt-shift: how strong (0-1), where the sharp band lies (0 bottom, 1 top) and how wide it is (0-1) */
  tilt: { strength: number; focus: number; band: number };
  /** The darker edge round the picture (0-1) and its colour */
  vignette: { strength: number; tint: Color };
  /** The haze, in world units from the camera: contact shadows fade into it */
  fog: { near: number; far: number } | null;
}

/** What the view needs of the lens, so tests can stand in for it without WebGL */
export interface CityPostLike {
  readonly effects: Readonly<PostEffects>;
  setEffects(effects: Readonly<PostEffects>): void;
  /** The canvas's drawing size, in pixels */
  setSize(width: number, height: number): void;
  render(scene: Scene, camera: PerspectiveCamera, look: PostLook): void;
  dispose(): void;
}

/** Contact-shadow samples round each point, and the most pixels (of the half-size picture) they reach */
const AO_SAMPLES = 10;
const AO_MAX_PX = 36;
/** The glow's pictures: half size, a quarter, ... down to a thirty-second */
const BLOOM_LEVELS = 5;

const VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Half size, each tap a 2x2 average: a 4x4 box. With THRESHOLD only what shines brighter than white is kept, each tap
 * weighed down by its brightness so a lone sparkle does not flicker */
const DOWN_BOX = `
uniform sampler2D tInput;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
vec3 tap(vec2 offset) {
  vec3 c = min(texture2D(tInput, vUv + texel * offset).rgb, vec3(64.0));
#ifdef THRESHOLD
  float bright = max(c.r, max(c.g, c.b));
  float soft = clamp(bright - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  c *= max(soft, bright - threshold) / max(bright, 1e-4);
  c /= 1.0 + max(c.r, max(c.g, c.b)) * 0.25;
#endif
  return c;
}
void main() {
  gl_FragColor = vec4((tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))) * 0.25, 1.0);
}`;

/** Half size again, five taps (the dual filter's down step) */
const DUAL_DOWN = `
uniform sampler2D tInput;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D(tInput, vUv).rgb * 4.0;
  sum += texture2D(tInput, vUv + texel * vec2(-1.0, -1.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(1.0, -1.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(-1.0, 1.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(sum / 8.0, 1.0);
}`;

/** Twice the size, eight taps (the dual filter's up step); with ADD the picture of this size is added under it */
const DUAL_UP = `
uniform sampler2D tInput;
uniform sampler2D tBase;
uniform vec2 texel;
uniform float spread;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D(tInput, vUv + texel * vec2(-1.0, 0.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(1.0, 0.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(0.0, -1.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(0.0, 1.0)).rgb;
  sum += texture2D(tInput, vUv + texel * vec2(-0.5, -0.5)).rgb * 2.0;
  sum += texture2D(tInput, vUv + texel * vec2(0.5, -0.5)).rgb * 2.0;
  sum += texture2D(tInput, vUv + texel * vec2(-0.5, 0.5)).rgb * 2.0;
  sum += texture2D(tInput, vUv + texel * vec2(0.5, 0.5)).rgb * 2.0;
  sum /= 12.0;
#ifdef ADD
  sum = texture2D(tBase, vUv).rgb + sum * spread;
#endif
  gl_FragColor = vec4(sum, 1.0);
}`;

/** Contact shadows from the depth alone: each point's surface from its neighbours' depths, then samples on a spiral
 * round it; whatever rises over the surface within the radius shades it. Out: how open (1) or shut in (0) the point
 * is, and its distance, which the blur and the haze read */
const AO = `
#include <packing>
uniform sampler2D tDepth;
uniform vec2 depthTexel;
uniform vec2 aoSize;
uniform vec2 unproject;
uniform float projScale;
uniform float cameraNear;
uniform float cameraFar;
uniform float radius;
uniform float intensity;
uniform float maxDistance;
varying vec2 vUv;
float viewZ(vec2 uv) { return perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
vec3 viewPosition(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * unproject * -z, z); }
void main() {
  float depth = texture2D(tDepth, vUv).x;
  if (depth >= 0.99999) { gl_FragColor = vec4(1.0, cameraFar, 0.0, 1.0); return; }
  float z = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  float rPx = min(radius * projScale / -z, float(${AO_MAX_PX}));
  if (-z > maxDistance || rPx < 1.0) { gl_FragColor = vec4(1.0, -z, 0.0, 1.0); return; }
  vec3 p = viewPosition(vUv, z);
  // The surface: of the neighbours on either side, the one nearer in depth, so an edge does not bend it
  vec2 dx = vec2(depthTexel.x * 2.0, 0.0), dy = vec2(0.0, depthTexel.y * 2.0);
  vec3 r = viewPosition(vUv + dx, viewZ(vUv + dx)), l = viewPosition(vUv - dx, viewZ(vUv - dx));
  vec3 u = viewPosition(vUv + dy, viewZ(vUv + dy)), d = viewPosition(vUv - dy, viewZ(vUv - dy));
  vec3 across = abs(r.z - p.z) < abs(p.z - l.z) ? r - p : p - l;
  vec3 up = abs(u.z - p.z) < abs(p.z - d.z) ? u - p : p - d;
  vec3 n = normalize(cross(across, up));
  // A different turn of the spiral at each pixel, which the blur then smooths
  float spin = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float r2 = radius * radius, sum = 0.0;
  for (int i = 0; i < ${AO_SAMPLES}; i++) {
    float t = (float(i) + 0.5) / float(${AO_SAMPLES});
    float angle = spin + t * 43.98;
    vec2 at = vUv + vec2(cos(angle), sin(angle)) * (t * rPx) / aoSize;
    vec3 v = viewPosition(at, viewZ(at)) - p;
    float vv = dot(v, v);
    sum += max(dot(v, n) * inversesqrt(vv + 1e-6) - 0.12, 0.0) * max(1.0 - vv / r2, 0.0);
  }
  gl_FragColor = vec4(clamp(1.0 - sum * intensity / float(${AO_SAMPLES}), 0.0, 1.0), -z, 0.0, 1.0);
}`;

/** The contact shadows blurred one way, only across points at about the same distance */
const AO_BLUR = `
uniform sampler2D tInput;
uniform vec2 blurStep;
varying vec2 vUv;
void main() {
  vec2 centre = texture2D(tInput, vUv).rg;
  float z = centre.g, tolerance = z * 0.04 + 0.2, sum = centre.r, weights = 1.0;
  for (int i = 1; i <= 3; i++) {
    float g = i == 1 ? 0.8 : i == 2 ? 0.5 : 0.25;
    vec2 a = texture2D(tInput, vUv + blurStep * float(i)).rg, b = texture2D(tInput, vUv - blurStep * float(i)).rg;
    float wa = g * max(0.0, 1.0 - abs(a.g - z) / tolerance), wb = g * max(0.0, 1.0 - abs(b.g - z) / tolerance);
    sum += a.r * wa + b.r * wb; weights += wa + wb;
  }
  gl_FragColor = vec4(sum / weights, z, 0.0, 1.0);
}`;

/** Everything together, then mapped to the screen's colours as the renderer would without the lens */
const COMPOSITE = `
uniform sampler2D tScene;
uniform sampler2D tAo;
uniform sampler2D tBloom;
uniform sampler2D tBlur;
uniform sampler2D tBlurMore;
uniform float aoOn;
uniform float aoStrength;
uniform vec3 aoTint;
uniform float fogNear;
uniform float fogFar;
uniform float bloomOn;
uniform vec3 bloomColour;
uniform float tiltOn;
uniform float tiltStrength;
uniform float tiltFocus;
uniform float tiltBand;
uniform float vignette;
uniform vec3 vignetteTint;
uniform float aspect;
uniform vec2 sceneTexel;
varying vec2 vUv;
// Edges smoothed along their direction (FXAA's classic form), the picture having been drawn with one sample a pixel,
// judged by the brightness the screen will show, so a lamp brighter than white does not throw it off
float shown(vec3 c) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return sqrt(l / (1.0 + l)); }
vec3 smoothed(vec2 uv) {
  vec3 m = texture2D(tScene, uv).rgb;
  float lm = shown(m);
  float nw = shown(texture2D(tScene, uv + vec2(-1.0, -1.0) * sceneTexel).rgb), ne = shown(texture2D(tScene, uv + vec2(1.0, -1.0) * sceneTexel).rgb);
  float sw = shown(texture2D(tScene, uv + vec2(-1.0, 1.0) * sceneTexel).rgb), se = shown(texture2D(tScene, uv + vec2(1.0, 1.0) * sceneTexel).rgb);
  float lo = min(lm, min(min(nw, ne), min(sw, se))), hi = max(lm, max(max(nw, ne), max(sw, se)));
  if (hi - lo < max(0.0312, hi * 0.125)) return m;
  vec2 dir = vec2(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
  float reduce = max((nw + ne + sw + se) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-8.0), vec2(8.0)) * sceneTexel;
  vec3 a = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
  float lb = shown(b);
  return lb < lo || lb > hi ? a : b;
}
void main() {
  vec3 colour = smoothed(vUv);
  if (tiltOn > 0.5) {
    // Sharp in the band, softening towards the top and bottom, softest at the very edges
    float away = abs(vUv.y - tiltFocus) * 2.0;
    float soft = smoothstep(tiltBand, 1.0, away) * tiltStrength;
    if (soft > 0.002) {
      colour = mix(colour, texture2D(tBlur, vUv).rgb, min(1.0, soft * 1.5));
      colour = mix(colour, texture2D(tBlurMore, vUv).rgb, smoothstep(0.6, 1.0, soft) * 0.8);
    }
  }
  if (aoOn > 0.5) {
    vec2 ao = texture2D(tAo, vUv).rg;
    // Fading into the haze, and never over what shines (lamps, windows)
    float haze = smoothstep(fogNear, fogFar, ao.g);
    float light = smoothstep(0.9, 2.2, dot(colour, vec3(0.2126, 0.7152, 0.0722)));
    float shut = (1.0 - ao.r) * aoStrength * (1.0 - haze) * (1.0 - light);
    colour *= mix(vec3(1.0), aoTint, shut);
  }
  if (bloomOn > 0.5) colour += texture2D(tBloom, vUv).rgb * bloomColour;
  if (vignette > 0.0) {
    // 0 in the middle, 1 in the corners, round whatever the window's shape
    float edge = length((vUv - 0.5) * vec2(aspect, 1.0)) / length(vec2(aspect, 1.0) * 0.5);
    colour *= mix(vec3(1.0), vignetteTint, smoothstep(0.55, 1.0, edge) * vignette);
  }
  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // A grain finer than one step of the screen's colours, so the packed pictures' gradients (the sky) do not band
  gl_FragColor.rgb += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
}`;

const pass = (fragmentShader: string, uniforms: Record<string, { value: unknown }>, defines: Record<string, string> = {}): ShaderMaterial =>
  new ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, defines, blending: NoBlending, depthTest: false,
    depthWrite: false, toneMapped: false });

/** How a picture keeps its light: three small floats a pixel where the card can draw into them (R11F_G11F_B10F, half the
 * bytes of four half floats, which a notebook's shared memory feels), else four half floats; `two` keeps only two */
type Pixels = 'packed' | 'half' | 'two';
const target = (pixels: Pixels): WebGLRenderTarget => new WebGLRenderTarget(1, 1, { depthBuffer: false,
  minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, ...format(pixels) });
const format = (pixels: Pixels): { type: typeof HalfFloatType | typeof UnsignedInt101111Type; format?: typeof RGBFormat | typeof RGFormat } =>
  pixels === 'packed' ? { type: UnsignedInt101111Type, format: RGBFormat } : pixels === 'two' ? { type: HalfFloatType, format: RGFormat } : { type: HalfFloatType };

/** Whether the card can draw into a packed-float picture (EXT_color_buffer_float makes R11F_G11F_B10F drawable) */
function packedDrawable(renderer: WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!renderer.extensions.has('EXT_color_buffer_float')) return false;
    const samples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES) as Int32Array | null;
    return samples !== null;
  } catch {
    return false;
  }
}

/** Whether the lens will most likely draw in this browser, asked before the city's own context is made (so that one can
 * go without samples of its own): a throwaway WebGL 2 context that can draw into floats */
export function lensLikely(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const floats = Boolean(gl.getExtension('EXT_color_buffer_float'));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return floats;
  } catch {
    return false;
  }
}

/** Whether this renderer can draw the lens: WebGL 2 with pictures in half floats */
export function postSupported(renderer: WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext?.() as WebGL2RenderingContext | undefined;
    if (!gl || typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return false;
    return Boolean(renderer.extensions?.has('EXT_color_buffer_float') || renderer.extensions?.has('EXT_color_buffer_half_float'));
  } catch {
    return false;
  }
}

export class CityPost implements CityPostLike {
  effects: PostEffects = { ...NO_EFFECTS };
  private width = 1; private height = 1;
  private scene?: WebGLRenderTarget; private sceneHasDepth = false;
  /** How the pictures keep their light */
  private readonly pixels: Pixels;
  private readonly quad: Mesh; private readonly quadCamera: Camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly half: WebGLRenderTarget; private readonly quarter: WebGLRenderTarget; private readonly blur: WebGLRenderTarget;
  private readonly aoRaw: WebGLRenderTarget; private readonly aoBlur: WebGLRenderTarget;
  private readonly down: WebGLRenderTarget[] = []; private readonly up: WebGLRenderTarget[] = [];
  private readonly box: ShaderMaterial; private readonly bright: ShaderMaterial; private readonly dualDown: ShaderMaterial;
  private readonly dualUp: ShaderMaterial; private readonly dualUpAdd: ShaderMaterial; private readonly ao: ShaderMaterial;
  private readonly aoBlurMaterial: ShaderMaterial; private readonly composite: ShaderMaterial;
  private readonly bloomColour = new Color();

  constructor(private readonly renderer: WebGLRenderer) {
    this.pixels = packedDrawable(renderer) ? 'packed' : 'half';
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new Mesh(geometry); this.quad.frustumCulled = false;
    const pixels = this.pixels;
    this.half = target(pixels); this.quarter = target(pixels); this.blur = target(pixels);
    this.aoRaw = target('two'); this.aoBlur = target('two');
    for (let i = 0; i < BLOOM_LEVELS; i++) this.down.push(target(pixels));
    for (let i = 0; i < BLOOM_LEVELS - 1; i++) this.up.push(target(pixels));
    const input = (): Record<string, { value: unknown }> => ({ tInput: { value: null }, texel: { value: new Vector2() } });
    this.box = pass(DOWN_BOX, { ...input(), threshold: { value: 1 }, knee: { value: 0.5 } });
    this.bright = pass(DOWN_BOX, { ...input(), threshold: { value: 1 }, knee: { value: 0.5 } }, { THRESHOLD: '' });
    this.dualDown = pass(DUAL_DOWN, input());
    this.dualUp = pass(DUAL_UP, { ...input(), tBase: { value: null }, spread: { value: 1 } });
    this.dualUpAdd = pass(DUAL_UP, { ...input(), tBase: { value: null }, spread: { value: 1 } }, { ADD: '' });
    this.ao = pass(AO, { tDepth: { value: null }, depthTexel: { value: new Vector2() }, aoSize: { value: new Vector2() },
      unproject: { value: new Vector2(1, 1) }, projScale: { value: 1 }, cameraNear: { value: 1 }, cameraFar: { value: 1000 },
      radius: { value: 2 }, intensity: { value: 6 }, maxDistance: { value: 4000 } });
    this.aoBlurMaterial = pass(AO_BLUR, { tInput: { value: null }, blurStep: { value: new Vector2() } });
    this.composite = new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: COMPOSITE, blending: NoBlending,
      depthTest: false, depthWrite: false, uniforms: {
        tScene: { value: null }, tAo: { value: null }, tBloom: { value: null }, tBlur: { value: null }, tBlurMore: { value: null },
        aoOn: { value: 0 }, aoStrength: { value: 0 }, aoTint: { value: new Color() }, fogNear: { value: 1e9 }, fogFar: { value: 2e9 },
        bloomOn: { value: 0 }, bloomColour: { value: new Color() }, tiltOn: { value: 0 }, tiltStrength: { value: 0 },
        tiltFocus: { value: 0.5 }, tiltBand: { value: 0.3 }, vignette: { value: 0 }, vignetteTint: { value: new Color() },
        aspect: { value: 1 }, sceneTexel: { value: new Vector2() },
      } });
  }

  setEffects(effects: Readonly<PostEffects>): void {
    this.effects = { ao: effects.ao, bloom: effects.bloom, tiltShift: effects.tiltShift };
  }

  setSize(width: number, height: number): void {
    width = Math.max(1, Math.round(width)); height = Math.max(1, Math.round(height));
    if (width === this.width && height === this.height && this.scene) return;
    this.width = width; this.height = height;
    this.scene?.setSize(width, height);
    const hw = Math.ceil(width / 2), hh = Math.ceil(height / 2);
    this.half.setSize(hw, hh); this.blur.setSize(hw, hh); this.quarter.setSize(Math.ceil(hw / 2), Math.ceil(hh / 2));
    this.aoRaw.setSize(hw, hh); this.aoBlur.setSize(hw, hh);
    let w = hw, h = hh;
    for (let i = 0; i < BLOOM_LEVELS; i++) { this.down[i].setSize(w, h); if (i < BLOOM_LEVELS - 1) this.up[i].setSize(w, h); w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2)); }
  }

  /**
   * The picture the city is drawn into, one sample a pixel, with its depth kept for the contact shadows; the last pass
   * smooths its edges (FXAA). Four samples a pixel looked a little sharper but cost 3 to 10 ms a frame on a notebook's
   * integrated graphics in a city of trees and houses, more than every effect together (docs/3d/RENDERER_SPEC.md 8A)
   */
  private sceneTarget(): WebGLRenderTarget {
    const depth = this.effects.ao;
    if (this.scene && this.sceneHasDepth === depth) return this.scene;
    this.scene?.dispose();
    const t = new WebGLRenderTarget(this.width, this.height, { ...format(this.pixels),
      minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false,
      ...(depth ? { depthTexture: new DepthTexture(this.width, this.height) } : {}) });
    this.scene = t; this.sceneHasDepth = depth;
    return t;
  }

  private draw(material: ShaderMaterial, output: WebGLRenderTarget | null): void {
    this.quad.material = material; this.renderer.setRenderTarget(output); this.renderer.render(this.quad, this.quadCamera);
  }

  /** One step of a chain: `input` into `output`, its taps a texel of the input apart */
  private step(material: ShaderMaterial, input: Texture, inputWidth: number, inputHeight: number, output: WebGLRenderTarget): void {
    material.uniforms.tInput.value = input; (material.uniforms.texel.value as Vector2).set(1 / inputWidth, 1 / inputHeight);
    this.draw(material, output);
  }

  render(scene: Scene, camera: PerspectiveCamera, look: PostLook): void {
    const renderer = this.renderer, fx = this.effects, previous = renderer.getRenderTarget();
    const sceneTarget = this.sceneTarget(), w = this.width, h = this.height, hw = this.half.width, hh = this.half.height;
    renderer.setRenderTarget(sceneTarget); renderer.render(scene, camera);
    const c = this.composite.uniforms;
    c.tScene.value = sceneTarget.texture; c.aspect.value = w / h;
    (c.sceneTexel.value as Vector2).set(1 / w, 1 / h);
    // Contact shadows, half size, then blurred across and down
    c.aoOn.value = fx.ao && look.ao.strength > 0.01 ? 1 : 0;
    if (c.aoOn.value) {
      const u = this.ao.uniforms, projection = camera.projectionMatrix.elements;
      u.tDepth.value = sceneTarget.depthTexture; (u.depthTexel.value as Vector2).set(1 / w, 1 / h);
      (u.aoSize.value as Vector2).set(hw, hh); (u.unproject.value as Vector2).set(1 / projection[0], 1 / projection[5]);
      u.projScale.value = hh * projection[5] / 2; u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
      u.radius.value = look.ao.radius; u.maxDistance.value = look.fog ? look.fog.far : camera.far;
      this.draw(this.ao, this.aoRaw);
      const b = this.aoBlurMaterial.uniforms;
      b.tInput.value = this.aoRaw.texture; (b.blurStep.value as Vector2).set(1 / hw, 0); this.draw(this.aoBlurMaterial, this.aoBlur);
      b.tInput.value = this.aoBlur.texture; (b.blurStep.value as Vector2).set(0, 1 / hh); this.draw(this.aoBlurMaterial, this.aoRaw);
      c.tAo.value = this.aoRaw.texture; c.aoStrength.value = look.ao.strength; (c.aoTint.value as Color).copy(look.ao.tint);
      c.fogNear.value = look.fog ? look.fog.near : 1e9; c.fogFar.value = look.fog ? look.fog.far : 2e9;
    }
    // The tilt-shift's blurred copies: half size, a quarter, and the quarter brought back up to half
    c.tiltOn.value = fx.tiltShift && look.tilt.strength > 0.01 ? 1 : 0;
    if (c.tiltOn.value) {
      this.step(this.box, sceneTarget.texture, w, h, this.half);
      this.step(this.dualDown, this.half.texture, hw, hh, this.quarter);
      this.step(this.dualUp, this.quarter.texture, this.quarter.width, this.quarter.height, this.blur);
      c.tBlur.value = this.blur.texture; c.tBlurMore.value = this.quarter.texture;
      c.tiltStrength.value = look.tilt.strength; c.tiltFocus.value = look.tilt.focus; c.tiltBand.value = look.tilt.band;
      c.vignette.value = look.vignette.strength; (c.vignetteTint.value as Color).copy(look.vignette.tint);
    } else c.vignette.value = 0;
    // The glow: what shines, half size, down to a thirty-second and back up, each size added in
    c.bloomOn.value = fx.bloom && look.bloom.strength > 0.005 ? 1 : 0;
    if (c.bloomOn.value) {
      const bright = this.bright.uniforms; bright.threshold.value = look.bloom.threshold; bright.knee.value = Math.max(0.01, look.bloom.knee);
      this.step(this.bright, sceneTarget.texture, w, h, this.down[0]);
      for (let i = 1; i < BLOOM_LEVELS; i++) this.step(this.dualDown, this.down[i - 1].texture, this.down[i - 1].width, this.down[i - 1].height, this.down[i]);
      const spread = Math.min(1, Math.max(0, look.bloom.spread));
      let source = this.down[BLOOM_LEVELS - 1];
      for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
        this.dualUpAdd.uniforms.tBase.value = this.down[i].texture; this.dualUpAdd.uniforms.spread.value = spread;
        this.step(this.dualUpAdd, source.texture, source.width, source.height, this.up[i]); source = this.up[i];
      }
      // Each size was added in once: share the strength out over them
      let total = 0; for (let i = 0, weight = 1; i < BLOOM_LEVELS; i++, weight *= spread) total += weight;
      c.tBloom.value = this.up[0].texture;
      (c.bloomColour.value as Color).copy(this.bloomColour.copy(look.bloom.tint).multiplyScalar(look.bloom.strength / total));
    }
    this.draw(this.composite, null);
    renderer.setRenderTarget(previous);
  }

  dispose(): void {
    this.scene?.dispose(); this.scene = undefined;
    for (const t of [this.half, this.quarter, this.blur, this.aoRaw, this.aoBlur, ...this.down, ...this.up]) t.dispose();
    for (const m of [this.box, this.bright, this.dualDown, this.dualUp, this.dualUpAdd, this.ao, this.aoBlurMaterial, this.composite]) m.dispose();
    this.quad.geometry.dispose();
  }
}
