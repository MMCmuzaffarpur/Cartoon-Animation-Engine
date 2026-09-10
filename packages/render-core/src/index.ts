import { createHash } from "node:crypto";

import { canonicalHash } from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const RENDER_CORE_SCHEMA_VERSION = "1.0.0" as const;

export const DEFAULT_RENDER_FPS = 30;

export const DEFAULT_RENDER_WIDTH = 1280;

export const DEFAULT_RENDER_HEIGHT = 720;

export const DEFAULT_RENDER_QUALITY = "preview" as const;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type RenderRepresentation =
  | "2d"
  | "3d"
  | "hybrid";

export type RenderQuality =
  | "draft"
  | "preview"
  | "production";

export type RenderPixelFormat =
  | "rgba8"
  | "rgb8";

export type RenderBackground =
  | "opaque"
  | "transparent";

export type RenderBackendKind =
  | "2d"
  | "3d"
  | "hybrid";

export type RenderStatus =
  | "queued"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface RenderResolution {
  width: number;
  height: number;
}

export interface RenderFrameRequest {
  projectId: string;
  revisionId: string;
  frameNumber: number;
  tick: number;

  fps: number;

  resolution: RenderResolution;

  quality: RenderQuality;

  representation: RenderRepresentation;

  background: RenderBackground;

  pixelFormat: RenderPixelFormat;

  backend?: RenderBackendKind;

  seed?: number;

  metadata?: Record<
    string,
    unknown
  >;
}

export interface RenderFrameIdentity {
  projectId: string;
  revisionId: string;
  frameNumber: number;
  tick: number;
  fps: number;
  width: number;
  height: number;
  quality: RenderQuality;
  representation: RenderRepresentation;
  background: RenderBackground;
  pixelFormat: RenderPixelFormat;
  backend: RenderBackendKind;
  seed: number;
}

export interface RenderFrameResult {
  schemaVersion:
    typeof RENDER_CORE_SCHEMA_VERSION;

  status: "completed";

  identity: RenderFrameIdentity;

  frameHash: string;

  diagnostics: RenderDiagnostics;

  metadata: Record<
    string,
    unknown
  >;
}

export interface RenderDiagnostics {
  backend: RenderBackendKind;

  rendererVersion: string;

  durationMs: number;

  warnings: string[];

  errors: string[];

  deterministic: boolean;
}

export interface RenderCapabilities {
  backend: RenderBackendKind;

  representations: RenderRepresentation[];

  qualities: RenderQuality[];

  pixelFormats: RenderPixelFormat[];

  transparentBackground: boolean;

  maxWidth?: number;

  maxHeight?: number;

  hardwareAcceleration: boolean;
}

export interface RenderBackend {
  readonly kind: RenderBackendKind;

  readonly version: string;

  capabilities():
    RenderCapabilities;

  render(
    request: RenderFrameRequest,
    frameState: unknown,
  ): Promise<RenderBackendOutput>;
}

export interface RenderBackendOutput {
  frameHash?: string;

  metadata?: Record<
    string,
    unknown
  >;

  warnings?: string[];

  durationMs?: number;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class RenderCoreError
  extends Error
{
  readonly code: string;

  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);

    this.name =
      "RenderCoreError";

    this.code = code;

    this.details =
      details;
  }
}

/* -------------------------------------------------------------------------- */
/* Utility                                                                    */
/* -------------------------------------------------------------------------- */

function clone<T>(
  value: T,
): T {
  return structuredClone(value);
}

function assertFinite(
  value: number,
  label: string,
): void {
  if (
    !Number.isFinite(value)
  ) {
    throw new RenderCoreError(
      "INVALID_NUMBER",
      `${label} must be finite.`,
    );
  }
}

