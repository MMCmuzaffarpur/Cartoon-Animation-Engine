import { clamp, uuid } from "../../domain/src/index.js";
const expressions:Record<string,Record<string,number>>={
  neutral:{smile:0,browRaise:0,browFurrow:0,mouthOpen:0,eyeSquint:0},
  happy:{smile:1,browRaise:.15,browFurrow:0,mouthOpen:.25,eyeSquint:.2},
  angry:{smile:-.4,browRaise:-.2,browFurrow:1,mouthOpen:.1,eyeSquint:.35},
  sad:{smile:-.7,browRaise:-.2,browFurrow:.25,mouthOpen:.1,eyeSquint:0},
  surprised:{smile:0,browRaise:1,browFurrow:0,mouthOpen:1,eyeSquint:-.2},
  fearful:{smile:-.2,browRaise:.7,browFurrow:.1,mouthOpen:.5,eyeSquint:-.1}
};
export class FacialEngine {
  expression(name:string,weight=1){const base=expressions[name.toLowerCase()]??expressions.neutral;return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,clamp(v*weight,-1,1)]));}
  blend(...controls:Record<string,number>[]){const out:Record<string,number>={};for(const c of controls)for(const[k,v]of Object.entries(c))out[k]=(out[k]??0)+v;for(const k of Object.keys(out))out[k]=clamp(out[k],-1,1);return out;}
  gaze(x:number,y:number){return{x:clamp(x,-1,1),y:clamp(y,-1,1)}}
  blink(opening:number){return{blink:clamp(opening,0,1)}}
  viseme(name:string,weight=1){return{[`viseme.${name}`]:clamp(weight,0,1)}}
  track(name:string,startTick:number,endTick:number,controls:Record<string,number>){return{id:uuid(),name,startTick,endTick,controls};}
}
