/* -------------------------------------------------------------------------- */
/* Video Profile System                                                       */
/* -------------------------------------------------------------------------- */

export const VIDEO_PROFILE_VERSION = "1.0.0" as const;

export type VideoPlatform =
  | "youtube"
  | "youtube-shorts"
  | "facebook-reel"
  | "instagram-reel"
  | "square-social"
  | "generic";

export type VideoOrientation =
  | "landscape"
  | "portrait"
  | "square";

export interface VideoProfile {
  id: string;
  name: string;

  platform: VideoPlatform;
  orientation: VideoOrientation;

  width: number;
  height: number;

  aspectRatio: string;

  fps: number;

  videoCodec: "libx264";
  pixelFormat: "yuv420p";

  audioCodec: "aac";
  audioSampleRate: number;
  audioChannels: 1 | 2;

  maxDurationSeconds: number | null;

  metadata: Record<string, unknown>;
}

export interface VideoProfileCapabilities {
  adapterId: "video-profile-core";
  adapterVersion: "1.0.0";
  contractVersion: "1.0.0";

  capabilities: {
    "video.profile.youtube": "supported";
    "video.profile.youtube-shorts": "supported";
    "video.profile.facebook-reel": "supported";
    "video.profile.instagram-reel": "supported";
    "video.profile.square-social": "supported";
    "video.profile.custom": "supported";
    "video.profile.deterministic": "supported";
  };
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_AUDIO_SAMPLE_RATE = 48_000;
const DEFAULT_AUDIO_CHANNELS = 2 as const;

const YOUTUBE_MAX_DURATION_SECONDS = 12 * 60 * 60;
const SHORT_MAX_DURATION_SECONDS = 3 * 60;
const REEL_MAX_DURATION_SECONDS = 3 * 60;

const DEFAULT_METADATA: Record<string, unknown> = {
  container: "mp4",
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function cloneMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...metadata,
  };
}

