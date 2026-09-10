import { clamp, lerp, uuid } from "../../domain/src/index.js";
export interface Joint { id:string; parentId:string|null; rest:{x:number;y:number;z:number}; }
export interface Rig { id:string; name:string; dimension:"2d"|"3d"; joints:Joint[]; controls:Record<string,number>; constraints:Record<string,unknown>[]; }
export class RigEngine {
  createHumanoid(dimension:"2d"|"3d"="2d"):Rig{
    const names=["root","pelvis","spine","chest","neck","head","upper_arm.L","lower_arm.L","hand.L","upper_arm.R","lower_arm.R","hand.R","upper_leg.L","lower_leg.L","foot.L","upper_leg.R","lower_leg.R","foot.R"];
    const joints=names.map((n,i)=>({id:n,parentId:i?names[Math.max(0,i-1)]:null,rest:{x:0,y:i<6?i*0.1:0,z:0}}));
    return {id:uuid(),name:`humanoid-${dimension}`,dimension,joints,controls:{},constraints:[{type:"limit_rotation"},{type:"two_bone_ik",targets:["hand.L","hand.R","foot.L","foot.R"]}]};
  }
  applyControl(rig:Rig,control:string,value:number){return {...rig,controls:{...rig.controls,[control]:clamp(value,-1,1)}};}
  solveTwoBoneIK(a:{x:number;y:number},b:{x:number;y:number},target:{x:number;y:number},len1:number,len2:number){
    const dx=target.x-a.x,dy=target.y-a.y,d=Math.hypot(dx,dy),c=Math.min(len1+len2-1e-6,Math.max(Math.abs(len1-len2)+1e-6,d));
    const base=Math.atan2(dy,dx), elbow=Math.acos(clamp((len1*len1+c*c-len2*len2)/(2*len1*c),-1,1));
    return {shoulder:base-elbow,elbow:Math.acos(clamp((len1*len1+len2*len2-c*c)/(2*len1*len2),-1,1))};
  }
}
