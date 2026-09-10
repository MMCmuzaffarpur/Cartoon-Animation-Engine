import { createHash } from "node:crypto";

import {
  AudioTrack as AudioTrackSchema,
} from "../../contracts/src/index.js";

import { uuid } from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface AudioClip {
  id: string;
  assetId: string | null;
  startTick: number;
  endTick: number;
  volume: number;
  pan: number;
  fadeInTicks: number;
  fadeOutTicks: number;
}

export interface AudioTrack extends AudioClip {
  name: string;
}

export type AudioClipOptions = Partial<
  Omit<AudioClip, "id" | "assetId" | "startTick" | "endTick">
>;

export interface AudioMixTrack {
  id: string;
  assetId: string | null;
  startTick: number;
  endTick: number;
  volume: number;
  pan: number;
  fadeInTicks: number;
  fadeOutTicks: number;
}

export interface AudioMixIntent {
  sampleRate: number;
  channels: number;
  normalization: "peak" | "none";
  tracks: AudioMixTrack[];
}

export interface AudioEvaluation {
  tick: number;
  active: boolean;
  gain: number;
  leftGain: number;
  rightGain: number;
}

export interface AudioValidationResult {
  valid: boolean;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SAMPLE_RATE = 48_000;

export const DEFAULT_CHANNELS = 2;

export const DEFAULT_VOLUME = 1;

export const DEFAULT_PAN = 0;

export const MAX_VOLUME = 2;

export const MIN_PAN = -1;

export const MAX_PAN = 1;

/* -------------------------------------------------------------------------- */
/* Math Helpers                                                               */
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

function equalPowerPan(
  pan: number,
): {
  left: number;
  right: number;
} {
  const normalized =
    clamp(
      pan,
      -1,
      1,
    );

  const angle =
    (normalized + 1) *
    (Math.PI / 4);

  return {
    left: Math.cos(angle),
    right: Math.sin(angle),
  };
}

/* -------------------------------------------------------------------------- */
/* Canonical Serialization                                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Audio Engine                                                               */
/* -------------------------------------------------------------------------- */

export class AudioEngine {
  /* ------------------------------------------------------------------------ */
  /* Create Clip                                                              */
  /* ------------------------------------------------------------------------ */

