/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { SPRITE_UNITS_PER_TILE } from '../../cityView.js';
import { getPreviewGround } from '../materials/library.js';
import { tileSeed } from './tileModels.js';
import { seededRng } from '../rng.js';
import { registry } from '../models/registry.js';
import { disposeModel, visibleMeshes } from '../util/geometry.js';
import type { Placement, BlockMapReader } from './types.js';
export interface CitySprite {type:number;x:number;y:number;xOffset?:number;yOffset?:number;width?:number;height?:number;frame?:number}
export function spritePosition(s:CitySprite):Vector3 {
  const k=10/SPRITE_UNITS_PER_TILE;
  return new Vector3((s.x+(s.xOffset??0)+(s.width??16)/2)*k,[0,.42,60,120,-.6,0,0,.1][s.type]??0,
    (s.y+(s.yOffset??0)+(s.height??16)/2)*k);
}
export class CitySprites {
  readonly root=new Group();private geometry=new BoxGeometry(1,1,1);private mesh:InstancedMesh;
  private unknown:InstancedMesh;
  private positions=new Map<unknown,Vector3>();private last=new Map<unknown,Vector3>();
  private angles=new Map<unknown,number>();
  /** How big the cars, trains and the rest are drawn: their real size on a real-scale city map (tileModels.ts atRealSize) */
  size=1;
  /** The simulation's train is not drawn where a real one runs the railway as drawn (railTrains.ts) */
  hideTrains=false;
  constructor(){this.mesh=new InstancedMesh(this.geometry,getPreviewGround(),128);this.mesh.count=0;this.mesh.castShadow=true;this.mesh.frustumCulled=false;this.root.add(this.mesh);
    const debug=registry['debug.box_3x3'].factory({seed:0}),source=visibleMeshes(debug)[0];
    this.unknown=new InstancedMesh(source.geometry.clone().scale(1/3,1/3,1/3),source.material,128);this.unknown.count=0;this.unknown.frustumCulled=false;this.root.add(this.unknown);disposeModel(debug);
  }
  update(values:unknown[]|null,dt:number,paused:boolean,roads:readonly Placement[]=[],traffic?:BlockMapReader,seconds=0,ground:(x:number,z:number)=>number=()=>0):void {
    const active=new Set<unknown>(),matrix=new Matrix4(),color=new Color();let n=0,unknownCount=0;
    for(const value of values??[]){if(n+unknownCount>=128)break;const s=value as CitySprite;if(!s||!Number.isFinite(s.x+s.y+s.type)||(this.hideTrains&&s.type===1))continue;
      active.add(value);const goal=spritePosition(s);goal.y+=ground(goal.x,goal.z);const p=this.positions.get(value)??goal.clone(),previous=this.last.get(value)??goal;
      if(!paused)p.lerp(goal,1-Math.exp(-dt*12));this.positions.set(value,p);
      const motion=goal.clone().sub(previous),facing=motion.lengthSq()>.0001?Math.atan2(motion.x,motion.z):(Math.max(1,s.frame??1)-1)*Math.PI/4;
      const angle=paused?(this.angles.get(value)??facing):facing;this.angles.set(value,angle);
      if(!paused)this.last.set(value,goal);
      if(!Number.isInteger(s.type)||s.type<1||s.type>7){matrix.makeRotationY(angle).setPosition(p);this.unknown.setMatrixAt(unknownCount++,matrix);continue;}
      const k=this.size,size=(s.type===1?[2.8,2.2,10]:s.type===2?[7,2,3]:s.type===3?[14,2.5,10]:s.type===4?[5,3,15]:s.type===5?[5,7,9]:[4,6,4]).map(n=>n*k);
      matrix.makeRotationY(angle).scale(new Vector3(...size as [number,number,number])).setPosition(p.x,p.y+size[1]/2,p.z);
      this.mesh.setMatrixAt(n,matrix);this.mesh.setColorAt(n,color.setHex([0xb76cb0,0xbc7147,0xf4dc71,0xebecdb,0x637e86,0x67aa78,0x9dafa6,0xe8904d][s.type]??0xb76cb0));n++;
    }
    for(const key of this.positions.keys())if(!active.has(key)){this.positions.delete(key);this.last.delete(key);this.angles.delete(key);}
    for(const p of roads){if(n+unknownCount>=128)break;const x=Math.floor(p.x/10),y=Math.floor(p.z/10),random=seededRng(tileSeed(x,y));
      if(random()*255>Math.max(0,traffic?.worldGet(x,y)??0))continue;
      const k=this.size,direction=random()<.5?1:-1,t=((seconds*4+random()*10)%10)-5,offset=direction*1.6*k;
      const px=p.x+Math.sin(p.rotation)*t+Math.cos(p.rotation)*offset,pz=p.z+Math.cos(p.rotation)*t-Math.sin(p.rotation)*offset;
      matrix.makeRotationY(p.rotation+(direction<0?Math.PI:0)).scale(new Vector3(1.65*k,1.25*k,3.4*k)).setPosition(px,ground(px,pz)+.73*k,pz);
      this.mesh.setMatrixAt(n,matrix);this.mesh.setColorAt(n,color.setHex([0xdfc89b,0xbdcfcd,0x95b2a2,0xd8a088][Math.floor(random()*4)]));n++;
    }
    this.mesh.count=n;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
    this.unknown.count=unknownCount;this.unknown.instanceMatrix.needsUpdate=true;
  }
  dispose():void{this.mesh.dispose();this.geometry.dispose();this.unknown.dispose();this.unknown.geometry.dispose();this.positions.clear();this.last.clear();this.angles.clear();this.root.clear();}
}
