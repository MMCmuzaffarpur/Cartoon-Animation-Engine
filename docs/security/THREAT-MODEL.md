# Threat Model

## Security posture

All prompts, planner output, assets, archives, media metadata, API input and adapter output are untrusted until validated. The system fails closed: unsupported command/capability/schema/authorization/path/asset state is rejected with a structured error and no project mutation.

| Threat | Required control |
|---|---|
| Prompt injection | Prompts cannot invoke tools, shell, URLs, paths, policies or renderer internals; planner output is untrusted |
| Malicious planner output | Schema, allowlisted command type, entity scope, authorization, capability and revision validation before execution |
| Command injection | Typed canonical payloads only; no script/string evaluation; idempotency and preconditions |
| Path traversal | Content-addressed storage; canonical path containment; reject absolute/escaping paths |
| Arbitrary shell execution | No shell command contract; adapters use controlled arguments and allowlists only |
| Malicious media | Size/type limits, hardened decoder process isolation, time/memory limits, metadata sanitization |
| Archive extraction | Reject path traversal/symlinks/oversize archives; extract into quarantined bounded workspace |
| Unauthorized project access | Authentication-ready scope checks for project, asset, command and job operations |
| Capability escalation | Capability descriptor is informational; policy chooses allowlisted adapters; unsupported required capabilities fail |
| External planner leakage | Opt-in adapters, minimum contextual payload, secret isolation, audit provenance, no credentials in project files |
| Unsafe asset import | Source/license/provenance validation, hash verification, quarantine and explicit approval rules |
| Job abuse/resource exhaustion | Quotas, bounded queues/workers/time/memory/disk, cancellation, rate limits and audit logs |

Preview operations are read-only. Imported text/assets cannot alter authorization or command policy. Unknown extensions may be retained only in safe namespaces and never executed. Security-sensitive failures produce stable error codes without exposing secrets.
