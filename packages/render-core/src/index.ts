import type { CapabilityDescriptor } from "../../domain/src/index.js";
export interface RenderBackend {id:string;capabilities:CapabilityDescriptor;render(state:any,options:any):Promise<any>}
export class RenderBackendRegistry {
  private backends=new Map<string,RenderBackend>();
  register(b:RenderBackend){this.backends.set(b.id,b);}
  get(id:string){return this.backends.get(id);}
  select(preferred:string|"auto"){if(preferred!=="auto"&&this.backends.has(preferred))return this.backends.get(preferred)!;const first=[...this.backends.values()].find(b=>b.capabilities.capabilities["render.2d"]==="supported");if(!first)throw new Error("No render backend available");return first;}
  list(){return [...this.backends.values()].map(b=>b.capabilities);}
}
