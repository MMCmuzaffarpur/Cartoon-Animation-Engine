import { describe, expect, it } from "vitest";

import {
  ASSET_ENGINE_VERSION,
  ASSET_MANIFEST_SCHEMA_VERSION,
  AssetCatalog,
  createAssetManifest,
  createAssetVariant,
  fingerprintAsset,
  topologicalAssetOrder,
  validateAssetManifest,
} from "../packages/asset-engine/src/index.js";

function makeAsset(
  overrides: Record<string, unknown> = {},
) {
  return createAssetManifest({
    assetId:
      "00000000-0000-4000-8000-000000000101",

    assetType:
      "vector",

    storage: {
      contentHash:
        "source-content-hash-001",

      blobUri:
        "asset://vector/head-round-01",

      byteSize:
        1024,

      mimeType:
        "image/svg+xml",
    },

    compatibility: {
      representations: [
        "2d",
      ],

      coordinateSystem:
        "engine-2d",

      unitScale:
        1,

      rendererCapabilities: [
        "render.2d",
      ],

      supportedEngineVersions: [
        ASSET_ENGINE_VERSION,
      ],
    },

    metadata: {
      name:
        "head-round-01",

      displayName:
        "Round Head",

      tags: [
        "character",
        "head",
      ],

      category:
        "head",

      custom: {},
    },

    createdBy:
      "test",

    ...overrides,
  });
}

