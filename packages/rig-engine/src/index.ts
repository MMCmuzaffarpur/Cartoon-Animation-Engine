import {
  canonicalHash,
  CaeError,
  uuid,
} from "../../domain/src/index.js";

import type {
  CharacterAssembly,
} from "../../character-assembly/src/index.js";

/* -------------------------------------------------------------------------- */
/* Version                                                                    */
/* -------------------------------------------------------------------------- */

export const RIG_ENGINE_VERSION = "1.0.0";
export const RIG_SCHEMA_VERSION = "1.0.0";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type RigRepresentation =
  | "2d"
  | "3d"
  | "hybrid";

export type JointType =
  | "root"
  | "hip"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "shoulder"
  | "upper-arm"
  | "lower-arm"
  | "hand"
  | "finger"
  | "upper-leg"
  | "lower-leg"
  | "foot"
  | "toe"
  | "custom";

export type ConstraintType =
  | "rotation"
  | "translation"
  | "scale"
  | "hinge"
  | "ball"
  | "limit";

export type IKChainType =
  | "two-bone"
  | "multi-bone";

/* -------------------------------------------------------------------------- */
/* Vector                                                                     */
/* -------------------------------------------------------------------------- */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/* -------------------------------------------------------------------------- */
/* Quaternion                                                                 */
/* -------------------------------------------------------------------------- */

export interface Quaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

/* -------------------------------------------------------------------------- */
/* Transform                                                                  */
/* -------------------------------------------------------------------------- */

export interface RigTransform {
  readonly position: Vec3;
  readonly rotation: Quaternion;
  readonly scale: Vec3;
}

/* -------------------------------------------------------------------------- */
/* Matrix                                                                     */
/* -------------------------------------------------------------------------- */

export type Matrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/* -------------------------------------------------------------------------- */
/* Joint Limits                                                               */
/* -------------------------------------------------------------------------- */

export interface JointLimits {
  readonly minRotation?: Vec3;
  readonly maxRotation?: Vec3;
  readonly minTranslation?: Vec3;
  readonly maxTranslation?: Vec3;
}

/* -------------------------------------------------------------------------- */
/* Joint Constraint                                                           */
/* -------------------------------------------------------------------------- */

export interface JointConstraint {
  readonly constraintId: string;
  readonly type: ConstraintType;
  readonly enabled: boolean;
  readonly weight: number;
  readonly limits?: JointLimits;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Joint                                                                      */
/* -------------------------------------------------------------------------- */

export interface RigJoint {
  readonly jointId: string;
  readonly name: string;
  readonly type: JointType;
  readonly parentJointId?: string;
  readonly children: readonly string[];

  readonly localTransform: RigTransform;
  readonly bindTransform: RigTransform;
  readonly inverseBindMatrix: Matrix4;

  readonly length: number;

  readonly constraints: readonly JointConstraint[];

  readonly metadata: Readonly<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* IK Chain                                                                   */
/* -------------------------------------------------------------------------- */

export interface IKChain {
  readonly chainId: string;
  readonly name: string;
  readonly type: IKChainType;

  readonly rootJointId: string;
  readonly endJointId: string;
  readonly targetJointId?: string;

  readonly joints: readonly string[];

  readonly iterations: number;
  readonly tolerance: number;

  readonly enabled: boolean;

  readonly metadata: Readonly<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Rig                                                                        */
/* -------------------------------------------------------------------------- */

export interface CharacterRig {
  readonly rigId: string;
  readonly schemaVersion: string;
  readonly characterAssemblyId: string;
  readonly representation: RigRepresentation;

  readonly rootJointId: string;
  readonly joints: readonly RigJoint[];

  readonly ikChains: readonly IKChain[];

  readonly metadata: Readonly<Record<string, unknown>>;

  readonly createdBy: string;

