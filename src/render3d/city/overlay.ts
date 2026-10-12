/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three';
import { clipToMap, toolFootprint, ToolHover } from '../../cityView.js';
import { cityToolMaterial } from '../materials/library.js';
export class ToolOutline {
  readonly root=new Group();private signature='';
  constructor(private width:number,private height:number) {this.root.renderOrder=10;}
  update(hover:ToolHover|null):void {
    const r=hover?clipToMap(toolFootprint(hover),this.width,this.height):null;
    const signature=JSON.stringify([r,hover?.colour]);if(signature===this.signature)return;this.signature=signature;this.clear();
    if(!r||!hover)return;
    const w=(r.x1-r.x0+1)*10,d=(r.y1-r.y0+1)*10,x=(r.x0+r.x1+1)*5,z=(r.y0+r.y1+1)*5;
    const material=cityToolMaterial(hover.colour),fill=new Mesh(new PlaneGeometry(w,d).rotateX(-Math.PI/2),cityToolMaterial(hover.colour,true));
    fill.position.set(x,.56,z);fill.renderOrder=10;this.root.add(fill);
    for(const[sw,sd,sx,sz]of[[w,.10,x,z-d/2],[w,.10,x,z+d/2],[.10,d,x-w/2,z],[.10,d,x+w/2,z]]){
      const line=new Mesh(new BoxGeometry(sw,.025,sd),material);line.position.set(sx,.58,sz);line.renderOrder=11;this.root.add(line);
    }
  }
  private clear():void {this.root.traverse(n=>{if(n instanceof Mesh)n.geometry.dispose();});this.root.clear();}
  dispose():void {this.clear();}
}
