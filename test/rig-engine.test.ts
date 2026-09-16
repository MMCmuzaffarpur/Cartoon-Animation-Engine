import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RIG_ENGINE_VERSION,
  RIG_SCHEMA_VERSION,
  RigCatalog,
  createCharacterRig,
  createRigJoint,
  fingerprintRig,
  topologicalJointOrder,
  validateCharacterRig,
} from "../packages/rig-engine/src/index.js";

const ROOT =
  "00000000-0000-4000-8000-000000000101";

const SPINE =
  "00000000-0000-4000-8000-000000000102";

const HEAD =
  "00000000-0000-4000-8000-000000000103";

const ARM =
  "00000000-0000-4000-8000-000000000104";

const HAND =
  "00000000-0000-4000-8000-000000000105";

function makeRig(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return createCharacterRig({
    rigId:
      "00000000-0000-4000-8000-000000000201",

    characterAssemblyId:
      "00000000-0000-4000-8000-000000000301",

    representation:
      "3d",

    rootJointId:
      ROOT,

    joints: [
      {
        jointId:
          ROOT,
        name:
          "Root",
        type:
          "root",
        length:
          1,
      },

      {
        jointId:
          SPINE,
        name:
          "Spine",
        type:
          "spine",
        parentJointId:
          ROOT,
        length:
          1,
      },

      {
        jointId:
          HEAD,
        name:
          "Head",
        type:
          "head",
        parentJointId:
          SPINE,
        length:
          0.5,
      },

      {
        jointId:
          ARM,
        name:
          "UpperArm.L",
        type:
          "upper-arm",
        parentJointId:
          SPINE,
        length:
          1,
      },

      {
        jointId:
          HAND,
        name:
          "Hand.L",
        type:
          "hand",
        parentJointId:
          ARM,
        length:
          0.5,
      },
    ],

    ...overrides,
  });
}

