import { uuid } from "../../domain/src/index.js";
export interface SceneEntity {id:string;type:string;name:string;representation:"2d"|"3d"|"hybrid";transform:{position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number};scale:{x:number;y:number;z:number}};components:Record<string,any>}
export interface Scene {id:string;name:string;type:"2d"|"3d"|"hybrid";width:number;height:number;background:any;entities:SceneEntity[];navigationAnchors:any[];renderLayers:any[];settings:Record<string,any>}
export class SceneEngine {
  create(name:string, type:"2d"|"3d"|"hybrid"="2d", width=1280,height=720):Scene{return{id:uuid(),name,type,width,height,background:{kind:"solid",color:"#87CEEB"},entities:[],navigationAnchors:[],renderLayers:[{id:"background",order:0,name:"Background"},{id:"characters",order:100,name:"Characters"},{id:"foreground",order:200,name:"Foreground"}],settings:{}};}
  addProp(scene:Scene,name:string,kind="box",x=0,y=0,z=0,props:any={}):Scene{return{...scene,entities:[...scene.entities,{id:uuid(),type:"prop",name,representation:"2d",transform:{position:{x,y,z},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},components:{kind,...props}}]};}
  place(scene:Scene,entityId:string,x:number,y:number,z=0):Scene{return{...scene,entities:scene.entities.map(e=>e.id===entityId?{...e,transform:{...e.transform,position:{x,y,z}}}:e)};}
  anchor(scene:Scene,id:string,x:number,y:number,z=0){return{...scene,navigationAnchors:[...scene.navigationAnchors,{id,x,y,z}]};}
  classroom(name="Classroom"):Scene{let s=this.create(name,"2d");s={...s,background:{kind:"classroom",wall:"#F4E7C5",floor:"#C69C6D"}};s=this.addProp(s,"Teacher Desk","desk",900,520,0,{width:180,height:70,color:"#7A4E2D"});s=this.addProp(s,"Blackboard","blackboard",640,180,0,{width:700,height:180,color:"#173D2D"});for(let i=0;i<4;i++)s=this.addProp(s,`Student Desk ${i+1}`,"desk",220+i*180,500,0,{width:130,height:55,color:"#9B6B43"});return s;}
}
