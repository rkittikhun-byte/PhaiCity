/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Box3, BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { registry } from '../models/registry.js';
import { disposeModel } from '../util/geometry.js';
import type { PrototypeRequest, SerializedPrototype, SerializedPart } from './prototypes.js';
const worker=self as unknown as {onmessage:(e:MessageEvent<PrototypeRequest>)=>void;postMessage:(data:SerializedPrototype,transfer:ArrayBuffer[])=>void};
worker.onmessage=({data})=>{
  const transfer:ArrayBuffer[]=[];let result:SerializedPrototype={key:data.key,parts:[],height:0};
  let root:ReturnType<typeof registry[string]['factory']>|undefined;
  try {
    root=registry[data.id].factory({...data.options,worldOrigin:[0,0],worldRotationY:0});root.updateMatrixWorld(true);
    result.height=new Box3().setFromObject(root).max.y;
    root.traverse(node=>{
      if(!(node instanceof Mesh))return;let ancestor=node.parent;while(ancestor){if(!ancestor.visible)return;ancestor=ancestor.parent;}if(!node.visible)return;
      const g=node.geometry.clone().applyMatrix4(node.matrixWorld),m=node.material as MeshStandardMaterial;
      const p:SerializedPart={attributes:{},index:null,ground:node.name.endsWith('/ground'),material:{key:m.userData.materialKey,name:m.name,color:m.color.getHex(),data:m.userData}};
      g.computeBoundingBox();g.computeBoundingSphere();p.bounds={min:g.boundingBox!.min.toArray(),max:g.boundingBox!.max.toArray(),center:g.boundingSphere!.center.toArray(),radius:g.boundingSphere!.radius};
      for(const[name,attribute]of Object.entries(g.attributes)) {const a=attribute as BufferAttribute,array=new Float32Array(a.array);p.attributes[name]={array,size:a.itemSize};transfer.push(array.buffer);}
      if(g.index){p.index=new Uint32Array(g.index.array);transfer.push(p.index.buffer);}result.parts.push(p);g.dispose();
    });
  } catch(error){result={key:data.key,parts:[],height:0,error:String(error)};}
  finally {if(root)disposeModel(root);}
  worker.postMessage(result,transfer);
};
