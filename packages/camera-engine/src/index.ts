import { createHash } from "node:crypto";

import {
  Camera as CameraSchema,
} from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type CameraType =
  | "orthographic"
  | "perspective";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Camera {
  id: string;
  name: string;
  type: CameraType;
  position: Vec3;
  target: Vec3;
  zoom: number;
  fov: number;
}

export interface CameraLimits {
  minZoom?: number;
  maxZoom?: number;
  minFov?: number;
  maxFov?: number;
  minPosition?: Vec3;
  maxPosition?: Vec3;
}

export interface CameraFollowOptions {
  weight?: number;
  preserveZ?: boolean;
}

export interface CameraShakeOptions {
  amplitude?: number;
  frequency?: number;
  seed?: number;
}

export interface CameraEvaluation {
  position: Vec3;
  target: Vec3;
  zoom: number;
  fov: number;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_CAMERA_POSITION: Vec3 = {
  x: 0,
  y: 0,
  z: 10,
};

export const DEFAULT_CAMERA_TARGET: Vec3 = {
  x: 0,
  y: 0,
  z: 0,
};

export const DEFAULT_CAMERA_ZOOM = 1;

export const DEFAULT_CAMERA_FOV = 45;

export const MIN_CAMERA_ZOOM = 0.01;

export const MIN_CAMERA_FOV = 1;

export const MAX_CAMERA_FOV = 179;

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

function lerp(
  a: number,
  b: number,
  t: number,
): number {
  return a + (b - a) * t;
}

function lerpVec3(
  a: Vec3,
  b: Vec3,
  t: number,
): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function addVec3(
  a: Vec3,
  b: Vec3,
): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function subtractVec3(
  a: Vec3,
  b: Vec3,
): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function scaleVec3(
  value: Vec3,
  scalar: number,
): Vec3 {
  return {
    x: value.x * scalar,
    y: value.y * scalar,
    z: value.z * scalar,
  };
}

function lengthVec3(
  value: Vec3,
): number {
  return Math.hypot(
    value.x,
    value.y,
    value.z,
  );
}

function normalizeVec3(
  value: Vec3,
): Vec3 {
  const length =
    lengthVec3(value);

  if (
    length <=
    Number.EPSILON
  ) {
    return {
      x: 0,
      y: 0,
      z: 1,
    };
  }

  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
}

function sanitizeWeight(
  weight: number,
): number {
  if (!Number.isFinite(weight)) {
    throw new Error(
      "Camera interpolation weight must be finite.",
    );
  }

  return clamp(
    weight,
    0,
    1,
  );
}

/* -------------------------------------------------------------------------- */
/* Deterministic Hashing                                                      */
/* -------------------------------------------------------------------------- */

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
/* Deterministic Noise                                                        */
/* -------------------------------------------------------------------------- */

function deterministicNoise(
  seed: number,
): number {
  const input =
    createHash("sha256")
      .update(String(seed))
      .digest("hex")
      .slice(0, 8);

  const integer =
    Number.parseInt(
      input,
      16,
    );

  return (
    integer /
      0xffffffff *
      2 -
    1
  );
}

/* -------------------------------------------------------------------------- */
/* Camera Engine                                                              */
/* -------------------------------------------------------------------------- */

export class CameraEngine {
  /* ------------------------------------------------------------------------ */
  /* Create                                                                   */
  /* ------------------------------------------------------------------------ */

