# Dependency Review Process

1. Propose a dependency with exact version/source and purpose.
2. Inventory direct/transitive licenses, build flags, codecs and model weights separately.
3. Check license compatibility, attribution, source availability, patent/export/privacy, redistribution and maintenance status.
4. Evaluate installation, packaging, CPU/GPU, determinism, security and replacement boundary.
5. Record decision, notices and SBOM entry; add ADR if architecture changes.
6. Approve only after review; pin version/hash and re-review upgrades.

Review statuses: proposed, under-review, approved-with-conditions, rejected, superseded. No unreviewed dependency is a production requirement.
