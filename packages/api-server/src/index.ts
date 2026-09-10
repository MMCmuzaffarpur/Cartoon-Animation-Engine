import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { CaeError } from "../../domain/src/index.js";
import { validateCommand } from "../../command-validation/src/index.js";
import { ProjectRepository } from "../../project-engine/src/index.js";
import { CommandExecutor } from "../../command-execution/src/index.js";
import { RuleBasedPromptPlanner } from "../../prompt-planning/src/index.js";
import { ProceduralGenerationEngine } from "../../generation-engine/src/index.js";
export const createServer=(projects:ProjectRepository)=>{
  const app=Fastify({bodyLimit:2_000_000});
  const executor=new CommandExecutor(projects,[{adapterId:"core",adapterVersion:"1.0.0",contractVersion:"1.0.0",capabilities:{
    "character.create":"supported","character.modify":"supported","scene.compose":"supported","motion.walk":"supported",
    "motion.run":"supported","motion.jump":"supported","motion.wave":"supported","facial.emotion":"supported","facial.lip-sync":"supported","render.2d":"supported"
  }}]);
  const planner=new RuleBasedPromptPlanner(),generator=new ProceduralGenerationEngine();
  app.addHook("onRequest",async(req,reply)=>reply.header("x-request-id",randomUUID()));
  app.get("/api/v1/health",async()=>({ok:true,version:"1.0.0"}));
  app.get("/api/v1/capabilities",async()=>({capabilities:[{adapterId:"core",adapterVersion:"1.0.0",contractVersion:"1.0.0",capabilities:{"render.2d":"supported","render.3d.scene-export":"supported","generation.procedural":"supported"}}]}));
  app.post("/api/v1/projects",async(req)=>projects.create(String((req.body as any)?.name??"Untitled")));
  app.get("/api/v1/projects",async()=>projects.list());
  app.get("/api/v1/projects/:projectId",async(req)=>projects.get((req.params as any).projectId));
  app.get("/api/v1/projects/:projectId/revisions/latest",async(req)=>projects.latest((req.params as any).projectId));
  app.post("/api/v1/commands:validate",async(req)=>{const b=req.body as any,r=await projects.latest(b.projectId);return executor.validate(b.command,r.revisionId);});
  app.post("/api/v1/commands:execute",async(req)=>executor.execute((req.body as any).command));
  app.post("/api/v1/prompts:plan",async(req)=>{const b=req.body as any,p=await projects.get(b.projectId),r=await projects.latest(b.projectId);return planner.plan(String(b.prompt??""),p,r.revisionId);});
  app.post("/api/v1/prompts:validate",async(req)=>{const b=req.body as any,p=await projects.get(b.projectId),r=await projects.latest(b.projectId),plan=planner.plan(String(b.prompt??""),p,r.revisionId);return{valid:!plan.clarificationRequests.length,planHash:plan.planHash,clarifications:plan.clarificationRequests};});
  app.post("/api/v1/prompts:preview",async(req)=>{const b=req.body as any,p=await projects.get(b.projectId),r=await projects.latest(b.projectId),plan=planner.plan(String(b.prompt??""),p,r.revisionId);return{planHash:plan.planHash,valid:!plan.clarificationRequests.length,validation:{schema:true,revision:true},entityDiff:plan.commands.map((c:any)=>({type:c.commandType,payload:c.payload})),assumptions:plan.assumptions,warnings:plan.warnings,clarifications:plan.clarificationRequests,estimates:plan.estimates};});
  app.post("/api/v1/prompts:execute",async(req)=>{const b=req.body as any,p=await projects.get(b.projectId),r=await projects.latest(b.projectId),plan=planner.plan(String(b.prompt??""),p,r.revisionId);if(plan.planHash!==b.planHash)throw new CaeError("PLAN_STALE","Plan hash mismatch");if(plan.clarificationRequests.length)throw new CaeError("PROMPT_UNCLEAR","Clarification required",plan.clarificationRequests);return executor.executeMany(plan.commands,b.approved===true);});
  app.post("/api/v1/generation/character",async(req)=>generator.character(req.body as any));
  app.post("/api/v1/generation/scene",async(req)=>generator.scene(req.body as any));
  app.setErrorHandler((e,_req,reply)=>{const err=e instanceof CaeError?e:new CaeError("INVALID_REQUEST",e instanceof Error?e.message:String(e));reply.status(400).send(err.toJSON());});
  return app;
};
