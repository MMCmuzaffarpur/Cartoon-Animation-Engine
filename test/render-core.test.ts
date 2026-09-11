import { describe, expect, it } from "vitest";

import {
  DEFAULT_RENDER_FPS,
  DEFAULT_RENDER_HEIGHT,
  DEFAULT_RENDER_QUALITY,
  DEFAULT_RENDER_WIDTH,
  DeterministicNullBackend,
  RenderCore,
  RenderCoreError,
  type RenderBackend,
  type RenderBackendOutput,
  type RenderCapabilities,
  type RenderFrameRequest,
  type RenderRepresentation,
  frameIdentityHash,
  frameToTick,
  normalizeRenderRequest,
  renderRequestFingerprint,
  selectBackend,
  tickToFrame,
  ticksPerSecond,
  validateFrameState,
  validateResolution,
} from "../packages/render-core/src/index.js";

/* -------------------------------------------------------------------------- */
/* Test Helpers                                                               */
/* -------------------------------------------------------------------------- */

function baseRequest(
  overrides: Partial<RenderFrameRequest> = {},
): RenderFrameRequest {
  return {
    projectId: "project-001",
    revisionId: "revision-001",
    frameNumber: 0,
    tick: 0,
    fps: DEFAULT_RENDER_FPS,
    resolution: {
      width: DEFAULT_RENDER_WIDTH,
      height: DEFAULT_RENDER_HEIGHT,
    },
    quality: DEFAULT_RENDER_QUALITY,
    representation: "2d",
    background: "opaque",
    pixelFormat: "rgba8",
    ...overrides,
  };
}

