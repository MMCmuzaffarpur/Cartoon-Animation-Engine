import type {
  CapabilityDescriptor,
} from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Plugin SDK                                                                 */
/* -------------------------------------------------------------------------- */

export const PLUGIN_SDK_VERSION = "1.0.0";

export type PluginKind =
  | "renderer"
  | "planner"
  | "generator"
  | "rig"
  | "motion"
  | "facial"
  | "lipsync"
  | "scene"
  | "camera"
  | "audio"
  | "composition"
  | "storage"
  | "custom";

export type PluginStatus =
  | "registered"
  | "enabled"
  | "disabled";

/* -------------------------------------------------------------------------- */
/* Plugin Adapter                                                             */
/* -------------------------------------------------------------------------- */

export interface PluginAdapter {
  readonly adapterId: string;
  readonly adapterVersion: string;

  /**
   * Returns the capabilities provided by this plugin.
   *
   * The returned descriptor is treated as immutable by the SDK.
   */
  capabilities(): CapabilityDescriptor;
}

/* -------------------------------------------------------------------------- */
/* Plugin Manifest                                                            */
/* -------------------------------------------------------------------------- */

export interface PluginManifest {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly sdkVersion: string;
  readonly name: string;
  readonly kind: PluginKind;
  readonly description?: string;
  readonly author?: string;
  readonly license?: string;
  readonly homepage?: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
}

/* -------------------------------------------------------------------------- */
/* Plugin Context                                                             */
/* -------------------------------------------------------------------------- */

export interface PluginContext {
  readonly projectId?: string;
  readonly projectRevisionId?: string;
  readonly engineVersion: string;
  readonly sdkVersion: string;
  readonly capabilities: readonly CapabilityDescriptor[];
}

/* -------------------------------------------------------------------------- */
/* Renderer Plugin                                                            */
/* -------------------------------------------------------------------------- */

