# Runtime Evaluation

## Candidates

| Candidate | Strengths | Limits | Assessment |
|---|---|---|---|
| TypeScript + Node.js | Fast contracts/API/tooling, strong JSON handling, child processes/workers, broad Windows/Linux contributor access, straightforward FFmpeg/Blender process integration | CPU-heavy math/render loops and native bindings are less natural; runtime memory overhead | Best initial orchestration/runtime choice |
| Rust | Strong deterministic numeric code, low memory, native integration and distribution potential | Slower initial development, higher contributor barrier, Windows toolchain/native graphics complexity | Best future opt-in worker language, not initial default |
| Hybrid TypeScript + native workers | Keeps authored contracts/application productive while isolating hotspots and native tools | IPC/provenance/version discipline required | Recommended architecture, but introduce native worker only after profiling |

## Criteria

Node has mature JSON/schema, filesystem, child-process and worker facilities, making it suitable for local project/asset/job orchestration. Rust provides better native control but does not eliminate graphics/backend complexity; Windows development also relies on the MSVC C++ toolchain. Both have permissive core licenses (Node: MIT; Rust: MIT/Apache-2.0). Neither language itself determines render quality or semantic determinism.

## Recommendation

Start with TypeScript on a supported Node LTS release for contracts, deterministic command/project logic, workers, CLI and adapter orchestration. Keep deterministic math small, explicit and tested. Define process contracts from day one so a Rust worker may be introduced for measured hotspots—e.g., mesh/deformation/asset transforms—without changing schemas. Do not start a Rust implementation before a profile demonstrates need.

## Unresolved validation

Select exact Node LTS, package manager, JSON/schema library and Windows packaging tool only after small install/contract experiments. No runtime dependency is approved.
