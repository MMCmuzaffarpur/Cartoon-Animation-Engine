# Capability Contract

`CapabilityDescriptor` declares adapter ID/version/contract version, kind, support entries, limits, determinism, quality/performance traits, platform/hardware/dependency/license requirements, input contracts and fallbacks.

`CapabilityRequirement` has a stable ID, level (`required` or `preferred`), constraints, rationale and allowed fallback IDs. `CapabilitySelection` records inventory snapshot, selected adapter/version, selected capabilities, policy rank and reproducibility classification. `CapabilityFallback` records unavailable preferred feature, chosen fallback, semantic impact, approver/policy and warning.

Support status is `supported`, `unsupported`, or `experimental`. Experimental support requires explicit opt-in and is never selected by default for final renders.

Selection rules: use explicit compatible backend request; otherwise project-pinned compatible backend; otherwise lowest-cost fully compatible local backend according to versioned policy; otherwise compatible CPU fallback; otherwise fail. Required capabilities never degrade silently. Selected/fallback capabilities are pinned in jobs and render manifests. Given identical inventory and policy, selection is deterministic.
