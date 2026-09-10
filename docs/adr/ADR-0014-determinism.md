# ADR-0014: Determinism
Status: Accepted

## Context
Revisions, cache, tests and automation require reproducible semantics.
## Decision
Guarantee deterministic evaluation from pinned inputs; classify renderer reproducibility separately.
## Alternatives considered
Best-effort behavior; promise bitwise output on every GPU.
## Consequences
Canonical hashes, seed/version provenance and backend disclosures are required.
## Open risks
Exact serialization and backend reproducibility testing are pending.
