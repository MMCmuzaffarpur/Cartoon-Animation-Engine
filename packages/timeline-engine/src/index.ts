export interface TimelineItem {id:string;track:string,startTick:number,endTick:number,targetId?:string,data:Record<string,any>}
export class TimelineEngine {
  add(items:TimelineItem[],item:TimelineItem){if(item.endTick<=item.startTick)throw new Error("Timeline item must have positive duration");return[...items,item].sort((a,b)=>a.startTick-b.startTick||a.track.localeCompare(b.track));}
  active(items:TimelineItem[],tick:number){return items.filter(x=>tick>=x.startTick&&tick<x.endTick);}
  duration(items:TimelineItem[]){return items.reduce((m,x)=>Math.max(m,x.endTick),0);}
  validate(items:TimelineItem[]){for(const x of items)if(x.endTick<=x.startTick)return{valid:false,errors:[`Invalid range ${x.id}`]};return{valid:true,errors:[]};}
}
