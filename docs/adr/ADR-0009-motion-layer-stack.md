# ADR-0009: Motion Layer Stack
Status: Accepted

## Context
Base motion, gestures, facial movement, IK and corrections need predictable composition.
## Decision
Use fixed ordered serialized layers with masks, blend modes, priorities, seeds and algorithm versions.
## Alternatives considered
Single clip per character; opaque procedural scripts.
## Consequences
Layer conflict/fallback semantics require contract tests.
## Open risks
Precise mask algebra and solver algorithms remain unimplemented.
