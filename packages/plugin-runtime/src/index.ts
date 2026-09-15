import type {
  CapabilityDescriptor,
} from "../../domain/src/index.js";

import {
  PLUGIN_SDK_VERSION,
  PluginRegistry,
  type PluginAdapter,
  type PluginKind,
  type PluginManifest,
  type PluginRegistration,
  getPluginCapabilities,
} from "../../plugin-sdk/src/index.js";

/* -------------------------------------------------------------------------- */
/* Plugin Runtime                                                             */
/* -------------------------------------------------------------------------- */

export const PLUGIN_RUNTIME_VERSION = "1.0.0";

/* -------------------------------------------------------------------------- */
/* Runtime States                                                             */
/* -------------------------------------------------------------------------- */

export type PluginRuntimeState =
  | "created"
  | "running"
  | "stopped";

export type PluginRuntimePluginState =
  | "registered"
  | "enabled"
  | "disabled"
  | "failed";

export type PluginFailurePolicy =
  | "isolate"
  | "fail-fast";

/* -------------------------------------------------------------------------- */
/* Runtime Options                                                            */
/* -------------------------------------------------------------------------- */

export interface PluginRuntimeOptions {
  readonly engineVersion: string;
  readonly sdkVersion?: string;
  readonly failurePolicy?: PluginFailurePolicy;
}

/* -------------------------------------------------------------------------- */
/* Plugin Failure                                                             */
/* -------------------------------------------------------------------------- */

export interface PluginFailure {
  readonly pluginId: string;
  readonly operation: string;
  readonly message: string;
  readonly occurredAt: string;
}

/* -------------------------------------------------------------------------- */
/* Runtime Plugin                                                             */
/* -------------------------------------------------------------------------- */

export interface PluginRuntimePlugin {
  readonly pluginId: string;
  readonly manifest: PluginManifest;
  readonly adapter: PluginAdapter;
  readonly capabilities: CapabilityDescriptor;
  readonly state: PluginRuntimePluginState;
  readonly registeredAt: string;
  readonly loadedAt?: string;
  readonly enabledAt?: string;
  readonly disabledAt?: string;
  readonly failedAt?: string;
  readonly failure?: PluginFailure;
}

/* -------------------------------------------------------------------------- */
/* Runtime Snapshot                                                           */
/* -------------------------------------------------------------------------- */

export interface PluginRuntimeSnapshot {
  readonly runtimeVersion: string;
  readonly sdkVersion: string;
  readonly engineVersion: string;
  readonly state: PluginRuntimeState;
  readonly failurePolicy: PluginFailurePolicy;
  readonly plugins: readonly PluginRuntimePlugin[];
}

/* -------------------------------------------------------------------------- */
/* Capability Match                                                           */
/* -------------------------------------------------------------------------- */

export interface PluginCapabilityMatch {
  readonly pluginId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly kind: PluginKind;
  readonly capabilityId: string;
  readonly status:
    | "supported"
    | "experimental";
}

/* -------------------------------------------------------------------------- */
/* Internal Runtime Record                                                    */
/* -------------------------------------------------------------------------- */

interface InternalRuntimePlugin {
  readonly registration: PluginRegistration;
  readonly capabilities: CapabilityDescriptor;

  state: PluginRuntimePluginState;

  loadedAt?: string;
  enabledAt?: string;
  disabledAt?: string;
  failedAt?: string;

