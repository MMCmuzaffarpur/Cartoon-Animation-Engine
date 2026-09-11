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

/**
 * The engine's canonical timeline clock.
 *
 * This is intentionally independent of output FPS. FPS describes how output
 * frames sample the canonical timeline; it does not change the timeline clock.
 */
export const TICKS_PER_SECOND = 48_000;

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
  metadata?: Record<string, unknown>;
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
  schemaVersion: typeof RENDER_CORE_SCHEMA_VERSION;
  status: "completed";
  identity: RenderFrameIdentity;
  frameHash: string;
  diagnostics: RenderDiagnostics;
  metadata: Record<string, unknown>;
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

  capabilities(): RenderCapabilities;

  render(
    request: RenderFrameRequest,
    frameState: unknown,
  ): Promise<RenderBackendOutput>;
}

export interface RenderBackendOutput {
  frameHash?: string;
  metadata?: Record<string, unknown>;
  warnings?: string[];
  durationMs?: number;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class RenderCoreError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "RenderCoreError";
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Utility                                                                    */
/* -------------------------------------------------------------------------- */

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function assertFinite(
  value: number,
  label: string,
): void {
  if (!Number.isFinite(value)) {
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
  if (!Number.isInteger(value)) {
    throw new RenderCoreError(
      "INVALID_INTEGER",
      `${label} must be an integer.`,
    );
  }
}

function assertNonEmptyString(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new RenderCoreError(
      "INVALID_STRING",
      `${label} must be a non-empty string.`,
    );
  }
}

function isRenderRepresentation(
  value: unknown,
): value is RenderRepresentation {
  return (
    value === "2d" ||
    value === "3d" ||
    value === "hybrid"
  );
}

function isRenderQuality(
  value: unknown,
): value is RenderQuality {
  return (
    value === "draft" ||
    value === "preview" ||
    value === "production"
  );
}

function isRenderBackground(
  value: unknown,
): value is RenderBackground {
  return (
    value === "opaque" ||
    value === "transparent"
  );
}

function isRenderPixelFormat(
  value: unknown,
): value is RenderPixelFormat {
  return (
    value === "rgba8" ||
    value === "rgb8"
  );
}

function isRenderBackendKind(
  value: unknown,
): value is RenderBackendKind {
  return (
    value === "2d" ||
    value === "3d" ||
    value === "hybrid"
  );
}

function normalizeWarnings(
  warnings: unknown,
): string[] {
  if (warnings === undefined) {
    return [];
  }

  if (!Array.isArray(warnings)) {
    throw new RenderCoreError(
      "INVALID_BACKEND_OUTPUT",
      "Backend warnings must be an array.",
    );
  }

  return warnings.map(
    (warning, index) => {
      if (typeof warning !== "string") {
        throw new RenderCoreError(
          "INVALID_BACKEND_OUTPUT",
          `Backend warning at index ${index} must be a string.`,
        );
      }

      return warning;
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Frame / Tick Conversion                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Returns the canonical timeline ticks per second.
 *
 * FPS is validated because callers commonly pass it through this boundary,
 * but it does not alter the canonical clock.
 */
export function ticksPerSecond(
  fps: number,
): number {
  assertFinite(fps, "fps");

  if (fps <= 0 || fps > 240) {
    throw new RenderCoreError(
      "INVALID_FPS",
      "fps must be greater than 0 and no greater than 240.",
    );
  }

  return TICKS_PER_SECOND;
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

  const tps = ticksPerSecond(fps);

  return Math.round(
    frameNumber * tps / fps,
  );
}

export function tickToFrame(
  tick: number,
  fps: number,
): number {
  assertInteger(tick, "tick");

  if (tick < 0) {
    throw new RenderCoreError(
      "INVALID_TICK",
      "tick must not be negative.",
    );
  }

  const tps = ticksPerSecond(fps);

  return Math.round(
    tick * fps / tps,
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
    typeof resolution !== "object"
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

  if (
    resolution.width > 16_384 ||
    resolution.height > 16_384
  ) {
    throw new RenderCoreError(
      "RESOLUTION_TOO_LARGE",
      "Render resolution exceeds the core maximum of 16384x16384.",
    );
  }

  return {
    width: resolution.width,
    height: resolution.height,
  };
}

/* -------------------------------------------------------------------------- */
/* Backend Capabilities                                                       */
/* -------------------------------------------------------------------------- */

function validateCapabilities(
  capabilities: RenderCapabilities,
): RenderCapabilities {
  if (
    !capabilities ||
    typeof capabilities !== "object"
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "Render backend capabilities are required.",
    );
  }

  if (
    !isRenderBackendKind(
      capabilities.backend,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "Backend capabilities contain an invalid backend kind.",
    );
  }

  if (
    !Array.isArray(
      capabilities.representations,
    ) ||
    !capabilities.representations.every(
      isRenderRepresentation,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "Backend representations are invalid.",
    );
  }

  if (
    !Array.isArray(
      capabilities.qualities,
    ) ||
    !capabilities.qualities.every(
      isRenderQuality,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "Backend qualities are invalid.",
    );
  }

  if (
    !Array.isArray(
      capabilities.pixelFormats,
    ) ||
    !capabilities.pixelFormats.every(
      isRenderPixelFormat,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "Backend pixel formats are invalid.",
    );
  }

  if (
    typeof capabilities.transparentBackground !==
      "boolean"
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "transparentBackground must be boolean.",
    );
  }

  if (
    typeof capabilities.hardwareAcceleration !==
      "boolean"
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      "hardwareAcceleration must be boolean.",
    );
  }

  if (
    capabilities.maxWidth !== undefined
  ) {
    assertInteger(
      capabilities.maxWidth,
      "capabilities.maxWidth",
    );

    if (capabilities.maxWidth <= 0) {
      throw new RenderCoreError(
        "INVALID_BACKEND_CAPABILITIES",
        "capabilities.maxWidth must be positive.",
      );
    }
  }

  if (
    capabilities.maxHeight !== undefined
  ) {
    assertInteger(
      capabilities.maxHeight,
      "capabilities.maxHeight",
    );

    if (capabilities.maxHeight <= 0) {
      throw new RenderCoreError(
        "INVALID_BACKEND_CAPABILITIES",
        "capabilities.maxHeight must be positive.",
      );
    }
  }

  if (
    capabilities.backend === "2d" &&
    !capabilities.representations.includes("2d")
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      'A "2d" backend must advertise "2d" representation support.',
    );
  }

  if (
    capabilities.backend === "3d" &&
    !capabilities.representations.includes("3d")
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      'A "3d" backend must advertise "3d" representation support.',
    );
  }

