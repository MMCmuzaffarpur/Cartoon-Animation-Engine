import { describe, expect, it } from "vitest";

import {
  VIDEO_PROFILE_CAPABILITIES,
  VIDEO_PROFILE_VERSION,
  VIDEO_PROFILES,
  createCustomVideoProfile,
  getVideoProfile,
  listVideoProfiles,
  requireVideoProfile,
  validateVideoProfile,
  type VideoProfile,
} from "../packages/video-engine/src/profiles.js";

describe("video-profile-core", () => {
  it("exposes the profile contract version", () => {
    expect(VIDEO_PROFILE_VERSION).toBe("1.0.0");
  });

  it("exposes all built-in platform profiles", () => {
    expect(Object.keys(VIDEO_PROFILES)).toEqual([
      "youtube",
      "youtube-shorts",
      "facebook-reel",
      "instagram-reel",
      "square-social",
    ]);
  });

  it("defines YouTube landscape profile", () => {
    const profile = getVideoProfile("youtube");

    expect(profile).toMatchObject({
      id: "youtube",
      name: "YouTube",
      platform: "youtube",
      orientation: "landscape",
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      fps: 30,
      videoCodec: "libx264",
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioSampleRate: 48000,
      audioChannels: 2,
    });
    expect(profile?.maxDurationSeconds).toBe(43200);
  });

  it("defines YouTube Shorts portrait profile", () => {
    const profile = requireVideoProfile("youtube-shorts");

    expect(profile).toMatchObject({
      id: "youtube-shorts",
      name: "YouTube Shorts",
      platform: "youtube-shorts",
      orientation: "portrait",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      fps: 30,
    });
    expect(profile.maxDurationSeconds).toBe(180);
  });

  it("defines Facebook Reel portrait profile", () => {
    const profile = requireVideoProfile("facebook-reel");

    expect(profile).toMatchObject({
      id: "facebook-reel",
      name: "Facebook Reel",
      platform: "facebook-reel",
      orientation: "portrait",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      fps: 30,
    });
    expect(profile.maxDurationSeconds).toBe(180);
  });

  it("defines Instagram Reel portrait profile", () => {
    const profile = requireVideoProfile("instagram-reel");

    expect(profile).toMatchObject({
      id: "instagram-reel",
      name: "Instagram Reel",
      platform: "instagram-reel",
      orientation: "portrait",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      fps: 30,
    });
    expect(profile.maxDurationSeconds).toBe(180);
  });

  it("defines square social profile", () => {
    const profile = requireVideoProfile("square-social");

    expect(profile).toMatchObject({
      id: "square-social",
      name: "Square Social",
      platform: "square-social",
      orientation: "square",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      fps: 30,
    });
    expect(profile.maxDurationSeconds).toBe(180);
  });

  it("uses MP4/H.264/YUV420P/AAC defaults", () => {
    for (const profile of listVideoProfiles()) {
      expect(profile.metadata.container).toBe("mp4");
      expect(profile.videoCodec).toBe("libx264");
      expect(profile.pixelFormat).toBe("yuv420p");
      expect(profile.audioCodec).toBe("aac");
      expect(profile.audioSampleRate).toBe(48000);
      expect(profile.audioChannels).toBe(2);
    }
  });

  it("lists independent profile copies", () => {
    const first = listVideoProfiles();
    const second = listVideoProfiles();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].metadata).not.toBe(second[0].metadata);
  });

  it("returns independent metadata from getVideoProfile", () => {
    const a = getVideoProfile("youtube");
    const b = getVideoProfile("youtube");

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    expect(a?.metadata).not.toBe(b?.metadata);

    if (a) {
      a.metadata.changed = true;
    }

    expect(b?.metadata.changed).toBeUndefined();
    expect(VIDEO_PROFILES.youtube.metadata.changed).toBeUndefined();
  });

  it("returns undefined for an unknown profile", () => {
    expect(getVideoProfile("does-not-exist")).toBeUndefined();
  });

  it("throws for an unknown required profile", () => {
    expect(() => requireVideoProfile("does-not-exist")).toThrow(
      'Unknown video profile "does-not-exist".',
    );
  });

  it("creates a valid custom landscape profile", () => {
    const profile = createCustomVideoProfile({
      id: "custom-landscape",
      name: "Custom Landscape",
      width: 2560,
      height: 1440,
      fps: 60,
    });

    expect(profile).toMatchObject({
      id: "custom-landscape",
      name: "Custom Landscape",
      platform: "generic",
      orientation: "landscape",
      width: 2560,
      height: 1440,
      aspectRatio: "16:9",
      fps: 60,
      videoCodec: "libx264",
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioSampleRate: 48000,
      audioChannels: 2,
      maxDurationSeconds: null,
    });
  });

  it("creates a valid custom portrait profile", () => {
    const profile = createCustomVideoProfile({
      id: "custom-portrait",
      name: "Custom Portrait",
      width: 720,
      height: 1280,
    });

    expect(profile.orientation).toBe("portrait");
    expect(profile.aspectRatio).toBe("9:16");
    expect(profile.fps).toBe(30);
  });

  it("creates a valid custom square profile", () => {
    const profile = createCustomVideoProfile({
      id: "custom-square",
      name: "Custom Square",
      width: 1080,
      height: 1080,
    });

    expect(profile.orientation).toBe("square");
    expect(profile.aspectRatio).toBe("1:1");
  });

  it("calculates reduced aspect ratios", () => {
    expect(
      createCustomVideoProfile({
        id: "ratio-a",
        name: "Ratio A",
        width: 3840,
        height: 2160,
      }).aspectRatio,
    ).toBe("16:9");

    expect(
      createCustomVideoProfile({
        id: "ratio-b",
        name: "Ratio B",
        width: 1440,
        height: 2560,
      }).aspectRatio,
    ).toBe("9:16");

    expect(
      createCustomVideoProfile({
        id: "ratio-c",
        name: "Ratio C",
        width: 2048,
        height: 2048,
      }).aspectRatio,
    ).toBe("1:1");

    expect(
      createCustomVideoProfile({
        id: "ratio-d",
        name: "Ratio D",
        width: 1000,
        height: 500,
      }).aspectRatio,
    ).toBe("2:1");
  });

  it("supports custom platform, orientation, aspect ratio and metadata", () => {
    const profile = createCustomVideoProfile({
      id: "custom-platform",
      name: "Custom Platform",
      width: 1000,
      height: 500,
      platform: "youtube",
      orientation: "portrait",
      aspectRatio: "custom",
      maxDurationSeconds: 12.5,
      metadata: {
        codecProfile: "high",
        customFlag: true,
      },
    });

    expect(profile.platform).toBe("youtube");
    expect(profile.orientation).toBe("portrait");
    expect(profile.aspectRatio).toBe("custom");
    expect(profile.maxDurationSeconds).toBe(12.5);
    expect(profile.metadata).toEqual({
      container: "mp4",
      codecProfile: "high",
      customFlag: true,
    });
  });

  it("trims custom profile id and name", () => {
    const profile = createCustomVideoProfile({
      id: "  custom  ",
      name: "  Custom Profile  ",
      width: 100,
      height: 100,
    });

    expect(profile.id).toBe("custom");
    expect(profile.name).toBe("Custom Profile");
  });

  it("rejects an empty custom profile id", () => {
    expect(() =>
      createCustomVideoProfile({
        id: "   ",
        name: "Profile",
        width: 100,
        height: 100,
      }),
    ).toThrow(
      "Video profile id must be a non-empty string.",
    );
  });

  it("rejects a non-string custom profile id", () => {
    expect(() =>
      createCustomVideoProfile({
        id: 123 as never,
        name: "Profile",
        width: 100,
        height: 100,
      }),
    ).toThrow(
      "Video profile id must be a non-empty string.",
    );
  });

  it("rejects an empty custom profile name", () => {
    expect(() =>
      createCustomVideoProfile({
        id: "profile",
        name: "   ",
        width: 100,
        height: 100,
      }),
    ).toThrow(
      "Video profile name must be a non-empty string.",
    );
  });

  it("rejects invalid custom dimensions", () => {
    expect(() =>
      createCustomVideoProfile({
        id: "bad-width",
        name: "Bad Width",
        width: 0,
        height: 100,
      }),
    ).toThrow(
      "Video profile width must be a positive integer.",
    );

    expect(() =>
      createCustomVideoProfile({
        id: "bad-width",
        name: "Bad Width",
        width: 100.5,
        height: 100,
      }),
    ).toThrow(
      "Video profile width must be a positive integer.",
    );

    expect(() =>
      createCustomVideoProfile({
        id: "bad-height",
        name: "Bad Height",
        width: 100,
        height: -1,
      }),
    ).toThrow(
      "Video profile height must be a positive integer.",
    );
  });

  it("rejects invalid custom FPS", () => {
    expect(() =>
      createCustomVideoProfile({
        id: "bad-fps",
        name: "Bad FPS",
        width: 100,
        height: 100,
        fps: 0,
      }),
    ).toThrow(
      "Video profile FPS must be between 1 and 120.",
    );

    expect(() =>
      createCustomVideoProfile({
        id: "bad-fps",
        name: "Bad FPS",
        width: 100,
        height: 100,
        fps: 121,
      }),
    ).toThrow(
      "Video profile FPS must be between 1 and 120.",
    );

    expect(() =>
      createCustomVideoProfile({
        id: "bad-fps",
        name: "Bad FPS",
        width: 100,
        height: 100,
        fps: Number.NaN,
      }),
    ).toThrow(
      "Video profile FPS must be between 1 and 120.",
    );
  });

  it("rejects invalid custom duration", () => {
    expect(() =>
      createCustomVideoProfile({
        id: "bad-duration",
        name: "Bad Duration",
        width: 100,
        height: 100,
        maxDurationSeconds: 0,
      }),
    ).toThrow(
      "Video profile maxDurationSeconds must be positive or null.",
    );

    expect(() =>
      createCustomVideoProfile({
        id: "bad-duration",
        name: "Bad Duration",
        width: 100,
        height: 100,
        maxDurationSeconds: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(
      "Video profile maxDurationSeconds must be positive or null.",
    );

    expect(
      createCustomVideoProfile({
        id: "unlimited",
        name: "Unlimited",
        width: 100,
        height: 100,
        maxDurationSeconds: null,
      }).maxDurationSeconds,
    ).toBeNull();
  });

  it("validates every built-in profile", () => {
    for (const profile of listVideoProfiles()) {
      expect(validateVideoProfile(profile)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it("validates a valid custom profile", () => {
    const profile = createCustomVideoProfile({
      id: "valid",
      name: "Valid",
      width: 1920,
      height: 1080,
      fps: 30,
    });

    expect(validateVideoProfile(profile)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("reports invalid profile structure", () => {
    expect(validateVideoProfile(null as never)).toEqual({
      valid: false,
      errors: ["Video profile must be an object."],
    });
  });

  it("reports invalid profile fields", () => {
    const profile = {
      id: "",
      name: "",
      platform: "generic",
      orientation: "landscape",
      width: 0,
      height: 0,
      aspectRatio: "16:9",
      fps: 0,
      videoCodec: "bad",
      pixelFormat: "bad",
      audioCodec: "bad",
      audioSampleRate: 0,
      audioChannels: 8,
      maxDurationSeconds: 0,
      metadata: {},
    } as unknown as VideoProfile;

    const result = validateVideoProfile(profile);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Video profile id must be a non-empty string.",
    );
    expect(result.errors).toContain(
      "Video profile name must be a non-empty string.",
    );
    expect(result.errors).toContain(
      "Video profile width must be a positive integer.",
    );
    expect(result.errors).toContain(
      "Video profile height must be a positive integer.",
    );
    expect(result.errors).toContain(
      "Video profile FPS must be between 1 and 120.",
    );
    expect(result.errors).toContain(
      'Unsupported video codec "bad".',
    );
    expect(result.errors).toContain(
      'Unsupported pixel format "bad".',
    );
    expect(result.errors).toContain(
      'Unsupported audio codec "bad".',
    );
    expect(result.errors).toContain(
      "Video profile audioSampleRate must be a positive integer.",
    );
    expect(result.errors).toContain(
      "Video profile audioChannels must be 1 or 2.",
    );
    expect(result.errors).toContain(
      "Video profile maxDurationSeconds must be positive or null.",
    );
  });

  it("accepts mono audio profiles", () => {
    const profile = {
      ...createCustomVideoProfile({
        id: "mono",
        name: "Mono",
        width: 320,
        height: 240,
      }),
      audioChannels: 1 as const,
    };

    expect(validateVideoProfile(profile)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("exposes deterministic capability declarations", () => {
    expect(VIDEO_PROFILE_CAPABILITIES).toEqual({
      adapterId: "video-profile-core",
      adapterVersion: "1.0.0",
      contractVersion: "1.0.0",
      capabilities: {
        "video.profile.youtube": "supported",
        "video.profile.youtube-shorts": "supported",
        "video.profile.facebook-reel": "supported",
        "video.profile.instagram-reel": "supported",
        "video.profile.square-social": "supported",
        "video.profile.custom": "supported",
        "video.profile.deterministic": "supported",
      },
    });
  });

  it("keeps built-in profiles immutable at the top-level registry", () => {
    expect(Object.isFrozen(VIDEO_PROFILES)).toBe(true);
  });

  it("does not expose mutable registry metadata through lookup", () => {
    const profile = getVideoProfile("youtube");

    expect(profile).toBeTruthy();

    if (profile) {
      profile.metadata.container = "changed";
    }

    expect(getVideoProfile("youtube")?.metadata.container).toBe("mp4");
  });
});
