import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  AudioRenderEngine,
  createAudioRenderEngine,
  type AudioRenderOptions,
} from "../packages/audio-engine/src/render.js";

import type {
  AudioMixIntent,
} from "../packages/audio-engine/src/index.js";

/* -------------------------------------------------------------------------- */
/* Test Helpers                                                               */
/* -------------------------------------------------------------------------- */

function createIntent(
  tracks: AudioMixIntent["tracks"] = [],
): AudioMixIntent {
  return {
    sampleRate: 48_000,
    channels: 2,
    normalization: "peak",
    tracks,
  };
}

function createTrack(
  overrides: Partial<
    AudioMixIntent["tracks"][number]
  > = {},
): AudioMixIntent["tracks"][number] {
  return {
    id: "track-1",
    assetId: "voice-1",
    startTick: 0,
    endTick: 5000,
    volume: 1,
    pan: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    ...overrides,
  };
}

function createOptions(
  overrides: Partial<AudioRenderOptions> = {},
): AudioRenderOptions {
  return {
    ffmpeg: "ffmpeg",
    output: "./output/audio.wav",

    startTick: 0,
    endTick: 5000,

    tickRate: 1000,

    sampleRate: 48_000,
    channels: 2,

    normalization: "peak",

    assetResolver: async (
      assetId,
    ) => `./assets/${assetId}.wav`,

    ...overrides,
  };
}

/**
 * The audio renderer intentionally keeps the process runner as an internal
 * implementation seam. Tests need to replace that seam without weakening
 * the production type surface or using `any`.
 */
type AudioProcessRunner = {
  runProcess(
    executable: string,
    args: readonly string[],
  ): Promise<void>;
};

function processRunner(
  engine: AudioRenderEngine,
): AudioProcessRunner {
  return engine as unknown as AudioProcessRunner;
}

/* -------------------------------------------------------------------------- */
/* Suite                                                                      */
/* -------------------------------------------------------------------------- */

