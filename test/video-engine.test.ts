import { describe, expect, it } from "vitest";

import { CaeError } from "../packages/domain/src/index.js";

import {
  VideoEngine,
  createVideoEngine,
  type VideoOptions,
} from "../packages/video-engine/src/index.js";

type AnyRecord = Record<string, unknown>;

const makeEngine = (): VideoEngine => createVideoEngine();

const validOptions = (
  overrides: Partial<VideoOptions> = {},
): VideoOptions => ({
  ffmpeg: "ffmpeg",
  output: "./output/test.mp4",
  width: 1280,
  height: 720,
  fps: 30,
  startTick: 0,
  endTick: 1000,
  tickRate: 1000,
  ...overrides,
});

function expectRenderFailed(
  callback: () => unknown,
  message: string,
): void {
  expect(callback).toThrow(CaeError);
  expect(callback).toThrow(message);
}

describe("video-engine", () => {
  it("creates a VideoEngine", () => {
    const engine = makeEngine();
    expect(engine).toBeInstanceOf(VideoEngine);
    expect(engine.version).toBe("1.0.0");
  });

  it("accepts valid video options", () => {
    const engine = makeEngine();
    const result = engine.validateOptions(validOptions());

    expect(result.ffmpeg).toBe("ffmpeg");
    expect(result.output).toMatch(/output[\\/]test\.mp4$/);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.fps).toBe(30);
    expect(result.startTick).toBe(0);
    expect(result.endTick).toBe(1000);
    expect(result.tickRate).toBe(1000);
  });

  it("normalizes output to an absolute path", () => {
    const result = makeEngine().validateOptions(
      validOptions({ output: "./relative/video.mp4" }),
    );
    expect(result.output).toMatch(/^[A-Za-z]:[\\/]|^\//);
  });

  it("rejects non-object options", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () => engine.validateOptions(null as never),
      "Video options must be an object.",
    );
    expectRenderFailed(
      () => engine.validateOptions("invalid" as never),
      "Video options must be an object.",
    );
    expectRenderFailed(
      () => engine.validateOptions([] as never),
      "Video options must be an object.",
    );
  });

  it("rejects empty FFmpeg and output paths", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () => engine.validateOptions(validOptions({ ffmpeg: "   " })),
      "FFmpeg executable path must be a non-empty string.",
    );

    expectRenderFailed(
      () => engine.validateOptions(validOptions({ output: "   " })),
      "Video output path must be a non-empty string.",
    );
  });

  it("rejects invalid dimensions", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () => engine.validateOptions(validOptions({ width: 0 })),
      "Video width must be greater than zero.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ width: 1.5 })),
      "Video width must be an integer.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ width: 16385 })),
      "Video width must be between 1 and 16384.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ height: 0 })),
      "Video height must be greater than zero.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ height: 720.5 })),
      "Video height must be an integer.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ height: 16385 })),
      "Video height must be between 1 and 16384.",
    );
  });

  it("accepts dimension boundaries", () => {
    const result = makeEngine().validateOptions(
      validOptions({ width: 1, height: 16384 }),
    );
    expect(result.width).toBe(1);
    expect(result.height).toBe(16384);
  });

  it("rejects non-finite dimensions", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () => engine.validateOptions(validOptions({ width: Number.NaN })),
      "Video width must be a finite number.",
    );
    expectRenderFailed(
      () =>
        engine.validateOptions(
          validOptions({ height: Number.POSITIVE_INFINITY }),
        ),
      "Video height must be a finite number.",
    );
  });

  it("accepts FPS boundaries", () => {
    const engine = makeEngine();
    expect(engine.validateOptions(validOptions({ fps: 1 })).fps).toBe(1);
    expect(engine.validateOptions(validOptions({ fps: 120 })).fps).toBe(120);
  });

  it("rejects invalid FPS", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () => engine.validateOptions(validOptions({ fps: 0 })),
      "Video FPS must be greater than zero.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ fps: 121 })),
      "Video FPS must be between 1 and 120.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ fps: Number.NaN })),
      "Video FPS must be a finite number.",
    );
  });

  it("rejects invalid tickRate", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () => engine.validateOptions(validOptions({ tickRate: 0 })),
      "Video tickRate must be greater than zero.",
    );
    expectRenderFailed(
      () => engine.validateOptions(validOptions({ tickRate: Number.NaN })),
      "Video tickRate must be a finite number.",
    );
  });

  it("accepts finite timeline ticks", () => {
    const result = makeEngine().validateOptions(
      validOptions({ startTick: 10.5, endTick: 20.5 }),
    );
    expect(result.startTick).toBe(10.5);
    expect(result.endTick).toBe(20.5);
  });

  it("rejects non-finite timeline ticks", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () =>
        engine.validateOptions(
          validOptions({ startTick: Number.NaN }),
        ),
      "Video startTick must be a finite number.",
    );

    expectRenderFailed(
      () =>
        engine.validateOptions(
          validOptions({ endTick: Number.POSITIVE_INFINITY }),
        ),
      "Video endTick must be a finite number.",
    );
  });

  it("rejects an invalid render range", () => {
    const engine = makeEngine();

    expectRenderFailed(
      () =>
        engine.validateOptions(
          validOptions({ startTick: 100, endTick: 100 }),
        ),
      "Video endTick must be greater than startTick.",
    );

    expectRenderFailed(
      () =>
        engine.validateOptions(
          validOptions({ startTick: 101, endTick: 100 }),
        ),
      "Video endTick must be greater than startTick.",
    );
  });

  it("rejects a missing project", async () => {
    const engine = makeEngine();

    await expect(
      engine.renderMp4(null, "revision-1", validOptions()),
    ).rejects.toThrow(
      "Project is required for video rendering.",
    );

    await expect(
      engine.renderMp4(undefined, "revision-1", validOptions()),
    ).rejects.toThrow(
      "Project is required for video rendering.",
    );
  });

  it("rejects an empty revision ID", async () => {
    const engine = makeEngine();

    await expect(
      engine.renderMp4({}, "   ", validOptions()),
    ).rejects.toThrow(
      "Revision ID must be a non-empty string.",
    );

    await expect(
      engine.renderMp4({}, null as never, validOptions()),
    ).rejects.toThrow(
      "Revision ID must be a non-empty string.",
    );
  });

  it("uses the injected evaluator and renderer", async () => {
    const calls: AnyRecord[] = [];
    const renderedFiles: string[] = [];

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        calls.push(structuredClone(input));
        return { tick: input.tick, values: { test: 1 } };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        renderedFiles.push(filename);
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          `<svg data-tick="${String(state.tick)}"></svg>`,
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        { entities: [] },
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          startTick: 0,
          endTick: 100,
          tickRate: 1000,
          fps: 10,
        }),
      ),
    ).rejects.toThrow(CaeError);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      revisionId: "revision-1",
      tick: 0,
      project: { entities: [] },
    });
    expect(renderedFiles).toEqual(["frame-00000000.svg"]);
  });

  it("generates expected frame ticks", async () => {
    const ticks: number[] = [];

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        ticks.push(Number(input.tick));
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        {},
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          startTick: 0,
          endTick: 250,
          tickRate: 1000,
          fps: 10,
        }),
      ),
    ).rejects.toThrow(CaeError);

    expect(ticks).toEqual([0, 100, 200]);
  });

  it("renders at least one frame for a sub-frame duration", async () => {
    const ticks: number[] = [];

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        ticks.push(Number(input.tick));
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        {},
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          startTick: 500,
          endTick: 500.1,
          tickRate: 1000,
          fps: 30,
        }),
      ),
    ).rejects.toThrow(CaeError);

    expect(ticks).toEqual([500]);
  });

  it("passes fixed renderer options", async () => {
    const rendererOptions: AnyRecord[] = [];

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        rendererOptions.push(structuredClone(options));
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        {},
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          width: 1920,
          height: 1080,
          fps: 24,
          endTick: 50,
        }),
      ),
    ).rejects.toThrow(CaeError);

    expect(rendererOptions).toHaveLength(2);

    expect(rendererOptions).toEqual([
      {
        width: 1920,
        height: 1080,
        transparent: false,
        includeMetadata: false,
      },
      {
        width: 1920,
        height: 1080,
        transparent: false,
        includeMetadata: false,
      },
    ]);
  });

  it("creates zero-padded sequential frame filenames", async () => {
    const filenames: string[] = [];

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        filenames.push(filename);
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        {},
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          startTick: 0,
          endTick: 1,
          tickRate: 1,
          fps: 5,
        }),
      ),
    ).rejects.toThrow(CaeError);

    expect(filenames).toEqual([
      "frame-00000000.svg",
      "frame-00000001.svg",
      "frame-00000002.svg",
      "frame-00000003.svg",
      "frame-00000004.svg",
    ]);
  });

  it("clones the project before evaluator calls", async () => {
    const receivedProjects: AnyRecord[] = [];

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        const project = input.project as AnyRecord;
        receivedProjects.push(project);
        project.changedByEvaluator = true;
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    const project = { name: "Episode" };

    await expect(
      engine.renderMp4(
        project,
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          startTick: 0,
          endTick: 2,
          tickRate: 1,
          fps: 1,
        }),
      ),
    ).rejects.toThrow(CaeError);

    expect(receivedProjects).toHaveLength(2);
    expect(project).toEqual({ name: "Episode" });
    expect(receivedProjects[0]).not.toBe(receivedProjects[1]);
  });

  it("wraps FFmpeg process errors as RENDER_FAILED CaeError", async () => {
    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          `${directory}/${filename}`,
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        {},
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          endTick: 100,
          fps: 10,
        }),
      ),
    ).rejects.toMatchObject({
      code: "RENDER_FAILED",
    });
  });

  it("cleans temporary frame directories after a failed render", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const fakeEvaluator = {
      evaluate(input: AnyRecord) {
        return { tick: input.tick, values: {} };
      },
    };

    const fakeRenderer = {
      async writeFrame(
        _state: AnyRecord,
        _options: AnyRecord,
        directory: string,
        filename: string,
      ) {
        await fs.writeFile(
          path.join(directory, filename),
          "<svg></svg>",
          "utf8",
        );
      },
    };

    const engine = new VideoEngine(
      fakeRenderer as never,
      fakeEvaluator as never,
    );

    await expect(
      engine.renderMp4(
        {},
        "revision-1",
        validOptions({
          ffmpeg: "__cae_missing_ffmpeg_for_test__",
          endTick: 100,
          fps: 10,
        }),
      ),
    ).rejects.toThrow(CaeError);

    const tmpRoot = path.join(
      process.cwd(),
      "tmp",
    );

    let entries: string[] = [];

    try {
      entries = await fs.readdir(tmpRoot);
    } catch {
      entries = [];
    }

    expect(
      entries.filter((entry) =>
        entry.startsWith("video-frames-"),
      ),
    ).toEqual([]);
  });

  it("keeps the result contract version and renderer identifiers", () => {
    const expected = {
      renderer: "svg-ffmpeg" as const,
      version: "1.0.0" as const,
    };

    expect(expected).toEqual({
      renderer: "svg-ffmpeg",
      version: "1.0.0",
    });
  });
});
