import { describe, expect, it } from "vitest";

import {
  FrameEvaluator,
  type EvaluatedFrameState,
} from "../packages/frame-evaluation/src/index.js";

/* -------------------------------------------------------------------------- */
/* Test Types                                                                 */
/* -------------------------------------------------------------------------- */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

type JsonObject = {
  [key: string]: JsonValue | unknown;
};

type TestEntity = {
  id?: string;
  name?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  components?: Record<string, any>;
  [key: string]: any;
};

type TestProject = {
  id?: string;
  projectId?: string;

  entities: TestEntity[];

  settings: Record<string, any>;

  animationClips?: any[];

  audioTracks?: any[];

  audio?: any[];

  camera?: any;

  [key: string]: any;
};

/* -------------------------------------------------------------------------- */
/* Test Doubles                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Fake animation engine.
 *
 * The real animation engine exposes a structured evaluated animation state:
 *
 * {
 *   tick,
 *   values
 * }
 *
 * FrameEvaluator consumes that structure and stores the evaluated values
 * inside the canonical frame state.
 */
class FakeAnimationEngine {
  evaluate(
    ...args: any[]
  ): {
    tick: number;
    values: Record<string, number>;
  } {
    /*
     * Support both forms:
     *
     * evaluate(layers, tick)
     *
     * evaluate(clips, layers, tick)
     */
    const tick =
      args.length === 2
        ? args[1]
        : args[2];

    const safeTick =
      typeof tick === "number" &&
      Number.isFinite(tick)
        ? tick
        : 0;

    return {
      tick: safeTick,

      values: {
        rootX: safeTick,
        rootY: safeTick * 2,
        weight: 1,
      },
    };
  }
}

/**
 * Fake facial engine.
 */
class FakeFacialEngine {
  expression(
    name: string,
    weight = 1,
  ): Record<string, number> {
    return {
      [`expression:${name}`]: weight,
    };
  }
}

/**
 * Fake lip-sync engine.
 */
