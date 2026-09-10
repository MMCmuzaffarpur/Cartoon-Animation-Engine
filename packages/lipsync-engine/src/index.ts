import { createHash } from "node:crypto";
import { z } from "zod";

import {
  LipSyncTrack as LipSyncTrackSchema,
} from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export type Interpolation =
  | "step"
  | "linear"
  | "smooth";

export interface PhonemeEvent {
  startTick: number;
  endTick: number;
  phoneme: string;
  confidence: number;
}

export interface VisemeEvent {
  startTick: number;
  endTick: number;
  viseme: string;
  weight: number;
}

export interface ManualOverride {
  startTick: number;
  endTick: number;
  viseme?: string;
  weight?: number;
  controls?: Record<string, number>;
}

export interface LipSyncCurve {
  startTick: number;
  endTick: number;
  targetPath: string;
  startValue: number;
  endValue: number;
  interpolation: Interpolation;
}

export type LipSyncTrack =
  z.infer<typeof LipSyncTrackSchema>;

export interface LipSyncValidationResult {
  valid: boolean;
  errors: string[];
}

export interface VisemeSample {
  viseme: string;
  weight: number;
}

export interface LipSyncControls {
  controls: Record<string, number>;
}

export interface VisemeDefinition {
  id: string;
  controls: Record<string, number>;
}

/**
 * Adapter contract for future local speech analyzers.
 *
 * The core engine does not require an AI model, internet,
 * cloud API, or proprietary service.
 */
export interface LipSyncAnalyzer {
  readonly id: string;
  readonly version: string;

