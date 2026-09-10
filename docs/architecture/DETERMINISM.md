# Determinism Contract

## Required deterministic behavior

With identical canonical commands, project/asset revisions, engine and algorithm versions, seed, integer evaluation tick, and configuration, the system must deterministically resolve references, variants, timeline tracks, keyframes, motion-layer order, rig constraints, facial controls, scene/camera/light intent, EvaluatedFrameState serialization, cache keys, and project revision diffs. Saved lip-sync tracks are replayed rather than reanalyzed during rendering.

## Canonical hashing and seeds

Canonical hashes use a documented canonical serialization: stable UTF-8, normalized numbers/units, lexicographically sorted object keys, arrays retained in semantic order, no timestamps/log fields, and explicit schema/algorithm versions. Hash inputs include relevant asset content hashes. Every random/procedural operation has an explicit seed, deterministic PRNG algorithm identifier/version, bounded inputs, and serialized parameters.

## Asset and provenance pinning

Projects reference immutable asset revisions by ID and content hash. Render manifests pin project revision, evaluated-state hash, render request, backend/version/capabilities, selected assets, procedural versions, and environment fingerprint.

## Platform-dependent behavior

GPU precision, driver behavior, thread scheduling, font rasterization, encoder bitstreams/rate control, render timing, and availability of hardware may vary. External AI/lip-sync interpretation may vary before results are committed. These differences must be disclosed and cannot alter a committed command or evaluated state.

## Reproducibility levels

Level 1: evaluation deterministic; identical EvaluatedFrameState hash. Level 2: backend reproducible with pinned backend/version/environment/settings. Level 3: bitwise reproducible only with a controlled backend, container/platform and encoder configuration. The engine guarantees Level 1; a backend advertises any higher level.
