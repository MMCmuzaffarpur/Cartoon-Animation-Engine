import {
  mkdtemp,
  mkdir,
  rm,
} from "node:fs/promises";

import {
  dirname,
  join,
  resolve,
} from "node:path";

import {
  spawn,
} from "node:child_process";

import {
  CaeError,
} from "../../domain/src/index.js";

import {
  SvgRenderer,
} from "../../render-2d/src/index.js";

import {
  FrameEvaluator,
} from "../../frame-evaluation/src/index.js";

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export interface VideoOptions {
  ffmpeg: string;
  output: string;

  width: number;
  height: number;

  fps: number;

  startTick: number;
  endTick: number;

  tickRate: number;
}

export interface VideoRenderResult {
  path: string;

  width: number;
  height: number;

  fps: number;

  frameCount: number;

  startTick: number;
  endTick: number;

  tickRate: number;

  renderer: "svg-ffmpeg";

  version: "1.0.0";
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const VIDEO_ENGINE_VERSION =
  "1.0.0" as const;

const DEFAULT_WIDTH =
  1280;

const DEFAULT_HEIGHT =
  720;

const DEFAULT_FPS =
  30;

const DEFAULT_TICK_RATE =
  1000;

const MIN_FPS =
  1;

const MAX_FPS =
  120;

const MIN_DIMENSION =
  1;

const MAX_DIMENSION =
  16_384;

const MAX_TEMP_ERROR_LENGTH =
  32_768;

/* -------------------------------------------------------------------------- */
/* Internal Types                                                             */
/* -------------------------------------------------------------------------- */

type UnknownRecord =
  Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function clone<T>(
  value: T,
): T {
  return structuredClone(
    value,
  );
}

function requireNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CaeError(
      "RENDER_FAILED",
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
    throw new CaeError(
      "RENDER_FAILED",
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
    throw new CaeError(
      "RENDER_FAILED",
      `${field} must be an integer.`,
    );
  }

  return number;
}

function requirePositiveInteger(
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
    throw new CaeError(
      "RENDER_FAILED",
      `${field} must be greater than zero.`,
    );
  }

  return number;
}

function requirePositiveFinite(
  value: unknown,
  field: string,
): number {
  const number =
    requireFiniteNumber(
      value,
      field,
    );

  if (
    number <= 0
  ) {
    throw new CaeError(
      "RENDER_FAILED",
      `${field} must be greater than zero.`,
    );
  }

  return number;
}

function assertDimension(
  value: number,
  field: string,
): void {
  if (
    value < MIN_DIMENSION ||
    value > MAX_DIMENSION
  ) {
    throw new CaeError(
      "RENDER_FAILED",
      `${field} must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}.`,
    );
  }
}

function assertFps(
  value: number,
): void {
  if (
    value < MIN_FPS ||
    value > MAX_FPS
  ) {
    throw new CaeError(
      "RENDER_FAILED",
      `Video FPS must be between ${MIN_FPS} and ${MAX_FPS}.`,
    );
  }
}

function calculateFrameCount(
  startTick: number,
  endTick: number,
  tickRate: number,
  fps: number,
): number {
  const durationTicks =
    endTick -
    startTick;

  const durationSeconds =
    durationTicks /
    tickRate;

  /*
   * The render range is [startTick, endTick).
   *
   * ceil() ensures that a positive duration always produces
   * at least one presentation frame.
   */
  const count =
    Math.ceil(
      durationSeconds *
      fps,
    );

  return Math.max(
    1,
    count,
  );
}

function tickForFrame(
  frameIndex: number,
  startTick: number,
  tickRate: number,
  fps: number,
): number {
  const exactTick =
    startTick +
    (
      frameIndex *
      tickRate
    ) /
      fps;

  return Math.round(
    exactTick,
  );
}

/* -------------------------------------------------------------------------- */
/* FFmpeg Runner                                                              */
/* -------------------------------------------------------------------------- */

function runProcess(
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

      let stderr =
        "";

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
            MAX_TEMP_ERROR_LENGTH
          ) {
            stderr =
              stderr.slice(
                -MAX_TEMP_ERROR_LENGTH,
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
              `FFmpeg exited with code ${String(code)}.`,
            ),
          );
        },
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Video Engine                                                               */
/* -------------------------------------------------------------------------- */

export class VideoEngine {
  readonly version =
    VIDEO_ENGINE_VERSION;

  constructor(
    private readonly renderer =
      new SvgRenderer(),

    private readonly evaluator =
      new FrameEvaluator(),
  ) {}

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validateOptions(
    options: VideoOptions,
  ): VideoOptions {
    if (
      !isRecord(options)
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        "Video options must be an object.",
      );
    }

    const ffmpeg =
      requireNonEmptyString(
        options.ffmpeg,
        "FFmpeg executable path",
      );

