import type { CapabilityDescriptor } from "../../domain/src/index.js";
export interface PluginAdapter {readonly adapterId:string;readonly adapterVersion:string;capabilities():CapabilityDescriptor}
export interface RenderPlugin extends PluginAdapter {render(state:unknown,options:unknown):Promise<unknown>}
export interface PlannerPlugin extends PluginAdapter {plan(prompt:string,context:unknown):Promise<unknown>}
