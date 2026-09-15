import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PLUGIN_SDK_VERSION,
  PluginRegistry,
  createPluginContext,
  createPluginRegistry,
  getPluginCapabilities,
  pluginHasCapability,
  pluginSupportsCapability,
  validatePlugin,
  validatePluginAdapter,
  validatePluginCapabilities,
  validatePluginManifest,
  type PluginAdapter,
  type PluginManifest,
} from "../packages/plugin-sdk/src/index.js";

const CAPABILITIES = {
  adapterId: "test-renderer",
  adapterVersion: "1.0.0",
  contractVersion: "1.0.0",
  capabilities: {
    "render.2d": "supported" as const,
    "render.3d": "experimental" as const,
    "render.gpu": "unsupported" as const,
  },
};

function createAdapter(): PluginAdapter {
  return {
    adapterId: "test-renderer",
    adapterVersion: "1.0.0",

    capabilities() {
      return CAPABILITIES;
    },
  };
}

function createManifest(): PluginManifest {
  return {
    pluginId: "test-renderer-plugin",
    pluginVersion: "1.0.0",
    sdkVersion: PLUGIN_SDK_VERSION,
    name: "Test Renderer",
    kind: "renderer",
    description: "Test renderer plugin",
    author: "Cartoon Animation Engine",
    license: "MIT",
    adapterId: "test-renderer",
    adapterVersion: "1.0.0",
  };
}

