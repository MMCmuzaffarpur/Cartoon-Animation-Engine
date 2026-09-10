# Generation Contract

## Scope

Generation is a replaceable adapter boundary. It is not implemented in Phase 0 and does not confer ownership of canonical assets or project state.

`GenerationAdapter` advertises adapter ID/version, supported request types, capabilities, determinism class, runtime/security requirements, input/output schema versions and license/provenance obligations.

`CharacterGenerationRequest`, `SceneGenerationRequest`, `PropGenerationRequest`, and `OutfitGenerationRequest` specialize `GenerationRequest` with target semantic contract, style, constraints, asset candidates, allowed strategy, seed, acceptance criteria and project revision scope.

`GenerationResult` records status, reused assets, variants, template selection or candidate generated artifacts, compatibility validation, manual-review requirement, warnings and output hashes. `GenerationProvenance` records adapter/tool/model/weights identity and license, request hash, seed, inputs, configuration, environment, attribution and output hashes.

## Allowed strategies

1. Existing asset reuse: select a pinned compatible asset.
2. Asset variant: derive a parameterized, non-destructive variation.
3. Template selection: instantiate an approved reusable template.
4. Procedural generation: deterministic algorithm/version/seed.
5. Local generation adapter: optional locally installed model/tool.
6. External generation adapter: optional, explicitly configured service.

Outputs must pass asset, license, safety, compatibility and provenance validation before import. No adapter may silently fetch, publish, overwrite, or license assets. External generation remains optional and its data disclosure is explicit.
