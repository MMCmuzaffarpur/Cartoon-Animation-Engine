# Low-end Hardware Evaluation

## Target

Intel Core i5-11400, Intel UHD 730 integrated graphics, 8 GB RAM, Windows. No benchmark has been run; all statements below are operational estimates requiring measurement.

## Feasibility and policy

| Workload | Assessment | Initial policy |
|---|---|---|
| 2D frame/preview | Likely feasible on CPU at proxy resolution | Default preview 720p or lower; cache layers/frames |
| Basic 3D preview | Possibly feasible at low detail on integrated GPU; unbenchmarked | Optional, 480p–720p proxy, low texture/mesh limits |
| Blender offline | Feasible as queued CPU work but may be slow; GPU acceleration uncertain | Optional background adapter; no interactive expectation |
| FFmpeg | Likely viable for encoding/mux; actual codec speed unmeasured | One encode job at a time |
| Lip-sync | Small/quantized models may be feasible; accuracy/speed unmeasured | Exclusive background job; persist output/cache |
| Local LLM planner | Not baseline-ready on 8 GB when media work is active | Rule-based only by default |

Use bounded worker concurrency: one memory-heavy media/AI/render task at a time; lightweight evaluation can run separately only after measurement. Reserve memory through job declarations, use proxy assets, avoid concurrent Blender/LLM/lip-sync, cache normalized assets/audio analysis/evaluated frames, and expose cancellation. Recommended target output begins at 720p/24 fps for iteration; 1080p final is a queued best-effort mode after profiling. Do not publish performance claims before benchmark fixtures run.
