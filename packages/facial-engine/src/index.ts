import { createHash } from "node:crypto";
import { z } from "zod";

import {
  Expression as ExpressionSchema,
  FacialControl as FacialControlSchema,
} from "../../contracts/src/index.js";

/* ==========================================================================
 * VERSION
 * ========================================================================== */

export const FACIAL_ENGINE_VERSION = "2.0.0";

/* ==========================================================================
 * TYPES
 * ========================================================================== */

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

export interface FacialLayer {
  id: string;
  name: string;
  priority: number;
  weight: number;
  controls: Record<string, number>;
  enabled: boolean;
  additive: boolean;
}

export interface FacialEvaluationInput {
  tick: number;
  base?: Record<string, number>;
  layers?: FacialLayer[];
  expression?: string;
  expressionWeight?: number;
  emotion?: string;
  emotionWeight?: number;
  lipSync?: Record<string, number>;
  gaze?: GazeState;
  blink?: number;
  manualOverride?: Record<string, number>;
}

export interface FacialEvaluationResult {
  tick: number;
  controls: Record<string, number>;
  layers: FacialLayer[];
  version: string;
}

export interface BlinkScheduleOptions {
  intervalTicks?: number;
  durationTicks?: number;
  phaseOffsetTicks?: number;
  intensity?: number;
}

export interface GazeTarget {
  x: number;
  y: number;
  weight?: number;
}

export interface FacialConstraint {
  min?: number;
  max?: number;
}

export type FacialConstraintMap =
  Record<string, FacialConstraint>;

/* ==========================================================================
 * CONSTANTS
 * ========================================================================== */

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

export const EMOTION_ALIASES: Record<string, string> = {
  joy: "happy",
  happiness: "happy",
  laugh: "happy",
  laughing: "happy",

  rage: "angry",
  mad: "angry",

  sorrow: "sad",
  sadness: "sad",

  surprise: "surprised",
  shock: "surprised",

  fear: "fearful",
  scared: "fearful",

 disgust: "disgusted",

  calm: "neutral",
  normal: "neutral",
};

export const DEFAULT_CONSTRAINTS: FacialConstraintMap =
  Object.fromEntries(
    DEFAULT_FACIAL_CONTROLS.map((control) => [
      control,
      {
        min: -1,
        max: 1,
      },
    ]),
  );

/* ==========================================================================
 * MATH
 * ========================================================================== */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(
  a: number,
  b: number,
  t: number,
): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);

  return x * x * (3 - 2 * x);
}

/* ==========================================================================
 * DETERMINISTIC HELPERS
 * ========================================================================== */

function canonicalize(value: unknown): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
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

