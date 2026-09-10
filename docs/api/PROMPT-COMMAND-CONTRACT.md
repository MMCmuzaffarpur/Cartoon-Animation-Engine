# Prompt and Command Contract

## Boundary

Prompts are untrusted input. A planner may interpret them, but only validated `CanonicalCommand` objects may change a project. All IDs are opaque strings. Plans and commands name the expected project revision and use an idempotency key for mutation. Planner provenance records planner ID/version and source prompt; it is not execution authority.

## Contracts

`PromptIntent` contains intentId, schemaVersion, operation, targetEntity/type/ID, parameters, constraints, references, requestedCapabilities, confidence, explanation, defaults, assumptions, warnings, clarificationRequests and generatedCommands.

`CommandPlan` contains planId, source project revision, planner provenance, intents, dependency DAG, generated commands, entity-resolution report, affected entities, assets, required/preferred/selected capabilities, previewability, estimates and planHash.

`CanonicalCommand` contains commandId, type, project ID, expected revision, idempotencyKey, typed payload, target IDs, preconditions, dependency IDs, seed, authorization scope, capability requirements, provenance, expected effects and undo metadata.

`PlanPreview` contains planHash, validation report, entity/timeline diff, missing assets, assumptions/defaults/warnings/clarifications, selected/fallback capabilities, estimates and optional read-only preview artifacts.

## Validation and authorization

Validation occurs in order: schema; project/revision; entity references; semantic constraints; authorization; capability selection; dependency order. Required unavailable capabilities fail closed. A stale revision fails rather than rebasing silently. Preview has no mutation authority. Execution creates a new revision or fails with no partial semantic commit according to documented transaction boundaries.

## Ambiguity

Critical ambiguity yields `clarificationRequests`; non-critical defaults are explicitly recorded. Existing entity resolution prioritizes explicit ID, exact name, alias, scoped semantic match, then one approved unambiguous fuzzy match. A matching existing entity is modified, not duplicated, unless a distinct creation is explicit.

## Examples

| Prompt | Commands / expected result |
|---|---|
| Create a 10-year-old boy named Rahul with black hair and a blue school uniform | `CREATE_CHARACTER` with child profile, age, hair and wardrobe parameters; requires compatible definition/template |
| Make Rahul angry | `CREATE_EXPRESSION` or modify an existing expression track targeting Rahul’s assembly/entity |
| Create a bright classroom | `CREATE_SCENE`; scene style/environment/prop requirements and camera defaults; missing art reported explicitly |
| Add desks and a blackboard | `ADD_PROP` commands dependent on scene resolution |
| Change Rahul’s shirt to red | `MODIFY_OUTFIT` against Rahul’s existing assembly; material/variant delta, no copied source asset |
| Rahul walks to the teacher | `CREATE_ANIMATION` with actor, anchors, motion, path/navigation requirement, IK requirement and timing/default disclosure |
| Priya waves at Rahul | `CREATE_ANIMATION` with two resolved IDs, gesture track and target/gaze constraints |
| Change camera to a close-up and follow Rahul | `MODIFY_CAMERA` and/or `CREATE_CAMERA_SHOT` with framing/follow target tracks |
| Make Rahul say “Good morning, teacher.” | `CREATE_DIALOGUE`, optional voice/TTS request, then `CREATE_LIPSYNC` if audio is available/approved |
| Create Rahul entering a classroom, walking to teacher, smiling and speaking; wide then close-up | Dependency plan: resolve/create character and scene; place; animate; expression; dialogue; lip-sync; create camera shots; sequence; optional render request |

## API lifecycle

`POST /prompts:plan` returns a plan; `:validate` returns validation; `:preview` returns a read-only preview; `:execute` requires approval, plan hash, expected revision and idempotency key. `POST /commands:validate` and `:execute` provide the same deterministic path without natural language.
