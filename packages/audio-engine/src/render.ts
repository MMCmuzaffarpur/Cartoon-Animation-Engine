import {
  mkdir,
} from "node:fs/promises";

import {
  dirname,
  resolve,
} from "node:path";

import {
  spawn,
} from "node:child_process";

import type {
  AudioMixIntent,
  AudioMixTrack,
} from "./index.js";

/* -------------------------------------------------------------------------- */
/* Version                                                                    */
/* -------------------------------------------------------------------------- */

export const AUDIO_RENDER_VERSION =
  "1.0.0" as const;

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export interface AudioAssetResolver {
  (
    assetId: string,
  ): string | null | Promise<string | null>;
}

export interface AudioRenderOptions {
  ffmpeg: string;
  output: string;

  startTick: number;
  endTick: number;

  tickRate: number;

  sampleRate?: number;
  channels?: number;

  normalization?:
    | "peak"
    | "none";

  assetResolver: AudioAssetResolver;
}

export interface AudioRenderResult {
  path: string;

  startTick: number;
  endTick: number;
  tickRate: number;

  sampleRate: number;
  channels: number;

  trackCount: number;
  renderedTrackCount: number;

  durationSeconds: number;

  renderer:
    "ffmpeg-audio-mix";

  version:
    "1.0.0";
}

export interface AudioRenderPlan {
  ffmpeg: string;
  output: string;

  startTick: number;
  endTick: number;
  tickRate: number;

  sampleRate: number;
  channels: number;

  normalization:
    | "peak"
    | "none";

  tracks: AudioRenderPlanTrack[];

  filterComplex: string;

  outputLabel: string;

  args: string[];
}

export interface AudioRenderPlanTrack {
  id: string;
  assetId: string;

  path: string;

  startTick: number;
  endTick: number;

  durationSeconds: number;

  delayMilliseconds: number;

  volume: number;
  pan: number;

  fadeInSeconds: number;
  fadeOutSeconds: number;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_SAMPLE_RATE =
  48_000;

const DEFAULT_CHANNELS =
  2;

const MIN_SAMPLE_RATE =
  8_000;

const MAX_SAMPLE_RATE =
  192_000;

const MIN_CHANNELS =
  1;

const MAX_CHANNELS =
  8;

const MAX_ERROR_LENGTH =
  32_768;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function requireString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function requireFiniteNumber(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `${field} must be a finite number.`,
    );
  }

  return value;
}

function requireInteger(
  value: unknown,
  field: string,
): number {
  const number =
    requireFiniteNumber(
      value,
      field,
    );

  if (
    !Number.isInteger(number)
  ) {
    throw new Error(
      `${field} must be an integer.`,
    );
  }

  return number;
}

function positiveInteger(
  value: unknown,
  field: string,
): number {
  const number =
    requireInteger(
      value,
      field,
    );

  if (
    number <= 0
  ) {
    throw new Error(
      `${field} must be greater than zero.`,
    );
  }

  return number;
}

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

/* -------------------------------------------------------------------------- */
/* Timeline Helpers                                                           */
/* -------------------------------------------------------------------------- */

function ticksToSeconds(
  ticks: number,
  tickRate: number,
): number {
  return ticks / tickRate;
}