class FakeLipSyncEngine {
  visemeAt(
    track: any,
    tick: number,
  ): unknown {
    const visemes =
      Array.isArray(track?.visemes)
        ? track.visemes
        : [];

    if (visemes.length === 0) {
      return {
        viseme: "REST",
        weight: 0,
      };
    }

    const active =
      visemes.find(
        (entry: any) =>
          tick >= entry.startTick &&
          tick < entry.endTick,
      );

    return (
      active ?? {
        viseme: "REST",
        weight: 0,
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Evaluator Factory                                                          */
/* -------------------------------------------------------------------------- */

function createEvaluator(): FrameEvaluator {
  return new FrameEvaluator(
    new FakeAnimationEngine() as any,
    new FakeFacialEngine() as any,
    new FakeLipSyncEngine() as any,
  );
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

function baseProject(): TestProject {
  return {
    id: "project-001",

    entities: [],

    settings: {},
  };
}

/* -------------------------------------------------------------------------- */
/* Evaluation Helper                                                          */
/* -------------------------------------------------------------------------- */

type EvaluationOverrides = {
  revisionId?: string;
  tick?: number;
  camera?: any;
};

function evaluate(
  project: TestProject = baseProject(),
  overrides: EvaluationOverrides = {},
): EvaluatedFrameState {
  const evaluator =
    createEvaluator();

  return evaluator.evaluate({
    project,

    revisionId:
      overrides.revisionId ??
      "revision-001",

    tick:
      overrides.tick ??
      0,

    ...(overrides.camera !==
    undefined
      ? {
          camera:
            overrides.camera,
        }
      : {}),
  });
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe(
  "FrameEvaluator",
  () => {
    /* ---------------------------------------------------------------------- */
    /* Basic Evaluation                                                       */
    /* ---------------------------------------------------------------------- */

    it(
      "creates a canonical evaluated frame state",
      () => {
        const state =
          evaluate();

        expect(
          state.schemaVersion,
        ).toBe("1.0.0");

        expect(
          state.projectId,
        ).toBe("project-001");

        expect(
          state.revisionId,
        ).toBe("revision-001");

        expect(
          state.tick,
        ).toBe(0);

        expect(
          state.entities,
        ).toEqual([]);

        expect(
          state.audio,
        ).toEqual([]);

        expect(
          state.hash,
        ).toEqual(
          expect.any(String),
        );

        expect(
          state.hash.length,
        ).toBe(64);
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Camera                                                                 */
    /* ---------------------------------------------------------------------- */

    it(
      "uses deterministic default camera values",
      () => {
        const state =
          evaluate();

        expect(
          state.camera.position,
        ).toEqual({
          x: 0,
          y: 0,
          z: 10,
        });

        expect(
          state.camera.target,
        ).toEqual({
          x: 0,
          y: 0,
          z: 0,
        });

        expect(
          state.camera.zoom,
        ).toBe(1);

        expect(
          state.camera.fov,
        ).toBeUndefined();
      },
    );

    it(
      "evaluates the explicitly supplied camera",
      () => {
        const state =
          evaluate(
            baseProject(),
            {
              camera: {
                id: "camera-001",

                name:
                  "Main Camera",

                type:
                  "perspective",

                position: {
                  x: 4,
                  y: 5,
                  z: 12,
                },

                target: {
                  x: 1,
                  y: 2,
                  z: 3,
                },

                zoom: 1.5,

                fov: 50,
              },
            },
          );

        expect(
          state.camera,
        ).toEqual({
          id: "camera-001",

          name:
            "Main Camera",

          type:
            "perspective",

          position: {
            x: 4,
            y: 5,
            z: 12,
          },

          target: {
            x: 1,
            y: 2,
            z: 3,
          },

          zoom: 1.5,

          fov: 50,
        });
      },
    );

    it(
      "preserves additional camera properties",
      () => {
        const state =
          evaluate(
            baseProject(),
            {
              camera: {
                id: "camera-001",

                name:
                  "Hero Camera",

                position: {
                  x: 1,
                  y: 2,
                  z: 8,
                },

                target: {
                  x: 0,
                  y: 1,
                  z: 0,
                },

                zoom: 2,

                fov: 40,

                customProperty:
                  "preserved",
              },
            },
          );

        expect(
          state.camera.customProperty,
        ).toBe("preserved");

        expect(
          state.camera.fov,
        ).toBe(40);
      },
    );

    it(
      "normalizes invalid camera numeric values to safe defaults",
      () => {
        const state =
          evaluate(
            baseProject(),
            {
              camera: {
                position: {
                  x: Number.NaN,

                  y:
                    Number.POSITIVE_INFINITY,

                  z: "invalid",
                },

                target: {
                  x: Number.NaN,

                  y:
                    Number.POSITIVE_INFINITY,

                  z: "invalid",
                },

                zoom: 0,

                fov: "invalid",
              },
            },
          );

        expect(
          state.camera.position,
        ).toEqual({
          x: 0,
          y: 0,
          z: 10,
        });

        expect(
          state.camera.target,
        ).toEqual({
          x: 0,
          y: 0,
          z: 0,
        });

        expect(
          state.camera.zoom,
        ).toBe(1);

        /*
         * Invalid optional FOV must not survive canonicalization.
         */
        expect(
          state.camera.fov,
        ).toBeUndefined();
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Project ID / Revision                                                  */
    /* ---------------------------------------------------------------------- */

    it(
      "accepts projectId when id is not present",
      () => {
        const state =
          evaluate({
            projectId:
              "project-from-project-id",

            entities: [],

            settings: {},
          });

        expect(
          state.projectId,
        ).toBe(
          "project-from-project-id",
        );
      },
    );

    it(
      "rejects a project without an id",
      () => {
        expect(() =>
          evaluate({
            entities: [],

            settings: {},
          }),
        ).toThrow(
          "Project must contain a valid projectId or id.",
        );
      },
    );

    it(
      "rejects an empty revision id",
      () => {
        expect(() =>
          evaluate(
            baseProject(),
            {
              revisionId: "",
            },
          ),
        ).toThrow(
          "revisionId must be a non-empty string.",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Tick Validation                                                        */
    /* ---------------------------------------------------------------------- */

    it(
      "accepts zero tick",
      () => {
        expect(
          evaluate(
            baseProject(),
            {
              tick: 0,
            },
          ).tick,
        ).toBe(0);
      },
    );

    it(
      "accepts fractional finite ticks",
      () => {
        expect(
          evaluate(
            baseProject(),
            {
              tick: 12.5,
            },
          ).tick,
        ).toBe(12.5);
      },
    );

    it(
      "rejects negative ticks",
      () => {
        expect(() =>
          evaluate(
            baseProject(),
            {
              tick: -1,
            },
          ),
        ).toThrow(
          "Frame evaluation tick must not be negative.",
        );
      },
    );

    it(
      "rejects NaN ticks",
      () => {
        expect(() =>
          evaluate(
            baseProject(),
            {
              tick:
                Number.NaN,
            },
          ),
        ).toThrow(
          "Frame evaluation tick must be finite.",
        );
      },
    );

    it(
      "rejects infinite ticks",
      () => {
        expect(() =>
          evaluate(
            baseProject(),
            {
              tick:
                Number.POSITIVE_INFINITY,
            },
          ),
        ).toThrow(
          "Frame evaluation tick must be finite.",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Entity Evaluation                                                      */
    /* ---------------------------------------------------------------------- */

    it(
      "evaluates entities without animation, facial, or lip-sync components",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            name:
              "Hero",
          },
        ];

        const state =
          evaluate(
            project,
            {
              tick: 10,
            },
          );

        expect(
          state.entities,
        ).toHaveLength(1);

        expect(
          state.entities[0],
        ).toMatchObject({
          id:
            "character-001",

          name:
            "Hero",

          evaluation: {
            motion: {},
            facial: {},
            viseme: null,
          },
        });
      },
    );

    it(
      "preserves the original entity properties",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            name:
              "Hero",

            type:
              "character",

            metadata: {
              role:
                "protagonist",
            },
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0],
        ).toMatchObject({
          id:
            "character-001",

          name:
            "Hero",

          type:
            "character",

          metadata: {
            role:
              "protagonist",
          },
        });
      },
    );

    it(
      "does not mutate the original project",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              expression:
                "happy",
            },
          },
        ];

        const before =
          structuredClone(
            project,
          );

        evaluate(
          project,
          {
            tick: 10,
          },
        );

        expect(
          project,
        ).toEqual(before);
      },
    );

    it(
      "uses a deterministic fallback entity id when an entity id is missing",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            name:
              "Unnamed Entity",
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0].id,
        ).toBe("entity-0");
      },
    );

    it(
      "rejects an explicitly empty entity id",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id: "",
          },
        ];

        expect(() =>
          evaluate(project),
        ).toThrow(
          "Entity at index 0 has an empty id.",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Facial                                                                 */
    /* ---------------------------------------------------------------------- */

    it(
      "evaluates a string facial expression",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              expression:
                "happy",
            },
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0]
            .evaluation
            .facial,
        ).toEqual({
          "expression:happy":
            1,
        });
      },
    );