function makeBackend(
  kind: "2d" | "3d" | "hybrid",
  representations: RenderRepresentation[] = [
    kind,
  ],
  overrides: Partial<RenderCapabilities> = {},
  render?: RenderBackend["render"],
): RenderBackend {
  return {
    kind,
    version: "test-1.0.0",

    capabilities(): RenderCapabilities {
      return {
        backend: kind,
        representations,
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
        hardwareAcceleration: false,
        ...overrides,
      };
    },

    async render(
      request,
      frameState,
    ): Promise<RenderBackendOutput> {
      if (render) {
        return render(
          request,
          frameState,
        );
      }

      return {
        frameHash: `test-${request.frameNumber}-${request.tick}`,
        metadata: {
          rendered: true,
        },
        warnings: [],
        durationMs: 1,
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

describe("render-core constants", () => {
  it("exposes stable schema and default values", async () => {
    const module =
      await import(
        "../packages/render-core/src/index.js"
      );

    expect(
      module.RENDER_CORE_SCHEMA_VERSION,
    ).toBe("1.0.0");

    expect(
      DEFAULT_RENDER_FPS,
    ).toBe(30);

    expect(
      DEFAULT_RENDER_WIDTH,
    ).toBe(1280);

    expect(
      DEFAULT_RENDER_HEIGHT,
    ).toBe(720);

    expect(
      DEFAULT_RENDER_QUALITY,
    ).toBe("preview");
  });
});

/* -------------------------------------------------------------------------- */
/* Tick / Frame Conversion                                                     */
/* -------------------------------------------------------------------------- */

describe("render-core time conversion", () => {
  it("uses the canonical tick rate", () => {
    expect(
      ticksPerSecond(30),
    ).toBe(48_000);

    expect(
      ticksPerSecond(60),
    ).toBe(48_000);
  });

  it("converts frame zero to tick zero", () => {
    expect(
      frameToTick(0, 30),
    ).toBe(0);
  });

  it("converts a 30fps frame deterministically", () => {
    expect(
      frameToTick(30, 30),
    ).toBe(48_000);
  });

  it("converts a 60fps frame deterministically", () => {
    expect(
      frameToTick(60, 60),
    ).toBe(48_000);
  });

  it("round-trips exact frame positions", () => {
    for (const fps of [24, 25, 30, 50, 60, 120]) {
      for (const frame of [0, 1, 10, 30, 100]) {
        const tick =
          frameToTick(
            frame,
            fps,
          );

        expect(
          tickToFrame(
            tick,
            fps,
          ),
        ).toBe(frame);
      }
    }
  });

  it("rejects invalid fps", () => {
    expect(() =>
      ticksPerSecond(0),
    ).toThrow(
      "fps must be greater than 0",
    );

    expect(() =>
      ticksPerSecond(241),
    ).toThrow(
      "fps must be greater than 0",
    );

    expect(() =>
      ticksPerSecond(Number.NaN),
    ).toThrow(
      "fps must be finite.",
    );
  });

  it("rejects negative frame numbers", () => {
    expect(() =>
      frameToTick(-1, 30),
    ).toThrow(
      "frameNumber must not be negative.",
    );
  });

  it("rejects non-integer frame numbers", () => {
    expect(() =>
      frameToTick(1.5, 30),
    ).toThrow(
      "frameNumber must be an integer.",
    );
  });

  it("rejects negative ticks", () => {
    expect(() =>
      tickToFrame(-1, 30),
    ).toThrow(
      "tick must not be negative.",
    );
  });

  it("rejects non-integer ticks", () => {
    expect(() =>
      tickToFrame(1.5, 30),
    ).toThrow(
      "tick must be an integer.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

describe("render-core resolution", () => {
  it("accepts a valid resolution", () => {
    expect(
      validateResolution({
        width: 1920,
        height: 1080,
      }),
    ).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("returns a fresh resolution object", () => {
    const source = {
      width: 1280,
      height: 720,
    };

    const result =
      validateResolution(
        source,
      );

    expect(result).not.toBe(
      source,
    );
  });

  it("rejects zero dimensions", () => {
    expect(() =>
      validateResolution({
        width: 0,
        height: 720,
      }),
    ).toThrow(
      "Render resolution must be positive.",
    );
  });

  it("rejects negative dimensions", () => {
    expect(() =>
      validateResolution({
        width: -1,
        height: 720,
      }),
    ).toThrow(
      "Render resolution must be positive.",
    );
  });

  it("rejects fractional dimensions", () => {
    expect(() =>
      validateResolution({
        width: 1280.5,
        height: 720,
      }),
    ).toThrow(
      "resolution.width must be an integer.",
    );
  });

  it("rejects dimensions over the core maximum", () => {
    expect(() =>
      validateResolution({
        width: 16_385,
        height: 720,
      }),
    ).toThrow(
      "exceeds the core maximum",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Request Normalization                                                      */
/* -------------------------------------------------------------------------- */

describe("normalizeRenderRequest", () => {
  it("normalizes a valid request", () => {
    const request =
      normalizeRenderRequest(
        baseRequest(),
      );

    expect(request).toEqual({
      projectId: "project-001",
      revisionId: "revision-001",
      frameNumber: 0,
      tick: 0,
      fps: 30,
      resolution: {
        width: 1280,
        height: 720,
      },
      quality: "preview",
      representation: "2d",
      background: "opaque",
      pixelFormat: "rgba8",
      seed: 0,
      metadata: {},
    });
  });

  it("trims project and revision identifiers", () => {
    const request =
      normalizeRenderRequest(
        baseRequest({
          projectId:
            "  project-001  ",
          revisionId:
            "  revision-001  ",
        }),
      );

    expect(
      request.projectId,
    ).toBe("project-001");

    expect(
      request.revisionId,
    ).toBe("revision-001");
  });

  it("defaults an omitted seed to zero", () => {
    expect(
      normalizeRenderRequest(
        baseRequest(),
      ).seed,
    ).toBe(0);
  });

  it("preserves an explicit integer seed", () => {
    expect(
      normalizeRenderRequest(
        baseRequest({
          seed: 12345,
        }),
      ).seed,
    ).toBe(12345);
  });

  it("clones metadata", () => {
    const metadata = {
      source: "test",
      nested: {
        value: 1,
      },
    };

    const request =
      normalizeRenderRequest(
        baseRequest({
          metadata,
        }),
      );

    expect(
      request.metadata,
    ).toEqual(metadata);

    expect(
      request.metadata,
    ).not.toBe(metadata);

    (
      request.metadata!.nested as {
        value: number;
      }
    ).value = 99;

    expect(
      metadata.nested.value,
    ).toBe(1);
  });

  it("rejects an empty project id", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          projectId: "   ",
        }),
      ),
    ).toThrow(
      "projectId must be a non-empty string.",
    );
  });

  it("rejects an empty revision id", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          revisionId: "",
        }),
      ),
    ).toThrow(
      "revisionId must be a non-empty string.",
    );
  });

  it("rejects a negative frame", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          frameNumber: -1,
        }),
      ),
    ).toThrow(
      "frameNumber must not be negative.",
    );
  });

  it("rejects a negative tick", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          tick: -1,
        }),
      ),
    ).toThrow(
      "tick must not be negative.",
    );
  });

  it("rejects an invalid quality", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          quality: "ultra" as any,
        }),
      ),
    ).toThrow(
      'Unsupported render quality "ultra".',
    );
  });

  it("rejects an invalid representation", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          representation: "4d" as any,
        }),
      ),
    ).toThrow(
      'Unsupported representation "4d".',
    );
  });

  it("rejects an invalid background", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          background: "mask" as any,
        }),
      ),
    ).toThrow(
      'Unsupported background mode "mask".',
    );
  });

  it("rejects an invalid pixel format", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          pixelFormat: "rgb16" as any,
        }),
      ),
    ).toThrow(
      'Unsupported pixel format "rgb16".',
    );
  });

  it("requires rgba8 for transparency", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          background: "transparent",
          pixelFormat: "rgb8",
        }),
      ),
    ).toThrow(
      "Transparent rendering requires rgba8.",
    );
  });

  it("rejects an invalid seed", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          seed: 1.5,
        }),
      ),
    ).toThrow(
      "seed must be an integer.",
    );
  });

  it("rejects an invalid backend kind", () => {
    expect(() =>
      normalizeRenderRequest(
        baseRequest({
          backend: "gpu" as any,
        }),
      ),
    ).toThrow(
      'Unsupported backend kind "gpu".',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Backend Selection                                                          */
/* -------------------------------------------------------------------------- */

describe("selectBackend", () => {
  it("rejects an empty backend registry", () => {
    expect(() =>
      selectBackend(
        "2d",
        [],
      ),
    ).toThrow(
      "No render backend is registered.",
    );
  });

  it("selects the exact requested backend", () => {
    const backend =
      makeBackend("2d");

    expect(
      selectBackend(
        "2d",
        [backend],
        "2d",
      ),
    ).toBe(backend);
  });

  it("rejects a requested backend that is unavailable", () => {
    expect(() =>
      selectBackend(
        "2d",
        [makeBackend("3d")],
        "2d",
      ),
    ).toThrow(
      'Requested render backend "2d" is not available.',
    );
  });

  it("rejects a requested backend incompatible with representation", () => {
    const backend =
      makeBackend(
        "2d",
        ["2d"],
      );

    expect(() =>
      selectBackend(
        "3d",
        [backend],
        "2d",
      ),
    ).toThrow(
      'does not support representation "3d"',
    );
  });

  it("prefers a backend matching the representation", () => {
    const twoD =
      makeBackend("2d");

    const hybrid =
      makeBackend(
        "hybrid",
        ["2d", "hybrid"],
      );

    expect(
      selectBackend(
        "2d",
        [hybrid, twoD],
      ),
    ).toBe(twoD);
  });

  it("falls back to a compatible hybrid backend", () => {
    const hybrid =
      makeBackend(
        "hybrid",
        ["2d", "hybrid"],
      );

    expect(
      selectBackend(
        "2d",
        [hybrid],
      ),
    ).toBe(hybrid);
  });

  it("falls back to any compatible backend", () => {
    const backend =
      makeBackend(
        "hybrid",
        ["3d", "hybrid"],
      );

    expect(
      selectBackend(
        "3d",
        [backend],
      ),
    ).toBe(backend);
  });

  it("rejects when no backend supports the representation", () => {
    expect(() =>
      selectBackend(
        "3d",
        [makeBackend("2d")],
      ),
    ).toThrow(
      'No registered backend supports representation "3d".',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* RenderCore Registration                                                     */
/* -------------------------------------------------------------------------- */

describe("RenderCore registration", () => {
  it("starts with no registered backends", () => {
    const core =
      new RenderCore();

    expect(
      core.listBackends(),
    ).toEqual([]);

    expect(
      core.capabilities(),
    ).toEqual([]);
  });

  it("registers and retrieves a backend", () => {
    const core =
      new RenderCore();

    const backend =
      makeBackend("2d");

    core.registerBackend(
      backend,
    );

    expect(
      core.getBackend("2d"),
    ).toBe(backend);

    expect(
      core.listBackends(),
    ).toEqual([backend]);
  });

  it("replaces an existing backend of the same kind", () => {
    const core =
      new RenderCore();

    const first =
      makeBackend("2d");

    const second =
      makeBackend("2d");

    core.registerBackend(
      first,
    );

    core.registerBackend(
      second,
    );

    expect(
      core.getBackend("2d"),
    ).toBe(second);

    expect(
      core.listBackends(),
    ).toHaveLength(1);
  });

  it("unregisters a backend", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    expect(
      core.unregisterBackend(
        "2d",
      ),
    ).toBe(true);

    expect(
      core.getBackend("2d"),
    ).toBeUndefined();

    expect(
      core.unregisterBackend(
        "2d",
      ),
    ).toBe(false);
  });

  it("sorts backends deterministically", () => {
    const core =
      new RenderCore();

    const hybrid =
      makeBackend("hybrid");

    const twoD =
      makeBackend("2d");

    const threeD =
      makeBackend("3d");

    core.registerBackend(
      hybrid,
    );

    core.registerBackend(
      threeD,
    );

    core.registerBackend(
      twoD,
    );

    expect(
      core.listBackends().map(
        (backend) =>
          backend.kind,
      ),
    ).toEqual([
      "2d",
      "3d",
      "hybrid",
    ]);
  });

  it("rejects an empty backend version", () => {
    const core =
      new RenderCore();

    expect(() =>
      core.registerBackend({
        ...makeBackend("2d"),
        version: "   ",
      }),
    ).toThrow(
      "Render backend version must be a non-empty string.",
    );
  });

  it("rejects capability kind mismatches", () => {
    const core =
      new RenderCore();

    const backend =
      makeBackend(
        "2d",
        ["3d"],
      );

    const originalCapabilities =
      backend.capabilities.bind(backend);

    backend.capabilities =
      () => ({
        ...originalCapabilities(),
        backend: "3d",
      });

    expect(() =>
      core.registerBackend(
        backend,
      ),
    ).toThrow(
      "capability kind does not match backend kind",
    );
  });

  it("returns cloned capabilities", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    const capabilities =
      core.capabilities();

    capabilities[0]
      .representations
      .push("hybrid");

    expect(
      core.capabilities()[0]
        .representations,
    ).toEqual(["2d"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Prepare                                                                    */
/* -------------------------------------------------------------------------- */

describe("RenderCore.prepare", () => {
  it("normalizes request and selects backend", () => {
    const core =
      new RenderCore();

    const backend =
      makeBackend("2d");

    core.registerBackend(
      backend,
    );

    const prepared =
      core.prepare(
        baseRequest({
          projectId:
            " project-001 ",
          revisionId:
            " revision-001 ",
        }),
      );

    expect(
      prepared.backend,
    ).toBe(backend);

    expect(
      prepared.request.projectId,
    ).toBe("project-001");

    expect(
      prepared.request.revisionId,
    ).toBe("revision-001");

    expect(
      prepared.identity.backend,
    ).toBe("2d");

    expect(
      prepared.identityHash,
    ).toEqual(
      expect.any(String),
    );
  });

  it("rejects an unavailable requested backend", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    expect(() =>
      core.prepare(
        baseRequest({
          backend: "3d",
        }),
      ),
    ).toThrow(
      'Requested render backend "3d" is not available.',
    );
  });

  it("enforces backend quality capabilities", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {
          qualities: ["draft"],
        },
      ),
    );

    expect(() =>
      core.prepare(
        baseRequest({
          quality:
            "production",
        }),
      ),
    ).toThrow(
      "does not support the requested render configuration",
    );
  });

  it("enforces backend pixel format capabilities", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {
          pixelFormats: ["rgba8"],
        },
      ),
    );

    expect(() =>
      core.prepare(
        baseRequest({
          pixelFormat: "rgb8",
        }),
      ),
    ).toThrow(
      "does not support the requested render configuration",
    );
  });

  it("enforces transparent-background capability", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {
          transparentBackground:
            false,
        },
      ),
    );

    expect(() =>
      core.prepare(
        baseRequest({
          background:
            "transparent",
        }),
      ),
    ).toThrow(
      "does not support the requested render configuration",
    );
  });

  it("enforces maximum backend width", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {
          maxWidth: 640,
        },
      ),
    );

    expect(() =>
      core.prepare(
        baseRequest({
          resolution: {
            width: 1280,
            height: 720,
          },
        }),
      ),
    ).toThrow(
      "does not support the requested render configuration",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

describe("RenderCore.renderFrame", () => {
  it("renders through the selected backend", async () => {
    const core =
      new RenderCore();

    const backend =
      makeBackend("2d");

    core.registerBackend(
      backend,
    );

    const frameState = {
      schemaVersion: "1.0.0",
      projectId: "project-001",
      revisionId: "revision-001",
      tick: 0,
      entities: [],
      camera: {},
      audio: [],
      hash: "state-hash",
    };

    const result =
      await core.renderFrame(
        baseRequest(),
        frameState,
      );

    expect(
      result.schemaVersion,
    ).toBe("1.0.0");

    expect(
      result.status,
    ).toBe("completed");

    expect(
      result.identity.backend,
    ).toBe("2d");

    expect(
      result.frameHash,
    ).toBe("test-0-0");

    expect(
      result.diagnostics,
    ).toEqual({
      backend: "2d",
      rendererVersion:
        "test-1.0.0",
      durationMs: 1,
      warnings: [],
      errors: [],
      deterministic: true,
    });

    expect(
      result.metadata,
    ).toEqual({
      rendered: true,
    });
  });

  it("passes cloned request and frame state to the backend", async () => {
    const core =
      new RenderCore();

    let receivedRequest:
      RenderFrameRequest | undefined;

    let receivedState:
      any;

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async (
          request,
          frameState,
        ) => {
          receivedRequest =
            request;

          receivedState =
            frameState;

          return {
            durationMs: 0,
          };
        },
      ),
    );

    const request =
      baseRequest({
        metadata: {
          source: "test",
        },
      });

    const state = {
      value: 10,
    };

    await core.renderFrame(
      request,
      state,
    );

    expect(
      receivedRequest,
    ).not.toBe(request);

    expect(
      receivedState,
    ).not.toBe(state);

    expect(
      receivedRequest?.metadata,
    ).not.toBe(
      request.metadata,
    );
  });

  it("rejects a missing frame state", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        undefined,
      ),
    ).rejects.toThrow(
      "frameState is required.",
    );
  });

  it("rejects a primitive frame state", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        "invalid",
      ),
    ).rejects.toThrow(
      "frameState must be an object.",
    );
  });

  it("rejects an array frame state", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        [],
      ),
    ).rejects.toThrow(
      "frameState must be an object.",
    );
  });

  it("uses a deterministic fallback frame hash", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          metadata: {
            pixelOutput: false,
          },
          durationMs: 0,
        }),
      ),
    );

    const state = {
      value: 10,
    };

    const first =
      await core.renderFrame(
        baseRequest(),
        state,
      );

    const second =
      await core.renderFrame(
        baseRequest(),
        state,
      );

    expect(
      first.frameHash,
    ).toBe(
      second.frameHash,
    );
  });

  it("uses backend frame hash when supplied", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          frameHash:
            "backend-hash",
          durationMs: 0,
        }),
      ),
    );

    const result =
      await core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      );

    expect(
      result.frameHash,
    ).toBe("backend-hash");
  });

  it("preserves backend warnings", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          warnings: [
            "first warning",
            "second warning",
          ],
          durationMs: 0,
        }),
      ),
    );

    const result =
      await core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      );

    expect(
      result.diagnostics.warnings,
    ).toEqual([
      "first warning",
      "second warning",
    ]);
  });

  it("wraps backend failures in RenderCoreError", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => {
          throw new Error(
            "renderer exploded",
          );
        },
      ),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      ),
    ).rejects.toMatchObject({
      name: "RenderCoreError",
      code:
        "RENDER_BACKEND_FAILED",
      message:
        'Render backend "2d" failed: renderer exploded',
    });
  });

  it("rejects invalid backend output", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () =>
          null as any,
      ),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      ),
    ).rejects.toThrow(
      "Render backend must return an object.",
    );
  });

  it("rejects an invalid backend frame hash", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          frameHash: "   ",
        }),
      ),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      ),
    ).rejects.toThrow(
      "Backend frameHash must be a non-empty string",
    );
  });

  it("rejects invalid backend metadata", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          metadata: [] as any,
        }),
      ),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      ),
    ).rejects.toThrow(
      "Backend metadata must be an object.",
    );
  });

  it("rejects invalid backend warnings", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          warnings: [
            "ok",
            123,
          ] as any,
        }),
      ),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      ),
    ).rejects.toThrow(
      "Backend warning at index 1 must be a string.",
    );
  });

  it("rejects negative backend duration", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          durationMs: -1,
        }),
      ),
    );

    await expect(
      core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      ),
    ).rejects.toThrow(
      "Backend durationMs must not be negative.",
    );
  });

  it("isolates returned metadata from backend metadata", async () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend(
        "2d",
        ["2d"],
        {},
        async () => ({
          metadata: {
            nested: {
              value: 1,
            },
          },
          durationMs: 0,
        }),
      ),
    );

    const result =
      await core.renderFrame(
        baseRequest(),
        {
          value: 1,
        },
      );

    const nested =
      result.metadata.nested as {
        value: number;
      };

    nested.value = 99;

    expect(
      result.metadata.nested,
    ).toEqual({
      value: 99,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Deterministic Null Backend                                                  */
/* -------------------------------------------------------------------------- */

describe("DeterministicNullBackend", () => {
  it("advertises the canonical 2d capabilities", () => {
    const backend =
      new DeterministicNullBackend();

    expect(
      backend.kind,
    ).toBe("2d");

    expect(
      backend.version,
    ).toBe("1.0.0");

    expect(
      backend.capabilities(),
    ).toEqual({
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
      maxWidth: 16_384,
      maxHeight: 16_384,
      hardwareAcceleration:
        false,
    });
  });

  it("produces deterministic output without pixels", async () => {
    const backend =
      new DeterministicNullBackend();

    const request =
      baseRequest();

    const state = {
      value: 1,
    };

    const first =
      await backend.render(
        request,
        state,
      );

    const second =
      await backend.render(
        request,
        state,
      );

    expect(
      first.frameHash,
    ).toBe(
      second.frameHash,
    );

    expect(
      first.metadata,
    ).toEqual({
      backend:
        "deterministic-null",
      pixelOutput: false,
      width: 1280,
      height: 720,
    });

    expect(
      first.warnings,
    ).toEqual([
      "DeterministicNullBackend does not produce pixel data.",
    ]);

    expect(
      first.durationMs,
    ).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Fingerprints / Identity                                                    */
/* -------------------------------------------------------------------------- */

describe("render-core fingerprints", () => {
  it("produces a stable request fingerprint", () => {
    const first =
      renderRequestFingerprint(
        baseRequest(),
      );

    const second =
      renderRequestFingerprint(
        baseRequest(),
      );

    expect(first).toBe(
      second,
    );

    expect(first).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("changes request fingerprint when frame changes", () => {
    const first =
      renderRequestFingerprint(
        baseRequest({
          frameNumber: 1,
          tick: 1600,
        }),
      );

    const second =
      renderRequestFingerprint(
        baseRequest({
          frameNumber: 2,
          tick: 3200,
        }),
      );

    expect(first).not.toBe(
      second,
    );
  });

  it("changes request fingerprint when seed changes", () => {
    const first =
      renderRequestFingerprint(
        baseRequest({
          seed: 1,
        }),
      );

    const second =
      renderRequestFingerprint(
        baseRequest({
          seed: 2,
        }),
      );

    expect(first).not.toBe(
      second,
    );
  });

  it("produces a stable frame identity hash", () => {
    const core =
      new RenderCore();

    core.registerBackend(
      makeBackend("2d"),
    );

    const prepared =
      core.prepare(
        baseRequest(),
      );

    const direct =
      frameIdentityHash(
        prepared.identity,
      );

    expect(direct).toBe(
      prepared.identityHash,
    );

    expect(direct).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Public Validation                                                          */
/* -------------------------------------------------------------------------- */

describe("validateFrameState", () => {
  it("accepts objects", () => {
    expect(() =>
      validateFrameState({
        schemaVersion:
          "1.0.0",
      }),
    ).not.toThrow();
  });

  it("accepts empty objects", () => {
    expect(() =>
      validateFrameState({}),
    ).not.toThrow();
  });

  it("rejects null", () => {
    expect(() =>
      validateFrameState(null),
    ).toThrow(
      "frameState is required.",
    );
  });

  it("rejects undefined", () => {
    expect(() =>
      validateFrameState(
        undefined,
      ),
    ).toThrow(
      "frameState is required.",
    );
  });

  it("rejects primitives", () => {
    for (const value of [
      "state",
      1,
      true,
    ]) {
      expect(() =>
        validateFrameState(
          value,
        ),
      ).toThrow(
        "frameState must be an object.",
      );
    }
  });

  it("rejects arrays", () => {
    expect(() =>
      validateFrameState([]),
    ).toThrow(
      "frameState must be an object.",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Error Contract                                                              */
/* -------------------------------------------------------------------------- */

describe("RenderCoreError", () => {
  it("preserves name, code and details", () => {
    const details = {
      reason: "test",
    };

    const error =
      new RenderCoreError(
        "TEST_ERROR",
        "Test error",
        details,
      );

    expect(error).toBeInstanceOf(
      Error,
    );

    expect(
      error.name,
    ).toBe("RenderCoreError");

    expect(
      error.code,
    ).toBe("TEST_ERROR");

    expect(
      error.message,
    ).toBe("Test error");

    expect(
      error.details,
    ).toEqual(details);
  });
});
