import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AssetCatalog,
  createAssetManifest,
} from "../packages/asset-engine/src/index.js";

import {
  CharacterAssemblyCatalog,
  createAssemblyPart,
  createCharacterAssembly,
  fingerprintAssembly,
  replacePartAsset,
  resolveAssemblyAssets,
  setPartVisibility,
  transformPart,
  validateAssemblyAssets,
  validateCharacterAssembly,
} from "../packages/character-assembly/src/index.js";

function makeAsset(
  assetId: string,
  representation:
    | "2d"
    | "3d"
    | "hybrid" = "2d",
) {
  return createAssetManifest({
    assetId,

    assetType:
      "vector",

    storage: {
      contentHash:
        `source-${assetId}`,

      blobUri:
        `asset://test/${assetId}`,

      byteSize:
        100,

      mimeType:
        "image/svg+xml",
    },

    compatibility: {
      representations: [
        representation,
      ],

      coordinateSystem:
        "engine-2d",

      unitScale:
        1,

      rendererCapabilities: [
        "render.2d",
      ],

      supportedEngineVersions: [
        "1.0.0",
      ],
    },

    metadata: {
      name:
        assetId,

      tags: [
        "character",
      ],

      custom: {},
    },

    createdBy:
      "test",
  });
}

function makeAssembly() {
  return createCharacterAssembly({
    assemblyId:
      "00000000-0000-4000-8000-000000000301",

    characterId:
      "00000000-0000-4000-8000-000000000302",

    definitionId:
      "00000000-0000-4000-8000-000000000303",

    representation:
      "2d",

    rootPartId:
      "root",

    parts: [
      {
        partId:
          "root",

        name:
          "Body",

        type:
          "body",

        assetId:
          "asset-body",

        zIndex:
          10,
      },

      {
        partId:
          "head",

        name:
          "Head",

        type:
          "head",

        assetId:
          "asset-head",

        parentPartId:
          "root",

        zIndex:
          30,
      },

      {
        partId:
          "hair",

        name:
          "Hair",

        type:
          "hair",

        assetId:
          "asset-hair",

        parentPartId:
          "head",

        zIndex:
          80,
      },

      {
        partId:
          "eye-left",

        name:
          "Left Eye",

        type:
          "eye",

        assetId:
          "asset-eye-left",

        parentPartId:
          "head",

        zIndex:
          50,
      },

      {
        partId:
          "eye-right",

        name:
          "Right Eye",

        type:
          "eye",

        assetId:
          "asset-eye-right",

        parentPartId:
          "head",

        zIndex:
          51,
      },
    ],

    metadata: {
      characterName:
        "Ravi",
    },

    createdBy:
      "test",
  });
}

