import {
  canonicalHash,
  CaeError,
  uuid,
} from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Asset Engine                                                               */
/* -------------------------------------------------------------------------- */

export const ASSET_ENGINE_VERSION = "1.0.0";
export const ASSET_MANIFEST_SCHEMA_VERSION = "1.0.0";
export const ASSET_VARIANT_SCHEMA_VERSION = "1.0.0";

/* -------------------------------------------------------------------------- */
/* Asset Types                                                                */
/* -------------------------------------------------------------------------- */

export const ASSET_TYPES = [
  "image",
  "vector",
  "sprite-sheet",
  "2d-mesh",
  "3d-model",
  "material",
  "skeleton",
  "rig-profile",
  "motion-clip",
  "audio",
  "font",
  "subtitle",
  "scene-template",
  "prop",
  "environment",
  "render-preset",
  "plugin-extension",
] as const;

export type AssetType =
  (typeof ASSET_TYPES)[number];

export const REPRESENTATIONS = [
  "2d",
  "3d",
  "hybrid",
] as const;

export type AssetRepresentation =
  (typeof REPRESENTATIONS)[number];

/* -------------------------------------------------------------------------- */
/* License                                                                    */
/* -------------------------------------------------------------------------- */

export interface AssetLicense {
  readonly id: string;
  readonly name: string;
  readonly url?: string;
  readonly attributionRequired: boolean;
  readonly attributionText?: string;
  readonly commercialUseAllowed: boolean;
  readonly modificationAllowed: boolean;
  readonly redistributionAllowed: boolean;
  readonly sourceNotice?: string;
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

export interface AssetProvenance {
  readonly sourceType:
    | "authored"
    | "imported"
    | "generated"
    | "derived"
    | "converted"
    | "system";

  readonly originalFilename?: string;
  readonly sourceUri?: string;
  readonly sourceHash?: string;
  readonly importerId?: string;
  readonly importerVersion?: string;
  readonly createdBy?: string;
  readonly license?: AssetLicense;
  readonly attributionRequired: boolean;
  readonly notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

export interface AssetStorage {
  readonly contentHash: string;
  readonly blobUri: string;
  readonly byteSize: number;
  readonly mimeType: string;
  readonly derivedArtifactUris: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Compatibility                                                              */
/* -------------------------------------------------------------------------- */

export interface AssetCompatibility {
  readonly representations: readonly AssetRepresentation[];
  readonly coordinateSystem?: string;
  readonly unitScale?: number;
  readonly rendererCapabilities: readonly string[];
  readonly supportedEngineVersions: readonly string[];
  readonly minimumEngineVersion?: string;
}

/* -------------------------------------------------------------------------- */
/* Version Lineage                                                            */
/* -------------------------------------------------------------------------- */

export interface AssetVersionLineage {
  readonly version: number;
  readonly parentAssetRevisionId?: string;
  readonly rootAssetId: string;
}

/* -------------------------------------------------------------------------- */
/* Asset Metadata                                                             */
/* -------------------------------------------------------------------------- */

export interface AssetMetadata {
  readonly name?: string;
  readonly displayName?: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly category?: string;
  readonly author?: string;
  readonly language?: string;
  readonly custom: Readonly<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Asset Manifest                                                             */
/* -------------------------------------------------------------------------- */

export interface AssetManifest {
  readonly assetId: string;
  readonly schemaVersion: string;
  readonly revision: number;
  readonly assetType: AssetType;

  readonly source: AssetProvenance;

  readonly storage: AssetStorage;

  readonly compatibility: AssetCompatibility;

  readonly dependencyAssetIds: readonly string[];

  readonly thumbnailAssetId?: string;

  readonly version: AssetVersionLineage;

  readonly metadata: AssetMetadata;

  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;

  readonly contentHash: string;
}

/* -------------------------------------------------------------------------- */
/* Variant Recipe                                                             */
/* -------------------------------------------------------------------------- */

export interface AssetVariantRecipe {
  readonly variantId: string;
  readonly schemaVersion: string;
  readonly baseAssetId: string;

  readonly name?: string;

  readonly crop?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };

  readonly paletteOverrides: Readonly<
    Record<string, string>
  >;

  readonly materialOverrides: Readonly<
    Record<string, unknown>
  >;

  readonly textureOverrides: Readonly<
    Record<string, string>
  >;

  readonly meshVariant?: string;

  readonly lod?: number;

  readonly languageLabel?: string;

  readonly representations: readonly AssetRepresentation[];

