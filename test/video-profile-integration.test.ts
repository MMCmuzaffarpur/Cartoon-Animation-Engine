import {
  describe,
  expect,
  it,
} from "vitest";

import {
  VideoEngine,
} from "../packages/video-engine/src/index.js";

import {
  VIDEO_PROFILES,
  getVideoProfile,
  requireVideoProfile,
  createCustomVideoProfile,
} from "../packages/video-engine/src/profiles.js";

describe("video-profile-integration", () => {
  const engine =
    new VideoEngine();

  const baseOptions = {
    ffmpeg: "ffmpeg",
    output: "./tmp/test.mp4",
    startTick: 0,
    endTick: 10_000,
    tickRate: 1000,
  };

  /* ------------------------------------------------------------------------ */
  /* Built-in Profile Resolution                                              */
  /* ------------------------------------------------------------------------ */

  it("resolves YouTube profile through VideoEngine", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube",
      });

    expect(result.profile?.id).toBe(
      "youtube",
    );

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.fps).toBe(30);
  });

  it("resolves YouTube Shorts as portrait 9:16", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube-shorts",
      });

    expect(result.profile?.id).toBe(
      "youtube-shorts",
    );

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.fps).toBe(30);

    expect(
      result.profile?.orientation,
    ).toBe("portrait");

    expect(
      result.profile?.aspectRatio,
    ).toBe("9:16");
  });

  it("resolves Facebook Reel as portrait 9:16", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "facebook-reel",
      });

    expect(result.profile?.id).toBe(
      "facebook-reel",
    );

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.fps).toBe(30);
  });

  it("resolves Instagram Reel as portrait 9:16", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "instagram-reel",
      });

    expect(result.profile?.id).toBe(
      "instagram-reel",
    );

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.fps).toBe(30);
  });

  it("resolves Square Social as 1:1", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "square-social",
      });

    expect(result.profile?.id).toBe(
      "square-social",
    );

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
    expect(result.fps).toBe(30);

    expect(
      result.profile?.orientation,
    ).toBe("square");

    expect(
      result.profile?.aspectRatio,
    ).toBe("1:1");
  });

  /* ------------------------------------------------------------------------ */
  /* Profile Authority                                                        */
  /* ------------------------------------------------------------------------ */

  it("profile dimensions override manual dimensions", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,

        profile: "youtube-shorts",

        width: 1920,
        height: 1080,
        fps: 60,
      });

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.fps).toBe(30);
  });

  it("YouTube profile overrides portrait manual dimensions", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,

        profile: "youtube",

        width: 1080,
        height: 1920,
        fps: 60,
      });

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.fps).toBe(30);
  });

  it("profile codec remains libx264", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube-shorts",
      });

    expect(
      result.profile?.videoCodec,
    ).toBe("libx264");
  });

  it("profile pixel format remains yuv420p", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube-shorts",
      });

    expect(
      result.profile?.pixelFormat,
    ).toBe("yuv420p");
  });

  it("profile audio codec is AAC", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube-shorts",
      });

    expect(
      result.profile?.audioCodec,
    ).toBe("aac");
  });

  it("profile audio settings are preserved", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube-shorts",
      });

    expect(
      result.profile?.audioSampleRate,
    ).toBe(48_000);

    expect(
      result.profile?.audioChannels,
    ).toBe(2);
  });

  /* ------------------------------------------------------------------------ */
  /* Legacy / Manual Mode                                                     */
  /* ------------------------------------------------------------------------ */

  it("keeps manual video options working without a profile", () => {
    const result =
      engine.validateOptions({
        ffmpeg: "ffmpeg",
        output: "./tmp/manual.mp4",

        width: 1280,
        height: 720,
        fps: 24,

        startTick: 0,
        endTick: 5000,
        tickRate: 1000,
      });

    expect(result.profile).toBeUndefined();

    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.fps).toBe(24);
  });

  it("uses engine defaults when manual dimensions are omitted", () => {
    const result =
      engine.validateOptions({
        ffmpeg: "ffmpeg",
        output: "./tmp/default.mp4",

        startTick: 0,
        endTick: 5000,
        tickRate: 1000,
      });

    expect(result.profile).toBeUndefined();

    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.fps).toBe(30);
  });

  /* ------------------------------------------------------------------------ */
  /* Invalid Profiles                                                         */
  /* ------------------------------------------------------------------------ */

  it("rejects an unknown video profile", () => {
    expect(() =>
      engine.validateOptions({
        ...baseOptions,
        profile: "unknown-profile",
      }),
    ).toThrow(
      'Unknown video profile "unknown-profile".',
    );
  });

  it("rejects an empty video profile", () => {
    expect(() =>
      engine.validateOptions({
        ...baseOptions,
        profile: " ",
      }),
    ).toThrow(
      "Video profile must be a non-empty string.",
    );
  });

  it("does not silently fall back to manual dimensions for an invalid profile", () => {
    expect(() =>
      engine.validateOptions({
        ...baseOptions,

        profile: "does-not-exist",

        width: 1920,
        height: 1080,
        fps: 30,
      }),
    ).toThrow(
      'Unknown video profile "does-not-exist".',
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Duration Policy                                                          */
  /* ------------------------------------------------------------------------ */

  it("accepts a YouTube Shorts duration below its maximum", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,

        profile: "youtube-shorts",

        startTick: 0,
        endTick: 180_000,
        tickRate: 1000,
      });

    expect(
      result.profile?.maxDurationSeconds,
    ).toBe(180);

    expect(result.endTick).toBe(
      180_000,
    );
  });

  it("accepts a YouTube duration within its maximum", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,

        profile: "youtube",

        startTick: 0,
        endTick: 60 * 60 * 1000,
        tickRate: 1000,
      });

    expect(
      result.profile?.maxDurationSeconds,
    ).toBe(
      12 * 60 * 60,
    );
  });

  it("rejects YouTube Shorts duration above three minutes", () => {
    expect(() =>
      engine.validateOptions({
        ...baseOptions,

        profile: "youtube-shorts",

        startTick: 0,
        endTick: 180_001,
        tickRate: 1000,
      }),
    ).toThrow(
      /exceeds the YouTube Shorts profile maximum/,
    );
  });

  it("rejects Facebook Reel duration above three minutes", () => {
    expect(() =>
      engine.validateOptions({
        ...baseOptions,

        profile: "facebook-reel",

        startTick: 0,
        endTick: 180_001,
        tickRate: 1000,
      }),
    ).toThrow(
      /exceeds the Facebook Reel profile maximum/,
    );
  });

  it("rejects Instagram Reel duration above three minutes", () => {
    expect(() =>
      engine.validateOptions({
        ...baseOptions,

        profile: "instagram-reel",

        startTick: 0,
        endTick: 180_001,
        tickRate: 1000,
      }),
    ).toThrow(
      /exceeds the Instagram Reel profile maximum/,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Direct Profile API                                                       */
  /* ------------------------------------------------------------------------ */

  it("keeps built-in profile registry synchronized with VideoEngine", () => {
    for (
      const id of Object.keys(
        VIDEO_PROFILES,
      )
    ) {
      const profile =
        getVideoProfile(id);

      expect(profile).toBeTruthy();

      const result =
        engine.validateOptions({
          ...baseOptions,
          profile: id,
        });

      expect(
        result.profile?.id,
      ).toBe(id);

      expect(
        result.width,
      ).toBe(
        profile?.width,
      );

      expect(
        result.height,
      ).toBe(
        profile?.height,
      );

      expect(
        result.fps,
      ).toBe(
        profile?.fps,
      );
    }
  });

  it("requireVideoProfile returns the same profile definition", () => {
    const profile =
      requireVideoProfile(
        "youtube-shorts",
      );

    expect(profile.id).toBe(
      "youtube-shorts",
    );

    expect(profile.width).toBe(
      1080,
    );

    expect(profile.height).toBe(
      1920,
    );
  });

  it("requireVideoProfile rejects unknown profiles", () => {
    expect(() =>
      requireVideoProfile(
        "unknown-profile",
      ),
    ).toThrow(
      'Unknown video profile "unknown-profile".',
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Custom Profile                                                           */
  /* ------------------------------------------------------------------------ */

  it("supports custom profile creation", () => {
    const custom =
      createCustomVideoProfile({
        id: "my-cartoon",

        name: "My Cartoon",

        width: 1600,
        height: 900,

        fps: 25,
      });

    expect(custom.id).toBe(
      "my-cartoon",
    );

    expect(custom.name).toBe(
      "My Cartoon",
    );

    expect(custom.width).toBe(
      1600,
    );

    expect(custom.height).toBe(
      900,
    );

    expect(custom.fps).toBe(
      25,
    );

    expect(custom.orientation).toBe(
      "landscape",
    );

    expect(custom.aspectRatio).toBe(
      "16:9",
    );

    expect(custom.videoCodec).toBe(
      "libx264",
    );

    expect(custom.pixelFormat).toBe(
      "yuv420p",
    );

    expect(custom.audioCodec).toBe(
      "aac",
    );
  });

  it("supports a custom portrait profile", () => {
    const custom =
      createCustomVideoProfile({
        id: "portrait-custom",

        name: "Portrait Custom",

        width: 720,
        height: 1280,
      });

    expect(custom.orientation).toBe(
      "portrait",
    );

    expect(custom.aspectRatio).toBe(
      "9:16",
    );

    expect(custom.fps).toBe(
      30,
    );
  });

  it("supports a custom square profile", () => {
    const custom =
      createCustomVideoProfile({
        id: "square-custom",

        name: "Square Custom",

        width: 1000,
        height: 1000,
      });

    expect(custom.orientation).toBe(
      "square",
    );

    expect(custom.aspectRatio).toBe(
      "1:1",
    );
  });

  it("preserves custom profile metadata", () => {
    const custom =
      createCustomVideoProfile({
        id: "metadata-custom",

        name: "Metadata Custom",

        width: 1280,
        height: 720,

        metadata: {
          creator: "Cartoon Animation Engine",
          purpose: "testing",
        },
      });

    expect(
      custom.metadata.container,
    ).toBe("mp4");

    expect(
      custom.metadata.creator,
    ).toBe(
      "Cartoon Animation Engine",
    );

    expect(
      custom.metadata.purpose,
    ).toBe("testing");
  });

  /* ------------------------------------------------------------------------ */
  /* Normalization / Paths                                                    */
  /* ------------------------------------------------------------------------ */

  it("normalizes output path to an absolute path", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,

        profile: "youtube-shorts",

        output:
          "./tmp/videos/short.mp4",
      });

    expect(
      result.output,
    ).toMatch(
      /^[A-Za-z]:[\\/]|^\//,
    );
  });

  it("preserves timeline values while applying the profile", () => {
    const result =
      engine.validateOptions({
        ...baseOptions,

        profile: "instagram-reel",

        startTick: 250,
        endTick: 15_250,
        tickRate: 1000,
      });

    expect(result.startTick).toBe(
      250,
    );

    expect(result.endTick).toBe(
      15_250,
    );

    expect(result.tickRate).toBe(
      1000,
    );

    expect(result.width).toBe(
      1080,
    );

    expect(result.height).toBe(
      1920,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Deterministic Profile Contract                                           */
  /* ------------------------------------------------------------------------ */

  it("produces identical normalized options for identical profile requests", () => {
    const options = {
      ...baseOptions,
      profile: "youtube-shorts",
    };

    const a =
      engine.validateOptions(
        options,
      );

    const b =
      engine.validateOptions(
        options,
      );

    expect(a).toEqual(b);
  });

  it("keeps YouTube Shorts dimensions distinct from YouTube dimensions", () => {
    const youtube =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube",
      });

    const shorts =
      engine.validateOptions({
        ...baseOptions,
        profile: "youtube-shorts",
      });

    expect(
      youtube.width,
    ).not.toBe(
      shorts.width,
    );

    expect(
      youtube.height,
    ).not.toBe(
      shorts.height,
    );

    expect(
      youtube.profile?.aspectRatio,
    ).toBe("16:9");

    expect(
      shorts.profile?.aspectRatio,
    ).toBe("9:16");
  });
});