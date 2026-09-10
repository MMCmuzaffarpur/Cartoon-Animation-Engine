import { CaeError, uuid } from "../../domain/src/index.js";
export type JobState="queued"|"preparing"|"running"|"finalizing"|"succeeded"|"cancelling"|"cancelled"|"failed"|"retrying";
const transitions:Record<JobState,JobState[]>={queued:["preparing","cancelled"],preparing:["running","cancelling","failed"],running:["finalizing","cancelling","failed"],finalizing:["succeeded","failed"],succeeded:[],cancelling:["cancelled","failed"],cancelled:[],failed:["retrying"],retrying:["queued"]};
export interface JobRecord{id:string;type:string;state:JobState;progress:number;attempts:number;idempotencyKey:string;logs:string[];checkpoint?:Record<string,unknown>}
export class JobMachine{constructor(public state:JobState="queued",public attempts=0,public logs:string[]=[]){}
  move(next:JobState){if(!transitions[this.state].includes(next))throw new CaeError("JOB_NOT_RETRYABLE",`Invalid job transition ${this.state} -> ${next}`);this.state=next;this.logs.push(next);if(next==="retrying")this.attempts++;}
}
export class JobEngine {
  private jobs=new Map<string,JobRecord>();
  create(type:string,idempotencyKey:string){const existing=[...this.jobs.values()].find(j=>j.idempotencyKey===idempotencyKey);if(existing)return existing;const j={id:uuid(),type,state:"queued" as JobState,progress:0,attempts:0,idempotencyKey,logs:[]};this.jobs.set(j.id,j);return j;}
  get(id:string){const j=this.jobs.get(id);if(!j)throw new CaeError("JOB_NOT_FOUND","Job not found",[id]);return j;}
  transition(id:string,next:JobState,progress?:number){const j=this.get(id),m=new JobMachine(j.state,j.attempts,j.logs);m.move(next);j.state=m.state;j.attempts=m.attempts;j.logs=m.logs;if(progress!==undefined)j.progress=progress;return j;}
  list(){return [...this.jobs.values()];}
}
