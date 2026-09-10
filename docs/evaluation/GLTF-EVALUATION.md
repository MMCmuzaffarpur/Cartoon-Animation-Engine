# glTF Evaluation

glTF 2.0 is an API-neutral runtime asset format containing scenes, nodes, meshes, materials, cameras and animations; it does not dictate runtime behavior. Required initial normalized subset: buffers/accessors, images/textures, meshes, node transforms, PBR/unlit materials, cameras, skins, animations, morph targets, extras, and a documented KHR-extension allowlist.

| Library | Runtime | Evidence-supported scope | License/status |
|---|---|---|---|
| glTF Transform | TypeScript/Node | Read/edit/write glTF 2.0; reproducible low-level transformations; extensions tooling | MIT; leading candidate |
| Khronos glTF Validator | Node/WASM/native package options | Validates assets against glTF 2.0 specification | Apache-2.0 repository review required; candidate |
| gltf-rs / gltf-json | Rust | JSON types include accessors, animation, assets, buffers, cameras, extensions, images, materials | MIT OR Apache-2.0; future-worker candidate |
| Three.js/Babylon loaders | TypeScript runtime loaders | Rendering-oriented import, not canonical asset normalization | Licenses per runtime; not asset authority |

## Recommendation

Use glTF Transform as the initial TypeScript normalization/transform candidate and Khronos Validator as an independent validation candidate. Preserve unknown allowed extensions only under policy; reject unsupported required extensions. Do not rely on render-engine loaders as the project importer. Exact versions and extension subset remain unapproved until fixture tests.
