import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export class GltfRenderer {
  capabilities={adapterId:"gltf-json",adapterVersion:"1.0.0",contractVersion:"1.0.0",capabilities:{"render.3d.scene-export":"supported","render.3d":"experimental"}};
  build(scene:any){return{asset:{version:"2.0",generator:"Cartoon Animation Engine 1.0.0"},scene:0,scenes:[{name:scene.name,nodes:(scene.entities??[]).map((e:any)=>({name:e.name,translation:[e.transform.position.x,e.transform.position.y,e.transform.position.z],rotation:[0,0,0,1],scale:[e.transform.scale.x,e.transform.scale.y,e.transform.scale.z]}))}],nodes:(scene.entities??[]).map((e:any)=>({name:e.name}))};}
  async export(scene:any,path:string){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(this.build(scene),null,2));return path;}
}
