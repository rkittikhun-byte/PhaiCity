/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import {
  ClampToEdgeWrapping, Color, ColorRepresentation, DataTexture, DoubleSide, LinearFilter, Material, MeshPhysicalMaterial,
  MeshStandardMaterial, MeshStandardMaterialParameters, MeshDepthMaterial, RGBAFormat, RGBADepthPacking, MeshLambertMaterial,
  UnsignedByteType, Vector2, Vector3,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { getWaterNormal, loadMaterialTextures, TextureSet } from './textures.js';
export { SHOPHOUSE_PASTELS, shophousePastel } from './palette.js';

const definitions = {
  plaster_white: { color: 0xeee9df, roughness: 0.9 },
  plaster_cream: { color: 0xe7d6af, roughness: 0.9 },
  plaster_tint: { color: 0xffffff, roughness: 0.9 },
  concrete_raw: { color: 0xaaa99f, roughness: 0.95 },
  concrete_weathered: { color: 0x89877b, roughness: 1 },
  brick_red: { color: 0xa95c40, roughness: 0.95 },
  roof_clay_tile: { color: 0xb45532, roughness: 0.85 },
  roof_cement_tile: { color: 0x8b8f88, roughness: 0.9 },
  roof_metal_corrugated: { color: 0xaeb9bb, roughness: 0.6, metalness: 0.65 },
  roof_metal_rusty: { color: 0x94583b, roughness: 0.95, metalness: 0.25 },
  roof_metal_sheet: { color: 0x566c73, roughness: 0.4, metalness: 0.75 },
  roof_glazed_tile: { color: 0x537c76, roughness: 0.24 },
  roof_wood_shingle: { color: 0x715337, roughness: 0.95 },
  thatch_grass: { color: 0xbc9b62, roughness: 1 },
  thatch_nipa: { color: 0x92734f, roughness: 1 },
  bamboo_split: { color: 0xb99a61, roughness: 0.92 },
  bamboo_woven: { color: 0xb39960, roughness: 0.95 },
  stucco_ornament: { color: 0xf1e6d4, roughness: 0.85 },
  wood_teak: { color: 0x865b32, roughness: 0.85 },
  wood_painted: { color: 0xb2c3b4, roughness: 0.85 },
  metal_steel: { color: 0x6d797c, roughness: 0.45, metalness: 0.85 },
  metal_painted: { color: 0x506966, roughness: 0.55, metalness: 0.35 },
  roller_shutter: { color: 0x9fa8a9, roughness: 0.65, metalness: 0.65 },
  glass_clear: { color: 0xd1e8ee, roughness: 0.15 },
  glass_tinted: { color: 0x547784, roughness: 0.2 },
  asphalt: { color: 0x414546, roughness: 1 },
  road_marking_white: { color: 0xeeeade, roughness: 0.9 },
  road_marking_yellow: { color: 0xe7bb43, roughness: 0.9 },
  sidewalk_tile: { color: 0xc2b7a4, roughness: 0.95 },
  curb_red_white: { color: 0xce6257, roughness: 0.95 },
  grass: { color: 0x748a4c, roughness: 1 },
  dirt_laterite: { color: 0xb9683e, roughness: 1 },
  gravel_ballast: { color: 0x88867e, roughness: 1 },
  water_river: { color: 0x66704d, roughness: 0.3 },
  water_flood: { color: 0x927951, roughness: 0.4 },
  foliage_tropical: { color: 0x8aad73, roughness: 0.95, side: DoubleSide, alphaTest: 0.45 },
  fabric_canvas: { color: 0xc79b60, roughness: 1, side: DoubleSide },
  sign_thai: { color: 0xe4ddc3, roughness: 0.85 },
  emissive_window: { color: 0xffdca1, emissive: 0xffb75e, emissiveIntensity: 0.15, roughness: 0.4 },
} satisfies Record<string, MeshStandardMaterialParameters>;

export type MaterialKey = keyof typeof definitions;
export type VehicleMaterialKey = 'car_paint' | 'rubber_tire' | 'chrome' | 'plastic_trim_black' | 'lamp_lens' | 'tail_light_red' | 'glass_vehicle';
export const MATERIAL_KEYS = Object.freeze(Object.keys(definitions) as MaterialKey[]);
const cache = new Map<string, MeshStandardMaterial>();
const owned = new WeakSet<Material>();
const pending = new Map<MaterialKey, Promise<boolean>>();
const statuses = new Map<MaterialKey, 'loading' | 'ready' | 'fallback'>();
let nightMode = false;
let previewGround: MeshStandardMaterial | undefined;

/** Neutral diagnostic backdrop, kept outside the model-facing material keys. */
export function getPreviewGround(): MeshStandardMaterial {
  if (!previewGround) {
    previewGround = new MeshStandardMaterial({ color: 0xd9ddd1, roughness: 1 });
    previewGround.name = 'gallery/ground';
    owned.add(previewGround);
  }
  return previewGround;
}

/** Clean automotive finishes are procedural: no building scans, UV textures, or import-time loads. */
export function vehicleMaterial(key: VehicleMaterialKey, color?: ColorRepresentation): MeshStandardMaterial {
  const colors = { car_paint: 0xf4f3ef, rubber_tire: 0x202527, chrome: 0xbfc8cc, plastic_trim_black: 0x242b2c,
    lamp_lens: 0xfff3d8, tail_light_red: 0xde252b, glass_vehicle: 0x334f58 };
  const resolved = new Color(color ?? colors[key]), token = `vehicle:${key}:${resolved.getHexString()}`;
  const cached = cache.get(token); if (cached) return cached;
  const material = ['car_paint', 'glass_vehicle', 'lamp_lens', 'tail_light_red'].includes(key)
    ? new MeshPhysicalMaterial() : new MeshStandardMaterial();
  material.name = token; material.color.copy(resolved);
  material.userData = { materialKey: key, vehicleMaterial: key, procedural: true };
  if (key === 'car_paint') {
    const paint = material as MeshPhysicalMaterial;
    paint.clearcoat = 1; paint.clearcoatRoughness = 0.1; paint.roughness = 0.35;
    paint.metalness = resolved.r > 0.83 && resolved.g > 0.83 && resolved.b > 0.83 ? 0 : 0.4;
    paint.envMapIntensity = 1.1;
  } else if (key === 'rubber_tire') material.roughness = 0.88;
  else if (key === 'chrome') { material.metalness = 1; material.roughness = 0.21; }
  else if (key === 'plastic_trim_black') material.roughness = 0.72;
  else if (key === 'glass_vehicle') {
    const glass = material as MeshPhysicalMaterial;
    glass.roughness = 0.13; glass.metalness = 0.12; glass.clearcoat = 0.6; glass.envMapIntensity = 1.3;
    // Opaque tinted glass keeps small vehicle windows readable without sorting or refraction passes.
  } else {
    material.roughness = 0.18; material.emissive.copy(resolved);
    (material as MeshPhysicalMaterial).clearcoat = 0.8;
  }
  owned.add(material); cache.set(token, material); applyNight(material); return material;
}
export const car_paint = (color: ColorRepresentation): MeshPhysicalMaterial => vehicleMaterial('car_paint', color) as MeshPhysicalMaterial;

/** One automotive finish for distant display props, whose glass/tires/paint colors are baked per vertex. */
export function vehicleDisplayMaterial(): MeshPhysicalMaterial {
  const token = 'vehicle-display'; const cached = cache.get(token); if (cached) return cached as MeshPhysicalMaterial;
  const material = car_paint(0xffffff).clone(); material.name = token; material.vertexColors = true;
  material.userData = { ...material.userData, vehicleDisplay: true, vertexFinish: true };
  material.roughness = 0.45; owned.add(material); cache.set(token, material); return material;
}

function applyTextures(material: MeshStandardMaterial, key: MaterialKey, maps: TextureSet): void {
  const painted = ['road_marking_white', 'road_marking_yellow', 'sign_thai', 'emissive_window', 'curb_red_white'].includes(key);
  if (!material.userData.keepColorMap && !painted) material.map = maps.color ?? null;
  material.normalMap = maps.normal ?? null;
  // Shared ORM images use three.js's native R (AO), G (roughness), B (metalness).
  // A composite material can retain separate source repeats, such as cement roofing.
  material.roughnessMap = maps.roughness ?? null;
  material.aoMap = maps.ao ?? null;
  material.aoMapIntensity = 0.65;
  material.metalnessMap = maps.metalness ?? null;
  material.alphaMap = maps.alpha ?? null;
  if (material.map && !material.userData.tinted && !material.userData.keepColorMap &&
    !['plaster_white', 'plaster_cream', 'plaster_tint', 'roof_cement_tile', 'roof_glazed_tile', 'stucco_ornament', 'wood_painted'].includes(key)) material.color.setHex(0xffffff);
  material.normalScale.setScalar(key.startsWith('glass_') ? 0.025 : key === 'fabric_canvas' ? 0.35 : 0.65);
  if (key.startsWith('water_')) {
    material.normalMap = getWaterNormal();
    material.normalScale.setScalar(0.65);
    material.envMapIntensity = 1.4;
  }
  if (key === 'roof_cement_tile') material.metalness = 0;
  if (material.userData.polishedStone) { material.roughness = 0.22; material.normalScale.setScalar(0.1); }
  if (maps.alpha) material.alphaTest = 0.45;
  if (key.startsWith('plaster_') || ['roof_cement_tile', 'roof_glazed_tile', 'stucco_ornament'].includes(key)) {
    // A neutral painted coat retains scan grain while keeping seeded pastels legible.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float grain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.62 + 0.38 * grain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-painted-scan';
  }
  if (key === 'curb_red_white' && !material.userData.pathCurb) {
    if (!material.userData.tinted) material.color.setHex(0xffffff);
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 curbPosition;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ncurbPosition = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 curbPosition;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float band = mod(floor(curbPosition.x / 0.5), 2.0);
          diffuseColor.rgb *= mix(vec3(0.68, 0.055, 0.04), vec3(0.88, 0.86, 0.80), band);`);
    };
    material.customProgramCacheKey = () => 'phaicity-curb-bands';
  }
  if (material.userData.cityWorldUV) configureCityWorldUV(material);
  if (material.userData.cityLOD && material.onBeforeCompile !== material.userData.cityLODWrapper) {
    // Painted scans can replace their surface hook when textures arrive; restore both city layers once.
    if (material.userData.cityLODWorldUV) configureCityWorldUV(material);
    configureCityLOD(material, material.userData.cityLODCoarse);
  }
  material.needsUpdate = true;
}

/** Cached finishes retain the source scan while remaining library-owned. */
function finishedMaterial(token: string, key: MaterialKey, color: ColorRepresentation,
  configure: (material: MeshStandardMaterial) => void): MeshStandardMaterial {
  const resolved = new Color(color), cacheKey = `${token}:${resolved.getHexString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const material = getMaterial(key).clone();
  material.name = cacheKey; material.color.copy(resolved); material.userData.tinted = true;
  configure(material); owned.add(material); cache.set(cacheKey, material);
  void whenMaterialReady(key).then(ready => {
    if (ready) void loadMaterialTextures(key).then(maps => { if (maps) applyTextures(material, key, maps); });
  });
  return material;
}

/** Smooth marble-like benches and fountain stone; no new texture payload. */
export function polishedStone(color: ColorRepresentation = 0xe4e3d8): MeshStandardMaterial {
  return finishedMaterial('polished-stone', 'concrete_raw', color, material => {
    material.userData.polishedStone = true; material.roughness = 0.22; material.normalScale.setScalar(0.1);
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float grain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.87 + 0.13 * grain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-polished-stone';
  });
}

/** Internode bands follow the height of baked culms without extra meshes or texture files. */
export function bambooCulmMaterial(): MeshStandardMaterial {
  return finishedMaterial('bamboo-culm', 'wood_painted', 0x738c49, material => {
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float culmHeight;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nculmHeight = position.y;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float culmHeight;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float node = 1.0 - smoothstep(0.018, 0.032, abs(fract(culmHeight / 0.48) - 0.5) * 0.48);
          diffuseColor.rgb *= mix(vec3(0.88, 0.96, 0.72), vec3(1.12, 1.09, 0.85), node);`);
    };
    material.customProgramCacheKey = () => 'phaicity-bamboo-nodes';
  });
}

/** Subtle green contamination patch; emission remains faint in both gallery lighting modes. */
export function contaminationGlow(): MeshStandardMaterial {
  return finishedMaterial('contamination-glow', 'concrete_raw', 0x526c36, material => {
    material.emissive.setHex(0x70ae3f); material.emissiveIntensity = 0.16; material.roughness = 1;
    material.transparent = true; material.opacity = 0.24; material.depthWrite = false;
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 contaminationXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ncontaminationXZ = position.xz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 contaminationXZ;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.a *= 1.0 - smoothstep(0.2, 1.2, length(contaminationXZ - vec2(-0.5, 0.0)));`);
    };
    material.customProgramCacheKey = () => 'phaicity-contamination-haze';
  });
}

/** Opaque paint coat over a metal scan: neutral grain preserves bright safety colors. */
export function paintedSteel(color: ColorRepresentation): MeshStandardMaterial {
  return finishedMaterial('painted-steel', 'metal_painted', color, material => {
    material.metalness = 0.08; material.roughness = 0.72;
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float grain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.8 + 0.2 * grain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-painted-steel';
  });
}

/** Neutral concrete keeps scan wear without importing the scan's warm stone color. */
export function roadConcrete(color: ColorRepresentation = 0xa6aba6): MeshStandardMaterial {
  return finishedMaterial('road-concrete', 'concrete_raw', color, material => {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float grain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.70 + 0.30 * grain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-road-concrete';
  });
}

/** Baked vertex colors preserve many pastel / canvas finishes in a single batch. */
export function vertexFinish(key: MaterialKey): MeshStandardMaterial {
  return finishedMaterial(`vertex-finish-${key}`, key, 0xffffff, material => {
    material.vertexColors = true; material.userData.vertexFinish = true;
    if (key === 'metal_painted') {
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          #ifdef USE_MAP
            float paintGrain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = diffuse * (0.82 + 0.18 * paintGrain);
          #endif`);
      };
      material.customProgramCacheKey = () => 'phaicity-vertex-painted-metal';
    }
  });
}