  create(
    name = "Main Camera",
    type: CameraType = "orthographic",
  ): Camera {
    if (
      name.trim().length === 0
    ) {
      throw new Error(
        "Camera name must not be empty.",
      );
    }

    const camera: Camera = {
      id: crypto.randomUUID(),
      name,
      type,
      position: {
        ...DEFAULT_CAMERA_POSITION,
      },
      target: {
        ...DEFAULT_CAMERA_TARGET,
      },
      zoom:
        DEFAULT_CAMERA_ZOOM,
      fov:
        DEFAULT_CAMERA_FOV,
    };

    return this.validate(
      camera,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validate(
    camera: Camera,
  ): Camera {
    const parsed =
      CameraSchema.safeParse(
        camera,
      );

    if (!parsed.success) {
      throw new Error(
        `Invalid camera: ${parsed.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; ")}`,
      );
    }

    if (
      camera.name.trim().length === 0
    ) {
      throw new Error(
        "Camera name must not be empty.",
      );
    }

    if (
      !Number.isFinite(
        camera.zoom,
      ) ||
      camera.zoom <= 0
    ) {
      throw new Error(
        "Camera zoom must be a positive finite number.",
      );
    }

    if (
      !Number.isFinite(
        camera.fov,
      ) ||
      camera.fov <= 0 ||
      camera.fov >= 180
    ) {
      throw new Error(
        "Camera FOV must be between 0 and 180 degrees.",
      );
    }

    return structuredClone(
      camera,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Position                                                                 */
  /* ------------------------------------------------------------------------ */

  setPosition(
    camera: Camera,
    position: Vec3,
  ): Camera {
    this.assertVec3(
      position,
      "Camera position",
    );

    return this.validate({
      ...camera,
      position: {
        ...position,
      },
    });
  }

  move(
    camera: Camera,
    delta: Vec3,
  ): Camera {
    this.assertVec3(
      delta,
      "Camera movement",
    );

    return this.setPosition(
      camera,
      addVec3(
        camera.position,
        delta,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Target / Look At                                                          */
  /* ------------------------------------------------------------------------ */

  lookAt(
    camera: Camera,
    target: Vec3,
  ): Camera {
    this.assertVec3(
      target,
      "Camera target",
    );

    return this.validate({
      ...camera,
      target: {
        ...target,
      },
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Zoom                                                                     */
  /* ------------------------------------------------------------------------ */

  setZoom(
    camera: Camera,
    zoom: number,
  ): Camera {
    if (
      !Number.isFinite(zoom) ||
      zoom <= 0
    ) {
      throw new Error(
        "Camera zoom must be a positive finite number.",
      );
    }

    return this.validate({
      ...camera,
      zoom,
    });
  }

  zoomBy(
    camera: Camera,
    amount: number,
  ): Camera {
    if (
      !Number.isFinite(amount)
    ) {
      throw new Error(
        "Camera zoom amount must be finite.",
      );
    }

    return this.setZoom(
      camera,
      Math.max(
        MIN_CAMERA_ZOOM,
        camera.zoom + amount,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Field of View                                                            */
  /* ------------------------------------------------------------------------ */

  setFov(
    camera: Camera,
    fov: number,
  ): Camera {
    if (
      !Number.isFinite(fov) ||
      fov <= 0 ||
      fov >= 180
    ) {
      throw new Error(
        "Camera FOV must be between 0 and 180 degrees.",
      );
    }

    return this.validate({
      ...camera,
      fov,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Pan                                                                      */
  /* ------------------------------------------------------------------------ */

  pan(
    camera: Camera,
    dx: number,
    dy: number,
  ): Camera {
    if (
      !Number.isFinite(dx) ||
      !Number.isFinite(dy)
    ) {
      throw new Error(
        "Camera pan values must be finite.",
      );
    }

    return this.validate({
      ...camera,
      position: {
        ...camera.position,
        x:
          camera.position.x +
          dx,
        y:
          camera.position.y +
          dy,
      },
      target: {
        ...camera.target,
        x:
          camera.target.x +
          dx,
        y:
          camera.target.y +
          dy,
      },
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Dolly                                                                    */
  /* ------------------------------------------------------------------------ */

  dolly(
    camera: Camera,
    distance: number,
  ): Camera {
    if (
      !Number.isFinite(distance)
    ) {
      throw new Error(
        "Camera dolly distance must be finite.",
      );
    }

    const direction =
      normalizeVec3(
        subtractVec3(
          camera.target,
          camera.position,
        ),
      );

    return this.move(
      camera,
      scaleVec3(
        direction,
        distance,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Follow                                                                   */
  /* ------------------------------------------------------------------------ */

  follow(
    camera: Camera,
    target: Vec3,
    weight = 1,
    options: CameraFollowOptions = {},
  ): Camera {
    this.assertVec3(
      target,
      "Follow target",
    );

    const normalizedWeight =
      sanitizeWeight(
        weight,
      );

    const nextPosition =
      lerpVec3(
        camera.position,
        target,
        normalizedWeight,
      );

    const position: Vec3 = {
      x: nextPosition.x,
      y: nextPosition.y,
      z:
        options.preserveZ === false
          ? nextPosition.z
          : camera.position.z,
    };

    return this.validate({
      ...camera,
      position,
      target: {
        ...target,
      },
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Smooth Transition                                                        */
  /* ------------------------------------------------------------------------ */

  interpolate(
    from: Camera,
    to: Camera,
    weight: number,
  ): Camera {
    const t =
      sanitizeWeight(
        weight,
      );

    if (
      from.type !==
      to.type
    ) {
      throw new Error(
        "Cannot interpolate cameras with different camera types.",
      );
    }

    return this.validate({
      ...to,
      position:
        lerpVec3(
          from.position,
          to.position,
          t,
        ),
      target:
        lerpVec3(
          from.target,
          to.target,
          t,
        ),
      zoom:
        lerp(
          from.zoom,
          to.zoom,
          t,
        ),
      fov:
        lerp(
          from.fov,
          to.fov,
          t,
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Presets                                                                   */
  /* ------------------------------------------------------------------------ */

  closeUp(
    camera: Camera,
    target: Vec3,
  ): Camera {
    return this.validate({
      ...camera,
      target: {
        ...target,
      },
      zoom: 2.2,
    });
  }

  mediumShot(
    camera: Camera,
    target: Vec3,
  ): Camera {
    return this.validate({
      ...camera,
      target: {
        ...target,
      },
      zoom: 1.35,
    });
  }

  wide(
    camera: Camera,
  ): Camera {
    return this.validate({
      ...camera,
      zoom: 0.8,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Camera Shake                                                              */
  /* ------------------------------------------------------------------------ */

  shake(
    camera: Camera,
    tick: number,
    options: CameraShakeOptions = {},
  ): Camera {
    if (
      !Number.isFinite(tick)
    ) {
      throw new Error(
        "Camera shake tick must be finite.",
      );
    }

    const amplitude =
      options.amplitude ??
      0.05;

    const frequency =
      options.frequency ??
      1;

    const seed =
      options.seed ??
      0;

    if (
      !Number.isFinite(
        amplitude,
      ) ||
      amplitude < 0
    ) {
      throw new Error(
        "Camera shake amplitude must be a non-negative finite number.",
      );
    }

    if (
      !Number.isFinite(
        frequency,
      ) ||
      frequency < 0
    ) {
      throw new Error(
        "Camera shake frequency must be a non-negative finite number.",
      );
    }

    const phase =
      Math.floor(
        tick *
          frequency,
      );

    const noiseX =
      deterministicNoise(
        seed +
          phase *
            3 +
          1,
      );

    const noiseY =
      deterministicNoise(
        seed +
          phase *
            3 +
          2,
      );

    const noiseZ =
      deterministicNoise(
        seed +
          phase *
            3 +
          3,
      );

    return this.validate({
      ...camera,
      position: {
        x:
          camera.position.x +
          noiseX *
            amplitude,

        y:
          camera.position.y +
          noiseY *
            amplitude,

        z:
          camera.position.z +
          noiseZ *
            amplitude,
      },
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Limits                                                                   */
  /* ------------------------------------------------------------------------ */

  applyLimits(
    camera: Camera,
    limits: CameraLimits,
  ): Camera {
    let position =
      structuredClone(
        camera.position,
      );

    let zoom =
      camera.zoom;

    let fov =
      camera.fov;

    if (
      limits.minPosition &&
      limits.maxPosition
    ) {
      position = {
        x: clamp(
          position.x,
          limits.minPosition.x,
          limits.maxPosition.x,
        ),
        y: clamp(
          position.y,
          limits.minPosition.y,
          limits.maxPosition.y,
        ),
        z: clamp(
          position.z,
          limits.minPosition.z,
          limits.maxPosition.z,
        ),
      };
    }

    if (
      limits.minZoom !==
      undefined
    ) {
      zoom =
        Math.max(
          limits.minZoom,
          zoom,
        );
    }

    if (
      limits.maxZoom !==
      undefined
    ) {
      zoom =
        Math.min(
          limits.maxZoom,
          zoom,
        );
    }

    if (
      limits.minFov !==
      undefined
    ) {
      fov =
        Math.max(
          limits.minFov,
          fov,
        );
    }

    if (
      limits.maxFov !==
      undefined
    ) {
      fov =
        Math.min(
          limits.maxFov,
          fov,
        );
    }

    return this.validate({
      ...camera,
      position,
      zoom,
      fov,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Evaluate                                                                  */
  /* ------------------------------------------------------------------------ */

  evaluate(
    camera: Camera,
  ): CameraEvaluation {
    const validated =
      this.validate(
        camera,
      );

    return {
      position: {
        ...validated.position,
      },
      target: {
        ...validated.target,
      },
      zoom:
        validated.zoom,
      fov:
        validated.fov,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Clone                                                                     */
  /* ------------------------------------------------------------------------ */

  clone(
    camera: Camera,
  ): Camera {
    return structuredClone(
      camera,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                               */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    camera: Camera,
  ): string {
    const validated =
      this.validate(
        camera,
      );

    return createHash(
      "sha256",
    )
      .update(
        canonicalize(
          validated,
        ),
      )
      .digest("hex");
  }

  /* ------------------------------------------------------------------------ */
  /* Internal Validation                                                      */
  /* ------------------------------------------------------------------------ */

  private assertVec3(
    value: Vec3,
    label: string,
  ): void {
    if (
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y) ||
      !Number.isFinite(value.z)
    ) {
      throw new Error(
        `${label} must contain finite x, y and z values.`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Contract Type                                                              */
/* -------------------------------------------------------------------------- */

export type CanonicalCamera =
  import("zod").infer<
    typeof CameraSchema
  >;