  if (
    capabilities.backend === "hybrid" &&
    !capabilities.representations.includes("hybrid")
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_CAPABILITIES",
      'A "hybrid" backend must advertise "hybrid" representation support.',
    );
  }

  return clone(capabilities);
}

function backendSupportsRequest(
  backend: RenderBackend,
  request: RenderFrameRequest,
): boolean {
  const capabilities =
    validateCapabilities(
      backend.capabilities(),
    );

  if (
    !capabilities.representations.includes(
      request.representation,
    )
  ) {
    return false;
  }

  if (
    !capabilities.qualities.includes(
      request.quality,
    )
  ) {
    return false;
  }

  if (
    !capabilities.pixelFormats.includes(
      request.pixelFormat,
    )
  ) {
    return false;
  }

  if (
    request.background === "transparent" &&
    !capabilities.transparentBackground
  ) {
    return false;
  }

  if (
    capabilities.maxWidth !== undefined &&
    request.resolution.width >
      capabilities.maxWidth
  ) {
    return false;
  }

  if (
    capabilities.maxHeight !== undefined &&
    request.resolution.height >
      capabilities.maxHeight
  ) {
    return false;
  }

  return true;
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
    !isRenderRepresentation(
      representation,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_REPRESENTATION",
      `Unsupported representation "${String(
        representation,
      )}".`,
    );
  }

  if (available.length === 0) {
    throw new RenderCoreError(
      "NO_RENDER_BACKEND",
      "No render backend is registered.",
    );
  }

  if (requested !== undefined) {
    if (
      !isRenderBackendKind(
        requested,
      )
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_KIND",
        `Unsupported backend kind "${String(
          requested,
        )}".`,
      );
    }

    const exact =
      available.find(
        (backend) =>
          backend.kind === requested,
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
        backend.kind === representation &&
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
        backend.kind === "hybrid" &&
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
  return validateCapabilities(
    backend.capabilities(),
  ).representations.includes(
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
    typeof input !== "object"
  ) {
    throw new RenderCoreError(
      "INVALID_REQUEST",
      "Render request is required.",
    );
  }

  assertNonEmptyString(
    input.projectId,
    "projectId",
  );

  assertNonEmptyString(
    input.revisionId,
    "revisionId",
  );

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

  if (input.frameNumber < 0) {
    throw new RenderCoreError(
      "INVALID_FRAME",
      "frameNumber must not be negative.",
    );
  }

  if (input.tick < 0) {
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
    !isRenderQuality(
      input.quality,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_QUALITY",
      `Unsupported render quality "${String(
        input.quality,
      )}".`,
    );
  }

  if (
    !isRenderRepresentation(
      input.representation,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_REPRESENTATION",
      `Unsupported representation "${String(
        input.representation,
      )}".`,
    );
  }

  if (
    !isRenderBackground(
      input.background,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKGROUND",
      `Unsupported background mode "${String(
        input.background,
      )}".`,
    );
  }

  if (
    !isRenderPixelFormat(
      input.pixelFormat,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_PIXEL_FORMAT",
      `Unsupported pixel format "${String(
        input.pixelFormat,
      )}".`,
    );
  }

  if (
    input.background === "transparent" &&
    input.pixelFormat !== "rgba8"
  ) {
    throw new RenderCoreError(
      "INVALID_TRANSPARENCY_FORMAT",
      "Transparent rendering requires rgba8.",
    );
  }

  if (
    input.backend !== undefined &&
    !isRenderBackendKind(
      input.backend,
    )
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_KIND",
      `Unsupported backend kind "${String(
        input.backend,
      )}".`,
    );
  }

  const seed = input.seed ?? 0;

  assertInteger(seed, "seed");

  return {
    projectId: input.projectId.trim(),
    revisionId: input.revisionId.trim(),
    frameNumber: input.frameNumber,
    tick: input.tick,
    fps: input.fps,
    resolution,
    quality: input.quality,
    representation: input.representation,
    background: input.background,
    pixelFormat: input.pixelFormat,
    ...(input.backend !== undefined
      ? {
          backend: input.backend,
        }
      : {}),
    seed,
    metadata: clone(
      input.metadata ?? {},
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

  if (
    !isRenderBackendKind(backend)
  ) {
    throw new RenderCoreError(
      "INVALID_BACKEND_KIND",
      `Unsupported backend kind "${String(
        backend,
      )}".`,
    );
  }

  return {
    projectId: normalized.projectId,
    revisionId: normalized.revisionId,
    frameNumber: normalized.frameNumber,
    tick: normalized.tick,
    fps: normalized.fps,
    width: normalized.resolution.width,
    height: normalized.resolution.height,
    quality: normalized.quality,
    representation: normalized.representation,
    background: normalized.background,
    pixelFormat: normalized.pixelFormat,
    backend,
    seed: normalized.seed ?? 0,
  };
}

export function frameIdentityHash(
  identity: RenderFrameIdentity,
): string {
  return canonicalHash(identity) as string;
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
      typeof backend !== "object"
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND",
        "Render backend is required.",
      );
    }

    if (
      !isRenderBackendKind(
        backend.kind,
      )
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_KIND",
        `Unsupported backend kind "${String(
          backend.kind,
        )}".`,
      );
    }

    assertNonEmptyString(
      backend.version,
      "Render backend version",
    );

    if (
      typeof backend.capabilities !==
        "function"
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND",
        "Render backend must provide capabilities().",
      );
    }

    if (
      typeof backend.render !==
        "function"
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND",
        "Render backend must provide render().",
      );
    }

    const capabilities =
      validateCapabilities(
        backend.capabilities(),
      );

    if (
      capabilities.backend !==
      backend.kind
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_CAPABILITIES",
        `Backend "${backend.kind}" capability kind does not match backend kind.`,
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
    return this.backends.get(kind);
  }

  listBackends(): RenderBackend[] {
    return [
      ...this.backends.values(),
    ].sort(
      (a, b) =>
        a.kind.localeCompare(
          b.kind,
        ),
    );
  }

  capabilities(): RenderCapabilities[] {
    return this.listBackends().map(
      (backend) =>
        validateCapabilities(
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

    if (
      !backendSupportsRequest(
        backend,
        normalized,
      )
    ) {
      throw new RenderCoreError(
        "BACKEND_INCOMPATIBLE",
        `Render backend "${backend.kind}" does not support the requested render configuration.`,
      );
    }

    const identity =
      createFrameIdentity(
        normalized,
        backend.kind,
      );

    const identityHash =
      frameIdentityHash(identity);

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
    validateFrameState(frameState);

    const prepared =
      this.prepare(request);

    const startedAt =
      Date.now();

    let output:
      RenderBackendOutput;

    try {
      output =
        await prepared.backend.render(
          clone(prepared.request),
          clone(frameState),
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

    if (
      !output ||
      typeof output !== "object" ||
      Array.isArray(output)
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_OUTPUT",
        "Render backend must return an object.",
      );
    }

    if (
      output.frameHash !== undefined &&
      (
        typeof output.frameHash !==
          "string" ||
        output.frameHash.trim()
          .length === 0
      )
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_OUTPUT",
        "Backend frameHash must be a non-empty string when provided.",
      );
    }

    if (
      output.metadata !== undefined &&
      !isRecord(output.metadata)
    ) {
      throw new RenderCoreError(
        "INVALID_BACKEND_OUTPUT",
        "Backend metadata must be an object.",
      );
    }

    const warnings =
      normalizeWarnings(
        output.warnings,
      );

    if (
      output.durationMs !== undefined
    ) {
      assertFinite(
        output.durationMs,
        "Backend durationMs",
      );

      if (output.durationMs < 0) {
        throw new RenderCoreError(
          "INVALID_BACKEND_OUTPUT",
          "Backend durationMs must not be negative.",
        );
      }
    }

    const durationMs =
      output.durationMs ??
      Math.max(
        0,
        Date.now() - startedAt,
      );

    const stateHash =
      canonicalHash(
        frameState,
      ) as string;

    const frameHash =
      output.frameHash ??
      createHash("sha256")
        .update(
          prepared.identityHash,
        )
        .update(stateHash)
        .digest("hex");

    const diagnostics:
      RenderDiagnostics = {
      backend:
        prepared.backend.kind,
      rendererVersion:
        prepared.backend.version,
      durationMs,
      warnings,
      errors: [],
      deterministic: true,
    };

    return {
      schemaVersion:
        RENDER_CORE_SCHEMA_VERSION,
      status: "completed",
      identity:
        prepared.identity,
      frameHash,
      diagnostics,
      metadata:
        clone(
          output.metadata ?? {},
        ),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Deterministic Null Backend                                                 */
/* -------------------------------------------------------------------------- */

export class DeterministicNullBackend
  implements RenderBackend
{
  readonly kind:
    RenderBackendKind = "2d";

  readonly version = "1.0.0";

  capabilities():
    RenderCapabilities {
    return {
      backend: "2d",
      representations: ["2d"],
      qualities: [
        "draft",
        "preview",
        "production",
      ],
      pixelFormats: [
        "rgba8",
        "rgb8",
      ],
      transparentBackground: true,
      maxWidth: 16_384,
      maxHeight: 16_384,
      hardwareAcceleration: false,
    };
  }

  async render(
    request: RenderFrameRequest,
    frameState: unknown,
  ): Promise<RenderBackendOutput> {
    validateFrameState(frameState);

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
      createHash("sha256")
        .update(
          canonicalHash(identity) as string,
        )
        .update(stateHash)
        .digest("hex");

    return {
      frameHash,
      metadata: {
        backend:
          "deterministic-null",
        pixelOutput: false,
        width:
          normalized.resolution.width,
        height:
          normalized.resolution.height,
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
    typeof frameState !== "object" ||
    Array.isArray(frameState)
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