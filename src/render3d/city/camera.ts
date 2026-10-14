/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { groundAt } from './picking.js';
import type { CityHeightField } from './heightfield.js';
/** How low the camera may come round what it looks at: near the horizon, so the sky and the land beyond show (owner 13
 * and 14 Oct 2026) */
const ORBIT_PITCH=4*Math.PI/180;
/** ... and past that the camera stays put and raises its eyes, up into the sky (owner, 14 Oct 2026: "3d ไม่ใช่เหรอ มุมเงย
 * สุดๆ ได้แค่นี้เหรอ?"): pitch below ORBIT_PITCH is how far it looks up */
const MIN_PITCH=-60*Math.PI/180;
/** The lens, and the 2D view's: a long lens from far straight above, so the city lies flat like a map (owner, 14 Oct
 * 2026: "ขอ 2D อีกปุ่ม 1 ด้วย"); the same distance shows the same width of ground either way */
const FOV=38,FLAT_FOV=2,FLAT_REACH=Math.tan(FOV/2*Math.PI/180)/Math.tan(FLAT_FOV/2*Math.PI/180),FLAT_PITCH=89.9*Math.PI/180;
export class CityCamera {
  readonly camera=new PerspectiveCamera(FOV,1,1,12000); readonly target:Vector3;
  /** The 2D view: straight down, nearly without perspective; turning still works, tilting does not */
  flat=false;
  heading=0; pitch=55*Math.PI/180; distance=240;
  /** How far out the wheel may zoom: the map, or the whole province round a district (provinceBackdrop.ts) */
  maxDistance=0;
  /** How close the wheel may come, and how high over the ground and the buildings the camera stays: much closer on a
   * real-scale city map, down to the street (owner, 14 Oct 2026: "zoom เข้าสุดๆ แล้วแค่นี้เหรอ?") */
  minDistance=60; clearance=8;
  private fly?:{from:Vector3;to:Vector3;start:number}; private shaking=-Infinity;
  private lastMove=new Map<string,number>();
  private interaction=-Infinity;
  get lastInteractionAt():number {return this.interaction;}
  isAnimating(time:number):boolean {return !!this.fly||(!this.reducedMotion&&time-this.shaking<550);}
  constructor(readonly mapWidth:number,readonly mapHeight:number,private readonly now:()=>number,readonly reducedMotion=false,readonly terrain?:CityHeightField) {
    this.maxDistance=Math.max(mapWidth,mapHeight)*22;
    this.target=new Vector3(mapWidth*5,0,mapHeight*5); this.reset();
  }
  clamp():void {this.target.x=Math.max(0,Math.min(this.mapWidth*10,this.target.x));this.target.z=Math.max(0,Math.min(this.mapHeight*10,this.target.z));}
  update(time:number,tallest=0):void {
    if(this.fly){const t=Math.min(1,Math.max(0,(time-this.fly.start)/550)),ease=t*t*(3-2*t);this.target.lerpVectors(this.fly.from,this.fly.to,ease);if(t===1)this.fly=undefined;}
    this.clamp();
    this.target.y=this.terrain?.sample(this.target.x,this.target.z)??0;
    const pitch=this.flat?FLAT_PITCH:this.pitch,reach=this.flat?this.distance*FLAT_REACH:this.distance,orbit=Math.max(ORBIT_PITCH,pitch);
    this.camera.position.set(this.target.x+Math.sin(this.heading)*Math.cos(orbit)*reach,
      Math.max(this.target.y+reach*Math.sin(orbit),tallest+this.clearance),this.target.z+Math.cos(this.heading)*Math.cos(orbit)*reach);
    if(this.terrain?.enabled)this.camera.position.y=Math.max(this.camera.position.y,this.terrain.sample(this.camera.position.x,this.camera.position.z)+this.clearance);
    const age=time-this.shaking;
    if(age>=0&&age<550&&!this.reducedMotion){const amplitude=(1-age/550)*1.4;this.camera.position.x+=Math.sin(age*.08)*amplitude;this.camera.position.y+=Math.sin(age*.13)*amplitude;}
    // Zoomed far out over a province (provinceBackdrop.ts), the near and far planes move out with the camera so the
    // depth buffer still tells the district's ground from the province's just under it
    // ... and down at the street the near plane comes in, so a building beside the camera is not cut open
    const near=Math.max(Math.min(1,reach/20),reach/400),far=Math.max(12000,reach*4);
    if(near!==this.camera.near||far!==this.camera.far){this.camera.near=near;this.camera.far=far;this.camera.updateProjectionMatrix();}
    this.camera.lookAt(this.target);
    // Looking up: the eyes rise from the ground they looked at, by how far the pitch went below the orbit's
    if(pitch<ORBIT_PITCH)this.camera.rotateX(Math.atan2(this.camera.position.y-this.target.y,Math.hypot(this.camera.position.x-this.target.x,this.camera.position.z-this.target.z))-pitch);
    this.camera.updateMatrixWorld();
  }
  centreOn(x:number,y:number):void {
    this.interaction=this.now();
    const to=new Vector3(Math.max(0,Math.min(this.mapWidth*10,(x+.5)*10)),0,Math.max(0,Math.min(this.mapHeight*10,(y+.5)*10)));
    if(this.reducedMotion){this.target.copy(to);this.fly=undefined;this.update(this.now());}else this.fly={from:this.target.clone(),to,start:this.now()};
  }
  move(direction:'north'|'east'|'south'|'west'):void {
    const time=this.now(),last=this.lastMove.get(direction)??time-16;this.lastMove.set(direction,time);
    const step=Math.min(50,Math.max(0,time-last))/1000*Math.max(25,this.distance*.32);
    if(step>0)this.interaction=time;
    const angle=this.heading+({north:Math.PI,east:Math.PI/2,south:0,west:-Math.PI/2})[direction];
    this.target.x+=Math.sin(angle)*step;this.target.z+=Math.cos(angle)*step;this.fly=undefined;this.clamp();this.update(time);
  }
  rotate(dx:number,dy:number):void {if(dx||dy)this.interaction=this.now();this.fly=undefined;this.heading-=dx*.006;if(!this.flat)this.pitch=Math.max(MIN_PITCH,Math.min(Math.PI*85/180,this.pitch+dy*.004));this.update(this.now());}
  /** Into the 2D view or back to 3D, keeping the place and the zoom */
  setFlat(on:boolean):void {
    if(on===this.flat)return;this.interaction=this.now();this.flat=on;this.fly=undefined;
    this.camera.fov=on?FLAT_FOV:FOV;this.camera.updateProjectionMatrix();this.update(this.now());
  }
  pan(dx:number,dy:number,height:number):void {
    if(dx||dy)this.interaction=this.now();
    this.fly=undefined;const scale=this.distance*2*Math.tan(19*Math.PI/180)/Math.max(1,height);
    this.target.x-=Math.cos(this.heading)*dx*scale+Math.sin(this.heading)*dy*scale;
    this.target.z+=Math.sin(this.heading)*dx*scale-Math.cos(this.heading)*dy*scale;this.clamp();this.update(this.now());
  }
  zoom(delta:number,x:number,y:number,width:number,height:number):void {
    if(delta)this.interaction=this.now();
    const before=groundAt(this.camera,x,y,width,height,this.terrain),want=this.distance*Math.exp(Math.max(-300,Math.min(300,delta))*.0015);
    this.distance=Math.max(this.minDistance,Math.min(this.maxDistance,want));
    this.fly=undefined;this.update(this.now());const after=groundAt(this.camera,x,y,width,height,this.terrain);
    if(before&&after){this.target.add(before.clone().sub(after));this.clamp();this.update(this.now());}
    // At the closest the zoom goes on as a walk toward what the pointer is on, so it never just stops (owner, 14 Oct
    // 2026: "zoom อีกไม่ได้แล้ว ... มันต้องทำได้สุดๆ")
    if(want<this.minDistance){
      const towards=before??new Vector3(this.target.x-Math.sin(this.heading),0,this.target.z-Math.cos(this.heading));
      const dx=towards.x-this.camera.position.x,dz=towards.z-this.camera.position.z,length=Math.hypot(dx,dz);
      if(length>1e-6){const step=Math.min((this.minDistance-want)*3,length);this.target.x+=dx/length*step;this.target.z+=dz/length*step;this.clamp();this.update(this.now());}
    }
  }
  shake():void {this.interaction=this.now();this.shaking=this.now();}
  wholeMap():void {this.interaction=this.now();this.distance=Math.max(this.mapWidth*10/(this.camera.aspect||1),this.mapHeight*10)*1.85;this.target.set(this.mapWidth*5,0,this.mapHeight*5);this.pitch=75*Math.PI/180;this.fly=undefined;this.update(this.now());}
  reset():void {this.interaction=this.now();this.heading=0;this.pitch=55*Math.PI/180;this.distance=240;const town=this.terrain?.town;this.target.set(town?(town.x+.5)*10:this.mapWidth*5,0,town?(town.y+.5)*10:this.mapHeight*5);this.fly=undefined;this.update(this.now());}
}
