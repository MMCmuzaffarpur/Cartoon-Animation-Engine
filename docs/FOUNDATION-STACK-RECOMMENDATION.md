# Foundation Stack Recommendation

This is a Phase 0.5 recommendation, not approval or implementation authorization.

| Component | Recommended starting candidate | Why | Why not alternatives now |
|---|---|---|---|
| Runtime | TypeScript + Node LTS, hybrid-ready | Fast contracts, JSON, local files, workers, adapters and contributor access | Rust-only adds cost before evidence; hybrid native work is deferred until profiling |
| Schema validation | TypeScript schema library to be selected by a license/prototype gate | Native fit for API/contracts | Do not select Zod/JSON Schema tooling without exact audit and evaluation |
| Metadata DB | SQLite via reviewed adapter | Local-first, single-file, public-domain core | Client/server DB adds deployment burden |
| Asset storage | Content-addressed filesystem blobs + JSON manifests | Portable/self-owned and matches immutable hashes | Object cloud storage is not required |
| 2D backend | Evaluate `@napi-rs/canvas`/Skia first behind adapter | Headless Node/Skia route with Windows prebuilt candidate | Cairo has tougher licensing/packaging; SVG/browser alone lacks core frame backend guarantees |
| 3D preview | Prototype Babylon.js and Three.js; no default until fixture result | TypeScript ecosystem and glTF support | Filament/bgfx need heavier native work; Blender cannot be project authority |
| glTF | glTF Transform + independent Khronos Validator candidate | Node/TS normalization plus external validation | Render loaders are not canonical importers; Rust crate deferred with native worker |
| Blender | Optional external-process offline adapter | Strong asset/offline pipeline, crash isolation | GPL/distribution and mapping need review; never canonical |
| FFmpeg | Optional pinned LGPL-oriented executable adapter | Mature decode/encode/mux/audio filters | GPL/nonfree build or static linking not approved |
| Audio | Domain mix intent + FFmpeg adapter/WAV intermediate | Avoid early DSP dependency | Add DSP library only when measured gap exists |
| Lip-sync | Pluggable local pipeline; evaluate Vosk vs whisper.cpp plus separate alignment | Hindi/English offline candidates and saved deterministic tracks | Do not adopt model/aligner without license, quality and CPU evidence |
| Prompt planner | Rule-based baseline; optional local LLM adapter later | Core remains independent; best validation/reliability on 8 GB | LLM-only/external planning is non-deterministic/optional |
| Testing | TypeScript unit/property/contract/golden framework selected after audit | Matches chosen runtime | Do not lock framework before package review |
| Packaging | Windows local executable/service with separately versioned adapters; Linux target later | Keeps external tools replaceable and notices explicit | No bundled tool/model claims before review |

## Foundation boundary

Phase 1, if separately authorized, should create only the project/contracts/asset/revision/job foundation and fixture harness. It must not assume 3D preview, Blender, FFmpeg, local models, or generation adapters are approved until the corresponding bounded prototype and license record is completed.
