import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PLUGIN_SDK_VERSION,
  type PluginAdapter,
  type PluginManifest,
} from "../packages/plugin-sdk/src/index.js";

import {
  PLUGIN_RUNTIME_VERSION,
  PluginRuntime,
  createPluginRuntime,
  type PluginRuntimePlugin,
} from "../packages/plugin-runtime/src/index.js";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ENGINE_VERSION = "1.0.0";

const RENDER_PLUGIN_ID =
  "plugin.test.renderer";

const PLANNER_PLUGIN_ID =
  "plugin.test.planner";

const FAILING_PLUGIN_ID =
  "plugin.test.failing";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function createManifest(
  overrides: Partial<PluginManifest> = {},
): PluginManifest {
  return {
    pluginId:
      "plugin.test.default",
    pluginVersion:
      "1.0.0",
    sdkVersion:
      PLUGIN_SDK_VERSION,
    name:
      "Test Plugin",
    kind:
      "custom",
    description:
      "Test plugin",
    author:
      "Test Author",
    license:
      "MIT",
    adapterId:
      "adapter.test.default",
    adapterVersion:
      "1.0.0",
    ...overrides,
  };
}

function createAdapter(
  options: {
    readonly adapterId?: string;
    readonly adapterVersion?: string;
    readonly capabilities?: Record<
      string,
      "supported" |
        "unsupported" |
        "experimental"
    >;
  } = {},
): PluginAdapter {
  const adapterId =
    options.adapterId ??
    "adapter.test.default";

  const adapterVersion =
    options.adapterVersion ??
    "1.0.0";

  return {
    adapterId,
    adapterVersion,

    capabilities() {
      return {
        adapterId,
        adapterVersion,
        contractVersion:
          "1.0.0",
        capabilities:
          options.capabilities ??
          {
            "test.basic":
              "supported",
          },
      };
    },
  };
}

