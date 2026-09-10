# Cartoon Animation Engine

A local-first, deterministic, open-source cartoon production engine for 2D, 3D and hybrid projects.

## What is implemented

- Canonical project + immutable revision snapshots with optimistic concurrency.
- Content-addressed asset storage and metadata foundation.
- Character definition/assembly, customization, dress and makeup APIs.
- Procedural humanoid rig with IK math boundary.
- Motion clips, interpolation, walk/run/jump/wave/dance and layer evaluation.
- Facial expression/gaze/blink/viseme controls.
- Deterministic phoneme -> viseme lip-sync track generation.
- 2D/3D/hybrid scene model, classroom template, props and navigation anchors.
- Orthographic/perspective camera model and follow/shot helpers.
- Timeline and audio mix intent.
- Pure deterministic frame evaluation producing hashed `EvaluatedFrameState`.
- SVG 2D renderer.
- glTF-style 3D scene export boundary.
- Optional FFmpeg MP4 rendering from deterministic SVG frames.
- Procedural generation adapter with provenance; no paid API required.
- Rule-based English/Hinglish prompt planner; LLM planners can be added as adapters.
- Canonical command validation/execution with dependency ordering and idempotency.
- Fastify REST API and CLI.
- Job state machine.
- Capability negotiation and plugin SDK.
- Tests for determinism, project revisions, motion, facial, lip-sync, scenes, planning and jobs.

## Architecture

```text
Prompt / UI / CLI / Automation
        ↓
Prompt & Command Planning
        ↓
Plan validation + preview + approval
        ↓
Canonical Command Validation / Execution
        ↓
Project / Asset / Character / Rig / Motion / Facial / Scene / Camera / Audio / Timeline
        ↓
Deterministic Frame Evaluation
        ↓
EvaluatedFrameState (hashed)
        ↓
2D SVG / 3D glTF / optional Blender adapters
        ↓
Composition / FFmpeg
        ↓
MP4 / frames / project artifacts
```

Core correctness does not require an LLM, internet connection, proprietary video API or paid service.

## Quick start

```bash
npm install
npm run typecheck
npm test
npm run dev
```

In another terminal:

```bash
npm run cli -- project create "My Cartoon"
```

Then use the returned `projectId`:

```bash
npm run cli -- prompt plan <projectId> "Create a classroom."
```

API:

```text
GET  /api/v1/health
POST /api/v1/projects
GET  /api/v1/projects/:projectId
POST /api/v1/prompts:plan
POST /api/v1/prompts:validate
POST /api/v1/prompts:preview
POST /api/v1/prompts:execute
POST /api/v1/commands:validate
POST /api/v1/commands:execute
POST /api/v1/generation/character
POST /api/v1/generation/scene
GET  /api/v1/capabilities
```

## Rendering

`SvgRenderer` is a deterministic CPU-first 2D backend. `GltfRenderer` is an interchange/export backend. `VideoEngine` can create MP4 using a locally installed FFmpeg executable. Blender is intentionally an optional external adapter and never the canonical project authority.

## No paid APIs

There is no Pollinations, paid video API, cloud rendering requirement or automatic paid fallback in the core.

## License

MIT for this repository's original source. Review every third-party dependency/model/asset license before redistribution.
