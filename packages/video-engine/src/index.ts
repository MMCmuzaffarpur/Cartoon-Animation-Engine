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

const VIDEO_ENGINE_VERSION = "1.0.0" as const;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;
const DEFAULT_TICK_RATE = 1000;

const MIN_FPS = 1;
const MAX_FPS = 120;

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 16_384;

const MAX_TEMP_ERROR_LENGTH = 32_768;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function finiteNumber(
  value: unknown,
  fallback: number,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : fallback;
}

function positiveInteger(
  value: unknown,
  fallback: number,
): number {
  const number =
    finiteNumber(
      value,
      fallback,
    );

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.floor(number);
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

function positiveFinite(
  value: unknown,
  fallback: number,
): number {
  const number =
    finiteNumber(
      value,
      fallback,
    );

  return number > 0
    ? number
    : fallback;
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
      const process =
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

      let stderr = "";

      process.stderr.on(
        "data",
        (chunk) => {
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

      process.on(
        "error",
        (error) => {
          rejectProcess(
            error,
          );
        },
      );

      process.on(
        "close",
        (code) => {
          if (
            code === 0
          ) {
            resolveProcess();
            return;
          }

          rejectProcess(
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
/* Frame Count                                                                */
/* -------------------------------------------------------------------------- */

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
   * A frame exists for each sampled presentation timestamp.
   *
   * ceil() guarantees that a non-zero duration cannot accidentally
   * produce zero frames.
   */
  return Math.max(
    1,
    Math.ceil(
      durationSeconds *
      fps,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Tick Calculation                                                            */
/* -------------------------------------------------------------------------- */

function tickForFrame(
  frameIndex: number,
  startTick: number,
  tickRate: number,
  fps: number,
): number {
  const tick =
    startTick +
    frameIndex *
      tickRate /
      fps;

  return Math.round(
    tick,
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
      !options ||
      typeof options !== "object"
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        "Video options must be an object.",
      );
    }

    if (
      typeof options.ffmpeg !== "string" ||
      options.ffmpeg.trim().length === 0
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        "FFmpeg executable path must not be empty.",
      );
    }

    if (
      typeof options.output !== "string" ||
      options.output.trim().length === 0
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        "Video output path must not be empty.",
      );
    }

    const width =
      positiveInteger(
        options.width,
        DEFAULT_WIDTH,
      );

    const height =
      positiveInteger(
        options.height,
        DEFAULT_HEIGHT,
      );

    if (
      width <
        MIN_DIMENSION ||
      width >
        MAX_DIMENSION
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        `Video width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}.`,
      );
    }

    if (
      height <
        MIN_DIMENSION ||
      height >
        MAX_DIMENSION
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        `Video height must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}.`,
      );
    }

    const fps =
      positiveFinite(
        options.fps,
        DEFAULT_FPS,
      );

    if (
      fps <
        MIN_FPS ||
      fps >
        MAX_FPS
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        `Video FPS must be between ${MIN_FPS} and ${MAX_FPS}.`,
      );
    }

    const tickRate =
      positiveFinite(
        options.tickRate,
        DEFAULT_TICK_RATE,
      );

    const startTick =
      finiteNumber(
        options.startTick,
        0,
      );

    const endTick =
      finiteNumber(
        options.endTick,
        0,
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
      ffmpeg:
        options.ffmpeg.trim(),

      output:
        resolve(
          options.output,
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
    project: any,
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

    if (
      typeof revisionId !== "string" ||
      revisionId.trim().length === 0
    ) {
      throw new CaeError(
        "RENDER_FAILED",
        "Revision ID is required for video rendering.",
      );
    }

    const outputDirectory =
      dirname(
        normalized.output,
      );

    await mkdir(
      outputDirectory,
      {
        recursive: true,
      },
    );

    /*
     * mkdtemp() gives us a unique temporary directory.
     *
     * This is safer than Date.now() because two render jobs can start
     * within the same millisecond.
     */
    const tempRoot =
      join(
        process.cwd(),
        "tmp",
      );

    await mkdir(
      tempRoot,
      {
        recursive: true,
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
      /* Generate deterministic frames                                       */
      /* -------------------------------------------------------------------- */

      for (
        let frameIndex = 0;
        frameIndex < frameCount;
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
              project,
              revisionId:
                revisionId.trim(),
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
      /* Encode frames with FFmpeg                                            */
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
    } catch (error) {
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
       * Cleanup happens whether frame generation or FFmpeg fails.
       */
      await rm(
        frameDirectory,
        {
          recursive: true,
          force: true,
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