/** Instanced tiling pieces project texture coordinates after their instance transform. */
function configureCityWorldUV(material: MeshStandardMaterial): void {
  if (material.onBeforeCompile === material.userData.cityUVWrapper) return;
  const original = material.onBeforeCompile;
  const program = material.customProgramCacheKey();
  const wrapper: typeof material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 cityP = (instanceMatrix * vec4(position, 1.0)).xyz;
        vec3 cityN = abs(mat3(instanceMatrix) * normal);
        vec2 cityUV = cityN.y >= cityN.x && cityN.y >= cityN.z ? cityP.xz : (cityN.z >= cityN.x ? cityP.xy : cityP.zy);
        #ifdef USE_MAP
          vMapUv = (mapTransform * vec3(cityUV, 1.0)).xy;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = (normalMapTransform * vec3(cityUV, 1.0)).xy;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = (roughnessMapTransform * vec3(cityUV, 1.0)).xy;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = (metalnessMapTransform * vec3(cityUV, 1.0)).xy;
        #endif
        #ifdef USE_AOMAP
          vAoMapUv = (aoMapTransform * vec3(cityUV, 1.0)).xy;
        #endif
      #endif`);
  };
  material.userData.cityUVWrapper = wrapper; material.onBeforeCompile = wrapper;
  material.customProgramCacheKey = () => `phaicity-city-world:${program}`;
}
export function cityWorldMaterial(base: MeshStandardMaterial): MeshStandardMaterial {
  if (base.userData.vehicleMaterial || base.userData.provinceSurface) return base;
  const key = base.userData.materialKey as MaterialKey;
  if (!key || ['sign_thai', 'foliage_tropical'].includes(key) || base.userData.commercialLED || base.userData.pathCurb) return base;
  return finishedMaterial(`city-world-${base.name}`, key, base.color, material => {
    material.copy(base); material.name = `city-world-${base.name}`;
    material.userData = { ...base.userData, cityWorldUV: true };
    // City glass keeps physical reflection and alpha, without an extra full-scene refraction pass.
    if (material instanceof MeshPhysicalMaterial) { material.transmission = 0; material.forceSinglePass = true; }
    material.onBeforeCompile = base.onBeforeCompile; material.customProgramCacheKey = base.customProgramCacheKey;
    if (base.userData.transportMotion) configureTransportMotion(material, base.userData.transportMotion);
    configureCityWorldUV(material);
  });
}
/**
 * The city's tiles as a texture, one texel a tile, shared by every city material: red 255 outside the province, green
 * 255 for water. Sampled with linear filtering and a smoothstep, the shade outside the province and the edges of rivers,
 * lakes and the sea follow curves instead of the tiles' steps (owner, 13 Oct 2026: "ยังมีเหลี่ยมๆ อยู่"); on the
 * ground, a land fragment inside the curve takes the water's colour and a water fragment outside it the bank's. Off
 * until a province surface sets it.
 */
