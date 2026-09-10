# Implemented Engine Baseline

This release converts the approved architecture into a runnable local engine kernel.

## Boundaries preserved

- Prompts are untrusted and never directly control shell/render flags.
- Canonical commands are the only mutation boundary.
- Every mutation carries project revision preconditions and idempotency.
- Preview is read-only.
- Frame evaluation is deterministic and separate from rendering.
- 2D is first-class.
- 3D uses an interchange/export boundary; Blender remains optional.
- No paid or proprietary video API is required for correctness.
- LLM planning is optional; rule-based planning is the baseline.

## Production roadmap after this baseline

1. Replace generic entity component payloads with fully generated machine-readable schemas for every domain object.
2. Add persistent asset metadata/dependency graph and durable job persistence.
3. Add real skeletal 2D backend (mesh/sprite/cel) behind `render-core`.
4. Add a production glTF 2.0 reader/writer and optional Blender adapter.
5. Add phoneme extraction adapters (local Vosk/whisper.cpp) without making analysis implicit.
6. Add audio WAV decoding/mixing and subtitle/caption composition.
7. Add editor UI and visual timeline.
8. Add collision/navigation, cloth/hair/physics adapters and baking.
9. Add performance profiling and low-end hardware benchmarks.
10. Add migration tooling and signed provenance/SBOM release artifacts.

The current engine is intentionally functional rather than a fake claim of a professional GPU renderer. External backends are replaceable adapters, not hidden dependencies.
