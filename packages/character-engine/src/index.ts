import { z } from "zod";

import {
  canonicalHash,
  CaeError,
} from "../../domain/src/index.js";

import {
  CharacterAssembly as CharacterAssemblySchema,
  CharacterDefinition as CharacterDefinitionSchema,
  CharacterVariant as CharacterVariantSchema,
  RigDefinition as RigDefinitionSchema,
} from "../../contracts/src/index.js";

/* ============================================================
 * CANONICAL CONTRACT TYPES
 * ============================================================ */

export type CharacterAssembly =
  z.infer<typeof CharacterAssemblySchema>;

export type CharacterDefinition =
  z.infer<typeof CharacterDefinitionSchema>;

export type CharacterVariant =
  z.infer<typeof CharacterVariantSchema>;

export type RigDefinition =
  z.infer<typeof RigDefinitionSchema>;

/* ============================================================
 * CHARACTER REPRESENTATION
 * ============================================================ */

export type CharacterRepresentation =
  | "2d"
  | "3d"
  | "hybrid";

/* ============================================================
 * STABLE ENGINE IDENTIFIERS
 *
 * Definition IDs are stable because a definition is a reusable
 * template. Character assemblies receive deterministic IDs from
 * their canonical creation input.
 * ============================================================ */

const CARTOON_HUMAN_DEFINITION_ID =
  "00000000-0000-4000-8000-000000000001";

/* ============================================================
 * INPUT CONTRACTS
 * ============================================================ */

export interface CharacterCreateInput {
  name: string;

  age?: number;

  gender?: string;

  skin?: string;

  hair?: {
    style?: string;
    color?: string;
    length?: string;
    texture?: string;
  };

  eyes?: {
    color?: string;
    size?: number;
    shape?: string;
  };

  body?: {
    height?: number;
    build?: string;
    headScale?: number;
    shoulderWidth?: number;
  };

  outfit?: Record<string, unknown>;

  makeup?: Record<string, unknown>;

  representation?: CharacterRepresentation;

  /**
   * Explicit deterministic seed.
   */
  seed?: number;
}

export interface CharacterCustomizationPatch {
  parameters?: Record<string, unknown>;

  hair?: Record<string, unknown>;

  outfit?: Record<string, unknown>;

  makeup?: Record<string, unknown>;

  [key: string]: unknown;
}

type UnknownRecord =
  Record<string, unknown>;

/* ============================================================
 * GENERAL HELPERS
 * ============================================================ */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Deep merge plain records.
 */
function mergeRecords(
  base: UnknownRecord,
  patch: UnknownRecord,
): UnknownRecord {
  const result =
    clone(base);

  for (
    const [key, value]
    of Object.entries(patch)
  ) {
    const existing =
      result[key];

    if (
      isRecord(existing) &&
      isRecord(value)
    ) {
      result[key] =
        mergeRecords(
          existing,
          value,
        );

      continue;
    }

    result[key] =
      clone(value);
  }

  return result;
}

/* ============================================================
 * VALIDATION HELPERS
 * ============================================================ */

function requireNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CaeError(
      "INVALID_CHARACTER_INPUT",
      `${field} must be a non-empty string`,
      [field],
    );
  }

  return value.trim();
}

function validateNumber(
  value: unknown,
  field: string,
  min?: number,
  max?: number,
): void {
  if (
    value === undefined
  ) {
    return;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new CaeError(
      "INVALID_CHARACTER_INPUT",
      `${field} must be a finite number`,
      [field],
    );
  }

  if (
    min !== undefined &&
    value < min
  ) {
    throw new CaeError(
      "INVALID_CHARACTER_INPUT",
      `${field} must be >= ${min}`,
      [field],
    );
  }

  if (
    max !== undefined &&
    value > max
  ) {
    throw new CaeError(
      "INVALID_CHARACTER_INPUT",
      `${field} must be <= ${max}`,
      [field],
    );
  }
}

function validateRepresentation(
  representation: CharacterRepresentation,
): void {
  if (
    representation !== "2d" &&
    representation !== "3d" &&
    representation !== "hybrid"
  ) {
    throw new CaeError(
      "INVALID_CHARACTER_INPUT",
      `Unsupported character representation: ${representation}`,
      ["representation"],
    );
  }
}