const provinceMask = { cityMask: { value: null as DataTexture | null }, cityMaskSize: { value: new Vector2(1, 1) },
  cityMaskOn: { value: 0 }, cityWaterColour: { value: new Color(0x487c89) }, cityBankColour: { value: new Color(0xb49b71) } };
/** outside and water: one byte a tile each (255 or 0); null outside means none of it is set. */
/** The masks the city's ground is shaded by, 255 a tile: outside the province, water, and land the city has not
 * bought (src/landBlocks.ts), which is shaded lightly. */
export function setProvinceMask(outside: Uint8Array | null, width: number, height: number, water?: Uint8Array,
    unowned?: Uint8Array): void {
  provinceMask.cityMask.value?.dispose();
  if (!outside) { provinceMask.cityMask.value = null; provinceMask.cityMaskOn.value = 0; return; }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = outside[i]; data[i * 4 + 1] = water ? water[i] : 0; data[i * 4 + 2] = unowned ? unowned[i] : 0; data[i * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter; texture.minFilter = LinearFilter; texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping; texture.needsUpdate = true;
  provinceMask.cityMask.value = texture; provinceMask.cityMaskSize.value.set(width, height); provinceMask.cityMaskOn.value = 1;
}
/**
 * The wind the trees sway in (src/wind.ts): where it blows on the map (x, z) and how hard (0–1), and the city's
 * seconds; one set for every city material, which the view updates each frame (setCityWind).
 */
const cityWindUniforms = { cityWind: { value: new Vector3(0, 0, 0) }, cityTime: { value: 0 } };
export function setCityWind(x: number, z: number, strength: number, seconds: number): void {
  cityWindUniforms.cityWind.value.set(x, z, strength); cityWindUniforms.cityTime.value = seconds;
}
/** Leaves bend with the wind, more the higher they are, in gusts that roll across the city; trunks and roots stay put. */
const CITY_SWAY = `
  {
    float swayHeight = max(0.0, position.y - 0.8);
    float swayGust = 0.6 + 0.4 * sin(cityTime * 0.45 - dot(cityWorldXZ, cityWind.xy) * 0.012);
    float swayBend = cityWind.z * swayGust * swayHeight * swayHeight * 0.018
      * (0.75 + 0.25 * sin(cityTime * 2.3 + dot(floor(cityWorldXZ / 3.0), vec2(1.7, 2.3))));
    float swayFlutter = cityWind.z * swayHeight * 0.025 * sin(cityTime * 6.0 + position.x * 4.0 + position.z * 3.0);
    vec3 swayOffset = vec3(cityWind.x, 0.0, cityWind.y) * swayBend + vec3(swayFlutter, 0.0, swayFlutter * 0.6);
    mvPosition.xyz += (viewMatrix * vec4(swayOffset, 0.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  }`;
/** Complementary screen-door coverage keeps depth writes and avoids alpha-sorting LOD flashes. */
function configureCityLOD(material: Material, coarse: boolean): void {
  if (material.onBeforeCompile === material.userData.cityLODWrapper) return;
  const original = material.onBeforeCompile, program = material.customProgramCacheKey();
  // Leaves sway in the wind: the trees' foliage, and the far view's trees
  const sway = material.userData.materialKey === 'foliage_tropical' || material.userData.citySway === true;
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    Object.assign(shader.uniforms, provinceMask, cityWindUniforms);
    if (sway) shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>${CITY_SWAY}`);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${coarse?'attribute float instanceDetail;\n':''}attribute float cityOutside; attribute vec4 cityTerrain; attribute float cityBridgeDepth; attribute float cityGround; varying float cityProvince; varying float cityDetail; varying vec2 cityWorldXZ; varying float cityIsGround; uniform vec3 cityWind; uniform float cityTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\ncityDetail = ${coarse?'instanceDetail':'instanceColor.r'}; cityProvince = cityOutside;
        #ifdef USE_INSTANCING
          vec2 terrainUV = clamp(((mat3(instanceMatrix) * transformed).xz / 10.0) + 0.5, 0.0, 1.0);
          float u = terrainUV.x, v = terrainUV.y;
          transformed.y += u+v<=1.0 ? cityTerrain.x + u*(cityTerrain.y-cityTerrain.x) + v*(cityTerrain.z-cityTerrain.x)
            : cityTerrain.w + (1.0-v)*(cityTerrain.y-cityTerrain.w) + (1.0-u)*(cityTerrain.z-cityTerrain.w);
          // A slanted road's triangles cross the ground's fold; on a hollow tile they would dip by up to 1/16 of its twist.
          transformed.y += max(0.0, cityTerrain.y + cityTerrain.z - cityTerrain.x - cityTerrain.w) * 0.0625;
        #endif
        // Extend only the piers below the deck, leaving the deck, rails and animation pivots level.
        transformed.y -= max(0.0,(-position.y-1.0)/2.0) * cityBridgeDepth;
        {
          vec4 cityWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            cityWorld = instanceMatrix * cityWorld;
          #endif
          cityWorldXZ = (modelMatrix * cityWorld).xz;
          cityIsGround = cityGround;
        }`);
    // Detailed instances carry fade in instanceColor.r, preserving their baked geometry colours.
    // This keeps prototype geometry shared instead of copying every vertex buffer for a fade attribute.
    if(!coarse)shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`
      vColor = vec4(1.0);
      #undef USE_INSTANCING_COLOR
      #include <color_vertex>
      #define USE_INSTANCING_COLOR`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float cityDetail; varying float cityProvince; varying vec2 cityWorldXZ; varying float cityIsGround; uniform sampler2D cityMask; uniform vec2 cityMaskSize; uniform float cityMaskOn; uniform vec3 cityWaterColour; uniform vec3 cityBankColour;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Rivers, lakes and the sea meet the land along curves: the ground takes the colour of the side of the curve it
        // lies on, while its tile keeps its height (roads, rails and bridges are not ground and keep their colours)
        if (cityMaskOn > 0.5 && cityIsGround > 0.5) {
          vec2 cityCell = cityWorldXZ / 10.0;
          float cityTileWet = texelFetch(cityMask, ivec2(clamp(floor(cityCell), vec2(0.0), cityMaskSize - 1.0)), 0).g;
          float cityShapeWet = smoothstep(0.42, 0.58, texture2D(cityMask, cityCell / cityMaskSize).g);
          if (cityTileWet < 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, cityWaterColour, cityShapeWet);
          else diffuseColor.rgb = mix(cityBankColour, diffuseColor.rgb, cityShapeWet);
        }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float provinceLuma = dot(gl_FragColor.rgb, vec3(0.2126,0.7152,0.0722));
        float cityOutsideShade = cityProvince;
        if (cityMaskOn > 0.5) cityOutsideShade = smoothstep(0.35, 0.65, texture2D(cityMask, cityWorldXZ / 10.0 / cityMaskSize).r);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(gl_FragColor.rgb,vec3(provinceLuma),0.65)*0.45,cityOutsideShade);
        // Land the city has not bought, lightly (src/landBlocks.ts)
        float cityUnowned = cityMaskOn > 0.5 ? smoothstep(0.35, 0.65, texture2D(cityMask, cityWorldXZ / 10.0 / cityMaskSize).b) * (1.0 - cityOutsideShade) : 0.0;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(gl_FragColor.rgb,vec3(provinceLuma),0.3)*0.78,cityUnowned);`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
        // A fixed 4x4 Bayer pattern: coarse and detail cover opposite samples, including shadows.
        vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
        vec2 low = mod(cell, 2.0), high = floor(cell / 2.0);
        float threshold = (4.0 * (2.0 * low.x + 3.0 * low.y - 4.0 * low.x * low.y)
          + 2.0 * high.x + 3.0 * high.y - 4.0 * high.x * high.y + 0.5) / 16.0;
        if (${coarse ? 'threshold < cityDetail' : 'threshold >= cityDetail'}) discard;
        }`);
  };
  material.customProgramCacheKey = () => `phaicity-city-lod:${coarse}:${sway}:${program}`;
  material.userData.cityLODWrapper=material.onBeforeCompile;material.userData.cityLODCoarse=coarse;
}
/** Untextured, vertex-coloured surface for merged provincial terrain and compacted earth. */
export function citySurfaceMaterial():MeshStandardMaterial {
  const token='city-surface';const cached=cache.get(token);if(cached)return cached;
  const material=new MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1});material.name=token;
  material.userData={materialKey:'dirt_laterite',provinceSurface:true,keepColorMap:true};
  owned.add(material);cache.set(token,material);return material;
}
let provinceSurface:MeshLambertMaterial|undefined;
/** Matte far terrain needs diffuse light and shadows, without a per-pixel environment lookup. */
/** The land beyond a real-scale city map's edges: shaded as the province surface's land is, so the two meet unseen. */
export function cityBedMaterial(color:ColorRepresentation):MeshLambertMaterial {
  const token=`city-bed:${new Color(color).getHexString()}`,cached=cache.get(token) as unknown as MeshLambertMaterial|undefined;if(cached)return cached;
  const material=new MeshLambertMaterial({color});material.name=token;owned.add(material);cache.set(token,material as unknown as MeshStandardMaterial);
  return material;
}
let provinceTrees:MeshLambertMaterial|undefined;
/** The far view's trees: the province surface's material, swaying in the wind. */
export function cityCoarseTreeMaterial():MeshLambertMaterial {
  if(!provinceTrees){provinceTrees=new MeshLambertMaterial({color:0xffffff,vertexColors:true});provinceTrees.name='city-province-trees';
    provinceTrees.userData.citySway=true;configureCityLOD(provinceTrees,true);owned.add(provinceTrees);}
  return provinceTrees;
}
export function cityCoarseSurfaceMaterial():MeshLambertMaterial {
  if(!provinceSurface){provinceSurface=new MeshLambertMaterial({color:0xffffff,vertexColors:true});provinceSurface.name='city-province-surface';
    configureCityLOD(provinceSurface,true);owned.add(provinceSurface);}
  return provinceSurface;
}
let provinceEdge:LineMaterial|undefined;
export function provinceEdgeMaterial():LineMaterial {
  if(!provinceEdge){provinceEdge=new LineMaterial({color:0xffba62,linewidth:2.5,worldUnits:false,depthWrite:false,depthTest:false,transparent:true,opacity:.95});provinceEdge.name='city-province-edge';owned.add(provinceEdge);}
  return provinceEdge;
}
export function cityLODMaterial(base: MeshStandardMaterial, coarse = false): MeshStandardMaterial {
  const token=`city-lod-${coarse}-${base.name}:${base.color.getHexString()}`,cached=cache.get(token);if(cached)return cached;
  const world=cityWorldMaterial(base),material=world.clone();material.name=token;
  // The inherited hook already projects world UVs. Texture readiness must not wrap it a second time.
  material.userData={...world.userData,cityLODWorldUV:!!world.userData.cityWorldUV,cityWorldUV:false,cityLOD:true};
  material.onBeforeCompile=world.onBeforeCompile;material.customProgramCacheKey=world.customProgramCacheKey;configureCityLOD(material,coarse);
  owned.add(material);cache.set(token,material);
  const key=base.userData.materialKey as MaterialKey|undefined;
  if(key&&!base.userData.vehicleMaterial&&!base.userData.provinceSurface)void whenMaterialReady(key).then(ready=>{if(ready)void loadMaterialTextures(key).then(maps=>{if(maps)applyTextures(material,key,maps);});});
  return material;
}
const cityDepthMaterials=new WeakMap<Material,MeshDepthMaterial>();
export function cityLODDepthMaterial(base:MeshStandardMaterial): MeshDepthMaterial {
  const cached=cityDepthMaterials.get(base);if(cached)return cached;
  const material=new MeshDepthMaterial({depthPacking:RGBADepthPacking,side:base.side,map:base.map,alphaMap:base.alphaMap,alphaTest:base.alphaTest});
  if(base.userData.transportMotion)configureTransportMotion(material,base.userData.transportMotion);
  configureCityLOD(material,false);owned.add(material);cityDepthMaterials.set(base,material);
  const key=base.userData.materialKey as MaterialKey|undefined;
  if(key&&!base.userData.vehicleMaterial)void whenMaterialReady(key).then(()=>{material.map=base.map;material.alphaMap=base.alphaMap;material.alphaTest=base.alphaTest;material.needsUpdate=true;});
  return material;
}
export function cityToolMaterial(color: ColorRepresentation, fill = false): MeshStandardMaterial {
  return finishedMaterial(`city-tool-${fill}`, 'sign_thai', color, material => {
    material.userData.keepColorMap = true; material.map = null;
    material.transparent = fill; material.opacity = fill ? 0.10 : 0.95;
    material.depthWrite = false; material.roughness = 1;
    material.polygonOffset = true; material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
  });
}

