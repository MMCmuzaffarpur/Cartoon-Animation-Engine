import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const CHARACTER_CUSTOMIZATION_SCHEMA_VERSION = "1.0.0";

/* -------------------------------------------------------------------------- */
/* Primitive Validators                                                       */
/* -------------------------------------------------------------------------- */

const HexColor = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    "Color must be a valid hexadecimal color",
  );

const NormalizedUnit = z
  .number()
  .finite()
  .min(0)
  .max(1);

/* -------------------------------------------------------------------------- */
/* Body Customization                                                         */
/* -------------------------------------------------------------------------- */

export const CharacterBodyCustomizationSchema = z
  .object({
    height: z.number().finite().min(0.1).max(10).optional(),

    build: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    headScale: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    shoulderWidth: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    torsoProportion: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    armLength: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    legLength: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    handSize: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    footSize: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    neckWidth: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),
  })
  .strict();

export type CharacterBodyCustomization = z.infer<
  typeof CharacterBodyCustomizationSchema
>;

/* -------------------------------------------------------------------------- */
/* Face Customization                                                         */
/* -------------------------------------------------------------------------- */

export const CharacterFaceCustomizationSchema = z
  .object({
    shape: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    jawWidth: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    jawHeight: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    cheekFullness: NormalizedUnit.optional(),

    chinSize: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    foreheadHeight: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    noseSize: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    noseWidth: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    earSize: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    mouthWidth: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    lipFullness: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),
  })
  .strict();

export type CharacterFaceCustomization = z.infer<
  typeof CharacterFaceCustomizationSchema
>;

/* -------------------------------------------------------------------------- */
/* Eye Customization                                                          */
/* -------------------------------------------------------------------------- */

export const CharacterEyeCustomizationSchema = z
  .object({
    color: HexColor.optional(),

    size: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    width: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    height: z
      .number()
      .finite()
      .min(0.1)
      .max(5)
      .optional(),

    spacing: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    rotation: z
      .number()
      .finite()
      .min(-180)
      .max(180)
      .optional(),

    shape: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    pupilSize: z
      .number()
      .finite()
      .min(0.05)
      .max(5)
      .optional(),

    irisSize: z
      .number()
      .finite()
      .min(0.05)
      .max(5)
      .optional(),

    eyebrowThickness: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    eyebrowShape: z
      .string()
      .min(1)
      .max(64)
      .optional(),
  })
  .strict();

export type CharacterEyeCustomization = z.infer<
  typeof CharacterEyeCustomizationSchema
>;

/* -------------------------------------------------------------------------- */
/* Hair Customization                                                         */
/* -------------------------------------------------------------------------- */

export const CharacterHairCustomizationSchema = z
  .object({
    style: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    length: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    texture: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    primaryColor: HexColor.optional(),

    secondaryColor: HexColor.optional(),

    highlightColor: HexColor.optional(),

    density: NormalizedUnit.optional(),

    volume: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .optional(),

    hairline: NormalizedUnit.optional(),

    facialHair: z
      .string()
      .min(1)
      .max(64)
      .optional(),
  })
  .strict();

export type CharacterHairCustomization = z.infer<
  typeof CharacterHairCustomizationSchema
>;

/* -------------------------------------------------------------------------- */
/* Skin Customization                                                         */
/* -------------------------------------------------------------------------- */

export const CharacterSkinMarkSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    intensity: NormalizedUnit,
  })
  .strict();

export type CharacterSkinMark = z.infer<
  typeof CharacterSkinMarkSchema
>;

export const CharacterSkinCustomizationSchema = z
  .object({
    baseColor: HexColor.optional(),

    tone: z
      .number()
      .finite()
      .min(-1)
      .max(1)
      .optional(),

    saturation: z
      .number()
      .finite()
      .min(-1)
      .max(1)
      .optional(),

    brightness: z
      .number()
      .finite()
      .min(-1)
      .max(1)
      .optional(),

    freckles: NormalizedUnit.optional(),

    facialMarks: z
      .array(CharacterSkinMarkSchema)
      .optional(),

    ageMarks: NormalizedUnit.optional(),
  })
  .strict();

