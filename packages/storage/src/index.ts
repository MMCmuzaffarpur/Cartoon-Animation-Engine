import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export class MetadataStore {
  private db:Database.Database;
  constructor(path:string){mkdir(dirname(path),{recursive:true}).catch(()=>{});this.db=new Database(path);this.db.pragma("journal_mode=WAL");this.db.exec(`CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT,revision_id TEXT);CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,project_id TEXT,parent_id TEXT,number INTEGER,hash TEXT,metadata TEXT);CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,state TEXT,idempotency_key TEXT UNIQUE,payload TEXT);`);}
  upsertProject(id:string,name:string,revisionId:string){this.db.prepare("INSERT INTO projects(id,name,revision_id) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,revision_id=excluded.revision_id").run(id,name,revisionId);}
  integrity(){return this.db.pragma("integrity_check") as unknown;}
  close(){this.db.close();}
}
