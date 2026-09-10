# ADR-0006: First-class 2D representation
Status: Accepted

## Context
Professional 2D work needs more than sprites or a reduced 3D pipeline.
## Decision
Support layered, skeletal, mesh-deformed, sprite, cel/frame-by-frame and hybrid 2D modules under one representation contract.
## Alternatives considered
Sprites only; 3D-only engine; a single mandatory 2D rig style.
## Consequences
2D evaluated state exposes layer/deformer/cel semantics.
## Open risks
Drawing/deformation backend selection remains unapproved.