function createRegisteredRuntime(
  options: {
    readonly manifest?: Partial<PluginManifest>;
    readonly adapter?: PluginAdapter;
  } = {},
): {
  runtime: PluginRuntime;
  plugin: PluginRuntimePlugin;
} {
  const runtime =
    createPluginRuntime({
      engineVersion:
        ENGINE_VERSION,
    });

  runtime.start();

  const adapter =
    options.adapter ??
    createAdapter({
      adapterId:
        options.manifest
          ?.adapterId ??
        "adapter.test.default",
      adapterVersion:
        options.manifest
          ?.adapterVersion ??
        "1.0.0",
    });

  const manifest =
    createManifest({
      ...options.manifest,
      adapterId:
        adapter.adapterId,
      adapterVersion:
        adapter.adapterVersion,
    });

  const plugin =
    runtime.register(
      manifest,
      adapter,
    );

  return {
    runtime,
    plugin,
  };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe("plugin-runtime", () => {
  describe("constants", () => {
    it("exposes the runtime version", () => {
      expect(
        PLUGIN_RUNTIME_VERSION,
      ).toBe("1.0.0");
    });

    it("uses the Plugin SDK version by default", () => {
      const runtime =
        createPluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        runtime.snapshot()
          .sdkVersion,
      ).toBe(
        PLUGIN_SDK_VERSION,
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Construction                                                             */
  /* ------------------------------------------------------------------------ */

  describe("construction", () => {
    it("creates a runtime in created state", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        runtime.getState(),
      ).toBe("created");

      expect(
        runtime.isRunning(),
      ).toBe(false);

      expect(
        runtime.isStopped(),
      ).toBe(false);
    });

    it("requires a non-empty engine version", () => {
      expect(
        () =>
          new PluginRuntime({
            engineVersion:
              "   ",
          }),
      ).toThrow(
        "Engine version must be a non-empty string.",
      );
    });

    it("accepts a custom SDK version", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
          sdkVersion:
            "1.2.0",
        });

      expect(
        runtime.snapshot()
          .sdkVersion,
      ).toBe("1.2.0");
    });

    it("defaults to isolate failure policy", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        runtime.snapshot()
          .failurePolicy,
      ).toBe("isolate");
    });

    it("accepts fail-fast failure policy", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
          failurePolicy:
            "fail-fast",
        });

      expect(
        runtime.snapshot()
          .failurePolicy,
      ).toBe("fail-fast");
    });

    it("rejects an invalid failure policy", () => {
      expect(
        () =>
          new PluginRuntime({
            engineVersion:
              ENGINE_VERSION,
            failurePolicy:
              "invalid" as never,
          }),
      ).toThrow(
        "Unsupported failure policy: invalid",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Lifecycle                                                                */
  /* ------------------------------------------------------------------------ */

  describe("lifecycle", () => {
    it("starts the runtime", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const snapshot =
        runtime.start();

      expect(
        runtime.getState(),
      ).toBe("running");

      expect(
        runtime.isRunning(),
      ).toBe(true);

      expect(
        snapshot.state,
      ).toBe("running");
    });

    it("starting an already running runtime is idempotent", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const first =
        runtime.start();

      const second =
        runtime.start();

      expect(second).toEqual(
        first,
      );
    });

    it("stops the runtime", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.start();

      const snapshot =
        runtime.stop();

      expect(
        runtime.getState(),
      ).toBe("stopped");

      expect(
        runtime.isStopped(),
      ).toBe(true);

      expect(
        snapshot.state,
      ).toBe("stopped");
    });

    it("stopping an already stopped runtime is idempotent", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.start();
      runtime.stop();

      const snapshot =
        runtime.stop();

      expect(
        snapshot.state,
      ).toBe("stopped");
    });

    it("does not allow restart after stop", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.start();
      runtime.stop();

      expect(
        () => runtime.start(),
      ).toThrow(
        "Plugin runtime cannot be restarted after it has been stopped.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Registration                                                             */
  /* ------------------------------------------------------------------------ */

  describe("registration", () => {
    it("registers a plugin", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const manifest =
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          name:
            "Renderer Plugin",
          kind:
            "renderer",
          adapterId:
            "adapter.renderer",
        });

      const adapter =
        createAdapter({
          adapterId:
            "adapter.renderer",
          capabilities: {
            "render.2d":
              "supported",
          },
        });

      const plugin =
        runtime.register(
          manifest,
          adapter,
        );

      expect(
        plugin.pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );

      expect(
        plugin.manifest.name,
      ).toBe(
        "Renderer Plugin",
      );

      expect(
        plugin.manifest.kind,
      ).toBe("renderer");

      expect(
        plugin.state,
      ).toBe("registered");

      expect(
        plugin.capabilities
          .capabilities[
          "render.2d"
        ],
      ).toBe("supported");

      expect(
        runtime.size(),
      ).toBe(1);
    });

    it("registers multiple plugins", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterId:
            "adapter.renderer",
        }),
        createAdapter({
          adapterId:
            "adapter.renderer",
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            PLANNER_PLUGIN_ID,
          adapterId:
            "adapter.planner",
          kind:
            "planner",
        }),
        createAdapter({
          adapterId:
            "adapter.planner",
        }),
      );

      expect(
        runtime.size(),
      ).toBe(2);
    });

    it("rejects duplicate plugin ids", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const manifest =
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
        });

      runtime.register(
        manifest,
        createAdapter(),
      );

      expect(
        () =>
          runtime.register(
            manifest,
            createAdapter(),
          ),
      ).toThrow(
        `Plugin already registered: ${RENDER_PLUGIN_ID}`,
      );
    });

    it("rejects adapter id mismatch", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const manifest =
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterId:
            "adapter.manifest",
        });

      const adapter =
        createAdapter({
          adapterId:
            "adapter.actual",
        });

      expect(
        () =>
          runtime.register(
            manifest,
            adapter,
          ),
      ).toThrow();

      expect(
        runtime.size(),
      ).toBe(0);
    });

    it("rejects adapter version mismatch", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const manifest =
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterVersion:
            "1.0.0",
        });

      const adapter =
        createAdapter({
          adapterVersion:
            "2.0.0",
        });

      expect(
        () =>
          runtime.register(
            manifest,
            adapter,
          ),
      ).toThrow();

      expect(
        runtime.size(),
      ).toBe(0);
    });

    it("rejects a plugin whose capabilities method throws", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const adapter: PluginAdapter =
        {
          adapterId:
            "adapter.throwing",

          adapterVersion:
            "1.0.0",

          capabilities() {
            throw new Error(
              "capability failure",
            );
          },
        };

      const manifest =
        createManifest({
          pluginId:
            "plugin.throwing",
          adapterId:
            "adapter.throwing",
        });

      expect(
        () =>
          runtime.register(
            manifest,
            adapter,
          ),
      ).toThrow(
        "Invalid plugin: Plugin capabilities() failed: capability failure",
      );

      expect(
        runtime.size(),
      ).toBe(0);
    });

    it("does not retain a mutable manifest object reference", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      const manifest =
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
        });

      runtime.register(
        manifest,
        createAdapter(),
      );

      (
        manifest as {
          name: string;
        }
      ).name =
        "Mutated Outside";

      expect(
        runtime.require(
          RENDER_PLUGIN_ID,
        ).manifest.name,
      ).toBe(
        "Test Plugin",
      );
    });

    it("does not retain a mutable capabilities object reference", () => {
      const capabilities: Record<
  string,
  "supported" |
    "unsupported" |
    "experimental"
> = {
  "test.basic":
    "supported",
};
      const adapter: PluginAdapter =
        {
          adapterId:
            "adapter.mutable",

          adapterVersion:
            "1.0.0",

          capabilities() {
            return {
              adapterId:
                "adapter.mutable",

              adapterVersion:
                "1.0.0",

              contractVersion:
                "1.0.0",

              capabilities,
            };
          },
        };

      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            "plugin.mutable",
          adapterId:
            "adapter.mutable",
        }),
        adapter,
      );

      capabilities[
        "test.basic"
      ] = "unsupported";

      expect(
        runtime.require(
          "plugin.mutable",
        ).capabilities
          .capabilities[
          "test.basic"
        ],
      ).toBe("supported");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  describe("loading", () => {
    it("loads and enables a registered plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      const plugin =
        runtime.load(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("enabled");

      expect(
        plugin.loadedAt,
      ).toBeTruthy();

      expect(
        plugin.enabledAt,
      ).toBeTruthy();
    });

    it("loading an enabled plugin is idempotent", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      const first =
        runtime.load(
          RENDER_PLUGIN_ID,
        );

      const second =
        runtime.load(
          RENDER_PLUGIN_ID,
        );

      expect(
        second.loadedAt,
      ).toBe(
        first.loadedAt,
      );

      expect(
        second.enabledAt,
      ).toBe(
        first.enabledAt,
      );
    });

    it("loads a disabled plugin again", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.load(
        RENDER_PLUGIN_ID,
      );

      runtime.disable(
        RENDER_PLUGIN_ID,
      );

      const plugin =
        runtime.load(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("enabled");
    });

    it("cannot load a failed plugin", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              FAILING_PLUGIN_ID,
          },
        });

      runtime.load(
        FAILING_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          FAILING_PLUGIN_ID,
          "test",
          async () => {
            throw new Error(
              "boom",
            );
          },
        ),
      ).rejects.toThrow(
        "Plugin execution failed: boom",
      );

      expect(
        () =>
          runtime.load(
            FAILING_PLUGIN_ID,
          ),
      ).toThrow(
        `Cannot load failed plugin: ${FAILING_PLUGIN_ID}`,
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Enable / Disable                                                         */
  /* ------------------------------------------------------------------------ */

  describe("enable and disable", () => {
    it("enables a registered plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      const plugin =
        runtime.enable(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("enabled");

      expect(
        plugin.enabledAt,
      ).toBeTruthy();
    });

    it("disables an enabled plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      const plugin =
        runtime.disable(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("disabled");

      expect(
        plugin.disabledAt,
      ).toBeTruthy();
    });

    it("disabling an already disabled plugin is safe", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.disable(
        RENDER_PLUGIN_ID,
      );

      const plugin =
        runtime.disable(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("disabled");
    });

    it("cannot enable a failed plugin", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              FAILING_PLUGIN_ID,
          },
        });

      runtime.load(
        FAILING_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          FAILING_PLUGIN_ID,
          "failure",
          async () => {
            throw new Error(
              "failure",
            );
          },
        ),
      ).rejects.toThrow();

      expect(
        () =>
          runtime.enable(
            FAILING_PLUGIN_ID,
          ),
      ).toThrow(
        `Cannot enable failed plugin: ${FAILING_PLUGIN_ID}`,
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Unload                                                                   */
  /* ------------------------------------------------------------------------ */

  describe("unload", () => {
    it("unloads an enabled plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.load(
        RENDER_PLUGIN_ID,
      );

      const plugin =
        runtime.unload(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("disabled");

      expect(
        plugin.disabledAt,
      ).toBeTruthy();
    });

    it("unloading a registered plugin disables it", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      const plugin =
        runtime.unload(
          RENDER_PLUGIN_ID,
        );

      expect(
        plugin.state,
      ).toBe("disabled");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Lookup                                                                   */
  /* ------------------------------------------------------------------------ */

  describe("lookup", () => {
    it("gets a registered plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      expect(
        runtime.get(
          RENDER_PLUGIN_ID,
        ),
      ).toBeTruthy();
    });

    it("returns undefined for an unknown plugin", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        runtime.get(
          "plugin.unknown",
        ),
      ).toBeUndefined();
    });

    it("requires a known plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      expect(
        runtime.require(
          RENDER_PLUGIN_ID,
        ).pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );
    });

    it("throws when requiring an unknown plugin", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        () =>
          runtime.require(
            "plugin.unknown",
          ),
      ).toThrow(
        "Plugin not found: plugin.unknown",
      );
    });

    it("lists all plugins", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterId:
            "adapter.renderer",
        }),
        createAdapter({
          adapterId:
            "adapter.renderer",
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            PLANNER_PLUGIN_ID,
          adapterId:
            "adapter.planner",
          kind:
            "planner",
        }),
        createAdapter({
          adapterId:
            "adapter.planner",
        }),
      );

      expect(
        runtime.list(),
      ).toHaveLength(2);
    });

    it("returns only enabled plugins", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterId:
            "adapter.renderer",
        }),
        createAdapter({
          adapterId:
            "adapter.renderer",
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            PLANNER_PLUGIN_ID,
          adapterId:
            "adapter.planner",
          kind:
            "planner",
        }),
        createAdapter({
          adapterId:
            "adapter.planner",
        }),
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      expect(
        runtime.enabled(),
      ).toHaveLength(1);

      expect(
        runtime.enabled()[0]
          .pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );
    });

    it("filters plugins by kind", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterId:
            "adapter.renderer",
          kind:
            "renderer",
        }),
        createAdapter({
          adapterId:
            "adapter.renderer",
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            PLANNER_PLUGIN_ID,
          adapterId:
            "adapter.planner",
          kind:
            "planner",
        }),
        createAdapter({
          adapterId:
            "adapter.planner",
        }),
      );

      const renderers =
        runtime.byKind(
          "renderer",
        );

      expect(
        renderers,
      ).toHaveLength(1);

      expect(
        renderers[0].pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Capability Resolution                                                    */
  /* ------------------------------------------------------------------------ */

  describe("capability resolution", () => {
    it("finds supported capabilities", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
        }),
        createAdapter({
          capabilities: {
            "render.2d":
              "supported",
          },
        }),
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      const matches =
        runtime.findCapability(
          "render.2d",
        );

      expect(
        matches,
      ).toHaveLength(1);

      expect(
        matches[0].pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );

      expect(
        matches[0].status,
      ).toBe("supported");
    });

    it("does not return disabled plugins in capability lookup", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
          adapter:
            createAdapter({
              capabilities: {
                "render.2d":
                  "supported",
              },
            }),
        });

      runtime.disable(
        RENDER_PLUGIN_ID,
      );

      expect(
        runtime.findCapability(
          "render.2d",
        ),
      ).toEqual([]);
    });

    it("does not return experimental capabilities by default", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
        }),
        createAdapter({
          capabilities: {
            "render.future":
              "experimental",
          },
        }),
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      expect(
        runtime.findCapability(
          "render.future",
        ),
      ).toEqual([]);
    });

    it("returns experimental capabilities when requested", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
        }),
        createAdapter({
          capabilities: {
            "render.future":
              "experimental",
          },
        }),
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      const matches =
        runtime.findCapability(
          "render.future",
          {
            includeExperimental:
              true,
          },
        );

      expect(
        matches,
      ).toHaveLength(1);

      expect(
        matches[0].status,
      ).toBe(
        "experimental",
      );
    });

    it("filters capabilities by plugin kind", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          kind:
            "renderer",
          adapterId:
            "adapter.renderer",
        }),
        createAdapter({
          adapterId:
            "adapter.renderer",
          capabilities: {
            "render.shared":
              "supported",
          },
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            PLANNER_PLUGIN_ID,
          kind:
            "planner",
          adapterId:
            "adapter.planner",
        }),
        createAdapter({
          adapterId:
            "adapter.planner",
          capabilities: {
            "render.shared":
              "supported",
          },
        }),
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      runtime.enable(
        PLANNER_PLUGIN_ID,
      );

      const matches =
        runtime.findCapability(
          "render.shared",
          {
            kind:
              "renderer",
          },
        );

      expect(
        matches,
      ).toHaveLength(1);

      expect(
        matches[0].pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );
    });

    it("resolves a supported capability", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
        }),
        createAdapter(),
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      const plugin =
        runtime.resolveCapability(
          "test.basic",
        );

      expect(
        plugin.pluginId,
      ).toBe(
        RENDER_PLUGIN_ID,
      );
    });

    it("prefers supported over experimental", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            "plugin.experimental",
          adapterId:
            "adapter.experimental",
        }),
        createAdapter({
          adapterId:
            "adapter.experimental",
          capabilities: {
            "render.test":
              "experimental",
          },
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            "plugin.supported",
          adapterId:
            "adapter.supported",
        }),
        createAdapter({
          adapterId:
            "adapter.supported",
          capabilities: {
            "render.test":
              "supported",
          },
        }),
      );

      runtime.enable(
        "plugin.experimental",
      );

      runtime.enable(
        "plugin.supported",
      );

      const plugin =
        runtime.resolveCapability(
          "render.test",
          {
            includeExperimental:
              true,
          },
        );

      expect(
        plugin.pluginId,
      ).toBe(
        "plugin.supported",
      );
    });

    it("uses deterministic plugin-id ordering when multiple plugins match", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.register(
        createManifest({
          pluginId:
            "plugin.z",
          adapterId:
            "adapter.z",
        }),
        createAdapter({
          adapterId:
            "adapter.z",
          capabilities: {
            "render.same":
              "supported",
          },
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            "plugin.a",
          adapterId:
            "adapter.a",
        }),
        createAdapter({
          adapterId:
            "adapter.a",
          capabilities: {
            "render.same":
              "supported",
          },
        }),
      );

      runtime.enable(
        "plugin.z",
      );

      runtime.enable(
        "plugin.a",
      );

      const plugin =
        runtime.resolveCapability(
          "render.same",
        );

      expect(
        plugin.pluginId,
      ).toBe(
        "plugin.a",
      );
    });

    it("throws when capability is unavailable", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        () =>
          runtime.resolveCapability(
            "render.missing",
          ),
      ).toThrow(
        "No enabled plugin provides capability: render.missing",
      );
    });

    it("returns a cloned capability inventory", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
          adapter:
            createAdapter({
              capabilities: {
                "render.2d":
                  "supported",
              },
            }),
        });

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      const first =
        runtime.capabilityInventory();

      first[0].capabilities[
        "render.2d"
      ] = "unsupported";

      const second =
        runtime.capabilityInventory();

      expect(
        second[0].capabilities[
          "render.2d"
        ],
      ).toBe("supported");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Execution                                                                */
  /* ------------------------------------------------------------------------ */

  describe("execution", () => {
    it("executes an enabled plugin", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      const result =
        await runtime.execute(
          RENDER_PLUGIN_ID,
          "render",
          async (adapter) =>
            adapter.adapterId,
        );

      expect(result).toBe(
        "adapter.test.default",
      );
    });

    it("does not execute a disabled plugin", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.disable(
        RENDER_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          RENDER_PLUGIN_ID,
          "render",
          async () => "never",
        ),
      ).rejects.toThrow(
        `Plugin is not enabled: ${RENDER_PLUGIN_ID}`,
      );
    });

    it("isolates plugin execution failure", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              FAILING_PLUGIN_ID,
          },
        });

      runtime.enable(
        FAILING_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          FAILING_PLUGIN_ID,
          "render",
          async () => {
            throw new Error(
              "render failure",
            );
          },
        ),
      ).rejects.toThrow(
        "Plugin execution failed: render failure",
      );

      expect(
        runtime.get(
          FAILING_PLUGIN_ID,
        )?.state,
      ).toBe("failed");

      expect(
        runtime.get(
          FAILING_PLUGIN_ID,
        )?.failure?.operation,
      ).toBe("render");
    });

    it("does not affect another plugin when one plugin fails", async () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
          failurePolicy:
            "isolate",
        });

      runtime.register(
        createManifest({
          pluginId:
            FAILING_PLUGIN_ID,
          adapterId:
            "adapter.failing",
        }),
        createAdapter({
          adapterId:
            "adapter.failing",
        }),
      );

      runtime.register(
        createManifest({
          pluginId:
            RENDER_PLUGIN_ID,
          adapterId:
            "adapter.working",
        }),
        createAdapter({
          adapterId:
            "adapter.working",
        }),
      );

      runtime.enable(
        FAILING_PLUGIN_ID,
      );

      runtime.enable(
        RENDER_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          FAILING_PLUGIN_ID,
          "test",
          async () => {
            throw new Error(
              "isolated failure",
            );
          },
        ),
      ).rejects.toThrow();

      expect(
        runtime.get(
          RENDER_PLUGIN_ID,
        )?.state,
      ).toBe("enabled");

      const result =
        await runtime.execute(
          RENDER_PLUGIN_ID,
          "test",
          async (adapter) =>
            adapter.adapterId,
        );

      expect(result).toBe(
        "adapter.working",
      );
    });

    it("stops the runtime under fail-fast policy", async () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
          failurePolicy:
            "fail-fast",
        });

      runtime.start();

      runtime.register(
        createManifest({
          pluginId:
            FAILING_PLUGIN_ID,
        }),
        createAdapter(),
      );

      runtime.enable(
        FAILING_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          FAILING_PLUGIN_ID,
          "render",
          async () => {
            throw new Error(
              "fatal plugin error",
            );
          },
        ),
      ).rejects.toThrow(
        "Plugin execution failed: fatal plugin error",
      );

      expect(
        runtime.getState(),
      ).toBe("stopped");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Removal                                                                  */
  /* ------------------------------------------------------------------------ */

  describe("removal", () => {
    it("removes a registered plugin", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      expect(
        runtime.remove(
          RENDER_PLUGIN_ID,
        ),
      ).toBe(true);

      expect(
        runtime.size(),
      ).toBe(0);

      expect(
        runtime.get(
          RENDER_PLUGIN_ID,
        ),
      ).toBeUndefined();
    });

    it("returns false when removing an unknown plugin", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        runtime.remove(
          "plugin.unknown",
        ),
      ).toBe(false);
    });

    it("removes a failed plugin", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              FAILING_PLUGIN_ID,
          },
        });

      runtime.enable(
        FAILING_PLUGIN_ID,
      );

      await expect(
        runtime.execute(
          FAILING_PLUGIN_ID,
          "test",
          async () => {
            throw new Error(
              "failure",
            );
          },
        ),
      ).rejects.toThrow();

      expect(
        runtime.remove(
          FAILING_PLUGIN_ID,
        ),
      ).toBe(true);

      expect(
        runtime.get(
          FAILING_PLUGIN_ID,
        ),
      ).toBeUndefined();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Snapshot Isolation                                                       */
  /* ------------------------------------------------------------------------ */

  describe("snapshot isolation", () => {
    it("returns an independent manifest snapshot", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      const snapshot =
        runtime.get(
          RENDER_PLUGIN_ID,
        );

      expect(
        snapshot,
      ).toBeTruthy();

      (
        snapshot!.manifest as {
          name: string;
        }
      ).name =
        "Changed Snapshot";

      expect(
        runtime.get(
          RENDER_PLUGIN_ID,
        )!.manifest.name,
      ).toBe(
        "Test Plugin",
      );
    });

    it("returns an independent capabilities snapshot", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
          adapter:
            createAdapter({
              capabilities: {
                "render.2d":
                  "supported",
              },
            }),
        });

      const snapshot =
        runtime.get(
          RENDER_PLUGIN_ID,
        );

      snapshot!.capabilities
        .capabilities[
        "render.2d"
      ] = "unsupported";

      expect(
        runtime.get(
          RENDER_PLUGIN_ID,
        )!.capabilities
          .capabilities[
          "render.2d"
        ],
      ).toBe("supported");
    });

    it("returns an independent runtime snapshot", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      const snapshot =
        runtime.snapshot();

      expect(
        snapshot.plugins,
      ).toHaveLength(1);

      (
        snapshot.plugins as PluginRuntimePlugin[]
      ).length = 0;

      expect(
        runtime.snapshot()
          .plugins,
      ).toHaveLength(1);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Stopped Runtime                                                          */
  /* ------------------------------------------------------------------------ */

  describe("stopped runtime", () => {
    it("does not allow new registration after stop", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      runtime.start();
      runtime.stop();

      expect(
        () =>
          runtime.register(
            createManifest({
              pluginId:
                RENDER_PLUGIN_ID,
            }),
            createAdapter(),
          ),
      ).toThrow(
        "Cannot register a plugin after runtime has stopped.",
      );
    });

    it("preserves existing plugins after stop", () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      runtime.stop();

      expect(
        runtime.get(
          RENDER_PLUGIN_ID,
        ),
      ).toBeTruthy();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Input Validation                                                         */
  /* ------------------------------------------------------------------------ */

  describe("input validation", () => {
    it("rejects an empty plugin id in get", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        () => runtime.get("   "),
      ).toThrow(
        "Plugin id must be a non-empty string.",
      );
    });

    it("rejects an empty plugin id in require", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        () =>
          runtime.require(""),
      ).toThrow(
        "Plugin id must be a non-empty string.",
      );
    });

    it("rejects an empty capability id", () => {
      const runtime =
        new PluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        () =>
          runtime.findCapability(
            "   ",
          ),
      ).toThrow(
        "Capability id must be a non-empty string.",
      );
    });

    it("rejects an empty operation name", async () => {
      const {
        runtime,
      } =
        createRegisteredRuntime({
          manifest: {
            pluginId:
              RENDER_PLUGIN_ID,
          },
        });

      await expect(
        runtime.execute(
          RENDER_PLUGIN_ID,
          "   ",
          async () => "ok",
        ),
      ).rejects.toThrow(
        "Operation must be a non-empty string.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Factory                                                                  */
  /* ------------------------------------------------------------------------ */

  describe("factory", () => {
    it("creates a PluginRuntime", () => {
      const runtime =
        createPluginRuntime({
          engineVersion:
            ENGINE_VERSION,
        });

      expect(
        runtime,
      ).toBeInstanceOf(
        PluginRuntime,
      );

      expect(
        runtime.getState(),
      ).toBe("created");
    });
  });
});