  readonly parameters: Readonly<
    Record<string, unknown>
  >;

  readonly contentHash: string;
}

/* -------------------------------------------------------------------------- */
/* Asset Create Input                                                         */
/* -------------------------------------------------------------------------- */

export interface CreateAssetInput {
  readonly assetId?: string;
  readonly assetType: AssetType;

  readonly source?: Partial<AssetProvenance>;

  readonly storage: {
    readonly contentHash: string;
    readonly blobUri: string;
    readonly byteSize: number;
    readonly mimeType: string;
    readonly derivedArtifactUris?: readonly string[];
  };

  readonly compatibility?: Partial<AssetCompatibility>;

  readonly dependencyAssetIds?: readonly string[];

  readonly thumbnailAssetId?: string;

  readonly version?: Partial<AssetVersionLineage>;

  readonly metadata?: Partial<AssetMetadata>;

  readonly createdBy?: string;

  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Variant Create Input                                                       */
/* -------------------------------------------------------------------------- */

export interface CreateVariantInput {
  readonly variantId?: string;
  readonly baseAssetId: string;

  readonly name?: string;

  readonly crop?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };

  readonly paletteOverrides?: Readonly<
    Record<string, string>
  >;

  readonly materialOverrides?: Readonly<
    Record<string, unknown>
  >;

  readonly textureOverrides?: Readonly<
    Record<string, string>
  >;

  readonly meshVariant?: string;

  readonly lod?: number;

  readonly languageLabel?: string;

  readonly representations?: readonly AssetRepresentation[];

  readonly parameters?: Readonly<
    Record<string, unknown>
  >;
}

/* -------------------------------------------------------------------------- */
/* Catalog Query                                                               */
/* -------------------------------------------------------------------------- */

export interface AssetQuery {
  readonly assetType?: AssetType;
  readonly tag?: string;
  readonly representation?: AssetRepresentation;
  readonly name?: string;
  readonly contentHash?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function optionalString(
  value: unknown,
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Optional string value must be a non-empty string.",
    );
  }

  return value.trim();
}

function nonNegativeInteger(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be a non-negative integer.`,
    );
  }

  return value;
}

function positiveNumber(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be a positive finite number.`,
    );
  }

  return value;
}

function finiteNumber(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be a finite number.`,
    );
  }

  return value;
}

function assertAssetType(
  value: unknown,
): AssetType {
  if (
    typeof value !== "string" ||
    !(ASSET_TYPES as readonly string[]).includes(
      value,
    )
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported asset type: ${String(value)}.`,
      [...ASSET_TYPES],
    );
  }

  return value as AssetType;
}

