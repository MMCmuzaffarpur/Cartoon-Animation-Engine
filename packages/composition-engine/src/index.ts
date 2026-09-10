import { uuid } from "../../domain/src/index.js";

export interface Caption { id:string; startTick:number; endTick:number; text:string; x:number; y:number; style:Record<string,unknown>; }
export interface Transition { id:string; type:"cut"|"fade"|"dissolve"|"slide"; startTick:number; endTick:number; params:Record<string,unknown>; }

export class CompositionEngine {
  caption(text:string,startTick:number,endTick:number,options:Partial<Caption>={}):Caption{
    return {id:uuid(),text,startTick,endTick,x:options.x??640,y:options.y??660,style:options.style??{fontFamily:"sans-serif",fontSize:32}};
  }
  transition(type:Transition["type"],startTick:number,endTick:number,params:Record<string,unknown>={}):Transition{
    if(endTick<=startTick) throw new Error("Transition endTick must be greater than startTick");
    return {id:uuid(),type,startTick,endTick,params};
  }
  opacity(tick:number,start:number,end:number,mode:"in"|"out"="in"){
    if(tick<=start)return mode==="in"?0:1;
    if(tick>=end)return mode==="in"?1:0;
    const t=(tick-start)/(end-start); return mode==="in"?t:1-t;
  }
}