export type CharacterSkinCustomization = z.infer<
  typeof CharacterSkinCustomizationSchema
>;

/* -------------------------------------------------------------------------- */
/* Outfit                                                                     */
/* -------------------------------------------------------------------------- */

export const CharacterOutfitSlotSchema = z.enum([
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
  "headwear",
  "eyewear",
  "gloves",
  "socks",
]);

export type CharacterOutfitSlot = z.infer<
  typeof CharacterOutfitSlotSchema
>;

export const CharacterOutfitItemSchema = z
  .object({
    assetId: z.string().uuid(),

    revision: z
      .number()
      .int()
      .nonnegative()
      .optional(),

    contentHash: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/,
        "contentHash must be a SHA-256 hexadecimal hash",
      )
      .optional(),

    enabled: z
      .boolean()
      .default(true),

    parameters: z
      .record(z.string(), z.unknown())
      .default({}),
  })
  .strict();

export type CharacterOutfitItem = z.infer<
  typeof CharacterOutfitItemSchema
>;

export const CharacterOutfitSchema = z
  .object({
    top: CharacterOutfitItemSchema.optional(),
    bottom: CharacterOutfitItemSchema.optional(),
    shoes: CharacterOutfitItemSchema.optional(),
    outerwear: CharacterOutfitItemSchema.optional(),
    accessory: CharacterOutfitItemSchema.optional(),
    headwear: CharacterOutfitItemSchema.optional(),
    eyewear: CharacterOutfitItemSchema.optional(),
    gloves: CharacterOutfitItemSchema.optional(),
    socks: CharacterOutfitItemSchema.optional(),
  })
  .strict();

export type CharacterOutfit = z.infer<
  typeof CharacterOutfitSchema
>;

/* -------------------------------------------------------------------------- */
/* Makeup                                                                     */
/* -------------------------------------------------------------------------- */

export const CharacterMakeupEffectSchema = z
  .object({
    color: HexColor,
    intensity: NormalizedUnit,
  })
  .strict();

export type CharacterMakeupEffect = z.infer<
  typeof CharacterMakeupEffectSchema
>;

export const CharacterMakeupSchema = z
  .object({
    foundation: HexColor.optional(),

    blush: CharacterMakeupEffectSchema.optional(),

    lipstick: CharacterMakeupEffectSchema.optional(),

    eyeshadow: CharacterMakeupEffectSchema.optional(),

    eyeliner: CharacterMakeupEffectSchema.optional(),

    mascara: CharacterMakeupEffectSchema.optional(),

    eyebrowMakeup: CharacterMakeupEffectSchema.optional(),

    highlight: CharacterMakeupEffectSchema.optional(),

    contour: CharacterMakeupEffectSchema.optional(),
  })
  .strict();

export type CharacterMakeup = z.infer<
  typeof CharacterMakeupSchema
>;

/* -------------------------------------------------------------------------- */
/* Expression                                                                 */
/* -------------------------------------------------------------------------- */

export const CharacterExpressionNameSchema = z.enum([
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "fearful",
  "disgusted",
]);

export type CharacterExpressionName = z.infer<
  typeof CharacterExpressionNameSchema
>;

export const CharacterExpressionSchema = z
  .object({
    name: CharacterExpressionNameSchema,

    intensity: NormalizedUnit.default(1),

    controls: z
      .record(
        z.string().min(1),
        z.number().finite().min(-1).max(1),
      )
      .default({}),
  })
  .strict();

export type CharacterExpression = z.infer<
  typeof CharacterExpressionSchema
>;

/* -------------------------------------------------------------------------- */
/* Complete Customization State                                               */
/* -------------------------------------------------------------------------- */