function assertInteger(
  value: number,
  label: string,
): void {
  if (
    !Number.isInteger(value)
  ) {
    throw new RenderCoreError(
      "INVALID_INTEGER",
      `${label} must be an integer.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Frame / Tick Conversion                                                    */
/* -------------------------------------------------------------------------- */

export function ticksPerSecond(
  fps: number,
): number {
  assertFinite(
    fps,
    "fps",
  );

  if (fps <= 0) {
    throw new RenderCoreError(
      "INVALID_FPS",
      "fps must be greater than zero.",
    );
  }

  return 48_000;
}

export function frameToTick(
  frameNumber: number,
  fps: number,
): number {
  assertInteger(
    frameNumber,
    "frameNumber",
  );

  if (frameNumber < 0) {
    throw new RenderCoreError(
      "INVALID_FRAME",
      "frameNumber must not be negative.",
    );
  }

  const tps =
    ticksPerSecond(fps);

  /*
   * Use integer rational conversion
   * instead of floating point duration.
   */
  return Math.round(
    frameNumber *
      tps /
      fps,
  );
}

export function tickToFrame(
  tick: number,
  fps: number,
): number {
  assertInteger(
    tick,
    "tick",
  );

  if (tick < 0) {
    throw new RenderCoreError(
      "INVALID_TICK",
      "tick must not be negative.",
    );
  }

  const tps =
    ticksPerSecond(fps);

  return Math.round(
    tick *
      fps /
      tps,
  );
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

export function validateResolution(
  resolution: RenderResolution,
): RenderResolution {
  if (
    !resolution ||
    typeof resolution !==
      "object"
  ) {
    throw new RenderCoreError(
      "INVALID_RESOLUTION",
      "Render resolution is required.",
    );
  }

  assertInteger(
    resolution.width,
    "resolution.width",
  );

  assertInteger(
    resolution.height,
    "resolution.height",
  );

  if (
    resolution.width <= 0 ||
    resolution.height <= 0
  ) {
    throw new RenderCoreError(
      "INVALID_RESOLUTION",
      "Render resolution must be positive.",
    );
  }

  /*
   * Prevent accidental pathological
   * allocations at the core boundary.
   *
   * Individual backends may impose
   * stricter limits.
   */
  if (
    resolution.width >
      16_384 ||
    resolution.height >
      16_384
  ) {
    throw new RenderCoreError(
      "RESOLUTION_TOO_LARGE",
      "Render resolution exceeds the core maximum of 16384x16384.",
    );
  }

  return {
    width:
      resolution.width,

    height:
      resolution.height,
  };
}

/* -------------------------------------------------------------------------- */
/* Backend Selection                                                          */
/* -------------------------------------------------------------------------- */

export function selectBackend(
  representation: RenderRepresentation,
  available: RenderBackend[],
  requested?: RenderBackendKind,
): RenderBackend {
  if (
    available.length === 0
  ) {
    throw new RenderCoreError(
      "NO_RENDER_BACKEND",
      "No render backend is registered.",
    );
  }

  if (requested) {
    const exact =
      available.find(
        (backend) =>
          backend.kind ===
          requested,
      );

    if (!exact) {
      throw new RenderCoreError(
        "BACKEND_UNAVAILABLE",
        `Requested render backend "${requested}" is not available.`,
      );
    }

    if (
      !backendSupportsRepresentation(
        exact,
        representation,
      )
    ) {
      throw new RenderCoreError(
        "BACKEND_INCOMPATIBLE",
        `Render backend "${requested}" does not support representation "${representation}".`,
      );
    }

    return exact;
  }

  const preferred =
    available.find(
      (backend) =>
        backend.kind ===
          representation &&
        backendSupportsRepresentation(
          backend,
          representation,
        ),
    );

  if (preferred) {
    return preferred;
  }

  const hybrid =
    available.find(
      (backend) =>
        backend.kind ===
          "hybrid" &&
        backendSupportsRepresentation(
          backend,
          representation,
        ),
    );

  if (hybrid) {
    return hybrid;
  }

  const compatible =
    available.find(
      (backend) =>
        backendSupportsRepresentation(
          backend,
          representation,
        ),
    );

  if (!compatible) {
    throw new RenderCoreError(
      "NO_COMPATIBLE_BACKEND",
      `No registered backend supports representation "${representation}".`,
    );
  }

  return compatible;
}

function backendSupportsRepresentation(
  backend: RenderBackend,
  representation: RenderRepresentation,
): boolean {
  return backend
    .capabilities()
    .representations.includes(
      representation,
    );
}

/* -------------------------------------------------------------------------- */
/* Request Normalization                                                      */
/* -------------------------------------------------------------------------- */

export function normalizeRenderRequest(
  input: RenderFrameRequest,
): RenderFrameRequest {
  if (
    !input ||
    typeof input !==
      "object"
  ) {
    throw new RenderCoreError(
      "INVALID_REQUEST",
      "Render request is required.",
    );
  }

  if (
    typeof input.projectId !==
      "string" ||
    input.projectId.trim()
      .length === 0
  ) {
    throw new RenderCoreError(
      "INVALID_PROJECT_ID",
      "projectId must be a non-empty string.",
    );
  }

  if (
    typeof input.revisionId !==
      "string" ||
    input.revisionId.trim()
      .length === 0
  ) {
    throw new RenderCoreError(
      "INVALID_REVISION_ID",
      "revisionId must be a non-empty string.",
    );
  }

  assertInteger(
    input.frameNumber,
    "frameNumber",
  );

  assertInteger(
    input.tick,
    "tick",
  );

  assertFinite(
    input.fps,
    "fps",
  );

  if (
    input.frameNumber < 0
  ) {
    throw new RenderCoreError(
      "INVALID_FRAME",
      "frameNumber must not be negative.",
    );
  }

  if (
    input.tick < 0
  ) {
    throw new RenderCoreError(
      "INVALID_TICK",
      "tick must not be negative.",
    );
  }

  if (
    input.fps <= 0 ||
    input.fps > 240
  ) {
    throw new RenderCoreError(
      "INVALID_FPS",
      "fps must be greater than 0 and no greater than 240.",
    );
  }

  const resolution =
    validateResolution(
      input.resolution,
    );

  if (
    ![
      "draft",
      "preview",
      "production",
    ].includes(input.quality)
  ) {
    throw new RenderCoreError(
      "INVALID_QUALITY",
      `Unsupported render quality "${input.quality}".`,
    );
  }

  if (
    ![
      "2d",
      "3d",
      "hybrid",
    ].includes(
      input.representation,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_REPRESENTATION",
      `Unsupported representation "${input.representation}".`,
    );
  }

  if (
    ![
      "opaque",
      "transparent",
    ].includes(
      input.background,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKGROUND",
      `Unsupported background mode "${input.background}".`,
    );
  }

  if (
    ![
      "rgba8",
      "rgb8",
    ].includes(
      input.pixelFormat,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_PIXEL_FORMAT",
      `Unsupported pixel format "${input.pixelFormat}".`,
    );
  }

  if (
    input.background ===
      "transparent" &&
    input.pixelFormat !==
      "rgba8"
  ) {
    throw new RenderCoreError(
      "INVALID_TRANSPARENCY_FORMAT",
      "Transparent rendering requires rgba8.",
    );
  }

  const seed =
    input.seed ??
    0;

  assertInteger(
    seed,
    "seed",
  );

  return {
    projectId:
      input.projectId,

    revisionId:
      input.revisionId,

    frameNumber:
      input.frameNumber,

    tick:
      input.tick,

    fps:
      input.fps,

    resolution,

    quality:
      input.quality,

    representation:
      input.representation,

    background:
      input.background,

    pixelFormat:
      input.pixelFormat,

    ...(input.backend
      ? {
          backend:
            input.backend,
        }
      : {}),

    seed,

    metadata:
      clone(
        input.metadata ??
          {},
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Frame Identity                                                             */
/* -------------------------------------------------------------------------- */

export function createFrameIdentity(
  request: RenderFrameRequest,
  backend: RenderBackendKind,
): RenderFrameIdentity {
  const normalized =
    normalizeRenderRequest(
      request,
    );

  return {
    projectId:
      normalized.projectId,

    revisionId:
      normalized.revisionId,

    frameNumber:
      normalized.frameNumber,

    tick:
      normalized.tick,

    fps:
      normalized.fps,

    width:
      normalized.resolution.width,

    height:
      normalized.resolution.height,

    quality:
      normalized.quality,

    representation:
      normalized.representation,

    background:
      normalized.background,

    pixelFormat:
      normalized.pixelFormat,

    backend,

    seed:
      normalized.seed ??
      0,
  };
}

export function frameIdentityHash(
  identity: RenderFrameIdentity,
): string {
  return canonicalHash(
    identity,
  ) as string;
}

/* -------------------------------------------------------------------------- */
/* Render Core                                                                */
/* -------------------------------------------------------------------------- */

export class RenderCore {
  private readonly backends =
    new Map<
      RenderBackendKind,
      RenderBackend
    >();

  registerBackend(
    backend: RenderBackend,
  ): void {
    if (
      !backend ||
      typeof backend !==
        "object"
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND",
        "Render backend is required.",
      );
    }

    if (
      ![
        "2d",
        "3d",
        "hybrid",
      ].includes(backend.kind)
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_KIND",
        `Unsupported backend kind "${backend.kind}".`,
      );
    }

    if (
      typeof backend.version !==
      "string"
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_VERSION",
        "Render backend version must be a string.",
      );
    }

    this.backends.set(
      backend.kind,
      backend,
    );
  }

  unregisterBackend(
    kind: RenderBackendKind,
  ): boolean {
    return this.backends.delete(
      kind,
    );
  }

  getBackend(
    kind: RenderBackendKind,
  ): RenderBackend | undefined {
    return this.backends.get(
      kind,
    );
  }

  listBackends(): RenderBackend[] {
    return [...this.backends.values()]
      .sort(
        (a, b) =>
          a.kind.localeCompare(
            b.kind,
          ),
      );
  }

  capabilities(): RenderCapabilities[] {
    return this.listBackends().map(
      (backend) =>
        clone(
          backend.capabilities(),
        ),
    );
  }

  prepare(
    request: RenderFrameRequest,
  ): {
    request: RenderFrameRequest;
    backend: RenderBackend;
    identity: RenderFrameIdentity;
    identityHash: string;
  } {
    const normalized =
      normalizeRenderRequest(
        request,
      );

    const backend =
      selectBackend(
        normalized.representation,
        this.listBackends(),
        normalized.backend,
      );

    const identity =
      createFrameIdentity(
        normalized,
        backend.kind,
      );

    const identityHash =
      frameIdentityHash(
        identity,
      );

    return {
      request: normalized,

      backend,

      identity,

      identityHash,
    };
  }

  async renderFrame(
    request: RenderFrameRequest,
    frameState: unknown,
  ): Promise<RenderFrameResult> {
    const prepared =
      this.prepare(
        request,
      );

    const startedAt =
      Date.now();

    let output:
      RenderBackendOutput;

    try {
      output =
        await prepared.backend.render(
          clone(
            prepared.request,
          ),
          clone(
            frameState,
          ),
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new RenderCoreError(
        "RENDER_BACKEND_FAILED",
        `Render backend "${prepared.backend.kind}" failed: ${message}`,
        error,
      );
    }

    const durationMs =
      output.durationMs ??
      Date.now() -
        startedAt;

    const warnings =
      [
        ...(output.warnings ??
          []),
      ];

    const frameHash =
      output.frameHash ??
      createHash(
        "sha256",
      )
        .update(
          prepared.identityHash,
        )
        .update(
          canonicalHash(
            frameState,
          ) as string,
        )
        .digest("hex");

    const diagnostics:
      RenderDiagnostics =
      {
        backend:
          prepared.backend.kind,

        rendererVersion:
          prepared.backend.version,

        durationMs,

        warnings,

        errors: [],

        deterministic:
          true,
      };

    return {
      schemaVersion:
        RENDER_CORE_SCHEMA_VERSION,

      status:
        "completed",

      identity:
        prepared.identity,

      frameHash,

      diagnostics,

      metadata:
        clone(
          output.metadata ??
            {},
        ),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Deterministic Null Backend                                                 */
/* -------------------------------------------------------------------------- */

/*
 * This backend deliberately does not produce
 * pixels. It exists for:
 *
 * - contract testing
 * - deterministic pipeline testing
 * - CI
 * - frame identity validation
 * - future renderer integration
 *
 * Real pixel-producing backends will implement
 * the same RenderBackend contract.
 */

export class DeterministicNullBackend
  implements RenderBackend
{
  readonly kind:
    RenderBackendKind =
    "2d";

  readonly version =
    "1.0.0";

  capabilities():
    RenderCapabilities {
    return {
      backend: "2d",

      representations: [
        "2d",
      ],

      qualities: [
        "draft",
        "preview",
        "production",
      ],

      pixelFormats: [
        "rgba8",
        "rgb8",
      ],

      transparentBackground:
        true,

      maxWidth:
        16_384,

      maxHeight:
        16_384,

      hardwareAcceleration:
        false,
    };
  }

  async render(
    request: RenderFrameRequest,
    frameState: unknown,
  ): Promise<RenderBackendOutput> {
    const normalized =
      normalizeRenderRequest(
        request,
      );

    const stateHash =
      canonicalHash(
        frameState,
      ) as string;

    const identity =
      createFrameIdentity(
        normalized,
        this.kind,
      );

    const frameHash =
      createHash(
        "sha256",
      )
        .update(
          canonicalHash(
            identity,
          ) as string,
        )
        .update(
          stateHash,
        )
        .digest("hex");

    return {
      frameHash,

      metadata: {
        backend:
          "deterministic-null",

        pixelOutput:
          false,

        width:
          normalized.resolution
            .width,

        height:
          normalized.resolution
            .height,
      },

      warnings: [
        "DeterministicNullBackend does not produce pixel data.",
      ],

      durationMs: 0,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Convenience Factory                                                        */
/* -------------------------------------------------------------------------- */

export function createRenderCore(): RenderCore {
  return new RenderCore();
}

/* -------------------------------------------------------------------------- */
/* Public Helpers                                                             */
/* -------------------------------------------------------------------------- */

export function validateFrameState(
  frameState: unknown,
): void {
  if (
    frameState === null ||
    frameState === undefined
  ) {
    throw new RenderCoreError(
      "INVALID_FRAME_STATE",
      "frameState is required.",
    );
  }

  if (
    typeof frameState !==
      "object"
  ) {
    throw new RenderCoreError(
      "INVALID_FRAME_STATE",
      "frameState must be an object.",
    );
  }
}

export function renderRequestFingerprint(
  request: RenderFrameRequest,
): string {
  return canonicalHash(
    normalizeRenderRequest(
      request,
    ),
  ) as string;
}