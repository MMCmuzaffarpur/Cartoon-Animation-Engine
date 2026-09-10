# 3D Preview Backend Evaluation

| Candidate | glTF/skin/morph/camera/light | Toon/outlines | Headless/CPU | Integration | License/status |
|---|---|---|---|---|---|
| Three.js | Mature glTF loader, animation, skins, morph targets, materials/cameras/lights | Achievable with custom materials/postprocessing; verify headless path | Primarily WebGL/WebGPU; no credible CPU fallback | Natural TypeScript fit but headless GPU context packaging is risk | MIT; candidate |
| Babylon.js | Strong glTF runtime, animation, materials/cameras/lights | Built-in stylization options; verify exact output needs | GPU-oriented; headless support must be prototyped | TypeScript fit; larger engine surface | Apache-2.0; candidate |
| Filament | Modern native real-time PBR | Stylized effects possible but nontrivial | GPU focused; native integration | Higher C++/binding complexity | Apache-2.0; candidate |
| bgfx | Cross-platform graphics abstraction | Requires substantial engine work above abstraction | GPU abstraction, no scene/asset authority | Strong native option, excessive Phase 1 scope | BSD-2-Clause; candidate |
| Blender Eevee/background | Broad scene/animation/material support | Strong NPR/toon authoring options | Background/headless; hardware-dependent | Excellent offline adapter, not interactive preview authority | GPL; adapter only |

## Recommendation

Use a **3D preview adapter interface**, but defer making any 3D preview backend a Phase 1 hard dependency. First prototype Three.js and Babylon.js against the canonical EvaluatedFrameState using a tiny controlled fixture. Recommend Babylon.js as the leading evaluation candidate for feature breadth and Apache-2.0 licensing; Three.js remains a lighter MIT alternative. Neither may own project/timeline state, and neither meets the CPU-baseline requirement alone. CPU fallback for initial production correctness is a degraded 2D/proxy or offline queue path, not pretend software 3D realtime.