  analyze(input: {
    audioAssetId?: string | null;
    language: string;
  }): Promise<PhonemeEvent[]>;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const LIP_SYNC_VERSION = "1.0.0";
export const ALIGNMENT_VERSION = "1.0.0";

export const DEFAULT_COARTICULATION_TICKS =
  1_000;

export const DEFAULT_COARTICULATION_STRENGTH =
  0.65;

/* -------------------------------------------------------------------------- */
/* Phoneme → Viseme Mapping                                                   */
/* -------------------------------------------------------------------------- */

export const PHONEME_TO_VISEME: Record<
  string,
  string
> = {
  /* Vowels */

  A: "AI",
  AA: "AI",
  AE: "AI",
  AH: "AI",
  AY: "AI",

  E: "E",
  EE: "E",
  EH: "E",
  EY: "E",
  I: "E",
  IH: "E",

  O: "O",
  AO: "O",
  OW: "O",
  OY: "O",

  U: "U",
  UH: "U",
  UW: "U",
  OO: "U",

  /* Bilabial */

  B: "MBP",
  M: "MBP",
  P: "MBP",

  /* Labiodental */

  F: "FV",
  V: "FV",

  /* Dental / alveolar */

  D: "DNTL",
  T: "DNTL",
  N: "DNTL",
  L: "DNTL",

  TH: "TH",
  DH: "TH",

  /* Sibilants */

  S: "SZ",
  Z: "SZ",

  /* Postalveolar */

  SH: "SH",
  ZH: "SH",
  CH: "SH",
  JH: "SH",
  J: "SH",

  /* Velar */

  K: "KG",
  G: "KG",
  NG: "KG",
  Q: "KG",
  X: "KG",

  /* Approximants */

  R: "R",
  W: "U",
  Y: "E",

  /* Glottal */

  HH: "REST",

  /* Silence */

  SIL: "REST",
  SP: "REST",
  SILENCE: "REST",
  PAUSE: "REST",
  REST: "REST",
};

/* -------------------------------------------------------------------------- */
/* Viseme → Facial Controls                                                   */
/* -------------------------------------------------------------------------- */

export const VISEME_TO_CONTROLS: Record<
  string,
  Record<string, number>
> = {
  REST: {
    mouthOpen: 0,
    jawOpen: 0,
    mouthWide: 0,
    mouthNarrow: 0,
    lipPucker: 0,
  },

  AI: {
    mouthOpen: 0.55,
    jawOpen: 0.35,
    mouthWide: 0.65,
    mouthNarrow: 0,
    lipPucker: 0,
  },

  E: {
    mouthOpen: 0.4,
    jawOpen: 0.2,
    mouthWide: 0.75,
    mouthNarrow: 0,
    lipPucker: 0,
  },

  O: {
    mouthOpen: 0.5,
    jawOpen: 0.3,
    mouthWide: 0,
    mouthNarrow: 0.65,
    lipPucker: 0.7,
  },

  U: {
    mouthOpen: 0.3,
    jawOpen: 0.15,
    mouthWide: 0,
    mouthNarrow: 0.75,
    lipPucker: 0.9,
  },

  MBP: {
    mouthOpen: 0,
    jawOpen: 0,
    mouthWide: 0,
    mouthNarrow: 0.15,
    lipPucker: 0.1,
  },

  FV: {
    mouthOpen: 0.15,
    jawOpen: 0.05,
    mouthWide: 0.25,
    mouthNarrow: 0,
    lipPucker: 0,
    lowerLipDepress: 0.45,
  },

  DNTL: {
    mouthOpen: 0.2,
    jawOpen: 0.08,
    mouthWide: 0.2,
    mouthNarrow: 0,
    lipPucker: 0,
  },

  SZ: {
    mouthOpen: 0.12,
    jawOpen: 0.05,
    mouthWide: 0.3,
    mouthNarrow: 0,
    lipPucker: 0,
  },

  SH: {
    mouthOpen: 0.18,
    jawOpen: 0.08,
    mouthWide: 0,
    mouthNarrow: 0.35,
    lipPucker: 0.25,
  },

  KG: {
    mouthOpen: 0.25,
    jawOpen: 0.15,
    mouthWide: 0,
    mouthNarrow: 0,
    lipPucker: 0,
  },

  R: {
    mouthOpen: 0.18,
    jawOpen: 0.08,
    mouthWide: 0,
    mouthNarrow: 0.25,
    lipPucker: 0.05,
  },

  TH: {
    mouthOpen: 0.18,
    jawOpen: 0.08,
    mouthWide: 0.15,
    mouthNarrow: 0,
    lipPucker: 0,
  },
};

export const VISEME_DEFINITIONS: VisemeDefinition[] =
  Object.entries(
    VISEME_TO_CONTROLS,
  ).map(
    ([id, controls]) => ({
      id,
      controls: structuredClone(
        controls,
      ),
    }),
  );

/* -------------------------------------------------------------------------- */
/* Utility                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function lerp(
  a: number,
  b: number,
  t: number,
): number {
  return (
    a +
    (b - a) *
      clamp(t, 0, 1)
  );
}

function smoothstep(
  t: number,
): number {
  const x =
    clamp(
      t,
      0,
      1,
    );

  return (
    x *
    x *
    (3 - 2 * x)
  );
}

function canonicalize(
  value: unknown,
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(
      value,
    );
  }

  if (
    Array.isArray(value)
  ) {
    return `[${value
      .map(canonicalize)
      .join(",")}]`;
  }

  const object =
    value as Record<
      string,
      unknown
    >;

  return `{${Object.keys(
    object,
  )
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(
          key,
        )}:${canonicalize(
          object[key],
        )}`,
    )
    .join(",")}}`;
}

function deterministicUuid(
  input: string,
): string {
  const digest =
    createHash("sha256")
      .update(input)
      .digest("hex");

  const bytes =
    digest.slice(
      0,
      32,
    );

  return (
    `${bytes.slice(
      0,
      8,
    )}-` +
    `${bytes.slice(
      8,
      12,
    )}-` +
    `5${bytes.slice(
      13,
      16,
    )}-` +
    `${(
      (parseInt(
        bytes.slice(
          16,
          18,
        ),
        16,
      ) &
        0x3f) |
      0x80
    )
      .toString(16)
      .padStart(
        2,
        "0",
      )}` +
    `${bytes.slice(
      18,
      20,
    )}-` +
    `${bytes.slice(
      20,
      32,
    )}`
  );
}

function normalizeLanguage(
  language: string,
): string {
  const value =
    language
      .trim()
      .toLowerCase();

  if (!value) {
    return "en-IN";
  }

  if (
    value === "hi" ||
    value === "hin" ||
    value === "hindi"
  ) {
    return "hi-IN";
  }

  if (
    value === "en" ||
    value === "eng" ||
    value === "english"
  ) {
    return "en-IN";
  }

  if (
    value === "hinglish" ||
    value === "hi-en" ||
    value === "hi_en"
  ) {
    return "hi-en";
  }

  return language.trim();
}

/* -------------------------------------------------------------------------- */
/* Phoneme Normalization                                                      */
/* -------------------------------------------------------------------------- */

export function normalizePhoneme(
  phoneme: string,
): string {
  const normalized =
    phoneme
      .trim()
      .toUpperCase()
      .replace(
        /[0-9]+$/g,
        "",
      );

  if (!normalized) {
    return "SIL";
  }

  if (
    normalized ===
      "SILENCE" ||
    normalized ===
      "PAUSE" ||
    normalized === "SP"
  ) {
    return "SIL";
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Event Validation                                                           */
/* -------------------------------------------------------------------------- */

function validatePhonemeEvent(
  event: PhonemeEvent,
  index: number,
): string[] {
  const errors: string[] =
    [];

  if (
    !Number.isInteger(
      event.startTick,
    )
  ) {
    errors.push(
      `phonemes[${index}].startTick must be an integer.`,
    );
  }

  if (
    !Number.isInteger(
      event.endTick,
    )
  ) {
    errors.push(
      `phonemes[${index}].endTick must be an integer.`,
    );
  }

  if (
    event.startTick < 0
  ) {
    errors.push(
      `phonemes[${index}].startTick must not be negative.`,
    );
  }

  if (
    event.endTick <=
    event.startTick
  ) {
    errors.push(
      `phonemes[${index}] must have endTick greater than startTick.`,
    );
  }

  if (
    !Number.isFinite(
      event.confidence,
    )
  ) {
    errors.push(
      `phonemes[${index}].confidence must be finite.`,
    );
  }

  if (
    event.confidence < 0 ||
    event.confidence > 1
  ) {
    errors.push(
      `phonemes[${index}].confidence must be between 0 and 1.`,
    );
  }

  if (
    typeof event.phoneme !==
      "string" ||
    event.phoneme.trim()
      .length === 0
  ) {
    errors.push(
      `phonemes[${index}].phoneme must not be empty.`,
    );
  }

  return errors;
}

function validateVisemeEvent(
  event: VisemeEvent,
  index: number,
): string[] {
  const errors: string[] =
    [];

  if (
    !Number.isInteger(
      event.startTick,
    ) ||
    event.startTick < 0
  ) {
    errors.push(
      `visemes[${index}].startTick is invalid.`,
    );
  }

  if (
    !Number.isInteger(
      event.endTick,
    ) ||
    event.endTick <=
      event.startTick
  ) {
    errors.push(
      `visemes[${index}].endTick is invalid.`,
    );
  }

  if (
    !Number.isFinite(
      event.weight,
    ) ||
    event.weight < 0 ||
    event.weight > 1
  ) {
    errors.push(
      `visemes[${index}].weight is invalid.`,
    );
  }

  if (
    typeof event.viseme !==
      "string" ||
    event.viseme.trim()
      .length === 0
  ) {
    errors.push(
      `visemes[${index}].viseme must not be empty.`,
    );
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* LipSync Engine                                                             */
/* -------------------------------------------------------------------------- */

export class LipSyncEngine {
  readonly version =
    LIP_SYNC_VERSION;

  /* ------------------------------------------------------------------------ */
  /* Analyzer Adapter                                                         */
  /* ------------------------------------------------------------------------ */

  async analyze(
    analyzer: LipSyncAnalyzer,
    input: {
      audioAssetId?: string | null;
      language?: string;
    },
    options: {
      deterministicKey?: string;
      manualOverrides?: ManualOverride[];
      provenance?: Record<
        string,
        unknown
      >;
      coarticulationTicks?: number;
      coarticulationStrength?: number;
    } = {},
  ): Promise<LipSyncTrack> {
    if (
      !analyzer ||
      typeof analyzer.analyze !==
        "function"
    ) {
      throw new Error(
        "A valid lip-sync analyzer is required.",
      );
    }

    const language =
      normalizeLanguage(
        input.language ??
          "en-IN",
      );

    const phonemes =
      await analyzer.analyze({
        audioAssetId:
          input.audioAssetId ??
          null,
        language,
      });

    return this.createTrack(
      phonemes,
      {
        language,
        audioAssetId:
          input.audioAssetId ??
          null,
        analyzer:
          analyzer.id,
        version:
          analyzer.version,
        deterministicKey:
          options.deterministicKey,
        manualOverrides:
          options.manualOverrides,
        coarticulationTicks:
          options.coarticulationTicks,
        coarticulationStrength:
          options.coarticulationStrength,
        provenance: {
          ...(options.provenance ??
            {}),
          analyzerId:
            analyzer.id,
          analyzerVersion:
            analyzer.version,
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Normalize Phonemes                                                       */
  /* ------------------------------------------------------------------------ */

  normalizePhonemes(
    phonemes: PhonemeEvent[],
  ): PhonemeEvent[] {
    const normalized =
      phonemes.map(
        (phoneme) => ({
          startTick:
            phoneme.startTick,

          endTick:
            phoneme.endTick,

          phoneme:
            normalizePhoneme(
              phoneme.phoneme,
            ),

          confidence:
            clamp(
              Number.isFinite(
                phoneme.confidence,
              )
                ? phoneme.confidence
                : 1,
              0,
              1,
            ),
        }),
      );

    normalized.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.endTick -
          b.endTick ||
        a.phoneme.localeCompare(
          b.phoneme,
        ),
    );

    return structuredClone(
      normalized,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Phoneme → Viseme                                                         */
  /* ------------------------------------------------------------------------ */

  phonemeToViseme(
    phoneme: string,
  ): string {
    const normalized =
      normalizePhoneme(
        phoneme,
      );

    return (
      PHONEME_TO_VISEME[
        normalized
      ] ?? "REST"
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Phonemes → Visemes                                                       */
  /* ------------------------------------------------------------------------ */

  phonemesToVisemes(
    phonemes: PhonemeEvent[],
  ): VisemeEvent[] {
    const normalized =
      this.normalizePhonemes(
        phonemes,
      );

    return normalized.map(
      (phoneme) => ({
        startTick:
          phoneme.startTick,

        endTick:
          phoneme.endTick,

        viseme:
          this.phonemeToViseme(
            phoneme.phoneme,
          ),

        weight:
          clamp(
            phoneme.confidence,
            0,
            1,
          ),
      }),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Coarticulation                                                           */
  /* ------------------------------------------------------------------------ */

  applyCoarticulation(
    visemes: VisemeEvent[],
    blendTicks =
      DEFAULT_COARTICULATION_TICKS,
    strength =
      DEFAULT_COARTICULATION_STRENGTH,
  ): VisemeEvent[] {
    if (
      !Number.isInteger(
        blendTicks,
      ) ||
      blendTicks < 0
    ) {
      throw new Error(
        "blendTicks must be a non-negative integer.",
      );
    }

    if (
      !Number.isFinite(
        strength,
      ) ||
      strength < 0 ||
      strength > 1
    ) {
      throw new Error(
        "coarticulation strength must be between 0 and 1.",
      );
    }

    if (
      visemes.length < 2 ||
      blendTicks === 0 ||
      strength === 0
    ) {
      return structuredClone(
        visemes,
      );
    }

    const sorted =
      [...visemes].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.endTick -
            b.endTick ||
          a.viseme.localeCompare(
            b.viseme,
          ),
      );

    const result =
      sorted.map(
        (viseme) => ({
          ...viseme,
        }),
      );

    /*
     * Coarticulation here preserves the canonical event timing.
     * It adjusts confidence/weight around neighboring phonemes.
     *
     * Actual facial interpolation is performed by generateCurves()
     * and sampleCurve(), keeping the phoneme timeline unchanged.
     */

    for (
      let i = 0;
      i <
      result.length - 1;
      i += 1
    ) {
      const current =
        result[i];

      const next =
        result[i + 1];

      const distance =
        Math.max(
          0,
          next.startTick -
            current.endTick,
        );

      const overlap =
        Math.max(
          0,
          current.endTick -
            next.startTick,
        );

      if (
        overlap > 0
      ) {
        const total =
          current.weight +
          next.weight;

        if (
          total > 0
        ) {
          current.weight =
            current.weight /
            total;

          next.weight =
            next.weight /
            total;
        }

        continue;
      }

      if (
        distance >
        blendTicks
      ) {
        continue;
      }

      const proximity =
        clamp(
          1 -
            distance /
              blendTicks,
          0,
          1,
        );

      const influence =
        proximity *
        strength;

      current.weight =
        clamp(
          current.weight *
            (
              1 -
              influence *
                0.25
            ),
          0,
          1,
        );

      next.weight =
        clamp(
          next.weight *
            (
              1 -
              influence *
                0.25
            ),
          0,
          1,
        );
    }

    return structuredClone(
      result,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Controls                                                                  */
  /* ------------------------------------------------------------------------ */

  getControlMapping(
    viseme: string,
  ): Record<string, number> {
    return structuredClone(
      VISEME_TO_CONTROLS[
        viseme
      ] ??
        VISEME_TO_CONTROLS
          .REST,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Curve Generation                                                         */
  /* ------------------------------------------------------------------------ */

  generateCurves(
    visemes: VisemeEvent[],
    options: {
      interpolation?: Interpolation;
      targetPrefix?: string;
    } = {},
  ): LipSyncCurve[] {
    const interpolation =
      options.interpolation ??
      "smooth";

    const targetPrefix =
      options.targetPrefix ??
      "facial";

    const sorted =
      [...visemes].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.endTick -
            b.endTick,
      );

    const curves: LipSyncCurve[] =
      [];

    for (
      let index = 0;
      index <
      sorted.length;
      index += 1
    ) {
      const current =
        sorted[index];

      const previous =
        index > 0
          ? sorted[index - 1]
          : undefined;

      const next =
        index <
        sorted.length - 1
          ? sorted[index + 1]
          : undefined;

      const currentControls =
        this.getControlMapping(
          current.viseme,
        );

      const previousControls =
        previous
          ? this.getControlMapping(
              previous.viseme,
            )
          : this.getControlMapping(
              "REST",
            );

      const nextControls =
        next
          ? this.getControlMapping(
              next.viseme,
            )
          : this.getControlMapping(
              "REST",
            );

      const controls =
        new Set<string>([
          ...Object.keys(
            previousControls,
          ),
          ...Object.keys(
            currentControls,
          ),
          ...Object.keys(
            nextControls,
          ),
        ]);

      for (
        const control of controls
      ) {
        const previousValue =
          (
            previousControls[
              control
            ] ?? 0
          ) *
          (
            previous
              ?.weight ?? 0
          );

        const currentValue =
          (
            currentControls[
              control
            ] ?? 0
          ) *
          current.weight;

        const nextValue =
          (
            nextControls[
              control
            ] ?? 0
          ) *
          (
            next?.weight ?? 0
          );

        /*
         * Blend neighboring states instead of forcing every
         * viseme curve to start from zero.
         */

        const startValue =
          clamp(
            lerp(
              previousValue,
              currentValue,
              0.35,
            ),
            -1,
            1,
          );

        const endValue =
          clamp(
            lerp(
              currentValue,
              nextValue,
              0.35,
            ),
            -1,
            1,
          );

        curves.push({
          startTick:
            current.startTick,

          endTick:
            current.endTick,

          targetPath:
            `${targetPrefix}.${control}`,

          startValue,

          endValue,

          interpolation,
        });
      }
    }

    return curves;
  }

  /* ------------------------------------------------------------------------ */
  /* Alignment                                                                */
  /* ------------------------------------------------------------------------ */

  align(
    phonemes: PhonemeEvent[],
    language = "en-IN",
    options: {
      coarticulationTicks?: number;
      coarticulationStrength?: number;
    } = {},
  ): {
    language: string;
    phonemes: PhonemeEvent[];
    visemes: VisemeEvent[];
    curves: LipSyncCurve[];
  } {
    const normalizedPhonemes =
      this.normalizePhonemes(
        phonemes,
      );

    const visemes =
      this.phonemesToVisemes(
        normalizedPhonemes,
      );

    const smoothedVisemes =
      this.applyCoarticulation(
        visemes,
        options.coarticulationTicks ??
          DEFAULT_COARTICULATION_TICKS,
        options.coarticulationStrength ??
          DEFAULT_COARTICULATION_STRENGTH,
      );

    const curves =
      this.generateCurves(
        smoothedVisemes,
      );

    return {
      language:
        normalizeLanguage(
          language,
        ),

      phonemes:
        normalizedPhonemes,

      visemes:
        smoothedVisemes,

      curves,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Create Canonical LipSyncTrack                                            */
  /* ------------------------------------------------------------------------ */

  createTrack(
    phonemes: PhonemeEvent[],
    options: {
      language?: string;
      audioAssetId?: string | null;
      analyzer?: string;
      version?: string;
      alignmentVersion?: string;
      manualOverrides?: ManualOverride[];
      provenance?: Record<
        string,
        unknown
      >;
      deterministicKey?: string;
      coarticulationTicks?: number;
      coarticulationStrength?: number;
    } = {},
  ): LipSyncTrack {
    const language =
      normalizeLanguage(
        options.language ??
          "en-IN",
      );

    const alignment =
      this.align(
        phonemes,
        language,
        {
          coarticulationTicks:
            options.coarticulationTicks ??
            DEFAULT_COARTICULATION_TICKS,

          coarticulationStrength:
            options.coarticulationStrength ??
            DEFAULT_COARTICULATION_STRENGTH,
        },
      );

    const manualOverrides =
      (
        options.manualOverrides ??
        []
      ).map(
        (override) => {
          this.validateManualOverride(
            override,
          );

          return structuredClone(
            override,
          );
        },
      );

    const analyzer =
      options.analyzer ??
      "phoneme-events";

    const version =
      options.version ??
      LIP_SYNC_VERSION;

    const alignmentVersion =
      options.alignmentVersion ??
      ALIGNMENT_VERSION;

    const provenance = {
      deterministic: true,
      ...(options.provenance ??
        {}),
    };

    const source =
      canonicalize({
        language,

        audioAssetId:
          options.audioAssetId ??
          null,

        analyzer,

        version,

        alignmentVersion,

        phonemes:
          alignment.phonemes,

        visemes:
          alignment.visemes,

        curves:
          alignment.curves,

        manualOverrides,

        provenance,

        deterministicKey:
          options.deterministicKey ??
          null,
      });

    const track: LipSyncTrack = {
      id: deterministicUuid(
        `lipsync:${source}`,
      ),

      audioAssetId:
        options.audioAssetId ??
        null,

      language,

      analyzer,

      version,

      phonemes:
        alignment.phonemes,

      visemes:
        alignment.visemes,

      curves:
        alignment.curves.map(
          (curve) =>
            ({
              ...curve,
            }) as Record<
              string,
              unknown
            >,
        ),

      alignmentVersion,

      manualOverrides:
        manualOverrides.map(
          (override) =>
            ({
              ...override,
            }) as Record<
              string,
              unknown
            >,
        ),

      provenance,
    };

    return this.validate(
      track,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Phoneme Analysis                                                         */
  /* ------------------------------------------------------------------------ */

  analyzePhonemes(
    phonemes: PhonemeEvent[],
    language = "en-IN",
  ): LipSyncTrack {
    return this.createTrack(
      phonemes,
      {
        language,
        analyzer:
          "phoneme-events",
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Word Timing                                                               */
  /* ------------------------------------------------------------------------ */

  fromWordTiming(
    words: Array<{
      word: string;
      startTick: number;
      endTick: number;
    }>,
    language = "en-IN",
  ): LipSyncTrack {
    const phonemes: PhonemeEvent[] =
      [];

    for (
      const word of words
    ) {
      if (
        !Number.isInteger(
          word.startTick,
        ) ||
        !Number.isInteger(
          word.endTick,
        ) ||
        word.startTick < 0 ||
        word.endTick <=
          word.startTick
      ) {
        throw new Error(
          `Invalid word timing for "${word.word}".`,
        );
      }

      const text =
        word.word.trim();

      if (!text) {
        phonemes.push({
          startTick:
            word.startTick,

          endTick:
            word.endTick,

          phoneme: "SIL",

          confidence: 1,
        });

        continue;
      }

      /*
       * Preserve Devanagari characters for Hindi.
       * Latin transliteration remains supported.
       */

      const characters =
        [...text];

      const duration =
        word.endTick -
        word.startTick;

      if (
        duration <
        characters.length
      ) {
        throw new Error(
          `Word "${word.word}" does not have enough ticks for deterministic phoneme segmentation.`,
        );
      }

      const base =
        Math.floor(
          duration /
            characters.length,
        );

      let remainder =
        duration %
        characters.length;

      let cursor =
        word.startTick;

      for (
        const character of characters
      ) {
        const segment =
          base +
          (
            remainder > 0
              ? 1
              : 0
          );

        if (
          remainder > 0
        ) {
          remainder -= 1;
        }

        const start =
          cursor;

        const end =
          Math.min(
            word.endTick,
            start +
              segment,
          );

        cursor =
          end;

        phonemes.push({
          startTick:
            start,

          endTick:
            end,

          phoneme:
            this.graphemeToPhoneme(
              character,
              language,
            ),

          confidence: 0.55,
        });
      }
    }

    return this.createTrack(
      phonemes,
      {
        language,

        analyzer:
          "word-timing-grapheme-fallback",

        provenance: {
          deterministic: true,
          fallback: true,
          source:
            "word-timing",
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Grapheme → Phoneme                                                       */
  /* ------------------------------------------------------------------------ */

  graphemeToPhoneme(
    character: string,
    language = "en-IN",
  ): string {
    const value =
      character.trim();

    if (!value) {
      return "SIL";
    }

    const upper =
      value.toUpperCase();

    /* ---------------------------------------------------------------------- */
    /* Devanagari Hindi                                                       */
    /* ---------------------------------------------------------------------- */

    const hindi: Record<
      string,
      string
    > = {
      "अ": "AH",
      "आ": "AA",
      "इ": "IH",
      "ई": "EE",
      "उ": "UH",
      "ऊ": "UW",
      "ए": "EH",
      "ऐ": "AY",
      "ओ": "AO",
      "औ": "OW",

      "क": "K",
      "ख": "K",
      "ग": "G",
      "घ": "G",

      "च": "CH",
      "छ": "CH",
      "ज": "JH",
      "झ": "JH",

      "ट": "T",
      "ठ": "T",
      "ड": "D",
      "ढ": "D",
      "ण": "N",

      "त": "T",
      "थ": "TH",
      "द": "D",
      "ध": "DH",
      "न": "N",

      "प": "P",
      "फ": "F",
      "ब": "B",
      "भ": "B",
      "म": "M",

      "य": "Y",
      "र": "R",
      "ल": "L",
      "व": "W",

      "श": "SH",
      "ष": "SH",
      "स": "S",
      "ह": "HH",

      "ं": "N",
      "ँ": "N",
      "ः": "HH",

      "्": "SIL",
    };

    if (
      language
        .toLowerCase()
        .startsWith("hi") &&
      hindi[value]
    ) {
      return hindi[value];
    }

    /* ---------------------------------------------------------------------- */
    /* Latin fallback                                                         */
    /* ---------------------------------------------------------------------- */

    const common: Record<
      string,
      string
    > = {
      A: "AE",
      E: "EH",
      I: "IH",
      O: "AO",
      U: "UH",

      B: "B",
      C: "K",
      D: "D",
      F: "F",
      G: "G",
      H: "HH",
      J: "JH",
      K: "K",
      L: "L",
      M: "M",
      N: "N",
      P: "P",
      Q: "K",
      R: "R",
      S: "S",
      T: "T",
      V: "V",
      W: "W",
      X: "K",
      Y: "Y",
      Z: "Z",
    };

    if (
      language
        .toLowerCase()
        .startsWith("hi")
    ) {
      const hindiFriendly: Record<
        string,
        string
      > = {
        A: "AA",
        E: "EH",
        I: "IH",
        O: "AO",
        U: "UH",
      };

      return (
        hindiFriendly[
          upper
        ] ??
        common[upper] ??
        "SIL"
      );
    }

    return (
      common[upper] ??
      "SIL"
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Viseme Sampling                                                          */
  /* ------------------------------------------------------------------------ */

  visemeAt(
    track: LipSyncTrack,
    tick: number,
  ): VisemeSample {
    if (
      !Number.isInteger(
        tick,
      )
    ) {
      throw new Error(
        "Lip-sync tick must be an integer.",
      );
    }

    const overrides =
      this.activeOverrides(
        track,
        tick,
      );

    if (
      overrides.length > 0
    ) {
      const override =
        [...overrides].sort(
          (a, b) =>
            (b.weight ?? 1) -
            (a.weight ?? 1),
        )[0];

      if (
        override.viseme
      ) {
        return {
          viseme:
            this.resolveOverrideViseme(
              override.viseme,
            ),

          weight:
            clamp(
              override.weight ??
                1,
              0,
              1,
            ),
        };
      }
    }

    const active =
      track.visemes.filter(
        (viseme) =>
          tick >=
            viseme.startTick &&
          tick <
            viseme.endTick,
      );

    if (
      active.length === 0
    ) {
      return {
        viseme: "REST",
        weight: 0,
      };
    }

    const best =
      [...active].sort(
        (a, b) =>
          b.weight -
            a.weight ||
          (
            b.endTick -
            b.startTick
          ) -
            (
              a.endTick -
              a.startTick
            ),
      )[0];

    return {
      viseme:
        best.viseme,

      weight:
        clamp(
          best.weight,
          0,
          1,
        ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Facial Controls At Tick                                                  */
  /* ------------------------------------------------------------------------ */

  controlsAt(
    track: LipSyncTrack,
    tick: number,
  ): LipSyncControls {
    if (
      !Number.isInteger(
        tick,
      )
    ) {
      throw new Error(
        "Lip-sync tick must be an integer.",
      );
    }

    const output: Record<
      string,
      number
    > = {};

    const active =
      track.visemes.filter(
        (viseme) =>
          tick >=
            viseme.startTick &&
          tick <
            viseme.endTick,
      );

    for (
      const viseme of active
    ) {
      const controls =
        this.getControlMapping(
          viseme.viseme,
        );

      for (
        const [
          control,
          value,
        ] of Object.entries(
          controls,
        )
      ) {
        output[control] =
          (
            output[control] ??
            0
          ) +
          value *
            viseme.weight;
      }
    }

    /*
     * Manual overrides have the highest priority.
     */

    const overrides =
      this.activeOverrides(
        track,
        tick,
      );

    for (
      const override of overrides
    ) {
      const overrideWeight =
        clamp(
          override.weight ??
            1,
          0,
          1,
        );

      if (
        override.controls
      ) {
        for (
          const [
            control,
            value,
          ] of Object.entries(
            override.controls,
          )
        ) {
          output[control] =
            clamp(
              value *
                overrideWeight,
              -1,
              1,
            );
        }

        continue;
      }

      if (
        override.viseme
      ) {
        const viseme =
          this.resolveOverrideViseme(
            override.viseme,
          );

        const controls =
          this.getControlMapping(
            viseme,
          );

        for (
          const [
            control,
            value,
          ] of Object.entries(
            controls,
          )
        ) {
          output[control] =
            clamp(
              value *
                overrideWeight,
              -1,
              1,
            );
        }
      }
    }

    for (
      const key of Object.keys(
        output,
      )
    ) {
      output[key] =
        clamp(
          output[key],
          -1,
          1,
        );
    }

    return {
      controls:
        structuredClone(
          output,
        ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Manual Overrides                                                         */
  /* ------------------------------------------------------------------------ */

  private validateManualOverride(
    override: ManualOverride,
  ): void {
    if (
      !Number.isInteger(
        override.startTick,
      ) ||
      !Number.isInteger(
        override.endTick,
      ) ||
      override.startTick < 0 ||
      override.endTick <=
        override.startTick
    ) {
      throw new Error(
        "Invalid lip-sync manual override timing.",
      );
    }

    if (
      override.weight !==
        undefined &&
      (
        !Number.isFinite(
          override.weight,
        ) ||
        override.weight < 0 ||
        override.weight > 1
      )
    ) {
      throw new Error(
        "Manual override weight must be between 0 and 1.",
      );
    }

    if (
      override.viseme !==
        undefined &&
      override.viseme.trim()
        .length === 0
    ) {
      throw new Error(
        "Manual override viseme must not be empty.",
      );
    }

    if (
      override.controls
    ) {
      for (
        const [
          control,
          value,
        ] of Object.entries(
          override.controls,
        )
      ) {
        if (
          !Number.isFinite(
            value,
          )
        ) {
          throw new Error(
            `Manual override control "${control}" must be finite.`,
          );
        }
      }
    }
  }

  private activeOverrides(
    track: LipSyncTrack,
    tick: number,
  ): ManualOverride[] {
    return (
      (
        track.manualOverrides as
        unknown as ManualOverride[]
      ) ?? []
    ).filter(
      (override) =>
        tick >=
          override.startTick &&
        tick <
          override.endTick,
    );
  }

  private resolveOverrideViseme(
    value: string,
  ): string {
    const normalized =
      normalizePhoneme(
        value,
      );

    if (
      PHONEME_TO_VISEME[
        normalized
      ]
    ) {
      return this.phonemeToViseme(
        normalized,
      );
    }

    const upper =
      value
        .trim()
        .toUpperCase();

    return VISEME_TO_CONTROLS[
      upper
    ]
      ? upper
      : "REST";
  }

  applyManualOverrides(
    track: LipSyncTrack,
    overrides: ManualOverride[],
  ): LipSyncTrack {
    const validated =
      this.validate(
        track,
      );

    for (
      const override of overrides
    ) {
      this.validateManualOverride(
        override,
      );
    }

    const next =
      structuredClone(
        validated,
      );

    const existing =
      (
        next.manualOverrides as
        unknown as ManualOverride[]
      ) ?? [];

    const merged =
      [
        ...existing,
        ...overrides.map(
          (override) =>
            structuredClone(
              override,
            ),
        ),
      ];

    next.manualOverrides =
      merged as unknown as
        LipSyncTrack[
          "manualOverrides"
        ];

    return this.validate(
      next,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Curve Sampling                                                           */
  /* ------------------------------------------------------------------------ */

  sampleCurve(
    curve: LipSyncCurve,
    tick: number,
  ): number {
    if (
      !Number.isFinite(
        tick,
      )
    ) {
      throw new Error(
        "Lip-sync curve sample tick must be finite.",
      );
    }

    if (
      tick <=
      curve.startTick
    ) {
      return curve.startValue;
    }

    if (
      tick >=
      curve.endTick
    ) {
      return curve.endValue;
    }

    const span =
      curve.endTick -
      curve.startTick;

    if (
      span <= 0
    ) {
      return curve.endValue;
    }

    const t =
      (
        tick -
        curve.startTick
      ) /
      span;

    switch (
      curve.interpolation
    ) {
      case "step":
        return curve.startValue;

      case "smooth":
        return lerp(
          curve.startValue,
          curve.endValue,
          smoothstep(t),
        );

      case "linear":
      default:
        return lerp(
          curve.startValue,
          curve.endValue,
          t,
        );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Track Validation                                                         */
  /* ------------------------------------------------------------------------ */

  validate(
    track: LipSyncTrack,
  ): LipSyncTrack {
    const result =
      this.validateResult(
        track,
      );

    if (
      !result.valid
    ) {
      throw new Error(
        `Invalid lip-sync track: ${result.errors.join("; ")}`,
      );
    }

    return structuredClone(
      track,
    );
  }

  validateResult(
    track: LipSyncTrack,
  ): LipSyncValidationResult {
    const errors: string[] =
      [];

    const parsed =
      LipSyncTrackSchema.safeParse(
        track,
      );

    if (
      !parsed.success
    ) {
      errors.push(
        ...parsed.error.issues.map(
          (issue) =>
            `${issue.path.join(".")}: ${issue.message}`,
        ),
      );

      return {
        valid: false,
        errors,
      };
    }

    for (
      let i = 0;
      i <
      track.phonemes.length;
      i += 1
    ) {
      errors.push(
        ...validatePhonemeEvent(
          track.phonemes[i],
          i,
        ),
      );
    }

    for (
      let i = 0;
      i <
      track.visemes.length;
      i += 1
    ) {
      errors.push(
        ...validateVisemeEvent(
          track.visemes[i],
          i,
        ),
      );
    }

    for (
      let i = 0;
      i <
      track.manualOverrides
        .length;
      i += 1
    ) {
      try {
        this.validateManualOverride(
          track.manualOverrides[
            i
          ] as unknown as ManualOverride,
        );
      } catch (
        error
      ) {
        errors.push(
          `manualOverrides[${i}]: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
        );
      }
    }

    for (
      let i = 0;
      i <
      track.curves.length;
      i += 1
    ) {
      const curve =
        track.curves[
          i
        ] as unknown as LipSyncCurve;

      if (
        !Number.isInteger(
          curve.startTick,
        ) ||
        !Number.isInteger(
          curve.endTick,
        ) ||
        curve.startTick < 0 ||
        curve.endTick <=
          curve.startTick
      ) {
        errors.push(
          `curves[${i}] timing is invalid.`,
        );
      }

      if (
        typeof curve.targetPath !==
          "string" ||
        curve.targetPath.trim()
          .length === 0
      ) {
        errors.push(
          `curves[${i}].targetPath must not be empty.`,
        );
      }

      if (
        !Number.isFinite(
          curve.startValue,
        ) ||
        !Number.isFinite(
          curve.endValue,
        )
      ) {
        errors.push(
          `curves[${i}] values must be finite.`,
        );
      }

      if (
        ![
          "linear",
          "smooth",
          "step",
        ].includes(
          curve.interpolation,
        )
      ) {
        errors.push(
          `curves[${i}].interpolation is invalid.`,
        );
      }
    }

    /*
     * Canonical ordering checks.
     */

    for (
      let i = 0;
      i <
      track.phonemes.length -
        1;
      i += 1
    ) {
      if (
        track.phonemes[i]
          .startTick >
        track.phonemes[
          i + 1
        ].startTick
      ) {
        errors.push(
          "Phoneme events must be ordered by startTick.",
        );
      }
    }

    for (
      let i = 0;
      i <
      track.visemes.length -
        1;
      i += 1
    ) {
      if (
        track.visemes[i]
          .startTick >
        track.visemes[
          i + 1
        ].startTick
      ) {
        errors.push(
          "Viseme events must be ordered by startTick.",
        );
      }
    }

    return {
      valid:
        errors.length === 0,

      errors,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    track: LipSyncTrack,
  ): string {
    const validated =
      this.validate(
        track,
      );

    return createHash(
      "sha256",
    )
      .update(
        canonicalize(
          validated,
        ),
      )
      .digest("hex");
  }

  /* ------------------------------------------------------------------------ */
  /* Determinism                                                              */
  /* ------------------------------------------------------------------------ */

  isDeterministic(
    phonemes: PhonemeEvent[],
    language = "en-IN",
  ): boolean {
    const first =
      this.analyzePhonemes(
        phonemes,
        language,
      );

    const second =
      this.analyzePhonemes(
        phonemes,
        language,
      );

    return (
      this.fingerprint(
        first,
      ) ===
      this.fingerprint(
        second,
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Public Definitions                                                       */
  /* ------------------------------------------------------------------------ */

  getVisemeDefinitions(): VisemeDefinition[] {
    return structuredClone(
      VISEME_DEFINITIONS,
    );
  }

  getPhonemeMapping(
    phoneme: string,
  ): string {
    return this.phonemeToViseme(
      phoneme,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Canonical Types                                                            */
/* -------------------------------------------------------------------------- */

export type CanonicalLipSyncTrack =
  z.infer<
    typeof LipSyncTrackSchema
  >;