function createProfile(
  profile: Omit<VideoProfile, "metadata"> & {
    metadata?: Record<string, unknown>;
  },
): VideoProfile {
  return {
    ...profile,

    metadata: {
      ...DEFAULT_METADATA,
      ...(profile.metadata ?? {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Built-in Profiles                                                          */
/* -------------------------------------------------------------------------- */

export const VIDEO_PROFILES: Readonly<
  Record<string, VideoProfile>
> = Object.freeze({
  youtube: createProfile({
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
    audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    audioChannels: DEFAULT_AUDIO_CHANNELS,

    maxDurationSeconds:
      YOUTUBE_MAX_DURATION_SECONDS,
  }),

  "youtube-shorts": createProfile({
    id: "youtube-shorts",
    name: "YouTube Shorts",

    platform: "youtube-shorts",
    orientation: "portrait",

    width: 1080,
    height: 1920,

    aspectRatio: "9:16",

    fps: 30,

    videoCodec: "libx264",
    pixelFormat: "yuv420p",

    audioCodec: "aac",
    audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    audioChannels: DEFAULT_AUDIO_CHANNELS,

    maxDurationSeconds:
      SHORT_MAX_DURATION_SECONDS,
  }),

  "facebook-reel": createProfile({
    id: "facebook-reel",
    name: "Facebook Reel",

    platform: "facebook-reel",
    orientation: "portrait",

    width: 1080,
    height: 1920,

    aspectRatio: "9:16",

    fps: 30,

    videoCodec: "libx264",
    pixelFormat: "yuv420p",

    audioCodec: "aac",
    audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    audioChannels: DEFAULT_AUDIO_CHANNELS,

    maxDurationSeconds:
      REEL_MAX_DURATION_SECONDS,
  }),

  "instagram-reel": createProfile({
    id: "instagram-reel",
    name: "Instagram Reel",

    platform: "instagram-reel",
    orientation: "portrait",

    width: 1080,
    height: 1920,

    aspectRatio: "9:16",

    fps: 30,

    videoCodec: "libx264",
    pixelFormat: "yuv420p",

    audioCodec: "aac",
    audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    audioChannels: DEFAULT_AUDIO_CHANNELS,

    maxDurationSeconds:
      REEL_MAX_DURATION_SECONDS,
  }),

  "square-social": createProfile({
    id: "square-social",
    name: "Square Social",

    platform: "square-social",
    orientation: "square",

    width: 1080,
    height: 1080,

    aspectRatio: "1:1",

    fps: 30,

    videoCodec: "libx264",
    pixelFormat: "yuv420p",

    audioCodec: "aac",
    audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    audioChannels: DEFAULT_AUDIO_CHANNELS,

    maxDurationSeconds:
      REEL_MAX_DURATION_SECONDS,
  }),
});

/* -------------------------------------------------------------------------- */
/* Custom Profile                                                            */
/* -------------------------------------------------------------------------- */

export interface CustomVideoProfileOptions {
  id: string;
  name: string;

  width: number;
  height: number;

  fps?: number;

  platform?: VideoPlatform;
  orientation?: VideoOrientation;

  aspectRatio?: string;

  maxDurationSeconds?: number | null;

  metadata?: Record<string, unknown>;
}

function inferOrientation(
  width: number,
  height: number,
): VideoOrientation {
  if (width === height) {
    return "square";
  }

  return width > height
    ? "landscape"
    : "portrait";
}

function calculateAspectRatio(
  width: number,
  height: number,
): string {
  function gcd(
    a: number,
    b: number,
  ): number {
    let x = Math.abs(a);
    let y = Math.abs(b);

    while (y !== 0) {
      const remainder = x % y;
      x = y;
      y = remainder;
    }

    return x;
  }

  const divisor = gcd(width, height);

  return `${width / divisor}:${height / divisor}`;
}

export function createCustomVideoProfile(
  options: CustomVideoProfileOptions,
): VideoProfile {
  if (
    typeof options.id !== "string" ||
    options.id.trim().length === 0
  ) {
    throw new Error(
      "Video profile id must be a non-empty string.",
    );
  }

  if (
    typeof options.name !== "string" ||
    options.name.trim().length === 0
  ) {
    throw new Error(
      "Video profile name must be a non-empty string.",
    );
  }

  if (
    !Number.isInteger(options.width) ||
    options.width <= 0
  ) {
    throw new Error(
      "Video profile width must be a positive integer.",
    );
  }

  if (
    !Number.isInteger(options.height) ||
    options.height <= 0
  ) {
    throw new Error(
      "Video profile height must be a positive integer.",
    );
  }

  const fps =
    options.fps ?? 30;

  if (
    !Number.isFinite(fps) ||
    fps <= 0 ||
    fps > 120
  ) {
    throw new Error(
      "Video profile FPS must be between 1 and 120.",
    );
  }

  const orientation =
    options.orientation ??
    inferOrientation(
      options.width,
      options.height,
    );

  const aspectRatio =
    options.aspectRatio ??
    calculateAspectRatio(
      options.width,
      options.height,
    );

  const maxDurationSeconds =
    options.maxDurationSeconds ??
    null;

  if (
    maxDurationSeconds !== null &&
    (
      !Number.isFinite(
        maxDurationSeconds,
      ) ||
      maxDurationSeconds <= 0
    )
  ) {
    throw new Error(
      "Video profile maxDurationSeconds must be positive or null.",
    );
  }

  return createProfile({
    id: options.id.trim(),
    name: options.name.trim(),

    platform:
      options.platform ??
      "generic",

    orientation,

    width: options.width,
    height: options.height,

    aspectRatio,

    fps,

    videoCodec: "libx264",
    pixelFormat: "yuv420p",

    audioCodec: "aac",
    audioSampleRate:
      DEFAULT_AUDIO_SAMPLE_RATE,
    audioChannels:
      DEFAULT_AUDIO_CHANNELS,

    maxDurationSeconds,

    metadata:
      options.metadata,
  });
}

/* -------------------------------------------------------------------------- */
/* Profile Lookup                                                             */
/* -------------------------------------------------------------------------- */

export function getVideoProfile(
  id: string,
): VideoProfile | undefined {
  const profile =
    VIDEO_PROFILES[id];

  if (!profile) {
    return undefined;
  }

  return {
    ...profile,
    metadata:
      cloneMetadata(
        profile.metadata,
      ),
  };
}

export function requireVideoProfile(
  id: string,
): VideoProfile {
  const profile =
    getVideoProfile(id);

  if (!profile) {
    throw new Error(
      `Unknown video profile "${id}".`,
    );
  }

  return profile;
}

/* -------------------------------------------------------------------------- */
/* Profile Listing                                                            */
/* -------------------------------------------------------------------------- */

export function listVideoProfiles(): VideoProfile[] {
  return Object.values(
    VIDEO_PROFILES,
  ).map(
    (profile) => ({
      ...profile,
      metadata:
        cloneMetadata(
          profile.metadata,
        ),
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Profile Validation                                                         */
/* -------------------------------------------------------------------------- */

export function validateVideoProfile(
  profile: VideoProfile,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (
    !profile ||
    typeof profile !== "object"
  ) {
    return {
      valid: false,
      errors: [
        "Video profile must be an object.",
      ],
    };
  }

  if (
    typeof profile.id !== "string" ||
    profile.id.trim().length === 0
  ) {
    errors.push(
      "Video profile id must be a non-empty string.",
    );
  }

  if (
    typeof profile.name !== "string" ||
    profile.name.trim().length === 0
  ) {
    errors.push(
      "Video profile name must be a non-empty string.",
    );
  }

  if (
    !Number.isInteger(profile.width) ||
    profile.width <= 0
  ) {
    errors.push(
      "Video profile width must be a positive integer.",
    );
  }

  if (
    !Number.isInteger(profile.height) ||
    profile.height <= 0
  ) {
    errors.push(
      "Video profile height must be a positive integer.",
    );
  }

  if (
    !Number.isFinite(profile.fps) ||
    profile.fps <= 0 ||
    profile.fps > 120
  ) {
    errors.push(
      "Video profile FPS must be between 1 and 120.",
    );
  }

  if (
    profile.videoCodec !== "libx264"
  ) {
    errors.push(
      `Unsupported video codec "${String(profile.videoCodec)}".`,
    );
  }

  if (
    profile.pixelFormat !== "yuv420p"
  ) {
    errors.push(
      `Unsupported pixel format "${String(profile.pixelFormat)}".`,
    );
  }

  if (
    profile.audioCodec !== "aac"
  ) {
    errors.push(
      `Unsupported audio codec "${String(profile.audioCodec)}".`,
    );
  }

  if (
    !Number.isInteger(
      profile.audioSampleRate,
    ) ||
    profile.audioSampleRate <= 0
  ) {
    errors.push(
      "Video profile audioSampleRate must be a positive integer.",
    );
  }

  if (
    profile.audioChannels !== 1 &&
    profile.audioChannels !== 2
  ) {
    errors.push(
      "Video profile audioChannels must be 1 or 2.",
    );
  }

  if (
    profile.maxDurationSeconds !== null &&
    (
      !Number.isFinite(
        profile.maxDurationSeconds,
      ) ||
      profile.maxDurationSeconds <= 0
    )
  ) {
    errors.push(
      "Video profile maxDurationSeconds must be positive or null.",
    );
  }

  return {
    valid:
      errors.length === 0,
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/* Capabilities                                                               */
/* -------------------------------------------------------------------------- */

export const VIDEO_PROFILE_CAPABILITIES:
  VideoProfileCapabilities = {
    adapterId:
      "video-profile-core",

    adapterVersion:
      VIDEO_PROFILE_VERSION,

    contractVersion:
      VIDEO_PROFILE_VERSION,

    capabilities: {
      "video.profile.youtube":
        "supported",

      "video.profile.youtube-shorts":
        "supported",

      "video.profile.facebook-reel":
        "supported",

      "video.profile.instagram-reel":
        "supported",

      "video.profile.square-social":
        "supported",

      "video.profile.custom":
        "supported",

      "video.profile.deterministic":
        "supported",
    },
  };