import { createHash } from "node:crypto";
import { z } from "zod";

import {
  RigDefinition as RigDefinitionSchema,
} from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type RigDimension = "2d" | "3d";

export type RigControlKind =
  | "root"
  | "position"
  | "rotation"
  | "scale"
  | "ik"
  | "pole"
  | "head"
  | "hand"
  | "foot"
  | "spine"
  | "custom";

export interface JointTransform {
  x: number;
  y: number;
  z: number;
}

export interface RigJoint {
  id: string;
  parentId: string | null;
  rest: JointTransform;
}

export interface RigControl {
  id: string;
  kind: RigControlKind;
  targetIds: string[];
}

export interface RotationLimitConstraint {
  type: "limit_rotation";
  jointId: string;
  min: JointTransform;
  max: JointTransform;
}

export interface TwoBoneIKConstraint {
  type: "two_bone_ik";
  rootJointId: string;
  midJointId: string;
  endJointId: string;
  targetControlId: string;
  poleControlId?: string;
}

export type RigConstraint =
  | RotationLimitConstraint
  | TwoBoneIKConstraint;

/**
 * Canonical RigDefinition is defined by the contracts package.
 *
 * The contracts package exports a Zod schema/value, therefore the
 * TypeScript type must be inferred from that schema rather than imported
 * as a type value.
 */
export type RigDefinition =
  z.infer<typeof RigDefinitionSchema>;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TwoBoneIK2DResult {
  rootRotation: number;
  midRotation: number;
  reachable: boolean;
  targetDistance: number;
  clampedDistance: number;
}

export interface TwoBoneIK3DResult {
  rootDirection: Vec3;
  midPosition: Vec3;
  endPosition: Vec3;
  reachable: boolean;
  targetDistance: number;
  clampedDistance: number;
}

export interface RigValidationResult {
  valid: boolean;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const HUMANOID_RIG_ID_2D =
  "00000000-0000-4000-8000-000000000100";

export const HUMANOID_RIG_ID_3D =
  "00000000-0000-4000-8000-000000000101";

/* -------------------------------------------------------------------------- */
/* Math Helpers                                                               */
/* -------------------------------------------------------------------------- */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function distance2D(
  a: Vec2,
  b: Vec2,
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y,
  );
}

function distance3D(
  a: Vec3,
  b: Vec3,
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y,
    b.z - a.z,
  );
}

function normalize3D(
  value: Vec3,
): Vec3 {
  const length = Math.hypot(
    value.x,
    value.y,
    value.z,
  );

  if (length <= Number.EPSILON) {
    return {
      x: 1,
      y: 0,
      z: 0,
    };
  }

  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
}

function add3D(
  a: Vec3,
  b: Vec3,
): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function scale3D(
  value: Vec3,
  scalar: number,
): Vec3 {
  return {
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar,
  };
}

/* -------------------------------------------------------------------------- */
/* Deterministic Identity                                                     */
/* -------------------------------------------------------------------------- */

function deterministicUuid(
  value: string,
): string {
  const digest = createHash("sha256")
    .update(value)
    .digest("hex");

  const hex = digest.slice(0, 32);

  const versioned =
    `${hex.slice(0, 8)}-` +
    `${hex.slice(8, 12)}-` +
    `5${hex.slice(13, 16)}-` +
    `${(
      (parseInt(hex.slice(16, 18), 16) & 0x3f) |
      0x80
    )
      .toString(16)
      .padStart(2, "0")}${hex.slice(18, 20)}-` +
    `${hex.slice(20, 32)}`;

  return versioned;
}