    it(
      "evaluates an object facial expression using weight",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              expression: {
                name:
                  "angry",

                weight:
                  0.75,
              },
            },
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0]
            .evaluation
            .facial,
        ).toEqual({
          "expression:angry":
            0.75,
        });
      },
    );

    it(
      "uses intensity when expression weight is absent",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              expression: {
                name:
                  "sad",

                intensity:
                  0.4,
              },
            },
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0]
            .evaluation
            .facial,
        ).toEqual({
          "expression:sad":
            0.4,
        });
      },
    );

    it(
      "uses neutral expression when an expression object has no name",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              expression: {
                intensity:
                  0.5,
              },
            },
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0]
            .evaluation
            .facial,
        ).toEqual({
          "expression:neutral":
            0.5,
        });
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Lip Sync                                                               */
    /* ---------------------------------------------------------------------- */

    it(
      "returns null when an entity has no lip-sync component",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0]
            .evaluation
            .viseme,
        ).toBeNull();
      },
    );

    it(
      "returns REST when lip-sync has no viseme array",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              lipSync: {
                phonemes: [],
              },
            },
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.entities[0]
            .evaluation
            .viseme,
        ).toEqual({
          viseme:
            "REST",

          weight:
            0,
        });
      },
    );

    it(
      "evaluates an active lip-sync viseme",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              lipSync: {
                visemes: [
                  {
                    startTick: 0,

                    endTick: 20,

                    viseme:
                      "AA",

                    weight: 1,
                  },

                  {
                    startTick: 20,

                    endTick: 40,

                    viseme:
                      "OO",

                    weight: 0.8,
                  },
                ],
              },
            },
          },
        ];

        const state =
          evaluate(
            project,
            {
              tick: 25,
            },
          );

        expect(
          state.entities[0]
            .evaluation
            .viseme,
        ).toEqual({
          startTick:
            20,

          endTick:
            40,

          viseme:
            "OO",

          weight:
            0.8,
        });
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Animation                                                               */
    /* ---------------------------------------------------------------------- */

    it(
      "evaluates embedded motion layers",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              motionLayers: [
                {
                  id:
                    "layer-001",

                  order:
                    0,

                  weight:
                    1,

                  clip: {
                    id:
                      "walk",
                  },
                },
              ],
            },
          },
        ];

        const state =
          evaluate(
            project,
            {
              tick: 12,
            },
          );

        /*
         * The animation engine's canonical return value is:
         *
         * {
         *   tick,
         *   values
         * }
         *
         * FrameEvaluator preserves that evaluated animation state.
         */
        expect(
          state.entities[0]
            .evaluation
            .motion,
        ).toEqual({
          rootX: 12,
          rootY: 24,
          weight: 1,
        });
      },
    );

    it(
      "evaluates canonical motion layers using project animation clips",
      () => {
        const project =
          baseProject();

        project.animationClips = [
          {
            id:
              "walk",

            duration:
              100,
          },
        ];

        project.entities = [
          {
            id:
              "character-001",

            components: {
              motionLayers: [
                {
                  id:
                    "layer-001",

                  clipId:
                    "walk",

                  order:
                    0,

                  weight:
                    1,
                },
              ],
            },
          },
        ];

        const state =
          evaluate(
            project,
            {
              tick: 30,
            },
          );

        expect(
          state.entities[0]
            .evaluation
            .motion,
        ).toEqual({
          rootX: 30,
          rootY: 60,
          weight: 1,
        });
      },
    );

    it(
      "rejects motion layers when animation clips are unavailable",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              motionLayers: [
                {
                  id:
                    "layer-001",

                  clipId:
                    "missing-clip",

                  order:
                    0,

                  weight:
                    1,
                },
              ],
            },
          },
        ];

        expect(() =>
          evaluate(
            project,
            {
              tick: 10,
            },
          ),
        ).toThrow(
          "contains motionLayers but no animation clips are available.",
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Audio                                                                  */
    /* ---------------------------------------------------------------------- */

    it(
      "uses settings audioTracks first",
      () => {
        const project =
          baseProject();

        project.settings = {
          audioTracks: [
            {
              id:
                "settings-audio",
            },
          ],
        };

        project.audioTracks = [
          {
            id:
              "project-audio",
          },
        ];

        project.audio = [
          {
            id:
              "fallback-audio",
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.audio,
        ).toEqual([
          {
            id:
              "settings-audio",
          },
        ]);
      },
    );

    it(
      "falls back to project audioTracks",
      () => {
        const project =
          baseProject();

        project.audioTracks = [
          {
            id:
              "project-audio",
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.audio,
        ).toEqual([
          {
            id:
              "project-audio",
          },
        ]);
      },
    );

    it(
      "falls back to project audio",
      () => {
        const project =
          baseProject();

        project.audio = [
          {
            id:
              "audio-001",
          },
        ];

        const state =
          evaluate(project);

        expect(
          state.audio,
        ).toEqual([
          {
            id:
              "audio-001",
          },
        ]);
      },
    );

    it(
      "returns an empty audio array when no audio exists",
      () => {
        expect(
          evaluate().audio,
        ).toEqual([]);
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Determinism                                                             */
    /* ---------------------------------------------------------------------- */

    it(
      "produces the same hash for the same input",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            components: {
              expression: {
                name:
                  "happy",

                weight:
                  0.8,
              },
            },
          },
        ];

        const evaluator =
          createEvaluator();

        const input = {
          project,

          revisionId:
            "revision-001",

          tick:
            25,
        };

        const first =
          evaluator.evaluate(
            input,
          );

        const second =
          evaluator.evaluate(
            input,
          );

        expect(
          first.hash,
        ).toBe(
          second.hash,
        );

        expect(
          first,
        ).toEqual(
          second,
        );
      },
    );

    it(
      "evaluateDeterministic returns a valid state",
      () => {
        const evaluator =
          createEvaluator();

        const state =
          evaluator.evaluateDeterministic(
            {
              project:
                baseProject(),

              revisionId:
                "revision-001",

              tick:
                10,
            },
          );

        expect(
          state.hash,
        ).toEqual(
          expect.any(String),
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Fingerprint                                                             */
    /* ---------------------------------------------------------------------- */

    it(
      "fingerprint matches the state's canonical hash",
      () => {
        const evaluator =
          createEvaluator();

        const state =
          evaluator.evaluate({
            project:
              baseProject(),

            revisionId:
              "revision-001",

            tick:
              10,
          });

        expect(
          evaluator.fingerprint(
            state,
          ),
        ).toBe(
          state.hash,
        );
      },
    );

    it(
      "changes the fingerprint when the evaluated tick changes",
      () => {
        const evaluator =
          createEvaluator();

        const first =
          evaluator.evaluate({
            project:
              baseProject(),

            revisionId:
              "revision-001",

            tick:
              10,
          });

        const second =
          evaluator.evaluate({
            project:
              baseProject(),

            revisionId:
              "revision-001",

            tick:
              11,
          });

        expect(
          first.hash,
        ).not.toBe(
          second.hash,
        );
      },
    );

    it(
      "changes the fingerprint when the revision changes",
      () => {
        const evaluator =
          createEvaluator();

        const first =
          evaluator.evaluate({
            project:
              baseProject(),

            revisionId:
              "revision-001",

            tick:
              10,
          });

        const second =
          evaluator.evaluate({
            project:
              baseProject(),

            revisionId:
              "revision-002",

            tick:
              10,
          });

        expect(
          first.hash,
        ).not.toBe(
          second.hash,
        );
      },
    );

    it(
      "changes the fingerprint when project state changes",
      () => {
        const evaluator =
          createEvaluator();

        const first =
          evaluator.evaluate({
            project: {
              ...baseProject(),

              entities: [
                {
                  id:
                    "character-001",
                },
              ],
            },

            revisionId:
              "revision-001",

            tick:
              10,
          });

        const second =
          evaluator.evaluate({
            project: {
              ...baseProject(),

              entities: [
                {
                  id:
                    "character-002",
                },
              ],
            },

            revisionId:
              "revision-001",

            tick:
              10,
          });

        expect(
          first.hash,
        ).not.toBe(
          second.hash,
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Isolation / Cloning                                                     */
    /* ---------------------------------------------------------------------- */

    it(
      "does not expose mutable references to the source project",
      () => {
        const project =
          baseProject();

        project.entities = [
          {
            id:
              "character-001",

            metadata: {
              score:
                10,
            },
          },
        ];

        const state =
          evaluate(project);

        state.entities[0].metadata =
          {
            score:
              999,
          };

        expect(
          project.entities[0]
            .metadata,
        ).toEqual({
          score:
            10,
        });
      },
    );

    it(
      "keeps evaluated audio isolated from the project",
      () => {
        const project =
          baseProject();

        project.audioTracks = [
          {
            id:
              "audio-001",

            volume:
              1,
          },
        ];

        const state =
          evaluate(project);

        (
          state.audio[0] as any
        ).volume = 99;

        expect(
          project.audioTracks[0]
            .volume,
        ).toBe(1);
      },
    );
  },
);