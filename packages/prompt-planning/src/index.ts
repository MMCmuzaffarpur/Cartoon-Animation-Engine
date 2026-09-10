import { canonicalHash, CaeError, uuid } from "../../domain/src/index.js";
import type { CommandPlanT } from "../../contracts/src/index.js";
export interface Planner { plan(prompt:string,project:any,revisionId:string):CommandPlanT }
export const resolveEntity=(entities:any[],reference:string)=>{
  const q=reference.trim().toLowerCase();
  const exact=entities.filter(e=>e.name?.toLowerCase()===q), alias=entities.filter(e=>e.aliases?.some((a:string)=>a.toLowerCase()===q));
  const m=exact.length?exact:alias;
  return m.length===1?{status:"resolved",entityId:m[0].id}:m.length>1?{status:"ambiguous",candidates:m.map(x=>x.id)}:{status:"missing"};
};
const command=(projectId:string,revisionId:string,type:any,payload:any,targetIds:string[]=[],dependencies:string[]=[])=>({commandId:uuid(),schemaVersion:"1.0.0",commandType:type,projectId,expectedProjectRevisionId:revisionId,idempotencyKey:`plan-${uuid()}`,targetIds,payload,dependencies,preconditions:{},authorization:{scope:`project:${projectId}`},requiredCapabilities:[],provenance:{planner:"rule-based",version:"1.0.0"},expectedEffects:[],undoMetadata:{}});
export class RuleBasedPromptPlanner implements Planner {
  plan(prompt:string,project:any,revisionId:string){
    const text=prompt.trim(), low=text.toLowerCase();if(!text)throw new CaeError("PROMPT_UNCLEAR","Prompt is empty");
    const intents:any[]=[],commands:any[]=[],assumptions:string[]=[],warnings:string[]=[],clarifications:string[]=[];
    const add=(type:any,payload:any={},targets:string[]=[],deps:string[]=[])=>{const c=command(project.projectId,revisionId,type,payload,targets,deps);commands.push(c);intents.push({intentId:uuid(),schemaVersion:"1.0.0",operation:type,targetEntityId:targets[0],parameters:payload,constraints:[],references:[],requestedCapabilities:[],confidence:.98,explanation:`Mapped from: ${text}`,defaults:[],assumptions:[],warnings:[],clarificationRequests:[]});return c.commandId;};
    let m=/create\s+(?:a\s+)?(?:(\d+)[-\s]?year[-\s]?old\s+)?(boy|girl|man|woman|character)?\s*(?:named|name[d]?)?\s*([A-Za-z][\w -]*)/i.exec(text);
    if(m && /character|boy|girl|man|woman|named/i.test(text)){const age=m[1]?Number(m[1]):undefined;const name=(m[3]??m[2]??"Character").trim();if(resolveEntity(project.entities,name).status==="resolved")throw new CaeError("ENTITY_DUPLICATE","Character already exists",[name]);add("CREATE_CHARACTER",{name,age,gender:m[2]?.toLowerCase(),representation:/3d|three dimensional/i.test(low)?"3d":"2d"});}
    if(/classroom|school\s*room/i.test(low)&&/create|make|build/i.test(low))add("CREATE_SCENE",{sceneId:uuid(),name:"Classroom",template:"classroom",type:/3d/i.test(low)?"3d":"2d",width:1280,height:720});
    m=/make\s+([A-Za-z][\w-]*)\s+(angry|happy|sad|surprised|fearful|neutral)/i.exec(text);if(m){const r=resolveEntity(project.entities,m[1]);if(r.status==="resolved")add("CREATE_EXPRESSION",{expression:m[2]},[r.entityId!]);else clarifications.push(`Which character is "${m[1]}"?`);}
    m=/(?:make|let)\s+([A-Za-z][\w-]*)\s+(walk|run|jump|dance|wave)/i.exec(text);if(m){const r=resolveEntity(project.entities,m[1]);if(r.status==="resolved")add("CREATE_ANIMATION",{motion:m[2],durationTicks:48000},[r.entityId!]);else clarifications.push(`Which character is "${m[1]}"?`);}
    m=/change\s+([A-Za-z][\w-]*)['’]s\s+(shirt|top)\s+to\s+([#A-Za-z0-9]+)/i.exec(text);if(m){const r=resolveEntity(project.entities,m[1]);if(r.status==="resolved")add("MODIFY_OUTFIT",{[m[2]]:m[3]},[r.entityId!]);else clarifications.push(`Which character is "${m[1]}"?`);}
    m=/make\s+([A-Za-z][\w-]*)\s+say\s+["“](.+?)["”]/i.exec(text);if(m){const r=resolveEntity(project.entities,m[1]);if(r.status==="resolved")add("CREATE_DIALOGUE",{speakerId:r.entityId,text:m[2],language:/\b(hindi|हिंदी)\b/i.test(low)?"hi-IN":"en-IN"},[r.entityId!]);else clarifications.push(`Which character is "${m[1]}"?`);}
    if(/close[\s-]?up/i.test(low))add("MODIFY_CAMERA",{shot:"close-up",zoom:2.2});
    if(/wide\s+shot/i.test(low))add("MODIFY_CAMERA",{shot:"wide",zoom:.8});
    if(/lip[\s-]?sync|lipsync/i.test(low))warnings.push("Lip-sync requires committed audio/phoneme timing; no hidden analysis is performed during render.");
    if(!commands.length && !clarifications.length)throw new CaeError("PROMPT_UNCLEAR","Prompt is outside the bounded deterministic grammar; use canonical commands or an enabled LLM planner.");
    const plan:any={planId:uuid(),schemaVersion:"1.0.0",sourceProjectRevisionId:revisionId,planner:{id:"rule-based",version:"1.0.0"},intents,commands,dependencies:Object.fromEntries(commands.map(c=>[c.commandId,c.dependencies])),affectedEntityIds:[...new Set(commands.flatMap(c=>c.targetIds))],requiredCapabilities:[],assumptions,warnings,clarificationRequests:clarifications,previewable:true,estimates:{commandCount:commands.length},planHash:""};
    plan.planHash=canonicalHash({...plan,planHash:null}) as string;return plan;
  }
}
