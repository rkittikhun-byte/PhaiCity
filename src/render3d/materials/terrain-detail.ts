/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Material, Texture, Vector2, Vector3 } from 'three';
import { loadMaterialTextures } from './textures.js';

/** Metres, rather than simulation cells, set the size of grains and scanned ground. */
export const terrainDetailUniforms = {
  cityTerrainFocus: { value: new Vector3(0, 0, 10000) },
  cityMetresPerUnit: { value: 1.6 },
  cityGroundScansReady: { value: 0 },
  cityGrassScan: { value: null as Texture | null }, citySoilScan: { value: null as Texture | null },
  cityGrassNormal: { value: null as Texture | null }, citySoilNormal: { value: null as Texture | null },
  cityGrassRepeat: { value: new Vector2(1, 1) }, citySoilRepeat: { value: new Vector2(1, 1) },
};
let requested = false;
function prepareScans(): void {
  if (requested || typeof document === 'undefined') return;
  requested = true;
  // Reuse already credited CC0 scans; a failed load keeps the procedural surface.
  void Promise.all([loadMaterialTextures('grass'), loadMaterialTextures('dirt_laterite')]).then(([grass, soil]) => {
    if (!grass?.color || !grass.normal || !soil?.color || !soil.normal) return;
    terrainDetailUniforms.cityGrassScan.value = grass.color;
    terrainDetailUniforms.citySoilScan.value = soil.color;
    terrainDetailUniforms.cityGrassNormal.value = grass.normal;
    terrainDetailUniforms.citySoilNormal.value = soil.normal;
    terrainDetailUniforms.cityGrassRepeat.value.copy(grass.color.repeat);
    terrainDetailUniforms.citySoilRepeat.value.copy(soil.color.repeat);
    terrainDetailUniforms.cityGroundScansReady.value = 1;
  });
}

/** Adds PBR ground layers after the shared province/water/ownership hook. */
export function configureTerrainDetail(material: Material): void {
  prepareScans();
  const original = material.onBeforeCompile, program = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    original.call(material, shader, renderer);
    Object.assign(shader.uniforms, terrainDetailUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 cityGroundNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        cityGroundNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 cityGroundNormal;
      uniform vec3 cityTerrainFocus;
      uniform float cityMetresPerUnit;
      uniform float cityGroundScansReady;
      uniform sampler2D cityGrassScan, citySoilScan, cityGrassNormal, citySoilNormal;
      uniform vec2 cityGrassRepeat, citySoilRepeat;
      float cityGroundHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float cityGroundNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(cityGroundHash(i), cityGroundHash(i+vec2(1.0,0.0)), f.x),
          mix(cityGroundHash(i+vec2(0.0,1.0)), cityGroundHash(i+1.0), f.x), f.y);
      }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          // Blend back to the existing terrain before the edge of the 3×3 mesh window; depth always has a fallback.
          float groundCoverage = (1.0-smoothstep(58.0,78.0,length(cityWorldXZ-cityTerrainFocus.xy)))
            * (1.0-smoothstep(480.0,850.0,cityTerrainFocus.z));
          vec2 cell = mod(floor(gl_FragCoord.xy),4.0), low = mod(cell,2.0), high = floor(cell/2.0);
          float threshold = (4.0*(2.0*low.x+3.0*low.y-4.0*low.x*low.y)
            +2.0*high.x+3.0*high.y-4.0*high.x*high.y+0.5)/16.0;
          if (threshold >= groundCoverage) discard;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 groundMetres = cityWorldXZ * cityMetresPerUnit;
        float groundPixel = max(length(dFdx(groundMetres)), length(dFdy(groundMetres)));
        float groundDetail = (1.0-smoothstep(58.0,78.0,length(cityWorldXZ-cityTerrainFocus.xy)))
          * (1.0-smoothstep(480.0,850.0,cityTerrainFocus.z));
        float groundWet = cityMaskOn > 0.5 ? texture2D(cityMask, cityWorldXZ/10.0/cityMaskSize).g : 0.0;
        groundDetail *= 1.0-smoothstep(0.35,0.56,groundWet);
        float groundRock = smoothstep(0.08,0.35,1.0-abs(normalize(cityGroundNormal).y));
        float groundShore = smoothstep(0.03,0.36,groundWet)*(1.0-groundRock);
        float groundNoise = cityGroundNoise(groundMetres*0.08);
        float groundGreen = smoothstep(0.015,0.10,diffuseColor.g-diffuseColor.r);
        float groundSoil = clamp((1.0-groundGreen)*0.7+(groundNoise-0.45)*0.65,0.0,1.0);
        vec2 groundBump = vec2(0.0);
        if (groundDetail > 0.001) {
          vec3 groundColour = diffuseColor.rgb;
          float scanGrain = 1.0;
          if (cityGroundScansReady > 0.5) {
            vec2 grassUV = groundMetres*cityGrassRepeat, soilUV = groundMetres*citySoilRepeat;
            vec3 grassScan = texture2D(cityGrassScan,grassUV).rgb;
            vec3 soilScan = texture2D(citySoilScan,soilUV).rgb;
            // Keep OSM land-cover colours, borrowing the scans' texture rather than bleaching them.
            scanGrain = clamp(dot(mix(grassScan,soilScan,groundSoil),vec3(0.2126,0.7152,0.0722))*2.5,0.55,1.35);
            groundBump = mix(texture2D(cityGrassNormal,grassUV).xy,
              texture2D(citySoilNormal,soilUV).xy,groundSoil)*2.0-1.0;
          }
          float grainVisible = 1.0-smoothstep(0.25,1.6,groundPixel);
          float flecks = cityGroundNoise(groundMetres*3.0)-0.5;
          groundColour *= mix(1.0,scanGrain,grainVisible*0.48)*(0.94+groundNoise*0.12+flecks*0.10*grainVisible);
          groundColour = mix(groundColour,vec3(0.34,0.23,0.13)*(0.85+groundNoise*0.3),groundSoil*0.22);
          groundColour = mix(groundColour,vec3(0.46,0.37,0.23)*(0.90+flecks*0.16),groundShore*0.65);
          // World-space rock grain remains well scaled on steep faces without stretched UVs.
          float rockStrata = sin(groundMetres.x*0.27+groundMetres.y*0.19+groundNoise*4.0);
          groundColour = mix(groundColour,vec3(0.27,0.265,0.24)*(0.90+rockStrata*0.11+flecks*0.16),groundRock*0.82);
          diffuseColor.rgb = mix(diffuseColor.rgb,groundColour,groundDetail);
          groundBump *= groundDetail*grainVisible*(1.0-groundShore*0.7);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor,mix(0.96,0.68,groundShore),groundDetail);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + mat3(viewMatrix)*vec3(groundBump.x,0.0,groundBump.y)*0.24);`);
  };
  material.customProgramCacheKey = () => `phaicity-ground-detail-v1:${program}`;
}
