# 2D Backend Evaluation

| Candidate | Raster/vector/text/composite | Masks/clips/blends/transforms | 2D animation fit | CPU/GPU and packaging | License/status |
|---|---|---|---|---|---|
| Skia native | Mature vector, raster, text and image primitive base | Broad primitive support; verify exact effects | Strong basis for layered/cel/sprite compositor; mesh deformation remains engine-side | CPU and hardware paths; direct native build/package complexity | BSD-3-Clause; candidate only |
| `@napi-rs/canvas` (Skia binding) | Canvas-style Node API over Skia | Requires feature test for masks/blends/effects | Good headless 2D preview/frame candidate; deformation must be separate | Prebuilt Windows/Linux binaries reduce setup but increase binary provenance surface | MIT package plus embedded Skia review; candidate only |
| Cairo | Vector/raster/text, SVG/PDF/image outputs | Affine transforms/compositing; feature scope mature but less modern GPU path | Suitable CPU fallback/reference compositor | Windows supported; native/binding packaging review | LGPL-2.1 or MPL-1.1; higher policy complexity |
| SVG/vector DOM approach | Excellent authored vector interchange | Clips/masks/filter semantics vary by renderer | Good import/export/authoring, poor as sole deterministic animation raster backend | Browser/headless dependency choices vary | Depends on implementation |
| Browser Canvas/WebGL | Familiar composition API | Browser/GPU behavior and headless setup vary | Useful future editor preview, not core headless authority | GPU/browser packaging burden | Depends on runtime |

## Recommendation

Evaluate a Skia-based Node adapter first, specifically `@napi-rs/canvas`, as a bounded headless 2D preview/frame candidate. It aligns with TypeScript, exposes a practical Canvas-style API, and ships Windows x64 builds. It is not yet approved: confirm supported masks, blend modes, color/font behavior, CPU output and exact transitive notices. Keep a renderer interface so direct Skia, Cairo or another backend can replace it.

Mesh deformation is not a renderer feature decision: Frame Evaluation emits resolved vertices/deformation state, then the backend draws it. SVG remains a source/import/export format, not the evaluator or sole renderer.