export const CharacterCustomizationSchema = z
  .object({
    schemaVersion: z
      .string()
      .default(CHARACTER_CUSTOMIZATION_SCHEMA_VERSION),

    body: CharacterBodyCustomizationSchema.default({}),

    face: CharacterFaceCustomizationSchema.default({}),

    eyes: CharacterEyeCustomizationSchema.default({}),

    hair: CharacterHairCustomizationSchema.default({}),

    skin: CharacterSkinCustomizationSchema.default({}),

    outfit: CharacterOutfitSchema.default({}),

    makeup: CharacterMakeupSchema.default({}),

    expression: CharacterExpressionSchema.default({
      name: "neutral",
      intensity: 1,
      controls: {},
    }),
  })
  .strict();

export type CharacterCustomization = z.infer<
  typeof CharacterCustomizationSchema
>;

/* -------------------------------------------------------------------------- */
/* Deep Patch Schemas                                                         */
/*                                                                            */
/* IMPORTANT:                                                                 */
/* `Partial<CharacterCustomization>` is NOT sufficient here.                 */
/* It only makes top-level properties optional.                               */
/*                                                                            */
/* These schemas allow partial nested updates such as:                       */
/*                                                                            */
/* expression: { controls: { smile: 0.8 } }                                  */
/* hair: { primaryColor: "#000000" }                                         */
/* body: { height: 1.8 }                                                      */
/* outfit: { top: { enabled: false } }                                      */
/*                                                                            */
/* The final merged result is still validated against the canonical          */
/* CharacterCustomizationSchema.                                             */
/* -------------------------------------------------------------------------- */

export const CharacterBodyCustomizationPatchSchema =
  CharacterBodyCustomizationSchema.partial();

export const CharacterFaceCustomizationPatchSchema =
  CharacterFaceCustomizationSchema.partial();

export const CharacterEyeCustomizationPatchSchema =
  CharacterEyeCustomizationSchema.partial();

export const CharacterHairCustomizationPatchSchema =
  CharacterHairCustomizationSchema.partial();

export const CharacterSkinCustomizationPatchSchema =
  CharacterSkinCustomizationSchema.partial();

/*
 * Outfit item patch:
 * all fields are optional because an existing outfit item may be modified
 * without replacing its assetId.
 */
export const CharacterOutfitItemPatchSchema = z
  .object({
    assetId: z.string().uuid().optional(),

    revision: z
      .number()
      .int()
      .nonnegative()
      .optional(),

    contentHash: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/,
        "contentHash must be a SHA-256 hexadecimal hash",
      )
      .optional(),

    enabled: z.boolean().optional(),

    parameters: z
      .record(z.string(), z.unknown())
      .optional(),
  })
  .strict();

export const CharacterOutfitPatchSchema = z
  .object({
    top: CharacterOutfitItemPatchSchema.optional(),
    bottom: CharacterOutfitItemPatchSchema.optional(),
    shoes: CharacterOutfitItemPatchSchema.optional(),
    outerwear: CharacterOutfitItemPatchSchema.optional(),
    accessory: CharacterOutfitItemPatchSchema.optional(),
    headwear: CharacterOutfitItemPatchSchema.optional(),
    eyewear: CharacterOutfitItemPatchSchema.optional(),
    gloves: CharacterOutfitItemPatchSchema.optional(),
    socks: CharacterOutfitItemPatchSchema.optional(),
  })
  .strict();

export const CharacterMakeupEffectPatchSchema = z
  .object({
    color: HexColor.optional(),
    intensity: NormalizedUnit.optional(),
  })
  .strict();