describe(
  "Character Assembly Engine",
  () => {
    describe(
      "part creation",
      () => {
        it(
          "creates a part with deterministic defaults",
          () => {
            const part =
              createAssemblyPart({
                partId:
                  "root",

                name:
                  "Body",

                type:
                  "body",

                assetId:
                  "asset-body",
              });

            expect(
              part.partId,
            ).toBe(
              "root",
            );

            expect(
              part.transform,
            ).toEqual({
              x: 0,
              y: 0,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
            });

            expect(
              part.appearance,
            ).toEqual({
              visible: true,
              opacity: 1,
              blendMode:
                "normal",
            });
          },
        );

        it(
          "preserves explicit transform",
          () => {
            const part =
              createAssemblyPart({
                partId:
                  "head",

                name:
                  "Head",

                type:
                  "head",

                assetId:
                  "asset-head",

                transform: {
                  x: 10,
                  y: 20,
                  rotation: 15,
                  scaleX: 1.2,
                  scaleY: 0.9,
                },
              });

            expect(
              part.transform,
            ).toEqual({
              x: 10,
              y: 20,
              rotation: 15,
              scaleX: 1.2,
              scaleY: 0.9,
            });
          },
        );
      },
    );

    describe(
      "assembly creation",
      () => {
        it(
          "creates a complete character assembly",
          () => {
            const assembly =
              makeAssembly();

            expect(
              assembly.assemblyId,
            ).toBe(
              "00000000-0000-4000-8000-000000000301",
            );

            expect(
              assembly.characterId,
            ).toBe(
              "00000000-0000-4000-8000-000000000302",
            );

            expect(
              assembly.rootPartId,
            ).toBe(
              "root",
            );

            expect(
              assembly.parts,
            ).toHaveLength(5);

            expect(
              assembly.contentHash,
            ).toMatch(
              /^[a-f0-9]{64}$/i,
            );
          },
        );

        it(
          "creates deterministic fingerprints",
          () => {
            const first =
              makeAssembly();

            const second =
              makeAssembly();

            expect(
              first.contentHash,
            ).toBe(
              second.contentHash,
            );
          },
        );

        it(
          "changes fingerprint when a part changes",
          () => {
            const assembly =
              makeAssembly();

            const changed =
              replacePartAsset(
                assembly,
                "hair",
                "asset-hair-red",
              );

            expect(
              changed.contentHash,
            ).not.toBe(
              assembly.contentHash,
            );
          },
        );

        it(
          "rejects duplicate part IDs",
          () => {
            expect(
              () =>
                createCharacterAssembly({
                  characterId:
                    "character",

                  definitionId:
                    "definition",

                  representation:
                    "2d",

                  parts: [
                    {
                      partId:
                        "same",

                      name:
                        "A",

                      type:
                        "body",

                      assetId:
                        "asset-a",
                    },

                    {
                      partId:
                        "same",

                      name:
                        "B",

                      type:
                        "head",

                      assetId:
                        "asset-b",
                    },
                  ],
                }),
            ).toThrow(
              /duplicate part/i,
            );
          },
        );

        it(
          "rejects missing parent",
          () => {
            expect(
              () =>
                createCharacterAssembly({
                  characterId:
                    "character",

                  definitionId:
                    "definition",

                  representation:
                    "2d",

                  parts: [
                    {
                      partId:
                        "root",

                      name:
                        "Root",

                      type:
                        "body",

                      assetId:
                        "asset-root",
                    },

                    {
                      partId:
                        "head",

                      name:
                        "Head",

                      type:
                        "head",

                      assetId:
                        "asset-head",

                      parentPartId:
                        "missing",
                    },
                  ],
                }),
            ).toThrow(
              /Parent part/i,
            );
          },
        );

        it(
          "rejects self parenting",
          () => {
            expect(
              () =>
                createCharacterAssembly({
                  characterId:
                    "character",

                  definitionId:
                    "definition",

                  representation:
                    "2d",

                  parts: [
                    {
                      partId:
                        "root",

                      name:
                        "Root",

                      type:
                        "body",

                      assetId:
                        "asset-root",

                      parentPartId:
                        "root",
                    },
                  ],
                }),
            ).toThrow(
              /cannot parent itself/i,
            );
          },
        );
      },
    );

    describe(
      "catalog",
      () => {
        it(
          "registers and retrieves assemblies",
          () => {
            const catalog =
              new CharacterAssemblyCatalog();

            const assembly =
              makeAssembly();

            catalog.register(
              assembly,
            );

            expect(
              catalog.get(
                assembly.assemblyId,
              ),
            ).toEqual(
              assembly,
            );

            expect(
              catalog.require(
                assembly.assemblyId,
              ),
            ).toEqual(
              assembly,
            );
          },
        );

        it(
  "returns defensive copies",
  () => {
    const catalog =
      new CharacterAssemblyCatalog();

    const assembly =
      makeAssembly();

    catalog.register(
      assembly,
    );

    const retrieved =
      catalog.require(
        assembly.assemblyId,
      );

    const mutableMetadata =
      retrieved.metadata as Record<
        string,
        unknown
      >;

    mutableMetadata.test =
      "changed";

    const again =
      catalog.require(
        assembly.assemblyId,
      );

    expect(
      again.metadata.test,
    ).toBeUndefined();
  },
);

        it(
          "lists assemblies deterministically",
          () => {
            const catalog =
              new CharacterAssemblyCatalog();

            const a =
              makeAssembly();

            const b =
              createCharacterAssembly({
                ...a,

                assemblyId:
                  "00000000-0000-4000-8000-000000000399",
              });

            catalog.register(
              b,
            );

            catalog.register(
              a,
            );

            expect(
              catalog.list().map(
                (item) =>
                  item.assemblyId,
              ),
            ).toEqual([
              a.assemblyId,
              b.assemblyId,
            ]);
          },
        );

        it(
          "finds parts by id",
          () => {
            const catalog =
              new CharacterAssemblyCatalog();

            const assembly =
              makeAssembly();

            catalog.register(
              assembly,
            );

            expect(
              catalog.getPart(
                assembly.assemblyId,
                "hair",
              )?.assetId,
            ).toBe(
              "asset-hair",
            );
          },
        );

        it(
          "returns children",
          () => {
            const catalog =
              new CharacterAssemblyCatalog();

            const assembly =
              makeAssembly();

            catalog.register(
              assembly,
            );

            expect(
              catalog.children(
                assembly.assemblyId,
                "head",
              ).map(
                (part) =>
                  part.partId,
              ),
            ).toEqual([
              "eye-left",
              "eye-right",
              "hair",
            ]);
          },
        );

        it(
          "finds parts by type",
          () => {
            const catalog =
              new CharacterAssemblyCatalog();

            const assembly =
              makeAssembly();

            catalog.register(
              assembly,
            );

            expect(
              catalog.partsByType(
                assembly.assemblyId,
                "eye",
              ),
            ).toHaveLength(2);
          },
        );

        it(
          "returns unique asset ids",
          () => {
            const catalog =
              new CharacterAssemblyCatalog();

            const assembly =
              makeAssembly();

            catalog.register(
              assembly,
            );

            expect(
              catalog.assetIds(
                assembly.assemblyId,
              ),
            ).toEqual([
              "asset-body",
              "asset-eye-left",
              "asset-eye-right",
              "asset-hair",
              "asset-head",
            ]);
          },
        );
      },
    );

    describe(
      "asset compatibility",
      () => {
        it(
          "detects missing assets",
          () => {
            const assembly =
              makeAssembly();

            const assets =
              new AssetCatalog();

            const result =
              validateAssemblyAssets(
                assembly,
                assets,
              );

            expect(
              result.valid,
            ).toBe(false);

            expect(
              result.missingAssetIds,
            ).toHaveLength(5);
          },
        );

        it(
          "validates compatible assets",
          () => {
            const assembly =
              makeAssembly();

            const assets =
              new AssetCatalog();

            for (
              const id of assembly.parts.map(
                (part) =>
                  part.assetId,
              )
            ) {
              assets.register(
                makeAsset(id),
              );
            }

            const result =
              validateAssemblyAssets(
                assembly,
                assets,
              );

            expect(
              result.valid,
            ).toBe(true);

            expect(
              result.missingAssetIds,
            ).toEqual([]);

            expect(
              result.incompatibleAssetIds,
            ).toEqual([]);
          },
        );

        it(
          "detects representation incompatibility",
          () => {
            const assembly =
              makeAssembly();

            const assets =
              new AssetCatalog();

            for (
              const id of assembly.parts.map(
                (part) =>
                  part.assetId,
              )
            ) {
              assets.register(
                makeAsset(
                  id,
                  id ===
                    "asset-hair"
                    ? "3d"
                    : "2d",
                ),
              );
            }

            const result =
              validateAssemblyAssets(
                assembly,
                assets,
              );

            expect(
              result.valid,
            ).toBe(false);

            expect(
              result.incompatibleAssetIds,
            ).toEqual([
              "asset-hair",
            ]);
          },
        );

        it(
          "resolves assembly assets",
          () => {
            const assembly =
              makeAssembly();

            const assets =
              new AssetCatalog();

            for (
              const id of assembly.parts.map(
                (part) =>
                  part.assetId,
              )
            ) {
              assets.register(
                makeAsset(id),
              );
            }

            const resolved =
              resolveAssemblyAssets(
                assembly,
                assets,
              );

            expect(
              resolved,
            ).toHaveLength(5);
          },
        );
      },
    );

    describe(
      "mutations",
      () => {
        it(
          "replaces a part asset",
          () => {
            const assembly =
              makeAssembly();

            const changed =
              replacePartAsset(
                assembly,
                "hair",
                "hair-red",
              );

            expect(
              changed.parts.find(
                (part) =>
                  part.partId ===
                  "hair",
              )?.assetId,
            ).toBe(
              "hair-red",
            );

            expect(
              changed.contentHash,
            ).not.toBe(
              assembly.contentHash,
            );
          },
        );

        it(
          "changes a part transform",
          () => {
            const assembly =
              makeAssembly();

            const changed =
              transformPart(
                assembly,
                "head",
                {
                  x: 50,
                  y: 20,
                  rotation: 10,
                },
              );

            expect(
              changed.parts.find(
                (part) =>
                  part.partId ===
                  "head",
              )?.transform,
            ).toEqual({
              x: 50,
              y: 20,
              rotation: 10,
              scaleX: 1,
              scaleY: 1,
            });
          },
        );

        it(
          "changes part visibility",
          () => {
            const assembly =
              makeAssembly();

            const changed =
              setPartVisibility(
                assembly,
                "hair",
                false,
              );

            const hair =
              changed.parts.find(
                (part) =>
                  part.partId ===
                  "hair",
              );

            expect(
              hair?.visible,
            ).toBe(false);

            expect(
              hair?.appearance
                .visible,
            ).toBe(false);
          },
        );
      },
    );

    describe(
      "validation",
      () => {
        it(
          "validates a correctly fingerprinted assembly",
          () => {
            const assembly =
              makeAssembly();

            const validated =
              validateCharacterAssembly(
                assembly,
              );

            expect(
              validated.contentHash,
            ).toBe(
              assembly.contentHash,
            );
          },
        );

        it(
          "rejects a tampered fingerprint",
          () => {
            const assembly =
              makeAssembly();

            expect(
              () =>
                validateCharacterAssembly({
                  ...assembly,
                  contentHash:
                    "tampered",
                }),
            ).toThrow(
              /contentHash/i,
            );
          },
        );
      },
    );

    describe(
      "fingerprinting",
      () => {
        it(
          "matches canonical fingerprint",
          () => {
            const assembly =
              makeAssembly();

            const {
              contentHash,
              ...withoutHash
            } = assembly;

            expect(
              fingerprintAssembly(
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