/* ============================================================
 * DETERMINISTIC UUID
 *
 * UUID must satisfy the Zod UUID validator while remaining
 * deterministic for the same canonical input.
 * ============================================================ */

function deterministicUuid(
  value: unknown,
): string {
  const hash =
    canonicalHash(value);

  const hex =
    hash.slice(0, 32)
      .padEnd(32, "0");

  const chars =
    hex.split("");

  /*
   * UUID version 4 compatible representation.
   *
   * We are not claiming this is random UUID v4.
   * The bits are normalized so standard UUID validators accept
   * the resulting identifier.
   */

  chars[12] = "4";

  const variant =
    Number.parseInt(
      chars[16],
      16,
    );

  chars[16] =
    ((variant & 0x3) | 0x8)
      .toString(16);

  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

/* ============================================================
 * DETERMINISTIC SEED
 * ============================================================ */

function hashSeed(
  value: unknown,
): number {
  const hash =
    canonicalHash(value);

  return (
    Number.parseInt(
      hash.slice(0, 8),
      16,
    ) >>> 0
  );
}

/* ============================================================
 * DEFAULT CHARACTER DEFINITION
 * ============================================================ */

export function
defaultCharacterDefinition():
  CharacterDefinition {
  const definition = {
    id:
      CARTOON_HUMAN_DEFINITION_ID,

    schemaVersion:
      "1.0.0",

    name:
      "Cartoon Human",

    representations: [
      "2d",
      "3d",
      "hybrid",
    ],

    parameterSchema: {
      age: {
        type: "number",
        min: 1,
        max: 120,
      },

      gender: {
        type: "string",
      },

      skin: {
        type: "string",
      },

      hair: {
        type: "object",
      },

      eyes: {
        type: "object",
      },

      body: {
        type: "object",
      },
    },

    slots: [
      "hair",
      "eyes",
      "top",
      "bottom",
      "shoes",
      "accessory",
      "makeup",
    ],

    rigProfiles: [
      "humanoid-2d",
      "humanoid-3d",
    ],

    defaults: {
      age: 18,

      gender:
        "unspecified",

      skin:
        "#F1C7A8",

      hair: {
        style:
          "short",

        color:
          "#24170F",

        length:
          "short",

        texture:
          "straight",
      },

      eyes: {
        color:
          "#2B2118",

        size:
          1,

        shape:
          "round",
      },

      body: {
        height:
          1,

        build:
          "average",

        headScale:
          1,

        shoulderWidth:
          1,
      },
    },

    capabilities: [
      "character.create",
      "character.modify",
      "dress.up",
      "makeup.apply",
      "expression",
      "motion",
    ],
  };

  return CharacterDefinitionSchema.parse(
    definition,
  );
}

/* ============================================================
 * CHARACTER ENGINE
 * ============================================================ */

export class CharacterEngine {

  /* ==========================================================
   * CREATE
   * ========================================================== */

  create(
    input: CharacterCreateInput,
  ): CharacterAssembly {

    const name =
      requireNonEmptyString(
        input.name,
        "name",
      );

    const representation =
      input.representation ??
      "2d";

    validateRepresentation(
      representation,
    );

    validateNumber(
      input.age,
      "age",
      1,
      120,
    );

    validateNumber(
      input.eyes?.size,
      "eyes.size",
      0.1,
      5,
    );

    validateNumber(
      input.body?.height,
      "body.height",
      0.1,
      10,
    );

    validateNumber(
      input.body?.headScale,
      "body.headScale",
      0.1,
      5,
    );

    validateNumber(
      input.body?.shoulderWidth,
      "body.shoulderWidth",
      0.1,
      5,
    );

    if (
      input.seed !== undefined &&
      (
        !Number.isInteger(input.seed) ||
        input.seed < 0
      )
    ) {
      throw new CaeError(
        "INVALID_CHARACTER_INPUT",
        "seed must be a non-negative integer",
        ["seed"],
      );
    }

    /* --------------------------------------------------------
     * Canonical creation input.
     *
     * This is deliberately independent from generated UUIDs.
     * -------------------------------------------------------- */

    const canonicalInput = {
      name,

      age:
        input.age ??
        18,

      gender:
        input.gender?.trim() ||
        "unspecified",

      skin:
        input.skin?.trim() ||
        "#F1C7A8",

      hair:
        input.hair ??
        {},

      eyes:
        input.eyes ??
        {},

      body:
        input.body ??
        {},

      outfit:
        input.outfit ??
        {},

      makeup:
        input.makeup ??
        {},

      representation,
    };

    /* --------------------------------------------------------
     * Deterministic seed.
     * -------------------------------------------------------- */

    const seed =
      input.seed ??
      hashSeed(
        canonicalInput,
      );

    /* --------------------------------------------------------
     * Character parameters.
     * -------------------------------------------------------- */

    const parameters = {
      age:
        input.age ??
        18,

      gender:
        input.gender?.trim() ||
        "unspecified",

      skin:
        input.skin?.trim() ||
        "#F1C7A8",

      eyes: {
        color:
          input.eyes?.color ??
          "#2B2118",

        size:
          input.eyes?.size ??
          1,

        shape:
          input.eyes?.shape ??
          "round",
      },

      body: {
        height:
          input.body?.height ??
          1,

        build:
          input.body?.build ??
          "average",

        headScale:
          input.body?.headScale ??
          1,

        shoulderWidth:
          input.body?.shoulderWidth ??
          1,
      },
    };

    /* --------------------------------------------------------
     * Hair.
     * -------------------------------------------------------- */

    const hair = {
      style:
        input.hair?.style ??
        "short",

      color:
        input.hair?.color ??
        "#24170F",

      length:
        input.hair?.length ??
        "short",

      texture:
        input.hair?.texture ??
        "straight",
    };

    /* --------------------------------------------------------
     * Outfit.
     * -------------------------------------------------------- */

    const outfit =
      input.outfit ??
      {
        topColor:
          "#3A6EA5",

        bottomColor:
          "#243447",

        shoesColor:
          "#222222",
      };

    /* --------------------------------------------------------
     * Makeup.
     * -------------------------------------------------------- */

    const makeup =
      input.makeup ??
      {};

    /* --------------------------------------------------------
     * Deterministic assembly ID.
     *
     * Same canonical input + same seed = same ID.
     * Different character input normally produces another ID.
     * -------------------------------------------------------- */

    const assemblyIdentity = {
      definitionId:
        CARTOON_HUMAN_DEFINITION_ID,

      definitionRevision:
        1,

      name,

      representation,

      seed,

      parameters,

      outfit,

      makeup,

      hair,
    };

    const assembly = {
      id:
        deterministicUuid(
          assemblyIdentity,
        ),

      schemaVersion:
        "1.0.0",

      name,

      definitionId:
        CARTOON_HUMAN_DEFINITION_ID,

      definitionRevision:
        1,

      representation,

      seed,

      parameters,

      outfit,

      makeup,

      hair,

      rigId:
        null,

      variants: [],
    };

    return CharacterAssemblySchema.parse(
      assembly,
    );
  }

  /* ==========================================================
   * CUSTOMIZE
   * ========================================================== */

  customize(
    assembly: CharacterAssembly,
    patch: CharacterCustomizationPatch,
  ): CharacterAssembly {

    const current =
      CharacterAssemblySchema.parse(
        clone(assembly),
      );

    if (
      !isRecord(patch)
    ) {
      throw new CaeError(
        "INVALID_CHARACTER_INPUT",
        "customization patch must be an object",
        ["patch"],
      );
    }

    const result =
      mergeRecords(
        current as UnknownRecord,
        patch,
      );

    /*
     * Identity / lineage fields are immutable.
     */

    result.id =
      current.id;

    result.schemaVersion =
      current.schemaVersion;

    result.definitionId =
      current.definitionId;

    result.definitionRevision =
      current.definitionRevision;

    result.seed =
      current.seed;

    result.rigId =
      current.rigId;

    return CharacterAssemblySchema.parse(
      result,
    );
  }

  /* ==========================================================
   * DRESS
   * ========================================================== */

  dress(
    assembly: CharacterAssembly,
    outfit: Record<string, unknown>,
  ): CharacterAssembly {

    const current =
      CharacterAssemblySchema.parse(
        clone(assembly),
      );

    if (
      !isRecord(outfit)
    ) {
      throw new CaeError(
        "INVALID_CHARACTER_INPUT",
        "outfit must be an object",
        ["outfit"],
      );
    }

    const result =
      clone(current);

    result.outfit =
      mergeRecords(
        current.outfit,
        outfit,
      );

    return CharacterAssemblySchema.parse(
      result,
    );
  }

  /* ==========================================================
   * MAKEUP
   * ========================================================== */

  makeup(
    assembly: CharacterAssembly,
    makeup: Record<string, unknown>,
  ): CharacterAssembly {

    const current =
      CharacterAssemblySchema.parse(
        clone(assembly),
      );

    if (
      !isRecord(makeup)
    ) {
      throw new CaeError(
        "INVALID_CHARACTER_INPUT",
        "makeup must be an object",
        ["makeup"],
      );
    }

    const result =
      clone(current);

    result.makeup =
      mergeRecords(
        current.makeup,
        makeup,
      );

    return CharacterAssemblySchema.parse(
      result,
    );
  }

  /* ==========================================================
   * VARIANT
   * ========================================================== */

  variant(
    assembly: CharacterAssembly,
    name: string,
    delta: Record<string, unknown>,
  ): CharacterVariant {

    const current =
      CharacterAssemblySchema.parse(
        clone(assembly),
      );

    const variantName =
      requireNonEmptyString(
        name,
        "name",
      );

    if (
      !isRecord(delta)
    ) {
      throw new CaeError(
        "INVALID_CHARACTER_INPUT",
        "variant delta must be an object",
        ["delta"],
      );
    }

    const variant = {
      id:
        deterministicUuid({
          baseAssemblyId:
            current.id,

          name:
            variantName,

          delta,
        }),

      baseAssemblyId:
        current.id,

      name:
        variantName,

      delta:
        clone(delta),
    };

    return CharacterVariantSchema.parse(
      variant,
    );
  }

  /* ==========================================================
   * BIND RIG
   * ========================================================== */

  bindRig(
    assembly: CharacterAssembly,
    rig: RigDefinition,
  ): CharacterAssembly {

    const current =
      CharacterAssemblySchema.parse(
        clone(assembly),
      );

    const validatedRig =
      RigDefinitionSchema.parse(
        clone(rig),
      );

    /*
     * 2D character + 3D rig = invalid.
     */

    if (
      validatedRig.dimension === "3d" &&
      current.representation === "2d"
    ) {
      throw new CaeError(
        "RIG_DIMENSION_MISMATCH",
        "A 3D rig cannot be bound to a 2D-only character",
        [
          current.id,
          validatedRig.id,
        ],
      );
    }

    /*
     * 3D character + 2D rig = invalid.
     */

    if (
      validatedRig.dimension === "2d" &&
      current.representation === "3d"
    ) {
      throw new CaeError(
        "RIG_DIMENSION_MISMATCH",
        "A 2D rig cannot be bound to a 3D-only character",
        [
          current.id,
          validatedRig.id,
        ],
      );
    }

    /*
     * Hybrid character may use either rig.
     */

    const result =
      clone(current);

    result.rigId =
      validatedRig.id;

    return CharacterAssemblySchema.parse(
      result,
    );
  }

  /* ==========================================================
   * VALIDATE DEFINITION
   * ========================================================== */

  validateDefinition(
    definition: CharacterDefinition,
  ): CharacterDefinition {

    return CharacterDefinitionSchema.parse(
      clone(definition),
    );
  }

  /* ==========================================================
   * VALIDATE ASSEMBLY
   * ========================================================== */

  validateAssembly(
    assembly: CharacterAssembly,
  ): CharacterAssembly {

    return CharacterAssemblySchema.parse(
      clone(assembly),
    );
  }

  /* ==========================================================
   * VALIDATE VARIANT
   * ========================================================== */

  validateVariant(
    variant: CharacterVariant,
  ): CharacterVariant {

    return CharacterVariantSchema.parse(
      clone(variant),
    );
  }

  /* ==========================================================
   * FINGERPRINT
   * ========================================================== */

  fingerprint(
    assembly: CharacterAssembly,
  ): string {

    const validated =
      CharacterAssemblySchema.parse(
        clone(assembly),
      );

    return canonicalHash(
      validated,
    );
  }
}