# ADR-0010: Unified facial evaluation
Status: Accepted

## Context
Lip-sync, emotion, blink, gaze and expressions conflict if independent.
## Decision
Combine sources into rig-neutral FacialControlState before rig mapping, with versioned priority policy.
## Alternatives considered
Renderer-owned face logic; independent uncoordinated tracks.
## Consequences
Minimum facial vocabulary and manual override rules must be frozen.
## Open risks
Cross-rig mapping quality is unresolved.
