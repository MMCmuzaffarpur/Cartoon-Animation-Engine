# API Specification

All resources are versioned under `/api/v1`. This document specifies contracts only; no server exists in Phase 0. JSON requests and responses use the schema versions documented in `docs/schemas`.

| Resource | Initial surface |
|---|---|
| `/projects` | create, list, get, patch, export/import, revisions |
| `/assets` | import, inspect, search, validate, variants, dependencies |
| `/characters` | definitions, assemblies, variants, validation |
| `/scenes` | create/get/patch/validate, entity placement |
| `/sequences` | create/get/patch/evaluate/validate |
| `/renders` | submit, inspect, retrieve manifests/artifacts |
| `/jobs` | list/get/cancel/retry/logs |
| `/prompts:plan` | create project-aware CommandPlan |
| `/prompts:validate` | validate a plan without mutation |
| `/prompts:preview` | create read-only structural/visual preview |
| `/prompts:execute` | execute approved validated plan to a new revision |
| `/commands:validate` | validate canonical commands |
| `/commands:execute` | execute canonical commands to a new revision |
| `/generation/character` | submit CharacterGenerationRequest |
| `/generation/scene` | submit SceneGenerationRequest |
| `/generation/prop` | submit PropGenerationRequest |
| `/generation/outfit` | submit OutfitGenerationRequest |

Mutations require request schemaVersion, project ID, expected revision, authorization scope and idempotency key. Errors use `{ error: { code, message, details, requestId } }`. Future event/WebSocket support is additive; REST is authoritative.
