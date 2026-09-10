# ADR-0015: Local-first runtime
Status: Accepted

## Context
The core must run without vendor lock-in and support low-end hardware.
## Decision
Use local manifests/assets/metadata/jobs with CPU baseline and optional acceleration.
## Alternatives considered
Cloud-only architecture; mandatory GPU runtime.
## Consequences
Packaging, bounded workers and proxy quality tiers are needed.
## Open risks
Minimum platform/hardware targets are not frozen.
