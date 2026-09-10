# Test Strategy

## Test layers

| Type | Scope |
|---|---|
| Unit | transforms, curves, schema helpers, hashes, revision/seed logic |
| Property | generated valid/invalid rigs, timelines, variants and references |
| Contract | schema/API/planner/adapter conformance |
| Golden | evaluated-state and controlled render/audio fixtures with declared tolerances |
| Deterministic evaluation | identical pinned inputs produce same state hash/diff |
| Prompt benchmark | fixed prompts/projects yield valid plans, disclosed assumptions and safe ambiguity behavior |
| Entity resolution | names, aliases, scope, duplicates, pronouns and ambiguity |
| Security | injection, traversal, malicious media/archive, authorization and resource limits |
| Migration | historical documents migrate predictably |
| Render/audio | backend capability behavior, sync, timing, mux manifests |
| Capability | selection/fallback/fail-closed cases |
| Recovery/performance | cancellation, checkpoints, corrupt cache, low-end CPU/memory budgets |

## Phase 1 fixture inventory

- `empty-project-v1`; `project-with-revisions-v1`; `legacy-migration-v0`.
- `asset-with-attribution`; `asset-missing-license`; `asset-variant-palette`.
- `character-definition-2d-layered`; `character-assembly-rahul`; `outfit-red-shirt`.
- `rig-minimal-2d`; `rig-minimal-3d`; `motion-walk`; `expression-happy`.
- `scene-classroom-hybrid`; `camera-wide-to-close`; `sequence-dialogue`.
- `lip-sync-en-short`; `lip-sync-hi-short`; `audio-dialogue-sync`.
- `prompt-create-rahul`; `prompt-ambiguous-room`; `prompt-modify-existing-rahul`.
- `capability-cpu-only`; `capability-required-unavailable`; `job-cancel-resume`.

Fixtures must use demonstrably redistributable placeholder media or generated test data.
