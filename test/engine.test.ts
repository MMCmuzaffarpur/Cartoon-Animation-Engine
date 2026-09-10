import { describe,it,expect } from "vitest";
import { canonicalHash } from "../packages/domain/src/index.js";
import { AnimationEngine } from "../packages/animation-engine/src/index.js";
import { FacialEngine } from "../packages/facial-engine/src/index.js";
import { LipSyncEngine } from "../packages/lipsync-engine/src/index.js";
import { SceneEngine } from "../packages/scene-engine/src/index.js";
import { CharacterEngine } from "../packages/character-engine/src/index.js";
import { RuleBasedPromptPlanner } from "../packages/prompt-planning/src/index.js";
import { JobMachine } from "../packages/job-engine/src/index.js";
describe("engine kernel",()=>{
 it("canonical hashing is deterministic",()=>expect(canonicalHash({b:1,a:2})).toBe(canonicalHash({a:2,b:1})));
 it("walk evaluates root motion",()=>{const e=new AnimationEngine(),c=e.walk(48000),v=e.evaluate([{id:"1",order:0,kind:"base",weight:1,mask:[],additive:false,clip:c}],24000);expect(v["motion.root.x"]).toBeCloseTo(.5);});
 it("facial angry is deterministic",()=>expect(new FacialEngine().expression("angry").browFurrow).toBe(1));
 it("phonemes map to visemes",()=>expect(new LipSyncEngine().analyzePhonemes([{startTick:0,endTick:100,phoneme:"M",confidence:1}]).visemes[0].viseme).toBe("MBP"));
 it("classroom creates props",()=>expect(new SceneEngine().classroom().entities.length).toBeGreaterThan(1));
 it("character creation is stable for same input seed",()=>{const e=new CharacterEngine();expect(e.create({name:"Rahul",seed:7}).seed).toBe(7);});
 it("planner creates classroom command",()=>{const p={projectId:"00000000-0000-4000-8000-000000000001",entities:[]};const plan=new RuleBasedPromptPlanner().plan("Create a classroom.",p,"00000000-0000-4000-8000-000000000002");expect(plan.commands[0].commandType).toBe("CREATE_SCENE");});
 it("job transitions",()=>{const j=new JobMachine();j.move("preparing");j.move("running");j.move("finalizing");j.move("succeeded");expect(j.state).toBe("succeeded");});
});
