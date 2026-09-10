import { CaeError, type CapabilityDescriptor } from "../../domain/src/index.js";
import { validateCommand, topologicalOrder } from "../../command-validation/src/index.js";
import { ProjectRepository } from "../../project-engine/src/index.js";

export class CommandExecutor {
  private seen = new Map<string, any>();
  constructor(private projects: ProjectRepository, private capabilities: CapabilityDescriptor[] = []) {}

  validate(input: unknown, revisionId: string) { return validateCommand(input, revisionId, this.capabilities); }

  async executeMany(inputs: unknown[], approve = true) {
    if (!approve) throw new CaeError("COMMAND_INVALID", "Explicit approval is required for mutation");
    const commands = topologicalOrder(inputs as any[]);
    if (!commands.length) throw new CaeError("COMMAND_INVALID", "Command list is empty");

    const projectId = String((commands[0] as any).projectId);
    if (commands.some((c:any) => c.projectId !== projectId)) {
      throw new CaeError("COMMAND_INVALID", "All commands in a transaction must target the same project");
    }

    const current = await this.projects.latest(projectId);
    const validated = commands.map((c:any) => validateCommand(c, current.revisionId, this.capabilities).command);

    for (const c of validated) {
      const cached = this.seen.get(c.idempotencyKey);
      if (cached) return cached;
    }

    const result = await this.projects.mutate(
      projectId,
      current.revisionId,
      `Executed ${validated.length} canonical command(s)`,
      (project:any) => {
        let next = project;
        for (const c of validated) next = this.apply(next, c);
        return next;
      },
      "local",
      "canonical-command-transaction"
    );

    for (const c of validated) this.seen.set(c.idempotencyKey, result);
    return result;
  }

  async execute(input: unknown, approve = true) {
    return this.executeMany([input], approve);
  }

  private apply(p:any, c:any) {
    const byId = (id:string) => p.entities.find((e:any) => e.id === id);
    switch (c.commandType) {
      case "CREATE_CHARACTER": {
        const name = String(c.payload.name ?? "").trim();
        if (!name) throw new CaeError("COMMAND_INVALID", "Character name is required");
        if (p.entities.some((e:any) => e.type === "character" && e.name.toLowerCase() === name.toLowerCase())) {
          throw new CaeError("ENTITY_DUPLICATE", "Character already exists", [name]);
        }
        const id = c.payload.entityId ?? crypto.randomUUID();
        p.entities.push({
          id, type:"character", name, aliases:c.payload.aliases ?? [],
          representation:c.payload.representation ?? "2d",
          transform:{position:{x:c.payload.x ?? 640,y:c.payload.y ?? 420,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},
          components:{
            skin:c.payload.skin ?? "#F1C7A8", hairColor:c.payload.hairColor ?? "#24170F",
            topColor:c.payload.topColor ?? "#3A6EA5", character:c.payload
          }
        });
        break;
      }
      case "MODIFY_CHARACTER": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.components={...e.components,...c.payload}; break;
      }
      case "MODIFY_OUTFIT": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.components={...e.components,...c.payload}; break;
      }
      case "APPLY_MAKEUP": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.components={...e.components,makeup:c.payload}; break;
      }
      case "CREATE_SCENE": {
        const id=c.payload.sceneId ?? crypto.randomUUID();
        p.scenes.push({...c.payload,id});
        p.entities.push({
          id,type:"scene",name:c.payload.name ?? c.payload.template ?? "Scene",aliases:[],
          representation:c.payload.type ?? "2d",
          transform:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},
          components:c.payload
        });
        break;
      }
      case "ADD_PROP": {
        const s=p.scenes.find((x:any)=>x.id===c.payload.sceneId);
        if(!s) throw new CaeError("ENTITY_NOT_FOUND","Scene not found");
        s.entities ??=[];
        s.entities.push({
          id:c.payload.entityId ?? crypto.randomUUID(),type:"prop",name:c.payload.name ?? "Prop",representation:"2d",
          transform:{position:{x:c.payload.x ?? 0,y:c.payload.y ?? 0,z:c.payload.z ?? 0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},
          components:c.payload
        });
        break;
      }
      case "PLACE_CHARACTER": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.transform.position={x:c.payload.x ?? 640,y:c.payload.y ?? 420,z:c.payload.z ?? 0}; break;
      }
      case "CREATE_EXPRESSION": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.components.expression=c.payload.expression ?? "neutral"; break;
      }
      case "CREATE_ANIMATION": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.components.motionLayers ??=[]; e.components.motionLayers.push(c.payload.layer); break;
      }
      case "CREATE_DIALOGUE": { p.settings.dialogueTracks ??=[]; p.settings.dialogueTracks.push(c.payload); break; }
      case "MODIFY_CAMERA": { p.settings.camera={...(p.settings.camera??{}),...c.payload}; break; }
      case "CREATE_CAMERA_SHOT": { p.settings.shots ??=[]; p.settings.shots.push(c.payload); break; }
      case "CREATE_LIPSYNC": {
        const e=byId(c.targetIds[0]); if(!e) throw new CaeError("ENTITY_NOT_FOUND","Character not found");
        e.components.lipSync=c.payload.track; break;
      }
      case "CREATE_SEQUENCE": { p.sequences.push(c.payload); break; }
      case "CREATE_RENDER": { p.settings.renderRequests ??=[]; p.settings.renderRequests.push(c.payload); break; }
    }
    return p;
  }
}
