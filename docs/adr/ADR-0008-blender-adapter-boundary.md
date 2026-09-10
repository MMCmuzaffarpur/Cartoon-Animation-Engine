# ADR-0008: Blender adapter boundary
Status: Accepted

## Context
Blender offers strong offline capabilities but cannot own project semantics.
## Decision
Treat Blender solely as optional import/preparation/offline-render adapter through generated packages.
## Alternatives considered
Embed Blender project data as canonical; exclude Blender entirely.
## Consequences
Adapter/provenance and GPL distribution review are mandatory.
## Open risks
Bundling/packaging policy is unresolved pending legal review.
