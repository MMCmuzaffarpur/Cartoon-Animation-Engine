import { canonicalHash, uuid } from "../../domain/src/index.js";
import { CharacterEngine } from "../../character-engine/src/index.js";
import { SceneEngine } from "../../scene-engine/src/index.js";
export interface GenerationAdapter {id:string;version:string;capabilities:string[]}
export class ProceduralGenerationEngine {
  readonly adapter:GenerationAdapter={id:"procedural-local",version:"1.0.0",capabilities:["generation.character.template","generation.scene.template","generation.prop.template","generation.outfit.template"]};
  constructor(private characters=new CharacterEngine(),private scenes=new SceneEngine()){}
  character(request:any){const result=this.characters.create(request);return{requestId:uuid(),result,provenance:{adapter:this.adapter,deterministic:true,inputHash:canonicalHash(request)}};}
  scene(request:any){const scene=request.template==="classroom"?this.scenes.classroom(request.name):this.scenes.create(request.name,request.type??"2d",request.width??1280,request.height??720);return{requestId:uuid(),result:scene,provenance:{adapter:this.adapter,deterministic:true,inputHash:canonicalHash(request)}};}
}