function deterministicUuid(input: string): string {
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

/* ==========================================================================
 * CONTROL NORMALIZATION
 * ========================================================================== */

function normalizeControls(
  controls: Record<string, number>,
  constraints: FacialConstraintMap = DEFAULT_CONSTRAINTS,
): Record<string, number> {
  const output: Record<string, number> = {};

  for (const [name, value] of Object.entries(controls)) {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Facial control "${name}" must be finite.`,
      );
    }

    const constraint =
      constraints[name] ?? {
        min: -1,
        max: 1,
      };

    output[name] = clamp(
      value,
      constraint.min ?? -1,
      constraint.max ?? 1,
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({
      name,
      value,
    }));
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

/* ==========================================================================
 * FACIAL ENGINE
 * ========================================================================== */

export class FacialEngine {
  readonly version =
    FACIAL_ENGINE_VERSION;

  /* ------------------------------------------------------------------------
   * CONTROL DEFINITIONS
   * ------------------------------------------------------------------------ */

  getControlNames(): string[] {
    return [
      ...DEFAULT_FACIAL_CONTROLS,
    ];
  }

  hasControl(name: string): boolean {
    return (
      DEFAULT_FACIAL_CONTROLS as readonly string[]
    ).includes(name);
  }

  defaultPose(): Record<string, number> {
    return Object.fromEntries(
      DEFAULT_FACIAL_CONTROLS.map(
        (control) => [control, 0],
      ),
    );
  }

  /* ------------------------------------------------------------------------
   * EXPRESSION
   * ------------------------------------------------------------------------ */

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

    return normalizeControls(
      Object.fromEntries(
        Object.entries(base).map(
          ([key, value]) => [
            key,
            value * clamp(weight, 0, 1),
          ],
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------------
   * EMOTION
   * ------------------------------------------------------------------------ */

  emotion(
    name: string,
    weight = 1,
  ): Record<string, number> {
    const normalized =
      name.trim().toLowerCase();

    const expressionName =
      EMOTION_ALIASES[normalized] ??
      normalized;

    return this.expression(
      expressionName,
      weight,
    );
  }

  /* ------------------------------------------------------------------------
   * EXPRESSION CREATION
   * ------------------------------------------------------------------------ */

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
      normalizeControls(controls);

    const identity =
      canonicalize({
        name: normalizedName,
        controls: normalizedControls,
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

  /* ------------------------------------------------------------------------
   * EXPRESSION VALIDATION
   * ------------------------------------------------------------------------ */

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

    const names =
      new Set<string>();

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
      valid: errors.length === 0,
      errors,
    };
  }

  /* ------------------------------------------------------------------------
   * BLENDING
   * ------------------------------------------------------------------------ */

  blend(
    ...controls: Record<string, number>[]
  ): Record<string, number> {
    const output: Record<string, number> = {};

    for (const controlSet of controls) {
      const normalized =
        normalizeControls(
          controlSet,
        );

      for (const [name, value] of Object.entries(
        normalized,
      )) {
        output[name] =
          (output[name] ?? 0) +
          value;
      }
    }

    return normalizeControls(
      output,
    );
  }

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

      for (const [name, value] of Object.entries(
        normalized,
      )) {
        output[name] =
          (output[name] ?? 0) +
          value * weight;
      }
    }

    return normalizeControls(
      output,
    );
  }

  /* ------------------------------------------------------------------------
   * INTERPOLATION
   * ------------------------------------------------------------------------ */

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

    const t =
      clamp(
        amount,
        0,
        1,
      );

    const names =
      new Set([
        ...Object.keys(from),
        ...Object.keys(to),
      ]);

    const output: Record<string, number> = {};

    for (const name of names) {
      output[name] =
        lerp(
          from[name] ?? 0,
          to[name] ?? 0,
          t,
        );
    }

    return normalizeControls(
      output,
    );
  }

  smoothInterpolate(
    from: Record<string, number>,
    to: Record<string, number>,
    amount: number,
  ): Record<string, number> {
    return this.interpolate(
      from,
      to,
      smoothstep(
        clamp(
          amount,
          0,
          1,
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------------
   * GAZE
   * ------------------------------------------------------------------------ */

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

  gazeToTarget(
    current: GazeState,
    target: GazeTarget,
    amount = 1,
  ): GazeState &
    Record<string, number> {
    const weight =
      clamp(
        target.weight ?? amount,
        0,
        1,
      );

    const x =
      lerp(
        current.x,
        clamp(target.x, -1, 1),
        weight,
      );

    const y =
      lerp(
        current.y,
        clamp(target.y, -1, 1),
        weight,
      );

    return this.gaze(
      x,
      y,
    );
  }

  /* ------------------------------------------------------------------------
   * BLINK
   * ------------------------------------------------------------------------ */

  blink(
    opening: number,
  ): BlinkState &
    Record<string, number> {
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

  blinkAt(
    tick: number,
    options: BlinkScheduleOptions = {},
  ): number {
    if (!Number.isInteger(tick)) {
      throw new Error(
        "Blink tick must be an integer.",
      );
    }

    const interval =
      Math.max(
        1,
        Math.floor(
          options.intervalTicks ??
            90_000,
        ),
      );

    const duration =
      Math.max(
        1,
        Math.floor(
          options.durationTicks ??
            4_000,
        ),
      );

    const phase =
      Math.floor(
        options.phaseOffsetTicks ??
          0,
      );

    const intensity =
      clamp(
        options.intensity ?? 1,
        0,
        1,
      );

    const local =
      ((tick - phase) % interval +
        interval) %
      interval;

    if (local >= duration) {
      return 0;
    }

    const progress =
      local /
      duration;

    /*
     * Close → open.
     * A smooth bell curve gives a natural
     * blink instead of a hard switch.
     */
    const value =
      Math.sin(
        progress * Math.PI,
      );

    return clamp(
      value * intensity,
      0,
      1,
    );
  }

  /* ------------------------------------------------------------------------
   * VISEME
   * ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
   * FACIAL TRACK
   * ------------------------------------------------------------------------ */

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

    const normalizedControls =
      normalizeControls(
        controls,
      );

    return {
      id: deterministicUuid(
        `facial-track:${canonicalize({
          name: normalizedName,
          startTick,
          endTick,
          controls:
            normalizedControls,
        })}`,
      ),
      name: normalizedName,
      startTick,
      endTick,
      controls:
        normalizedControls,
    };
  }

  evaluateTrack(
    track: FacialTrack,
    tick: number,
  ): Record<string, number> {
    if (!Number.isInteger(tick)) {
      throw new Error(
        "Facial evaluation tick must be an integer.",
      );
    }

    if (tick <= track.startTick) {
      return structuredClone(
        track.controls,
      );
    }

    if (tick >= track.endTick) {
      return {};
    }

    const duration =
      track.endTick -
      track.startTick;

    const amount =
      (tick - track.startTick) /
      duration;

    const t =
      smoothstep(
        amount,
      );

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

  /* ------------------------------------------------------------------------
   * LAYER
   * ------------------------------------------------------------------------ */

  createLayer(
    name: string,
    controls: Record<string, number>,
    options: {
      priority?: number;
      weight?: number;
      additive?: boolean;
      enabled?: boolean;
      id?: string;
    } = {},
  ): FacialLayer {
    const normalizedName =
      name.trim();

    if (!normalizedName) {
      throw new Error(
        "Facial layer name must not be empty.",
      );
    }

    const normalizedControls =
      normalizeControls(
        controls,
      );

    const identity =
      canonicalize({
        name: normalizedName,
        priority:
          options.priority ?? 0,
        weight:
          options.weight ?? 1,
        additive:
          options.additive ?? false,
        controls:
          normalizedControls,
        id:
          options.id ?? null,
      });

    return {
      id:
        options.id ??
        deterministicUuid(
          `facial-layer:${identity}`,
        ),
      name: normalizedName,
      priority:
        Math.floor(
          options.priority ?? 0,
        ),
      weight:
        clamp(
          options.weight ?? 1,
          0,
          1,
        ),
      controls:
        normalizedControls,
      enabled:
        options.enabled ?? true,
      additive:
        options.additive ?? false,
    };
  }

  /* ------------------------------------------------------------------------
   * PRIORITY EVALUATION
   * ------------------------------------------------------------------------ */

  evaluateLayers(
    base: Record<string, number>,
    layers: FacialLayer[],
  ): Record<string, number> {
    const output =
      normalizeControls(
        base,
      );

    const sorted =
      layers
        .filter(
          (layer) =>
            layer.enabled &&
            layer.weight > 0,
        )
        .sort(
          (a, b) =>
            a.priority -
            b.priority ||
            a.id.localeCompare(
              b.id,
            ),
        );

    for (const layer of sorted) {
      const weight =
        clamp(
          layer.weight,
          0,
          1,
        );

      const controls =
        normalizeControls(
          layer.controls,
        );

      for (const [name, value] of Object.entries(
        controls,
      )) {
        const current =
          output[name] ?? 0;

        if (layer.additive) {
          output[name] =
            current +
            value * weight;
        } else {
          output[name] =
            lerp(
              current,
              value,
              weight,
            );
        }
      }
    }

    return normalizeControls(
      output,
    );
  }

  /* ------------------------------------------------------------------------
 * MANUAL OVERRIDE
 * ------------------------------------------------------------------------ */

applyManualOverride(
  controls: Record<string, number>,
  override: Record<string, number>,
  weight = 1,
): Record<string, number> {
  if (!Number.isFinite(weight)) {
    throw new Error(
      "Manual override weight must be finite.",
    );
  }

  const amount = clamp(
    weight,
    0,
    1,
  );

  const base =
    normalizeControls(
      controls,
    );

  const normalizedOverride =
    normalizeControls(
      override,
    );

  const names =
    new Set<string>([
      ...Object.keys(base),
      ...Object.keys(
        normalizedOverride,
      ),
    ]);

  const result: Record<
    string,
    number
  > = {};

  for (const name of names) {
    result[name] =
      lerp(
        base[name] ?? 0,
        normalizedOverride[name] ?? 0,
        amount,
      );
  }

  return normalizeControls(
    result,
  );
}
 /* ------------------------------------------------------------------------
 * SAFE MANUAL OVERRIDE
 * ------------------------------------------------------------------------ */

blendManualOverride(
  base: Record<string, number>,
  override: Record<string, number>,
  weight = 1,
): Record<string, number> {
  if (!Number.isFinite(weight)) {
    throw new Error(
      "Manual override weight must be finite.",
    );
  }

  const amount =
    clamp(
      weight,
      0,
      1,
    );

  const names =
    new Set<string>([
      ...Object.keys(base),
      ...Object.keys(override),
    ]);

  const result: Record<
    string,
    number
  > = {};

  for (const name of names) {
    result[name] =
      lerp(
        base[name] ?? 0,
        override[name] ?? 0,
        amount,
      );
  }

  return normalizeControls(
    result,
  );
}

  /* ------------------------------------------------------------------------
   * LIP-SYNC MAPPING
   * ------------------------------------------------------------------------ */

  applyLipSync(
    base: Record<string, number>,
    lipSync: Record<string, number>,
    weight = 1,
  ): Record<string, number> {
    return this.blendManualOverride(
      base,
      lipSync,
      weight,
    );
  }

  /* ------------------------------------------------------------------------
   * COMPLETE FACIAL EVALUATION
   * ------------------------------------------------------------------------ */

  evaluate(
    input: FacialEvaluationInput,
  ): FacialEvaluationResult {
    if (!Number.isInteger(input.tick)) {
      throw new Error(
        "Facial evaluation tick must be an integer.",
      );
    }

    let result =
      this.defaultPose();

    /*
     * Base pose
     */
    if (input.base) {
      result =
        this.blendManualOverride(
          result,
          input.base,
          1,
        );
    }

    /*
     * Expression
     */
    if (input.expression) {
      result =
        this.blendManualOverride(
          result,
          this.expression(
            input.expression,
            input.expressionWeight ?? 1,
          ),
          1,
        );
    }

    /*
     * Emotion
     */
    if (input.emotion) {
      result =
        this.blendManualOverride(
          result,
          this.emotion(
            input.emotion,
            input.emotionWeight ?? 1,
          ),
          1,
        );
    }

    /*
     * Layers
     *
     * This is where priority-based
     * facial animation is resolved.
     */
    const layers =
      input.layers ?? [];

    result =
      this.evaluateLayers(
        result,
        layers,
      );

    /*
     * Gaze
     */
    if (input.gaze) {
      result =
        this.blendManualOverride(
          result,
          this.gaze(
            input.gaze.x,
            input.gaze.y,
          ),
          1,
        );
    }

    /*
     * Lip-sync
     *
     * Lip-sync is intentionally applied
     * after expression/emotion so dialogue
     * mouth movement remains visible.
     */
    if (input.lipSync) {
      result =
        this.applyLipSync(
          result,
          input.lipSync,
          1,
        );
    }

    /*
     * Blink
     */
    if (input.blink !== undefined) {
      result =
        this.blendManualOverride(
          result,
          this.blink(
            input.blink,
          ),
          1,
        );
    }

    /*
     * Manual animator override
     *
     * Highest ordinary animation priority.
     */
    if (input.manualOverride) {
      result =
        this.blendManualOverride(
          result,
          input.manualOverride,
          1,
        );
    }

    return {
      tick: input.tick,
      controls:
        normalizeControls(
          result,
        ),
      layers:
        structuredClone(
          layers,
        ),
      version:
        FACIAL_ENGINE_VERSION,
    };
  }

  /* ------------------------------------------------------------------------
   * EXPRESSION CONVERSION
   * ------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------
   * NEUTRAL
   * ------------------------------------------------------------------------ */

  neutral(): Record<string, number> {
    return this.expression(
      "neutral",
      1,
    );
  }

  /* ------------------------------------------------------------------------
   * CONSTRAINTS
   * ------------------------------------------------------------------------ */

  applyConstraints(
    controls: Record<string, number>,
    constraints: FacialConstraintMap,
  ): Record<string, number> {
    const output: Record<string, number> = {};

    for (const [name, value] of Object.entries(
      controls,
    )) {
      if (!Number.isFinite(value)) {
        throw new Error(
          `Facial control "${name}" must be finite.`,
        );
      }

      const constraint =
        constraints[name] ?? {
          min: -1,
          max: 1,
        };

      output[name] =
        clamp(
          value,
          constraint.min ?? -1,
          constraint.max ?? 1,
        );
    }

    return output;
  }

  /* ------------------------------------------------------------------------
   * FINGERPRINT
   * ------------------------------------------------------------------------ */

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

  fingerprintControls(
    controls: Record<string, number>,
  ): string {
    return createHash("sha256")
      .update(
        canonicalize(
          normalizeControls(
            controls,
          ),
        ),
      )
      .digest("hex");
  }

  /* ------------------------------------------------------------------------
   * DETERMINISM
   * ------------------------------------------------------------------------ */

  isDeterministic(
    expression: Expression,
  ): boolean {
    const first =
      this.fingerprint(
        expression,
      );

    const second =
      this.fingerprint(
        structuredClone(
          expression,
        ),
      );

    return first === second;
  }

  isEvaluationDeterministic(
    input: FacialEvaluationInput,
  ): boolean {
    const first =
      this.evaluate(
        structuredClone(
          input,
        ),
      );

    const second =
      this.evaluate(
        structuredClone(
          input,
        ),
      );

    return (
      canonicalize(
        first,
      ) ===
      canonicalize(
        second,
      )
    );
  }

  /* ------------------------------------------------------------------------
   * CONTROL VALIDATION
   * ------------------------------------------------------------------------ */

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

  validateControls(
    controls: Record<string, number>,
  ): FacialValidationResult {
    const errors: string[] = [];

    for (const [name, value] of Object.entries(
      controls,
    )) {
      if (!name.trim()) {
        errors.push(
          "Facial control name must not be empty.",
        );
      }

      if (!Number.isFinite(value)) {
        errors.push(
          `Facial control "${name}" must be finite.`,
        );
      }

      if (
        value < -1 ||
        value > 1
      ) {
        errors.push(
          `Facial control "${name}" must be between -1 and 1.`,
        );
      }
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }
}

/* ==========================================================================
 * CANONICAL TYPES
 * ========================================================================== */

export type CanonicalExpression =
  z.infer<
    typeof ExpressionSchema
  >;

export type CanonicalFacialControl =
  z.infer<
    typeof FacialControlSchema
  >;