# ADR-0003: Versioning and revisions
Status: Accepted

## Context
Edits, prompts, imports and renders require reproducibility and undo.
## Decision
Use independent engine/schema/asset versions and immutable project revisions with explicit migrations.
## Alternatives considered
In-place mutable projects; timestamp-only versions.
## Consequences
Storage and revision-diff design are required before implementation.
## Open risks
Revision storage granularity and merge/collaboration behavior are unresolved.
