import { createServer } from "../../../packages/api-server/src/index.js";
import { ProjectRepository } from "../../../packages/project-engine/src/index.js";
const app=createServer(new ProjectRepository(process.env.CAE_DATA_DIR??".local-data/projects"));
app.listen({port:Number(process.env.CAE_PORT??3000),host:"127.0.0.1"}).then(()=>console.log(`Cartoon Animation Engine listening on http://127.0.0.1:${Number(process.env.CAE_PORT??3000)}`)).catch(e=>{console.error(e);process.exit(1);});
