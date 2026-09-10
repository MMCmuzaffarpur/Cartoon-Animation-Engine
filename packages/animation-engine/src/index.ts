import { createHash } from "node:crypto";
import { z } from "zod";

import {
  Keyframe as KeyframeSchema,
  MotionClip as MotionClipSchema,
  MotionLayer as MotionLayerSchema,
} from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Interpolation =
  | "step"
  | "linear"
  | "smooth";

export type LoopMode =
  | "once"
  | "loop"
  | "pingpong";

export interface Keyframe {
  tick: number;
  value: number;
  interpolation: Interpolation;
}

export interface Track {
  targetPath: string;
  keyframes: Keyframe[];
}

export interface MotionEvent {
  tick: number;
  type: string;
  payload?: Record<string, unknown>;
}

export interface MotionClip {
  id: string;
  name: string;
  durationTicks: number;
  loopMode: LoopMode;
  tracks: Track[];
  events: MotionEvent[];
  rootMotion: Record<string, unknown>;
  semanticCategory: string;
  rigRequirements: string[];
}

export interface MotionLayer {
  id: string;
  order: number;
  kind: string;
  weight: number;
  clipId: string;
  mask: string[];
  additive: boolean;
}

/**
 * Legacy compatibility layer.
 *
 * Older callers embed the MotionClip directly in the
 * layer instead of using clipId.
 *
 * This type intentionally does NOT extend MotionLayer,
 * because clipId is not present in the legacy format.
 */
export interface LegacyMotionLayer {
  id: string;
  order: number;
  kind: string;
  weight: number;
  mask: string[];
  additive: boolean;
  clip: MotionClip;
}

export interface EvaluatedAnimationState {
  tick: number;
  values: Record<string, number>;
}

export interface AnimationValidationResult {
  valid: boolean;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_WALK_DURATION_TICKS =
  48_000;

export const DEFAULT_RUN_DURATION_TICKS =
  24_000;

export const DEFAULT_JUMP_DURATION_TICKS =
  24_000;

export const DEFAULT_WAVE_DURATION_TICKS =
  24_000;

export const DEFAULT_DANCE_DURATION_TICKS =
  48_000;

/* -------------------------------------------------------------------------- */
/* Utility                                                                     */
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
  const digest =
    createHash("sha256")
      .update(input)
      .digest("hex");