  failure?: PluginFailure;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function requireNonEmpty(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function timestamp(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Plugin Runtime                                                             */
/* -------------------------------------------------------------------------- */

export class PluginRuntime {
  private readonly registry: PluginRegistry;

  private readonly plugins =
    new Map<string, InternalRuntimePlugin>();

  private readonly engineVersion: string;

  private readonly sdkVersion: string;

  private readonly failurePolicy: PluginFailurePolicy;

  private state: PluginRuntimeState =
    "created";

  public constructor(
    options: PluginRuntimeOptions,
  ) {
    this.engineVersion =
      requireNonEmpty(
        options.engineVersion,
        "Engine version",
      );

    this.sdkVersion =
      requireNonEmpty(
        options.sdkVersion ??
          PLUGIN_SDK_VERSION,
        "SDK version",
      );

    this.failurePolicy =
      options.failurePolicy ??
      "isolate";

    if (
      this.failurePolicy !==
        "isolate" &&
      this.failurePolicy !==
        "fail-fast"
    ) {
      throw new Error(
        `Unsupported failure policy: ${String(
          this.failurePolicy,
        )}`,
      );
    }

    this.registry =
      new PluginRegistry();
  }

  /* ------------------------------------------------------------------------ */
  /* Runtime State                                                            */
  /* ------------------------------------------------------------------------ */

  getState(): PluginRuntimeState {
    return this.state;
  }

  isRunning(): boolean {
    return this.state === "running";
  }

  isStopped(): boolean {
    return this.state === "stopped";
  }

  /* ------------------------------------------------------------------------ */
  /* Start                                                                    */
  /* ------------------------------------------------------------------------ */

  start(): PluginRuntimeSnapshot {
    if (this.state === "running") {
      return this.snapshot();
    }

    if (this.state === "stopped") {
      throw new Error(
        "Plugin runtime cannot be restarted after it has been stopped.",
      );
    }

    this.state = "running";

    return this.snapshot();
  }

  /* ------------------------------------------------------------------------ */
  /* Stop                                                                     */
  /* ------------------------------------------------------------------------ */

  stop(): PluginRuntimeSnapshot {
    if (this.state === "stopped") {
      return this.snapshot();
    }

    this.state = "stopped";

    return this.snapshot();
  }

  /* ------------------------------------------------------------------------ */
  /* Register                                                                 */
  /* ------------------------------------------------------------------------ */

  register(
    manifest: PluginManifest,
    adapter: PluginAdapter,
  ): PluginRuntimePlugin {
    if (this.state === "stopped") {
      throw new Error(
        "Cannot register a plugin after runtime has stopped.",
      );
    }

    const registration =
      this.registry.register(
        manifest,
        adapter,
      );

    let capabilities: CapabilityDescriptor;

    try {
      capabilities =
        getPluginCapabilities(
          adapter,
        );
    } catch (error) {
      this.registry.remove(
        manifest.pluginId,
      );

      throw new Error(
        `Plugin registration failed while reading capabilities: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }

    if (
      capabilities.adapterId !==
      manifest.adapterId
    ) {
      this.registry.remove(
        manifest.pluginId,
      );

      throw new Error(
        "Plugin capability adapterId does not match manifest adapterId.",
      );
    }

    if (
      capabilities.adapterVersion !==
      manifest.adapterVersion
    ) {
      this.registry.remove(
        manifest.pluginId,
      );

      throw new Error(
        "Plugin capability adapterVersion does not match manifest adapterVersion.",
      );
    }

    const internal: InternalRuntimePlugin =
      {
        registration,
        capabilities: clone(
          capabilities,
        ),
        state: "registered",
      };

    this.plugins.set(
      manifest.pluginId,
      internal,
    );

    return this.snapshotPlugin(
      internal,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Load                                                                     */
  /* ------------------------------------------------------------------------ */

  load(
    pluginId: string,
  ): PluginRuntimePlugin {
    const plugin =
      this.requireInternal(
        pluginId,
      );

    if (
      plugin.state === "failed"
    ) {
      throw new Error(
        `Cannot load failed plugin: ${pluginId}`,
      );
    }

    if (
      plugin.loadedAt ===
      undefined
    ) {
      plugin.loadedAt =
        timestamp();
    }

    if (
      plugin.state === "registered" ||
      plugin.state === "disabled"
    ) {
      plugin.state = "enabled";

      plugin.enabledAt =
        plugin.enabledAt ??
        timestamp();

      this.registry.enable(
        pluginId,
      );
    }

    return this.snapshotPlugin(
      plugin,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Unload                                                                   */
  /* ------------------------------------------------------------------------ */

  unload(
    pluginId: string,
  ): PluginRuntimePlugin {
    const plugin =
      this.requireInternal(
        pluginId,
      );

    if (
      plugin.state === "failed"
    ) {
      return this.snapshotPlugin(
        plugin,
      );
    }

    plugin.state = "disabled";
    plugin.disabledAt =
      timestamp();

    this.registry.disable(
      pluginId,
    );

    return this.snapshotPlugin(
      plugin,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Enable                                                                   */
  /* ------------------------------------------------------------------------ */

  enable(
    pluginId: string,
  ): PluginRuntimePlugin {
    const plugin =
      this.requireInternal(
        pluginId,
      );

    if (
      plugin.state === "failed"
    ) {
      throw new Error(
        `Cannot enable failed plugin: ${pluginId}`,
      );
    }

    plugin.state = "enabled";

    plugin.enabledAt =
      plugin.enabledAt ??
      timestamp();

    this.registry.enable(
      pluginId,
    );

    return this.snapshotPlugin(
      plugin,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Disable                                                                  */
  /* ------------------------------------------------------------------------ */

  disable(
    pluginId: string,
  ): PluginRuntimePlugin {
    const plugin =
      this.requireInternal(
        pluginId,
      );

    plugin.state = "disabled";
    plugin.disabledAt =
      timestamp();

    this.registry.disable(
      pluginId,
    );

    return this.snapshotPlugin(
      plugin,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Get                                                                      */
  /* ------------------------------------------------------------------------ */

  get(
    pluginId: string,
  ): PluginRuntimePlugin | undefined {
    const normalized =
      requireNonEmpty(
        pluginId,
        "Plugin id",
      );

    const plugin =
      this.plugins.get(
        normalized,
      );

    if (
      plugin === undefined
    ) {
      return undefined;
    }

    return this.snapshotPlugin(
      plugin,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Require                                                                  */
  /* ------------------------------------------------------------------------ */

  require(
    pluginId: string,
  ): PluginRuntimePlugin {
    return this.snapshotPlugin(
      this.requireInternal(
        pluginId,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* List                                                                     */
  /* ------------------------------------------------------------------------ */

  list(): PluginRuntimePlugin[] {
    return [
      ...this.plugins.values(),
    ].map(
      (plugin) =>
        this.snapshotPlugin(
          plugin,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Enabled                                                                  */
  /* ------------------------------------------------------------------------ */

  enabled(): PluginRuntimePlugin[] {
    return [
      ...this.plugins.values(),
    ]
      .filter(
        (plugin) =>
          plugin.state === "enabled",
      )
      .map(
        (plugin) =>
          this.snapshotPlugin(
            plugin,
          ),
      );
  }

  /* ------------------------------------------------------------------------ */
  /* By Kind                                                                  */
  /* ------------------------------------------------------------------------ */

  byKind(
    kind: PluginKind,
  ): PluginRuntimePlugin[] {
    return [
      ...this.plugins.values(),
    ]
      .filter(
        (plugin) =>
          plugin.registration
            .manifest.kind === kind,
      )
      .map(
        (plugin) =>
          this.snapshotPlugin(
            plugin,
          ),
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Resolve Capability                                                       */
  /* ------------------------------------------------------------------------ */

  resolveCapability(
    capabilityId: string,
    options: {
      readonly includeExperimental?: boolean;
      readonly kind?: PluginKind;
    } = {},
  ): PluginRuntimePlugin {
    const matches =
      this.findCapability(
        capabilityId,
        options,
      );

    const supported =
      matches.filter(
        (match) =>
          match.status ===
          "supported",
      );

    const candidates =
      supported.length > 0
        ? supported
        : options.includeExperimental ===
            true
          ? matches
          : [];

    if (
      candidates.length === 0
    ) {
      throw new Error(
        `No enabled plugin provides capability: ${requireNonEmpty(
          capabilityId,
          "Capability id",
        )}`,
      );
    }

    const ordered =
      [...candidates].sort(
        (a, b) =>
          a.pluginId.localeCompare(
            b.pluginId,
          ),
      );

    return this.require(
      ordered[0].pluginId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Find Capability                                                          */
  /* ------------------------------------------------------------------------ */

  findCapability(
    capabilityId: string,
    options: {
      readonly includeExperimental?: boolean;
      readonly kind?: PluginKind;
    } = {},
  ): PluginCapabilityMatch[] {
    const id =
      requireNonEmpty(
        capabilityId,
        "Capability id",
      );

    const matches: PluginCapabilityMatch[] =
      [];

    for (
      const plugin of this.plugins.values()
    ) {
      if (
        plugin.state !== "enabled"
      ) {
        continue;
      }

      if (
        options.kind !==
          undefined &&
        plugin.registration
          .manifest.kind !==
          options.kind
      ) {
        continue;
      }

      const status =
        plugin.capabilities
          .capabilities[id];

      if (
        status === "supported"
      ) {
        matches.push({
          pluginId:
            plugin.registration
              .manifest.pluginId,

          adapterId:
            plugin.registration
              .adapter
              .adapterId,

          adapterVersion:
            plugin.registration
              .adapter
              .adapterVersion,

          kind:
            plugin.registration
              .manifest.kind,

          capabilityId: id,

          status: "supported",
        });

        continue;
      }

      if (
        status ===
          "experimental" &&
        options.includeExperimental ===
          true
      ) {
        matches.push({
          pluginId:
            plugin.registration
              .manifest.pluginId,

          adapterId:
            plugin.registration
              .adapter
              .adapterId,

          adapterVersion:
            plugin.registration
              .adapter
              .adapterVersion,

          kind:
            plugin.registration
              .manifest.kind,

          capabilityId: id,

          status: "experimental",
        });
      }
    }

    return matches;
  }

  /* ------------------------------------------------------------------------ */
  /* Capability Inventory                                                     */
  /* ------------------------------------------------------------------------ */

  capabilityInventory(): CapabilityDescriptor[] {
    return [
      ...this.plugins.values(),
    ]
      .filter(
        (plugin) =>
          plugin.state === "enabled",
      )
      .map(
        (plugin) =>
          clone(
            plugin.capabilities,
          ),
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Execute Plugin Safely                                                    */
  /* ------------------------------------------------------------------------ */

  async execute<T>(
    pluginId: string,
    operation: string,
    callback: (
      adapter: PluginAdapter,
    ) => Promise<T>,
  ): Promise<T> {
    const normalizedPluginId =
      requireNonEmpty(
        pluginId,
        "Plugin id",
      );

    const normalizedOperation =
      requireNonEmpty(
        operation,
        "Operation",
      );

    const plugin =
      this.requireInternal(
        normalizedPluginId,
      );

    if (
      plugin.state !== "enabled"
    ) {
      throw new Error(
        `Plugin is not enabled: ${normalizedPluginId}`,
      );
    }

    try {
      return await callback(
        plugin.registration.adapter,
      );
    } catch (error) {
      const failure: PluginFailure =
        {
          pluginId:
            normalizedPluginId,

          operation:
            normalizedOperation,

          message:
            error instanceof Error
              ? error.message
              : String(error),

          occurredAt:
            timestamp(),
        };

      plugin.failure =
        failure;

      plugin.failedAt =
        failure.occurredAt;

      plugin.state = "failed";

      this.registry.disable(
        normalizedPluginId,
      );

      if (
        this.failurePolicy ===
        "fail-fast"
      ) {
        this.state = "stopped";

        throw new Error(
          `Plugin execution failed: ${failure.message}`,
        );
      }

      throw new Error(
        `Plugin execution failed: ${failure.message}`,
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Remove                                                                   */
  /* ------------------------------------------------------------------------ */

  remove(
    pluginId: string,
  ): boolean {
    const normalized =
      requireNonEmpty(
        pluginId,
        "Plugin id",
      );

    this.plugins.delete(
      normalized,
    );

    return this.registry.remove(
      normalized,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Size                                                                     */
  /* ------------------------------------------------------------------------ */

  size(): number {
    return this.plugins.size;
  }

  /* ------------------------------------------------------------------------ */
  /* Snapshot                                                                 */
  /* ------------------------------------------------------------------------ */

  snapshot(): PluginRuntimeSnapshot {
    return {
      runtimeVersion:
        PLUGIN_RUNTIME_VERSION,

      sdkVersion:
        this.sdkVersion,

      engineVersion:
        this.engineVersion,

      state:
        this.state,

      failurePolicy:
        this.failurePolicy,

      plugins:
        this.list(),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Internal Require                                                         */
  /* ------------------------------------------------------------------------ */

  private requireInternal(
    pluginId: string,
  ): InternalRuntimePlugin {
    const normalized =
      requireNonEmpty(
        pluginId,
        "Plugin id",
      );

    const plugin =
      this.plugins.get(
        normalized,
      );

    if (
      plugin === undefined
    ) {
      throw new Error(
        `Plugin not found: ${normalized}`,
      );
    }

    return plugin;
  }

  /* ------------------------------------------------------------------------ */
  /* Plugin Snapshot                                                           */
  /* ------------------------------------------------------------------------ */

  private snapshotPlugin(
    plugin: InternalRuntimePlugin,
  ): PluginRuntimePlugin {
    return {
      pluginId:
        plugin.registration
          .manifest.pluginId,

      manifest:
        clone(
          plugin.registration
            .manifest,
        ),

      adapter:
        plugin.registration.adapter,

      capabilities:
        clone(
          plugin.capabilities,
        ),

      state:
        plugin.state,

      registeredAt:
        plugin.registration
          .registeredAt,

      loadedAt:
        plugin.loadedAt,

      enabledAt:
        plugin.enabledAt,

      disabledAt:
        plugin.disabledAt,

      failedAt:
        plugin.failedAt,

      failure:
        plugin.failure ===
          undefined
          ? undefined
          : clone(
              plugin.failure,
            ),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createPluginRuntime(
  options: PluginRuntimeOptions,
): PluginRuntime {
  return new PluginRuntime(
    options,
  );
}