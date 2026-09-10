import { z } from "zod";
import { canonicalHash, uuid } from "../../domain/src/index.js";

/**
 * Character Asset System
 *
 * This package describes reusable character assets.
 *
 * It does NOT render assets.
 * It does NOT load external URLs.
 * It does NOT execute arbitrary files.
 *
 * Rendering and asset loading remain separate adapters.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export const CharacterAssetRepresentationSchema =
  z.enum(["2d", "3d", "hybrid"]);

export type CharacterAssetRepresentation =
  z.infer<typeof CharacterAssetRepresentationSchema>;

export const CharacterAssetSlotSchema = z.enum([
  "body",
  "face",
  "eyes",
  "eyebrows",
  "nose",
  "mouth",
  "hair",
  "top",
  "bottom",
  "shoes",
  "accessory",
  "makeup",
]);

export type CharacterAssetSlot =
  z.infer<typeof CharacterAssetSlotSchema>;

export const CharacterAssetKindSchema = z.enum([
  "sprite",
  "vector",
  "texture",
  "mesh",
  "material",
  "rig-part",
  "morph-target",
  "makeup-layer",
  "accessory",
]);

export type CharacterAssetKind =
  z.infer<typeof CharacterAssetKindSchema>;

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Provenance is mandatory so that the engine can track
 * where an asset came from and what license applies to it.
 */
export const CharacterAssetProvenanceSchema =
  z.object({
    sourceType: z.enum([
      "builtin",
      "generated",
      "user",
      "imported",
    ]),

    sourceId: z.string().min(1),

    license: z.string().min(1),

    attribution: z.string().optional(),

    sourceUrl: z.string().url().optional(),

    notes: z.string().optional(),
  });

export type CharacterAssetProvenance =
  z.infer<typeof CharacterAssetProvenanceSchema>;

/* -------------------------------------------------------------------------- */
/* Asset Metadata                                                             */
/* -------------------------------------------------------------------------- */

export const CharacterAssetMetadataSchema =
  z.object({
    tags: z.array(z.string().min(1)).default([]),

    style: z.string().min(1).optional(),

    gender: z.string().min(1).optional(),

    ageMin: z.number().int().min(0).optional(),

    ageMax: z.number().int().min(0).optional(),

    colors: z.array(z.string().min(1)).default([]),

    variantOf: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.ageMin !== undefined &&
      value.ageMax !== undefined &&
      value.ageMin > value.ageMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ageMin"],
        message: "ageMin cannot be greater than ageMax",
      });
    }
  });

export type CharacterAssetMetadata =
  z.infer<typeof CharacterAssetMetadataSchema>;

/* -------------------------------------------------------------------------- */
/* Character Asset                                                            */
/* -------------------------------------------------------------------------- */

export const CharacterAssetSchema =
  z.object({
    id: z.string().uuid(),

    schemaVersion: z.string().min(1),

    name: z.string().min(1),

    slot: CharacterAssetSlotSchema,

    kind: CharacterAssetKindSchema,

    representations:
      z.array(
        CharacterAssetRepresentationSchema,
      )
      .min(1),

    assetVersion:
      z.number()
        .int()
        .nonnegative(),

    contentHash:
      z.string()
        .regex(
          /^[a-f0-9]{64}$/,
          "contentHash must be a SHA-256 hexadecimal hash",
        ),

    metadata:
      CharacterAssetMetadataSchema,

    provenance:
      CharacterAssetProvenanceSchema,

    /**
     * Adapter-specific information.
     *
     * The canonical engine does not interpret this field.
     */
    adapterData:
      z.record(z.string(), z.unknown())
        .default({}),

    /**
     * Whether this asset is currently available
     * to the execution environment.
     */
    enabled:
      z.boolean()
        .default(true),
  });

export type CharacterAsset =
  z.infer<typeof CharacterAssetSchema>;

/* -------------------------------------------------------------------------- */
/* Asset Create Input                                                         */
/* -------------------------------------------------------------------------- */

export interface CharacterAssetCreateInput {
  name: string;

  slot: CharacterAssetSlot;

  kind: CharacterAssetKind;

