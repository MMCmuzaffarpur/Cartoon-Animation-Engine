# ADR-0017: Asset provenance
Status: Accepted

## Context
Open-source production requires traceable rights and reproducible assets.
## Decision
Every asset revision records source/hash/license/attribution/dependencies and every generated output has provenance.
## Alternatives considered
Filename-only attribution; untracked generated assets.
## Consequences
Import and export validation must enforce provenance policy.
## Open risks
Final metadata/SBOM format is not selected.
