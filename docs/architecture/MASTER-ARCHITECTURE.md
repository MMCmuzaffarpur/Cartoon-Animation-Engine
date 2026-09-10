# Master Architecture

## Purpose and boundary

Cartoon-Animation-Engine is a local-first, open-source, deterministic animation engine for authored 2D, 3D, and hybrid cartoon projects. It is not an AI model and does not depend on an LLM, proprietary video-generation API, or cloud service for correctness. AI is an optional translation layer that produces validated commands.

## System layers

```text
AI / UI / CLI / automation
  -> Prompt & Command Planning
  -> Canonical command validation and execution
  -> Project, asset, character, scene, motion, camera, audio, timeline domains
  -> Deterministic frame evaluation
  -> immutable EvaluatedFrameState
  -> selected 2D / 3D / hybrid render backend
  -> composition, audio mix, encode/mux, job/storage adapters
```

The Prompt & Command Planning Engine accepts free text only as untrusted input. It resolves project entities, makes a reviewable plan, validates schemas/capabilities/policy, and emits canonical commands. Natural language never reaches renderer internals.

## Dependency direction

Dependencies point inward only: UI, HTTP API, CLI, workers, storage, renderers, AI planners, FFmpeg, Blender, and GPU adapters may depend on application/domain contracts; domain contracts may depend only on deterministic schemas and math. Domain packages must not depend on HTTP, databases, filesystems, FFmpeg, Blender, GPU APIs, AI models, or UI.

## Engine boundaries

| Area | Authority |
|---|---|
| Project | manifests, revision graph, migration, reversible history |
| Asset | immutable blobs, metadata, hashes, variants, dependencies, provenance |
| Character Definition | reusable template capabilities, semantic slots, legal parameters |
| Character Assembly | named character instance, selected parameters, rig binding, attire and variants |
| Generation adapters | request/response boundary for template, procedural, local, or optional external generation; no canonical ownership |
| Rig | skeleton/control vocabulary, constraints, IK/FK, deformers and mappings |
| Motion | clips, blend graphs, layer stack and serialized procedural corrections |
| Facial | one facial-control pipeline: expression, emotion, visemes, blink, gaze, jaw/head |
| LipSync | versioned audio-analysis result and phoneme/viseme timing; analysis is never implicit at render time |
| Scene / Prop | canonical 2D/3D/hybrid entity graph, environments, placement/navigation anchors |
| Camera | camera definitions, shot framing/motion/transitions |
| Timeline | temporal placement of scenes, shots, motion, facial, audio, captions and transitions |
| Frame Evaluation | pure evaluation at an exact tick; produces only EvaluatedFrameState |
| Rendering | converts evaluated state to pixels/passes; cannot reinterpret animation or mutate projects |
| Composition / Audio | overlay, subtitle, transition, deterministic mix intent and final assembly |
| Job / Storage | durable jobs, cache/checkpoints/logs; manifests/assets/revisions/artifacts |
| Capability / Adapter | discover, negotiate, select, and report replaceable backend capabilities |

## Character model

A Character Definition says what may be built: compatible 2D/3D representation modules, parameter vocabulary, rig profiles, asset slots, and defaults. A Character Assembly is a particular named instance referencing a definition revision and applying body/face values, selected slot assets, outfits, makeup, accessories, deterministic seed, and rig binding. Character Variants are deltas against an assembly revision. Outfits and makeup reference assets plus non-destructive parameter/material/decal overrides; they do not duplicate source assets.

## 2D, 3D, and hybrid

2D is first-class. A 2D character may mix layered art, skeletal attachments, mesh deformation, sprites, frame-by-frame cels, and hybrid modules per component. 3D uses an engine-owned canonical scene model with glTF 2.0 as the initial interchange boundary. Blender is only an import/preparation/offline-render adapter and never project authority. Hybrid scenes share one entity graph and use declared representation, render layer, depth policy, and compositing policy. Initial hybrid scope is layer order, anchors, 2.5D parallax and mattes; physically correct cross-medium lighting/occlusion is future work.

## Evaluation and rendering

Frame evaluation resolves project/asset revisions, timeline tracks, Character Assemblies, motion layers, rig constraints, facial controls, scene, camera, light and render intent at an integer tick. The result is immutable and hashed. Render backends consume that state and return frames/passes plus provenance. They may have platform differences but cannot add semantic behavior.

## Motion and facial pipelines

Motion Layer Stack order: base motion; masked upper/lower body; gestures; additive action; facial motion; gaze; IK/constraints; procedural correction; final limits. Every procedural layer serializes algorithm ID/version, parameters, seed, target, bounds, and fallback/baked data.

Facial evaluation combines rest pose, manual overrides, lip-sync articulation, expression/emotion, gaze, blink, jaw/head and secondary movement into rig-neutral controls, then maps controls to rig-specific bones/morphs/deformers.

## Jobs, API, storage

REST `/api/v1` is authoritative and authentication-ready. Mutations require validation, revision preconditions, and idempotency. Jobs are persisted state machines with cancellation, retries, checkpoints, logs and output provenance. Storage is local-first: portable project documents, content-addressed asset revisions, derived cache, metadata index and render artifacts.

## Extensibility

Physics, cloth, hair and secondary motion are reserved capability/adapter extension points. Initial support is declarative requirements and optional baked caches only. Every adapter publishes a versioned capability descriptor and is selected through deterministic policy.

## Non-goals for Phase 0

Phase 0 creates contracts, governance, evaluation plans, and fixture definitions only. It does not implement engines, generators, renderers, API servers, UI, or install dependencies.