  representations: CharacterAssetRepresentation[];

  contentHash: string;

  metadata?: Partial<CharacterAssetMetadata>;

  provenance: CharacterAssetProvenance;

  adapterData?: Record<string, unknown>;

  enabled?: boolean;

  assetVersion?: number;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function requireName(value: string): string {
  const name = value.trim();

  if (!name) {
    throw new Error(
      "Character asset name must not be empty",
    );
  }

  return name;
}

/**
 * CharacterAssetEngine
 *
 * Responsibilities:
 *
 * - create asset descriptors
 * - validate assets
 * - fingerprint assets
 * - create immutable metadata variants
 *
 * Non-responsibilities:
 *
 * - rendering
 * - image generation
 * - model generation
 * - file execution
 * - network downloading
 */
export class CharacterAssetEngine {
  /**
   * Create a canonical asset descriptor.
   */
  create(
    input: CharacterAssetCreateInput,
  ): CharacterAsset {
    const name = requireName(input.name);

    if (input.representations.length === 0) {
      throw new Error(
        "At least one character asset representation is required",
      );
    }

    const contentHash =
      input.contentHash.toLowerCase();

    const asset = {
      id: uuid(),

      schemaVersion: "1.0.0",

      name,

      slot: input.slot,

      kind: input.kind,

      representations:
        [...new Set(input.representations)],

      assetVersion:
        input.assetVersion ?? 1,

      contentHash,

      metadata: {
        tags: input.metadata?.tags ?? [],
        style: input.metadata?.style,
        gender: input.metadata?.gender,
        ageMin: input.metadata?.ageMin,
        ageMax: input.metadata?.ageMax,
        colors: input.metadata?.colors ?? [],
        variantOf: input.metadata?.variantOf,
      },

      provenance: input.provenance,

      adapterData:
        input.adapterData ?? {},

      enabled:
        input.enabled ?? true,
    };

    return CharacterAssetSchema.parse(asset);
  }

  /**
   * Validate an existing asset descriptor.
   */
  validate(
    asset: CharacterAsset,
  ): CharacterAsset {
    return CharacterAssetSchema.parse(
      structuredClone(asset),
    );
  }

  /**
   * Create a new metadata variant.
   *
   * The original asset remains unchanged.
   */
  createVariant(
    asset: CharacterAsset,
    name: string,
    metadataPatch: Partial<CharacterAssetMetadata>,
  ): CharacterAsset {
    const current =
      this.validate(asset);

    const variant = {
      ...structuredClone(current),

      id: uuid(),

      name: requireName(name),

      assetVersion:
        current.assetVersion + 1,

      metadata: {
        ...current.metadata,
        ...metadataPatch,
        variantOf: current.id,
      },
    };

    return CharacterAssetSchema.parse(
      variant,
    );
  }

  /**
   * Calculate deterministic asset fingerprint.
   */
  fingerprint(
    asset: CharacterAsset,
  ): string {
    const validated =
      this.validate(asset);

    return canonicalHash(
      validated,
    );
  }

  /**
   * Check whether an asset can be used
   * by a requested representation.
   */
  supportsRepresentation(
    asset: CharacterAsset,
    representation: CharacterAssetRepresentation,
  ): boolean {
    const validated =
      this.validate(asset);

    return validated.representations.includes(
      representation,
    );
  }

  /**
   * Check whether the asset is enabled.
   */
  isUsable(
    asset: CharacterAsset,
  ): boolean {
    return this.validate(asset).enabled;
  }
}

/* -------------------------------------------------------------------------- */
/* Built-in Asset Factories                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Create a deterministic built-in placeholder asset descriptor.
 *
 * This does NOT create a real image or 3D model.
 * It only defines the canonical asset metadata.
 */
export function createBuiltinAsset(
  input: Omit<
    CharacterAssetCreateInput,
    "provenance"
  >,
): CharacterAsset {
  return new CharacterAssetEngine().create({
    ...input,

    provenance: {
      sourceType: "builtin",
      sourceId: `builtin:${input.slot}:${input.name}`,
      license: "MIT",
    },
  });
}