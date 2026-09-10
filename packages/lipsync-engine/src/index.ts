import { createHash } from "node:crypto";
import { z } from "zod";

import {
  LipSyncTrack as LipSyncTrackSchema,
} from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

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
  interpolation: "linear" | "smooth" | "step";
}

export type LipSyncTrack = z.infer<
  typeof LipSyncTrackSchema
>;

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

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const LIP_SYNC_VERSION = "1.0.0";
export const ALIGNMENT_VERSION = "1.0.0";

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
  EH: "E",
  EY: "E",
  I: "E",
  IH: "E",
  EE: "E",

  O: "O",
  AO: "O",
  OW: "O",

  U: "U",
  UH: "U",
  UW: "U",
  OO: "U",

  /* Bilabial */
  B: "MBP",
  P: "MBP",
  M: "MBP",

  /* Labiodental */
  F: "FV",
  V: "FV",

  /* Alveolar */
  D: "DNTL",
  T: "DNTL",
  N: "DNTL",
  L: "DNTL",

  /* Sibilants */
  S: "SZ",
  Z: "SZ",

  /* Postalveolar */
  SH: "SH",
  ZH: "SH",
  CH: "SH",
  JH: "SH",

  /* Velar */
  K: "KG",
  G: "KG",
  NG: "KG",

  /* Approximants */
  R: "R",
  W: "U",
  Y: "E",

  /* Glottal / dental */
  HH: "REST",
  TH: "TH",
  DH: "TH",

  /* Silence */
  SIL: "REST",
  SP: "REST",
  SILENCE: "REST",
  PAUSE: "REST",
  REST: "REST",
};

export const VISEME_TO_CONTROLS: Record<
  string,
  Record<string, number>
> = {
  REST: {
    mouthOpen: 0,
    jawOpen: 0,
  },

  AI: {
    mouthOpen: 0.55,
    jawOpen: 0.35,
    mouthWide: 0.65,
    mouthNarrow: 0,
  },

  E: {
    mouthOpen: 0.4,
    jawOpen: 0.2,
    mouthWide: 0.75,
    mouthNarrow: 0,
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
    lowerLipDepress: 0.45,
  },

  DNTL: {
    mouthOpen: 0.2,
    jawOpen: 0.08,
    mouthWide: 0.2,
  },

  SZ: {
    mouthOpen: 0.12,
    jawOpen: 0.05,
    mouthWide: 0.3,
  },

  SH: {
    mouthOpen: 0.18,
    jawOpen: 0.08,
    mouthNarrow: 0.35,
    lipPucker: 0.25,
  },

  KG: {
    mouthOpen: 0.25,
    jawOpen: 0.15,
  },

  R: {
    mouthOpen: 0.18,
    jawOpen: 0.08,
    mouthNarrow: 0.25,
  },

  TH: {
    mouthOpen: 0.18,
    jawOpen: 0.08,
    mouthWide: 0.15,
  },
};

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
    Math.max(min, value),
  );
}

function lerp(
  a: number,
  b: number,
  t: number,
): number {
  return a + (b - a) * t;
}