/**
 * The grid of tiles that can take painted zones (src/plots.ts, src/render3d/city/overlay.ts ZoneGrid): pale cells
 * over the ground, see-through, the gaps between them the grid's lines, as Cities: Skylines draws its zone cells.
 */
export function cityZoneGridMaterial(color: ColorRepresentation = 0xe9eef2): MeshStandardMaterial {
  return finishedMaterial('city-zone-grid', 'sign_thai', color, material => {
    material.userData.keepColorMap = true; material.map = null;
    material.transparent = true; material.opacity = 0.42;
    material.depthWrite = false; material.roughness = 1;
    material.polygonOffset = true; material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
  });
}

/** A line being drawn (src/drawModes.ts): a see-through band over the ground, as Cities: Skylines previews a road. */
export function cityDrawMaterial(color: ColorRepresentation): MeshStandardMaterial {
  return finishedMaterial('city-draw', 'sign_thai', color, material => {
    material.userData.keepColorMap = true; material.map = null;
    material.transparent = true; material.opacity = 0.42;
    material.depthWrite = false; material.roughness = 1;
    material.emissive.set(color); material.emissiveIntensity = 0.35;
    material.polygonOffset = true; material.polygonOffsetFactor = -3;
    material.polygonOffsetUnits = -3;
  });
}

