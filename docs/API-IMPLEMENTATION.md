# API Implementation

The runnable Fastify boundary is implemented in `packages/api-server`.

Implemented:
- `/api/v1/health`
- `/api/v1/capabilities`
- project create/list/get/latest-revision
- canonical command validate/execute
- prompt plan/validate/preview/execute
- procedural character/scene generation
- structured `CaeError` responses

Mutation safety:
- schema validation
- expected project revision
- capability negotiation
- explicit approval for plan execution
- idempotency keys
- dependency ordering
- one project revision per command transaction

Rendering and long-running job endpoints remain adapter/service work rather than fake placeholder success responses.
