# ADR-0011: Prompt and command planning
Status: Accepted

## Context
Natural language must be useful without becoming executable renderer logic.
## Decision
Use optional planners to create project-aware intents/plans; execute only validated canonical commands.
## Alternatives considered
LLM directly edits project/render state; no prompt support.
## Consequences
Entity resolution, ambiguity, authorization, preview and provenance are required.
## Open risks
Planner quality, privacy and model choice remain open.
