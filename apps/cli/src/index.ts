#!/usr/bin/env node
import { ProjectRepository } from "../../../packages/project-engine/src/index.js";
import { RuleBasedPromptPlanner } from "../../../packages/prompt-planning/src/index.js";
import { ProceduralGenerationEngine } from "../../../packages/generation-engine/src/index.js";
const repo=new ProjectRepository(process.env.CAE_DATA_DIR??".local-data/projects");
const [area,action,...args]=process.argv.slice(2);
const main=async()=>{
  if(area==="project"&&action==="create")console.log(JSON.stringify(await repo.create(args.join(" ")||"Untitled"),null,2));
  else if(area==="project"&&action==="list")console.log(JSON.stringify(await repo.list(),null,2));
  else if(area==="project"&&action==="inspect")console.log(JSON.stringify(await repo.get(args[0]),null,2));
  else if(area==="project"&&action==="export")console.log(await repo.export(args[0]));
  else if(area==="prompt"&&action==="plan"){const p=await repo.get(args[0]),r=await repo.latest(args[0]);console.log(JSON.stringify(new RuleBasedPromptPlanner().plan(args.slice(1).join(" "),p,r.revisionId),null,2));}
  else if(area==="generate"&&action==="character")console.log(JSON.stringify(new ProceduralGenerationEngine().character(JSON.parse(args.join(" "))),null,2));
  else console.error("Usage: project create|list|inspect|export; prompt plan <projectId> <prompt>; generate character <json>");
};
main().catch(e=>{console.error(JSON.stringify(e.toJSON?.()??{error:e.message}));process.exitCode=1;});