function smoothstep(
  t: number,
): number {
  const x = clamp(t, 0, 1);

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
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(canonicalize)
      .join(",")}]`;
  }

  const object =
    value as Record<string, unknown>;

  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalize(
          object[key],
        )}`,
    )
    .join(",")}}`;
}

function deterministicUuid(
  input: string,
): string {
  const digest = createHash("sha256")
    .update(input)
    .digest("hex");

  const bytes = digest.slice(0, 32);

  return (
    `${bytes.slice(0, 8)}-` +
    `${bytes.slice(8, 12)}-` +
    `5${bytes.slice(13, 16)}-` +
    `${(
      (parseInt(
        bytes.slice(16, 18),
        16,
      ) &
        0x3f) |
      0x80
    )
      .toString(16)
      .padStart(2, "0")}` +
    `${bytes.slice(18, 20)}-` +
    `${bytes.slice(20, 32)}`
  );
}

function normalizeLanguage(
  language: string,
): string {
  const value =
    language.trim().toLowerCase();

  if (!value) {
    return "en-IN";
  }

  if (
    value === "hi" ||
    value === "hin"
  ) {
    return "hi-IN";
  }

  if (
    value === "en" ||
    value === "eng"
  ) {
    return "en-IN";
  }

  if (
    value === "hinglish"
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
      .replace(/[0-9]+$/g, "");

  if (!normalized) {
    return "SIL";
  }

  if (
    normalized ===
    "SILENCE"
  ) {
    return "SIL";
  }

  if (
    normalized ===
    "PAUSE"
  ) {
    return "SIL";
  }

  if (
    normalized ===
    "SP"
  ) {
    return "SIL";
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Phoneme Validation                                                         */
/* -------------------------------------------------------------------------- */

function validatePhonemeEvent(
  event: PhonemeEvent,
  index: number,
): string[] {
  const errors: string[] = [];

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
    event.phoneme.trim()
      .length === 0
  ) {
    errors.push(
      `phonemes[${index}].phoneme must not be empty.`,
    );
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Lip Sync Engine                                                            */
/* -------------------------------------------------------------------------- */

export class LipSyncEngine {
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
              phoneme.confidence,
              0,
              1,
            ),
        }),
      );

    normalized.sort(
      (a, b) =>
        a.startTick -
        b.startTick,
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
  /* Generate Visemes                                                         */
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
    blendTicks = 1_000,
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
      blendTicks === 0 ||
      visemes.length < 2
    ) {
      return structuredClone(
        visemes,
      );
    }

    const sorted =
      [...visemes].sort(
        (a, b) =>
          a.startTick -
          b.startTick,
      );

    const result =
      sorted.map(
        (viseme) => ({
          ...viseme,
        }),
      );

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

      const gap =
        next.startTick -
        current.endTick;

      if (gap > blendTicks) {
        continue;
      }

      const overlap =
        Math.max(
          0,
          current.endTick -
            next.startTick,
        );

      if (overlap > 0) {
        const total =
          current.weight +
          next.weight;

        if (total > 0) {
          current.weight =
            current.weight /
            total;

          next.weight =
            next.weight /
            total;
        }
      }
    }

    return result;
  }

  /* ------------------------------------------------------------------------ */
  /* Curves                                                                    */
  /* ------------------------------------------------------------------------ */

  generateCurves(
    visemes: VisemeEvent[],
  ): LipSyncCurve[] {
    const curves: LipSyncCurve[] = [];

    for (const viseme of visemes) {
      const controls =
        VISEME_TO_CONTROLS[
          viseme.viseme
        ] ??
        VISEME_TO_CONTROLS.REST;

      for (const [
        targetPath,
        value,
      ] of Object.entries(
        controls,
      )) {
        curves.push({
          startTick:
            viseme.startTick,

          endTick:
            viseme.endTick,

          targetPath:

            `facial.${targetPath}`,

          startValue: 0,

          endValue:
            clamp(
              value *
                viseme.weight,
              -1,
              1,
            ),

          interpolation:
            "smooth",
        });
      }
    }

    return curves;
  }

  /* ------------------------------------------------------------------------ */
  /* Create Track                                                              */
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
    } = {},
  ): LipSyncTrack {
    const normalizedPhonemes =
      this.normalizePhonemes(
        phonemes,
      );

    const normalizedVisemes =
      this.phonemesToVisemes(
        normalizedPhonemes,
      );

    const smoothedVisemes =
      this.applyCoarticulation(
        normalizedVisemes,
        options.coarticulationTicks ??
          1_000,
      );

    const curves =
      this.generateCurves(
        smoothedVisemes,
      );

    const language =
      normalizeLanguage(
        options.language ??
          "en-IN",
      );

    const input = {
      language,
      phonemes:
        normalizedPhonemes,
      visemes:
        smoothedVisemes,
      analyzer:
        options.analyzer ??
        "phoneme-events",
      version:
        options.version ??
        LIP_SYNC_VERSION,
      alignmentVersion:
        options.alignmentVersion ??
        ALIGNMENT_VERSION,
      manualOverrides:
        options.manualOverrides ??
        [],
      provenance:
        options.provenance ??
        {
          deterministic: true,
        },
    };

    const deterministicSource =
      canonicalize({
        ...input,
        audioAssetId:
          options.audioAssetId ??
          null,
        deterministicKey:
          options.deterministicKey ??
          null,
      });

    const track: LipSyncTrack = {
      id: deterministicUuid(
        `lipsync:${deterministicSource}`,
      ),

      audioAssetId:
        options.audioAssetId ??
        null,

      language,

      analyzer:
        options.analyzer ??
        "phoneme-events",

      version:
        options.version ??
        LIP_SYNC_VERSION,

      phonemes:
        normalizedPhonemes,

      visemes:
        smoothedVisemes,

      curves:
  curves.map(
    (curve) =>
      ({ ...curve }) as Record<
        string,
        unknown
      >,
  ),

      alignmentVersion:
        options.alignmentVersion ??
        ALIGNMENT_VERSION,

      manualOverrides:
  (options.manualOverrides ?? []).map(
    (override) =>
      ({ ...override }) as Record<
        string,
        unknown
      >,
  ),

      provenance: {
        deterministic: true,
        ...(options.provenance ??
          {}),
      },
    };

    return this.validate(
      track,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Analyze Phonemes                                                         */
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
  /* Word Timing Fallback                                                      */
  /* ------------------------------------------------------------------------ */

  fromWordTiming(
    words: Array<{
      word: string;
      startTick: number;
      endTick: number;
    }>,
    language = "en-IN",
  ): LipSyncTrack {
    const phonemes: PhonemeEvent[] = [];

    for (const word of words) {
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
        word.word
          .trim()
          .toUpperCase()
          .replace(
            /[^A-Z]/g,
            "",
          );

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

      const duration =
        word.endTick -
        word.startTick;

      const letters =
        [...text];

      const segment =
        duration /
        letters.length;

      letters.forEach(
        (
          letter,
          index,
        ) => {
          const start =
            Math.round(
              word.startTick +
                segment *
                  index,
            );

          const end =
            Math.round(
              word.startTick +
                segment *
                  (index + 1),
            );

          phonemes.push({
            startTick:
              start,

            endTick:
              Math.max(
                start + 1,
                end,
              ),

            phoneme:
              this.graphemeToPhoneme(
                letter,
                language,
              ),

            confidence: 0.55,
          });
        },
      );
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
  /* Deterministic Grapheme Fallback                                          */
  /* ------------------------------------------------------------------------ */

  graphemeToPhoneme(
    character: string,
    language = "en-IN",
  ): string {
    const c =
      character
        .trim()
        .toUpperCase();

    if (!c) {
      return "SIL";
    }

    /*
     * This is intentionally a deterministic
     * fallback, not a linguistic AI model.
     *
     * Real phoneme analyzers can be plugged
     * into the engine later without changing
     * the canonical LipSyncTrack.
     */

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
        hindiFriendly[c] ??
        common[c] ??
        "SIL"
      );
    }

    return (
      common[c] ??
      "SIL"
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Viseme Sampling                                                           */
  /* ------------------------------------------------------------------------ */

  visemeAt(
    track: LipSyncTrack,
    tick: number,
  ): VisemeSample {
    if (
      !Number.isInteger(tick)
    ) {
      throw new Error(
        "Lip-sync tick must be an integer.",
      );
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

    if (
      active.length === 1
    ) {
      return {
        viseme:
          active[0].viseme,

        weight:
          clamp(
            active[0].weight,
            0,
            1,
          ),
      };
    }

    /*
     * Multiple overlapping visemes are
     * resolved deterministically using
     * highest effective confidence.
     */

    const best =
      [...active].sort(
        (a, b) =>
          b.weight -
          a.weight,
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
      !Number.isInteger(tick)
    ) {
      throw new Error(
        "Lip-sync tick must be an integer.",
      );
    }

    const active =
      track.visemes.filter(
        (viseme) =>
          tick >=
            viseme.startTick &&
          tick <
            viseme.endTick,
      );

    const output: Record<
      string,
      number
    > = {};

    if (
      active.length === 0
    ) {
      return {
        controls: output,
      };
    }

    for (const viseme of active) {
      const mapping =
        VISEME_TO_CONTROLS[
          viseme.viseme
        ] ??
        VISEME_TO_CONTROLS.REST;

      for (const [
        control,
        value,
      ] of Object.entries(
        mapping,
      )) {
        output[control] =
          (output[control] ??
            0) +
          value *
            viseme.weight;
      }
    }

    for (const key of Object.keys(output)) {
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
  /* Manual Overrides                                                          */
  /* ------------------------------------------------------------------------ */

  applyManualOverrides(
    track: LipSyncTrack,
    overrides: ManualOverride[],
  ): LipSyncTrack {
    const next =
      structuredClone(
        track,
      );

    const merged =
      [
        ...next.manualOverrides,
        ...overrides,
      ];

    for (const override of overrides) {
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
        (!Number.isFinite(
          override.weight,
        ) ||
          override.weight < 0 ||
          override.weight > 1)
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
        for (const value of Object.values(
          override.controls,
        )) {
          if (
            !Number.isFinite(
              value,
            )
          ) {
            throw new Error(
              "Manual override facial controls must be finite.",
            );
          }
        }
      }
    }

    next.manualOverrides =
      merged as Record<
        string,
        unknown
      >[];

    return this.validate(
      next,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                                */
  /* ------------------------------------------------------------------------ */

  validate(
    track: LipSyncTrack,
  ): LipSyncTrack {
    const result =
      this.validateResult(
        track,
      );

    if (!result.valid) {
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
    const errors: string[] = [];

    const parsed =
      LipSyncTrackSchema.safeParse(
        track,
      );

    if (!parsed.success) {
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
      const phoneme =
        track.phonemes[i];

      if (
        !Number.isInteger(
          phoneme.startTick,
        ) ||
        phoneme.startTick < 0
      ) {
        errors.push(
          `phonemes[${i}].startTick is invalid.`,
        );
      }

      if (
        !Number.isInteger(
          phoneme.endTick,
        ) ||
        phoneme.endTick <=
          phoneme.startTick
      ) {
        errors.push(
          `phonemes[${i}].endTick is invalid.`,
        );
      }

      if (
        phoneme.confidence <
          0 ||
        phoneme.confidence >
          1
      ) {
        errors.push(
          `phonemes[${i}].confidence is invalid.`,
        );
      }
    }

    for (
      let i = 0;
      i <
      track.visemes.length;
      i += 1
    ) {
      const viseme =
        track.visemes[i];

      if (
        viseme.startTick < 0 ||
        viseme.endTick <=
          viseme.startTick
      ) {
        errors.push(
          `visemes[${i}] timing is invalid.`,
        );
      }

      if (
        viseme.weight < 0 ||
        viseme.weight > 1
      ) {
        errors.push(
          `visemes[${i}].weight is invalid.`,
        );
      }

      if (
        viseme.viseme.trim()
          .length === 0
      ) {
        errors.push(
          `visemes[${i}].viseme must not be empty.`,
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
  /* Fingerprint                                                               */
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
  /* Deterministic Check                                                       */
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
}

/* -------------------------------------------------------------------------- */
/* Canonical Types                                                            */
/* -------------------------------------------------------------------------- */

export type CanonicalLipSyncTrack =
  z.infer<
    typeof LipSyncTrackSchema
  >;