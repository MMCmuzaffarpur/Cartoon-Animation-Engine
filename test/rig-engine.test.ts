import {
  describe,
  expect,
  it,
} from "vitest";

import {
  HUMANOID_RIG_ID_2D,
  HUMANOID_RIG_ID_3D,
  RigEngine,
} from "../packages/rig-engine/src/index.js";

describe("Rig Engine", () => {
  const engine =
    new RigEngine();

  /* ---------------------------------------------------------------------- */
  /* Humanoid Creation                                                      */
  /* ---------------------------------------------------------------------- */

  it("creates a valid deterministic 2D humanoid rig", () => {
    const rig =
      engine.createHumanoid("2d");

    expect(rig.id).toBe(
      HUMANOID_RIG_ID_2D,
    );

    expect(rig.dimension).toBe(
      "2d",
    );

    expect(rig.name).toBe(
      "Humanoid 2D",
    );

    expect(rig.joints.length).toBe(
      18,
    );

    expect(rig.controls.length).toBeGreaterThan(
      0,
    );

    expect(rig.constraints.length).toBeGreaterThan(
      0,
    );
  });

  it("creates a valid deterministic 3D humanoid rig", () => {
    const rig =
      engine.createHumanoid("3d");

    expect(rig.id).toBe(
      HUMANOID_RIG_ID_3D,
    );

    expect(rig.dimension).toBe(
      "3d",
    );

    expect(rig.name).toBe(
      "Humanoid 3D",
    );

    expect(rig.joints.length).toBe(
      18,
    );
  });

  it("creates identical rigs deterministically", () => {
    const first =
      engine.createHumanoid("2d");

    const second =
      engine.createHumanoid("2d");

    expect(first).toEqual(
      second,
    );

    expect(
      engine.fingerprint(first),
    ).toBe(
      engine.fingerprint(second),
    );
  });

  it("creates different identities for 2D and 3D rigs", () => {
    const rig2d =
      engine.createHumanoid("2d");

    const rig3d =
      engine.createHumanoid("3d");

    expect(rig2d.id).not.toBe(
      rig3d.id,
    );

    expect(rig2d.dimension).not.toBe(
      rig3d.dimension,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Skeleton Hierarchy                                                      */
  /* ---------------------------------------------------------------------- */

  it("creates the correct humanoid hierarchy", () => {
    const rig =
      engine.createHumanoid("2d");

    const jointMap =
      new Map(
        rig.joints.map(
          (joint) => [
            joint.id,
            joint,
          ],
        ),
      );

    expect(
      jointMap.get("root")?.parentId,
    ).toBeNull();

    expect(
      jointMap.get("pelvis")?.parentId,
    ).toBe("root");

    expect(
      jointMap.get("spine")?.parentId,
    ).toBe("pelvis");

    expect(
      jointMap.get("chest")?.parentId,
    ).toBe("spine");

    expect(
      jointMap.get("neck")?.parentId,
    ).toBe("chest");

    expect(
      jointMap.get("head")?.parentId,
    ).toBe("neck");

    expect(
      jointMap.get("upper_arm.L")?.parentId,
    ).toBe("chest");

    expect(
      jointMap.get("lower_arm.L")?.parentId,
    ).toBe("upper_arm.L");

    expect(
      jointMap.get("hand.L")?.parentId,
    ).toBe("lower_arm.L");

    expect(
      jointMap.get("upper_arm.R")?.parentId,
    ).toBe("chest");

    expect(
      jointMap.get("lower_arm.R")?.parentId,
    ).toBe("upper_arm.R");

    expect(
      jointMap.get("hand.R")?.parentId,
    ).toBe("lower_arm.R");

    expect(
      jointMap.get("upper_leg.L")?.parentId,
    ).toBe("pelvis");

    expect(
      jointMap.get("lower_leg.L")?.parentId,
    ).toBe("upper_leg.L");

    expect(
      jointMap.get("foot.L")?.parentId,
    ).toBe("lower_leg.L");

    expect(
      jointMap.get("upper_leg.R")?.parentId,
    ).toBe("pelvis");

    expect(
      jointMap.get("lower_leg.R")?.parentId,
    ).toBe("upper_leg.R");

    expect(
      jointMap.get("foot.R")?.parentId,
    ).toBe("lower_leg.R");
  });

  /* ---------------------------------------------------------------------- */
  /* Controls                                                                */
  /* ---------------------------------------------------------------------- */

  it("creates required humanoid controls", () => {
    const rig =
      engine.createHumanoid("2d");

    const controlIds =
      new Set(
        rig.controls.map(
          (control) =>
            control.id,
        ),
      );

    expect(
      controlIds.has(
        "root-control",
      ),
    ).toBe(true);

    expect(
      controlIds.has(
        "head-control",
      ),
    ).toBe(true);

    expect(
      controlIds.has(
        "hand.L-ik",
      ),
    ).toBe(true);

    expect(
      controlIds.has(
        "hand.R-ik",
      ),
    ).toBe(true);

    expect(
      controlIds.has(
        "foot.L-ik",
      ),
    ).toBe(true);

    expect(
      controlIds.has(
        "foot.R-ik",
      ),
    ).toBe(true);
  });

  it("applies a control immutably", () => {
    const rig =
      engine.createHumanoid("2d");

    const result =
      engine.applyControl(
        rig,
        "root-control",
        0.75,
      );

    expect(result).not.toBe(
      rig,
    );

    expect(
      rig.constraints.some(
        (constraint) =>
          constraint.type ===
          "control_value",
      ),
    ).toBe(false);

    expect(
      result.constraints.some(
        (constraint) =>
          constraint.type ===
          "control_value",
      ),
    ).toBe(true);
  });

  it("clamps control values to the canonical range", () => {
    const rig =
      engine.createHumanoid("2d");

    const result =
      engine.applyControl(
        rig,
        "root-control",
        100,
      );

    const controlValue =
      result.constraints.find(
        (constraint) =>
          constraint.type ===
          "control_value",
      ) as
        | {
            type: string;
            controlId: string;
            value: number;
          }
        | undefined;

    expect(
      controlValue?.value,
    ).toBe(1);
  });

  it("rejects an unknown control", () => {
    const rig =
      engine.createHumanoid("2d");

    expect(() =>
      engine.applyControl(
        rig,
        "does-not-exist",
        0.5,
      ),
    ).toThrow();
  });

  /* ---------------------------------------------------------------------- */
  /* Validation                                                              */
  /* ---------------------------------------------------------------------- */

  it("validates a correct rig", () => {
    const rig =
      engine.createHumanoid("2d");

    const result =
      engine.validateRig(rig);

    expect(result.valid).toBe(
      true,
    );

    expect(result.errors).toEqual(
      [],
    );
  });

  it("rejects duplicate joints", () => {
    const rig =
      engine.createHumanoid("2d");

    const broken = {
      ...rig,
      joints: [
        ...rig.joints,
        {
          ...rig.joints[0],
        },
      ],
    };

    const result =
      engine.validateRig(
        broken,
      );

    expect(result.valid).toBe(
      false,
    );

    expect(
      result.errors.some(
        (error) =>
          error.includes(
            "Duplicate joint id",
          ),
      ),
    ).toBe(true);
  });

  it("rejects a missing parent", () => {
    const rig =
      engine.createHumanoid("2d");

    const broken = {
      ...rig,
      joints:
        rig.joints.map(
          (joint) =>
            joint.id ===
            "pelvis"
              ? {
                  ...joint,
                  parentId:
                    "missing-parent",
                }
              : joint,
        ),
    };

    const result =
      engine.validateRig(
        broken,
      );

    expect(result.valid).toBe(
      false,
    );
  });

  it("rejects hierarchy cycles", () => {
    const rig =
      engine.createHumanoid("2d");

    const broken = {
      ...rig,
      joints:
        rig.joints.map(
          (joint) =>
            joint.id ===
            "root"
              ? {
                  ...joint,
                  parentId:
                    "pelvis",
                }
              : joint,
        ),
    };

    const result =
      engine.validateRig(
        broken,
      );

    expect(result.valid).toBe(
      false,
    );

    expect(
      result.errors.some(
        (error) =>
          error.includes(
            "cycle",
          ),
      ),
    ).toBe(true);
  });

  /* ---------------------------------------------------------------------- */
  /* 2D IK                                                                    */
  /* ---------------------------------------------------------------------- */

  it("solves a reachable 2D two-bone IK target", () => {
    const result =
      engine.solveTwoBoneIK2D(
        {
          x: 0,
          y: 0,
        },
        {
          x: 1,
          y: 0,
        },
        {
          x: 2,
          y: 0,
        },
        {
          x: 1,
          y: 1,
        },
      );

    expect(result.reachable).toBe(
      true,
    );

    expect(
      result.targetDistance,
    ).toBeCloseTo(
      Math.sqrt(2),
      6,
    );

    expect(
      Number.isFinite(
        result.rootRotation,
      ),
    ).toBe(true);

    expect(
      Number.isFinite(
        result.midRotation,
      ),
    ).toBe(true);
  });

  it("clamps an unreachable 2D IK target", () => {
    const result =
      engine.solveTwoBoneIK2D(
        {
          x: 0,
          y: 0,
        },
        {
          x: 1,
          y: 0,
        },
        {
          x: 2,
          y: 0,
        },
        {
          x: 10,
          y: 0,
        },
      );

    expect(result.reachable).toBe(
      false,
    );

    expect(
      result.clampedDistance,
    ).toBeLessThan(2);
  });

  it("rejects zero-length 2D IK bones", () => {
    expect(() =>
      engine.solveTwoBoneIK2D(
        {
          x: 0,
          y: 0,
        },
        {
          x: 0,
          y: 0,
        },
        {
          x: 1,
          y: 0,
        },
        {
          x: 1,
          y: 1,
        },
      ),
    ).toThrow();
  });

  /* ---------------------------------------------------------------------- */
  /* 3D IK                                                                    */
  /* ---------------------------------------------------------------------- */

  it("solves a reachable 3D two-bone IK target", () => {
    const result =
      engine.solveTwoBoneIK3D(
        {
          x: 0,
          y: 0,
          z: 0,
        },
        {
          x: 1,
          y: 0,
          z: 0,
        },
        {
          x: 2,
          y: 0,
          z: 0,
        },
        {
          x: 1,
          y: 1,
          z: 0,
        },
      );

    expect(result.reachable).toBe(
      true,
    );

    expect(
      result.midPosition.x,
    ).toBeCloseTo(
      1,
      5,
    );

    expect(
      result.midPosition.y,
    ).toBeGreaterThan(0);
  });

  it("clamps an unreachable 3D IK target", () => {
    const result =
      engine.solveTwoBoneIK3D(
        {
          x: 0,
          y: 0,
          z: 0,
        },
        {
          x: 1,
          y: 0,
          z: 0,
        },
        {
          x: 2,
          y: 0,
          z: 0,
        },
        {
          x: 10,
          y: 0,
          z: 0,
        },
      );

    expect(result.reachable).toBe(
      false,
    );

    expect(
      result.clampedDistance,
    ).toBeLessThan(2);
  });

  /* ---------------------------------------------------------------------- */
  /* Fingerprint                                                              */
  /* ---------------------------------------------------------------------- */

  it("produces a stable fingerprint", () => {
    const rig =
      engine.createHumanoid("2d");

    const first =
      engine.fingerprint(rig);

    const second =
      engine.fingerprint(
        structuredClone(
          rig,
        ),
      );

    expect(first).toBe(
      second,
    );

    expect(first.length).toBeGreaterThan(
      0,
    );
  });

  it("changes the fingerprint when rig state changes", () => {
    const rig =
      engine.createHumanoid("2d");

    const changed =
      engine.applyControl(
        rig,
        "root-control",
        0.5,
      );

    expect(
      engine.fingerprint(changed),
    ).not.toBe(
      engine.fingerprint(rig),
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Contract Safety                                                         */
  /* ---------------------------------------------------------------------- */

  it("does not expose mutable references from validation", () => {
    const rig =
      engine.createHumanoid("2d");

    const validated =
      engine.validate(rig);

    validated.joints[0].rest.x =
      999;

    expect(
      rig.joints[0].rest.x,
    ).toBe(0);
  });
});