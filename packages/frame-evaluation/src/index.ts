import { canonicalHash } from "../../domain/src/index.js";
import { AnimationEngine } from "../../animation-engine/src/index.js";
import { FacialEngine } from "../../facial-engine/src/index.js";
import { LipSyncEngine } from "../../lipsync-engine/src/index.js";
export interface EvaluatedFrameState {schemaVersion:"1.0.0";projectId:string;revisionId:string;tick:number;entities:any[];camera:any;audio:any[];hash:string}
export class FrameEvaluator {
  constructor(private animations=new AnimationEngine(),private facial=new FacialEngine(),private lipsync=new LipSyncEngine()){}
  evaluate(input:{project:any;revisionId:string;tick:number;camera?:any}):EvaluatedFrameState{
    const p=input.project, t=input.tick;
    const entities=(p.entities??[]).map((e:any)=>{const motion=e.components?.motionLayers??[];const motionState=motion.length?this.animations.evaluate(motion,t):{};const expression=e.components?.expression?this.facial.expression(e.components.expression):{};const lip=e.components?.lipSync?this.lipsync.visemeAt(e.components.lipSync,t):null;return{...e,evaluation:{motion:motionState,facial:expression,viseme:lip}};});
    const state={schemaVersion:"1.0.0" as const,projectId:p.projectId,revisionId:input.revisionId,tick:t,entities,camera:input.camera??{position:{x:0,y:0,z:10},target:{x:0,y:0,z:0},zoom:1},audio:p.settings?.audioTracks??[]};
    return {...state,hash:canonicalHash(state) as string};
  }
}
