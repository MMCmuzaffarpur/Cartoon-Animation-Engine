export interface WorkerTask<T=unknown>{id:string;run(signal:AbortSignal):Promise<T>}
export class SequentialWorker {private active=false;async run<T>(task:()=>Promise<T>){if(this.active)throw new Error("Worker is busy");this.active=true;try{return await task();}finally{this.active=false;}}}
