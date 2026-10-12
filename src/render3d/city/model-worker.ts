/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { registry } from '../models/registry.js';
import { disposeModel } from '../util/geometry.js';
import { serializeModel } from './model-serialization.js';
import type { PrototypeRequest, SerializedPrototype } from './prototypes.js';
const worker=self as unknown as {onmessage:(e:MessageEvent<PrototypeRequest>)=>void;postMessage:(data:SerializedPrototype,transfer:ArrayBuffer[])=>void};
worker.onmessage=({data})=>{
  const transfer:ArrayBuffer[]=[];let result:SerializedPrototype={key:data.key,parts:[],height:0};
  let root:ReturnType<typeof registry[string]['factory']>|undefined;
  try {
    root=registry[data.id].factory({...data.options,worldOrigin:[0,0],worldRotationY:0});
    const serialized=serializeModel(data.key,root);result=serialized.value;transfer.push(...serialized.transfer);
  } catch(error){result={key:data.key,parts:[],height:0,error:String(error)};}
  finally {if(root)disposeModel(root);}
  worker.postMessage(result,transfer);
};