const commercialDisplayClock = { value: 0 };
/** Fictional moving color bands and visible LED pixels; no external image or brand. */
export function commercialLEDMaterial(): MeshStandardMaterial {
  return finishedMaterial('commercial-led', 'emissive_window', 0xffffff, material => {
    material.userData.commercialLED = true; material.userData.keepColorMap = true;
    material.map = null; material.emissive.setHex(0xffffff); material.roughness = 0.55;
    material.onBeforeCompile = shader => {
      shader.uniforms.commercialTime = commercialDisplayClock;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 displayUV;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ndisplayUV = uv;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float commercialTime;\nvarying vec2 displayUV;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 cell = fract(displayUV * vec2(64.0, 36.0));
          float dots = 1.0 - smoothstep(0.34, 0.47, length(cell - 0.5));
          float sweep = 0.5 + 0.5 * sin(displayUV.x * 9.0 + displayUV.y * 5.0 - commercialTime * 0.65);
          vec3 pixels = mix(vec3(0.10, 0.37, 0.43), vec3(0.77, 0.55, 0.27), sweep);
          diffuseColor.rgb *= pixels * (0.25 + dots * 0.75);
          totalEmissiveRadiance *= pixels * dots;`);
    };
    material.customProgramCacheKey = () => 'phaicity-commercial-led-v1';
  });
}
/** Neutral scan grain keeps civic paving and seating concrete grey under their baked colors. */
export function serviceConcreteMaterial(): MeshStandardMaterial {
  return finishedMaterial('service-concrete', 'concrete_weathered', 0xffffff, material => {
    material.vertexColors = true; material.userData.vertexFinish = true; material.userData.serviceConcrete = true;
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float civicGrain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.80 + 0.20 * civicGrain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-service-concrete';
  });
}

/** Separate from canopy canvas so an instanced crowd remains one material batch. */
export function stadiumCrowdMaterial(): MeshStandardMaterial {
  return finishedMaterial('stadium-crowd', 'fabric_canvas', 0xffffff, material => {
    material.vertexColors = true; material.userData.stadiumCrowd = true; material.roughness = 1;
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          float crowdGrain = dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = diffuse * (0.90 + 0.10 * crowdGrain);
        #endif`);
    };
    material.customProgramCacheKey = () => 'phaicity-stadium-crowd';
  });
}