function assertRepresentation(
  value: unknown,
): AssetRepresentation {
  if (
    typeof value !== "string" ||
    !(
      REPRESENTATIONS as readonly string[]
    ).includes(value)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported representation: ${String(value)}.`,
      [...REPRESENTATIONS],
    );
  }

  return value as AssetRepresentation;
}

function uniqueStrings(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values.map((value) =>
        requiredString(value, "value"),
      ),
    ),
  ];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultLicense(): AssetLicense {
  return {
    id: "unknown",
    name: "Unknown",
    attributionRequired: false,
    commercialUseAllowed: false,
    modificationAllowed: false,
    redistributionAllowed: false,
  };
}

function defaultSource(): AssetProvenance {
  return {
    sourceType: "system",
    attributionRequired: false,
    license: defaultLicense(),
  };
}

function defaultCompatibility(): AssetCompatibility {
  return {
    representations: ["2d"],
    coordinateSystem: "engine-2d",
    unitScale: 1,
    rendererCapabilities: [],
    supportedEngineVersions: [
      ASSET_ENGINE_VERSION,
    ],
  };
}

function defaultMetadata(): AssetMetadata {
  return {
    tags: [],
    custom: {},
  };
}

/* -------------------------------------------------------------------------- */
/* Fingerprinting                                                             */
/* -------------------------------------------------------------------------- */

export function fingerprintAsset(
  asset: Omit<
    AssetManifest,
    "contentHash"
  >,
): string {
  return canonicalHash({
    assetId: asset.assetId,
    schemaVersion:
      asset.schemaVersion,
    revision: asset.revision,
    assetType: asset.assetType,
    source: asset.source,
    storage: {
      contentHash:
        asset.storage.contentHash,
      blobUri:
        asset.storage.blobUri,
      byteSize:
        asset.storage.byteSize,
      mimeType:
        asset.storage.mimeType,
      derivedArtifactUris:
        asset.storage
          .derivedArtifactUris,
    },
    compatibility:
      asset.compatibility,
    dependencyAssetIds:
      asset.dependencyAssetIds,
    thumbnailAssetId:
      asset.thumbnailAssetId ?? null,
    version: asset.version,
    metadata: asset.metadata,
    createdBy: asset.createdBy,
  }) as string;
}

/* -------------------------------------------------------------------------- */
/* Manifest Validation                                                        */
/* -------------------------------------------------------------------------- */

export function validateAssetManifest(
  input: unknown,
): AssetManifest {
  if (!isObject(input)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Asset manifest must be an object.",
    );
  }

  const assetId =
    requiredString(
      input.assetId,
      "assetId",
    );

  const schemaVersion =
    requiredString(
      input.schemaVersion,
      "schemaVersion",
    );

  const revision =
    nonNegativeInteger(
      input.revision,
      "revision",
    );

  const assetType =
    assertAssetType(
      input.assetType,
    );

  if (!isObject(input.source)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Asset source must be an object.",
    );
  }

  if (!isObject(input.storage)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Asset storage must be an object.",
    );
  }

  const storageInput =
    input.storage;

  const contentHash =
    requiredString(
      storageInput.contentHash,
      "storage.contentHash",
    );

  const blobUri =
    requiredString(
      storageInput.blobUri,
      "storage.blobUri",
    );

  const byteSize =
    nonNegativeInteger(
      storageInput.byteSize,
      "storage.byteSize",
    );

  const mimeType =
    requiredString(
      storageInput.mimeType,
      "storage.mimeType",
    );

  const derivedArtifactUris =
    Array.isArray(
      storageInput.derivedArtifactUris,
    )
      ? uniqueStrings(
          storageInput.derivedArtifactUris as string[],
        )
      : [];

  const source =
    input.source as Record<
      string,
      unknown
    >;

  const sourceType =
    requiredString(
      source.sourceType,
      "source.sourceType",
    ) as AssetProvenance["sourceType"];

  const validSourceTypes = [
    "authored",
    "imported",
    "generated",
    "derived",
    "converted",
    "system",
  ];

  if (
    !validSourceTypes.includes(
      sourceType,
    )
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported source type: ${sourceType}.`,
    );
  }

  const attributionRequired =
    source.attributionRequired === true;

  let license:
    | AssetLicense
    | undefined;

  if (
    source.license !==
    undefined
  ) {
    if (
      !isObject(source.license)
    ) {
      throw new CaeError(
        "INVALID_REQUEST",
        "source.license must be an object.",
      );
    }

    const l =
      source.license;

    license = {
      id: requiredString(
        l.id,
        "source.license.id",
      ),
      name: requiredString(
        l.name,
        "source.license.name",
      ),
      url: optionalString(
        l.url,
      ),
      attributionRequired:
        l.attributionRequired ===
        true,
      attributionText:
        optionalString(
          l.attributionText,
        ),
      commercialUseAllowed:
        l.commercialUseAllowed ===
        true,
      modificationAllowed:
        l.modificationAllowed ===
        true,
      redistributionAllowed:
        l.redistributionAllowed ===
        true,
      sourceNotice:
        optionalString(
          l.sourceNotice,
        ),
    };
  }

  const sourceValue:
    AssetProvenance = {
    sourceType,

    originalFilename:
      optionalString(
        source.originalFilename,
      ),

    sourceUri:
      optionalString(
        source.sourceUri,
      ),

    sourceHash:
      optionalString(
        source.sourceHash,
      ),

    importerId:
      optionalString(
        source.importerId,
      ),

    importerVersion:
      optionalString(
        source.importerVersion,
      ),

    createdBy:
      optionalString(
        source.createdBy,
      ),

    license:
      license ??
      defaultLicense(),

    attributionRequired,
    notes:
      optionalString(
        source.notes,
      ),
  };

  const compatibilityInput =
    isObject(
      input.compatibility,
    )
      ? input.compatibility
      : {};

  const representationsRaw =
    Array.isArray(
      compatibilityInput.representations,
    )
      ? compatibilityInput.representations
      : ["2d"];

  const representations =
    uniqueStrings(
      representationsRaw as string[],
    ).map(
      assertRepresentation,
    );

  const coordinateSystem =
    optionalString(
      compatibilityInput.coordinateSystem,
    );

  const unitScaleRaw =
    compatibilityInput.unitScale;

  const unitScale =
    unitScaleRaw ===
    undefined
      ? 1
      : positiveNumber(
          unitScaleRaw,
          "compatibility.unitScale",
        );

  const rendererCapabilities =
    Array.isArray(
      compatibilityInput.rendererCapabilities,
    )
      ? uniqueStrings(
          compatibilityInput.rendererCapabilities as string[],
        )
      : [];

  const supportedEngineVersions =
    Array.isArray(
      compatibilityInput.supportedEngineVersions,
    )
      ? uniqueStrings(
          compatibilityInput.supportedEngineVersions as string[],
        )
      : [ASSET_ENGINE_VERSION];

  const compatibility:
    AssetCompatibility = {
    representations,

    ...(coordinateSystem
      ? { coordinateSystem }
      : {}),

    unitScale,

    rendererCapabilities,

    supportedEngineVersions,

    ...(optionalString(
      compatibilityInput.minimumEngineVersion,
    )
      ? {
          minimumEngineVersion:
            optionalString(
              compatibilityInput.minimumEngineVersion,
            ),
        }
      : {}),
  };

  const dependencyAssetIds =
    Array.isArray(
      input.dependencyAssetIds,
    )
      ? uniqueStrings(
          input.dependencyAssetIds as string[],
        )
      : [];

  if (
    dependencyAssetIds.includes(
      assetId,
    )
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      "An asset cannot depend on itself.",
      [assetId],
    );
  }

  const thumbnailAssetId =
    optionalString(
      input.thumbnailAssetId,
    );

  let version:
    AssetVersionLineage;

  if (
    !isObject(input.version)
  ) {
    version = {
      version: 1,
      rootAssetId: assetId,
    };
  } else {
    const versionInput =
      input.version;

    const versionNumber =
      nonNegativeInteger(
        versionInput.version,
        "version.version",
      );

    if (
      versionNumber < 1
    ) {
      throw new CaeError(
        "INVALID_REQUEST",
        "Asset version must be at least 1.",
      );
    }

    const rootAssetId =
      requiredString(
        versionInput.rootAssetId,
        "version.rootAssetId",
      );

    version = {
      version:
        versionNumber,

      parentAssetRevisionId:
        optionalString(
          versionInput.parentAssetRevisionId,
        ),

      rootAssetId,
    };
  }

  const metadataInput =
    isObject(input.metadata)
      ? input.metadata
      : {};

  const metadata:
    AssetMetadata = {
    name:
      optionalString(
        metadataInput.name,
      ),

    displayName:
      optionalString(
        metadataInput.displayName,
      ),

    description:
      optionalString(
        metadataInput.description,
      ),

    tags:
      Array.isArray(
        metadataInput.tags,
      )
        ? uniqueStrings(
            metadataInput.tags as string[],
          )
        : [],

    category:
      optionalString(
        metadataInput.category,
      ),

    author:
      optionalString(
        metadataInput.author,
      ),

    language:
      optionalString(
        metadataInput.language,
      ),

    custom:
      isObject(
        metadataInput.custom,
      )
        ? clone(
            metadataInput.custom,
          )
        : {},
  };

  const createdAt =
    requiredString(
      input.createdAt,
      "createdAt",
    );

  const updatedAt =
    requiredString(
      input.updatedAt,
      "updatedAt",
    );

  const createdBy =
    requiredString(
      input.createdBy,
      "createdBy",
    );

  const manifestWithoutHash = {
    assetId,
    schemaVersion,
    revision,
    assetType,
    source: sourceValue,
    storage: {
      contentHash,
      blobUri,
      byteSize,
      mimeType,
      derivedArtifactUris,
    },
    compatibility,
    dependencyAssetIds,
    ...(thumbnailAssetId
      ? { thumbnailAssetId }
      : {}),
    version,
    metadata,
    createdAt,
    updatedAt,
    createdBy,
  };

  const expectedHash =
    fingerprintAsset(
      manifestWithoutHash,
    );

  const suppliedHash =
    requiredString(
      input.contentHash,
      "contentHash",
    );

  if (
    suppliedHash !==
    expectedHash
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Asset contentHash does not match the canonical manifest fingerprint.",
      [
        {
          expected: expectedHash,
          received: suppliedHash,
        },
      ],
    );
  }

  return clone({
    ...manifestWithoutHash,
    contentHash:
      suppliedHash,
  });
}

