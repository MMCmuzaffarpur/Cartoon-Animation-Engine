# ADR-0012: Generation adapters
Status: Accepted

## Context
Character/scene/prop/outfit generation must be replaceable and asset-aware.
## Decision
Define generation request/result/provenance adapters for reuse, variants, templates, procedural, local and optional external generation.
## Alternatives considered
Hard-code generators in domain; require one AI provider.
## Consequences
Generated outputs require validation and provenance before asset import.
## Open risks
No generation technology is approved.