describe("audio-render-engine", () => {
  let engine: AudioRenderEngine;

  beforeEach(() => {
    engine = createAudioRenderEngine();
  });

  /* ------------------------------------------------------------------------ */
  /* Factory                                                                  */
  /* ------------------------------------------------------------------------ */

  it("creates an AudioRenderEngine", () => {
    expect(engine).toBeInstanceOf(
      AudioRenderEngine,
    );

    expect(engine.version).toBe("1.0.0");
  });

  /* ------------------------------------------------------------------------ */
  /* Option Validation                                                        */
  /* ------------------------------------------------------------------------ */

  it("accepts valid render options", () => {
    const result =
      engine.validateOptions(
        createOptions(),
      );

    expect(result.ffmpeg).toBe("ffmpeg");

    expect(result.output).toMatch(
      /output[\\/]+audio\.wav$/,
    );

    expect(result.startTick).toBe(0);
    expect(result.endTick).toBe(5000);
    expect(result.tickRate).toBe(1000);
    expect(result.sampleRate).toBe(48_000);
    expect(result.channels).toBe(2);
  });

  it("normalizes output path to an absolute path", () => {
    const result =
      engine.validateOptions(
        createOptions({
          output: "./somewhere/audio.wav",
        }),
      );

    expect(result.output).toMatch(
      /^[A-Za-z]:[\\/]|^\//,
    );
  });

  it("rejects non-object options", () => {
    expect(() =>
      engine.validateOptions(
        null as never,
      ),
    ).toThrow(
      "Audio render options must be an object.",
    );
  });

  it("rejects an empty FFmpeg path", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          ffmpeg: "   ",
        }),
      ),
    ).toThrow(
      "FFmpeg executable path must be a non-empty string.",
    );
  });

  it("rejects an empty output path", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          output: "   ",
        }),
      ),
    ).toThrow(
      "Audio output path must be a non-empty string.",
    );
  });

  it("rejects an invalid render range", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          startTick: 5000,
          endTick: 5000,
        }),
      ),
    ).toThrow(
      "Audio endTick must be greater than startTick.",
    );
  });

  it("rejects a non-finite tickRate", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          tickRate: Number.NaN,
        }),
      ),
    ).toThrow(
      "Audio tickRate must be a finite number.",
    );
  });

  it("rejects zero tickRate", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          tickRate: 0,
        }),
      ),
    ).toThrow(
      "Audio tickRate must be greater than zero.",
    );
  });

  it("rejects invalid sample rate", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          sampleRate: 100,
        }),
      ),
    ).toThrow(
      "Audio sampleRate must be between 8000 and 192000.",
    );
  });

  it("rejects invalid channel count", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          channels: 0,
        }),
      ),
    ).toThrow(
      "Audio channels must be between 1 and 8.",
    );
  });

  it("rejects unsupported normalization mode", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          normalization: "invalid" as never,
        }),
      ),
    ).toThrow(
      'Unsupported audio normalization "invalid".',
    );
  });

  it("rejects a missing asset resolver", () => {
    expect(() =>
      engine.validateOptions(
        createOptions({
          assetResolver: undefined as never,
        }),
      ),
    ).toThrow(
      "Audio assetResolver must be a function.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Empty Mix                                                                */
  /* ------------------------------------------------------------------------ */

  it("builds a deterministic silence plan for an empty mix", async () => {
    const plan =
      await engine.buildPlan(
        createIntent(),
        createOptions(),
      );

    expect(plan.tracks).toEqual([]);

    expect(plan.sampleRate).toBe(48_000);

    expect(plan.channels).toBe(2);

    expect(plan.outputLabel).toBe(
      "[audio_mix]",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "anullsrc",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "r=48000",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "stereo",
    );

    expect(plan.args).toContain("-f");

    expect(plan.args).toContain("lavfi");
  });

  /* ------------------------------------------------------------------------ */
  /* Asset Resolution                                                         */
  /* ------------------------------------------------------------------------ */

  it("resolves audio assets through the supplied resolver", async () => {
    const resolver =
      vi.fn(
        async (
          assetId: string,
        ) => `C:/audio/${assetId}.wav`,
      );

    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack(),
        ]),
        createOptions({
          assetResolver: resolver,
        }),
      );

    expect(
      resolver,
    ).toHaveBeenCalledTimes(1);

    expect(
      resolver,
    ).toHaveBeenCalledWith(
      "voice-1",
    );

    expect(
      plan.tracks[0].path,
    ).toMatch(
      /voice-1\.wav$/,
    );
  });

  it("rejects an unresolved audio asset", async () => {
    await expect(
      engine.buildPlan(
        createIntent([
          createTrack(),
        ]),
        createOptions({
          assetResolver: async () => null,
        }),
      ),
    ).rejects.toThrow(
      'Unable to resolve audio asset "voice-1".',
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Timeline                                                                 */
  /* ------------------------------------------------------------------------ */

  it("converts ticks into seconds correctly", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            startTick: 1000,
            endTick: 6000,
          }),
        ]),
        createOptions({
          startTick: 0,
          endTick: 6000,
          tickRate: 1000,
        }),
      );

    expect(
      plan.tracks[0].durationSeconds,
    ).toBe(5);

    expect(
      plan.tracks[0].delayMilliseconds,
    ).toBe(1000);
  });

  it("clips tracks to the requested render range", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            startTick: 0,
            endTick: 10_000,
          }),
        ]),
        createOptions({
          startTick: 2000,
          endTick: 7000,
          tickRate: 1000,
        }),
      );

    expect(
      plan.tracks[0].startTick,
    ).toBe(2000);

    expect(
      plan.tracks[0].endTick,
    ).toBe(7000);

    expect(
      plan.tracks[0].durationSeconds,
    ).toBe(5);

    expect(
      plan.tracks[0].delayMilliseconds,
    ).toBe(0);
  });

  it("ignores tracks completely outside the render range", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            startTick: 10_000,
            endTick: 20_000,
          }),
        ]),
        createOptions({
          startTick: 0,
          endTick: 5000,
        }),
      );

    expect(plan.tracks).toEqual([]);
  });

  /* ------------------------------------------------------------------------ */
  /* Volume / Pan                                                             */
  /* ------------------------------------------------------------------------ */

  it("preserves volume in the render plan", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            volume: 1.5,
          }),
        ]),
        createOptions(),
      );

    expect(
      plan.tracks[0].volume,
    ).toBe(1.5);

    expect(
      plan.filterComplex,
    ).toContain(
      "volume=1.5",
    );
  });

  it("clamps volume to the supported range", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            volume: 50,
          }),
        ]),
        createOptions(),
      );

    expect(
      plan.tracks[0].volume,
    ).toBe(2);
  });

  it("preserves center pan", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            pan: 0,
          }),
        ]),
        createOptions(),
      );

    expect(
      plan.tracks[0].pan,
    ).toBe(0);

    expect(
      plan.filterComplex,
    ).toContain(
      "pan=stereo",
    );
  });

  it("clamps pan to -1..1", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            pan: 10,
          }),
        ]),
        createOptions(),
      );

    expect(
      plan.tracks[0].pan,
    ).toBe(1);
  });

  /* ------------------------------------------------------------------------ */
  /* Fade                                                                     */
  /* ------------------------------------------------------------------------ */

  it("converts fade-in ticks into seconds", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            fadeInTicks: 1000,
          }),
        ]),
        createOptions({
          tickRate: 1000,
        }),
      );

    expect(
      plan.tracks[0].fadeInSeconds,
    ).toBe(1);

    expect(
      plan.filterComplex,
    ).toContain(
      "afade=t=in:st=0:d=1",
    );
  });

  it("converts fade-out ticks into seconds", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            fadeOutTicks: 2000,
          }),
        ]),
        createOptions({
          tickRate: 1000,
        }),
      );

    expect(
      plan.tracks[0].fadeOutSeconds,
    ).toBe(2);

    expect(
      plan.filterComplex,
    ).toContain(
      "afade=t=out",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "d=2",
    );
  });

  it("clamps fades to the rendered clip duration", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            startTick: 0,
            endTick: 1000,
            fadeInTicks: 5000,
            fadeOutTicks: 5000,
          }),
        ]),
        createOptions({
          startTick: 0,
          endTick: 1000,
          tickRate: 1000,
        }),
      );

    expect(
      plan.tracks[0].fadeInSeconds,
    ).toBe(1);

    expect(
      plan.tracks[0].fadeOutSeconds,
    ).toBe(1);
  });

  /* ------------------------------------------------------------------------ */
  /* Multiple Tracks                                                          */
  /* ------------------------------------------------------------------------ */

  it("builds multiple independent audio inputs", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            id: "voice",
            assetId: "voice",
          }),

          createTrack({
            id: "music",
            assetId: "music",
            startTick: 500,
            endTick: 5000,
            volume: 0.4,
          }),
        ]),
        createOptions(),
      );

    expect(
      plan.tracks,
    ).toHaveLength(2);

    expect(
      plan.filterComplex,
    ).toContain(
      "[0:a]",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "[1:a]",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "amix=inputs=2",
    );
  });

  it("sorts tracks deterministically", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            id: "z",
            startTick: 0,
            endTick: 1000,
          }),

          createTrack({
            id: "a",
            startTick: 0,
            endTick: 1000,
          }),

          createTrack({
            id: "m",
            startTick: 0,
            endTick: 2000,
          }),
        ]),
        createOptions(),
      );

    expect(
      plan.tracks.map(
        (track) => track.id,
      ),
    ).toEqual([
      "a",
      "z",
      "m",
    ]);
  });

  it("uses deterministic track ordering for identical timelines", async () => {
    const intent =
      createIntent([
        createTrack({
          id: "b",
        }),

        createTrack({
          id: "a",
        }),
      ]);

    const first =
      await engine.buildPlan(
        intent,
        createOptions(),
      );

    const second =
      await engine.buildPlan(
        intent,
        createOptions(),
      );

    expect(first.tracks).toEqual(
      second.tracks,
    );

    expect(first.filterComplex).toBe(
      second.filterComplex,
    );

    expect(first.args).toEqual(
      second.args,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Null Asset Tracks                                                        */
  /* ------------------------------------------------------------------------ */

  it("does not render null asset tracks", async () => {
    const resolver =
      vi.fn(
        async () => "unused.wav",
      );

    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            assetId: null,
          }),
        ]),
        createOptions({
          assetResolver: resolver,
        }),
      );

    expect(plan.tracks).toEqual([]);

    expect(
      resolver,
    ).not.toHaveBeenCalled();

    expect(
      plan.filterComplex,
    ).toContain(
      "anullsrc",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* FFmpeg Arguments                                                         */
  /* ------------------------------------------------------------------------ */

  it("creates valid WAV FFmpeg arguments", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack(),
        ]),
        createOptions({
          output: "./output/test.wav",
        }),
      );

    expect(
      plan.args,
    ).toContain(
      "-filter_complex",
    );

    expect(
      plan.args,
    ).toContain(
      "-map",
    );

    expect(
      plan.args,
    ).toContain(
      "[audio_mix]",
    );

    expect(
      plan.args,
    ).toContain(
      "-ar",
    );

    expect(
      plan.args,
    ).toContain(
      "48000",
    );

    expect(
      plan.args,
    ).toContain(
      "-ac",
    );

    expect(
      plan.args,
    ).toContain(
      "2",
    );

    expect(
      plan.args,
    ).toContain(
      "-c:a",
    );

    expect(
      plan.args,
    ).toContain(
      "pcm_s16le",
    );

    expect(
      plan.args[
        plan.args.length - 1
      ],
    ).toMatch(
      /test\.wav$/,
    );
  });

  it("uses stereo audio format for two-channel output", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack(),
        ]),
        createOptions({
          channels: 2,
        }),
      );

    expect(
      plan.filterComplex,
    ).toContain(
      "channel_layouts=stereo",
    );
  });

  it("uses mono audio format for one-channel output", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack(),
        ]),
        createOptions({
          channels: 1,
        }),
      );

    expect(
      plan.filterComplex,
    ).toContain(
      "channel_layouts=mono",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  it("renders using the supplied FFmpeg process", async () => {
    const runner =
      processRunner(engine);

    const runProcess =
      vi
        .spyOn(
          runner,
          "runProcess",
        )
        .mockResolvedValue(
          undefined,
        );

    const result =
      await engine.renderWav(
        createIntent(),
        createOptions({
          ffmpeg: "ffmpeg",
          output:
            "./output/test-audio.wav",
        }),
      );

    expect(
      runProcess,
    ).toHaveBeenCalledTimes(1);

    const call =
      runProcess.mock.calls[0];

    expect(call[0]).toBe(
      "ffmpeg",
    );

    expect(
      call[1],
    ).toContain(
      "-hide_banner",
    );

    expect(
      call[1],
    ).toContain(
      "-loglevel",
    );

    expect(
      call[1],
    ).toContain(
      "error",
    );

    expect(
      call[1],
    ).toContain(
      "-filter_complex",
    );

    expect(
      call[1],
    ).toContain(
      "[audio_mix]",
    );

    expect(
      call[1],
    ).toContain(
      "pcm_s16le",
    );

    expect(
      result.path,
    ).toMatch(
      /test-audio\.wav$/,
    );

    expect(
      result.renderer,
    ).toBe(
      "ffmpeg-audio-mix",
    );

    expect(
      result.version,
    ).toBe("1.0.0");

    expect(
      result.sampleRate,
    ).toBe(48_000);

    expect(
      result.channels,
    ).toBe(2);

    expect(
      result.trackCount,
    ).toBe(0);

    expect(
      result.renderedTrackCount,
    ).toBe(0);

    runProcess.mockRestore();
  });

  it("reports the requested timeline duration", async () => {
    const runner =
      processRunner(engine);

    const runProcess =
      vi
        .spyOn(
          runner,
          "runProcess",
        )
        .mockResolvedValue(
          undefined,
        );

    const result =
      await engine.renderWav(
        createIntent(),
        createOptions({
          ffmpeg: "ffmpeg",
          output:
            "./output/duration-test.wav",
          startTick: 0,
          endTick: 3000,
          tickRate: 1000,
        }),
      );

    expect(
      runProcess,
    ).toHaveBeenCalledTimes(1);

    expect(
      result.durationSeconds,
    ).toBe(3);

    expect(
      result.startTick,
    ).toBe(0);

    expect(
      result.endTick,
    ).toBe(3000);

    expect(
      result.tickRate,
    ).toBe(1000);

    runProcess.mockRestore();
  });

  /* ------------------------------------------------------------------------ */
  /* Error Handling                                                           */
  /* ------------------------------------------------------------------------ */

  it("wraps FFmpeg process failures", async () => {
    const runner =
      processRunner(engine);

    vi
      .spyOn(
        runner,
        "runProcess",
      )
      .mockRejectedValue(
        new Error("FFmpeg failed"),
      );

    await expect(
      engine.renderWav(
        createIntent(),
        createOptions({
          ffmpeg: "ffmpeg",
        }),
      ),
    ).rejects.toThrow(
      "FFmpeg failed",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Plan Contract                                                            */
  /* ------------------------------------------------------------------------ */

  it("keeps render plan output path absolute", async () => {
    const plan =
      await engine.buildPlan(
        createIntent(),
        createOptions({
          output:
            "./relative/output.wav",
        }),
      );

    expect(
      plan.output,
    ).toMatch(
      /^[A-Za-z]:[\\/]|^\//,
    );
  });

  it("keeps source asset paths absolute in the plan", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack(),
        ]),
        createOptions({
          assetResolver:
            async () =>
              "./assets/voice.wav",
        }),
      );

    expect(
      plan.tracks[0].path,
    ).toMatch(
      /^[A-Za-z]:[\\/]|^\//,
    );
  });

  it("keeps render options immutable", async () => {
    const options =
      createOptions();

    const before = {
      ffmpeg: options.ffmpeg,
      output: options.output,
      startTick: options.startTick,
      endTick: options.endTick,
      tickRate: options.tickRate,
      sampleRate: options.sampleRate,
      channels: options.channels,
      normalization:
        options.normalization,
      assetResolver:
        options.assetResolver,
    };

    await engine.buildPlan(
      createIntent([
        createTrack(),
      ]),
      options,
    );

    expect(options.ffmpeg).toBe(
      before.ffmpeg,
    );

    expect(options.output).toBe(
      before.output,
    );

    expect(options.startTick).toBe(
      before.startTick,
    );

    expect(options.endTick).toBe(
      before.endTick,
    );

    expect(options.tickRate).toBe(
      before.tickRate,
    );

    expect(options.sampleRate).toBe(
      before.sampleRate,
    );

    expect(options.channels).toBe(
      before.channels,
    );

    expect(
      options.normalization,
    ).toBe(
      before.normalization,
    );

    expect(
      options.assetResolver,
    ).toBe(
      before.assetResolver,
    );
  });

  it("keeps the source intent immutable", async () => {
    const intent =
      createIntent([
        createTrack(),
      ]);

    const before =
      structuredClone(
        intent,
      );

    await engine.buildPlan(
      intent,
      createOptions(),
    );

    expect(intent).toEqual(
      before,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Complete Track Plan                                                      */
  /* ------------------------------------------------------------------------ */

  it("creates a complete voice track render plan", async () => {
    const plan =
      await engine.buildPlan(
        createIntent([
          createTrack({
            id: "dialogue",
            assetId:
              "dialogue-hindi",
            startTick: 500,
            endTick: 5500,
            volume: 1.2,
            pan: -0.25,
            fadeInTicks: 250,
            fadeOutTicks: 500,
          }),
        ]),
        createOptions({
          tickRate: 1000,
        }),
      );

    expect(
      plan.tracks[0],
    ).toMatchObject({
      id: "dialogue",
      assetId:
        "dialogue-hindi",

      /*
       * Render window is 0..5000.
       * Source track is 500..5500.
       * Therefore it is clipped to 500..5000.
       */
      startTick: 500,
      endTick: 5000,
      durationSeconds: 4.5,

      delayMilliseconds: 500,

      volume: 1.2,
      pan: -0.25,

      fadeInSeconds: 0.25,
      fadeOutSeconds: 0.5,
    });

    expect(
      plan.filterComplex,
    ).toContain(
      "[0:a]",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "volume=1.2",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "pan=stereo",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "afade=t=in",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "afade=t=out",
    );

    expect(
      plan.filterComplex,
    ).toContain(
      "adelay=500|500",
    );
  });
});