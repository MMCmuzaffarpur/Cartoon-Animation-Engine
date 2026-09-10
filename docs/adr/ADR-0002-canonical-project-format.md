# ADR-0002: Canonical project format
Status: Accepted

## Context
Projects must remain portable, inspectable and independent of tools.
## Decision
Use versioned JSON-compatible manifests with immutable asset references and portable export bundles.
## Alternatives considered
Renderer-native files; opaque database-only format.
## Consequences
Requires schema migration discipline and explicit binary asset storage.
## Open risks
Canonical serialization/validation technology remains to be selected.