export const CharacterMakeupPatchSchema = z
  .object({
    foundation: HexColor.optional(),

    blush: CharacterMakeupEffectPatchSchema.optional(),

    lipstick: CharacterMakeupEffectPatchSchema.optional(),

    eyeshadow: CharacterMakeupEffectPatchSchema.optional(),

    eyeliner: CharacterMakeupEffectPatchSchema.optional(),

    mascara: CharacterMakeupEffectPatchSchema.optional(),

    eyebrowMakeup: CharacterMakeupEffectPatchSchema.optional(),

    highlight: CharacterMakeupEffectPatchSchema.optional(),

    contour: CharacterMakeupEffectPatchSchema.optional(),
  })
  .strict();

export const CharacterExpressionPatchSchema = z
  .object({
    name: CharacterExpressionNameSchema.optional(),

    intensity: NormalizedUnit.optional(),

    controls: z
      .record(
        z.string().min(1),
        z.number().finite().min(-1).max(1),
      )
      .optional(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Complete Customization Patch                                               */
/* -------------------------------------------------------------------------- */

export const CharacterCustomizationPatchSchema = z
  .object({
    schemaVersion: z.string().optional(),

    body: CharacterBodyCustomizationPatchSchema.optional(),

    face: CharacterFaceCustomizationPatchSchema.optional(),

    eyes: CharacterEyeCustomizationPatchSchema.optional(),

    hair: CharacterHairCustomizationPatchSchema.optional(),

    skin: CharacterSkinCustomizationPatchSchema.optional(),

    outfit: CharacterOutfitPatchSchema.optional(),

    makeup: CharacterMakeupPatchSchema.optional(),

    expression: CharacterExpressionPatchSchema.optional(),
  })
  .strict();

export type CharacterCustomizationPatch = z.infer<
  typeof CharacterCustomizationPatchSchema
>;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export function validateCharacterCustomization(
  value: unknown,
): CharacterCustomization {
  return CharacterCustomizationSchema.parse(
    structuredClone(value),
  );
}

/* -------------------------------------------------------------------------- */
/* Clone                                                                      */
/* -------------------------------------------------------------------------- */

export function cloneCharacterCustomization(
  value: CharacterCustomization,
): CharacterCustomization {
  return structuredClone(
    CharacterCustomizationSchema.parse(value),
  );
}

/* -------------------------------------------------------------------------- */
/* Deep Object Helpers                                                        */
/* -------------------------------------------------------------------------- */

function mergeOutfitItem(
  current: CharacterOutfitItem | undefined,
  patch: z.infer<typeof CharacterOutfitItemPatchSchema>,
): CharacterOutfitItem {
  const merged = {
    ...(current ?? {}),
    ...patch,

    parameters: {
      ...(current?.parameters ?? {}),
      ...(patch.parameters ?? {}),
    },
  };

  return CharacterOutfitItemSchema.parse(merged);
}

/* -------------------------------------------------------------------------- */
/* Character Customization Merge                                              */
/* -------------------------------------------------------------------------- */

/**
 * Merge customization state without mutating the source.
 *
 * This is a TRUE nested/deep patch operation.
 *
 * Examples:
 *
 * {
 *   expression: {
 *     controls: {
 *       smile: 0.8
 *     }
 *   }
 * }
 *
 * preserves:
 *
 * expression.name
 * expression.intensity
 * existing expression.controls
 *
 * The same principle applies to body, face, eyes, hair,
 * skin, outfit and makeup.
 */
export function mergeCharacterCustomization(
  base: CharacterCustomization,
  patch: CharacterCustomizationPatch,
): CharacterCustomization {
  const current = CharacterCustomizationSchema.parse(
    structuredClone(base),
  );

  const validatedPatch = CharacterCustomizationPatchSchema.parse(
    structuredClone(patch),
  );

  /*
   * IMPORTANT:
   * Do not type this intermediate object as CharacterCustomization.
   *
   * A patch is intentionally partial. TypeScript would therefore reject
   * valid intermediate states such as:
   *
   *   makeup: { blush: { intensity: 0.8 } }
   *
   * because CharacterMakeupEffect requires both color and intensity.
   *
   * The intermediate object is constructed by merging against the already
   * validated canonical `current` state. The complete result is validated
   * by CharacterCustomizationSchema at the end of this function.
   */
  const result = {
    schemaVersion:
      validatedPatch.schemaVersion ??
      current.schemaVersion,

    body: {
      ...current.body,
      ...(validatedPatch.body ?? {}),
    },

    face: {
      ...current.face,
      ...(validatedPatch.face ?? {}),
    },

    eyes: {
      ...current.eyes,
      ...(validatedPatch.eyes ?? {}),
    },

    hair: {
      ...current.hair,
      ...(validatedPatch.hair ?? {}),
    },

    skin: {
      ...current.skin,
      ...(validatedPatch.skin ?? {}),
    },

    outfit: {
      ...current.outfit,
    },

    makeup: {
      ...current.makeup,
    },

    expression: {
      ...current.expression,
      ...(validatedPatch.expression ?? {}),
      controls: {
        ...current.expression.controls,
        ...(validatedPatch.expression?.controls ?? {}),
      },
    },
  };

  /* ------------------------------------------------------------------------ */
  /* Outfit deep merge                                                        */
  /* ------------------------------------------------------------------------ */

  if (validatedPatch.outfit) {
    const outfitPatch = validatedPatch.outfit;

    const outfitSlots: CharacterOutfitSlot[] = [
      "top",
      "bottom",
      "shoes",
      "outerwear",
      "accessory",
      "headwear",
      "eyewear",
      "gloves",
      "socks",
    ];

    for (const slot of outfitSlots) {
      const slotPatch = outfitPatch[slot];

      if (slotPatch !== undefined) {
        const currentItem = current.outfit[slot];

        /*
         * Object.assign avoids assigning a partial patch object to a
         * statically complete CharacterOutfitItem property. The helper
         * returns a fully validated CharacterOutfitItem.
         */
        Object.assign(
          result.outfit,
          {
            [slot]: mergeOutfitItem(
              currentItem,
              slotPatch,
            ),
          },
        );
      }
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Makeup deep merge                                                        */
  /* ------------------------------------------------------------------------ */

  if (validatedPatch.makeup) {
    const makeupPatch = validatedPatch.makeup;

    const makeupEffects = [
      "blush",
      "lipstick",
      "eyeshadow",
      "eyeliner",
      "mascara",
      "eyebrowMakeup",
      "highlight",
      "contour",
    ] as const;

    /*
     * First preserve all existing top-level makeup properties, including
     * foundation.
     */
    Object.assign(result.makeup, makeupPatch);

    /*
     * Then deep-merge every effect. If an existing effect is present,
     * a partial patch such as { intensity: 0.8 } preserves its color.
     *
     * If no existing effect exists, the final canonical schema validation
     * intentionally rejects an incomplete effect because color is required.
     */
    for (const effect of makeupEffects) {
      const effectPatch = makeupPatch[effect];

      if (effectPatch !== undefined) {
        const currentEffect = current.makeup[effect];

        if (currentEffect !== undefined) {
          Object.assign(result.makeup, {
            [effect]: {
              ...currentEffect,
              ...effectPatch,
            },
          });
        } else {
          /*
           * No existing effect means the patch must already contain all
           * required canonical fields. Parse it here so the error is
           * deterministic and type-safe.
           */
          const completeEffect =
            CharacterMakeupEffectSchema.parse(effectPatch);

          Object.assign(result.makeup, {
            [effect]: completeEffect,
          });
        }
      }
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Final canonical validation                                               */
  /* ------------------------------------------------------------------------ */

  return CharacterCustomizationSchema.parse(
    structuredClone(result),
  );
}


/* -------------------------------------------------------------------------- */
/* Default Customization                                                       */
/* -------------------------------------------------------------------------- */

export function defaultCharacterCustomization(): CharacterCustomization {
  return CharacterCustomizationSchema.parse({});
}