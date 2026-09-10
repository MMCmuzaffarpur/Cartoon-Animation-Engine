import { lerp, uuid } from "../../domain/src/index.js";
export interface Camera {id:string;name:string;type:"orthographic"|"perspective";position:{x:number;y:number;z:number};target:{x:number;y:number;z:number};zoom:number;fov:number}
export class CameraEngine {
  create(name="Main Camera",type:"orthographic"|"perspective"="orthographic"):Camera{return{id:uuid(),name,type,position:{x:0,y:0,z:10},target:{x:0,y:0,z:0},zoom:1,fov:45};}
  closeUp(camera:Camera,target:{x:number;y:number;z:number}):Camera{return{...camera,target,zoom:2.2};}
  wide(camera:Camera):Camera{return{...camera,zoom:.8};}
  follow(camera:Camera,target:{x:number;y:number;z:number},weight=1):Camera{return{...camera,position:{x:lerp(camera.position.x,target.x,weight),y:lerp(camera.position.y,target.y,weight),z:camera.position.z},target};}
}
