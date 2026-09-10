import { clamp, lerp, smoothstep, uuid } from "../../domain/src/index.js";
export type Keyframe={tick:number;value:number;interpolation:"step"|"linear"|"smooth"};
export interface Track {targetPath:string;keyframes:Keyframe[]}
export interface MotionClip {id:string;name:string;durationTicks:number;loopMode:"once"|"loop"|"pingpong";tracks:Track[];events:any[]}
export interface MotionLayer {id:string;order:number;kind:string;weight:number;clip:MotionClip;mask:string[];additive:boolean}
export const sampleTrack=(track:Track,tick:number)=>{
  const ks=[...track.keyframes].sort((a,b)=>a.tick-b.tick); if(!ks.length)return 0;
  if(tick<=ks[0].tick)return ks[0].value; if(tick>=ks.at(-1)!.tick)return ks.at(-1)!.value;
  for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i];if(tick<=b.tick){const t=(tick-a.tick)/(b.tick-a.tick);return a.interpolation==="step"?a.value:a.interpolation==="smooth"?lerp(a.value,b.value,smoothstep(t)):lerp(a.value,b.value,t);}}
  return ks.at(-1)!.value;
};
const localTick=(clip:MotionClip,tick:number)=>{if(clip.durationTicks<=0)return 0;if(clip.loopMode==="once")return clamp(tick,0,clip.durationTicks);const q=Math.floor(tick/clip.durationTicks),r=tick%clip.durationTicks;return clip.loopMode==="pingpong"&&q%2===1?clip.durationTicks-r:r;};
export class AnimationEngine {
  clip(name:string,durationTicks:number,tracks:Track[]):MotionClip{return{id:uuid(),name,durationTicks,loopMode:"once",tracks,events:[]};}
  evaluate(layers:MotionLayer[],tick:number){const out:Record<string,number>={};for(const l of [...layers].sort((a,b)=>a.order-b.order)){const lt=localTick(l.clip,tick);for(const tr of l.clip.tracks){const v=sampleTrack(tr,lt);const prev=out[tr.targetPath]??0;out[tr.targetPath]=l.additive?prev+v*l.weight:lerp(prev,v,clamp(l.weight,0,1));}}return out;}
  walk(durationTicks:number=48_000){return this.clip("walk",durationTicks,[{targetPath:"motion.root.x",keyframes:[{tick:0,value:0,interpolation:"linear"},{tick:durationTicks,value:1,interpolation:"linear"}]},{targetPath:"pose.leg.phase",keyframes:[{tick:0,value:0,interpolation:"linear"},{tick:durationTicks/2,value:1,interpolation:"linear"},{tick:durationTicks,value:0,interpolation:"linear"}]}]);}
  run(durationTicks:number=24_000){return this.clip("run",durationTicks,[{targetPath:"motion.root.x",keyframes:[{tick:0,value:0,interpolation:"linear"},{tick:durationTicks,value:2,interpolation:"linear"}]}]);}
  jump(durationTicks:number=24_000){return this.clip("jump",durationTicks,[{targetPath:"motion.root.y",keyframes:[{tick:0,value:0,interpolation:"linear"},{tick:durationTicks/2,value:1,interpolation:"smooth"},{tick:durationTicks,value:0,interpolation:"smooth"}]}]);}
  wave(durationTicks:number=24_000){return this.clip("wave",durationTicks,[{targetPath:"pose.arm.wave",keyframes:[{tick:0,value:0,interpolation:"smooth"},{tick:durationTicks/2,value:1,interpolation:"smooth"},{tick:durationTicks,value:0,interpolation:"smooth"}]}]);}
  dance(durationTicks:number=48_000){return this.clip("dance",durationTicks,[{targetPath:"pose.body.bounce",keyframes:[{tick:0,value:0,interpolation:"smooth"},{tick:durationTicks/4,value:1,interpolation:"smooth"},{tick:durationTicks/2,value:0,interpolation:"smooth"},{tick:durationTicks*3/4,value:-1,interpolation:"smooth"},{tick:durationTicks,value:0,interpolation:"smooth"}]}]);}
}
