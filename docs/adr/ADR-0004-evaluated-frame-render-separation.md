# ADR-0004: Evaluated frame/render separation
Status: Accepted

## Context
Timeline semantic evaluation must not vary with render backend.
## Decision
Frame evaluation is pure and outputs immutable `EvaluatedFrameState`; renderers consume it without mutation or semantic inference.
## Alternatives considered
Backend-owned timeline/rig evaluation; renderer-specific project formats.
## Consequences
An explicit state contract and adapter conversion layer are required.
## Open risks
State size/performance and advanced backend feature mapping need evaluation.
