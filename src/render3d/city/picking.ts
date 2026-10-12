/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { Camera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { clipToMap, TilePoint, TileRect } from '../../cityView.js';
const ground=new Plane(new Vector3(0,1,0),0), ray=new Raycaster(), point=new Vector3();
export function groundAt(camera:Camera,x:number,y:number,width:number,height:number):Vector3|null {
  if(width<=0||height<=0||!Number.isFinite(x+y)||x<0||y<0||x>width||y>height) return null;
  camera.updateMatrixWorld(); ray.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera);
  return ray.ray.intersectPlane(ground,point)?point.clone():null;
}
export function pickTile(camera:Camera,x:number,y:number,width:number,height:number,mapWidth:number,mapHeight:number):TilePoint|null {
  const p=groundAt(camera,x,y,width,height); if(!p||p.x<0||p.z<0||p.x>=mapWidth*10||p.z>=mapHeight*10)return null;
  return{x:Math.floor(p.x/10),y:Math.floor(p.z/10)};
}
export function visibleTileRect(camera:Camera,width:number,height:number,mapWidth:number,mapHeight:number,far:number):TileRect|null {
  if(width<=0||height<=0)return null; camera.updateMatrixWorld();
  const points=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>{
    ray.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera);
    return ray.ray.intersectPlane(ground,new Vector3())??ray.ray.at(far,new Vector3());
  });
  return clipToMap({x0:Math.floor(Math.min(...points.map(p=>p.x))/10),y0:Math.floor(Math.min(...points.map(p=>p.z))/10),
    x1:Math.floor(Math.max(...points.map(p=>p.x))/10),y1:Math.floor(Math.max(...points.map(p=>p.z))/10)},mapWidth,mapHeight);
}
