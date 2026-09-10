# Prompt Planner Evaluation

| Option | Offline/CPU | Structured reliability | Hindi/English | Assessment |
|---|---|---|---|
| Rule-based | Excellent; negligible RAM | Highest for supported grammar | Explicit bilingual grammar required | Required initial baseline |
| Local LLM | Offline but memory/latency dependent | Must be constrained then validated | Model-dependent, evaluate separately | Optional adapter, not baseline |
| Hybrid rules + local LLM | Rules enforce operation/entity/validation; LLM helps paraphrase | Better controlled than LLM-only | Model-dependent | Recommended future enhancement |
| External LLM adapter | Optional network/service dependency | Same validator required | Potentially broad but privacy/vendor risk | Optional only |

## Recommendation

Implement no planner in Phase 0. For foundation, freeze the planner interface and begin later with a rule-based planner for a constrained command grammar, exact/alias entity resolution and deterministic validation. Allow a local LLM adapter through the same plan schema only after selecting a separately licensed, benchmarked model. On an 8 GB machine, local LLM planning is optional and should not share memory with rendering/lip-sync jobs.
