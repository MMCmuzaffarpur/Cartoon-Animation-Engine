import { createHash } from "node:crypto";
import { z } from "zod";

import {
  Expression as ExpressionSchema,
  FacialControl as FacialControlSchema,
} from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type FacialValue = number;

export interface FacialControl {
  name: string;
  value: FacialValue;
}

export interface Expression {
  id: string;
  name: string;
  controls: FacialControl[];
}

export interface FacialPose {
  controls: Record<string, number>;
}

export interface FacialTrack {
  id: string;
  name: string;
  startTick: number;
  endTick: number;
  controls: Record<string, number>;
}

export interface GazeState {
  x: number;
  y: number;
}

export interface BlinkState {
  blink: number;
}

export interface FacialValidationResult {
  valid: boolean;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_FACIAL_CONTROLS = [
  "smile",
  "browRaise",
  "browFurrow",
  "mouthOpen",
  "eyeSquint",
  "blink",
  "jawOpen",
  "jawLeft",
  "jawRight",
  "eyeGazeX",
  "eyeGazeY",
  "cheekRaise",
  "noseWrinkle",
  "lipPucker",
  "lipFunnel",
  "mouthWide",
  "mouthNarrow",
  "upperLipRaise",
  "lowerLipDepress",
] as const;

export const DEFAULT_EXPRESSIONS: Record<
  string,
  Record<string, number>
> = {
  neutral: {
    smile: 0,
    browRaise: 0,
    browFurrow: 0,
    mouthOpen: 0,
    eyeSquint: 0,
    blink: 0,
    jawOpen: 0,
    cheekRaise: 0,
    noseWrinkle: 0,
  },

  happy: {
    smile: 1,
    browRaise: 0.15,
    browFurrow: 0,
    mouthOpen: 0.25,
    eyeSquint: 0.2,
    blink: 0,
    jawOpen: 0.15,
    cheekRaise: 0.8,
    noseWrinkle: 0,
  },

  angry: {
    smile: -0.4,
    browRaise: -0.2,
    browFurrow: 1,
    mouthOpen: 0.1,
    eyeSquint: 0.35,
    blink: 0,
    jawOpen: 0.1,
    cheekRaise: 0,
    noseWrinkle: 0.3,
  },

  sad: {
    smile: -0.7,
    browRaise: -0.2,
    browFurrow: 0.25,
    mouthOpen: 0.1,
    eyeSquint: 0,
    blink: 0,
    jawOpen: 0.05,
    cheekRaise: 0,
    noseWrinkle: 0,
  },

  surprised: {
    smile: 0,
    browRaise: 1,
    browFurrow: 0,
    mouthOpen: 1,
    eyeSquint: -0.2,
    blink: 0,
    jawOpen: 0.9,
    cheekRaise: 0,
    noseWrinkle: 0,
  },

  fearful: {
    smile: -0.2,
    browRaise: 0.7,
    browFurrow: 0.1,
    mouthOpen: 0.5,
    eyeSquint: -0.1,
    blink: 0,
    jawOpen: 0.45,
    cheekRaise: 0,
    noseWrinkle: 0.1,
  },

  disgusted: {
    smile: -0.35,
    browRaise: -0.1,
    browFurrow: 0.4,
    mouthOpen: 0.15,
    eyeSquint: 0.4,
    blink: 0,
    jawOpen: 0.1,
    cheekRaise: 0.25,
    noseWrinkle: 0.9,
  },
};

/* -------------------------------------------------------------------------- */
/* Math                                                                       */
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

function smoothstep(
  t: number,
): number {
  const x = clamp(t, 0, 1);

  return (
    x *
    x *
    (3 - 2 * x)
  );
}

/* -------------------------------------------------------------------------- */
/* Deterministic Identity                                                     */
/* -------------------------------------------------------------------------- */

function deterministicUuid(
  input: string,
): string {
  const digest = createHash("sha256")
    .update(input)
    .digest("hex");

  const bytes = digest.slice(0, 32);

  return (
    `${bytes.slice(0, 8)}-` +
    `${bytes.slice(8, 12)}-` +
    `5${bytes.slice(13, 16)}-` +
    `${(
      (parseInt(
        bytes.slice(16, 18),
        16,
      ) &
        0x3f) |
      0x80
    )
      .toString(16)
      .padStart(2, "0")}` +
    `${bytes.slice(18, 20)}-` +
    `${bytes.slice(20, 32)}`
  );
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
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

function normalizeControls(
  controls: Record<string, number>,
): Record<string, number> {
  const output: Record<string, number> = {};

  for (const [
    name,
    value,
  ] of Object.entries(controls)) {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Facial control "${name}" must be finite.`,
      );
    }

    output[name] = clamp(
      value,
      -1,
      1,
    );
  }

  return output;
}

function controlsToArray(
  controls: Record<string, number>,
): FacialControl[] {
  return Object.entries(
    normalizeControls(controls),
  )
    .sort(([a], [b]) =>
      a.localeCompare(b),
    )
    .map(
      ([name, value]) => ({
        name,
        value,
      }),
    );
}

function controlsFromArray(
  controls: FacialControl[],
): Record<string, number> {
  const output: Record<string, number> = {};

  for (const control of controls) {
    if (!control.name.trim()) {
      throw new Error(
        "Facial control name must not be empty.",
      );
    }

    if (!Number.isFinite(control.value)) {
      throw new Error(
        `Facial control "${control.name}" must be finite.`,
      );
    }

    output[control.name] = clamp(
      control.value,
      -1,
      1,
    );
  }

  return output;
}

/* -------------------------------------------------------------------------- */
/* Facial Engine                                                              */
/* -------------------------------------------------------------------------- */

export class FacialEngine {
  /* ------------------------------------------------------------------------ */
  /* Expression                                                               */
  /* ------------------------------------------------------------------------ */

  expression(
    name: string,
    weight = 1,
  ): Record<string, number> {
    if (!Number.isFinite(weight)) {
      throw new Error(
        "Expression weight must be finite.",
      );
    }

    const normalizedName =
      name.trim().toLowerCase();

    const base =
      DEFAULT_EXPRESSIONS[
        normalizedName
      ] ??
      DEFAULT_EXPRESSIONS.neutral;

    const normalizedWeight =
      clamp(
        weight,
        0,
        1,
      );

    return normalizeControls(
      Object.fromEntries(
        Object.entries(base).map(
          ([key, value]) => [
            key,
            value *
              normalizedWeight,
          ],
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Canonical Expression Creation                                           */
  /* ------------------------------------------------------------------------ */

  createExpression(
    name: string,
    controls: Record<string, number>,
    deterministicKey?: string,
  ): Expression {
    const normalizedName =
      name.trim();

    if (!normalizedName) {
      throw new Error(
        "Expression name must not be empty.",
      );
    }

    const normalizedControls =
      normalizeControls(
        controls,
      );

    const identity =
      canonicalize({
        name: normalizedName,
        controls:
          normalizedControls,
        deterministicKey:
          deterministicKey ?? null,
      });

    const expression: Expression = {
      id: deterministicUuid(
        `expression:${identity}`,
      ),
      name: normalizedName,
      controls:
        controlsToArray(
          normalizedControls,
        ),
    };

    return this.validateExpression(
      expression,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Built-in Expression                                                      */
  /* ------------------------------------------------------------------------ */

  createBuiltInExpression(
    name: string,
    weight = 1,
  ): Expression {
    return this.createExpression(
      name,
      this.expression(
        name,
        weight,
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Expression Validation                                                    */
  /* ------------------------------------------------------------------------ */

  validateExpression(
    expression: Expression,
  ): Expression {
    const result =
      this.validateExpressionResult(
        expression,
      );

    if (!result.valid) {
      throw new Error(
        `Invalid expression: ${result.errors.join("; ")}`,
      );
    }

    return structuredClone(
      expression,
    );
  }

  validateExpressionResult(
    expression: Expression,
  ): FacialValidationResult {
    const errors: string[] = [];

    const parsed =
      ExpressionSchema.safeParse(
        expression,
      );

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

    const names = new Set<string>();

    for (const control of expression.controls) {
      if (names.has(control.name)) {
        errors.push(
          `Duplicate facial control: ${control.name}`,
        );
      }

      names.add(control.name);

      if (!Number.isFinite(control.value)) {
        errors.push(
          `Facial control ${control.name} must be finite.`,
        );
      }

      if (
        control.value < -1 ||
        control.value > 1
      ) {
        errors.push(
          `Facial control ${control.name} must be between -1 and 1.`,
        );
      }
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Blend                                                                     */
  /* ------------------------------------------------------------------------ */

  blend(
    ...controls: Record<string, number>[]
  ): Record<string, number> {
    const output: Record<string, number> = {};

    for (const controlSet of controls) {
      const normalized =
        normalizeControls(
          controlSet,
        );

      for (const [
        name,
        value,
      ] of Object.entries(normalized)) {
        output[name] =
          (output[name] ?? 0) +
          value;
      }
    }

    return normalizeControls(
      output,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Weighted Blend                                                           */
  /* ------------------------------------------------------------------------ */

  blendWeighted(
    layers: Array<{
      controls: Record<string, number>;
      weight: number;
    }>,
  ): Record<string, number> {
    const output: Record<string, number> = {};

    for (const layer of layers) {
      if (!Number.isFinite(layer.weight)) {
        throw new Error(
          "Facial layer weight must be finite.",
        );
      }

      const weight =
        clamp(
          layer.weight,
          0,
          1,
        );

      const normalized =
        normalizeControls(
          layer.controls,
        );

      for (const [
        name,
        value,
      ] of Object.entries(normalized)) {
        output[name] =
          (output[name] ?? 0) +
          value *
            weight;
      }
    }

    return normalizeControls(
      output,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Interpolation                                                             */
  /* ------------------------------------------------------------------------ */

  interpolate(
    from: Record<string, number>,
    to: Record<string, number>,
    amount: number,
  ): Record<string, number> {
    if (!Number.isFinite(amount)) {
      throw new Error(
        "Facial interpolation amount must be finite.",
      );
    }

    const t = clamp(
      amount,
      0,
      1,
    );

    const names = new Set([
      ...Object.keys(from),
      ...Object.keys(to),
    ]);

    const output: Record<string, number> = {};

    for (const name of names) {
      output[name] = lerp(
        from[name] ?? 0,
        to[name] ?? 0,
        t,
      );
    }

    return normalizeControls(
      output,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Smooth Interpolation                                                     */
  /* ------------------------------------------------------------------------ */

  smoothInterpolate(
    from: Record<string, number>,
    to: Record<string, number>,
    amount: number,
  ): Record<string, number> {
    const t = smoothstep(
      clamp(
        amount,
        0,
        1,
      ),
    );

    return this.interpolate(
      from,
      to,
      t,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Gaze                                                                      */
  /* ------------------------------------------------------------------------ */

  gaze(
    x: number,
    y: number,
  ): GazeState & Record<string, number> {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      throw new Error(
        "Gaze coordinates must be finite.",
      );
    }

    const normalizedX =
      clamp(x, -1, 1);

    const normalizedY =
      clamp(y, -1, 1);

    return {
      x: normalizedX,
      y: normalizedY,
      eyeGazeX: normalizedX,
      eyeGazeY: normalizedY,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Blink                                                                     */
  /* ------------------------------------------------------------------------ */

  blink(
    opening: number,
  ): BlinkState & Record<string, number> {
    if (!Number.isFinite(opening)) {
      throw new Error(
        "Blink opening must be finite.",
      );
    }

    const value =
      clamp(
        opening,
        0,
        1,
      );

    return {
      blink: value,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Viseme                                                                    */
  /* ------------------------------------------------------------------------ */

  viseme(
    name: string,
    weight = 1,
  ): Record<string, number> {
    const normalizedName =
      name.trim().toLowerCase();

    if (!normalizedName) {
      throw new Error(
        "Viseme name must not be empty.",
      );
    }

    if (!Number.isFinite(weight)) {
      throw new Error(
        "Viseme weight must be finite.",
      );
    }

    return {
      [`viseme.${normalizedName}`]:
        clamp(
          weight,
          0,
          1,
        ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Track                                                                     */
  /* ------------------------------------------------------------------------ */

  track(
    name: string,
    startTick: number,
    endTick: number,
    controls: Record<string, number>,
  ): FacialTrack {
    const normalizedName =
      name.trim();

    if (!normalizedName) {
      throw new Error(
        "Facial track name must not be empty.",
      );
    }

    if (
      !Number.isInteger(startTick) ||
      !Number.isInteger(endTick)
    ) {
      throw new Error(
        "Facial track ticks must be integers.",
      );
    }

    if (startTick < 0) {
      throw new Error(
        "Facial track startTick must not be negative.",
      );
    }

    if (endTick <= startTick) {
      throw new Error(
        "Facial track endTick must be greater than startTick.",
      );
    }

    return {
      id: deterministicUuid(
        `facial-track:${canonicalize({
          name: normalizedName,
          startTick,
          endTick,
          controls:
            normalizeControls(
              controls,
            ),
        })}`,
      ),
      name: normalizedName,
      startTick,
      endTick,
      controls:
        normalizeControls(
          controls,
        ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Evaluate Track                                                            */
  /* ------------------------------------------------------------------------ */

  evaluateTrack(
    track: FacialTrack,
    tick: number,
  ): Record<string, number> {
    if (!Number.isInteger(tick)) {
      throw new Error(
        "Facial evaluation tick must be an integer.",
      );
    }

    if (
      tick <= track.startTick
    ) {
      return structuredClone(
        track.controls,
      );
    }

    if (
      tick >= track.endTick
    ) {
      return {};
    }

    const duration =
      track.endTick -
      track.startTick;

    const amount =
      (
        tick -
        track.startTick
      ) / duration;

    const t =
      smoothstep(amount);

    return normalizeControls(
      Object.fromEntries(
        Object.entries(
          track.controls,
        ).map(
          ([name, value]) => [
            name,
            lerp(
              0,
              value,
              t,
            ),
          ],
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Convert Canonical Expression                                             */
  /* ------------------------------------------------------------------------ */

  expressionToControls(
    expression: Expression,
  ): Record<string, number> {
    return controlsFromArray(
      expression.controls,
    );
  }

  controlsToExpression(
    name: string,
    controls: Record<string, number>,
  ): Expression {
    return this.createExpression(
      name,
      controls,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Default Pose                                                              */
  /* ------------------------------------------------------------------------ */

  neutral(): Record<string, number> {
    return this.expression(
      "neutral",
      1,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                               */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    expression: Expression,
  ): string {
    const validated =
      this.validateExpression(
        expression,
      );

    return createHash("sha256")
      .update(
        canonicalize(
          validated,
        ),
      )
      .digest("hex");
  }

  /* ------------------------------------------------------------------------ */
  /* Schema Helper                                                             */
  /* ------------------------------------------------------------------------ */

  validateControl(
    control: FacialControl,
  ): FacialControl {
    const parsed =
      FacialControlSchema.safeParse(
        control,
      );

    if (!parsed.success) {
      throw new Error(
        `Invalid facial control: ${parsed.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; ")}`,
      );
    }

    return structuredClone(
      control,
    );
  }
}