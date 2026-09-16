import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPRESSIONS,
  DEFAULT_FACIAL_CONTROLS,
  FacialEngine,
} from "../packages/facial-engine/src/index.js";

describe("Facial Engine", () => {
  const engine = new FacialEngine();

  /* ------------------------------------------------------------------------ */
  /* Initialization                                                           */
  /* ------------------------------------------------------------------------ */

  describe("initialization", () => {
    it("creates the engine", () => {
      expect(engine).toBeInstanceOf(FacialEngine);
    });

    it("exposes the canonical facial control catalog", () => {
      expect(DEFAULT_FACIAL_CONTROLS).toContain("smile");
      expect(DEFAULT_FACIAL_CONTROLS).toContain("browRaise");
      expect(DEFAULT_FACIAL_CONTROLS).toContain("mouthOpen");
      expect(DEFAULT_FACIAL_CONTROLS).toContain("blink");
      expect(DEFAULT_FACIAL_CONTROLS).toContain("eyeGazeX");
      expect(DEFAULT_FACIAL_CONTROLS).toContain("eyeGazeY");
    });

    it("provides built-in expressions", () => {
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("neutral");
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("happy");
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("angry");
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("sad");
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("surprised");
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("fearful");
      expect(DEFAULT_EXPRESSIONS).toHaveProperty("disgusted");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Expression                                                               */
  /* ------------------------------------------------------------------------ */

  describe("expressions", () => {
    it("creates a neutral expression at full weight", () => {
      const result = engine.expression("neutral", 1);

      expect(result.smile).toBe(0);
      expect(result.browRaise).toBe(0);
      expect(result.mouthOpen).toBe(0);
    });

    it("creates a happy expression", () => {
      const result = engine.expression("happy", 1);

      expect(result.smile).toBe(1);
      expect(result.mouthOpen).toBe(0.25);
      expect(result.cheekRaise).toBe(0.8);
    });

    it("creates an angry expression", () => {
      const result = engine.expression("angry", 1);

      expect(result.smile).toBe(-0.4);
      expect(result.browFurrow).toBe(1);
      expect(result.noseWrinkle).toBe(0.3);
    });

    it("creates a sad expression", () => {
      const result = engine.expression("sad", 1);

      expect(result.smile).toBe(-0.7);
      expect(result.browRaise).toBe(-0.2);
    });

    it("creates a surprised expression", () => {
      const result = engine.expression("surprised", 1);

      expect(result.browRaise).toBe(1);
      expect(result.mouthOpen).toBe(1);
      expect(result.jawOpen).toBe(0.9);
    });

    it("creates a fearful expression", () => {
      const result = engine.expression("fearful", 1);

      expect(result.mouthOpen).toBe(0.5);
      expect(result.jawOpen).toBe(0.45);
    });

    it("creates a disgusted expression", () => {
      const result = engine.expression("disgusted", 1);

      expect(result.noseWrinkle).toBe(0.9);
      expect(result.eyeSquint).toBe(0.4);
    });

    it("normalizes expression names", () => {
      const lower = engine.expression("happy", 1);
      const upper = engine.expression("HAPPY", 1);
      const mixed = engine.expression("  Happy  ", 1);

      expect(upper).toEqual(lower);
      expect(mixed).toEqual(lower);
    });

    it("falls back to neutral for an unknown expression", () => {
      const result = engine.expression(
        "something-that-does-not-exist",
        1,
      );

      expect(result).toEqual(
        engine.expression("neutral", 1),
      );
    });

    it("clamps expression weight to zero", () => {
      const result = engine.expression("happy", -10);

      expect(result.smile).toBe(0);
      expect(result.mouthOpen).toBe(0);
    });

    it("clamps expression weight to one", () => {
      const result = engine.expression("happy", 10);

      expect(result.smile).toBe(1);
      expect(result.mouthOpen).toBe(0.25);
    });

    it("rejects a non-finite expression weight", () => {
      expect(() =>
        engine.expression("happy", Number.NaN),
      ).toThrow(
        "Expression weight must be finite.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Canonical Expression                                                     */
  /* ------------------------------------------------------------------------ */

  describe("canonical expression creation", () => {
    it("creates a canonical expression", () => {
      const expression = engine.createExpression(
        "Happy Face",
        {
          smile: 1,
          mouthOpen: 0.25,
        },
      );

      /*
       * UUID v5-shaped deterministic identifier:
       *
       * xxxxxxxx-xxxx-5xxx-[89ab]xxx-xxxxxxxxxxxx
       *
       * Fourth group contains four hexadecimal characters.
       */
      expect(expression.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      expect(expression.name).toBe("Happy Face");

      expect(expression.controls).toEqual([
        {
          name: "mouthOpen",
          value: 0.25,
        },
        {
          name: "smile",
          value: 1,
        },
      ]);
    });

    it("rejects an empty expression name", () => {
      expect(() =>
        engine.createExpression(
          "   ",
          {
            smile: 1,
          },
        ),
      ).toThrow(
        "Expression name must not be empty.",
      );
    });

    it("clamps expression control values", () => {
      const expression = engine.createExpression(
        "Clamped",
        {
          smile: 99,
          browRaise: -99,
        },
      );

      expect(expression.controls).toEqual([
        {
          name: "browRaise",
          value: -1,
        },
        {
          name: "smile",
          value: 1,
        },
      ]);
    });

    it("creates deterministic expression ids", () => {
      const first = engine.createExpression(
        "Happy",
        {
          smile: 1,
          mouthOpen: 0.25,
        },
      );

      const second = engine.createExpression(
        "Happy",
        {
          mouthOpen: 0.25,
          smile: 1,
        },
      );

      expect(first.id).toBe(second.id);
      expect(first).toEqual(second);
    });

    it("changes expression identity when deterministic key changes", () => {
      const first = engine.createExpression(
        "Happy",
        {
          smile: 1,
        },
        "variant-a",
      );

      const second = engine.createExpression(
        "Happy",
        {
          smile: 1,
        },
        "variant-b",
      );

      expect(first.id).not.toBe(second.id);
    });

    it("creates built-in canonical expressions", () => {
      const expression =
        engine.createBuiltInExpression("happy");

      expect(expression.name).toBe("happy");
      expect(expression.controls.length).toBeGreaterThan(0);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Expression Validation                                                    */
  /* ------------------------------------------------------------------------ */

  describe("expression validation", () => {
    it("accepts a valid expression", () => {
      const expression = engine.createExpression(
        "Valid",
        {
          smile: 0.5,
          blink: 0,
        },
      );

      const result =
        engine.validateExpressionResult(
          expression,
        );

      expect(result).toEqual({
        valid: true,
        errors: [],
      });
    });

    it("returns a defensive copy from validation", () => {
      const expression = engine.createExpression(
        "Immutable",
        {
          smile: 0.5,
        },
      );

      const validated =
        engine.validateExpression(expression);

      expect(validated).toEqual(expression);
      expect(validated).not.toBe(expression);
      expect(validated.controls).not.toBe(
        expression.controls,
      );
    });

    it("detects duplicate facial controls", () => {
      const expression = {
        id:
          "00000000-0000-4000-8000-000000000101",
        name: "Duplicate",
        controls: [
          {
            name: "smile",
            value: 0.5,
          },
          {
            name: "smile",
            value: 0.8,
          },
        ],
      };

      const result =
        engine.validateExpressionResult(
          expression,
        );

      expect(result.valid).toBe(false);

      expect(
        result.errors.some((error) =>
          error.includes(
            "Duplicate facial control",
          ),
        ),
      ).toBe(true);
    });

    it("rejects an invalid expression", () => {
      expect(() =>
        engine.validateExpression({
          id: "not-a-valid-uuid",
          name: "",
          controls: [],
        }),
      ).toThrow("Invalid expression:");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Blend                                                                    */
  /* ------------------------------------------------------------------------ */

  describe("blending", () => {
    it("blends multiple control sets additively", () => {
      const result = engine.blend(
        {
          smile: 0.4,
          mouthOpen: 0.2,
        },
        {
          smile: 0.3,
          mouthOpen: 0.1,
        },
      );

      expect(result).toEqual({
        smile: 0.7,
        mouthOpen: 0.3,
      });
    });

    it("clamps additive blend results", () => {
      const result = engine.blend(
        {
          smile: 1,
        },
        {
          smile: 1,
        },
      );

      expect(result.smile).toBe(1);
    });

    it("supports negative facial controls", () => {
      const result = engine.blend(
        {
          smile: -0.5,
        },
        {
          smile: -0.8,
        },
      );

      expect(result.smile).toBe(-1);
    });

    it("does not mutate source blend layers", () => {
      const first = {
        smile: 0.4,
      };

      const second = {
        mouthOpen: 0.5,
      };

      const beforeFirst = structuredClone(first);
      const beforeSecond = structuredClone(second);

      engine.blend(first, second);

      expect(first).toEqual(beforeFirst);
      expect(second).toEqual(beforeSecond);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Weighted Blend                                                           */
  /* ------------------------------------------------------------------------ */

  describe("weighted blending", () => {
    it("blends controls using layer weights", () => {
      const result = engine.blendWeighted([
        {
          controls: {
            smile: 1,
          },
          weight: 0.5,
        },
        {
          controls: {
            smile: 0.2,
          },
          weight: 0.5,
        },
      ]);

      expect(result.smile).toBeCloseTo(0.6);
    });

    it("clamps layer weights below zero", () => {
      const result = engine.blendWeighted([
        {
          controls: {
            smile: 1,
          },
          weight: -5,
        },
      ]);

      expect(result.smile).toBe(0);
    });

    it("clamps layer weights above one", () => {
      const result = engine.blendWeighted([
        {
          controls: {
            smile: 0.7,
          },
          weight: 5,
        },
      ]);

      expect(result.smile).toBe(0.7);
    });

    it("rejects non-finite layer weights", () => {
      expect(() =>
        engine.blendWeighted([
          {
            controls: {
              smile: 1,
            },
            weight: Number.NaN,
          },
        ]),
      ).toThrow(
        "Facial layer weight must be finite.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Interpolation                                                            */
  /* ------------------------------------------------------------------------ */

  describe("interpolation", () => {
    it("interpolates between facial poses", () => {
      const result = engine.interpolate(
        {
          smile: 0,
        },
        {
          smile: 1,
        },
        0.5,
      );

      expect(result.smile).toBe(0.5);
    });

    it("supports controls existing only in the destination", () => {
      const result = engine.interpolate(
        {},
        {
          mouthOpen: 1,
        },
        0.5,
      );

      expect(result.mouthOpen).toBe(0.5);
    });

    it("supports controls existing only in the source", () => {
      const result = engine.interpolate(
        {
          smile: 1,
        },
        {},
        0.5,
      );

      expect(result.smile).toBe(0.5);
    });

    it("clamps interpolation below zero", () => {
      const result = engine.interpolate(
        {
          smile: 0,
        },
        {
          smile: 1,
        },
        -10,
      );

      expect(result.smile).toBe(0);
    });

    it("clamps interpolation above one", () => {
      const result = engine.interpolate(
        {
          smile: 0,
        },
        {
          smile: 1,
        },
        10,
      );

      expect(result.smile).toBe(1);
    });

    it("rejects non-finite interpolation amount", () => {
      expect(() =>
        engine.interpolate(
          {
            smile: 0,
          },
          {
            smile: 1,
          },
          Number.NaN,
        ),
      ).toThrow(
        "Facial interpolation amount must be finite.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Smooth Interpolation                                                     */
  /* ------------------------------------------------------------------------ */

  describe("smooth interpolation", () => {
    it("starts at the source pose", () => {
      const result =
        engine.smoothInterpolate(
          {
            smile: 0.2,
          },
          {
            smile: 1,
          },
          0,
        );

      expect(result.smile).toBeCloseTo(0.2);
    });

    it("ends at the destination pose", () => {
      const result =
        engine.smoothInterpolate(
          {
            smile: 0.2,
          },
          {
            smile: 1,
          },
          1,
        );

      expect(result.smile).toBeCloseTo(1);
    });

    it("uses smoothstep interpolation", () => {
      const result =
        engine.smoothInterpolate(
          {
            smile: 0,
          },
          {
            smile: 1,
          },
          0.5,
        );

      expect(result.smile).toBeCloseTo(0.5);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Gaze                                                                     */
  /* ------------------------------------------------------------------------ */

  describe("gaze", () => {
    it("creates normalized gaze controls", () => {
      const result = engine.gaze(0.25, -0.5);

      expect(result).toEqual({
        x: 0.25,
        y: -0.5,
        eyeGazeX: 0.25,
        eyeGazeY: -0.5,
      });
    });

    it("clamps gaze coordinates", () => {
      const result = engine.gaze(100, -100);

      expect(result.x).toBe(1);
      expect(result.y).toBe(-1);
      expect(result.eyeGazeX).toBe(1);
      expect(result.eyeGazeY).toBe(-1);
    });

    it("rejects non-finite gaze coordinates", () => {
      expect(() =>
        engine.gaze(
          Number.NaN,
          0,
        ),
      ).toThrow(
        "Gaze coordinates must be finite.",
      );

      expect(() =>
        engine.gaze(
          0,
          Number.POSITIVE_INFINITY,
        ),
      ).toThrow(
        "Gaze coordinates must be finite.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Blink                                                                    */
  /* ------------------------------------------------------------------------ */

  describe("blink", () => {
    it("creates a blink control", () => {
      expect(engine.blink(0.5)).toEqual({
        blink: 0.5,
      });
    });

    it("clamps blink opening below zero", () => {
      expect(engine.blink(-10)).toEqual({
        blink: 0,
      });
    });

    it("clamps blink opening above one", () => {
      expect(engine.blink(10)).toEqual({
        blink: 1,
      });
    });

    it("rejects non-finite blink values", () => {
      expect(() =>
        engine.blink(Number.NaN),
      ).toThrow(
        "Blink opening must be finite.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Viseme                                                                   */
  /* ------------------------------------------------------------------------ */

  describe("visemes", () => {
    it("creates a normalized viseme control", () => {
      expect(engine.viseme("AA")).toEqual({
        "viseme.aa": 1,
      });
    });

    it("normalizes viseme names", () => {
      expect(
        engine.viseme(
          "  OO  ",
          0.5,
        ),
      ).toEqual({
        "viseme.oo": 0.5,
      });
    });

    it("clamps viseme weights", () => {
      expect(
        engine.viseme(
          "AA",
          10,
        ),
      ).toEqual({
        "viseme.aa": 1,
      });

      expect(
        engine.viseme(
          "AA",
          -10,
        ),
      ).toEqual({
        "viseme.aa": 0,
      });
    });

    it("rejects an empty viseme name", () => {
      expect(() =>
        engine.viseme("   "),
      ).toThrow(
        "Viseme name must not be empty.",
      );
    });

    it("rejects a non-finite viseme weight", () => {
      expect(() =>
        engine.viseme(
          "AA",
          Number.NaN,
        ),
      ).toThrow(
        "Viseme weight must be finite.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Facial Tracks                                                             */
  /* ------------------------------------------------------------------------ */

  describe("tracks", () => {
    it("creates a deterministic facial track", () => {
      const first = engine.track(
        "Smile",
        0,
        100,
        {
          smile: 1,
        },
      );

      const second = engine.track(
        "Smile",
        0,
        100,
        {
          smile: 1,
        },
      );

      expect(first).toEqual(second);

      /*
       * UUID v5-shaped deterministic identifier.
       */
      expect(first.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("rejects an empty track name", () => {
      expect(() =>
        engine.track(
          "   ",
          0,
          100,
          {
            smile: 1,
          },
        ),
      ).toThrow(
        "Facial track name must not be empty.",
      );
    });

    it("rejects non-integer ticks", () => {
      expect(() =>
        engine.track(
          "Invalid",
          0.5,
          100,
          {
            smile: 1,
          },
        ),
      ).toThrow(
        "Facial track ticks must be integers.",
      );
    });

    it("rejects a negative start tick", () => {
      expect(() =>
        engine.track(
          "Invalid",
          -1,
          100,
          {
            smile: 1,
          },
        ),
      ).toThrow(
        "Facial track startTick must not be negative.",
      );
    });

    it("rejects an invalid track range", () => {
      expect(() =>
        engine.track(
          "Invalid",
          100,
          100,
          {
            smile: 1,
          },
        ),
      ).toThrow(
        "Facial track endTick must be greater than startTick.",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Track Evaluation                                                          */
  /* ------------------------------------------------------------------------ */

  describe("track evaluation", () => {
    it("returns the full pose at or before track start", () => {
      const track = engine.track(
        "Smile",
        10,
        110,
        {
          smile: 1,
        },
      );

      expect(
        engine.evaluateTrack(
          track,
          10,
        ),
      ).toEqual({
        smile: 1,
      });

      expect(
        engine.evaluateTrack(
          track,
          0,
        ),
      ).toEqual({
        smile: 1,
      });
    });

    it("returns an empty pose at or after track end", () => {
      const track = engine.track(
        "Smile",
        10,
        110,
        {
          smile: 1,
        },
      );

      expect(
        engine.evaluateTrack(
          track,
          110,
        ),
      ).toEqual({});

      expect(
        engine.evaluateTrack(
          track,
          200,
        ),
      ).toEqual({});
    });

    it("smoothly evaluates a track in progress", () => {
      const track = engine.track(
        "Smile",
        0,
        100,
        {
          smile: 1,
        },
      );

      const result =
        engine.evaluateTrack(
          track,
          50,
        );

      expect(result.smile).toBeCloseTo(0.5);
    });

    it("rejects a non-integer evaluation tick", () => {
      const track = engine.track(
        "Smile",
        0,
        100,
        {
          smile: 1,
        },
      );

      expect(() =>
        engine.evaluateTrack(
          track,
          10.5,
        ),
      ).toThrow(
        "Facial evaluation tick must be an integer.",
      );
    });

    it("does not mutate the track during evaluation", () => {
      const track = engine.track(
        "Smile",
        0,
        100,
        {
          smile: 1,
        },
      );

      const before = structuredClone(track);

      engine.evaluateTrack(track, 50);

      expect(track).toEqual(before);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Expression ↔ Controls Conversion                                         */
  /* ------------------------------------------------------------------------ */

  describe("expression conversion", () => {
    it("converts an expression to controls", () => {
      const expression = engine.createExpression(
        "Happy",
        {
          smile: 1,
          mouthOpen: 0.25,
        },
      );

      expect(
        engine.expressionToControls(
          expression,
        ),
      ).toEqual({
        smile: 1,
        mouthOpen: 0.25,
      });
    });

    it("converts controls into an expression", () => {
      const expression =
        engine.controlsToExpression(
          "Happy",
          {
            smile: 1,
            mouthOpen: 0.25,
          },
        );

      expect(expression.name).toBe("Happy");

      expect(
        engine.expressionToControls(
          expression,
        ),
      ).toEqual({
        smile: 1,
        mouthOpen: 0.25,
      });
    });

    it("does not expose the original controls array", () => {
      const controls = {
        smile: 1,
      };

      const expression =
        engine.controlsToExpression(
          "Happy",
          controls,
        );

      controls.smile = 0;

      expect(
        engine.expressionToControls(
          expression,
        ).smile,
      ).toBe(1);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Neutral Pose                                                              */
  /* ------------------------------------------------------------------------ */

  describe("neutral pose", () => {
    it("returns the neutral facial pose", () => {
      const result = engine.neutral();

      expect(result).toEqual(
        engine.expression(
          "neutral",
          1,
        ),
      );
    });

    it("returns a fresh object each time", () => {
      const first = engine.neutral();
      const second = engine.neutral();

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                               */
  /* ------------------------------------------------------------------------ */

  describe("fingerprints", () => {
    it("creates a SHA-256 fingerprint", () => {
      const expression = engine.createExpression(
        "Happy",
        {
          smile: 1,
        },
      );

      const fingerprint =
        engine.fingerprint(expression);

      expect(fingerprint).toMatch(
        /^[0-9a-f]{64}$/,
      );
    });

    it("produces deterministic fingerprints", () => {
      const first = engine.createExpression(
        "Happy",
        {
          smile: 1,
          mouthOpen: 0.25,
        },
      );

      const second = engine.createExpression(
        "Happy",
        {
          mouthOpen: 0.25,
          smile: 1,
        },
      );

      expect(
        engine.fingerprint(first),
      ).toBe(
        engine.fingerprint(second),
      );
    });

    it("changes the fingerprint when a control changes", () => {
      const first = engine.createExpression(
        "Happy",
        {
          smile: 1,
        },
      );

      const second = engine.createExpression(
        "Happy",
        {
          smile: 0.9,
        },
      );

      expect(
        engine.fingerprint(first),
      ).not.toBe(
        engine.fingerprint(second),
      );
    });

    it("rejects an invalid expression before fingerprinting", () => {
      expect(() =>
        engine.fingerprint({
          id: "invalid",
          name: "",
          controls: [],
        }),
      ).toThrow(
        "Invalid expression:",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Facial Control Validation                                                 */
  /* ------------------------------------------------------------------------ */

  describe("facial control validation", () => {
    it("accepts a valid facial control", () => {
      const control =
        engine.validateControl({
          name: "smile",
          value: 0.75,
        });

      expect(control).toEqual({
        name: "smile",
        value: 0.75,
      });
    });

    it("returns a defensive copy", () => {
      const source = {
        name: "smile",
        value: 0.75,
      };

      const validated =
        engine.validateControl(source);

      expect(validated).toEqual(source);
      expect(validated).not.toBe(source);
    });

    it("rejects an empty control name", () => {
      expect(() =>
        engine.validateControl({
          name: "",
          value: 0.5,
        }),
      ).toThrow(
        "Invalid facial control:",
      );
    });

    it("rejects a non-finite control value", () => {
      expect(() =>
        engine.validateControl({
          name: "smile",
          value: Number.NaN,
        }),
      ).toThrow(
        "Invalid facial control:",
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Determinism / Immutability                                                */
  /* ------------------------------------------------------------------------ */

  describe("determinism and immutability", () => {
    it("produces identical results for identical input", () => {
      const input = {
        smile: 0.7,
        browRaise: 0.2,
        mouthOpen: 0.3,
      };

      const first = engine.createExpression(
        "Test",
        input,
      );

      const second = engine.createExpression(
        "Test",
        input,
      );

      expect(first).toEqual(second);

      expect(
        engine.fingerprint(first),
      ).toBe(
        engine.fingerprint(second),
      );
    });

    it("does not mutate source controls during expression creation", () => {
      const source = {
        smile: 2,
        mouthOpen: -2,
      };

      const before = structuredClone(source);

      engine.createExpression(
        "Clamped",
        source,
      );

      expect(source).toEqual(before);
    });

    it("does not mutate source controls during interpolation", () => {
      const from = {
        smile: 0,
      };

      const to = {
        smile: 1,
      };

      const beforeFrom = structuredClone(from);
      const beforeTo = structuredClone(to);

      engine.interpolate(
        from,
        to,
        0.5,
      );

      expect(from).toEqual(beforeFrom);
      expect(to).toEqual(beforeTo);
    });

    it("does not mutate source controls during weighted blending", () => {
      const source = {
        smile: 0.5,
      };

      const before = structuredClone(source);

      engine.blendWeighted([
        {
          controls: source,
          weight: 0.5,
        },
      ]);

      expect(source).toEqual(before);
    });
  });
});