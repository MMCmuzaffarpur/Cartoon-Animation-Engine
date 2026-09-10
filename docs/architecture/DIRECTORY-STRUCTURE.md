# Repository Architecture

## Frozen target layout

```text
docs/                         architecture, ADRs, schemas, API, security, licensing, testing, evaluations
schemas/                      machine-readable contracts, mirroring docs/schemas
packages/contracts/           shared versioned contracts only
packages/domain/              deterministic models/evaluation math only
packages/project-engine/      revisions and manifests
packages/asset-engine/        asset graph/provenance
packages/character-engine/    definitions, assemblies, variants
packages/rig-engine-2d/       future implementation
packages/rig-engine-3d/       future implementation
packages/motion-engine/       future implementation
packages/facial-engine/       future implementation
packages/scene-engine/        future implementation
packages/timeline-engine/     future implementation
packages/frame-evaluation/    future implementation
packages/render-core/         backend selection/render planning
packages/render-2d/           future adapter
packages/render-3d/           future adapter
packages/composition-engine/  future implementation
packages/audio-engine/        future implementation
packages/job-engine/          future implementation
packages/prompt-contracts/    prompt/command schemas
packages/prompt-planning/     planner orchestration
packages/command-validation/  validation
packages/command-execution/   revision-producing executor
packages/api-server/          future HTTP boundary
packages/worker/              future job-worker boundary
adapters/                     FFmpeg, Blender, storage, planner, generation adapters
apps/                         CLI, local-server, editor (future)
test/                         fixtures, contract, integration, golden, performance tests
examples/                     portable example projects
third_party/manifests/        dependency/license/SBOM records
```

## Ownership and boundaries

`contracts` owns portable schemas. `domain` owns pure deterministic semantics. Application packages orchestrate domain operations. Adapters translate external tools to contracts. Apps and API are outermost clients. Tests may depend inward but production packages must never depend on tests.

The domain package must not depend on HTTP, database, filesystem, FFmpeg, Blender, GPU APIs, AI models, UI, environment variables, or process execution. Adapter code may not redefine domain semantics.

Documentation in `docs/` is normative until equivalent machine-readable schemas and ADRs supersede a portion; discrepancies require an ADR and correction before implementation.
