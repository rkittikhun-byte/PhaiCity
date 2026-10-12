/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import type { PrototypeProvider, PrototypeRequest, SerializedPrototype } from './prototypes.js';
export function browserPrototypeProvider():PrototypeProvider {
  const worker=new Worker(new URL('src/city-model-worker.js',document.baseURI),{type:'module'});
  const ready:SerializedPrototype[]=[],queue:PrototypeRequest[]=[];let active:PrototypeRequest|undefined,disposed=false;
  function next():void {if(!disposed&&!active&&queue.length){active=queue.shift();worker.postMessage(active);}}
  worker.onmessage=({data}:MessageEvent<SerializedPrototype>)=>{ready.push(data);active=undefined;next();};
  worker.onerror=event=>{if(active)ready.push({key:active.key,parts:[],height:0,error:event.message});active=undefined;next();};
  return {request(r){queue.push(r);next();},take(){return ready.splice(0);},dispose(){disposed=true;queue.length=0;ready.length=0;worker.terminate();}};
}