/* -------------------------------------------------------------------------- */
/* Asset Creation                                                             */
/* -------------------------------------------------------------------------- */

export function createAssetManifest(
  input: CreateAssetInput,
): AssetManifest {
  if (!isObject(input)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Asset creation input must be an object.",
    );
  }

  const assetId =
    input.assetId ??
    uuid();

  const createdBy =
    input.createdBy ??
    "local";

  const createdAt =
    input.createdAt ??
    nowIso();

  const updatedAt =
    input.updatedAt ??
    createdAt;

  const sourceInput =
    input.source ?? {};

  const source:
    AssetProvenance = {
    ...defaultSource(),
    ...sourceInput,

    sourceType:
      sourceInput.sourceType ??
      "authored",

    attributionRequired:
      sourceInput.attributionRequired ??
      sourceInput.license
        ?.attributionRequired ??
      false,

    license:
      sourceInput.license ??
      defaultLicense(),
  };

  const compatibility:
    AssetCompatibility = {
    ...defaultCompatibility(),
    ...input.compatibility,

    representations:
      input.compatibility
        ?.representations ??
      defaultCompatibility()
        .representations,

    rendererCapabilities:
      input.compatibility
        ?.rendererCapabilities ??
      [],

    supportedEngineVersions:
      input.compatibility
        ?.supportedEngineVersions ??
      [ASSET_ENGINE_VERSION],
  };

  const metadata:
    AssetMetadata = {
    ...defaultMetadata(),
    ...input.metadata,

    tags:
      input.metadata?.tags ??
      [],

    custom:
      input.metadata?.custom ??
      {},
  };

  const version:
    AssetVersionLineage = {
    version:
      input.version?.version ??
      1,

    parentAssetRevisionId:
      input.version
        ?.parentAssetRevisionId,

    rootAssetId:
      input.version?.rootAssetId ??
      assetId,
  };

  const withoutHash: Omit<
    AssetManifest,
    "contentHash"
  > = {
    assetId,
    schemaVersion:
      ASSET_MANIFEST_SCHEMA_VERSION,
    revision: 1,
    assetType:
      input.assetType,

    source,

    storage: {
      contentHash:
        input.storage.contentHash,
      blobUri:
        input.storage.blobUri,
      byteSize:
        input.storage.byteSize,
      mimeType:
        input.storage.mimeType,
      derivedArtifactUris:
        input.storage
          .derivedArtifactUris ??
        [],
    },

    compatibility,

    dependencyAssetIds:
      input.dependencyAssetIds ??
      [],

    ...(input.thumbnailAssetId
      ? {
          thumbnailAssetId:
            input.thumbnailAssetId,
        }
      : {}),

    version,

    metadata,

    createdAt,
    updatedAt,
    createdBy,
  };

  const contentHash =
    fingerprintAsset(
      withoutHash,
    );

  return validateAssetManifest({
    ...withoutHash,
    contentHash,
  });
}