/** Match floodlights stay emissive in daylight; the empty state uses unlit housings. */
export function stadiumFloodlightMaterial(): MeshStandardMaterial {
  return finishedMaterial('stadium-floodlight', 'emissive_window', 0xfff6db, material => {
    material.userData.stadiumFloodlight = true; material.emissive.setHex(0xfff1c4); material.emissiveIntensity = 4;
  });
}

/** Small warm safety beacon; fixed low emission in both gallery day and night. */
export function powerDomeGlowMaterial(): MeshStandardMaterial {
  return finishedMaterial('power-dome-glow', 'emissive_window', 0xffe6b0, material => {
    material.userData.powerDomeGlow = true; material.emissive.setHex(0xffdfa0); material.emissiveIntensity = 0.65;
  });
}

const transportClock = { value: 0 };
/** Moving parts have dedicated batches; the city animates baked prototypes on the GPU. */
export function transportCraneMaterial(): MeshStandardMaterial {
  return finishedMaterial('transport-crane', 'metal_painted', 0xffffff, material => {
    material.copy(vertexFinish('metal_painted')); material.name = 'transport-crane';
    material.userData = { ...material.userData, transportMotion: 'cranes' };
    material.onBeforeCompile = vertexFinish('metal_painted').onBeforeCompile;
    material.customProgramCacheKey = vertexFinish('metal_painted').customProgramCacheKey;
  });
}
export function transportRadarMaterial(): MeshStandardMaterial {
  return finishedMaterial('transport-radar', 'metal_painted', 0xffffff, material => {
    material.copy(vertexFinish('metal_painted')); material.name = 'transport-radar';
    material.userData = { ...material.userData, transportMotion: 'radar' };
    material.onBeforeCompile = vertexFinish('metal_painted').onBeforeCompile;
    material.customProgramCacheKey = vertexFinish('metal_painted').customProgramCacheKey;
  });
}
export function updateTransportClock(seconds: number): void {
  if (Number.isFinite(seconds)) transportClock.value = seconds;
}