describe(
  "Asset Engine",
  () => {
    describe(
      "manifest creation",
      () => {
        it(
          "creates a valid immutable manifest",
          () => {
            const asset =
              makeAsset();

            expect(
              asset.assetId,
            ).toBe(
              "00000000-0000-4000-8000-000000000101",
            );

            expect(
              asset.schemaVersion,
            ).toBe(
              ASSET_MANIFEST_SCHEMA_VERSION,
            );

            expect(
              asset.assetType,
            ).toBe(
              "vector",
            );

            expect(
              asset.contentHash,
            ).toMatch(
              /^[a-f0-9]{64}$/i,
            );
          },
        );

        it(
          "produces deterministic fingerprints",
          () => {
            const a =
              makeAsset();

            const b =
              makeAsset();

            expect(
              a.contentHash,
            ).toBe(
              b.contentHash,
            );
          },
        );

        it(
          "changes fingerprint when manifest content changes",
          () => {
            const a =
              makeAsset();

            const b =
              makeAsset({
                metadata: {
                  name:
                    "head-round-02",
                  tags: [
                    "character",
                    "head",
                  ],
                  custom: {},
                },
              });

            expect(
              a.contentHash,
            ).not.toBe(
              b.contentHash,
            );
          },
        );
      },
    );

    describe(
      "validation",
      () => {
        it(
          "accepts a correctly fingerprinted manifest",
          () => {
            const asset =
              makeAsset();

            const parsed =
              validateAssetManifest(
                asset,
              );

            expect(
              parsed.contentHash,
            ).toBe(
              asset.contentHash,
            );
          },
        );

        it(
          "rejects a tampered content hash",
          () => {
            const asset =
              makeAsset();

            expect(
              () =>
                validateAssetManifest({
                  ...asset,
                  contentHash:
                    "tampered",
                }),
            ).toThrow(
              /contentHash/i,
            );
          },
        );

        it(
          "rejects self dependency",
          () => {
            expect(
              () =>
                makeAsset({
                  dependencyAssetIds: [
                    "00000000-0000-4000-8000-000000000101",
                  ],
                }),
            ).toThrow(
              /cannot depend on itself/i,
            );
          },
        );
      },
    );

    describe(
      "catalog",
      () => {
        it(
          "registers and retrieves assets",
          () => {
            const catalog =
              new AssetCatalog();

            const asset =
              makeAsset();

            catalog.register(
              asset,
            );

            expect(
              catalog.get(
                asset.assetId,
              ),
            ).toEqual(
              asset,
            );

            expect(
              catalog.require(
                asset.assetId,
              ),
            ).toEqual(
              asset,
            );
          },
        );

        it(
          "does not create duplicates for identical content",
          () => {
            const catalog =
              new AssetCatalog();

            const asset =
              makeAsset();

            const first =
              catalog.register(
                asset,
              );

            const second =
              catalog.register(
                asset,
              );

            expect(
              second,
            ).toEqual(
              first,
            );

            expect(
              catalog.stats()
                .assetCount,
            ).toBe(1);
          },
        );

        it(
          "rejects duplicate ids with different content",
          () => {
            const catalog =
              new AssetCatalog();

            catalog.register(
              makeAsset(),
            );

            expect(
              () =>
                catalog.register(
                  makeAsset({
                    storage: {
                      contentHash:
                        "different-source",
                      blobUri:
                        "asset://different",
                      byteSize:
                        2048,
                      mimeType:
                        "image/svg+xml",
                    },
                  }),
                ),
            ).toThrow(
              /already exists/i,
            );
          },
        );

        it(
          "filters by asset type",
          () => {
            const catalog =
              new AssetCatalog();

            catalog.register(
              makeAsset(),
            );

            expect(
              catalog.list({
                assetType:
                  "vector",
              }),
            ).toHaveLength(1);

            expect(
              catalog.list({
                assetType:
                  "audio",
              }),
            ).toHaveLength(0);
          },
        );

        it(
          "filters by tag",
          () => {
            const catalog =
              new AssetCatalog();

            catalog.register(
              makeAsset(),
            );

            expect(
              catalog.list({
                tag: "head",
              }),
            ).toHaveLength(1);

            expect(
              catalog.list({
                tag: "vehicle",
              }),
            ).toHaveLength(0);
          },
        );

        it(
          "returns sorted deterministic catalog results",
          () => {
            const catalog =
              new AssetCatalog();

            const first =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000102",
              });

            const second =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000103",
              });

            catalog.register(
              second,
            );

            catalog.register(
              first,
            );

            expect(
              catalog.list().map(
                (asset) =>
                  asset.assetId,
              ),
            ).toEqual([
              "00000000-0000-4000-8000-000000000102",
              "00000000-0000-4000-8000-000000000103",
            ]);
          },
        );
      },
    );

    describe(
      "variants",
      () => {
        it(
          "creates a deterministic variant recipe",
          () => {
            const variant =
              createAssetVariant({
                variantId:
                  "00000000-0000-4000-8000-000000000201",

                baseAssetId:
                  "00000000-0000-4000-8000-000000000101",

                name:
                  "Red Hair",

                paletteOverrides: {
                  hair:
                    "#ff0000",
                },

                representations: [
                  "2d",
                ],
              });

            expect(
              variant.contentHash,
            ).toMatch(
              /^[a-f0-9]{64}$/i,
            );

            const second =
              createAssetVariant({
                variantId:
                  "00000000-0000-4000-8000-000000000201",

                baseAssetId:
                  "00000000-0000-4000-8000-000000000101",

                name:
                  "Red Hair",

                paletteOverrides: {
                  hair:
                    "#ff0000",
                },

                representations: [
                  "2d",
                ],
              });

            expect(
              second.contentHash,
            ).toBe(
              variant.contentHash,
            );
          },
        );

        it(
          "registers a variant only for an existing base asset",
          () => {
            const catalog =
              new AssetCatalog();

            catalog.register(
              makeAsset(),
            );

            const variant =
              createAssetVariant({
                variantId:
                  "00000000-0000-4000-8000-000000000201",

                baseAssetId:
                  "00000000-0000-4000-8000-000000000101",
              });

            expect(
              catalog.registerVariant(
                variant,
              ),
            ).toEqual(
              variant,
            );
          },
        );

        it(
          "rejects variant for missing base asset",
          () => {
            const catalog =
              new AssetCatalog();

            expect(
              () =>
                catalog.registerVariant({
                  variantId:
                    "00000000-0000-4000-8000-000000000201",

                  schemaVersion:
                    "1.0.0",

                  baseAssetId:
                    "00000000-0000-4000-8000-000000000999",

                  paletteOverrides: {},
                  materialOverrides: {},
                  textureOverrides: {},
                  representations: [
                    "2d",
                  ],
                  parameters: {},
                  contentHash:
                    "invalid",
                }),
            ).toThrow(
              /Base asset/i,
            );
          },
        );
      },
    );

    describe(
      "dependencies",
      () => {
        it(
          "returns direct dependencies",
          () => {
            const catalog =
              new AssetCatalog();

            const base =
              makeAsset();

            const child =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000102",

                dependencyAssetIds: [
                  base.assetId,
                ],
              });

            catalog.register(
              base,
            );

            catalog.register(
              child,
            );

            expect(
              catalog.dependencies(
                child.assetId,
              ),
            ).toEqual([
              base.assetId,
            ]);

            expect(
              catalog.dependents(
                base.assetId,
              ),
            ).toEqual([
              child.assetId,
            ]);
          },
        );

        it(
          "produces dependency-first topological order",
          () => {
            const base =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000101",
              });

            const middle =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000102",

                dependencyAssetIds: [
                  base.assetId,
                ],
              });

            const top =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000103",

                dependencyAssetIds: [
                  middle.assetId,
                ],
              });

            const ordered =
              topologicalAssetOrder([
                top,
                middle,
                base,
              ]);

            expect(
              ordered.map(
                (asset) =>
                  asset.assetId,
              ),
            ).toEqual([
              base.assetId,
              middle.assetId,
              top.assetId,
            ]);
          },
        );
      },
    );

    describe(
      "compatibility",
      () => {
        it(
          "checks representation support",
          () => {
            const catalog =
              new AssetCatalog();

            const asset =
              makeAsset({
                compatibility: {
                  representations: [
                    "2d",
                    "hybrid",
                  ],
                  coordinateSystem:
                    "engine-2d",
                  unitScale: 1,
                  rendererCapabilities: [],
                  supportedEngineVersions: [
                    ASSET_ENGINE_VERSION,
                  ],
                },
              });

            catalog.register(
              asset,
            );

            expect(
              catalog.supportsRepresentation(
                asset.assetId,
                "2d",
              ),
            ).toBe(true);

            expect(
              catalog.supportsRepresentation(
                asset.assetId,
                "3d",
              ),
            ).toBe(false);
          },
        );

        it(
          "checks renderer capability",
          () => {
            const catalog =
              new AssetCatalog();

            const asset =
              makeAsset();

            catalog.register(
              asset,
            );

            expect(
              catalog.supportsCapability(
                asset.assetId,
                "render.2d",
              ),
            ).toBe(true);

            expect(
              catalog.supportsCapability(
                asset.assetId,
                "render.3d",
              ),
            ).toBe(false);
          },
        );
      },
    );

    describe(
      "removal",
      () => {
        it(
          "removes an unused asset",
          () => {
            const catalog =
              new AssetCatalog();

            const asset =
              makeAsset();

            catalog.register(
              asset,
            );

            expect(
              catalog.remove(
                asset.assetId,
              ),
            ).toBe(true);

            expect(
              catalog.get(
                asset.assetId,
              ),
            ).toBeUndefined();
          },
        );

        it(
          "protects assets referenced by dependencies",
          () => {
            const catalog =
              new AssetCatalog();

            const base =
              makeAsset();

            const child =
              makeAsset({
                assetId:
                  "00000000-0000-4000-8000-000000000102",

                dependencyAssetIds: [
                  base.assetId,
                ],
              });

            catalog.register(
              base,
            );

            catalog.register(
              child,
            );

            expect(
              () =>
                catalog.remove(
                  base.assetId,
                ),
            ).toThrow(
              /depends on it/i,
            );
          },
        );
      },
    );

    describe(
      "fingerprinting",
      () => {
        it(
          "fingerprint matches stored content hash",
          () => {
            const asset =
              makeAsset();

            const {
              contentHash,
              ...withoutHash
            } = asset;

            expect(
              fingerprintAsset(
                withoutHash,
              ),
            ).toBe(
              contentHash,
            );
          },
        );
      },
    );
  },
);