function canonicalize(
  value: unknown,
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(canonicalize)
      .join(",")}]`;
  }

  const object =
    value as Record<string, unknown>;

  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalize(
          object[key],
        )}`,
    )
    .join(",")}}`;
}

/* -------------------------------------------------------------------------- */
/* Humanoid Skeleton                                                          */
/* -------------------------------------------------------------------------- */

function createHumanoidJoints(
  dimension: RigDimension,
): RigJoint[] {
  const z =
    dimension === "3d"
      ? 0
      : 0;

  return [
    {
      id: "root",
      parentId: null,
      rest: {
        x: 0,
        y: 0,
        z,
      },
    },

    {
      id: "pelvis",
      parentId: "root",
      rest: {
        x: 0,
        y: 1,
        z,
      },
    },

    {
      id: "spine",
      parentId: "pelvis",
      rest: {
        x: 0,
        y: 1.5,
        z,
      },
    },

    {
      id: "chest",
      parentId: "spine",
      rest: {
        x: 0,
        y: 2,
        z,
      },
    },

    {
      id: "neck",
      parentId: "chest",
      rest: {
        x: 0,
        y: 2.7,
        z,
      },
    },

    {
      id: "head",
      parentId: "neck",
      rest: {
        x: 0,
        y: 3,
        z,
      },
    },

    /* ------------------------------ Left Arm ----------------------------- */

    {
      id: "upper_arm.L",
      parentId: "chest",
      rest: {
        x: -0.65,
        y: 2.55,
        z,
      },
    },

    {
      id: "lower_arm.L",
      parentId: "upper_arm.L",
      rest: {
        x: -1.25,
        y: 2.2,
        z,
      },
    },

    {
      id: "hand.L",
      parentId: "lower_arm.L",
      rest: {
        x: -1.8,
        y: 1.85,
        z,
      },
    },

    /* ----------------------------- Right Arm ----------------------------- */

    {
      id: "upper_arm.R",
      parentId: "chest",
      rest: {
        x: 0.65,
        y: 2.55,
        z,
      },
    },

    {
      id: "lower_arm.R",
      parentId: "upper_arm.R",
      rest: {
        x: 1.25,
        y: 2.2,
        z,
      },
    },

    {
      id: "hand.R",
      parentId: "lower_arm.R",
      rest: {
        x: 1.8,
        y: 1.85,
        z,
      },
    },

    /* ------------------------------ Left Leg ----------------------------- */

    {
      id: "upper_leg.L",
      parentId: "pelvis",
      rest: {
        x: -0.35,
        y: 0.8,
        z,
      },
    },

    {
      id: "lower_leg.L",
      parentId: "upper_leg.L",
      rest: {
        x: -0.35,
        y: 0.05,
        z,
      },
    },

    {
      id: "foot.L",
      parentId: "lower_leg.L",
      rest: {
        x: -0.35,
        y: -0.7,
        z,
      },
    },

    /* ----------------------------- Right Leg ----------------------------- */

    {
      id: "upper_leg.R",
      parentId: "pelvis",
      rest: {
        x: 0.35,
        y: 0.8,
        z,
      },
    },

    {
      id: "lower_leg.R",
      parentId: "upper_leg.R",
      rest: {
        x: 0.35,
        y: 0.05,
        z,
      },
    },

    {
      id: "foot.R",
      parentId: "lower_leg.R",
      rest: {
        x: 0.35,
        y: -0.7,
        z,
      },
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Humanoid Controls                                                          */
/* -------------------------------------------------------------------------- */

function createHumanoidControls(): RigControl[] {
  return [
    {
      id: "root-control",
      kind: "root",
      targetIds: ["root"],
    },

    {
      id: "pelvis-control",
      kind: "position",
      targetIds: ["pelvis"],
    },

    {
      id: "spine-control",
      kind: "spine",
      targetIds: [
        "pelvis",
        "spine",
        "chest",
      ],
    },

    {
      id: "head-control",
      kind: "head",
      targetIds: ["head"],
    },

    {
      id: "hand.L-control",
      kind: "hand",
      targetIds: ["hand.L"],
    },

    {
      id: "hand.R-control",
      kind: "hand",
      targetIds: ["hand.R"],
    },

    {
      id: "foot.L-control",
      kind: "foot",
      targetIds: ["foot.L"],
    },

    {
      id: "foot.R-control",
      kind: "foot",
      targetIds: ["foot.R"],
    },

    {
      id: "hand.L-ik",
      kind: "ik",
      targetIds: [
        "upper_arm.L",
        "lower_arm.L",
        "hand.L",
      ],
    },

    {
      id: "hand.R-ik",
      kind: "ik",
      targetIds: [
        "upper_arm.R",
        "lower_arm.R",
        "hand.R",
      ],
    },

    {
      id: "foot.L-ik",
      kind: "ik",
      targetIds: [
        "upper_leg.L",
        "lower_leg.L",
        "foot.L",
      ],
    },

    {
      id: "foot.R-ik",
      kind: "ik",
      targetIds: [
        "upper_leg.R",
        "lower_leg.R",
        "foot.R",
      ],
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Constraints                                                                */
/* -------------------------------------------------------------------------- */

function createHumanoidConstraints(): Record<
  string,
  unknown
>[] {
  const constraints: Record<
    string,
    unknown
  >[] = [];

  const limitedJoints = [
    "neck",
    "head",
    "upper_arm.L",
    "lower_arm.L",
    "upper_arm.R",
    "lower_arm.R",
    "upper_leg.L",
    "lower_leg.L",
    "upper_leg.R",
    "lower_leg.R",
  ];

  for (const jointId of limitedJoints) {
    constraints.push({
      type: "limit_rotation",
      jointId,

      min: {
        x: -Math.PI,
        y: -Math.PI,
        z: -Math.PI,
      },

      max: {
        x: Math.PI,
        y: Math.PI,
        z: Math.PI,
      },
    });
  }

  constraints.push(
    {
      type: "two_bone_ik",
      rootJointId: "upper_arm.L",
      midJointId: "lower_arm.L",
      endJointId: "hand.L",
      targetControlId: "hand.L-ik",
    },

    {
      type: "two_bone_ik",
      rootJointId: "upper_arm.R",
      midJointId: "lower_arm.R",
      endJointId: "hand.R",
      targetControlId: "hand.R-ik",
    },

    {
      type: "two_bone_ik",
      rootJointId: "upper_leg.L",
      midJointId: "lower_leg.L",
      endJointId: "foot.L",
      targetControlId: "foot.L-ik",
    },

    {
      type: "two_bone_ik",
      rootJointId: "upper_leg.R",
      midJointId: "lower_leg.R",
      endJointId: "foot.R",
      targetControlId: "foot.R-ik",
    },
  );

  return constraints;
}

/* -------------------------------------------------------------------------- */
/* Rig Engine                                                                 */
/* -------------------------------------------------------------------------- */

export class RigEngine {
  createHumanoid(
    dimension: RigDimension = "2d",
  ): RigDefinition {
    const joints =
      createHumanoidJoints(dimension);

    const controls =
      createHumanoidControls();

    const constraints =
      createHumanoidConstraints();

    const rig: RigDefinition = {
      id:
        dimension === "2d"
          ? HUMANOID_RIG_ID_2D
          : HUMANOID_RIG_ID_3D,

      name: `Humanoid ${dimension.toUpperCase()}`,

      dimension,

      joints,

      controls,

      constraints,
    };

    return this.validate(rig);
  }

  validate(
    rig: RigDefinition,
  ): RigDefinition {
    const result =
      this.validateRig(rig);

    if (!result.valid) {
      throw new Error(
        `Invalid rig: ${result.errors.join("; ")}`,
      );
    }

    return structuredClone(rig);
  }

  validateRig(
    rig: RigDefinition,
  ): RigValidationResult {
    const errors: string[] = [];

    const parsed =
      RigDefinitionSchema.safeParse(rig);

    if (!parsed.success) {
      errors.push(
        ...parsed.error.issues.map(
          (issue) =>
            `${issue.path.join(".")}: ${issue.message}`,
        ),
      );

      return {
        valid: false,
        errors,
      };
    }

    const jointIds = new Set<string>();

    for (const joint of rig.joints) {
      if (jointIds.has(joint.id)) {
        errors.push(
          `Duplicate joint id: ${joint.id}`,
        );
      }

      jointIds.add(joint.id);
    }

    if (
      rig.joints.length === 0
    ) {
      errors.push(
        "Rig must contain at least one joint.",
      );
    }

    if (
      rig.joints.length > 0 &&
      !rig.joints.some(
        (joint) =>
          joint.parentId === null,
      )
    ) {
      errors.push(
        "Rig must contain a root joint.",
      );
    }

    for (const joint of rig.joints) {
      if (
        joint.parentId !== null &&
        !jointIds.has(joint.parentId)
      ) {
        errors.push(
          `Joint ${joint.id} references missing parent ${joint.parentId}.`,
        );
      }
    }

    /* ----------------------------- Cycle Check -------------------------- */

    const jointMap =
      new Map<
        string,
        RigDefinition["joints"][number]
      >(
        rig.joints.map(
          (joint) => [
            joint.id,
            joint,
          ],
        ),
      );

    for (const joint of rig.joints) {
      const visited =
        new Set<string>();

      let current:
        | string
        | null = joint.id;

      while (current !== null) {
        if (visited.has(current)) {
          errors.push(
            `Joint hierarchy contains a cycle involving ${joint.id}.`,
          );
          break;
        }

        visited.add(current);

        const currentJoint =
          jointMap.get(current);

        if (!currentJoint) {
          break;
        }

        current =
          currentJoint.parentId;
      }
    }

    /* -------------------------- Control Check --------------------------- */

    const controlIds =
      new Set<string>();

    for (const control of rig.controls) {
      if (
        controlIds.has(control.id)
      ) {
        errors.push(
          `Duplicate control id: ${control.id}`,
        );
      }

      controlIds.add(control.id);

      for (const targetId of control.targetIds) {
        if (
          !jointIds.has(targetId)
        ) {
          errors.push(
            `Control ${control.id} references missing joint ${targetId}.`,
          );
        }
      }
    }

    /* ------------------------ Constraint Check -------------------------- */

    for (
      const constraint of rig.constraints
    ) {
      const record =
        constraint as Record<
          string,
          unknown
        >;

      const type =
        record.type;

      if (
        type === "two_bone_ik"
      ) {
        const required = [
          "rootJointId",
          "midJointId",
          "endJointId",
        ];

        for (
          const key of required
        ) {
          const jointId =
            record[key];

          if (
            typeof jointId !==
              "string" ||
            !jointIds.has(
              jointId,
            )
          ) {
            errors.push(
              `Two-bone IK references invalid ${key}.`,
            );
          }
        }

        const targetControlId =
          record.targetControlId;

        if (
          typeof targetControlId ===
            "string" &&
          !controlIds.has(
            targetControlId,
          )
        ) {
          errors.push(
            `Two-bone IK references missing target control ${targetControlId}.`,
          );
        }
      }

      if (
        type ===
        "limit_rotation"
      ) {
        const jointId =
          record.jointId;

        if (
          typeof jointId !==
            "string" ||
          !jointIds.has(jointId)
        ) {
          errors.push(
            `Rotation limit references missing joint ${String(
              jointId,
            )}.`,
          );
        }
      }
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }

  applyControl(
    rig: RigDefinition,
    controlId: string,
    value: number,
  ): RigDefinition {
    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        "Control value must be finite.",
      );
    }

    const control =
      rig.controls.find(
        (item) =>
          item.id === controlId,
      );

    if (!control) {
      throw new Error(
        `Unknown rig control: ${controlId}`,
      );
    }

    const normalizedValue =
      clamp(
        value,
        -1,
        1,
      );

    const next =
      structuredClone(rig);

    next.constraints = [
      ...next.constraints,
    ];

    next.constraints.push({
      type: "control_value",
      controlId,
      value: normalizedValue,
    });

    return this.validate(next);
  }

  solveTwoBoneIK2D(
    root: Vec2,
    mid: Vec2,
    end: Vec2,
    target: Vec2,
  ): TwoBoneIK2DResult {
    const len1 =
      distance2D(
        root,
        mid,
      );

    const len2 =
      distance2D(
        mid,
        end,
      );

    if (
      len1 <= Number.EPSILON ||
      len2 <= Number.EPSILON
    ) {
      throw new Error(
        "Two-bone IK requires non-zero bone lengths.",
      );
    }

    const targetDistance =
      distance2D(
        root,
        target,
      );

    const minimumDistance =
      Math.abs(
        len1 - len2,
      ) + 1e-8;

    const maximumDistance =
      len1 + len2 - 1e-8;

    const clampedDistance =
      clamp(
        targetDistance,
        minimumDistance,
        maximumDistance,
      );

    const directionX =
      target.x - root.x;

    const directionY =
      target.y - root.y;

    const baseAngle =
      Math.atan2(
        directionY,
        directionX,
      );

    const rootAngleOffset =
      Math.acos(
        clamp(
          (
            len1 *
              len1 +
            clampedDistance *
              clampedDistance -
            len2 *
              len2
          ) /
            (
              2 *
              len1 *
              clampedDistance
            ),
          -1,
          1,
        ),
      );

    const midAngle =
      Math.acos(
        clamp(
          (
            len1 *
              len1 +
            len2 *
              len2 -
            clampedDistance *
              clampedDistance
          ) /
            (
              2 *
              len1 *
              len2
            ),
          -1,
          1,
        ),
      );

    return {
      rootRotation:
        baseAngle -
        rootAngleOffset,

      midRotation:
        Math.PI -
        midAngle,

      reachable:
        targetDistance >=
          minimumDistance &&
        targetDistance <=
          maximumDistance,

      targetDistance,

      clampedDistance,
    };
  }

  solveTwoBoneIK3D(
    root: Vec3,
    mid: Vec3,
    end: Vec3,
    target: Vec3,
  ): TwoBoneIK3DResult {
    const len1 =
      distance3D(
        root,
        mid,
      );

    const len2 =
      distance3D(
        mid,
        end,
      );

    if (
      len1 <= Number.EPSILON ||
      len2 <= Number.EPSILON
    ) {
      throw new Error(
        "Two-bone IK requires non-zero bone lengths.",
      );
    }

    const targetVector = {
      x: target.x - root.x,
      y: target.y - root.y,
      z: target.z - root.z,
    };

    const targetDistance =
      Math.hypot(
        targetVector.x,
        targetVector.y,
        targetVector.z,
      );

    const minimumDistance =
      Math.abs(
        len1 - len2,
      ) + 1e-8;

    const maximumDistance =
      len1 + len2 - 1e-8;

    const clampedDistance =
      clamp(
        targetDistance,
        minimumDistance,
        maximumDistance,
      );

    const direction =
      normalize3D(
        targetVector,
      );

    const midDistance =
      (
        len1 *
          len1 +
        clampedDistance *
          clampedDistance -
        len2 *
          len2
      ) /
      (
        2 *
        clampedDistance
      );

    const heightSquared =
      Math.max(
        0,
        len1 *
          len1 -
          midDistance *
            midDistance,
      );

    const height =
      Math.sqrt(
        heightSquared,
      );

    /*
     * A deterministic bend plane is selected from the
     * current root->mid direction. This gives the solver
     * stable behaviour without requiring a pole vector yet.
     */

    const currentBend =
      normalize3D({
        x:
          mid.x -
          root.x,
        y:
          mid.y -
          root.y,
        z:
          mid.z -
          root.z,
      });

    let bendDirection =
      normalize3D({
        x:
          currentBend.x -
          direction.x *
            (
              currentBend.x *
                direction.x +
              currentBend.y *
                direction.y +
              currentBend.z *
                direction.z
            ),

        y:
          currentBend.y -
          direction.y *
            (
              currentBend.x *
                direction.x +
              currentBend.y *
                direction.y +
              currentBend.z *
                direction.z
            ),

        z:
          currentBend.z -
          direction.z *
            (
              currentBend.x *
                direction.x +
              currentBend.y *
                direction.y +
              currentBend.z *
                direction.z
            ),
      });

    if (
      Math.hypot(
        bendDirection.x,
        bendDirection.y,
        bendDirection.z,
      ) <=
      Number.EPSILON
    ) {
      bendDirection = {
        x: 0,
        y: 1,
        z: 0,
      };
    }

    const midPosition =
      add3D(
        root,
        add3D(
          scale3D(
            direction,
            midDistance,
          ),
          scale3D(
            bendDirection,
            height,
          ),
        ),
      );

    return {
      rootDirection:
        direction,

      midPosition,

      endPosition:
        target,

      reachable:
        targetDistance >=
          minimumDistance &&
        targetDistance <=
          maximumDistance,

      targetDistance,

      clampedDistance,
    };
  }

  fingerprint(
    rig: RigDefinition,
  ): string {
    const validated =
      this.validate(rig);

    return createHash("sha256")
      .update(
        canonicalize(
          validated,
        ),
      )
      .digest("hex");
  }
}