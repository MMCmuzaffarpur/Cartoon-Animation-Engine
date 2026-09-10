# ADR-0005: Character Definition and Assembly
Status: Accepted

## Context
Reusable templates must not be duplicated for named characters or outfits.
## Decision
Separate reusable Character Definitions from named Character Assemblies and sparse variants.
## Alternatives considered
Single flattened character object; renderer-native character files.
## Consequences
Slot/override resolution and compatibility validation are first-class.
## Open risks
Initial semantic parameter vocabulary needs approval.