function configureTransportMotion(material: Material, kind: 'cranes' | 'radar'): void {
  const original = material.onBeforeCompile, program = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer); shader.uniforms.transportTime = transportClock;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float transportTime;');
    const rotation = 'mat2(cos(transportTime * 0.65), -sin(transportTime * 0.65), sin(transportTime * 0.65), cos(transportTime * 0.65))';
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${kind === 'cranes'
      ? 'transformed.x += sin(transportTime * 0.25) * 2.0 * (position.x < 0.0 ? 1.0 : -1.0);'
      : `transformed.xz = ${rotation} * (transformed.xz - vec2(-5.0, -25.0)) + vec2(-5.0, -25.0);`}`);
    if (kind === 'radar') shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>\nobjectNormal.xz = ${rotation} * objectNormal.xz;`);
  };
  material.customProgramCacheKey = () => `phaicity-transport-${kind}:${program}`;
}

const transportDepthMaterials = new WeakMap<Material, MeshDepthMaterial>();
/** Gallery transforms already move the geometry; its shadows follow the real instances/pivot. */
export function transportMotionDepthMaterial(base: Material): MeshDepthMaterial {
  const cached = transportDepthMaterials.get(base); if (cached) return cached;
  const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  owned.add(material); transportDepthMaterials.set(base, material); return material;
}

export function updateCommercialDisplays(seconds: number): void {
  if (Number.isFinite(seconds)) commercialDisplayClock.value = seconds;
}

/** A dedicated batch for the moving observation ring, separate from static tower steel. */
export function observationDeckMaterial(): MeshStandardMaterial {
  return finishedMaterial('observation-deck', 'metal_steel', 0x9faeb2, material => {
    material.roughness = 0.34; material.userData.observationDeck = true;
  });
}

