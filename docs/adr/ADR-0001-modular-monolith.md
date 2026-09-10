# ADR-0001: Modular monolith
Status: Accepted

## Context
Early engine development needs local installation, testability and clear boundaries without distributed-system overhead.
## Decision
Use a modular monolith with domain packages and isolated worker/adapter processes where required.
## Alternatives considered
Microservices; a single unstructured application.
## Consequences
Simple local-first deployment and future extraction paths; package boundaries must be enforced.
## Open risks
Language/runtime and package tooling are not selected.