  const bytes =
    digest.slice(0, 32);

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

/* -------------------------------------------------------------------------- */
/* Keyframe Helpers                                                            */
/* -------------------------------------------------------------------------- */

function normalizeKeyframes(
  keyframes: Keyframe[],
): Keyframe[] {
  return [...keyframes]
    .sort(
      (a, b) =>
        a.tick - b.tick,
    )
    .map(
      (keyframe) => ({
        tick: keyframe.tick,
        value: keyframe.value,
        interpolation:
          keyframe.interpolation,
      }),
    );
}

function validateKeyframes(
  track: Track,
): string[] {
  const errors: string[] = [];

  if (
    track.targetPath.trim().length === 0
  ) {
    errors.push(
      "Track targetPath must not be empty.",
    );
  }

  if (
    track.keyframes.length === 0
  ) {
    errors.push(
      `Track ${track.targetPath} must contain at least one keyframe.`,
    );

    return errors;
  }

  let previousTick = -1;

  for (
    const keyframe of track.keyframes
  ) {
    if (
      !Number.isInteger(
        keyframe.tick,
      )
    ) {
      errors.push(
        `Track ${track.targetPath} contains a non-integer keyframe tick.`,
      );
    }

    if (
      keyframe.tick < 0
    ) {
      errors.push(
        `Track ${track.targetPath} contains a negative keyframe tick.`,
      );
    }

    if (
      !Number.isFinite(
        keyframe.value,
      )
    ) {
      errors.push(
        `Track ${track.targetPath} contains a non-finite keyframe value.`,
      );
    }

    if (
      keyframe.tick <
      previousTick
    ) {
      errors.push(
        `Track ${track.targetPath} keyframes must be ordered by tick.`,
      );
    }

    previousTick =
      keyframe.tick;
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Track Sampling                                                              */
/* -------------------------------------------------------------------------- */

export function sampleTrack(
  track: Track,
  tick: number,
): number {
  const keyframes =
    normalizeKeyframes(
      track.keyframes,
    );

  if (
    keyframes.length === 0
  ) {
    return 0;
  }

  if (
    !Number.isFinite(tick)
  ) {
    throw new Error(
      "Animation sample tick must be finite.",
    );
  }

  const first =
    keyframes[0];

  const last =
    keyframes[
      keyframes.length - 1
    ];

  if (
    tick <= first.tick
  ) {
    return first.value;
  }

  if (
    tick >= last.tick
  ) {
    return last.value;
  }

  for (
    let index = 1;
    index < keyframes.length;
    index += 1
  ) {
    const previous =
      keyframes[index - 1];

    const next =
      keyframes[index];

    if (
      tick <= next.tick
    ) {
      const span =
        next.tick -
        previous.tick;

      if (
        span <= 0
      ) {
        return next.value;
      }

      const t =
        (tick -
          previous.tick) /
        span;

      switch (
        previous.interpolation
      ) {
        case "step":
          return previous.value;

        case "smooth":
          return lerp(
            previous.value,
            next.value,
            smoothstep(t),
          );

        case "linear":
        default:
          return lerp(
            previous.value,
            next.value,
            t,
          );
      }
    }
  }

  return last.value;
}

/* -------------------------------------------------------------------------- */
/* Loop Evaluation                                                             */
/* -------------------------------------------------------------------------- */

export function resolveLocalTick(
  clip: MotionClip,
  tick: number,
): number {
  if (
    !Number.isFinite(tick)
  ) {
    throw new Error(
      "Animation tick must be finite.",
    );
  }

  if (
    clip.durationTicks <= 0
  ) {
    return 0;
  }

  if (
    clip.loopMode === "once"
  ) {
    return clamp(
      tick,
      0,
      clip.durationTicks,
    );
  }

  const duration =
    clip.durationTicks;

  const cycle =
    Math.floor(
      tick / duration,
    );

  const remainder =
    ((tick % duration) +
      duration) %
    duration;

  if (
    clip.loopMode ===
    "pingpong"
  ) {
    return cycle % 2 === 1
      ? duration -
          remainder
      : remainder;
  }

  return remainder;
}

/* -------------------------------------------------------------------------- */
/* Animation Engine                                                            */
/* -------------------------------------------------------------------------- */

export class AnimationEngine {
  /* ------------------------------------------------------------------------ */
  /* Clip Creation                                                            */
  /* ------------------------------------------------------------------------ */

  createClip(
    name: string,
    durationTicks: number,
    tracks: Track[],
    options: {
      loopMode?: LoopMode;
      events?: MotionEvent[];
      rootMotion?: Record<string, unknown>;
      semanticCategory?: string;
      rigRequirements?: string[];
      deterministicKey?: string;
    } = {},
  ): MotionClip {
    if (
      name.trim().length === 0
    ) {
      throw new Error(
        "Motion clip name must not be empty.",
      );
    }

    if (
      !Number.isInteger(
        durationTicks,
      ) ||
      durationTicks <= 0
    ) {
      throw new Error(
        "Motion clip durationTicks must be a positive integer.",
      );
    }

    const normalizedTracks =
      tracks.map(
        (track) => ({
          targetPath:
            track.targetPath,
          keyframes:
            normalizeKeyframes(
              track.keyframes,
            ),
        }),
      );

    const clipInput = {
      name,
      durationTicks,
      loopMode:
        options.loopMode ??
        "once",
      tracks:
        normalizedTracks,
      events:
        options.events ??
        [],
      rootMotion:
        options.rootMotion ??
        {},
      semanticCategory:
        options.semanticCategory ??
        "custom",
      rigRequirements:
        options.rigRequirements ??
        [],
    };

    const id =
      options.deterministicKey
        ? deterministicUuid(
            canonicalize(
              clipInput,
            ) +
              `:${options.deterministicKey}`,
          )
        : deterministicUuid(
            canonicalize(
              clipInput,
            ),
          );

    const clip: MotionClip = {
      id,
      name,
      durationTicks,
      loopMode:
        options.loopMode ??
        "once",
      tracks:
        normalizedTracks,
      events:
        structuredClone(
          options.events ??
            [],
        ),
      rootMotion:
        structuredClone(
          options.rootMotion ??
            {},
        ),
      semanticCategory:
        options.semanticCategory ??
        "custom",
      rigRequirements:
        [
          ...(options.rigRequirements ??
            []),
        ],
    };

    return this.validateClip(
      clip,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Backwards-Compatible Clip Alias                                         */
  /* ------------------------------------------------------------------------ */

  clip(
    name: string,
    durationTicks: number,
    tracks: Track[],
  ): MotionClip {
    return this.createClip(
      name,
      durationTicks,
      tracks,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Clip Validation                                                          */
  /* ------------------------------------------------------------------------ */

  validateClip(
    clip: MotionClip,
  ): MotionClip {
    const result =
      this.validateClipResult(
        clip,
      );

    if (!result.valid) {
      throw new Error(
        `Invalid motion clip: ${result.errors.join("; ")}`,
      );
    }

    return structuredClone(
      clip,
    );
  }

  validateClipResult(
    clip: MotionClip,
  ): AnimationValidationResult {
    const errors: string[] = [];

    const parsed =
      MotionClipSchema.safeParse(
        clip,
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

    if (
      clip.durationTicks <= 0
    ) {
      errors.push(
        "Motion clip duration must be positive.",
      );
    }

    for (
      const track of clip.tracks
    ) {
      errors.push(
        ...validateKeyframes(
          track,
        ),
      );

      for (
        const keyframe of track.keyframes
      ) {
        if (
          keyframe.tick >
          clip.durationTicks
        ) {
          errors.push(
            `Track ${track.targetPath} contains a keyframe beyond clip duration.`,
          );
        }
      }
    }

    for (
      const event of clip.events
    ) {
      if (
        !Number.isInteger(
          event.tick,
        ) ||
        event.tick < 0 ||
        event.tick >
          clip.durationTicks
      ) {
        errors.push(
          `Motion event ${event.type} has an invalid tick.`,
        );
      }

      if (
        event.type.trim().length ===
        0
      ) {
        errors.push(
          "Motion event type must not be empty.",
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
  /* Layer Validation                                                         */
  /* ------------------------------------------------------------------------ */

  validateLayer(
    layer: MotionLayer,
  ): MotionLayer {
    const parsed =
      MotionLayerSchema.safeParse(
        layer,
      );

    if (!parsed.success) {
      throw new Error(
        `Invalid motion layer: ${parsed.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; ")}`,
      );
    }

    if (
      layer.id.trim().length === 0
    ) {
      throw new Error(
        "Motion layer id must not be empty.",
      );
    }

    if (
      !Number.isFinite(
        layer.weight,
      )
    ) {
      throw new Error(
        "Motion layer weight must be finite.",
      );
    }

    return structuredClone(
      layer,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Layer Creation                                                           */
  /* ------------------------------------------------------------------------ */

  createLayer(
    clip: MotionClip,
    options: {
      order?: number;
      kind?: string;
      weight?: number;
      mask?: string[];
      additive?: boolean;
      id?: string;
    } = {},
  ): MotionLayer {
    const validatedClip =
      this.validateClip(
        clip,
      );

    const layer: MotionLayer =
      {
        id:
          options.id ??
          deterministicUuid(
            `layer:${validatedClip.id}:${options.order ?? 0}:${options.kind ?? "base"}`,
          ),

        order:
          options.order ?? 0,

        kind:
          options.kind ??
          "base",

        weight: clamp(
          options.weight ?? 1,
          0,
          1,
        ),

        clipId:
          validatedClip.id,

        mask: [
          ...(options.mask ??
            []),
        ],

        additive:
          options.additive ??
          false,
      };

    return this.validateLayer(
      layer,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Animation Evaluation                                                     */
  /* ------------------------------------------------------------------------ */

  /**
   * Legacy two-argument API.
   *
   * Example:
   *
   * evaluate(
   *   [
   *     {
   *       id: "1",
   *       order: 0,
   *       kind: "base",
   *       weight: 1,
   *       mask: [],
   *       additive: false,
   *       clip
   *     }
   *   ],
   *   24000
   * )
   *
   * Returns a flat Record of evaluated values.
   */
  evaluate(
    layers: LegacyMotionLayer[],
    tick: number,
  ): Record<string, number>;

  /**
   * Canonical three-argument API.
   *
   * Example:
   *
   * evaluate(
   *   [clip],
   *   [layer],
   *   tick
   * )
   *
   * Returns an evaluated animation state.
   */
  evaluate(
    clips: MotionClip[],
    layers: MotionLayer[],
    tick: number,
  ): EvaluatedAnimationState;

  evaluate(
    first:
      | MotionClip[]
      | LegacyMotionLayer[],
    second:
      | MotionLayer[]
      | number,
    third?: number,
  ):
    | EvaluatedAnimationState
    | Record<string, number> {
    const legacyMode =
      typeof second === "number";

    let clips: MotionClip[];
    let layers: MotionLayer[];
    let tick: number;

    /* ---------------------------------------------------------------------- */
    /* Legacy Mode                                                            */
    /* ---------------------------------------------------------------------- */

    if (legacyMode) {
      const legacyLayers =
        first as LegacyMotionLayer[];

      tick = second;

      clips =
        legacyLayers.map(
          (layer) =>
            layer.clip,
        );

      layers =
        legacyLayers.map(
          (layer) => ({
            id: layer.id,
            order: layer.order,
            kind: layer.kind,
            weight: layer.weight,
            clipId:
              layer.clip.id,
            mask: [
              ...layer.mask,
            ],
            additive:
              layer.additive,
          }),
        );
    }

    /* ---------------------------------------------------------------------- */
    /* Canonical Mode                                                         */
    /* ---------------------------------------------------------------------- */

    else {
      clips =
        first as MotionClip[];

      layers =
        second as MotionLayer[];

      if (
        typeof third !== "number"
      ) {
        throw new Error(
          "Canonical animation evaluation requires a tick.",
        );
      }

      tick = third;
    }

    if (
      !Number.isFinite(tick)
    ) {
      throw new Error(
        "Animation evaluation tick must be finite.",
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Validate Clips                                                         */
    /* ---------------------------------------------------------------------- */

    const clipMap =
      new Map<
        string,
        MotionClip
      >();

    for (
      const clip of clips
    ) {
      const validated =
        this.validateClip(
          clip,
        );

      clipMap.set(
        validated.id,
        validated,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Deterministic Layer Ordering                                           */
    /* ---------------------------------------------------------------------- */

    const sortedLayers =
      [...layers].sort(
        (a, b) =>
          a.order -
          b.order,
      );

    const output:
      Record<string, number> =
      {};

    /* ---------------------------------------------------------------------- */
    /* Evaluate Layers                                                        */
    /* ---------------------------------------------------------------------- */

    for (
      const layer of sortedLayers
    ) {
      /*
       * Legacy layers have already been converted
       * into canonical MotionLayer objects above.
       *
       * Canonical layers are validated against
       * the contract.
       */
      const validatedLayer =
        legacyMode
          ? structuredClone(
              layer,
            )
          : this.validateLayer(
              layer,
            );

      const clip =
        clipMap.get(
          validatedLayer.clipId,
        );

      if (!clip) {
        throw new Error(
          `Motion layer ${validatedLayer.id} references missing clip ${validatedLayer.clipId}.`,
        );
      }

      const weight =
        clamp(
          validatedLayer.weight,
          0,
          1,
        );

      if (
        weight <= 0
      ) {
        continue;
      }

      const localTick =
        resolveLocalTick(
          clip,
          tick,
        );

      for (
        const track of clip.tracks
      ) {
        /*
         * Empty mask means all tracks.
         *
         * Non-empty mask means only explicitly
         * selected target paths are evaluated.
         */
        if (
          validatedLayer.mask
            .length > 0 &&
          !validatedLayer.mask.includes(
            track.targetPath,
          )
        ) {
          continue;
        }

        const value =
          sampleTrack(
            track,
            localTick,
          );

        const previous =
          output[
            track.targetPath
          ] ?? 0;

        if (
          validatedLayer.additive
        ) {
          output[
            track.targetPath
          ] =
            previous +
            value *
              weight;
        } else {
          output[
            track.targetPath
          ] =
            lerp(
              previous,
              value,
              weight,
            );
        }
      }
    }

    const values =
      structuredClone(
        output,
      );

    /* ---------------------------------------------------------------------- */
    /* Return Legacy Result                                                   */
    /* ---------------------------------------------------------------------- */

    if (legacyMode) {
      return values;
    }

    /* ---------------------------------------------------------------------- */
    /* Return Canonical Result                                                */
    /* ---------------------------------------------------------------------- */

    return {
      tick,
      values,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Single Clip Evaluation                                                   */
  /* ------------------------------------------------------------------------ */

  evaluateClip(
    clip: MotionClip,
    tick: number,
  ): Record<string, number> {
    const validated =
      this.validateClip(
        clip,
      );

    const localTick =
      resolveLocalTick(
        validated,
        tick,
      );

    const values:
      Record<string, number> =
      {};

    for (
      const track of validated.tracks
    ) {
      values[
        track.targetPath
      ] =
        sampleTrack(
          track,
          localTick,
        );
    }

    return structuredClone(
      values,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Built-in Walk                                                            */
  /* ------------------------------------------------------------------------ */

  walk(
    durationTicks =
      DEFAULT_WALK_DURATION_TICKS,
  ): MotionClip {
    return this.createClip(
      "walk",
      durationTicks,
      [
        {
          targetPath:
            "motion.root.x",

          keyframes: [
            {
              tick: 0,
              value: 0,
              interpolation:
                "linear",
            },
            {
              tick:
                durationTicks,
              value: 1,
              interpolation:
                "linear",
            },
          ],
        },

        {
          targetPath:
            "pose.leg.phase",

          keyframes: [
            {
              tick: 0,
              value: 0,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks / 2,
              value: 1,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks,
              value: 0,
              interpolation:
                "smooth",
            },
          ],
        },
      ],
      {
        loopMode:
          "loop",

        semanticCategory:
          "locomotion",

        rigRequirements: [
          "humanoid",
          "legs",
        ],
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Built-in Run                                                             */
  /* ------------------------------------------------------------------------ */

  run(
    durationTicks =
      DEFAULT_RUN_DURATION_TICKS,
  ): MotionClip {
    return this.createClip(
      "run",
      durationTicks,
      [
        {
          targetPath:
            "motion.root.x",

          keyframes: [
            {
              tick: 0,
              value: 0,
              interpolation:
                "linear",
            },
            {
              tick:
                durationTicks,
              value: 2,
              interpolation:
                "linear",
            },
          ],
        },
      ],
      {
        loopMode:
          "loop",

        semanticCategory:
          "locomotion",

        rigRequirements: [
          "humanoid",
          "legs",
        ],
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Built-in Jump                                                            */
  /* ------------------------------------------------------------------------ */

  jump(
    durationTicks =
      DEFAULT_JUMP_DURATION_TICKS,
  ): MotionClip {
    return this.createClip(
      "jump",
      durationTicks,
      [
        {
          targetPath:
            "motion.root.y",

          keyframes: [
            {
              tick: 0,
              value: 0,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks / 2,
              value: 1,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks,
              value: 0,
              interpolation:
                "smooth",
            },
          ],
        },
      ],
      {
        loopMode:
          "once",

        semanticCategory:
          "locomotion",

        rigRequirements: [
          "humanoid",
        ],
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Built-in Wave                                                            */
  /* ------------------------------------------------------------------------ */

  wave(
    durationTicks =
      DEFAULT_WAVE_DURATION_TICKS,
  ): MotionClip {
    return this.createClip(
      "wave",
      durationTicks,
      [
        {
          targetPath:
            "pose.arm.wave",

          keyframes: [
            {
              tick: 0,
              value: 0,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks / 2,
              value: 1,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks,
              value: 0,
              interpolation:
                "smooth",
            },
          ],
        },
      ],
      {
        loopMode:
          "once",

        semanticCategory:
          "gesture",

        rigRequirements: [
          "humanoid",
          "arms",
        ],
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Built-in Dance                                                           */
  /* ------------------------------------------------------------------------ */

  dance(
    durationTicks =
      DEFAULT_DANCE_DURATION_TICKS,
  ): MotionClip {
    return this.createClip(
      "dance",
      durationTicks,
      [
        {
          targetPath:
            "pose.body.bounce",

          keyframes: [
            {
              tick: 0,
              value: 0,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks / 4,
              value: 1,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks / 2,
              value: 0,
              interpolation:
                "smooth",
            },
            {
              tick:
                (durationTicks * 3) /
                4,
              value: -1,
              interpolation:
                "smooth",
            },
            {
              tick:
                durationTicks,
              value: 0,
              interpolation:
                "smooth",
            },
          ],
        },
      ],
      {
        loopMode:
          "loop",

        semanticCategory:
          "dance",

        rigRequirements: [
          "humanoid",
        ],
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    clip: MotionClip,
  ): string {
    const validated =
      this.validateClip(
        clip,
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
}

/* -------------------------------------------------------------------------- */
/* Public Contract Helpers                                                    */
/* -------------------------------------------------------------------------- */

export type CanonicalKeyframe =
  z.infer<
    typeof KeyframeSchema
  >;

export type CanonicalMotionClip =
  z.infer<
    typeof MotionClipSchema
  >;

export type CanonicalMotionLayer =
  z.infer<
    typeof MotionLayerSchema
  >;