export interface RenderPlugin
  extends PluginAdapter {
  render(
    state: unknown,
    options: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Planner Plugin                                                             */
/* -------------------------------------------------------------------------- */

export interface PlannerPlugin
  extends PluginAdapter {
  plan(
    prompt: string,
    context: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Generator Plugin                                                           */
/* -------------------------------------------------------------------------- */

export interface GeneratorPlugin
  extends PluginAdapter {
  generate(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Rig Plugin                                                                 */
/* -------------------------------------------------------------------------- */

export interface RigPlugin
  extends PluginAdapter {
  createRig(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;

  solve(
    rig: unknown,
    pose: unknown,
    options: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Motion Plugin                                                              */
/* -------------------------------------------------------------------------- */

export interface MotionPlugin
  extends PluginAdapter {
  createMotion(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;

  evaluate(
    motion: unknown,
    tick: number,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Facial Plugin                                                              */
/* -------------------------------------------------------------------------- */

export interface FacialPlugin
  extends PluginAdapter {
  evaluate(
    input: unknown,
    tick: number,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Lip-Sync Plugin                                                            */
/* -------------------------------------------------------------------------- */

export interface LipSyncPlugin
  extends PluginAdapter {
  analyze(
    audio: unknown,
    options: unknown,
  ): Promise<unknown>;

  evaluate(
    track: unknown,
    tick: number,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Scene Plugin                                                               */
/* -------------------------------------------------------------------------- */

export interface ScenePlugin
  extends PluginAdapter {
  createScene(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;

  compose(
    scene: unknown,
    options: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Camera Plugin                                                              */
/* -------------------------------------------------------------------------- */

export interface CameraPlugin
  extends PluginAdapter {
  createShot(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;

  evaluate(
    shot: unknown,
    tick: number,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Audio Plugin                                                               */
/* -------------------------------------------------------------------------- */

export interface AudioPlugin
  extends PluginAdapter {
  render(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;

  mix(
    tracks: unknown,
    options: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Composition Plugin                                                         */
/* -------------------------------------------------------------------------- */

export interface CompositionPlugin
  extends PluginAdapter {
  compose(
    input: unknown,
    options: unknown,
  ): Promise<unknown>;
}

/* -------------------------------------------------------------------------- */
/* Plugin Registration                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Public immutable registration snapshot.
 *
 * Consumers receive snapshots and cannot mutate the registry state through
 * the returned registration object.
 */
export interface PluginRegistration {
  readonly manifest: PluginManifest;
  readonly adapter: PluginAdapter;
  readonly status: PluginStatus;
  readonly registeredAt: string;
}

/**
 * Internal mutable representation used exclusively by PluginRegistry.
 *
 * This intentionally separates internal mutable state from the public
 * immutable PluginRegistration contract.
 */
interface InternalPluginRegistration {
  readonly manifest: PluginManifest;
  readonly adapter: PluginAdapter;
  status: PluginStatus;
  readonly registeredAt: string;
}

/* -------------------------------------------------------------------------- */
/* Validation Result                                                          */
/* -------------------------------------------------------------------------- */

export interface PluginValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Internal Helpers                                                           */
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

function now(): string {
  return new Date().toISOString();
}

/* -------------------------------------------------------------------------- */
/* Manifest Validation                                                        */
/* -------------------------------------------------------------------------- */

export function validatePluginManifest(
  manifest: PluginManifest,
): PluginValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    typeof manifest !== "object" ||
    manifest === null
  ) {
    return {
      valid: false,
      errors: [
        "Plugin manifest must be an object.",
      ],
      warnings: [],
    };
  }

  const requiredStrings: Array<
    [string, unknown]
  > = [
    ["pluginId", manifest.pluginId],
    ["pluginVersion", manifest.pluginVersion],
    ["sdkVersion", manifest.sdkVersion],
    ["name", manifest.name],
    ["adapterId", manifest.adapterId],
    ["adapterVersion", manifest.adapterVersion],
  ];

  for (
    const [field, value] of requiredStrings
  ) {
    if (
      typeof value !== "string" ||
      value.trim().length === 0
    ) {
      errors.push(
        `${field} must be a non-empty string.`,
      );
    }
  }

  const validKinds: readonly PluginKind[] = [
    "renderer",
    "planner",
    "generator",
    "rig",
    "motion",
    "facial",
    "lipsync",
    "scene",
    "camera",
    "audio",
    "composition",
    "storage",
    "custom",
  ];

  if (
    !validKinds.includes(
      manifest.kind,
    )
  ) {
    errors.push(
      `Unsupported plugin kind: ${String(
        manifest.kind,
      )}`,
    );
  }

  if (
    manifest.description !==
      undefined &&
    typeof manifest.description !==
      "string"
  ) {
    errors.push(
      "description must be a string when provided.",
    );
  }

  if (
    manifest.author !==
      undefined &&
    typeof manifest.author !==
      "string"
  ) {
    errors.push(
      "author must be a string when provided.",
    );
  }

  if (
    manifest.license !==
      undefined &&
    typeof manifest.license !==
      "string"
  ) {
    errors.push(
      "license must be a string when provided.",
    );
  }

  if (
    manifest.homepage !==
      undefined &&
    typeof manifest.homepage !==
      "string"
  ) {
    errors.push(
      "homepage must be a string when provided.",
    );
  }

  if (
    manifest.sdkVersion !==
      PLUGIN_SDK_VERSION
  ) {
    warnings.push(
      `Plugin SDK version ${manifest.sdkVersion} differs from host SDK version ${PLUGIN_SDK_VERSION}.`,
    );
  }

  if (
    typeof manifest.adapterId ===
      "string" &&
    manifest.adapterId !==
      manifest.adapterId.trim()
  ) {
    errors.push(
      "adapterId must not contain leading or trailing whitespace.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Capability Validation                                                      */
/* -------------------------------------------------------------------------- */

export function validatePluginCapabilities(
  capabilities: CapabilityDescriptor,
): PluginValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    typeof capabilities !==
      "object" ||
    capabilities === null
  ) {
    return {
      valid: false,
      errors: [
        "Plugin capabilities must be an object.",
      ],
      warnings: [],
    };
  }

  if (
    typeof capabilities.adapterId !==
      "string" ||
    capabilities.adapterId.trim()
      .length === 0
  ) {
    errors.push(
      "Capability adapterId must be a non-empty string.",
    );
  }

  if (
    typeof capabilities.adapterVersion !==
      "string" ||
    capabilities.adapterVersion.trim()
      .length === 0
  ) {
    errors.push(
      "Capability adapterVersion must be a non-empty string.",
    );
  }

  if (
    typeof capabilities.contractVersion !==
      "string" ||
    capabilities.contractVersion.trim()
      .length === 0
  ) {
    errors.push(
      "Capability contractVersion must be a non-empty string.",
    );
  }

  if (
    typeof capabilities.capabilities !==
      "object" ||
    capabilities.capabilities === null ||
    Array.isArray(
      capabilities.capabilities,
    )
  ) {
    errors.push(
      "Capability map must be an object.",
    );
  } else {
    for (
      const [
        id,
        status,
      ] of Object.entries(
        capabilities.capabilities,
      )
    ) {
      if (
        id.trim().length === 0
      ) {
        errors.push(
          "Capability id must not be empty.",
        );
      }

      if (
        status !== "supported" &&
        status !== "unsupported" &&
        status !== "experimental"
      ) {
        errors.push(
          `Invalid capability status for ${id}.`,
        );
      }
    }
  }

  if (
    Object.keys(
      capabilities.capabilities ?? {},
    ).length === 0
  ) {
    warnings.push(
      "Plugin exposes no capabilities.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Adapter Validation                                                         */
/* -------------------------------------------------------------------------- */

export function validatePluginAdapter(
  adapter: PluginAdapter,
): PluginValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    typeof adapter !== "object" ||
    adapter === null
  ) {
    return {
      valid: false,
      errors: [
        "Plugin adapter must be an object.",
      ],
      warnings: [],
    };
  }

  try {
    requireNonEmpty(
      adapter.adapterId,
      "adapterId",
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  try {
    requireNonEmpty(
      adapter.adapterVersion,
      "adapterVersion",
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  if (
    typeof adapter.capabilities !==
    "function"
  ) {
    errors.push(
      "Plugin adapter must implement capabilities().",
    );
  } else {
    try {
      const capabilities =
        adapter.capabilities();

      const result =
        validatePluginCapabilities(
          capabilities,
        );

      errors.push(
        ...result.errors,
      );

      warnings.push(
        ...result.warnings,
      );
    } catch (error) {
      errors.push(
        `Plugin capabilities() failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Complete Plugin Validation                                                 */
/* -------------------------------------------------------------------------- */

export function validatePlugin(
  manifest: PluginManifest,
  adapter: PluginAdapter,
): PluginValidationResult {
  const manifestResult =
    validatePluginManifest(
      manifest,
    );

  const adapterResult =
    validatePluginAdapter(
      adapter,
    );

  const errors = [
    ...manifestResult.errors,
    ...adapterResult.errors,
  ];

  const warnings = [
    ...manifestResult.warnings,
    ...adapterResult.warnings,
  ];

  if (
    manifest.adapterId !==
    adapter.adapterId
  ) {
    errors.push(
      "Manifest adapterId does not match plugin adapter adapterId.",
    );
  }

  if (
    manifest.adapterVersion !==
    adapter.adapterVersion
  ) {
    errors.push(
      "Manifest adapterVersion does not match plugin adapter adapterVersion.",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Plugin Registry                                                            */
/* -------------------------------------------------------------------------- */

export class PluginRegistry {
  private readonly registrations =
    new Map<
      string,
      InternalPluginRegistration
    >();

  /* ------------------------------------------------------------------------ */
  /* Register                                                                 */
  /* ------------------------------------------------------------------------ */

  register(
    manifest: PluginManifest,
    adapter: PluginAdapter,
  ): PluginRegistration {
    const validation =
      validatePlugin(
        manifest,
        adapter,
      );

    if (!validation.valid) {
      throw new Error(
        `Invalid plugin: ${validation.errors.join(
          " | ",
        )}`,
      );
    }

    if (
      this.registrations.has(
        manifest.pluginId,
      )
    ) {
      throw new Error(
        `Plugin already registered: ${manifest.pluginId}`,
      );
    }

    const registration: InternalPluginRegistration =
      {
        manifest: clone(manifest),
        adapter,
        status: "registered",
        registeredAt: now(),
      };

    this.registrations.set(
      manifest.pluginId,
      registration,
    );

    return this.snapshot(
      registration,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Enable                                                                   */
  /* ------------------------------------------------------------------------ */

  enable(
    pluginId: string,
  ): PluginRegistration {
    const registration =
      this.requireInternal(
        pluginId,
      );

    if (
      registration.status ===
        "registered" ||
      registration.status ===
        "disabled"
    ) {
      registration.status =
        "enabled";
    }

    return this.snapshot(
      registration,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Disable                                                                  */
  /* ------------------------------------------------------------------------ */

  disable(
    pluginId: string,
  ): PluginRegistration {
    const registration =
      this.requireInternal(
        pluginId,
      );

    registration.status =
      "disabled";

    return this.snapshot(
      registration,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Get                                                                      */
  /* ------------------------------------------------------------------------ */

  get(
    pluginId: string,
  ): PluginRegistration | undefined {
    const normalized =
      requireNonEmpty(
        pluginId,
        "Plugin id",
      );

    const registration =
      this.registrations.get(
        normalized,
      );

    if (
      registration ===
      undefined
    ) {
      return undefined;
    }

    return this.snapshot(
      registration,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Require                                                                  */
  /* ------------------------------------------------------------------------ */

  require(
    pluginId: string,
  ): PluginRegistration {
    return this.snapshot(
      this.requireInternal(
        pluginId,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Internal Require                                                         */
  /* ------------------------------------------------------------------------ */

  private requireInternal(
    pluginId: string,
  ): InternalPluginRegistration {
    const normalized =
      requireNonEmpty(
        pluginId,
        "Plugin id",
      );

    const registration =
      this.registrations.get(
        normalized,
      );

    if (
      registration ===
      undefined
    ) {
      throw new Error(
        `Plugin not found: ${normalized}`,
      );
    }

    return registration;
  }

  /* ------------------------------------------------------------------------ */
  /* Find By Kind                                                             */
  /* ------------------------------------------------------------------------ */

  byKind(
    kind: PluginKind,
  ): PluginRegistration[] {
    return [
      ...this.registrations.values(),
    ]
      .filter(
        (registration) =>
          registration.manifest
            .kind === kind,
      )
      .map((registration) =>
        this.snapshot(
          registration,
        ),
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Enabled                                                                  */
  /* ------------------------------------------------------------------------ */

  enabled(): PluginRegistration[] {
    return [
      ...this.registrations.values(),
    ]
      .filter(
        (registration) =>
          registration.status ===
          "enabled",
      )
      .map((registration) =>
        this.snapshot(
          registration,
        ),
      );
  }

  /* ------------------------------------------------------------------------ */
  /* List                                                                     */
  /* ------------------------------------------------------------------------ */

  list(): PluginRegistration[] {
    return [
      ...this.registrations.values(),
    ].map((registration) =>
      this.snapshot(
        registration,
      ),
    );
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

    return this.registrations.delete(
      normalized,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Clear                                                                    */
  /* ------------------------------------------------------------------------ */

  clear(): void {
    this.registrations.clear();
  }

  /* ------------------------------------------------------------------------ */
  /* Size                                                                     */
  /* ------------------------------------------------------------------------ */

  size(): number {
    return this.registrations.size;
  }

  /* ------------------------------------------------------------------------ */
  /* Snapshot                                                                 */
  /* ------------------------------------------------------------------------ */

  private snapshot(
    registration: InternalPluginRegistration,
  ): PluginRegistration {
    return {
      manifest: clone(
        registration.manifest,
      ),
      adapter:
        registration.adapter,
      status:
        registration.status,
      registeredAt:
        registration.registeredAt,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Capability Discovery                                                       */
/* -------------------------------------------------------------------------- */

export function getPluginCapabilities(
  plugin: PluginAdapter,
): CapabilityDescriptor {
  const result =
    plugin.capabilities();

  return clone(result);
}

/* -------------------------------------------------------------------------- */
/* Capability Matching                                                        */
/* -------------------------------------------------------------------------- */

export function pluginSupportsCapability(
  plugin: PluginAdapter,
  capabilityId: string,
): boolean {
  const id =
    requireNonEmpty(
      capabilityId,
      "Capability id",
    );

  const capabilities =
    plugin.capabilities();

  return (
    capabilities.capabilities[
      id
    ] === "supported"
  );
}

export function pluginHasCapability(
  plugin: PluginAdapter,
  capabilityId: string,
): boolean {
  const id =
    requireNonEmpty(
      capabilityId,
      "Capability id",
    );

  const capabilities =
    plugin.capabilities();

  const status =
    capabilities.capabilities[
      id
    ];

  return (
    status === "supported" ||
    status === "experimental"
  );
}

/* -------------------------------------------------------------------------- */
/* Plugin Context Factory                                                     */
/* -------------------------------------------------------------------------- */

export function createPluginContext(
  options: {
    engineVersion: string;
    projectId?: string;
    projectRevisionId?: string;
    capabilities?: readonly CapabilityDescriptor[];
  },
): PluginContext {
  return {
    engineVersion:
      requireNonEmpty(
        options.engineVersion,
        "Engine version",
      ),

    sdkVersion:
      PLUGIN_SDK_VERSION,

    projectId:
      options.projectId,

    projectRevisionId:
      options.projectRevisionId,

    capabilities:
      clone(
        options.capabilities ??
          [],
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}