/* -------------------------------------------------------------------------- */
/* Variant Fingerprint                                                        */
/* -------------------------------------------------------------------------- */

function fingerprintVariant(
  variant: Omit<
    AssetVariantRecipe,
    "contentHash"
  >,
): string {
  return canonicalHash({
    variantId:
      variant.variantId,

    schemaVersion:
      variant.schemaVersion,

    baseAssetId:
      variant.baseAssetId,

    name:
      variant.name ?? null,

    crop:
      variant.crop ?? null,

    paletteOverrides:
      variant.paletteOverrides,

    materialOverrides:
      variant.materialOverrides,

    textureOverrides:
      variant.textureOverrides,

    meshVariant:
      variant.meshVariant ?? null,

    lod:
      variant.lod ?? null,

    languageLabel:
      variant.languageLabel ?? null,

    representations:
      variant.representations,

    parameters:
      variant.parameters,
  }) as string;
}

/* -------------------------------------------------------------------------- */
/* Variant Creation                                                           */
/* -------------------------------------------------------------------------- */

export function createAssetVariant(
  input: CreateVariantInput,
): AssetVariantRecipe {
  const baseAssetId =
    requiredString(
      input.baseAssetId,
      "baseAssetId",
    );

  const variantId =
    input.variantId ??
    uuid();

  const withoutHash: Omit<
    AssetVariantRecipe,
    "contentHash"
  > = {
    variantId,

    schemaVersion:
      ASSET_VARIANT_SCHEMA_VERSION,

    baseAssetId,

    ...(input.name
      ? { name: input.name }
      : {}),

    ...(input.crop
      ? {
          crop: {
            x: finiteNumber(
              input.crop.x,
              "crop.x",
            ),
            y: finiteNumber(
              input.crop.y,
              "crop.y",
            ),
            width: positiveNumber(
              input.crop.width,
              "crop.width",
            ),
            height: positiveNumber(
              input.crop.height,
              "crop.height",
            ),
          },
        }
      : {}),

    paletteOverrides:
      clone(
        input.paletteOverrides ??
          {},
      ),

    materialOverrides:
      clone(
        input.materialOverrides ??
          {},
      ),

    textureOverrides:
      clone(
        input.textureOverrides ??
          {},
      ),

    ...(input.meshVariant
      ? {
          meshVariant:
            input.meshVariant,
        }
      : {}),

    ...(input.lod !== undefined
      ? {
          lod:
            nonNegativeInteger(
              input.lod,
              "lod",
            ),
        }
      : {}),

    ...(input.languageLabel
      ? {
          languageLabel:
            input.languageLabel,
        }
      : {}),

    representations:
      input.representations ??
      ["2d"],

    parameters:
      clone(
        input.parameters ??
          {},
      ),
  };

  const contentHash =
    fingerprintVariant(
      withoutHash,
    );

  return {
    ...withoutHash,
    contentHash,
  };
}

