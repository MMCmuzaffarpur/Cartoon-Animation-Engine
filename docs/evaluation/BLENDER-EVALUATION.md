# Blender Evaluation

Blender supports command-line background operation, scene import/export and offline rendering. It is GPL-licensed. Its utility does not change the approved boundary: canonical projects/scenes/timelines remain engine-owned.

## Proposed adapter contract

```text
BlenderRenderAdapter
  input: RenderPackage { pinned EvaluatedFrameState range, assets, adapter settings, output request }
  actions: prepare isolated temporary package; invoke background Blender with fixed arguments; monitor/cancel process; validate outputs
  output: AdapterRenderResult { frame artifacts, logs, backend/version/configuration, failures, hashes }
```

The adapter runs Blender in a separate worker process, with a bounded work directory and no project-file authority. It may support asset preparation/import/export and offline NPR/toon rendering after controlled mapping tests.

## Risks and recommendation

Validate Windows background execution, glTF fidelity, material/toon mappings, reproducibility, crash cancellation, installation/packaging and GPL distribution obligations. Do not bundle or call Blender a required runtime until legal and technical review completes. It is the leading optional offline adapter, not the preview backend or canonical engine.
