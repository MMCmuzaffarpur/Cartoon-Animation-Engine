# ADR-0016: Job recovery
Status: Accepted

## Context
Media work is long-running and failure-prone.
## Decision
Use persisted idempotent jobs with states, checkpoints, cancellation, retries, logs and atomic output promotion.
## Alternatives considered
In-memory queue; uncheckpointed renders.
## Consequences
Every worker operation needs declared resume boundaries.
## Open risks
Transaction/checkpoint granularity awaits implementation design.