/* -------------------------------------------------------------------------- */
/* Asset Catalog                                                              */
/* -------------------------------------------------------------------------- */

export class AssetCatalog {
  private readonly assets =
    new Map<
      string,
      AssetManifest
    >();

  private readonly variants =
    new Map<
      string,
      AssetVariantRecipe
    >();

  /* ------------------------------------------------------------------------ */
  /* Register Asset                                                           */
  /* ------------------------------------------------------------------------ */

  register(
    input:
      | AssetManifest
      | CreateAssetInput,
  ): AssetManifest {
    const manifest =
      this.isManifest(input)
        ? validateAssetManifest(
            input,
          )
        : createAssetManifest(
            input,
          );

    const existing =
      this.assets.get(
        manifest.assetId,
      );

    if (existing) {
      if (
        existing.contentHash ===
        manifest.contentHash
      ) {
        return clone(existing);
      }

      throw new CaeError(
        "ENTITY_DUPLICATE",
        `Asset "${manifest.assetId}" already exists with different content.`,
        [
          manifest.assetId,
        ],
      );
    }

    this.assets.set(
      manifest.assetId,
      clone(manifest),
    );

    return clone(manifest);
  }

  /* ------------------------------------------------------------------------ */
  /* Register Variant                                                         */
  /* ------------------------------------------------------------------------ */

  registerVariant(
    input:
      | AssetVariantRecipe
      | CreateVariantInput,
  ): AssetVariantRecipe {
    const variant =
      this.isVariant(input)
        ? clone(input)
        : createAssetVariant(
            input,
          );

    if (
      !this.assets.has(
        variant.baseAssetId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Base asset "${variant.baseAssetId}" was not found.`,
        [
          variant.baseAssetId,
        ],
      );
    }

    const expectedHash =
      fingerprintVariant({
        variantId:
          variant.variantId,

        schemaVersion:
          variant.schemaVersion,

        baseAssetId:
          variant.baseAssetId,

        ...(variant.name
          ? {
              name:
                variant.name,
            }
          : {}),

        ...(variant.crop
          ? {
              crop:
                variant.crop,
            }
          : {}),

        paletteOverrides:
          variant.paletteOverrides,

        materialOverrides:
          variant.materialOverrides,

        textureOverrides:
          variant.textureOverrides,

        ...(variant.meshVariant
          ? {
              meshVariant:
                variant.meshVariant,
            }
          
          : {}),

        ...(variant.lod !== undefined
          ? {
              lod:
                variant.lod,
            }
          
          : {}),

        ...(variant.languageLabel
          ? {
              languageLabel:
                variant.languageLabel,
            }
          
          : {}),

        representations:
          variant.representations,

        parameters:
          variant.parameters,
      });

    if (
      variant.contentHash !==
      expectedHash
    ) {
      throw new CaeError(
        "INVALID_REQUEST",
        "Variant contentHash does not match its canonical recipe.",
      );
    }

    const existing =
      this.variants.get(
        variant.variantId,
      );

    if (existing) {
      if (
        existing.contentHash ===
        variant.contentHash
      ) {
        return clone(existing);
      }

      throw new CaeError(
        "ENTITY_DUPLICATE",
        `Variant "${variant.variantId}" already exists with different content.`,
        [
          variant.variantId,
        ],
      );
    }

    this.variants.set(
      variant.variantId,
      clone(variant),
    );

    return clone(variant);
  }

  /* ------------------------------------------------------------------------ */
  /* Get                                                                      */
  /* ------------------------------------------------------------------------ */

  get(
    assetId: string,
  ): AssetManifest | undefined {
    const asset =
      this.assets.get(
        requiredString(
          assetId,
          "assetId",
        ),
      );

    return asset
      ? clone(asset)
      : undefined;
  }

  require(
    assetId: string,
  ): AssetManifest {
    const asset =
      this.get(assetId);

    if (!asset) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Asset "${assetId}" was not found.`,
        [assetId],
      );
    }

    return asset;
  }

