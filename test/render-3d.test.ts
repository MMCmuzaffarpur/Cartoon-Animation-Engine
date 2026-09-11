import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  GltfRenderer,
  createGltfRenderer,
  type GltfScene,
  type GltfSceneEntity,
} from "../packages/render-3d/src/index.js";

/* -------------------------------------------------------------------------- */
/* Test Helpers                                                               */
/* -------------------------------------------------------------------------- */

function createRenderer(): GltfRenderer {
  return new GltfRenderer();
}

function baseScene(): GltfScene {
  return {
    id: "scene-001",
    name: "Test Scene",
    type: "3d",
    width: 1280,
    height: 720,
    entities: [],
    settings: {},
  };
}

function character(
  overrides: Partial<GltfSceneEntity> = {},
): GltfSceneEntity {
  return {
    id: "character-001",
    type: "character",
    name: "Hero",
    representation: "3d",
    transform: {
      position: {
        x: 10,
        y: 20,
        z: 30,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    },
    components: {},
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

describe(
  "render-3d / GltfRenderer",
  () => {
    it(
      "creates a renderer through the factory",
      () => {
        const renderer =
          createGltfRenderer();

        expect(
          renderer,
        ).toBeInstanceOf(
          GltfRenderer,
        );

        expect(
          renderer.version,
        ).toBe("1.0.0");
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Capabilities                                                           */
    /* ---------------------------------------------------------------------- */

    it(
      "exposes the expected renderer capabilities",
      () => {
        const renderer =
          createRenderer();

        expect(
          renderer.capabilities,
        ).toEqual({
          adapterId: "gltf-json",
          adapterVersion: "1.0.0",
          contractVersion: "1.0.0",
          capabilities: {
            "render.3d.scene-export":
              "supported",
            "render.3d":
              "experimental",
          },
        });
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Scene Validation                                                       */
    /* ---------------------------------------------------------------------- */

    it(
      "accepts a valid 3D scene",
      () => {
        const renderer =
          createRenderer();

        expect(() =>
          renderer.validateScene(
            baseScene(),
          ),
        ).not.toThrow();
      },
    );

    it(
      "accepts a valid hybrid scene",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.type =
          "hybrid";

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).not.toThrow();
      },
    );

    it(
      "accepts a valid 2D scene",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.type =
          "2d";

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).not.toThrow();
      },
    );

    it(
      "rejects null scene",
      () => {
        const renderer =
          createRenderer();

        expect(() =>
          renderer.validateScene(
            null as unknown as GltfScene,
          ),
        ).toThrow(
          "glTF scene must be an object.",
        );
      },
    );

    it(
      "rejects undefined scene",
      () => {
        const renderer =
          createRenderer();

        expect(() =>
          renderer.validateScene(
            undefined as unknown as GltfScene,
          ),
        ).toThrow(
          "glTF scene must be an object.",
        );
      },
    );

    it(
      "rejects an invalid scene type",
      () => {
        const renderer =
          createRenderer();

        const scene =
          {
            ...baseScene(),
            type: "invalid",
          } as unknown as GltfScene;

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).toThrow(
          'Unsupported scene type "invalid".',
        );
      },
    );

    it(
      "rejects zero scene width",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.width =
          0;

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).toThrow(
          "Scene width must be positive.",
        );
      },
    );

    it(
      "rejects negative scene width",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.width =
          -100;

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).toThrow(
          "Scene width must be positive.",
        );
      },
    );

    it(
      "rejects invalid scene height",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.height =
          0;

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).toThrow(
          "Scene height must be positive.",
        );
      },
    );

    it(
      "rejects non-array entities",
      () => {
        const renderer =
          createRenderer();

        const scene =
          {
            ...baseScene(),
            entities: {},
          } as unknown as GltfScene;

        expect(() =>
          renderer.validateScene(
            scene,
          ),
        ).toThrow(
          "Scene entities must be an array.",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Empty Scene                                                            */
    /* ---------------------------------------------------------------------- */

    it(
      "builds an empty glTF scene",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        expect(
          document.asset.version,
        ).toBe("2.0");

        expect(
          document.asset.generator,
        ).toBe(
          "Cartoon Animation Engine 1.0.0",
        );

        expect(
          document.scene,
        ).toBe(0);

        expect(
          document.scenes,
        ).toHaveLength(1);

        expect(
          document.nodes,
        ).toEqual([]);

        expect(
          document.scenes[0].nodes,
        ).toEqual([]);
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Scene Metadata                                                         */
    /* ---------------------------------------------------------------------- */

    it(
      "uses the supplied scene name",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.name =
          "Classroom";

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.scenes[0].name,
        ).toBe(
          "Classroom",
        );
      },
    );

    it(
      "uses Scene when the scene name is missing",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        delete scene.name;

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.scenes[0].name,
        ).toBe(
          "Scene",
        );
      },
    );

    it(
      "uses Scene when the scene name is blank",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.name =
          "   ";

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.scenes[0].name,
        ).toBe(
          "Scene",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Entity Filtering                                                       */
    /* ---------------------------------------------------------------------- */

    it(
      "exports 3D representation entities",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes,
        ).toHaveLength(1);
      },
    );

    it(
      "exports hybrid representation entities",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character({
            representation:
              "hybrid",
          }),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes,
        ).toHaveLength(1);
      },
    );

    it(
      "exports character entities even when representation is omitted",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "character-001",
            type: "character",
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes,
        ).toHaveLength(1);
      },
    );

    it(
      "exports prop entities by default",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "prop-001",
            type: "prop",
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes,
        ).toHaveLength(1);
      },
    );

    it(
      "filters ordinary 2D entities by default",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "text-001",
            type: "text",
            representation: "2d",
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes,
        ).toHaveLength(0);
      },
    );

    it(
      "exports non-3D entities when explicitly requested",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "text-001",
            type: "text",
            representation: "2d",
          },
        ];

        const document =
          renderer.build(
            scene,
            {
              includeNon3DEntities:
                true,
            },
          );

        expect(
          document.nodes,
        ).toHaveLength(1);
      },
    );

    it(
      "preserves source entity order",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character({
            id: "character-a",
            name: "A",
          }),
          {
            id: "prop-b",
            type: "prop",
            name: "B",
          },
          {
            id: "mesh-c",
            type: "mesh",
            name: "C",
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes.map(
            (node) =>
              node.name,
          ),
        ).toEqual([
          "A",
          "B",
          "C",
        ]);
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Node Names                                                             */
    /* ---------------------------------------------------------------------- */

    it(
      "preserves an explicit entity name",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character({
            name: "Main Hero",
          }),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].name,
        ).toBe(
          "Main Hero",
        );
      },
    );

    it(
      "creates deterministic entity names when missing",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "entity-001",
            type: "mesh",
          },
          {
            id: "entity-002",
            type: "mesh",
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes.map(
            (node) =>
              node.name,
          ),
        ).toEqual([
          "Entity 1",
          "Entity 2",
        ]);
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Transform                                                              */
    /* ---------------------------------------------------------------------- */

    it(
      "exports complete position values",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].translation,
        ).toEqual([
          10,
          20,
          30,
        ]);
      },
    );

    it(
      "fills missing position components with defaults",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character({
            transform: {
              position: {
                x: 15,
              },
            },
          }),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].translation,
        ).toEqual([
          15,
          0,
          0,
        ]);
      },
    );

    it(
      "uses identity scale when scale is missing",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "mesh-001",
            type: "mesh",
            transform: {},
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].scale,
        ).toEqual([
          1,
          1,
          1,
        ]);
      },
    );

    it(
      "preserves valid negative glTF scale values",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "mesh-001",
            type: "mesh",
            transform: {
              scale: {
                x: -1,
                y: 2,
                z: -3,
              },
            },
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].scale,
        ).toEqual([
          -1,
          2,
          -3,
        ]);
      },
    );

    it(
      "replaces non-finite transform values with defaults",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            id: "mesh-001",
            type: "mesh",
            transform: {
              position: {
                x: Number.NaN,
                y: Number.POSITIVE_INFINITY,
                z: 5,
              },
              rotation: {
                x: Number.NaN,
                y: 20,
                z: Number.NEGATIVE_INFINITY,
              },
            },
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].translation,
        ).toEqual([
          0,
          0,
          5,
        ]);
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Quaternion                                                             */
    /* ---------------------------------------------------------------------- */

    it(
      "exports identity quaternion for zero rotation",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].rotation,
        ).toEqual([
          0,
          0,
          0,
          1,
        ]);
      },
    );

    it(
      "converts a 90 degree Z rotation to a quaternion",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character({
            transform: {
              rotation: {
                x: 0,
                y: 0,
                z: 90,
              },
            },
          }),
        ];

        const document =
          renderer.build(
            scene,
          );

        const rotation =
          document.nodes[0].rotation!;

        expect(
          rotation[0],
        ).toBeCloseTo(
          0,
          10,
        );

        expect(
          rotation[1],
        ).toBeCloseTo(
          0,
          10,
        );

        expect(
          rotation[2],
        ).toBeCloseTo(
          Math.SQRT1_2,
          10,
        );

        expect(
          rotation[3],
        ).toBeCloseTo(
          Math.SQRT1_2,
          10,
        );
      },
    );

    it(
      "produces normalized quaternions",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character({
            transform: {
              rotation: {
                x: 35,
                y: 70,
                z: 125,
              },
            },
          }),
        ];

        const document =
          renderer.build(
            scene,
          );

        const q =
          document.nodes[0].rotation!;

        const length =
          Math.sqrt(
            q[0] ** 2 +
            q[1] ** 2 +
            q[2] ** 2 +
            q[3] ** 2,
          );

        expect(
          length,
        ).toBeCloseTo(
          1,
          10,
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Entity Metadata                                                        */
    /* ---------------------------------------------------------------------- */

    it(
      "includes entity metadata by default",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].extras,
        ).toEqual({
          cartoonAnimationEngine: {
            entityId:
              "character-001",
            entityType:
              "character",
            representation:
              "3d",
          },
        });
      },
    );

    it(
      "creates deterministic fallback entity IDs",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          {
            type: "mesh",
          },
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.nodes[0].extras,
        ).toEqual({
          cartoonAnimationEngine: {
            entityId:
              "gltf-entity-0",
            entityType:
              "mesh",
            representation:
              "3d",
          },
        });
      },
    );

    it(
      "can disable entity metadata",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
            {
              includeEntityMetadata:
                false,
            },
          );

        expect(
          document.nodes[0].extras,
        ).toBeUndefined();
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Engine Metadata                                                        */
    /* ---------------------------------------------------------------------- */

    it(
      "includes engine metadata by default",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
          );

        expect(
          document.asset.extras,
        ).toEqual({
          cartoonAnimationEngine: {
            renderer:
              "gltf-json",
            rendererVersion:
              "1.0.0",
            contractVersion:
              "1.0.0",
            sourceSceneId:
              "scene-001",
            sourceSceneType:
              "3d",
          },
        });

        expect(
          document.extras,
        ).toEqual({
          cartoonAnimationEngine: {
            renderer:
              "gltf-json",
            rendererVersion:
              "1.0.0",
            sourceEntityCount:
              1,
            exportedEntityCount:
              1,
          },
        });
      },
    );

    it(
      "can disable engine metadata",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const document =
          renderer.build(
            scene,
            {
              includeEngineMetadata:
                false,
            },
          );

        expect(
          document.asset.extras,
        ).toBeUndefined();

        expect(
          document.extras,
        ).toBeUndefined();
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Document Validation                                                    */
    /* ---------------------------------------------------------------------- */

    it(
      "validates a generated glTF document",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        const result =
          renderer.validateDocument(
            document,
          );

        expect(
          result.valid,
        ).toBe(true);

        expect(
          result.errors,
        ).toEqual([]);
      },
    );

    it(
      "detects an invalid glTF asset version",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        const invalid =
          document as any;

        invalid.asset.version =
          "1.0";

        const result =
          renderer.validateDocument(
            invalid,
          );

        expect(
          result.valid,
        ).toBe(false);

        expect(
          result.errors,
        ).toContain(
          "glTF asset version must be 2.0.",
        );
      },
    );

    it(
      "detects an invalid default scene index",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        const invalid =
          document as any;

        invalid.scene =
          99;

        const result =
          renderer.validateDocument(
            invalid,
          );

        expect(
          result.valid,
        ).toBe(false);

        expect(
          result.errors,
        ).toContain(
          "Default scene index is invalid.",
        );
      },
    );

    it(
      "detects invalid node translation length",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        const invalid =
          document as any;

        invalid.nodes.push({
          translation: [
            1,
            2,
          ],
        });

        const result =
          renderer.validateDocument(
            invalid,
          );

        expect(
          result.valid,
        ).toBe(false);

        expect(
          result.errors,
        ).toContain(
          "Node 0 translation must contain 3 values.",
        );
      },
    );

    it(
      "detects invalid node rotation length",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        const invalid =
          document as any;

        invalid.nodes.push({
          rotation: [
            0,
            0,
            0,
          ],
        });

        const result =
          renderer.validateDocument(
            invalid,
          );

        expect(
          result.valid,
        ).toBe(false);

        expect(
          result.errors,
        ).toContain(
          "Node 0 rotation must contain 4 values.",
        );
      },
    );

    it(
      "detects invalid node scale length",
      () => {
        const renderer =
          createRenderer();

        const document =
          renderer.build(
            baseScene(),
          );

        const invalid =
          document as any;

        invalid.nodes.push({
          scale: [
            1,
            1,
          ],
        });

        const result =
          renderer.validateDocument(
            invalid,
          );

        expect(
          result.valid,
        ).toBe(false);

        expect(
          result.errors,
        ).toContain(
          "Node 0 scale must contain 3 values.",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Fingerprinting                                                         */
    /* ---------------------------------------------------------------------- */

    it(
      "produces a deterministic fingerprint",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const first =
          renderer.fingerprint(
            scene,
          );

        const second =
          renderer.fingerprint(
            scene,
          );

        expect(
          first,
        ).toBe(
          second,
        );
      },
    );

    it(
      "changes the fingerprint when the scene changes",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const first =
          renderer.fingerprint(
            scene,
          );

        scene.entities[0].name =
          "Changed Hero";

        const second =
          renderer.fingerprint(
            scene,
          );

        expect(
          second,
        ).not.toBe(
          first,
        );
      },
    );

    it(
      "changes the fingerprint when export options change",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const first =
          renderer.fingerprint(
            scene,
            {
              includeEngineMetadata:
                true,
            },
          );

        const second =
          renderer.fingerprint(
            scene,
            {
              includeEngineMetadata:
                false,
            },
          );

        expect(
          second,
        ).not.toBe(
          first,
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Export                                                                 */
    /* ---------------------------------------------------------------------- */

    it(
      "exports a valid glTF JSON file",
      async () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              "cartoon-render-3d-",
            ),
          );

        try {
          const outputPath =
            join(
              directory,
              "scene.gltf",
            );

          const result =
            await renderer.export(
              scene,
              outputPath,
            );

          expect(
            result.path,
          ).toBe(
            outputPath,
          );

          expect(
            result.renderer,
          ).toBe(
            "gltf-json",
          );

          expect(
            result.version,
          ).toBe(
            "1.0.0",
          );

          expect(
            result.nodeCount,
          ).toBe(1);

          expect(
            result.hash,
          ).toBe(
            renderer.fingerprint(
              scene,
            ),
          );

          const content =
            await readFile(
              outputPath,
              "utf8",
            );

          const parsed =
            JSON.parse(
              content,
            );

          expect(
            parsed.asset.version,
          ).toBe(
            "2.0",
          );

          expect(
            parsed.nodes,
          ).toHaveLength(1);

          expect(
            parsed.scenes,
          ).toHaveLength(1);
        } finally {
          await rm(
            directory,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      "exports an empty scene successfully",
      async () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        const directory =
          await mkdtemp(
            join(
              tmpdir(),
              "cartoon-render-3d-",
            ),
          );

        try {
          const outputPath =
            join(
              directory,
              "empty.gltf",
            );

          const result =
            await renderer.export(
              scene,
              outputPath,
            );

          expect(
            result.nodeCount,
          ).toBe(0);

          expect(
            result.renderer,
          ).toBe(
            "gltf-json",
          );

          const content =
            await readFile(
              outputPath,
              "utf8",
            );

          const parsed =
            JSON.parse(
              content,
            );

          expect(
            parsed.nodes,
          ).toEqual([]);

          expect(
            parsed.scenes[0].nodes,
          ).toEqual([]);
        } finally {
          await rm(
            directory,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Deterministic Export                                                   */
    /* ---------------------------------------------------------------------- */

    it(
      "produces identical documents for identical scenes",
      () => {
        const renderer =
          createRenderer();

        const scene =
          baseScene();

        scene.entities = [
          character(),
        ];

        const first =
          renderer.build(
            scene,
          );

        const second =
          renderer.build(
            structuredClone(
              scene,
            ),
          );

        expect(
          second,
        ).toEqual(
          first,
        );
      },
    );
  },
);