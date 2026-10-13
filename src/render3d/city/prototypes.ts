/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Box3, BufferAttribute, BufferGeometry, MeshStandardMaterial, Sphere, Vector3 } from 'three';
import { MaterialKey, getMaterial, tint, vertexFinish, roadConcrete, paintedSteel, polishedStone,
  roadCurbMaterial, railwaySignalMaterial, bambooCulmMaterial, contaminationGlow, commercialLEDMaterial, observationDeckMaterial,
  serviceConcreteMaterial, stadiumCrowdMaterial, stadiumFloodlightMaterial, powerDomeGlowMaterial,
  transportCraneMaterial, transportRadarMaterial, vehicleMaterial, vehicleDisplayMaterial, VehicleMaterialKey } from '../materials/library.js';
import { hospitalAtlas, thaiSign, thaiSignAtlas } from '../materials/signs.js';
import type { ModelOptions } from '../models/registry.js';
export interface MaterialDescription { key:MaterialKey|VehicleMaterialKey; name:string; color:number; data:Record<string,any> }
export interface SerializedPart { attributes:Record<string,{array:Float32Array;size:number}>;index:Uint32Array|null;material:MaterialDescription;ground?:boolean;
  castShadow?:boolean;receiveShadow?:boolean;
  bounds?:{min:[number,number,number];max:[number,number,number];center:[number,number,number];radius:number} }
export interface SerializedPrototype { key:string; parts:SerializedPart[]; height:number; error?:string }
export interface PrototypeRequest {key:string;id:string;options:ModelOptions}
export interface PrototypeProvider { request(request:PrototypeRequest):void; take():SerializedPrototype[]; dispose():void }
export interface Prototype { parts:{geometry:BufferGeometry;material:MeshStandardMaterial;ground?:boolean;castShadow?:boolean;receiveShadow?:boolean}[];height:number }
function material(d:MaterialDescription):MeshStandardMaterial {
  const u=d.data,key=d.key as MaterialKey;
  if(u.vehicleDisplay)return vehicleDisplayMaterial();
  if(u.vehicleMaterial)return vehicleMaterial(u.vehicleMaterial,d.color);
  if(u.hospitalAtlas)return hospitalAtlas();
  if(u.signAtlas)return thaiSignAtlas(u.signAtlas).material;
  if(u.sign)return thaiSign(u.sign.text,u.sign.background??d.color,u.sign.foreground??0x173f35,u.sign.size,{layout:u.sign.layout,lit:u.sign.lit});
  if(u.stadiumCrowd)return stadiumCrowdMaterial();if(u.stadiumFloodlight)return stadiumFloodlightMaterial();
  if(u.serviceConcrete)return serviceConcreteMaterial();
  if(u.powerDomeGlow)return powerDomeGlowMaterial();
  if(u.transportMotion)return u.transportMotion==='cranes'?transportCraneMaterial():transportRadarMaterial();
  if(u.vertexFinish)return vertexFinish(key);
  if(u.pathCurb)return roadCurbMaterial();if(u.railwaySignal)return railwaySignalMaterial();
  if(u.polishedStone)return polishedStone(d.color);if(u.commercialLED)return commercialLEDMaterial();if(u.observationDeck)return observationDeckMaterial();
  if(d.name.startsWith('road-concrete:'))return roadConcrete(d.color);
  if(d.name.startsWith('painted-steel:'))return paintedSteel(d.color);
  if(d.name.startsWith('bamboo-culm:'))return bambooCulmMaterial();
  if(d.name.startsWith('contamination-glow:'))return contaminationGlow();
  return u.tinted?tint(key,d.color):getMaterial(key);
}
export function decodePrototype(value:SerializedPrototype):Prototype {
  return {height:value.height,parts:value.parts.map(p=>{
    const geometry=new BufferGeometry();for(const[name,a]of Object.entries(p.attributes))geometry.setAttribute(name,new BufferAttribute(a.array,a.size));
    if(p.index)geometry.setIndex(new BufferAttribute(p.index,1));
    if(p.bounds){geometry.boundingBox=new Box3(new Vector3(...p.bounds.min),new Vector3(...p.bounds.max));geometry.boundingSphere=new Sphere(new Vector3(...p.bounds.center),p.bounds.radius);}
    else {geometry.computeBoundingBox();geometry.computeBoundingSphere();}
    return{geometry,material:material(p.material),ground:p.ground,castShadow:p.castShadow,receiveShadow:p.receiveShadow};
  })};
}