  getVariant(
    variantId: string,
  ):
    | AssetVariantRecipe
    | undefined {
    const variant =
      this.variants.get(
        requiredString(
          variantId,
          "variantId",
        ),
      );

    return variant
      ? clone(variant)
      : undefined;
  }

  requireVariant(
    variantId: string,
  ): AssetVariantRecipe {
    const variant =
      this.getVariant(
        variantId,
      );

    if (!variant) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Asset variant "${variantId}" was not found.`,
        [variantId],
      );
    }

    return variant;
  }

  /* ------------------------------------------------------------------------ */
  /* List                                                                     */
  /* ------------------------------------------------------------------------ */

  list(
    query: AssetQuery = {},
  ): AssetManifest[] {
    const assets =
      [...this.assets.values()]
        .filter((asset) => {
          if (
            query.assetType &&
            asset.assetType !==
              query.assetType
          ) {
            return false;
          }

          if (
            query.representation &&
            !asset.compatibility
              .representations
              .includes(
                query.representation,
              )
          ) {
            return false;
          }

          if (
            query.tag &&
            !asset.metadata.tags.includes(
              query.tag,
            )
          ) {
            return false;
          }

          if (
            query.name &&
            asset.metadata.name
              ?.toLowerCase() !==
              query.name.toLowerCase()
          ) {
            return false;
          }

          if (
            query.contentHash &&
            asset.storage
              .contentHash !==
              query.contentHash
          ) {
            return false;
          }

          return true;
        })
        .sort(
          (a, b) =>
            a.assetId.localeCompare(
              b.assetId,
            ),
        );

    return clone(assets);
  }

  listVariants(
    baseAssetId?: string,
  ): AssetVariantRecipe[] {
    const variants =
      [...this.variants.values()]
        .filter(
          (variant) =>
            !baseAssetId ||
            variant.baseAssetId ===
              baseAssetId,
        )
        .sort(
          (a, b) =>
            a.variantId.localeCompare(
              b.variantId,
            ),
        );

    return clone(variants);
  }

  /* ------------------------------------------------------------------------ */
  /* Remove                                                                   */
  /* ------------------------------------------------------------------------ */

  remove(
    assetId: string,
  ): boolean {
    const id =
      requiredString(
        assetId,
        "assetId",
      );

    for (
      const variant of this.variants.values()
    ) {
      if (
        variant.baseAssetId ===
        id
      ) {
        throw new CaeError(
          "COMMAND_INVALID",
          `Asset "${id}" cannot be removed while variants reference it.`,
          [id],
        );
      }
    }

    for (
      const asset of this.assets.values()
    ) {
      if (
        asset.dependencyAssetIds.includes(
          id,
        )
      ) {
        throw new CaeError(
          "COMMAND_INVALID",
          `Asset "${id}" cannot be removed because another asset depends on it.`,
          [id],
        );
      }
    }

    return this.assets.delete(
      id,
    );
  }

  removeVariant(
    variantId: string,
  ): boolean {
    return this.variants.delete(
      requiredString(
        variantId,
        "variantId",
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Dependency Graph                                                         */
  /* ------------------------------------------------------------------------ */

  dependencies(
    assetId: string,
  ): string[] {
    return [
      ...this.require(
        assetId,
      ).dependencyAssetIds,
    ];
  }

  dependents(
    assetId: string,
  ): string[] {
    const id =
      requiredString(
        assetId,
        "assetId",
      );

    return [
      ...this.assets.values(),
    ]
      .filter(
        (asset) =>
          asset.dependencyAssetIds.includes(
            id,
          ),
      )
      .map(
        (asset) =>
          asset.assetId,
      )
      .sort();
  }

  hasDependencyCycle(): boolean {
    const visiting =
      new Set<string>();

    const visited =
      new Set<string>();

    const visit = (
      id: string,
    ): boolean => {
      if (
        visiting.has(id)
      ) {
        return true;
      }

      if (
        visited.has(id)
      ) {
        return false;
      }

      visiting.add(id);

      const asset =
        this.assets.get(id);

      if (asset) {
        for (
          const dependencyId of
          asset.dependencyAssetIds
        ) {
          if (
            this.assets.has(
              dependencyId,
            ) &&
            visit(
              dependencyId,
            )
          ) {
            return true;
          }
        }
      }

      visiting.delete(id);
      visited.add(id);

      return false;
    };

    for (
      const asset of this.assets.values()
    ) {
      if (
        visit(
          asset.assetId,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /* ------------------------------------------------------------------------ */
  /* Capability / Compatibility                                               */
  /* ------------------------------------------------------------------------ */

  supportsRepresentation(
    assetId: string,
    representation:
      AssetRepresentation,
  ): boolean {
    return this.require(
      assetId,
    ).compatibility.representations.includes(
      representation,
    );
  }

  supportsCapability(
    assetId: string,
    capability: string,
  ): boolean {
    const asset =
      this.require(
        assetId,
      );

    return asset.compatibility
      .rendererCapabilities.includes(
        capability,
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    assetId: string,
  ): string {
    return this.require(
      assetId,
    ).contentHash;
  }

  /* ------------------------------------------------------------------------ */
  /* Statistics                                                               */
  /* ------------------------------------------------------------------------ */

  stats() {
    const byType =
      Object.fromEntries(
        ASSET_TYPES.map(
          (type) => [
            type,
            this.list({
              assetType:
                type,
            }).length,
          ],
        ),
      );

    return {
      assetCount:
        this.assets.size,

      variantCount:
        this.variants.size,

      byType,

      hasDependencyCycle:
        this.hasDependencyCycle(),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Export                                                                    */
  /* ------------------------------------------------------------------------ */

  exportManifest(
    assetId: string,
  ): AssetManifest {
    return this.require(
      assetId,
    );
  }

  exportAll(): {
    assets: AssetManifest[];
    variants: AssetVariantRecipe[];
  } {
    return {
      assets: this.list(),
      variants:
        this.listVariants(),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Clear                                                                     */
  /* ------------------------------------------------------------------------ */

  clear(): void {
    this.assets.clear();
    this.variants.clear();
  }

  /* ------------------------------------------------------------------------ */
  /* Internal Type Guards                                                      */
  /* ------------------------------------------------------------------------ */

  private isManifest(
    value:
      | AssetManifest
      | CreateAssetInput,
  ): value is AssetManifest {
    return (
      isObject(value) &&
      typeof value.assetId ===
        "string" &&
      typeof value.schemaVersion ===
        "string" &&
      typeof value.contentHash ===
        "string" &&
      isObject(value.storage)
    );
  }

  private isVariant(
    value:
      | AssetVariantRecipe
      | CreateVariantInput,
  ): value is AssetVariantRecipe {
    return (
      isObject(value) &&
      typeof value.variantId ===
        "string" &&
      typeof value.schemaVersion ===
        "string" &&
      typeof value.contentHash ===
        "string"
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Dependency Ordering                                                        */
/* -------------------------------------------------------------------------- */

export function topologicalAssetOrder(
  assets: readonly AssetManifest[],
): AssetManifest[] {
  const byId =
    new Map(
      assets.map(
        (asset) => [
          asset.assetId,
          asset,
        ],
      ),
    );

  const temporary =
    new Set<string>();

  const permanent =
    new Set<string>();

  const output:
    AssetManifest[] = [];

  const visit = (
    id: string,
  ): void => {
    if (
      permanent.has(id)
    ) {
      return;
    }

    if (
      temporary.has(id)
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Asset dependency graph contains a cycle.",
        [id],
      );
    }

    temporary.add(id);

    const asset =
      byId.get(id);

    if (!asset) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Asset dependency "${id}" was not found.`,
        [id],
      );
    }

    const dependencies =
      [
        ...asset.dependencyAssetIds,
      ].sort();

    for (
      const dependencyId of
      dependencies
    ) {
      visit(
        dependencyId,
      );
    }

    temporary.delete(id);
    permanent.add(id);

    output.push(
      asset,
    );
  };

  const sortedIds =
    assets
      .map(
        (asset) =>
          asset.assetId,
      )
      .sort();

  for (
    const id of sortedIds
  ) {
    visit(id);
  }

  return output.map(
    clone,
  );
}

/* -------------------------------------------------------------------------- */
/* Default Catalog                                                            */
/* -------------------------------------------------------------------------- */

export function createDefaultAssetCatalog(): AssetCatalog {
  return new AssetCatalog();
}

export default AssetCatalog;