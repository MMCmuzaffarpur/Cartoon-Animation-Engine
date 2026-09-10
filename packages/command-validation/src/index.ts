import { CanonicalCommand } from "../../contracts/src/index.js";
import { CaeError, negotiate, type CapabilityDescriptor } from "../../domain/src/index.js";
export const validateCommand=(input:unknown,currentRevision:string,inventory:CapabilityDescriptor[])=>{
  const command=CanonicalCommand.parse(input);
  if(command.expectedProjectRevisionId!==currentRevision)throw new CaeError("REVISION_CONFLICT","Expected revision does not match current revision",[currentRevision]);
  const caps=negotiate(inventory,command.requiredCapabilities);if(!caps.valid)throw new CaeError("CAPABILITY_UNAVAILABLE","Required capabilities unavailable",caps.missingRequired);
  return{valid:true,command,capabilities:caps};
};
export const topologicalOrder=<T extends {commandId:string;dependencies:string[]}>(commands:T[])=>{
  const pending=new Map(commands.map(c=>[c.commandId,c])),out:T[]=[];
  while(pending.size){const ready=[...pending.values()].filter(c=>c.dependencies.every(d=>!pending.has(d)));if(!ready.length)throw new CaeError("COMMAND_INVALID","Cyclic or missing command dependency");for(const c of ready){out.push(c);pending.delete(c.commandId);}}
  return out;
};