describe("plugin-sdk", () => {
  describe("constants", () => {
    it("exposes the SDK version", () => {
      expect(
        PLUGIN_SDK_VERSION,
      ).toBe("1.0.0");
    });
  });

  describe("manifest validation", () => {
    it("accepts a valid manifest", () => {
      const result =
        validatePluginManifest(
          createManifest(),
        );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects an empty plugin id", () => {
      const result =
        validatePluginManifest({
          ...createManifest(),
          pluginId: "",
        });

      expect(result.valid).toBe(false);
      expect(
        result.errors,
      ).toContain(
        "pluginId must be a non-empty string.",
      );
    });

    it("rejects an empty plugin name", () => {
      const result =
        validatePluginManifest({
          ...createManifest(),
          name: " ",
        });

      expect(result.valid).toBe(false);
    });

    it("rejects an unsupported plugin kind", () => {
      const result =
        validatePluginManifest({
          ...createManifest(),
          kind: "invalid" as any,
        });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes(
            "Unsupported plugin kind",
          ),
        ),
      ).toBe(true);
    });

    it("warns when SDK versions differ", () => {
      const result =
        validatePluginManifest({
          ...createManifest(),
          sdkVersion: "99.0.0",
        });

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((warning) =>
          warning.includes(
            "differs from host SDK version",
          ),
        ),
      ).toBe(true);
    });
  });

  describe("capability validation", () => {
    it("accepts valid capabilities", () => {
      const result =
        validatePluginCapabilities(
          CAPABILITIES,
        );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects missing adapter id", () => {
      const result =
        validatePluginCapabilities({
          ...CAPABILITIES,
          adapterId: "",
        });

      expect(result.valid).toBe(false);
    });

    it("rejects missing contract version", () => {
      const result =
        validatePluginCapabilities({
          ...CAPABILITIES,
          contractVersion: "",
        });

      expect(result.valid).toBe(false);
    });

    it("rejects invalid capability status", () => {
      const result =
        validatePluginCapabilities({
          ...CAPABILITIES,
          capabilities: {
            broken: "invalid" as any,
          },
        });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes(
            "Invalid capability status",
          ),
        ),
      ).toBe(true);
    });

    it("warns when no capabilities are exposed", () => {
      const result =
        validatePluginCapabilities({
          adapterId: "empty",
          adapterVersion: "1.0.0",
          contractVersion: "1.0.0",
          capabilities: {},
        });

      expect(result.valid).toBe(true);
      expect(
        result.warnings,
      ).toContain(
        "Plugin exposes no capabilities.",
      );
    });
  });

  describe("adapter validation", () => {
    it("accepts a valid adapter", () => {
      const result =
        validatePluginAdapter(
          createAdapter(),
        );

      expect(result.valid).toBe(true);
    });

    it("rejects an empty adapter id", () => {
      const result =
        validatePluginAdapter({
          ...createAdapter(),
          adapterId: "",
        });

      expect(result.valid).toBe(false);
    });

    it("rejects an adapter without capabilities()", () => {
      const result =
        validatePluginAdapter({
          adapterId: "broken",
          adapterVersion: "1.0.0",
        } as any);

      expect(result.valid).toBe(false);
      expect(
        result.errors,
      ).toContain(
        "Plugin adapter must implement capabilities().",
      );
    });

    it("rejects an adapter whose capabilities method throws", () => {
      const result =
        validatePluginAdapter({
          adapterId: "broken",
          adapterVersion: "1.0.0",

          capabilities() {
            throw new Error(
              "capability failure",
            );
          },
        });

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes(
            "capability failure",
          ),
        ),
      ).toBe(true);
    });
  });

  describe("plugin validation", () => {
    it("accepts a matching plugin", () => {
      const result =
        validatePlugin(
          createManifest(),
          createAdapter(),
        );

      expect(result.valid).toBe(true);
    });

    it("rejects an adapter id mismatch", () => {
      const result =
        validatePlugin(
          createManifest(),
          {
            ...createAdapter(),
            adapterId: "different",
          },
        );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes(
            "adapterId does not match",
          ),
        ),
      ).toBe(true);
    });

    it("rejects an adapter version mismatch", () => {
      const result =
        validatePlugin(
          createManifest(),
          {
            ...createAdapter(),
            adapterVersion: "2.0.0",
          },
        );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes(
            "adapterVersion does not match",
          ),
        ),
      ).toBe(true);
    });
  });

  describe("plugin registry", () => {
    it("starts empty", () => {
      const registry =
        new PluginRegistry();

      expect(
        registry.size(),
      ).toBe(0);

      expect(
        registry.list(),
      ).toEqual([]);
    });

    it("registers a plugin", () => {
      const registry =
        new PluginRegistry();

      const registration =
        registry.register(
          createManifest(),
          createAdapter(),
        );

      expect(
        registration.manifest.pluginId,
      ).toBe(
        "test-renderer-plugin",
      );

      expect(
        registration.status,
      ).toBe("registered");

      expect(
        registry.size(),
      ).toBe(1);
    });

    it("rejects duplicate plugin ids", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      expect(() =>
        registry.register(
          createManifest(),
          createAdapter(),
        ),
      ).toThrow(
        "Plugin already registered",
      );
    });

    it("rejects invalid plugins", () => {
      const registry =
        new PluginRegistry();

      expect(() =>
        registry.register(
          {
            ...createManifest(),
            adapterId: "wrong",
          },
          createAdapter(),
        ),
      ).toThrow("Invalid plugin");
    });

    it("gets a registered plugin", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      const plugin =
        registry.get(
          "test-renderer-plugin",
        );

      expect(plugin).toBeDefined();
      expect(
        plugin?.manifest.name,
      ).toBe(
        "Test Renderer",
      );
    });

    it("returns undefined for an unknown plugin", () => {
      const registry =
        new PluginRegistry();

      expect(
        registry.get("missing"),
      ).toBeUndefined();
    });

    it("throws when requiring an unknown plugin", () => {
      const registry =
        new PluginRegistry();

      expect(() =>
        registry.require(
          "missing",
        ),
      ).toThrow(
        "Plugin not found",
      );
    });

    it("enables a registered plugin", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      const result =
        registry.enable(
          "test-renderer-plugin",
        );

      expect(
        result.status,
      ).toBe("enabled");
    });

    it("disables an enabled plugin", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      registry.enable(
        "test-renderer-plugin",
      );

      const result =
        registry.disable(
          "test-renderer-plugin",
        );

      expect(
        result.status,
      ).toBe("disabled");
    });

    it("re-enables a disabled plugin", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      registry.disable(
        "test-renderer-plugin",
      );

      const result =
        registry.enable(
          "test-renderer-plugin",
        );

      expect(
        result.status,
      ).toBe("enabled");
    });

    it("filters plugins by kind", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      registry.register(
        {
          ...createManifest(),
          pluginId:
            "test-planner-plugin",
          name: "Test Planner",
          kind: "planner",
          adapterId: "test-planner",
        },
        {
          adapterId: "test-planner",
          adapterVersion: "1.0.0",
          capabilities() {
            return {
              adapterId: "test-planner",
              adapterVersion: "1.0.0",
              contractVersion: "1.0.0",
              capabilities: {
                "planner.text":
                  "supported",
              },
            };
          },
        },
      );

      const renderers =
        registry.byKind(
          "renderer",
        );

      expect(
        renderers,
      ).toHaveLength(1);

      expect(
        renderers[0].manifest.kind,
      ).toBe("renderer");
    });

    it("returns enabled plugins only", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      registry.register(
        {
          ...createManifest(),
          pluginId:
            "second-plugin",
          adapterId:
            "second-adapter",
        },
        {
          adapterId:
            "second-adapter",
          adapterVersion: "1.0.0",
          capabilities() {
            return CAPABILITIES;
          },
        },
      );

      registry.enable(
        "test-renderer-plugin",
      );

      expect(
        registry.enabled(),
      ).toHaveLength(1);

      expect(
        registry.enabled()[0]
          .manifest.pluginId,
      ).toBe(
        "test-renderer-plugin",
      );
    });

    it("removes a plugin", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      expect(
        registry.remove(
          "test-renderer-plugin",
        ),
      ).toBe(true);

      expect(
        registry.size(),
      ).toBe(0);
    });

    it("returns false when removing an unknown plugin", () => {
      const registry =
        new PluginRegistry();

      expect(
        registry.remove(
          "missing",
        ),
      ).toBe(false);
    });

    it("clears all plugins", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      registry.clear();

      expect(
        registry.size(),
      ).toBe(0);
    });

    it("returns isolated manifest snapshots", () => {
      const registry =
        new PluginRegistry();

      registry.register(
        createManifest(),
        createAdapter(),
      );

      const first =
        registry.get(
          "test-renderer-plugin",
        );

      if (!first) {
        throw new Error(
          "Plugin registration missing",
        );
      }

      (first.manifest as any).name =
        "Mutated externally";

      const second =
        registry.get(
          "test-renderer-plugin",
        );

      expect(
        second?.manifest.name,
      ).toBe(
        "Test Renderer",
      );
    });
  });

  describe("capability discovery", () => {
    it("returns plugin capabilities", () => {
      const capabilities =
        getPluginCapabilities(
          createAdapter(),
        );

      expect(
        capabilities.adapterId,
      ).toBe("test-renderer");

      expect(
        capabilities.capabilities[
          "render.2d"
        ],
      ).toBe("supported");
    });

    it("returns a cloned capability descriptor", () => {
      const capabilities =
        getPluginCapabilities(
          createAdapter(),
        );

      (
        capabilities.capabilities as any
      )["render.2d"] =
        "unsupported";

      const fresh =
        getPluginCapabilities(
          createAdapter(),
        );

      expect(
        fresh.capabilities[
          "render.2d"
        ],
      ).toBe("supported");
    });

    it("detects supported capabilities", () => {
      expect(
        pluginSupportsCapability(
          createAdapter(),
          "render.2d",
        ),
      ).toBe(true);

      expect(
        pluginSupportsCapability(
          createAdapter(),
          "render.gpu",
        ),
      ).toBe(false);
    });

    it("detects supported and experimental capabilities", () => {
      expect(
        pluginHasCapability(
          createAdapter(),
          "render.2d",
        ),
      ).toBe(true);

      expect(
        pluginHasCapability(
          createAdapter(),
          "render.3d",
        ),
      ).toBe(true);

      expect(
        pluginHasCapability(
          createAdapter(),
          "render.gpu",
        ),
      ).toBe(false);
    });

    it("rejects empty capability ids", () => {
      expect(() =>
        pluginSupportsCapability(
          createAdapter(),
          "",
        ),
      ).toThrow(
        "Capability id must be a non-empty string.",
      );
    });
  });

  describe("plugin context", () => {
    it("creates an engine plugin context", () => {
      const context =
        createPluginContext({
          engineVersion:
            "1.0.0",
          projectId:
            "project-1",
          projectRevisionId:
            "revision-1",
          capabilities: [
            CAPABILITIES,
          ],
        });

      expect(
        context.engineVersion,
      ).toBe("1.0.0");

      expect(
        context.sdkVersion,
      ).toBe(
        PLUGIN_SDK_VERSION,
      );

      expect(
        context.projectId,
      ).toBe("project-1");

      expect(
        context.projectRevisionId,
      ).toBe(
        "revision-1",
      );

      expect(
        context.capabilities,
      ).toHaveLength(1);
    });

    it("defaults to an empty capability list", () => {
      const context =
        createPluginContext({
          engineVersion:
            "1.0.0",
        });

      expect(
        context.capabilities,
      ).toEqual([]);
    });

    it("does not retain capability input references", () => {
      const capabilities = [
        CAPABILITIES,
      ];

      const context =
        createPluginContext({
          engineVersion:
            "1.0.0",
          capabilities,
        });

      (
        capabilities[0]
          .capabilities as any
      )["render.2d"] =
        "unsupported";

      expect(
        context.capabilities[0]
          .capabilities[
          "render.2d"
        ],
      ).toBe("supported");
    });
  });

  describe("factory", () => {
    it("creates a plugin registry", () => {
      const registry =
        createPluginRegistry();

      expect(
        registry,
      ).toBeInstanceOf(
        PluginRegistry,
      );

      expect(
        registry.size(),
      ).toBe(0);
    });
  });
});