  readonly contentHash: string;
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export interface RigJointInput {
  readonly jointId?: string;
  readonly name: string;
  readonly type: JointType;
  readonly parentJointId?: string;

  readonly localTransform?: Partial<RigTransform>;
  readonly bindTransform?: Partial<RigTransform>;

  readonly inverseBindMatrix?: Matrix4;

  readonly length?: number;

  readonly constraints?: readonly JointConstraint[];

  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IKChainInput {
  readonly chainId?: string;
  readonly name: string;
  readonly type: IKChainType;

  readonly rootJointId: string;
  readonly endJointId: string;
  readonly targetJointId?: string;

  readonly joints?: readonly string[];

  readonly iterations?: number;
  readonly tolerance?: number;

  readonly enabled?: boolean;

  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CharacterRigInput {
  readonly rigId?: string;
  readonly characterAssemblyId: string;
  readonly representation: RigRepresentation;

  readonly rootJointId?: string;

  readonly joints: readonly RigJointInput[];

  readonly ikChains?: readonly IKChainInput[];

  readonly metadata?: Readonly<Record<string, unknown>>;

  readonly createdBy?: string;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_POSITION: Vec3 = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
});

const DEFAULT_ROTATION: Quaternion =
  Object.freeze({
    x: 0,
    y: 0,
    z: 0,
    w: 1,
  });

const DEFAULT_SCALE: Vec3 = Object.freeze({
  x: 1,
  y: 1,
  z: 1,
});

const IDENTITY_MATRIX: Matrix4 = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

/* -------------------------------------------------------------------------- */
/* Canonical Joint Ordering                                                   */
/* -------------------------------------------------------------------------- */

/*
 * This is the canonical anatomical ordering used by the rig engine.
 *
 * It is deliberately NOT based on:
 *   - UUID
 *   - object insertion order
 *   - localeCompare()
 *
 * The ordering is stable across serialization, database retrieval and
 * different input ordering.
 *
 * This also gives a natural character hierarchy:
 *
 * root
 *   hip
 *   spine
 *     chest
 *       neck
 *         shoulder
 *           upper-arm
 *             lower-arm
 *               hand
 *                 finger
 *         head
 *     upper-leg
 *       lower-leg
 *         foot
 *           toe
 */
const JOINT_TYPE_ORDER: Readonly<
  Record<JointType, number>
> = Object.freeze({
  root: 0,
  hip: 10,
  spine: 20,
  chest: 30,
  neck: 40,
  shoulder: 50,
  "upper-arm": 60,
  "lower-arm": 70,
  hand: 80,
  finger: 90,
  head: 100,
  "upper-leg": 110,
  "lower-leg": 120,
  foot: 130,
  toe: 140,
  custom: 1000,
});

function compareJoints(
  a: RigJoint,
  b: RigJoint,
): number {
  const typeOrderA =
    JOINT_TYPE_ORDER[a.type] ?? 1000;

  const typeOrderB =
    JOINT_TYPE_ORDER[b.type] ?? 1000;

  if (
    typeOrderA !==
    typeOrderB
  ) {
    return (
      typeOrderA -
      typeOrderB
    );
  }

  const nameCompare =
    a.name.localeCompare(
      b.name,
    );

  if (
    nameCompare !== 0
  ) {
    return nameCompare;
  }

  return a.jointId.localeCompare(
    b.jointId,
  );
}

function sortJoints(
  joints: readonly RigJoint[],
): RigJoint[] {
  return [
    ...joints,
  ].sort(
    compareJoints,
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clone<T>(value: T): T {
  return structuredClone(value);
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

function finite(
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

function positive(
  value: number,
  field: string,
): number {
  finite(
    value,
    field,
  );

  if (
    value <= 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be greater than zero.`,
    );
  }

  return value;
}

function nonNegative(
  value: number,
  field: string,
): number {
  finite(
    value,
    field,
  );

  if (
    value < 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must not be negative.`,
    );
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Vector Helpers                                                             */
/* -------------------------------------------------------------------------- */

function vector(
  input?: Partial<Vec3>,
  fallback: Vec3 = DEFAULT_POSITION,
): Vec3 {
  const result: Vec3 = {
    x:
      input?.x ??
      fallback.x,

    y:
      input?.y ??
      fallback.y,

    z:
      input?.z ??
      fallback.z,
  };

  finite(
    result.x,
    "vector.x",
  );

  finite(
    result.y,
    "vector.y",
  );

  finite(
    result.z,
    "vector.z",
  );

  return result;
}

/* -------------------------------------------------------------------------- */
/* Quaternion Helpers                                                         */
/* -------------------------------------------------------------------------- */

function quaternion(
  input?: Partial<Quaternion>,
): Quaternion {
  const result: Quaternion = {
    x:
      input?.x ??
      DEFAULT_ROTATION.x,

    y:
      input?.y ??
      DEFAULT_ROTATION.y,

    z:
      input?.z ??
      DEFAULT_ROTATION.z,

    w:
      input?.w ??
      DEFAULT_ROTATION.w,
  };

  finite(
    result.x,
    "rotation.x",
  );

  finite(
    result.y,
    "rotation.y",
  );

  finite(
    result.z,
    "rotation.z",
  );

  finite(
    result.w,
    "rotation.w",
  );

  const length =
    Math.sqrt(
      result.x * result.x +
      result.y * result.y +
      result.z * result.z +
      result.w * result.w,
    );

  if (
    length === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Quaternion cannot have zero length.",
    );
  }

  return {
    x:
      result.x /
      length,

    y:
      result.y /
      length,

    z:
      result.z /
      length,

    w:
      result.w /
      length,
  };
}

/* -------------------------------------------------------------------------- */
/* Transform Creation                                                         */
/* -------------------------------------------------------------------------- */

function createTransform(
  input?: Partial<RigTransform>,
): RigTransform {
  const position =
    vector(
      input?.position,
      DEFAULT_POSITION,
    );

  const rotation =
    quaternion(
      input?.rotation,
    );

  const scale =
    vector(
      input?.scale,
      DEFAULT_SCALE,
    );

  if (
    scale.x === 0 ||
    scale.y === 0 ||
    scale.z === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Transform scale components cannot be zero.",
    );
  }

  return {
    position,
    rotation,
    scale,
  };
}

/* -------------------------------------------------------------------------- */
/* Matrix Validation                                                          */
/* -------------------------------------------------------------------------- */

function matrix(
  value?: Matrix4,
): Matrix4 {
  const result =
    value ??
    IDENTITY_MATRIX;

  if (
    !Array.isArray(result) ||
    result.length !== 16
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Matrix4 must contain exactly 16 numbers.",
    );
  }

  for (
    let index = 0;
    index < 16;
    index += 1
  ) {
    finite(
      result[index],
      `matrix[${index}]`,
    );
  }

  return [
    ...result,
  ] as unknown as Matrix4;
}

/* -------------------------------------------------------------------------- */
/* Joint Creation                                                             */
/* -------------------------------------------------------------------------- */

export function createRigJoint(
  input: RigJointInput,
): RigJoint {
  const jointId =
    input.jointId ??
    uuid();

  const name =
    requiredString(
      input.name,
      "joint.name",
    );

  const parentJointId =
    input.parentJointId !==
    undefined
      ? requiredString(
          input.parentJointId,
          "joint.parentJointId",
        )
      : undefined;

  const length =
    input.length ??
    1;

  nonNegative(
    length,
    "joint.length",
  );

  const constraints =
    input.constraints ??
    [];

  return {
    jointId,

    name,

    type:
      input.type,

    ...(parentJointId
      ? {
          parentJointId,
        }
      : {}),

    children: [],

    localTransform:
      createTransform(
        input.localTransform,
      ),

    bindTransform:
      createTransform(
        input.bindTransform,
      ),

    inverseBindMatrix:
      matrix(
        input.inverseBindMatrix,
      ),

    length,

    constraints:
      clone(
        constraints,
      ),

    metadata:
      clone(
        input.metadata ??
          {},
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Constraint Validation                                                      */
/* -------------------------------------------------------------------------- */

function validateConstraints(
  joint: RigJoint,
): void {
  const ids =
    joint.constraints.map(
      (
        constraint,
      ) =>
        constraint.constraintId,
    );

  if (
    new Set(ids).size !==
    ids.length
  ) {
    throw new CaeError(
      "ENTITY_DUPLICATE",
      `Joint "${joint.jointId}" contains duplicate constraint IDs.`,
    );
  }

  for (
    const constraint of
      joint.constraints
  ) {
    requiredString(
      constraint.constraintId,
      "constraint.constraintId",
    );

    finite(
      constraint.weight,
      "constraint.weight",
    );

    if (
      constraint.weight < 0 ||
      constraint.weight > 1
    ) {
      throw new CaeError(
        "INVALID_REQUEST",
        "Constraint weight must be between 0 and 1.",
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Hierarchy Validation                                                       */
/* -------------------------------------------------------------------------- */

function validateHierarchy(
  joints: readonly RigJoint[],
): void {
  const byId =
    new Map(
      joints.map(
        (
          joint,
        ) => [
          joint.jointId,
          joint,
        ],
      ),
    );

  for (
    const joint of joints
  ) {
    if (
      joint.parentJointId ===
      joint.jointId
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        `Joint "${joint.jointId}" cannot parent itself.`,
        [joint.jointId],
      );
    }

    if (
      joint.parentJointId &&
      !byId.has(
        joint.parentJointId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Parent joint "${joint.parentJointId}" was not found.`,
        [
          joint.parentJointId,
        ],
      );
    }

    validateConstraints(
      joint,
    );
  }

  for (
    const joint of joints
  ) {
    const visited =
      new Set<string>();

    let current:
      | RigJoint
      | undefined =
      joint;

    while (
      current?.parentJointId
    ) {
      if (
        visited.has(
          current.jointId,
        )
      ) {
        throw new CaeError(
          "COMMAND_INVALID",
          "Rig contains a cyclic joint hierarchy.",
          [current.jointId],
        );
      }

      visited.add(
        current.jointId,
      );

      current =
        byId.get(
          current.parentJointId,
        );

      if (!current) {
        break;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Children Reconstruction                                                    */
/* -------------------------------------------------------------------------- */

function rebuildChildren(
  joints: readonly RigJoint[],
): RigJoint[] {
  const children =
    new Map<
      string,
      RigJoint[]
    >();

  for (
    const joint of joints
  ) {
    children.set(
      joint.jointId,
      [],
    );
  }

  for (
    const joint of joints
  ) {
    if (
      joint.parentJointId
    ) {
      const list =
        children.get(
          joint.parentJointId,
        );

      if (list) {
        list.push(
          joint,
        );
      }
    }
  }

  return joints.map(
    (
      joint,
    ) => ({
      ...joint,

      children:
        (
          children.get(
            joint.jointId,
          ) ?? []
        )
          .sort(
            compareJoints,
          )
          .map(
            (
              child,
            ) =>
              child.jointId,
          ),
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Joint Hierarchy Order                                                       */
/* -------------------------------------------------------------------------- */

export function topologicalJointOrder(
  joints: readonly RigJoint[],
): RigJoint[] {
  const byId =
    new Map(
      joints.map(
        (
          joint,
        ) => [
          joint.jointId,
          joint,
        ],
      ),
    );

  const result: RigJoint[] =
    [];

  const visiting =
    new Set<string>();

  const visited =
    new Set<string>();

  function visit(
    jointId: string,
  ): void {
    if (
      visited.has(
        jointId,
      )
    ) {
      return;
    }

    if (
      visiting.has(
        jointId,
      )
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Rig contains a cyclic joint hierarchy.",
      );
    }

    const joint =
      byId.get(
        jointId,
      );

    if (!joint) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Joint "${jointId}" was not found.`,
        [jointId],
      );
    }

    visiting.add(
      jointId,
    );

    if (
      joint.parentJointId
    ) {
      visit(
        joint.parentJointId,
      );
    }

    visiting.delete(
      jointId,
    );

    visited.add(
      jointId,
    );

    result.push(
      joint,
    );
  }

  /*
   * First process actual roots in canonical
   * anatomical order.
   */
  const roots =
    sortJoints(
      joints.filter(
        (
          joint,
        ) =>
          !joint.parentJointId,
      ),
    );

  for (
    const root of roots
  ) {
    visit(
      root.jointId,
    );
  }

  /*
   * Then process any remaining joints.
   * This is mainly defensive and also keeps
   * the function deterministic for malformed
   * or externally constructed graphs.
   */
  const remaining =
    sortJoints(
      joints.filter(
        (
          joint,
        ) =>
          !visited.has(
            joint.jointId,
          ),
      ),
    );

  for (
    const joint of remaining
  ) {
    visit(
      joint.jointId,
    );
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* IK Chain Creation                                                          */
/* -------------------------------------------------------------------------- */

function createIKChain(
  input: IKChainInput,
): IKChain {
  const chainId =
    input.chainId ??
    uuid();

  const rootJointId =
    requiredString(
      input.rootJointId,
      "ik.rootJointId",
    );

  const endJointId =
    requiredString(
      input.endJointId,
      "ik.endJointId",
    );

  const iterations =
    input.iterations ??
    12;

  const tolerance =
    input.tolerance ??
    0.001;

  if (
    !Number.isInteger(
      iterations,
    ) ||
    iterations <= 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "IK iterations must be a positive integer.",
    );
  }

  positive(
    tolerance,
    "ik.tolerance",
  );

  return {
    chainId,

    name:
      requiredString(
        input.name,
        "ik.name",
      ),

    type:
      input.type,

    rootJointId,

    endJointId,

    ...(input.targetJointId
      ? {
          targetJointId:
            requiredString(
              input.targetJointId,
              "ik.targetJointId",
            ),
        }
      : {}),

    joints:
      input.joints
        ? [
            ...input.joints,
          ]
        : [],

    iterations,

    tolerance,

    enabled:
      input.enabled ??
      true,

    metadata:
      clone(
        input.metadata ??
          {},
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* IK Validation                                                              */
/* -------------------------------------------------------------------------- */

function validateIKChains(
  chains: readonly IKChain[],
  joints: readonly RigJoint[],
): void {
  const jointIds =
    new Set(
      joints.map(
        (
          joint,
        ) =>
          joint.jointId,
      ),
    );

  const chainIds =
    chains.map(
      (
        chain,
      ) =>
        chain.chainId,
    );

  if (
    new Set(chainIds).size !==
    chainIds.length
  ) {
    throw new CaeError(
      "ENTITY_DUPLICATE",
      "Rig contains duplicate IK chain IDs.",
    );
  }

  for (
    const chain of chains
  ) {
    if (
      !jointIds.has(
        chain.rootJointId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `IK root joint "${chain.rootJointId}" was not found.`,
      );
    }

    if (
      !jointIds.has(
        chain.endJointId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `IK end joint "${chain.endJointId}" was not found.`,
      );
    }

    if (
      chain.targetJointId &&
      !jointIds.has(
        chain.targetJointId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `IK target joint "${chain.targetJointId}" was not found.`,
      );
    }

    if (
      chain.joints.length > 0
    ) {
      for (
        const jointId of
          chain.joints
      ) {
        if (
          !jointIds.has(
            jointId,
          )
        ) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            `IK chain joint "${jointId}" was not found.`,
          );
        }
      }
    }

    if (
      chain.rootJointId ===
      chain.endJointId
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "IK root and end joint cannot be identical.",
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Rig Fingerprint                                                            */
/* -------------------------------------------------------------------------- */

export function fingerprintRig(
  rig: Omit<
    CharacterRig,
    "contentHash"
  >,
): string {
  return canonicalHash({
    rigId:
      rig.rigId,

    schemaVersion:
      rig.schemaVersion,

    characterAssemblyId:
      rig.characterAssemblyId,

    representation:
      rig.representation,

    rootJointId:
      rig.rootJointId,

    joints:
      rig.joints,

    ikChains:
      rig.ikChains,

    metadata:
      rig.metadata,

    createdBy:
      rig.createdBy,
  }) as string;
}

/* -------------------------------------------------------------------------- */
/* Rig Creation                                                               */
/* -------------------------------------------------------------------------- */

export function createCharacterRig(
  input: CharacterRigInput,
): CharacterRig {
  const characterAssemblyId =
    requiredString(
      input.characterAssemblyId,
      "characterAssemblyId",
    );

  const representation =
    input.representation;

  if (
    representation !== "2d" &&
    representation !== "3d" &&
    representation !== "hybrid"
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported rig representation: ${String(
        representation,
      )}.`,
    );
  }

  if (
    !Array.isArray(
      input.joints,
    ) ||
    input.joints.length ===
      0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Rig must contain at least one joint.",
    );
  }

  const joints =
    input.joints.map(
      createRigJoint,
    );

  const jointIds =
    joints.map(
      (
        joint,
      ) =>
        joint.jointId,
    );

  const duplicateIds =
    jointIds.filter(
      (
        id,
        index,
      ) =>
        jointIds.indexOf(id) !==
        index,
    );

  if (
    duplicateIds.length > 0
  ) {
    throw new CaeError(
      "ENTITY_DUPLICATE",
      "Rig contains duplicate joint IDs.",
      [
        ...new Set(
          duplicateIds,
        ),
      ],
    );
  }

  /*
   * Self-parenting must be detected before
   * root detection so the caller receives the
   * real validation error.
   */
  for (
    const joint of joints
  ) {
    if (
      joint.parentJointId ===
      joint.jointId
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        `Joint "${joint.jointId}" cannot parent itself.`,
        [joint.jointId],
      );
    }
  }

  validateHierarchy(
    joints,
  );

  const normalizedJoints =
    rebuildChildren(
      joints,
    );

  const rootCandidates =
    normalizedJoints.filter(
      (
        joint,
      ) =>
        !joint.parentJointId,
    );

  if (
    rootCandidates.length ===
    0
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      "Rig must contain a root joint.",
    );
  }

  if (
    rootCandidates.length > 1 &&
    !input.rootJointId
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      "Multiple root joints exist; rootJointId must be specified.",
    );
  }

  const rootJointId =
    input.rootJointId ??
    rootCandidates[0].jointId;

  const root =
    normalizedJoints.find(
      (
        joint,
      ) =>
        joint.jointId ===
        rootJointId,
    );

  if (!root) {
    throw new CaeError(
      "ENTITY_NOT_FOUND",
      `Root joint "${rootJointId}" was not found.`,
      [rootJointId],
    );
  }

  if (
    root.parentJointId
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      `Root joint "${rootJointId}" cannot have a parent.`,
      [rootJointId],
    );
  }

  const ikChains =
    (
      input.ikChains ??
      []
    ).map(
      createIKChain,
    );

  validateIKChains(
    ikChains,
    normalizedJoints,
  );

  const rigId =
    input.rigId ??
    uuid();

  const createdBy =
    input.createdBy ??
    "local";

  const withoutHash:
    Omit<
      CharacterRig,
      "contentHash"
    > = {
    rigId,

    schemaVersion:
      RIG_SCHEMA_VERSION,

    characterAssemblyId,

    representation,

    rootJointId,

    /*
     * Canonical hierarchy order is generated
     * independently of input ordering.
     */
    joints:
      topologicalJointOrder(
        normalizedJoints,
      ),

    ikChains: [
      ...ikChains,
    ].sort(
      (
        a,
        b,
      ) =>
        a.chainId.localeCompare(
          b.chainId,
        ),
    ),

    metadata:
      clone(
        input.metadata ??
          {},
      ),

    createdBy,
  };

  const contentHash =
    fingerprintRig(
      withoutHash,
    );

  return {
    ...withoutHash,

    contentHash,
  };
}

/* -------------------------------------------------------------------------- */
/* Rig Validation                                                             */
/* -------------------------------------------------------------------------- */

export function validateCharacterRig(
  input: unknown,
): CharacterRig {
  if (
    typeof input !==
      "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Character rig must be an object.",
    );
  }

  const value =
    input as Record<
      string,
      unknown
    >;

  const rig =
    createCharacterRig({
      rigId:
        requiredString(
          value.rigId,
          "rigId",
        ),

      characterAssemblyId:
        requiredString(
          value.characterAssemblyId,
          "characterAssemblyId",
        ),

      representation:
        value.representation as RigRepresentation,

      rootJointId:
        requiredString(
          value.rootJointId,
          "rootJointId",
        ),

      joints:
        value.joints as readonly RigJointInput[],

      ikChains:
        value.ikChains as
          | readonly IKChainInput[]
          | undefined,

      metadata:
        value.metadata as
          | Readonly<
              Record<string, unknown>
            >
          | undefined,

      createdBy:
        requiredString(
          value.createdBy,
          "createdBy",
        ),
    });

  if (
    rig.schemaVersion !==
    value.schemaVersion
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Rig schemaVersion does not match.",
    );
  }

  const contentHash =
    requiredString(
      value.contentHash,
      "contentHash",
    );

  if (
    contentHash !==
    rig.contentHash
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Rig contentHash does not match its canonical fingerprint.",
      [
        {
          expected:
            rig.contentHash,

          received:
            contentHash,
        },
      ],
    );
  }

  return clone(
    rig,
  );
}

/* -------------------------------------------------------------------------- */
/* Rig Catalog                                                                */
/* -------------------------------------------------------------------------- */

export class RigCatalog {
  private readonly rigs =
    new Map<
      string,
      CharacterRig
    >();

  register(
    rig: CharacterRig,
  ): CharacterRig {
    const validated =
      validateCharacterRig(
        rig,
      );

    const existing =
      this.rigs.get(
        validated.rigId,
      );

    if (existing) {
      if (
        existing.contentHash ===
        validated.contentHash
      ) {
        return clone(
          existing,
        );
      }

      throw new CaeError(
        "ENTITY_DUPLICATE",
        `Rig "${validated.rigId}" already exists with different content.`,
        [validated.rigId],
      );
    }

    this.rigs.set(
      validated.rigId,
      clone(
        validated,
      ),
    );

    return clone(
      validated,
    );
  }

  get(
    rigId: string,
  ):
    | CharacterRig
    | undefined {
    const id =
      requiredString(
        rigId,
        "rigId",
      );

    const rig =
      this.rigs.get(
        id,
      );

    return rig
      ? clone(rig)
      : undefined;
  }

  require(
    rigId: string,
  ): CharacterRig {
    const rig =
      this.get(
        rigId,
      );

    if (!rig) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Rig "${rigId}" was not found.`,
        [rigId],
      );
    }

    return rig;
  }

  list(
    characterAssemblyId?: string,
  ): CharacterRig[] {
    return clone(
      [
        ...this.rigs.values(),
      ]
        .filter(
          (
            rig,
          ) =>
            !characterAssemblyId ||
            rig.characterAssemblyId ===
              characterAssemblyId,
        )
        .sort(
          (
            a,
            b,
          ) =>
            a.rigId.localeCompare(
              b.rigId,
            ),
        ),
    );
  }

  getJoint(
    rigId: string,
    jointId: string,
  ):
    | RigJoint
    | undefined {
    const rig =
      this.get(
        rigId,
      );

    if (!rig) {
      return undefined;
    }

    return clone(
      rig.joints.find(
        (
          joint,
        ) =>
          joint.jointId ===
          jointId,
      ),
    );
  }

  requireJoint(
    rigId: string,
    jointId: string,
  ): RigJoint {
    const joint =
      this.getJoint(
        rigId,
        jointId,
      );

    if (!joint) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Joint "${jointId}" was not found.`,
        [jointId],
      );
    }

    return joint;
  }

  children(
    rigId: string,
    jointId: string,
  ): RigJoint[] {
    const rig =
      this.require(
        rigId,
      );

    return clone(
      sortJoints(
        rig.joints.filter(
          (
            joint,
          ) =>
            joint.parentJointId ===
            jointId,
        ),
      ),
    );
  }

  descendants(
    rigId: string,
    jointId: string,
  ): RigJoint[] {
    const rig =
      this.require(
        rigId,
      );

    const byId =
      new Map(
        rig.joints.map(
          (
            joint,
          ) => [
            joint.jointId,
            joint,
          ],
        ),
      );

    const result: RigJoint[] =
      [];

    const walk =
      (
        parentId: string,
      ): void => {
        const children =
          sortJoints(
            rig.joints.filter(
              (
                joint,
              ) =>
                joint.parentJointId ===
                parentId,
            ),
          );

        for (
          const child of
            children
        ) {
          result.push(
            child,
          );

          walk(
            child.jointId,
          );
        }
      };

    if (
      !byId.has(
        jointId,
      )
    ) {
      return [];
    }

    walk(
      jointId,
    );

    return clone(
      result,
    );
  }

  ikChains(
    rigId: string,
  ): IKChain[] {
    const rig =
      this.require(
        rigId,
      );

    return rig.ikChains.map(
      (
        chain,
      ) =>
        clone(
          chain,
        ),
    );
  }

  remove(
    rigId: string,
  ): boolean {
    return this.rigs.delete(
      requiredString(
        rigId,
        "rigId",
      ),
    );
  }

  stats() {
    const rigs =
      [
        ...this.rigs.values(),
      ];

    return {
      rigCount:
        rigs.length,

      jointCount:
        rigs.reduce(
          (
            total,
            rig,
          ) =>
            total +
            rig.joints.length,
          0,
        ),

      ikChainCount:
        rigs.reduce(
          (
            total,
            rig,
          ) =>
            total +
            rig.ikChains.length,
          0,
        ),
    };
  }

  clear(): void {
    this.rigs.clear();
  }
}

/* -------------------------------------------------------------------------- */
/* Assembly Compatibility                                                     */
/* -------------------------------------------------------------------------- */

export function validateRigAssemblyCompatibility(
  rig: CharacterRig,
  assembly: CharacterAssembly,
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] =
    [];

  if (
    rig.characterAssemblyId !==
    assembly.assemblyId
  ) {
    errors.push(
      "Rig characterAssemblyId does not match assembly assemblyId.",
    );
  }

  if (
    rig.representation !==
      assembly.representation &&
    !(
      rig.representation ===
        "hybrid" ||
      assembly.representation ===
        "hybrid"
    )
  ) {
    errors.push(
      "Rig and assembly representations are incompatible.",
    );
  }

  if (
    rig.joints.length ===
    0
  ) {
    errors.push(
      "Rig contains no joints.",
    );
  }

  if (
    !rig.joints.some(
      (
        joint,
      ) =>
        joint.jointId ===
        rig.rootJointId,
    )
  ) {
    errors.push(
      "Rig root joint does not exist.",
    );
  }

  return {
    valid:
      errors.length ===
      0,

    errors,
  };
}

/* -------------------------------------------------------------------------- */
/* Default Export                                                             */
/* -------------------------------------------------------------------------- */

export default RigCatalog;