function ticksToMilliseconds(
  ticks: number,
  tickRate: number,
): number {
  return Math.max(
    0,
    Math.round(
      ticksToSeconds(
        ticks,
        tickRate,
      ) * 1000,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* FFmpeg Escaping                                                            */
/* -------------------------------------------------------------------------- */

/*
 * Escape a filesystem path for an FFmpeg filter argument.
 *
 * The path is also supplied to FFmpeg through -i, so this function is
 * only concerned with filtergraph safety.
 */
function escapeFilterPath(
  value: string,
): string {
  return value
    .replaceAll(
      "\\",
      "\\\\",
    )
    .replaceAll(
      "'",
      "\\'",
    )
    .replaceAll(
      ":",
      "\\:",
    )
    .replaceAll(
      "[",
      "\\[",
    )
    .replaceAll(
      "]",
      "\\]",
    )
    .replaceAll(
      ",",
      "\\,",
    )
    .replaceAll(
      ";",
      "\\;",
    );
}

/* -------------------------------------------------------------------------- */
/* Audio Filter Construction                                                  */
/* -------------------------------------------------------------------------- */

function panExpression(
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
    left:
      Math.cos(angle),
    right:
      Math.sin(angle),
  };
}

function buildTrackFilter(
  inputIndex: number,
  track: AudioRenderPlanTrack,
  outputChannels: number,
): string {
  const input =
    `[${inputIndex}:a]`;

  const output =
    `[track_${inputIndex}]`;

  const filters: string[] = [];

  /*
   * Start every source from timestamp zero.
   */
  filters.push(
    "asetpts=PTS-STARTPTS",
  );

  /*
   * Restrict the source to the composition clip duration.
   */
  filters.push(
    `atrim=duration=${track.durationSeconds}`,
  );

  /*
   * Volume.
   */
  filters.push(
    `volume=${track.volume}`,
  );

  /*
   * Equal-power stereo panning.
   */
  if (
    outputChannels === 2
  ) {
    const pan =
      panExpression(
        track.pan,
      );

    filters.push(
      [
        "pan=stereo",
        `c0=c0*${pan.left}+c1*${pan.left}`,
        `c1=c0*${pan.right}+c1*${pan.right}`,
      ].join("|"),
    );
  }

  /*
   * Fade in.
   */
  if (
    track.fadeInSeconds > 0
  ) {
    filters.push(
      [
        "afade=t=in",
        `st=0`,
        `d=${track.fadeInSeconds}`,
      ].join(":"),
    );
  }

  /*
   * Fade out.
   */
  if (
    track.fadeOutSeconds > 0
  ) {
    const fadeStart =
      Math.max(
        0,
        track.durationSeconds -
          track.fadeOutSeconds,
      );

    filters.push(
      [
        "afade=t=out",
        `st=${fadeStart}`,
        `d=${track.fadeOutSeconds}`,
      ].join(":"),
    );
  }

  /*
   * Place the clip on the global composition timeline.
   */
  if (
    track.delayMilliseconds > 0
  ) {
    filters.push(
      [
        "adelay",
        `${track.delayMilliseconds}|${track.delayMilliseconds}`,
      ].join("="),
    );
  }

  return (
    input +
    filters.join(",") +
    output
  );
}

/* -------------------------------------------------------------------------- */
/* Audio Render Engine                                                        */
/* -------------------------------------------------------------------------- */

export class AudioRenderEngine {
  readonly version =
    AUDIO_RENDER_VERSION;

  /* ------------------------------------------------------------------------ */
  /* Validate Options                                                         */
  /* ------------------------------------------------------------------------ */

  validateOptions(
    options: AudioRenderOptions,
  ): AudioRenderOptions {
    if (
      !options ||
      typeof options !== "object"
    ) {
      throw new Error(
        "Audio render options must be an object.",
      );
    }

    const ffmpeg =
      requireString(
        options.ffmpeg,
        "FFmpeg executable path",
      );

    const output =
      resolve(
        requireString(
          options.output,
          "Audio output path",
        ),
      );

    const startTick =
      requireFiniteNumber(
        options.startTick,
        "Audio startTick",
      );

    const endTick =
      requireFiniteNumber(
        options.endTick,
        "Audio endTick",
      );

    if (
      endTick <= startTick
    ) {
      throw new Error(
        "Audio endTick must be greater than startTick.",
      );
    }

    const tickRate =
      requireFiniteNumber(
        options.tickRate,
        "Audio tickRate",
      );

    if (
      tickRate <= 0
    ) {
      throw new Error(
        "Audio tickRate must be greater than zero.",
      );
    }

    const sampleRate =
      positiveInteger(
        options.sampleRate ??
          DEFAULT_SAMPLE_RATE,
        "Audio sampleRate",
      );

    if (
      sampleRate <
        MIN_SAMPLE_RATE ||
      sampleRate >
        MAX_SAMPLE_RATE
    ) {
      throw new Error(
        `Audio sampleRate must be between ${MIN_SAMPLE_RATE} and ${MAX_SAMPLE_RATE}.`,
      );
    }

    const channels =
  requireInteger(
    options.channels ??
      DEFAULT_CHANNELS,
    "Audio channels",
  );

if (
  channels <
    MIN_CHANNELS ||
  channels >
    MAX_CHANNELS
) {
  throw new Error(
    `Audio channels must be between ${MIN_CHANNELS} and ${MAX_CHANNELS}.`,
  );
}

    const normalization =
      options.normalization ??
      "peak";

    if (
      normalization !== "peak" &&
      normalization !== "none"
    ) {
      throw new Error(
        `Unsupported audio normalization "${String(
          normalization,
        )}".`,
      );
    }

    if (
      typeof options.assetResolver !==
      "function"
    ) {
      throw new Error(
        "Audio assetResolver must be a function.",
      );
    }

    return {
      ffmpeg,
      output,

      startTick,
      endTick,
      tickRate,

      sampleRate,
      channels,

      normalization,

      assetResolver:
        options.assetResolver,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Build Render Plan                                                        */
  /* ------------------------------------------------------------------------ */

  async buildPlan(
    intent: AudioMixIntent,
    options: AudioRenderOptions,
  ): Promise<AudioRenderPlan> {
    const normalized =
      this.validateOptions(
        options,
      );

    if (
      !intent ||
      typeof intent !== "object"
    ) {
      throw new Error(
        "Audio mix intent must be an object.",
      );
    }

    const sampleRate =
      normalized.sampleRate ??
      intent.sampleRate;

    const channels =
      normalized.channels ??
      intent.channels;

    const normalization =
      normalized.normalization ??
      intent.normalization;

    const tracks: AudioRenderPlanTrack[] =
      [];

    for (
      const track of intent.tracks
    ) {
      if (
        track.assetId === null
      ) {
        continue;
      }

      if (
        track.endTick <=
        normalized.startTick ||
        track.startTick >=
        normalized.endTick
      ) {
        continue;
      }

      const resolvedPath =
        await normalized.assetResolver(
          track.assetId,
        );

      if (
        !resolvedPath
      ) {
        throw new Error(
          `Unable to resolve audio asset "${track.assetId}".`,
        );
      }

      const clipStart =
        Math.max(
          track.startTick,
          normalized.startTick,
        );

      const clipEnd =
        Math.min(
          track.endTick,
          normalized.endTick,
        );

      if (
        clipEnd <= clipStart
      ) {
        continue;
      }

      const durationSeconds =
        ticksToSeconds(
          clipEnd -
            clipStart,
          normalized.tickRate,
        );

      const delayTicks =
        clipStart -
        normalized.startTick;

      const fadeInTicks =
        Math.min(
          track.fadeInTicks,
          clipEnd -
            clipStart,
        );

      const fadeOutTicks =
        Math.min(
          track.fadeOutTicks,
          clipEnd -
            clipStart,
        );

      tracks.push({
        id:
          track.id,

        assetId:
          track.assetId,

        path:
          resolve(
            resolvedPath,
          ),

        startTick:
          clipStart,

        endTick:
          clipEnd,

        durationSeconds,

        delayMilliseconds:
          ticksToMilliseconds(
            delayTicks,
            normalized.tickRate,
          ),

        volume:
          clamp(
            track.volume,
            0,
            2,
          ),

        pan:
          clamp(
            track.pan,
            -1,
            1,
          ),

        fadeInSeconds:
          ticksToSeconds(
            fadeInTicks,
            normalized.tickRate,
          ),

        fadeOutSeconds:
          ticksToSeconds(
            fadeOutTicks,
            normalized.tickRate,
          ),
      });
    }

    /*
     * Deterministic ordering.
     */
    tracks.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.endTick -
          b.endTick ||
        a.id.localeCompare(
          b.id,
        ),
    );

    const filterParts: string[] =
      [];

    for (
      let index = 0;
      index < tracks.length;
      index += 1
    ) {
      filterParts.push(
        buildTrackFilter(
          index,
          tracks[index],
          channels,
        ),
      );
    }

    const outputLabel =
      "[audio_mix]";

    if (
      tracks.length === 0
    ) {
      /*
       * Generate silence when no audio assets are active.
       *
       * This keeps the video/audio pipeline deterministic and prevents
       * a missing soundtrack from breaking the render job.
       */
      filterParts.push(
        [
          "anullsrc",
          `r=${sampleRate}`,
          `cl=${channels === 1 ? "mono" : "stereo"}`,
          `d=${ticksToSeconds(
            normalized.endTick -
              normalized.startTick,
            normalized.tickRate,
          )}`,
          outputLabel,
        ].join("="),
      );
    } else if (
      tracks.length === 1
    ) {
      filterParts.push(
        `[track_0]aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${
          channels === 1
            ? "mono"
            : "stereo"
        }${outputLabel}`,
      );
    } else {
      const inputs =
        tracks
          .map(
            (_, index) =>
              `[track_${index}]`,
          )
          .join("");

      filterParts.push(
        [
          `${inputs}amix=inputs=${tracks.length}`,
          "duration=longest",
          "dropout_transition=0",
          `normalize=${
            normalization === "peak"
              ? 1
              : 0
          }`,
          `aformat=sample_fmts=fltp:sample_rates=${sampleRate}:channel_layouts=${
            channels === 1
              ? "mono"
              : "stereo"
          }`,
          outputLabel,
        ].join(":"),
      );
    }

    const filterComplex =
      filterParts.join(";");

    const args: string[] = [
      "-hide_banner",

      "-loglevel",
      "error",

      "-y",
    ];

    /*
     * Input files.
     */
    for (
      const track of tracks
    ) {
      args.push(
        "-i",
        track.path,
      );
    }

    /*
     * When no tracks exist, FFmpeg does not have an input.
     * Create silence using lavfi instead.
     */
    if (
      tracks.length === 0
    ) {
      const duration =
        ticksToSeconds(
          normalized.endTick -
            normalized.startTick,
          normalized.tickRate,
        );

      args.push(
        "-f",
        "lavfi",

        "-t",
        String(
          duration,
        ),

        "-i",
        `anullsrc=r=${sampleRate}:cl=${
          channels === 1
            ? "mono"
            : "stereo"
        }`,
      );
    }

    args.push(
      "-filter_complex",
      filterComplex,

      "-map",
      outputLabel,

      "-ar",
      String(
        sampleRate,
      ),

      "-ac",
      String(
        channels,
      ),

      "-c:a",
      "pcm_s16le",

      normalized.output,
    );

    return {
      ffmpeg:
        normalized.ffmpeg,

      output:
        normalized.output,

      startTick:
        normalized.startTick,

      endTick:
        normalized.endTick,

      tickRate:
        normalized.tickRate,

      sampleRate,

      channels,

      normalization,

      tracks,

      filterComplex,

      outputLabel,

      args,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Render WAV                                                               */
  /* ------------------------------------------------------------------------ */

  async renderWav(
    intent: AudioMixIntent,
    options: AudioRenderOptions,
  ): Promise<AudioRenderResult> {
    const plan =
      await this.buildPlan(
        intent,
        options,
      );

    await mkdir(
      dirname(
        plan.output,
      ),
      {
        recursive:
          true,
      },
    );

    await this.runProcess(
      plan.ffmpeg,
      plan.args,
    );

    return {
      path:
        plan.output,

      startTick:
        plan.startTick,

      endTick:
        plan.endTick,

      tickRate:
        plan.tickRate,

      sampleRate:
        plan.sampleRate,

      channels:
        plan.channels,

      trackCount:
        intent.tracks.length,

      renderedTrackCount:
        plan.tracks.length,

      durationSeconds:
        ticksToSeconds(
          plan.endTick -
            plan.startTick,
          plan.tickRate,
        ),

      renderer:
        "ffmpeg-audio-mix",

      version:
        AUDIO_RENDER_VERSION,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Process Runner                                                           */
  /* ------------------------------------------------------------------------ */

  private runProcess(
    command: string,
    args: string[],
  ): Promise<void> {
    return new Promise(
      (
        resolveProcess,
        rejectProcess,
      ) => {
        let settled =
          false;

        let stderr =
          "";

        const child =
          spawn(
            command,
            args,
            {
              stdio: [
                "ignore",
                "ignore",
                "pipe",
              ],

              windowsHide:
                true,
            },
          );

        const rejectOnce =
          (
            error: Error,
          ): void => {
            if (
              settled
            ) {
              return;
            }

            settled =
              true;

            rejectProcess(
              error,
            );
          };

        const resolveOnce =
          (): void => {
            if (
              settled
            ) {
              return;
            }

            settled =
              true;

            resolveProcess();
          };

        child.stderr?.on(
          "data",
          (chunk: unknown) => {
            stderr +=
              String(chunk);

            if (
              stderr.length >
              MAX_ERROR_LENGTH
            ) {
              stderr =
                stderr.slice(
                  -MAX_ERROR_LENGTH,
                );
            }
          },
        );

        child.on(
          "error",
          (error) => {
            rejectOnce(
              error,
            );
          },
        );

        child.on(
          "close",
          (code) => {
            if (
              code === 0
            ) {
              resolveOnce();
              return;
            }

            rejectOnce(
              new Error(
                stderr.trim() ||
                  `FFmpeg exited with code ${String(
                    code,
                  )}.`,
              ),
            );
          },
        );
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createAudioRenderEngine(): AudioRenderEngine {
  return new AudioRenderEngine();
}