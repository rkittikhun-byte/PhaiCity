/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { POWERBIT, ZONEBIT } from '../../tileFlags.js';
import { tileSeed } from './tileModels.js';
import type { CityMapReader, CityViewSetup } from './types.js';
import type { RegionId } from '../regional/types.js';
import type { CitySprite } from './sprites.js';
export class TestCity implements CityMapReader {
  readonly width=200;readonly height=200;readonly values=new Uint16Array(40000);readonly flags=new Uint16Array(40000);
  constructor() {
    for(let y=0;y<200;y++)for(let x=0;x<200;x++){
      const river=x>=92&&x<=98,woods=(x<30||x>173||y<25||y>174)&&tileSeed(Math.floor(x/5),Math.floor(y/5))%4!==0;
      this.values[y*200+x]=river?2:woods?37:0;
    }
    for(const y of [35,65,95,125,155])for(let x=25;x<175;x++)this.values[y*200+x]=x>=92&&x<=98?64:66;
    for(const x of [35,65,105,135,165])for(let y=25;y<175;y++)this.values[y*200+x]=67;
    for(let x=20;x<180;x++)this.values[80*200+x]=x>=92&&x<=98?224:226;
    for(const x of [35,65,105,135,165])this.values[80*200+x]=237;
    for(let y=25;y<175;y++)this.values[y*200+145]=211;
    for(const y of [35,65,95,125,155])this.values[y*200+145]=78;
    for(let y=25;y<175;y++)for(const x of [91,99])if(this.values[y*200+x]===0)this.values[y*200+x]=5;
    let n=0;
    for(let land=0;land<4;land++)for(let density=0;density<4;density++){const x=40+(n%8)*6,y=100+Math.floor(n/8)*7;this.zone(x,y,265+(land*4+density)*9,3);n++;}
    n=0;for(let land=0;land<4;land++)for(let density=0;density<5;density++){const x=108+(n%9)*6,y=100+Math.floor(n/9)*7;this.zone(x,y,436+(land*5+density)*9,3);n++;}
    n=0;for(let type=0;type<2;type++)for(let density=0;density<4;density++){this.zone(40+(n%4)*10,140+Math.floor(n/4)*8,625+(type*4+density)*9,3);n++;}
    for(const [x,y,value,size]of[[52,53,244,3],[58,53,427,3],[64,53,616,3],[70,53,409,3],[76,53,765,3],
      [82,53,774,3],[108,52,698,4],[117,52,716,6],[129,52,750,4],[139,52,784,4],[149,52,816,4],[154,59,800,4],
      [101,88,698,4],[114,88,716,6]])this.zone(x,y,value,size);
    for(let i=0;i<12;i++)this.values[121*200+40+i*3]=249+i;
    for(let i=0;i<4;i++){this.values[122*200+108+i*3]=40+i;this.values[122*200+130+i]=44+i;this.values[122*200+140+i]=48+i;}
    this.values[122*200+126]=840;this.values[95*200+95]=828;
    // Fill the wider province with deterministic neighbourhoods, leaving networks and the river clear.
    for(let y=40;y<170;y+=6)for(let x=40;x<170;x+=6){if(x>87&&x<101)continue;
      let free=true;for(let dy=-1;dy<2;dy++)for(let dx=-1;dx<2;dx++)if(this.values[(y+dy)*200+x+dx]!==0)free=false;
      if(free){const h=tileSeed(x,y),kind=h%3,value=kind===0?265+(h%16)*9:kind===1?436+(h%20)*9:625+(h%8)*9;this.zone(x,y,value,3);}
    }
  }
  zone(x:number,y:number,value:number,size:number):void {
    const start=value-(size+1);for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++){
      const i=(y-1+dy)*200+x-1+dx;this.values[i]=start+dy*size+dx;this.flags[i]=0;
    }this.values[y*200+x]=value;this.flags[y*200+x]=ZONEBIT|POWERBIT;
  }
  getTileValue(x:number,y:number):number{return this.values[y*200+x];}
  getTileFlags(x:number,y:number):number{return this.flags[y*200+x];}
}
export function testCitySetup(container:HTMLElement,region:RegionId,map:CityMapReader=new TestCity()):CityViewSetup {
  const overlay={blockSize:2,worldGet:(x:number,y:number)=>tileSeed(x,y)%180};
  return{container,map,region,overlays:{trafficDensityMap:overlay,pollutionDensityMap:overlay,landValueMap:overlay},date:()=>({month:6,year:2026})};
}
export function testCitySprites():CitySprite[] {
  return [1,2,3,4,5,6,7].map((type,i)=>({type,x:(60+i*9)*16,y:80*16,xOffset:-16,yOffset:-16,width:32,height:32,frame:1}));
}
export function moveTestSprites(sprites:CitySprite[],seconds:number):void {
  sprites.forEach((s,i)=>{s.x=(s.type===4?95:45+(seconds*(i+1)*.55)%100)*16;s.y=(s.type===4?35+seconds*1.2%130:s.type===1?80:85+i*5)*16;});
}