  clip(
    assetId: string | null,
    startTick: number,
    endTick: number,
    options: AudioClipOptions = {},
  ): AudioClip {
    this.validateRange(
      startTick,
      endTick,
    );

    const clip: AudioClip = {
      id: uuid(),
      assetId,
      startTick,
      endTick,

      volume: clamp(
        options.volume ??
          DEFAULT_VOLUME,
        0,
        MAX_VOLUME,
      ),

      pan: clamp(
        options.pan ??
          DEFAULT_PAN,
        MIN_PAN,
        MAX_PAN,
      ),

      fadeInTicks: Math.max(
        0,
        options.fadeInTicks ??
          0,
      ),

      fadeOutTicks: Math.max(
        0,
        options.fadeOutTicks ??
          0,
      ),
    };

    return this.validateClip(
      clip,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Named Track                                                              */
  /* ------------------------------------------------------------------------ */

  track(
    name: string,
    assetId: string | null,
    startTick: number,
    endTick: number,
    options: AudioClipOptions = {},
  ): AudioTrack {
    if (
      name.trim().length === 0
    ) {
      throw new Error(
        "Audio track name must not be empty.",
      );
    }

    const clip =
      this.clip(
        assetId,
        startTick,
        endTick,
        options,
      );

    return {
      ...clip,
      name,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validateClip(
    clip: AudioClip,
  ): AudioClip {
    const result =
      this.validateClipResult(
        clip,
      );

    if (!result.valid) {
      throw new Error(
        `Invalid audio clip: ${result.errors.join("; ")}`,
      );
    }

    return structuredClone(
      clip,
    );
  }

  validateClipResult(
    clip: AudioClip,
  ): AudioValidationResult {
    const errors: string[] = [];

    if (
      typeof clip.id !==
      "string" ||
      clip.id.trim().length === 0
    ) {
      errors.push(
        "Audio clip id must not be empty.",
      );
    }

    this.collectRangeErrors(
      clip.startTick,
      clip.endTick,
      errors,
    );

    if (
      !Number.isFinite(
        clip.volume,
      ) ||
      clip.volume < 0 ||
      clip.volume > MAX_VOLUME
    ) {
      errors.push(
        `Audio volume must be between 0 and ${MAX_VOLUME}.`,
      );
    }

    if (
      !Number.isFinite(
        clip.pan,
      ) ||
      clip.pan < MIN_PAN ||
      clip.pan > MAX_PAN
    ) {
      errors.push(
        "Audio pan must be between -1 and 1.",
      );
    }

    if (
      !Number.isInteger(
        clip.fadeInTicks,
      ) ||
      clip.fadeInTicks < 0
    ) {
      errors.push(
        "Audio fadeInTicks must be a non-negative integer.",
      );
    }

    if (
      !Number.isInteger(
        clip.fadeOutTicks,
      ) ||
      clip.fadeOutTicks < 0
    ) {
      errors.push(
        "Audio fadeOutTicks must be a non-negative integer.",
      );
    }

    const duration =
      clip.endTick -
      clip.startTick;

    if (
      clip.fadeInTicks >
      duration
    ) {
      errors.push(
        "Audio fadeInTicks must not exceed clip duration.",
      );
    }

    if (
      clip.fadeOutTicks >
      duration
    ) {
      errors.push(
        "Audio fadeOutTicks must not exceed clip duration.",
      );
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Gain Evaluation                                                          */
  /* ------------------------------------------------------------------------ */

  gainAt(
    clip: AudioClip,
    tick: number,
  ): number {
    const validated =
      this.validateClip(
        clip,
      );

    if (
      !Number.isFinite(tick)
    ) {
      throw new Error(
        "Audio evaluation tick must be finite.",
      );
    }

    if (
      tick <
        validated.startTick ||
      tick >
        validated.endTick
    ) {
      return 0;
    }

    const duration =
      validated.endTick -
      validated.startTick;

    let fadeInGain = 1;

    let fadeOutGain = 1;

    if (
      validated.fadeInTicks >
      0
    ) {
      fadeInGain = clamp(
        (
          tick -
          validated.startTick
        ) /
          validated.fadeInTicks,
        0,
        1,
      );
    }

    if (
      validated.fadeOutTicks >
      0
    ) {
      fadeOutGain = clamp(
        (
          validated.endTick -
          tick
        ) /
          validated.fadeOutTicks,
        0,
        1,
      );
    }

    /*
     * A zero-length clip is not allowed by
     * validation, but duration is retained
     * here as a defensive invariant.
     */
    if (
      duration <= 0
    ) {
      return 0;
    }

    return (
      validated.volume *
      Math.min(
        fadeInGain,
        fadeOutGain,
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Stereo Evaluation                                                        */
  /* ------------------------------------------------------------------------ */

  evaluate(
    clip: AudioClip,
    tick: number,
  ): AudioEvaluation {
    const gain =
      this.gainAt(
        clip,
        tick,
      );

    const pan =
      equalPowerPan(
        clip.pan,
      );

    return {
      tick,
      active: gain > 0,
      gain,
      leftGain:
        gain *
        pan.left,
      rightGain:
        gain *
        pan.right,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Volume                                                                   */
  /* ------------------------------------------------------------------------ */

  setVolume(
    clip: AudioClip,
    volume: number,
  ): AudioClip {
    if (
      !Number.isFinite(volume)
    ) {
      throw new Error(
        "Audio volume must be finite.",
      );
    }

    return this.validateClip({
      ...clip,
      volume: clamp(
        volume,
        0,
        MAX_VOLUME,
      ),
    });
  }

  multiplyVolume(
    clip: AudioClip,
    multiplier: number,
  ): AudioClip {
    if (
      !Number.isFinite(
        multiplier,
      ) ||
      multiplier < 0
    ) {
      throw new Error(
        "Audio volume multiplier must be a non-negative finite number.",
      );
    }

    return this.setVolume(
      clip,
      clip.volume *
        multiplier,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Pan                                                                      */
  /* ------------------------------------------------------------------------ */

  setPan(
    clip: AudioClip,
    pan: number,
  ): AudioClip {
    if (
      !Number.isFinite(pan)
    ) {
      throw new Error(
        "Audio pan must be finite.",
      );
    }

    return this.validateClip({
      ...clip,
      pan: clamp(
        pan,
        MIN_PAN,
        MAX_PAN,
      ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Fade                                                                     */
  /* ------------------------------------------------------------------------ */

  setFades(
    clip: AudioClip,
    fadeInTicks: number,
    fadeOutTicks: number,
  ): AudioClip {
    if (
      !Number.isInteger(
        fadeInTicks,
      ) ||
      fadeInTicks < 0
    ) {
      throw new Error(
        "fadeInTicks must be a non-negative integer.",
      );
    }

    if (
      !Number.isInteger(
        fadeOutTicks,
      ) ||
      fadeOutTicks < 0
    ) {
      throw new Error(
        "fadeOutTicks must be a non-negative integer.",
      );
    }

    return this.validateClip({
      ...clip,
      fadeInTicks,
      fadeOutTicks,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Mix Intent                                                               */
  /* ------------------------------------------------------------------------ */

  mixIntent(
    clips: AudioClip[],
    options: {
      sampleRate?: number;
      channels?: number;
      normalization?: "peak" | "none";
    } = {},
  ): AudioMixIntent {
    const sampleRate =
      options.sampleRate ??
      DEFAULT_SAMPLE_RATE;

    const channels =
      options.channels ??
      DEFAULT_CHANNELS;

    const normalization =
      options.normalization ??
      "peak";

    if (
      !Number.isInteger(
        sampleRate,
      ) ||
      sampleRate <= 0
    ) {
      throw new Error(
        "Audio sample rate must be a positive integer.",
      );
    }

    if (
      !Number.isInteger(
        channels,
      ) ||
      channels <= 0
    ) {
      throw new Error(
        "Audio channel count must be a positive integer.",
      );
    }

    const validated =
      clips.map(
        (clip) =>
          this.validateClip(
            clip,
          ),
      );

    return {
      sampleRate,
      channels,
      normalization,

      tracks:
        validated.map(
          (clip) => ({
            id: clip.id,
            assetId:
              clip.assetId,
            startTick:
              clip.startTick,
            endTick:
              clip.endTick,
            volume:
              clip.volume,
            pan:
              clip.pan,
            fadeInTicks:
              clip.fadeInTicks,
            fadeOutTicks:
              clip.fadeOutTicks,
          }),
        ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Sort / Normalize Tracks                                                  */
  /* ------------------------------------------------------------------------ */

  normalizeTracks(
    clips: AudioClip[],
  ): AudioClip[] {
    return clips
      .map(
        (clip) =>
          this.validateClip(
            clip,
          ),
      )
      .sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.endTick -
            b.endTick ||
          a.id.localeCompare(
            b.id,
          ),
      )
      .map(
        (clip) =>
          structuredClone(
            clip,
          ),
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Duration                                                                  */
  /* ------------------------------------------------------------------------ */

  duration(
    clips: AudioClip[],
  ): number {
    if (
      clips.length === 0
    ) {
      return 0;
    }

    const validated =
      clips.map(
        (clip) =>
          this.validateClip(
            clip,
          ),
      );

    return Math.max(
      ...validated.map(
        (clip) =>
          clip.endTick,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Clone                                                                     */
  /* ------------------------------------------------------------------------ */

  clone(
    clip: AudioClip,
  ): AudioClip {
    return structuredClone(
      this.validateClip(
        clip,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                               */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    clip: AudioClip,
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

  /* ------------------------------------------------------------------------ */
  /* Contract Validation Helper                                               */
  /* ------------------------------------------------------------------------ */

  toCanonicalTrack(
    clip: AudioClip,
    name = "Audio Track",
  ): AudioTrack {
    if (
      name.trim().length === 0
    ) {
      throw new Error(
        "Audio track name must not be empty.",
      );
    }

    const candidate = {
      id: clip.id,
      name,
      assetId: clip.assetId,
      startTick:
        clip.startTick,
      endTick:
        clip.endTick,
      volume: clip.volume,
      pan: clip.pan,
      fadeInTicks:
        clip.fadeInTicks,
      fadeOutTicks:
        clip.fadeOutTicks,
    };

    const parsed =
      AudioTrackSchema.safeParse(
        candidate,
      );

    if (!parsed.success) {
      throw new Error(
        `Invalid canonical audio track: ${parsed.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; ")}`,
      );
    }

    return structuredClone(
      candidate,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Internal Helpers                                                         */
  /* ------------------------------------------------------------------------ */

  private validateRange(
    startTick: number,
    endTick: number,
  ): void {
    const errors: string[] = [];

    this.collectRangeErrors(
      startTick,
      endTick,
      errors,
    );

    if (
      errors.length > 0
    ) {
      throw new Error(
        errors.join("; "),
      );
    }
  }

  private collectRangeErrors(
    startTick: number,
    endTick: number,
    errors: string[],
  ): void {
    if (
      !Number.isInteger(
        startTick,
      ) ||
      startTick < 0
    ) {
      errors.push(
        "Audio startTick must be a non-negative integer.",
      );
    }

    if (
      !Number.isInteger(
        endTick,
      ) ||
      endTick < 0
    ) {
      errors.push(
        "Audio endTick must be a non-negative integer.",
      );
    }

    if (
      Number.isInteger(
        startTick,
      ) &&
      Number.isInteger(
        endTick,
      ) &&
      endTick <= startTick
    ) {
      errors.push(
        "Audio endTick must be greater than startTick.",
      );
    }
  }
}