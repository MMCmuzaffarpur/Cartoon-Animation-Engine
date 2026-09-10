# Evaluated Dependencies

Status meanings: **candidate** means researched only, not approved, installed, or production-ready. Versions are intentionally unpinned until reproducible evaluation. License conclusions require a future exact-version/transitive audit.

| Project | Candidate purpose | License/source | Runtime/model weight | Redistribution/linking concern | Status |
|---|---|---|---|---|---|
| Node.js | TypeScript runtime | MIT; nodejs.org | runtime | package and native-addon audit | candidate |
| Rust | optional native worker toolchain | MIT OR Apache-2.0; rust-lang.org | toolchain | Windows MSVC toolchain/package review | candidate |
| SQLite | local metadata index | public domain; sqlite.org | runtime | wrapper/binary license separately reviewed | candidate |
| Skia | 2D graphics base | BSD-3-Clause; skia.org/repository | native | build/binary notices/transitives | candidate |
| `@napi-rs/canvas` | Node Skia binding | MIT; repository/npm metadata | native addon | embedded Skia and platform binaries require audit | candidate |
| Cairo | alternate CPU 2D backend | LGPL-2.1 or MPL-1.1; cairographics.org | native | linking/distribution choice and bindings | candidate |
| Three.js | 3D preview candidate | MIT; threejs.org/license | JS | headless/GPU dependency audit | candidate |
| Babylon.js | 3D preview candidate | Apache-2.0; Babylon docs/repository | JS | transitive modules/build output | candidate |
| Filament | native 3D candidate | Apache-2.0; Google repository | native | binding/package complexity | candidate |
| bgfx | graphics abstraction candidate | BSD-2-Clause; repository | native | substantial own-engine work | candidate |
| glTF Transform | glTF normalization candidate | MIT; repository | JS | extension/transitive audit | candidate |
| Khronos glTF Validator | independent validation | repository license must be pinned/verified | JS/WASM/native | package route and notices | candidate |
| gltf-rs | Rust glTF candidate | MIT OR Apache-2.0; crates metadata | Rust | feature/transitive audit | candidate |
| Blender | optional adapter | GPL; blender.org | external process | bundle/distribution/legal review | candidate |
| FFmpeg | media adapter | LGPL-2.1+ baseline; GPL if enabled; ffmpeg.org | external process/libs | configure flags, codecs, source/notices/dynamic linking | candidate |
| Vosk | ASR candidate | software/model terms must be checked per version; Vosk model page | code + model | Hindi/English model licenses/data provenance | candidate |
| whisper.cpp | ASR candidate | MIT code; repository | code + Whisper weights separately | weight terms/data/provenance and binary build | candidate |
| Whisper/WhisperX alignment | alignment research candidate | code/model licenses vary | code + models | language aligner coverage, weights/data | candidate |
| llama.cpp | optional local planner runtime | MIT; repository | code + selected model separately | model GGUF/weights license and RAM | candidate |
| Zod | schema-validation candidate | license/version to verify before adoption | JS | transitive audit | candidate |
| Vitest | test candidate | MIT; repository | JS | transitive audit | candidate |

Primary sources consulted during this evaluation include official project documentation and repositories. The project must record exact URL, commit/release, hash, dependency tree, notices, source/binary packaging, and model-weight license before any candidate becomes approved.
