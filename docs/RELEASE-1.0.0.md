# Cartoon Animation Engine 1.0.0 — Local Engine Baseline

## Requirement coverage

| Requirement | Baseline |
|---|---|
| 2D characters | Implemented via canonical character model + deterministic SVG renderer |
| 3D characters/scenes | Canonical 3D representation + glTF export boundary |
| Multiple characters | Project entity graph supports arbitrary character entities |
| Character creation | Procedural deterministic template engine |
| Dress-up | Non-destructive outfit component |
| Makeup | Non-destructive makeup component |
| Hair / skin / eyes / body / face | Parameterized character assembly |
| Expressions | Facial control engine |
| Rigging | Humanoid rig/control/IK math boundary |
| Walking/running/jumping/dancing/waving | Deterministic motion clips |
| Facial animation | Expression/gaze/blink/viseme controls |
| Lip-sync | Versioned phoneme→viseme track; analysis adapters remain pluggable |
| Scenes/world/background/props | Scene graph + classroom template + props/navigation anchors |
| Camera | Orthographic/perspective model, close-up/wide/follow |
| Audio | Track/mix intent with fades/gain |
| Timeline | Temporal items, active evaluation, validation |
| Frame evaluation | Pure exact-tick evaluator + hash |
| Rendering | SVG 2D + glTF 3D export |
| Final MP4 | Local FFmpeg adapter from deterministic SVG frames |
| Jobs | Durable API boundary + in-memory state machine baseline |
| Prompt control | Rule-based English/Hinglish planner; LLM adapters are optional |
| No paid APIs | Core has no paid/cloud video dependency |
| Local-first | Yes |
| GitHub/source ownership | Repository source only; third-party licenses must be reviewed |

## Important boundary

A professional production renderer (GPU skeletal deformation, physically correct 3D rasterization, neural lip-sync, cloth/hair physics, advanced audio decoding) is intentionally represented as replaceable adapters rather than simulated with fake functionality. The architecture can add those backends without changing canonical project semantics.
