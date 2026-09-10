import { describe, expect, it } from "vitest";

import {
  CharacterEngine,
  defaultCharacterDefinition,
  type CharacterRepresentation,
} from "../packages/character-engine/src/index.js";

import type {
  CharacterAssembly,
  CharacterVariant,
  RigDefinition,
} from "../packages/character-engine/src/index.js";

describe("Character Engine", () => {
  const engine = new CharacterEngine();

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* ---------------------------------------------------------------------- */

  function createCharacter(
    overrides: {
      name?: string;
      representation?: CharacterRepresentation;
      seed?: number;
    } = {},
  ): CharacterAssembly {
    return engine.create({
      name: overrides.name ?? "Aarav",
      representation: overrides.representation ?? "2d",
      seed: overrides.seed,
    });
  }

  function createRig(
    dimension: "2d" | "3d",
  ): RigDefinition {
    return {
      id:
        dimension === "2d"
          ? "00000000-0000-4000-8000-000000000010"
          : "00000000-0000-4000-8000-000000000011",

      name:
        dimension === "2d"
          ? "Humanoid 2D Rig"
          : "Humanoid 3D Rig",

      dimension,

      joints: [
        {
          id: "root",
          parentId: null,
          rest: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        {
          id: "head",
          parentId: "root",
          rest: {
            x: 0,
            y: 1,
            z: 0,
          },
        },
      ],

      controls: [
        {
          id: "root-control",
          kind: "root",
          targetIds: ["root"],
        },
        {
          id: "head-control",
          kind: "rotation",
          targetIds: ["head"],
        },
      ],

      constraints: [],
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Definition                                                             */
  /* ---------------------------------------------------------------------- */

  it("provides a valid default character definition", () => {
    const definition = defaultCharacterDefinition();

    expect(definition.id).toBe(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(definition.name).toBe("Cartoon Human");

    expect(definition.representations).toEqual([
      "2d",
      "3d",
      "hybrid",
    ]);

    expect(definition.slots).toContain("hair");
    expect(definition.slots).toContain("top");

    expect(definition.rigProfiles).toContain(
      "humanoid-2d",
    );

    expect(definition.rigProfiles).toContain(
      "humanoid-3d",
    );
  });

  it("validates the default character definition", () => {
    const definition = defaultCharacterDefinition();

    const validated =
      engine.validateDefinition(definition);

    expect(validated).toEqual(definition);
  });

  /* ---------------------------------------------------------------------- */
  /* Create                                                                 */
  /* ---------------------------------------------------------------------- */

  it("creates a valid 2D character", () => {
    const character = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 100,
    });

    expect(character.name).toBe("Aarav");
    expect(character.representation).toBe("2d");

    expect(character.definitionId).toBe(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(character.seed).toBe(100);
    expect(character.rigId).toBeNull();
    expect(character.variants).toEqual([]);

    expect(character.parameters).toBeDefined();
    expect(character.hair).toBeDefined();
    expect(character.outfit).toBeDefined();
    expect(character.makeup).toBeDefined();
  });

  it("creates valid 3D and hybrid characters", () => {
    const character3d = createCharacter({
      name: "Riya",
      representation: "3d",
      seed: 200,
    });

    const hybrid = createCharacter({
      name: "Kabir",
      representation: "hybrid",
      seed: 300,
    });

    expect(character3d.representation).toBe("3d");
    expect(hybrid.representation).toBe("hybrid");
  });

  it("creates the same character deterministically for the same input", () => {
    const first = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 12345,
    });

    const second = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 12345,
    });

    expect(first).toEqual(second);
    expect(first.id).toBe(second.id);
    expect(first.seed).toBe(second.seed);
  });

  it("creates different deterministic identities when the seed changes", () => {
    const first = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 100,
    });

    const second = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 101,
    });

    expect(first.id).not.toBe(second.id);
    expect(first.seed).not.toBe(second.seed);
  });

  it("automatically derives a deterministic seed when seed is omitted", () => {
    const first = createCharacter({
      name: "Meera",
      representation: "2d",
    });

    const second = createCharacter({
      name: "Meera",
      representation: "2d",
    });

    expect(first.seed).toBe(second.seed);
    expect(first.id).toBe(second.id);
  });

  it("rejects an empty character name", () => {
    expect(() =>
      engine.create({
        name: "   ",
      }),
    ).toThrow();
  });

  it("rejects an invalid age", () => {
    expect(() =>
      engine.create({
        name: "Aarav",
        age: 0,
      }),
    ).toThrow();

    expect(() =>
      engine.create({
        name: "Aarav",
        age: 121,
      }),
    ).toThrow();
  });

  it("rejects invalid body dimensions", () => {
    expect(() =>
      engine.create({
        name: "Aarav",
        body: {
          height: 0,
        },
      }),
    ).toThrow();

    expect(() =>
      engine.create({
        name: "Aarav",
        body: {
          headScale: 0,
        },
      }),
    ).toThrow();

    expect(() =>
      engine.create({
        name: "Aarav",
        body: {
          shoulderWidth: 0,
        },
      }),
    ).toThrow();
  });

  it("rejects an invalid seed", () => {
    expect(() =>
      engine.create({
        name: "Aarav",
        seed: -1,
      }),
    ).toThrow();

    expect(() =>
      engine.create({
        name: "Aarav",
        seed: 1.5,
      }),
    ).toThrow();
  });

  /* ---------------------------------------------------------------------- */
  /* Customization                                                          */
  /* ---------------------------------------------------------------------- */

  it("customizes a character without mutating the original", () => {
    const original = createCharacter({
      name: "Aarav",
      seed: 500,
    });

    const customized = engine.customize(original, {
      parameters: {
        age: 25,
        eyes: {
          color: "#0000FF",
        },
      },

      hair: {
        style: "long",
        color: "#111111",
      },
    });

    expect(customized.parameters).not.toEqual(
      original.parameters,
    );

    expect(customized.parameters.age).toBe(25);

    expect(customized.parameters.eyes).toEqual({
      color: "#0000FF",
      size: 1,
      shape: "round",
    });

    expect(customized.hair).toEqual({
  style: "long",
  color: "#111111",
  length: "short",
  texture: "straight",
});

    expect(original.parameters.age).toBe(18);
  });

  it("preserves unrelated fields during customization", () => {
    const original = createCharacter({
      name: "Aarav",
      seed: 501,
    });

    const customized = engine.customize(original, {
      parameters: {
        age: 30,
      },
    });

    expect(customized.name).toBe(original.name);
    expect(customized.id).toBe(original.id);

    expect(customized.definitionId).toBe(
      original.definitionId,
    );

    expect(customized.definitionRevision).toBe(
      original.definitionRevision,
    );

    expect(customized.seed).toBe(original.seed);
    expect(customized.rigId).toBe(original.rigId);
  });

  it("deep merges nested customization records", () => {
    const original = createCharacter({
      name: "Riya",
      seed: 502,
    });

    const first = engine.customize(original, {
      parameters: {
        eyes: {
          color: "#123456",
          size: 2,
        },
      },
    });

    const second = engine.customize(first, {
      parameters: {
        eyes: {
          shape: "almond",
        },
      },
    });

    expect(second.parameters.eyes).toEqual({
      color: "#123456",
      size: 2,
      shape: "almond",
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Dress                                                                  */
  /* ---------------------------------------------------------------------- */

  it("dresses a character while preserving existing outfit fields", () => {
    const original = createCharacter({
      name: "Kabir",
      seed: 600,
    });

    const dressed = engine.dress(original, {
      topColor: "#FF0000",
      bottomColor: "#0000FF",
    });

    expect(dressed.outfit).toEqual({
      topColor: "#FF0000",
      bottomColor: "#0000FF",
      shoesColor: "#222222",
    });

    expect(original.outfit).toEqual({
      topColor: "#3A6EA5",
      bottomColor: "#243447",
      shoesColor: "#222222",
    });
  });

  it("deep merges outfit objects", () => {
    const original = createCharacter({
      name: "Kabir",
      seed: 601,
    });

    const first = engine.dress(original, {
      top: {
        color: "#FF0000",
        size: 1,
      },
    });

    const second = engine.dress(first, {
      top: {
        material: "cotton",
      },
    });

    expect(second.outfit).toEqual({
      topColor: "#3A6EA5",
      bottomColor: "#243447",
      shoesColor: "#222222",
      top: {
        color: "#FF0000",
        material: "cotton",
        size: 1,
      },
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Makeup                                                                 */
  /* ---------------------------------------------------------------------- */

  it("applies makeup without mutating the original", () => {
    const original = createCharacter({
      name: "Riya",
      seed: 700,
    });

    const result = engine.makeup(original, {
      lipstick: {
        color: "#FF0000",
        intensity: 0.8,
      },
    });

    expect(result.makeup).toEqual({
      lipstick: {
        color: "#FF0000",
        intensity: 0.8,
      },
    });

    expect(original.makeup).toEqual({});
  });

  it("deep merges makeup configuration", () => {
    const original = createCharacter({
      name: "Riya",
      seed: 701,
    });

    const first = engine.makeup(original, {
      lipstick: {
        color: "#FF0000",
        intensity: 0.5,
      },
    });

    const second = engine.makeup(first, {
      lipstick: {
        intensity: 0.9,
      },
    });

    expect(second.makeup).toEqual({
      lipstick: {
        color: "#FF0000",
        intensity: 0.9,
      },
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Variant                                                                */
  /* ---------------------------------------------------------------------- */

  it("creates a valid character variant", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 800,
    });

    const variant = engine.variant(
      character,
      "Festival Outfit",
      {
        outfit: {
          topColor: "#FFD700",
        },
      },
    );

    expect(variant.baseAssemblyId).toBe(
      character.id,
    );

    expect(variant.name).toBe(
      "Festival Outfit",
    );

    expect(variant.delta).toEqual({
      outfit: {
        topColor: "#FFD700",
      },
    });
  });

  it("creates deterministic variants", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 801,
    });

    const first = engine.variant(
      character,
      "Winter",
      {
        outfit: {
          topColor: "#FFFFFF",
        },
      },
    );

    const second = engine.variant(
      character,
      "Winter",
      {
        outfit: {
          topColor: "#FFFFFF",
        },
      },
    );

    expect(first).toEqual(second);
  });

  it("does not mutate the base character when creating a variant", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 802,
    });

    const before = structuredClone(character);

    engine.variant(
      character,
      "School",
      {
        outfit: {
          topColor: "#0000FF",
        },
      },
    );

    expect(character).toEqual(before);
  });

  /* ---------------------------------------------------------------------- */
  /* Rig Binding                                                            */
  /* ---------------------------------------------------------------------- */

  it("binds a compatible 2D rig to a 2D character", () => {
    const character = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 900,
    });

    const rig = createRig("2d");

    const result = engine.bindRig(
      character,
      rig,
    );

    expect(result.rigId).toBe(rig.id);
    expect(character.rigId).toBeNull();
  });

  it("binds a compatible 3D rig to a 3D character", () => {
    const character = createCharacter({
      name: "Aarav",
      representation: "3d",
      seed: 901,
    });

    const rig = createRig("3d");

    const result = engine.bindRig(
      character,
      rig,
    );

    expect(result.rigId).toBe(rig.id);
  });

  it("allows both 2D and 3D rigs for a hybrid character", () => {
    const character = createCharacter({
      name: "Hybrid",
      representation: "hybrid",
      seed: 902,
    });

    const rig2d = createRig("2d");
    const rig3d = createRig("3d");

    const with2d = engine.bindRig(
      character,
      rig2d,
    );

    const with3d = engine.bindRig(
      character,
      rig3d,
    );

    expect(with2d.rigId).toBe(rig2d.id);
    expect(with3d.rigId).toBe(rig3d.id);
  });

  it("rejects a 3D rig on a 2D character", () => {
    const character = createCharacter({
      name: "Aarav",
      representation: "2d",
      seed: 903,
    });

    const rig = createRig("3d");

    expect(() =>
      engine.bindRig(
        character,
        rig,
      ),
    ).toThrow();
  });

  it("rejects a 2D rig on a 3D character", () => {
    const character = createCharacter({
      name: "Aarav",
      representation: "3d",
      seed: 904,
    });

    const rig = createRig("2d");

    expect(() =>
      engine.bindRig(
        character,
        rig,
      ),
    ).toThrow();
  });

  /* ---------------------------------------------------------------------- */
  /* Validation                                                             */
  /* ---------------------------------------------------------------------- */

  it("validates a character assembly", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1000,
    });

    const validated =
      engine.validateAssembly(character);

    expect(validated).toEqual(character);
  });

  it("validates a character variant", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1001,
    });

    const variant = engine.variant(
      character,
      "Variant",
      {
        hair: {
          style: "long",
        },
      },
    );

    const validated =
      engine.validateVariant(variant);

    expect(validated).toEqual(variant);
  });

  /* ---------------------------------------------------------------------- */
  /* Fingerprint                                                            */
  /* ---------------------------------------------------------------------- */

  it("produces a stable fingerprint", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1100,
    });

    const first = engine.fingerprint(
      character,
    );

    const second = engine.fingerprint(
      structuredClone(character),
    );

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("changes the fingerprint when canonical character state changes", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1101,
    });

    const customized = engine.customize(
      character,
      {
        parameters: {
          age: 40,
        },
      },
    );

    const originalFingerprint =
      engine.fingerprint(character);

    const customizedFingerprint =
      engine.fingerprint(customized);

    expect(customizedFingerprint).not.toBe(
      originalFingerprint,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Contract Safety                                                        */
  /* ---------------------------------------------------------------------- */

  it("does not expose mutable references from validation", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1200,
    });

    const validated =
      engine.validateAssembly(character);

    validated.parameters.age = 99;

    expect(character.parameters.age).toBe(18);
  });

  it("rejects invalid outfit input", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1201,
    });

    expect(() =>
      engine.dress(
        character,
        null as unknown as Record<
          string,
          unknown
        >,
      ),
    ).toThrow();
  });

  it("rejects invalid makeup input", () => {
    const character = createCharacter({
      name: "Riya",
      seed: 1202,
    });

    expect(() =>
      engine.makeup(
        character,
        null as unknown as Record<
          string,
          unknown
        >,
      ),
    ).toThrow();
  });

  it("rejects invalid variant input", () => {
    const character = createCharacter({
      name: "Aarav",
      seed: 1203,
    });

    expect(() =>
      engine.variant(
        character,
        "Invalid",
        null as unknown as Record<
          string,
          unknown
        >,
      ),
    ).toThrow();
  });
});