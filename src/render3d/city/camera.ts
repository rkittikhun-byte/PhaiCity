/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { groundAt } from './picking.js';
export class CityCamera {
  readonly camera=new PerspectiveCamera(38,1,1,12000); readonly target:Vector3;
  heading=0; pitch=55*Math.PI/180; distance=240;
  private fly?:{from:Vector3;to:Vector3;start:number}; private shaking=-Infinity;
  private lastMove=new Map<string,number>();
  private interaction=-Infinity;
  get lastInteractionAt():number {return this.interaction;}
  isAnimating(time:number):boolean {return !!this.fly||(!this.reducedMotion&&time-this.shaking<550);}
  constructor(readonly mapWidth:number,readonly mapHeight:number,private readonly now:()=>number,readonly reducedMotion=false) {
    this.target=new Vector3(mapWidth*5,0,mapHeight*5); this.update(now());
  }
  clamp():void {this.target.x=Math.max(0,Math.min(this.mapWidth*10,this.target.x));this.target.z=Math.max(0,Math.min(this.mapHeight*10,this.target.z));}
  update(time:number,tallest=0):void {
    if(this.fly){const t=Math.min(1,Math.max(0,(time-this.fly.start)/550)),ease=t*t*(3-2*t);this.target.lerpVectors(this.fly.from,this.fly.to,ease);if(t===1)this.fly=undefined;}
    this.clamp();
    this.camera.position.set(this.target.x+Math.sin(this.heading)*Math.cos(this.pitch)*this.distance,
      Math.max(this.distance*Math.sin(this.pitch),tallest+8),this.target.z+Math.cos(this.heading)*Math.cos(this.pitch)*this.distance);
    const age=time-this.shaking;
    if(age>=0&&age<550&&!this.reducedMotion){const amplitude=(1-age/550)*1.4;this.camera.position.x+=Math.sin(age*.08)*amplitude;this.camera.position.y+=Math.sin(age*.13)*amplitude;}
    this.camera.lookAt(this.target);this.camera.updateMatrixWorld();
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
  rotate(dx:number,dy:number):void {if(dx||dy)this.interaction=this.now();this.fly=undefined;this.heading-=dx*.006;this.pitch=Math.max(Math.PI/6,Math.min(Math.PI*85/180,this.pitch+dy*.004));this.update(this.now());}
  pan(dx:number,dy:number,height:number):void {
    if(dx||dy)this.interaction=this.now();
    this.fly=undefined;const scale=this.distance*2*Math.tan(19*Math.PI/180)/Math.max(1,height);
    this.target.x-=Math.cos(this.heading)*dx*scale+Math.sin(this.heading)*dy*scale;
    this.target.z+=Math.sin(this.heading)*dx*scale-Math.cos(this.heading)*dy*scale;this.clamp();this.update(this.now());
  }
  zoom(delta:number,x:number,y:number,width:number,height:number):void {
    if(delta)this.interaction=this.now();
    const before=groundAt(this.camera,x,y,width,height);this.distance=Math.max(60,Math.min(Math.max(this.mapWidth,this.mapHeight)*22, this.distance*Math.exp(Math.max(-300,Math.min(300,delta))*.0015)));
    this.fly=undefined;this.update(this.now());const after=groundAt(this.camera,x,y,width,height);
    if(before&&after){this.target.add(before.sub(after));this.clamp();this.update(this.now());}
  }
  shake():void {this.interaction=this.now();this.shaking=this.now();}
  wholeMap():void {this.interaction=this.now();this.distance=Math.max(this.mapWidth*10/(this.camera.aspect||1),this.mapHeight*10)*1.85;this.target.set(this.mapWidth*5,0,this.mapHeight*5);this.pitch=75*Math.PI/180;this.fly=undefined;this.update(this.now());}
  reset():void {this.interaction=this.now();this.heading=0;this.pitch=55*Math.PI/180;this.distance=240;this.target.set(this.mapWidth*5,0,this.mapHeight*5);this.fly=undefined;this.update(this.now());}
}