    const output =
      requireNonEmptyString(
        options.output,
        "Video output path",
      );

    const width =
      requirePositiveInteger(
        options.width,
        "Video width",
      );

    const height =
      requirePositiveInteger(
        options.height,
        "Video height",
      );

    assertDimension(
      width,
      "Video width",
    );

    assertDimension(
      height,
      "Video height",
    );

    const fps =
      requirePositiveFinite(
        options.fps,
        "Video FPS",
      );

    assertFps(
      fps,
    );

    const tickRate =
      requirePositiveFinite(
        options.tickRate,
        "Video tickRate",
      );

    const startTick =
      requireFiniteNumber(
        options.startTick,
        "Video startTick",
      );

    const endTick =
      requireFiniteNumber(
        options.endTick,
        "Video endTick",
      );

    if (
      endTick <=
      startTick
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        "Video endTick must be greater than startTick.",
      );
    }

    return {
      ffmpeg,

      output:
        resolve(
          output,
        ),

      width,
      height,

      fps,

      startTick,
      endTick,

      tickRate,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Render MP4                                                               */
  /* ------------------------------------------------------------------------ */

  async renderMp4(
    project: unknown,
    revisionId: string,
    options: VideoOptions,
  ): Promise<VideoRenderResult> {
    const normalized =
      this.validateOptions(
        options,
      );

    if (
      project === null ||
      project === undefined
    ) {
      throw new CaeError(
         "RENDER_FAILED",
        "Project is required for video rendering.",
      );
    }

    const normalizedRevisionId =
      requireNonEmptyString(
        revisionId,
        "Revision ID",
      );

    const outputDirectory =
      dirname(
        normalized.output,
      );

    await mkdir(
      outputDirectory,
      {
        recursive:
          true,
      },
    );

    /*
     * A dedicated temporary directory is created for every render.
     *
     * This prevents concurrent renders from sharing frame files.
     */
    const tempRoot =
      join(
        process.cwd(),
        "tmp",
      );

    await mkdir(
      tempRoot,
      {
        recursive:
          true,
      },
    );

    const frameDirectory =
      await mkdtemp(
        join(
          tempRoot,
          "video-frames-",
        ),
      );

    const frameCount =
      calculateFrameCount(
        normalized.startTick,
        normalized.endTick,
        normalized.tickRate,
        normalized.fps,
      );

    try {
      /* -------------------------------------------------------------------- */
      /* Deterministic frame generation                                      */
      /* -------------------------------------------------------------------- */

      for (
        let frameIndex = 0;
        frameIndex <
        frameCount;
        frameIndex += 1
      ) {
        const tick =
          tickForFrame(
            frameIndex,
            normalized.startTick,
            normalized.tickRate,
            normalized.fps,
          );

        const state =
          this.evaluator.evaluate(
            {
              project:
                clone(project),

              revisionId:
                normalizedRevisionId,

              tick,
            },
          );

        const filename =
          `frame-${String(
            frameIndex,
          ).padStart(
            8,
            "0",
          )}.svg`;

        await this.renderer.writeFrame(
          state,
          {
            width:
              normalized.width,

            height:
              normalized.height,

            transparent:
              false,

            includeMetadata:
              false,
          },
          frameDirectory,
          filename,
        );
      }

      /* -------------------------------------------------------------------- */
      /* FFmpeg encoding                                                       */
      /* -------------------------------------------------------------------- */

      const inputPattern =
        join(
          frameDirectory,
          "frame-%08d.svg",
        );

      await runProcess(
        normalized.ffmpeg,
        [
          "-hide_banner",

          "-loglevel",
          "error",

          "-y",

          "-framerate",
          String(
            normalized.fps,
          ),

          "-start_number",
          "0",

          "-i",
          inputPattern,

          "-an",

          "-c:v",
          "libx264",

          "-preset",
          "medium",

          "-crf",
          "18",

          "-pix_fmt",
          "yuv420p",

          "-movflags",
          "+faststart",

          normalized.output,
        ],
      );

      return {
        path:
          normalized.output,

        width:
          normalized.width,

        height:
          normalized.height,

        fps:
          normalized.fps,

        frameCount,

        startTick:
          normalized.startTick,

        endTick:
          normalized.endTick,

        tickRate:
          normalized.tickRate,

        renderer:
          "svg-ffmpeg",

        version:
          VIDEO_ENGINE_VERSION,
      };
    } catch (
      error
    ) {
      if (
        error instanceof CaeError
      ) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new CaeError(
        "RENDER_FAILED",
        message,
      );
    } finally {
      /*
       * Temporary SVG frames must never remain after the job finishes.
       */
      await rm(
        frameDirectory,
        {
          recursive:
            true,

          force:
            true,
        },
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createVideoEngine(): VideoEngine {
  return new VideoEngine();
}