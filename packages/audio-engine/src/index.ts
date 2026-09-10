import { uuid } from "../../domain/src/index.js";
export interface AudioClip {id:string,assetId:string|null,startTick:number,endTick:number,volume:number,pan:number,fadeInTicks:number,fadeOutTicks:number}
export class AudioEngine {
  clip(assetId:string|null,startTick:number,endTick:number,options:Partial<AudioClip>={}):AudioClip{return{id:uuid(),assetId,startTick,endTick,volume:options.volume??1,pan:options.pan??0,fadeInTicks:options.fadeInTicks??0,fadeOutTicks:options.fadeOutTicks??0};}
  gainAt(c:AudioClip,tick:number){if(tick<c.startTick||tick>c.endTick)return 0;const a=c.fadeInTicks?Math.min(1,(tick-c.startTick)/c.fadeInTicks):1;const b=c.fadeOutTicks?Math.min(1,(c.endTick-tick)/c.fadeOutTicks):1;return c.volume*Math.min(a,b);}
  mixIntent(clips:AudioClip[]){return{sampleRate:48000,channels:2,normalization:"peak",tracks:clips.map(c=>({id:c.id,assetId:c.assetId,startTick:c.startTick,endTick:c.endTick,volume:c.volume,pan:c.pan}))};}
}