/** Road curbs measure paint bands along their path, including north/south and curved faces. */
export function roadCurbMaterial(): MeshStandardMaterial {
  return finishedMaterial('road-curb', 'curb_red_white', 0xffffff, material => {
    material.userData.pathCurb = true;
    material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float curbDistance;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ncurbDistance = uv.x;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float curbDistance;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float band = mod(floor((curbDistance + 0.001) / 0.5), 2.0);
          diffuseColor.rgb *= mix(vec3(0.68, 0.055, 0.04), vec3(0.88, 0.86, 0.80), band);`);
    };
    material.customProgramCacheKey = () => 'phaicity-road-curb-path';
  });
}

const signalClock = { value: 0 };
/** UV.x selects alternating lamps (0/1), disabled lamps (2/3), or opaque red paint (-1). */
export function railwaySignalMaterial(): MeshStandardMaterial {
  return finishedMaterial('railway-signal', 'emissive_window', 0xe62b1b, material => {
    material.userData.railwaySignal = true;
    material.emissive.setHex(0xff1707); material.emissiveIntensity = 2.5;
    material.onBeforeCompile = shader => {
      shader.uniforms.railwayTime = signalClock;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float lampPhase;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nlampPhase = floor(uv.x);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float railwayTime;\nvarying float lampPhase;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float isLamp = step(-0.5, lampPhase);
          float flash = step(0.5, fract(railwayTime + lampPhase * 0.5)) * (1.0 - step(1.5, lampPhase)) * isLamp;
          totalEmissiveRadiance *= flash;
          diffuseColor.rgb *= mix(1.0, 0.18 + flash * 0.82, isLamp);`);
    };
    material.customProgramCacheKey = () => 'phaicity-railway-flash';
  });
}

export function updateRoadSignals(seconds: number): void {
  if (Number.isFinite(seconds)) signalClock.value = seconds;
}

/** Returns immediately in Node; failures retain all original flat PBR parameters. */
export function whenMaterialReady(key: MaterialKey): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const cached = pending.get(key);
  if (cached) return cached;
  statuses.set(key, 'loading');
  const promise = loadMaterialTextures(key).then(maps => {
    statuses.set(key, maps ? 'ready' : 'fallback');
    if (maps) cache.forEach(material => {
      if (material.userData.materialKey === key) applyTextures(material, key, maps);
    });
    return Boolean(maps);
  });
  pending.set(key, promise);
  return promise;
}

export function materialTextureStatus(key: MaterialKey): string {
  return statuses.get(key) ?? 'flat';
}

/** A shared flat fallback is available immediately; local PBR maps arrive lazily. */
export function getMaterial(key: MaterialKey): MeshStandardMaterial {
  const cached = cache.get(key);
  if (cached) { void whenMaterialReady(key); return cached; }
  const definition = definitions[key];
  const material = key === 'glass_clear' || key === 'glass_tinted'
    ? new MeshPhysicalMaterial({ ...definition, transmission: key === 'glass_clear' ? 0.9 : 0.65, thickness: 0.15, ior: 1.5 })
    : new MeshStandardMaterial(definition);
  material.name = key;
  material.userData.materialKey = key;
  owned.add(material);
  cache.set(key, material);
  applyNight(material);
  void whenMaterialReady(key);
  return material;
}

/** Cached clones are library-owned; models must never clone or construct materials. */
export function tint(key: MaterialKey, color: ColorRepresentation): MeshStandardMaterial {
  const resolved = new Color(color);
  const cacheKey = `${key}#${resolved.getHexString()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const material = getMaterial(key).clone();
  material.color.copy(resolved);
  material.name = cacheKey;
  material.userData.tinted = true;
  material.onBeforeCompile = getMaterial(key).onBeforeCompile;
  material.customProgramCacheKey = getMaterial(key).customProgramCacheKey;
  owned.add(material);
  cache.set(cacheKey, material);
  // Also handles clones requested after the base's lazy loading has completed.
  void whenMaterialReady(key).then(ready => {
    if (ready) void loadMaterialTextures(key).then(maps => { if (maps) applyTextures(material, key, maps); });
  });
  return material;
}

/** Canvas signs are cached and constructed here so models use only library materials. */
export function signMaterial(token: string, configure: (material: MeshStandardMaterial) => void): MeshStandardMaterial {
  const cacheKey = `sign_thai:${token}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const material = getMaterial('sign_thai').clone();
  material.name = cacheKey;
  configure(material);
  owned.add(material);
  cache.set(cacheKey, material);
  applyNight(material);
  void whenMaterialReady('sign_thai').then(ready => {
    if (ready) void loadMaterialTextures('sign_thai').then(maps => { if (maps) applyTextures(material, 'sign_thai', maps); });
  });
  return material;
}

export function isLibraryMaterial(material: Material): boolean {
  return owned.has(material);
}

/** Shared lighting setting: update existing materials and future tinted instances. */
export function setNightMode(night: boolean): void {
  nightMode = night;
  cache.forEach(applyNight);
}

function applyNight(material: MeshStandardMaterial): void {
  if (['lamp_lens', 'tail_light_red'].includes(material.userData.vehicleMaterial)) material.emissiveIntensity = nightMode ? 1.5 : 0.015;
  if (material.userData.materialKey === 'emissive_window' && !material.userData.railwaySignal && !material.userData.stadiumFloodlight && !material.userData.powerDomeGlow) material.emissiveIntensity = nightMode ? 2.5 : 0.15;
  if (material.userData.litSign) material.emissiveIntensity = nightMode ? 1.6 : 0.3;
}
