# ADR-0013: Capability negotiation
Status: Accepted

## Context
Backends differ in features, hardware and determinism.
## Decision
Use versioned descriptors and required/preferred/selected/fallback capability negotiation with fail-closed required features.
## Alternatives considered
Assume one backend; silently approximate unavailable features.
## Consequences
Render/job manifests record chosen capabilities and fallbacks.
## Open risks
Initial taxonomy and ranking policy need detailed freezing.
