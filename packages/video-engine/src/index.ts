import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { CaeError } from "../../domain/src/index.js";
import { SvgRenderer } from "../../render-2d/src/index.js";
import { FrameEvaluator } from "../../frame-evaluation/src/index.js";
export interface VideoOptions {ffmpeg:string;output:string;width:number;height:number;fps:number;startTick:number;endTick:number;tickRate:number}
const run=(cmd:string,args:string[])=>new Promise<void>((resolve,reject)=>{const p=spawn(cmd,args,{stdio:["ignore","pipe","pipe"]});let err="";p.stderr.on("data",d=>err+=d);p.on("error",e=>reject(e));p.on("close",c=>c===0?resolve():reject(new Error(err||`ffmpeg exited ${c}`)));});
export class VideoEngine {
  constructor(private renderer=new SvgRenderer(),private evaluator=new FrameEvaluator()){}
  async renderMp4(project:any,revisionId:string,options:VideoOptions){
    const dir=join(process.cwd(),"tmp","frames-"+Date.now());await mkdir(dir,{recursive:true});
    const frameCount=Math.max(1,Math.ceil((options.endTick-options.startTick)/options.tickRate*options.fps));
    for(let i=0;i<frameCount;i++){const tick=Math.round(options.startTick+i*options.tickRate/options.fps);const state=this.evaluator.evaluate({project,revisionId,tick});await this.renderer.writeFrame(state,{width:options.width,height:options.height},dir,`frame-${String(i).padStart(6,"0")}.svg`);}
    try{await run(options.ffmpeg,["-y","-framerate",String(options.fps),"-i",join(dir,"frame-%06d.svg"),"-c:v","libx264","-pix_fmt","yuv420p",options.output]);}
    catch(e){throw new CaeError("RENDER_FAILED",e instanceof Error?e.message:String(e));}
    finally{await rm(dir,{recursive:true,force:true});}
    return options.output;
  }
}