describe(
  "Rig Engine",
  () => {
    describe(
      "joint creation",
      () => {
        it(
          "creates a deterministic joint with defaults",
          () => {
            const joint =
              createRigJoint({
                jointId:
                  ROOT,
                name:
                  "Root",
                type:
                  "root",
              });

            expect(
              joint.jointId,
            ).toBe(
              ROOT,
            );

            expect(
              joint.localTransform.position,
            ).toEqual({
              x: 0,
              y: 0,
              z: 0,
            });

            expect(
              joint.localTransform.rotation,
            ).toEqual({
              x: 0,
              y: 0,
              z: 0,
              w: 1,
            });

            expect(
              joint.localTransform.scale,
            ).toEqual({
              x: 1,
              y: 1,
              z: 1,
            });
          },
        );

        it(
          "normalizes quaternion",
          () => {
            const joint =
              createRigJoint({
                name:
                  "Joint",
                type:
                  "custom",
                localTransform: {
                  rotation: {
                    x: 0,
                    y: 0,
                    z: 0,
                    w: 2,
                  },
                },
              });

            expect(
              joint.localTransform
                .rotation.w,
            ).toBe(1);
          },
        );

        it(
          "rejects zero quaternion",
          () => {
            expect(
              () =>
                createRigJoint({
                  name:
                    "Joint",
                  type:
                    "custom",
                  localTransform: {
                    rotation: {
                      x: 0,
                      y: 0,
                      z: 0,
                      w: 0,
                    },
                  },
                }),
            ).toThrow(
              /zero length/i,
            );
          },
        );

        it(
          "rejects negative joint length",
          () => {
            expect(
              () =>
                createRigJoint({
                  name:
                    "Joint",
                  type:
                    "custom",
                  length:
                    -1,
                }),
            ).toThrow(
              /must not be negative/i,
            );
          },
        );
      },
    );

    describe(
      "rig creation",
      () => {
        it(
          "creates a complete rig",
          () => {
            const rig =
              makeRig();

            expect(
              rig.schemaVersion,
            ).toBe(
              RIG_SCHEMA_VERSION,
            );

            expect(
              rig.joints,
            ).toHaveLength(5);

            expect(
              rig.rootJointId,
            ).toBe(
              ROOT,
            );

            expect(
              rig.contentHash,
            ).toMatch(
              /^[a-f0-9]{64}$/i,
            );
          },
        );

        it(
          "uses current engine version",
          () => {
            expect(
              RIG_ENGINE_VERSION,
            ).toBe(
              "1.0.0",
            );
          },
        );

        it(
          "produces deterministic fingerprints",
          () => {
            const a =
              makeRig();

            const b =
              makeRig();

            expect(
              a.contentHash,
            ).toBe(
              b.contentHash,
            );
          },
        );

        it(
          "changes fingerprint when joint changes",
          () => {
            const a =
              makeRig();

            const b =
              makeRig({
                joints: [
                  {
                    jointId:
                      ROOT,
                    name:
                      "Root",
                    type:
                      "root",
                    length:
                      2,
                  },

                  {
                    jointId:
                      SPINE,
                    name:
                      "Spine",
                    type:
                      "spine",
                    parentJointId:
                      ROOT,
                  },

                  {
                    jointId:
                      HEAD,
                    name:
                      "Head",
                    type:
                      "head",
                    parentJointId:
                      SPINE,
                  },
                ],
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
      "hierarchy validation",
      () => {
        it(
          "rejects duplicate joint ids",
          () => {
            expect(
              () =>
                makeRig({
                  joints: [
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root A",
                      type:
                        "root",
                    },
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root B",
                      type:
                        "root",
                    },
                  ],
                }),
            ).toThrow(
              /duplicate joint/i,
            );
          },
        );

        it(
          "rejects self parenting",
          () => {
            expect(
              () =>
                makeRig({
                  joints: [
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root",
                      type:
                        "root",
                      parentJointId:
                        ROOT,
                    },
                  ],
                }),
            ).toThrow(
              /cannot parent itself/i,
            );
          },
        );

        it(
          "rejects missing parent",
          () => {
            expect(
              () =>
                makeRig({
                  joints: [
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root",
                      type:
                        "root",
                    },
                    {
                      jointId:
                        SPINE,
                      name:
                        "Spine",
                      type:
                        "spine",
                      parentJointId:
                        "00000000-0000-4000-8000-000000000999",
                    },
                  ],
                }),
            ).toThrow(
              /Parent joint/i,
            );
          },
        );

        it(
          "rejects cyclic hierarchy",
          () => {
            expect(
              () =>
                makeRig({
                  rootJointId:
                    ROOT,
                  joints: [
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root",
                      type:
                        "root",
                      parentJointId:
                        SPINE,
                    },
                    {
                      jointId:
                        SPINE,
                      name:
                        "Spine",
                      type:
                        "spine",
                      parentJointId:
                        ROOT,
                    },
                  ],
                }),
            ).toThrow(
              /cyclic/i,
            );
          },
        );

        it(
          "rejects multiple roots without explicit root",
          () => {
            expect(
              () =>
                createCharacterRig({
                  characterAssemblyId:
                    "00000000-0000-4000-8000-000000000301",
                  representation:
                    "3d",
                  joints: [
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root",
                      type:
                        "root",
                    },
                    {
                      jointId:
                        SPINE,
                      name:
                        "SecondRoot",
                      type:
                        "root",
                    },
                  ],
                }),
            ).toThrow(
              /Multiple root/i,
            );
          },
        );

        it(
          "rejects root with parent",
          () => {
            expect(
              () =>
                makeRig({
                  rootJointId:
                    SPINE,
                  joints: [
                    {
                      jointId:
                        ROOT,
                      name:
                        "Root",
                      type:
                        "root",
                    },
                    {
                      jointId:
                        SPINE,
                      name:
                        "Spine",
                      type:
                        "spine",
                      parentJointId:
                        ROOT,
                    },
                  ],
                }),
            ).toThrow(
              /cannot have a parent/i,
            );
          },
        );
      },
    );

    describe(
      "children",
      () => {
        it(
          "rebuilds children deterministically",
          () => {
            const rig =
              makeRig();

            const spine =
              rig.joints.find(
                (joint) =>
                  joint.jointId ===
                  SPINE,
              );

            expect(
              spine?.children,
            ).toEqual([
              ARM,
              HEAD,
            ]);
          },
        );

        it(
          "creates dependency-first order",
          () => {
            const rig =
              makeRig();

            const reversed =
              [
                ...rig.joints,
              ].reverse();

            const ordered =
              topologicalJointOrder(
                reversed,
              );

            expect(
              ordered.map(
                (joint) =>
                  joint.jointId,
              ),
            ).toEqual([
              ROOT,
              SPINE,
              ARM,
              HAND,
              HEAD,
            ]);
          },
        );
      },
    );

    describe(
      "IK",
      () => {
        it(
          "creates and validates an IK chain",
          () => {
            const rig =
              makeRig({
                ikChains: [
                  {
                    chainId:
                      "00000000-0000-4000-8000-000000000401",
                    name:
                      "Left Arm",
                    type:
                      "two-bone",
                    rootJointId:
                      ARM,
                    endJointId:
                      HAND,
                    joints: [
                      ARM,
                      HAND,
                    ],
                    iterations:
                      20,
                    tolerance:
                      0.0001,
                  },
                ],
              });

            expect(
              rig.ikChains,
            ).toHaveLength(1);

            expect(
              rig.ikChains[0]
                .iterations,
            ).toBe(20);
          },
        );

        it(
          "rejects missing IK joint",
          () => {
            expect(
              () =>
                makeRig({
                  ikChains: [
                    {
                      name:
                        "Invalid",
                      type:
                        "two-bone",
                      rootJointId:
                        ARM,
                      endJointId:
                        "00000000-0000-4000-8000-000000000999",
                    },
                  ],
                }),
            ).toThrow(
              /IK end joint/i,
            );
          },
        );

        it(
          "rejects identical IK root and end",
          () => {
            expect(
              () =>
                makeRig({
                  ikChains: [
                    {
                      name:
                        "Invalid",
                      type:
                        "two-bone",
                      rootJointId:
                        ARM,
                      endJointId:
                        ARM,
                    },
                  ],
                }),
            ).toThrow(
              /cannot be identical/i,
            );
          },
        );
      },
    );

    describe(
      "catalog",
      () => {
        it(
          "registers and retrieves rig",
          () => {
            const catalog =
              new RigCatalog();

            const rig =
              makeRig();

            catalog.register(
              rig,
            );

            expect(
              catalog.require(
                rig.rigId,
              ),
            ).toEqual(
              rig,
            );
          },
        );

        it(
          "returns defensive copies",
          () => {
            const catalog =
              new RigCatalog();

            const rig =
              makeRig();

            catalog.register(
              rig,
            );

            const retrieved =
              catalog.require(
                rig.rigId,
              );

            (
              retrieved.metadata as
                Record<
                  string,
                  unknown
                >
            ).test =
              "changed";

            const again =
              catalog.require(
                rig.rigId,
              );

            expect(
              again.metadata.test,
            ).toBeUndefined();
          },
        );

        it(
          "lists rigs deterministically",
          () => {
            const catalog =
              new RigCatalog();

            const first =
              makeRig({
                rigId:
                  "00000000-0000-4000-8000-000000000202",
              });

            const second =
              makeRig({
                rigId:
                  "00000000-0000-4000-8000-000000000203",
              });

            catalog.register(
              second,
            );

            catalog.register(
              first,
            );

            expect(
              catalog.list().map(
                (rig) =>
                  rig.rigId,
              ),
            ).toEqual([
              "00000000-0000-4000-8000-000000000202",
              "00000000-0000-4000-8000-000000000203",
            ]);
          },
        );

        it(
          "finds a joint",
          () => {
            const catalog =
              new RigCatalog();

            const rig =
              makeRig();

            catalog.register(
              rig,
            );

            expect(
              catalog.requireJoint(
                rig.rigId,
                HAND,
              ).name,
            ).toBe(
              "Hand.L",
            );
          },
        );

        it(
          "returns children",
          () => {
            const catalog =
              new RigCatalog();

            const rig =
              makeRig();

            catalog.register(
              rig,
            );

            expect(
              catalog.children(
                rig.rigId,
                SPINE,
              ).map(
                (joint) =>
                  joint.jointId,
              ),
            ).toEqual([
              ARM,
              HEAD,
            ]);
          },
        );

        it(
          "returns descendants",
          () => {
            const catalog =
              new RigCatalog();

            const rig =
              makeRig();

            catalog.register(
              rig,
            );

            expect(
              catalog.descendants(
                rig.rigId,
                SPINE,
              ).map(
                (joint) =>
                  joint.jointId,
              ),
            ).toEqual([
              ARM,
              HAND,
              HEAD,
            ]);
          },
        );

        it(
          "returns statistics",
          () => {
            const catalog =
              new RigCatalog();

            catalog.register(
              makeRig(),
            );

            expect(
              catalog.stats(),
            ).toEqual({
              rigCount: 1,
              jointCount: 5,
              ikChainCount: 0,
            });
          },
        );
      },
    );

    describe(
      "validation",
      () => {
        it(
          "accepts a correctly fingerprinted rig",
          () => {
            const rig =
              makeRig();

            expect(
              () =>
                validateCharacterRig(
                  rig,
                ),
            ).not.toThrow();
          },
        );

        it(
          "rejects tampered fingerprint",
          () => {
            const rig =
              makeRig();

            const tampered =
              {
                ...rig,
                contentHash:
                  "tampered",
              };

            expect(
              () =>
                validateCharacterRig(
                  tampered,
                ),
            ).toThrow(
              /contentHash does not match/i,
            );
          },
        );

        it(
          "fingerprint matches canonical fingerprint",
          () => {
            const rig =
              makeRig();

            const {
              contentHash,
              ...withoutHash
            } = rig;

            expect(
              fingerprintRig(
                withoutHash,
              ),
            ).toBe(
              contentHash,
            );
          },
        );
      },
    );

    describe(
      "removal",
      () => {
        it(
          "removes a rig",
          () => {
            const catalog =
              new RigCatalog();

            const rig =
              makeRig();

            catalog.register(
              rig,
            );

            expect(
              catalog.remove(
                rig.rigId,
              ),
            ).toBe(true);

            expect(
              catalog.get(
                rig.rigId,
              ),
            ).toBeUndefined();
          },
        );
      },
    );
  },
);