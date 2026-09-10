# Schema Specifications

These normative Phase 0 specifications define portable JSON-compatible contracts, not classes or implementation. All objects include `id`, `schemaVersion`, `revision`, `createdAt`, `updatedAt`, and optional `metadata` unless stated otherwise. IDs are immutable opaque strings; timestamps are UTC RFC 3339; references use IDs plus optional pinned revision/content hash. Times use integer ticks and rates use rational values. Extensions use namespaced keys. Unknown required semantics fail validation; unknown namespaced extensions are preserved.

Schemas are deliberately prose-first in Phase 0. Machine-readable JSON Schema is deferred until a validation technology is selected by an approved ADR; no implementation behavior is implied.
