import {describe,it,expect} from "vitest";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ProjectRepository} from "../packages/project-engine/src/index.js";
describe("project revisions",()=>{
 it("creates and mutates immutable revisions",async()=>{const d=await mkdtemp(join(tmpdir(),"cae-"));const r=new ProjectRepository(d);const a=await r.create("Demo");const b=await r.mutate(a.project.projectId,a.revision.revisionId,"test",p=>{p.settings.test=true});expect(b.revision.number).toBe(1);expect((await r.get(a.project.projectId)).settings.test).toBe(true);await rm(d,{recursive:true,force:true});});
});
