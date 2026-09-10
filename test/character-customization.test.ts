import { describe, expect, it } from "vitest";

import {
  CHARACTER_CUSTOMIZATION_SCHEMA_VERSION,
  CharacterCustomizationSchema,
  cloneCharacterCustomization,
  defaultCharacterCustomization,
  mergeCharacterCustomization,
  validateCharacterCustomization,
} from "../packages/character-customization/src/index.js";

describe("Character Customization Engine", () => {
  it("creates the canonical default customization", () => {
    const customization = defaultCharacterCustomization();

    expect(customization.schemaVersion).toBe(
      CHARACTER_CUSTOMIZATION_SCHEMA_VERSION,
    );

    expect(customization.body).toEqual({});
    expect(customization.face).toEqual({});
    expect(customization.eyes).toEqual({});
    expect(customization.hair).toEqual({});
    expect(customization.skin).toEqual({});
    expect(customization.outfit).toEqual({});
    expect(customization.makeup).toEqual({});

    expect(customization.expression).toEqual({
      name: "neutral",
      intensity: 1,
      controls: {},
    });

    expect(
      CharacterCustomizationSchema.safeParse(customization).success,
    ).toBe(true);
  });

  it("validates a complete customization state", () => {
    const customization = {
      schemaVersion: "1.0.0",

      body: {
        height: 1.2,
        build: "athletic",
        headScale: 1.05,
        shoulderWidth: 1.1,
        torsoProportion: 1,
        armLength: 1.05,
        legLength: 1.1,
        handSize: 0.95,
        footSize: 1,
        neckWidth: 0.9,
      },

      face: {
        shape: "oval",
        jawWidth: 1.1,
        jawHeight: 1,
        cheekFullness: 0.4,
        chinSize: 0.9,
        foreheadHeight: 1,
        noseSize: 0.8,
        noseWidth: 0.7,
        earSize: 0.8,
        mouthWidth: 1,
        lipFullness: 0.5,
      },

      eyes: {
        color: "#2B2118",
        size: 1.1,
        width: 1,
        height: 1.05,
        spacing: 0.9,
        rotation: -2,
        shape: "round",
        pupilSize: 0.8,
        irisSize: 0.9,
        eyebrowThickness: 0.7,
        eyebrowShape: "soft",
      },

      hair: {
        style: "short",
        length: "medium",
        texture: "wavy",
        primaryColor: "#24170F",
        secondaryColor: "#4A2F20",
        highlightColor: "#8B5A3C",
        density: 0.8,
        volume: 1.2,
        hairline: 0.5,
        facialHair: "none",
      },

      skin: {
        baseColor: "#F1C7A8",
        tone: 0.1,
        saturation: 0,
        brightness: 0.05,
        freckles: 0.2,
        facialMarks: [
          {
            id: "mark-1",
            type: "freckle",
            intensity: 0.4,
          },
        ],
        ageMarks: 0.1,
      },

      outfit: {
        top: {
          assetId: "550e8400-e29b-41d4-a716-446655440000",
          revision: 1,
          contentHash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          enabled: true,
          parameters: {
            color: "#336699",
          },
        },
        shoes: {
          assetId: "550e8400-e29b-41d4-a716-446655440001",
          enabled: true,
          parameters: {},
        },
      },

      makeup: {
        foundation: "#F1C7A8",
        blush: {
          color: "#E88A8A",
          intensity: 0.4,
        },
        lipstick: {
          color: "#B03060",
          intensity: 0.5,
        },
        eyeliner: {
          color: "#111111",
          intensity: 0.7,
        },
      },

      expression: {
        name: "happy",
        intensity: 0.85,
        controls: {
          smile: 0.9,
          eyes: 0.4,
        },
      },
    };

    const result = validateCharacterCustomization(customization);

    expect(result).toEqual(customization);
  });

  it("merges nested customization fields without mutating the base", () => {
    const base = defaultCharacterCustomization();

    const result = mergeCharacterCustomization(base, {
      body: {
        height: 1.4,
        build: "athletic",
      },

      hair: {
        style: "long",
        primaryColor: "#000000",
      },

      eyes: {
        color: "#3366FF",
        size: 1.25,
      },

      expression: {
        name: "happy",
        intensity: 0.8,
        controls: {
          smile: 1,
        },
      },
    });

    expect(result.body).toEqual({
      height: 1.4,
      build: "athletic",
    });

    expect(result.hair).toEqual({
      style: "long",
      primaryColor: "#000000",
    });

    expect(result.eyes).toEqual({
      color: "#3366FF",
      size: 1.25,
    });

    expect(result.expression).toEqual({
      name: "happy",
      intensity: 0.8,
      controls: {
        smile: 1,
      },
    });

    expect(base).toEqual(defaultCharacterCustomization());
  });

  it("preserves existing nested fields when applying a patch", () => {
    const base = defaultCharacterCustomization();

    const first = mergeCharacterCustomization(base, {
      hair: {
        style: "curly",
        length: "long",
        primaryColor: "#111111",
      },
      expression: {
        name: "happy",
        intensity: 0.7,
        controls: {
          smile: 0.8,
          cheekRaise: 0.3,
        },
      },
    });

    const second = mergeCharacterCustomization(first, {
      hair: {
        volume: 1.5,
      },
      expression: {
        controls: {
          smile: 1,
        },
      },
    });

    expect(second.hair).toEqual({
      style: "curly",
      length: "long",
      primaryColor: "#111111",
      volume: 1.5,
    });

    expect(second.expression).toEqual({
      name: "happy",
      intensity: 0.7,
      controls: {
        smile: 1,
        cheekRaise: 0.3,
      },
    });
  });

  it("deep clones customization without sharing mutable references", () => {
    const original = mergeCharacterCustomization(
      defaultCharacterCustomization(),
      {
        hair: {
          style: "curly",
        },
        expression: {
          name: "happy",
          controls: {
            smile: 0.8,
          },
        },
      },
    );

    const cloned = cloneCharacterCustomization(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.hair).not.toBe(original.hair);
    expect(cloned.expression).not.toBe(original.expression);
    expect(cloned.expression.controls).not.toBe(
      original.expression.controls,
    );

    cloned.hair.style = "short";
    cloned.expression.controls.smile = 0;

    expect(original.hair.style).toBe("curly");
    expect(original.expression.controls.smile).toBe(0.8);
  });

  it("rejects invalid hexadecimal colors", () => {
    expect(() =>
      validateCharacterCustomization({
        hair: {
          primaryColor: "red",
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        eyes: {
          color: "#GGGGGG",
        },
      }),
    ).toThrow();
  });

  it("rejects values outside customization limits", () => {
    expect(() =>
      validateCharacterCustomization({
        body: {
          height: 0,
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        body: {
          headScale: 10,
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        hair: {
          density: 2,
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        expression: {
          name: "happy",
          intensity: 2,
        },
      }),
    ).toThrow();
  });

  it("rejects unknown fields because canonical customization is strict", () => {
    expect(() =>
      validateCharacterCustomization({
        body: {
          height: 1,
          unknownBodyProperty: true,
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        hair: {
          style: "short",
          unknownHairProperty: true,
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        unknownTopLevelProperty: true,
      }),
    ).toThrow();
  });

  it("rejects invalid outfit items", () => {
    expect(() =>
      validateCharacterCustomization({
        outfit: {
          top: {
            assetId: "not-a-uuid",
          },
        },
      }),
    ).toThrow();

    expect(() =>
      validateCharacterCustomization({
        outfit: {
          top: {
            assetId: "550e8400-e29b-41d4-a716-446655440000",
            contentHash: "invalid-hash",
          },
        },
      }),
    ).toThrow();
  });

  it("preserves canonical schema version", () => {
    const customization = defaultCharacterCustomization();

    expect(customization.schemaVersion).toBe("1.0.0");

    const modified = mergeCharacterCustomization(
      customization,
      {
        schemaVersion: "1.0.0",
        hair: {
          style: "buzz",
        },
      },
    );

    expect(modified.schemaVersion).toBe(
      CHARACTER_CUSTOMIZATION_SCHEMA_VERSION,
    );
  });

  it("supports all supported expression names", () => {
    const expressions = [
      "neutral",
      "happy",
      "sad",
      "angry",
      "surprised",
      "fearful",
      "disgusted",
    ] as const;

    for (const name of expressions) {
      const result = validateCharacterCustomization({
        expression: {
          name,
          intensity: 1,
          controls: {},
        },
      });

      expect(result.expression.name).toBe(name);
    }
  });

  it("does not mutate the original object during validation", () => {
    const source = {
      hair: {
        style: "long",
      },
      expression: {
        name: "happy",
        intensity: 0.5,
        controls: {
          smile: 0.8,
        },
      },
    };

    const snapshot = structuredClone(source);

    const result = validateCharacterCustomization(source);

    expect(source).toEqual(snapshot);
    expect(result).not.toBe(source);
    expect(result.hair).not.toBe(source.hair);
    expect(result.expression).not.toBe(source.expression);
  });

  it("produces stable equivalent customization states", () => {
    const first = mergeCharacterCustomization(
      defaultCharacterCustomization(),
      {
        hair: {
          style: "short",
          primaryColor: "#24170F",
        },
        eyes: {
          color: "#2B2118",
        },
      },
    );

    const second = mergeCharacterCustomization(
      defaultCharacterCustomization(),
      {
        hair: {
          style: "short",
          primaryColor: "#24170F",
        },
        eyes: {
          color: "#2B2118",
        },
      },
    );

    expect(first).toEqual(second);
  });
});