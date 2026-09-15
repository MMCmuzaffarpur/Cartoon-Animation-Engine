import { describe, expect, it } from "vitest";

import {
  AnimationEngine,
  DEFAULT_DANCE_DURATION_TICKS,
  DEFAULT_JUMP_DURATION_TICKS,
  DEFAULT_RUN_DURATION_TICKS,
  DEFAULT_WALK_DURATION_TICKS,
  DEFAULT_WAVE_DURATION_TICKS,
  resolveLocalTick,
  sampleTrack,
  type LegacyMotionLayer,
  type MotionClip,
  type MotionLayer,
  type Track,
} from "../packages/animation-engine/src/index.js";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";
const UUID_C = "00000000-0000-4000-8000-000000000003";
const UUID_D = "00000000-0000-4000-8000-000000000004";

function engine() {
  return new AnimationEngine();
}

function track(
  targetPath = "pose.arm.rotation",
  a = 0,
  b = 100,
): Track {
  return {
    targetPath,
    keyframes: [
      { tick: 0, value: a, interpolation: "linear" },
      { tick: 100, value: b, interpolation: "linear" },
    ],
  };
}

function clip(
  e: AnimationEngine,
  options: {
    name?: string;
    durationTicks?: number;
    tracks?: Track[];
    loopMode?: "once" | "loop" | "pingpong";
    events?: MotionClip["events"];
    rootMotion?: Record<string, unknown>;
    semanticCategory?: string;
    rigRequirements?: string[];
    deterministicKey?: string;
  } = {},
): MotionClip {
  return e.createClip(
    options.name ?? "test",
    options.durationTicks ?? 100,
    options.tracks ?? [track()],
    {
      loopMode: options.loopMode,
      events: options.events,
      rootMotion: options.rootMotion,
      semanticCategory: options.semanticCategory,
      rigRequirements: options.rigRequirements,
      deterministicKey: options.deterministicKey,
    },
  );
}

function layer(
  e: AnimationEngine,
  c: MotionClip,
  options: {
    order?: number;
    kind?: string;
    weight?: number;
    mask?: string[];
    additive?: boolean;
    id?: string;
  } = {},
): MotionLayer {
  return e.createLayer(c, options);
}

describe("AnimationEngine", () => {
  describe("clip creation", () => {
    it("creates a valid clip with deterministic UUID", () => {
      const e = engine();
      const c = clip(e);

      expect(c.name).toBe("test");
      expect(c.durationTicks).toBe(100);
      expect(c.loopMode).toBe("once");
      expect(c.semanticCategory).toBe("custom");
      expect(c.rigRequirements).toEqual([]);
      expect(c.rootMotion).toEqual({});
      expect(c.events).toEqual([]);
      expect(c.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it("creates a clip with all supported options", () => {
      const e = engine();
      const c = clip(e, {
        name: "walk",
        durationTicks: 240,
        loopMode: "loop",
        events: [{ tick: 120, type: "footstep", payload: { foot: "left" } }],
        rootMotion: { x: 2 },
        semanticCategory: "locomotion",
        rigRequirements: ["humanoid", "legs"],
        deterministicKey: "v1",
      });

      expect(c.name).toBe("walk");
      expect(c.durationTicks).toBe(240);
      expect(c.loopMode).toBe("loop");
      expect(c.semanticCategory).toBe("locomotion");
      expect(c.rigRequirements).toEqual(["humanoid", "legs"]);
      expect(c.events[0]).toEqual({
        tick: 120,
        type: "footstep",
        payload: { foot: "left" },
      });
      expect(c.rootMotion).toEqual({ x: 2 });
    });

    it("rejects an empty name", () => {
      const e = engine();
      expect(() => e.createClip("   ", 100, [track()])).toThrow(
        "Motion clip name must not be empty.",
      );
    });

    it("rejects invalid duration", () => {
      const e = engine();
      expect(() => e.createClip("x", 0, [track()])).toThrow(
        "Motion clip durationTicks must be a positive integer.",
      );
      expect(() => e.createClip("x", -1, [track()])).toThrow(
        "Motion clip durationTicks must be a positive integer.",
      );
      expect(() => e.createClip("x", 1.5, [track()])).toThrow(
        "Motion clip durationTicks must be a positive integer.",
      );
    });

    it("rejects non-array tracks", () => {
      const e = engine();
      expect(() =>
        e.createClip("x", 100, undefined as unknown as Track[]),
      ).toThrow("Motion clip tracks must be an array.");
    });

    it("normalizes keyframes without mutating source", () => {
      const e = engine();
      const source: Track = {
        targetPath: "pose.body",
        keyframes: [
          { tick: 100, value: 10, interpolation: "linear" },
          { tick: 0, value: 0, interpolation: "linear" },
          { tick: 50, value: 5, interpolation: "smooth" },
        ],
      };
      const before = structuredClone(source);
      const c = clip(e, { tracks: [source] });

      expect(c.tracks[0].keyframes.map((k) => k.tick)).toEqual([0, 50, 100]);
      expect(source).toEqual(before);
    });

    it("supports the legacy clip alias", () => {
      const e = engine();
      const c = e.clip("legacy", 100, [track()]);
      expect(c.name).toBe("legacy");
      expect(c.durationTicks).toBe(100);
    });
  });

  describe("clip validation", () => {
    it("accepts a valid clip", () => {
      const e = engine();
      const result = e.validateClipResult(clip(e));
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it("rejects an empty target path", () => {
      const e = engine();
      const c = {
        ...clip(e),
        tracks: [{ targetPath: " ", keyframes: [{ tick: 0, value: 0, interpolation: "linear" as const }] }],
      };
      expect(() => e.validateClip(c)).toThrow(
        "Track targetPath must not be empty.",
      );
    });

    it("rejects a track without keyframes", () => {
      const e = engine();
      const c = {
        ...clip(e),
        tracks: [{ targetPath: "pose.body", keyframes: [] }],
      };
      expect(() => e.validateClip(c)).toThrow(
        "must contain at least one keyframe",
      );
    });

    it("rejects a non-integer keyframe tick", () => {
      const e = engine();
      const c = {
        ...clip(e),
        tracks: [{
          targetPath: "pose.body",
          keyframes: [{ tick: 10.5, value: 1, interpolation: "linear" as const }],
        }],
      };
      const result = e.validateClipResult(c);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects a negative keyframe tick", () => {
      const e = engine();
      const c = {
        ...clip(e),
        tracks: [{
          targetPath: "pose.body",
          keyframes: [{ tick: -1, value: 1, interpolation: "linear" as const }],
        }],
      };
      const result = e.validateClipResult(c);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects a non-finite keyframe value", () => {
      const e = engine();
      const c = {
        ...clip(e),
        tracks: [{
          targetPath: "pose.body",
          keyframes: [{ tick: 0, value: Number.NaN, interpolation: "linear" as const }],
        }],
      };
      expect(e.validateClipResult(c).valid).toBe(false);
    });

    it("rejects a keyframe beyond duration", () => {
      const e = engine();
      const c = {
        ...clip(e),
        tracks: [{
          targetPath: "pose.body",
          keyframes: [{ tick: 101, value: 1, interpolation: "linear" as const }],
        }],
      };
      const result = e.validateClipResult(c);
      expect(result.valid).toBe(false);
      expect(result.errors.some((x) => x.includes("beyond clip duration"))).toBe(true);
    });

    it("rejects invalid events", () => {
      const e = engine();
      const badTick = { ...clip(e), events: [{ tick: 101, type: "event" }] };
      expect(e.validateClipResult(badTick).valid).toBe(false);

      const badType = { ...clip(e), events: [{ tick: 10, type: " " }] };
      expect(e.validateClipResult(badType).valid).toBe(false);
    });
  });

  describe("track sampling", () => {
    it("samples linear interpolation", () => {
      expect(sampleTrack(track(), 50)).toBe(50);
    });

    it("clamps before and after the keyframe range", () => {
      const t = track();
      expect(sampleTrack(t, -10)).toBe(0);
      expect(sampleTrack(t, 200)).toBe(100);
    });

    it("samples step interpolation", () => {
      const t: Track = {
        targetPath: "x",
        keyframes: [
          { tick: 0, value: 2, interpolation: "step" },
          { tick: 100, value: 10, interpolation: "linear" },
        ],
      };
      expect(sampleTrack(t, 50)).toBe(2);
    });

    it("samples smooth interpolation", () => {
      const t: Track = {
        targetPath: "x",
        keyframes: [
          { tick: 0, value: 0, interpolation: "smooth" },
          { tick: 100, value: 10, interpolation: "linear" },
        ],
      };
      expect(sampleTrack(t, 50)).toBe(5);
    });

    it("returns zero for an empty track", () => {
      expect(sampleTrack({ targetPath: "x", keyframes: [] }, 10)).toBe(0);
    });

    it("rejects a non-finite sample tick", () => {
      expect(() => sampleTrack(track(), Number.NaN)).toThrow(
        "Animation sample tick must be finite.",
      );
      expect(() => sampleTrack(track(), Number.POSITIVE_INFINITY)).toThrow(
        "Animation sample tick must be finite.",
      );
    });
  });

  describe("loop evaluation", () => {
    it("handles once mode", () => {
      const c = clip(engine(), { durationTicks: 100, loopMode: "once" });
      expect(resolveLocalTick(c, -10)).toBe(0);
      expect(resolveLocalTick(c, 50)).toBe(50);
      expect(resolveLocalTick(c, 150)).toBe(100);
    });

    it("handles loop mode", () => {
      const c = clip(engine(), { durationTicks: 100, loopMode: "loop" });
      expect(resolveLocalTick(c, 0)).toBe(0);
      expect(resolveLocalTick(c, 100)).toBe(0);
      expect(resolveLocalTick(c, 125)).toBe(25);
      expect(resolveLocalTick(c, -25)).toBe(75);
    });

    it("handles pingpong mode", () => {
      const c = clip(engine(), { durationTicks: 100, loopMode: "pingpong" });
      expect(resolveLocalTick(c, 25)).toBe(25);
      expect(resolveLocalTick(c, 125)).toBe(75);
      expect(resolveLocalTick(c, 175)).toBe(25);
    });

    it("rejects a non-finite loop tick", () => {
      const c = clip(engine());
      expect(() => resolveLocalTick(c, Number.NaN)).toThrow(
        "Animation tick must be finite.",
      );
    });
  });

  describe("layer creation and validation", () => {
    it("creates a default layer", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c);

      expect(l).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        order: 0,
        kind: "base",
        weight: 1,
        clipId: c.id,
        mask: [],
        additive: false,
      });
    });

    it("creates a configured layer with a valid UUID", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c, {
        order: 5,
        kind: "gesture",
        weight: 0.5,
        mask: ["pose.arm.rotation"],
        additive: true,
        id: UUID_A,
      });

      expect(l).toEqual({
        id: UUID_A,
        order: 5,
        kind: "gesture",
        weight: 0.5,
        clipId: c.id,
        mask: ["pose.arm.rotation"],
        additive: true,
      });
    });

    it("clamps layer weight during creation", () => {
      const e = engine();
      const c = clip(e);
      expect(layer(e, c, { weight: -10 }).weight).toBe(0);
      expect(layer(e, c, { weight: 10 }).weight).toBe(1);
    });

    it("rejects an invalid layer UUID", () => {
      const e = engine();
      const c = clip(e);
      expect(() =>
        e.validateLayer({
          id: "not-a-uuid",
          order: 0,
          kind: "base",
          weight: 1,
          clipId: c.id,
          mask: [],
          additive: false,
        }),
      ).toThrow("Invalid motion layer");
    });

    it("rejects a non-finite layer weight", () => {
      const e = engine();
      const c = clip(e);
      expect(() =>
        e.validateLayer({
          id: UUID_B,
          order: 0,
          kind: "base",
          weight: Number.NaN,
          clipId: c.id,
          mask: [],
          additive: false,
        }),
      ).toThrow("weight: Expected number");
    });

    it("rejects a layer weight above one", () => {
      const e = engine();
      const c = clip(e);
      expect(() =>
        e.validateLayer({
          id: UUID_C,
          order: 0,
          kind: "base",
          weight: 1.1,
          clipId: c.id,
          mask: [],
          additive: false,
        }),
      ).toThrow("weight: Number must be less than or equal to 1");
    });

    it("rejects a layer weight below zero", () => {
      const e = engine();
      const c = clip(e);
      expect(() =>
        e.validateLayer({
          id: UUID_D,
          order: 0,
          kind: "base",
          weight: -0.1,
          clipId: c.id,
          mask: [],
          additive: false,
        }),
      ).toThrow("weight: Number must be greater than or equal to 0");
    });
  });

  describe("canonical evaluation", () => {
    it("evaluates one clip and layer", () => {
      const e = engine();
      const c = clip(e, { tracks: [track("pose.arm.rotation", 0, 100)] });
      const l = layer(e, c);

      expect(e.evaluate([c], [l], 50)).toEqual({
        tick: 50,
        values: { "pose.arm.rotation": 50 },
      });
    });

    it("evaluates multiple tracks", () => {
      const e = engine();
      const c = clip(e, {
        tracks: [
          track("pose.arm.rotation", 0, 100),
          track("pose.leg.rotation", 20, 40),
        ],
      });
      const l = layer(e, c);
      const result = e.evaluate([c], [l], 50);

      expect(result.values).toEqual({
        "pose.arm.rotation": 50,
        "pose.leg.rotation": 30,
      });
    });

    it("applies a mask", () => {
      const e = engine();
      const c = clip(e, {
        tracks: [track("pose.arm", 0, 100), track("pose.leg", 0, 100)],
      });
      const l = layer(e, c, { mask: ["pose.arm"] });
      expect(e.evaluate([c], [l], 50).values).toEqual({ "pose.arm": 50 });
    });

    it("skips zero-weight layers", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c, { weight: 0 });
      expect(e.evaluate([c], [l], 50).values).toEqual({});
    });

    it("blends using layer weight", () => {
      const e = engine();
      const c = clip(e, { tracks: [track("x", 0, 100)] });
      const l = layer(e, c, { weight: 0.5 });
      expect(e.evaluate([c], [l], 50).values.x).toBe(25);
    });

    it("applies additive layers", () => {
      const e = engine();
      const base = clip(e, { name: "base", tracks: [track("x", 0, 100)] });
      const add = clip(e, { name: "add", tracks: [track("x", 10, 20)] });
      const baseLayer = layer(e, base, { order: 0 });
      const addLayer = layer(e, add, { order: 1, additive: true });

      expect(
        e.evaluate([base, add], [baseLayer, addLayer], 50).values.x,
      ).toBe(65);
    });

    it("is deterministic regardless of input layer array order", () => {
      const e = engine();
      const a = clip(e, { name: "a", tracks: [track("x", 0, 100)] });
      const b = clip(e, { name: "b", tracks: [track("x", 100, 200)] });
      const la = layer(e, a, { order: 0 });
      const lb = layer(e, b, { order: 1 });

      const one = e.evaluate([a, b], [la, lb], 50);
      const two = e.evaluate([a, b], [lb, la], 50);

      expect(one).toEqual(two);
    });

    it("rejects a missing canonical clip reference", () => {
      const e = engine();
      const missing: MotionLayer = {
        id: UUID_A,
        order: 0,
        kind: "base",
        weight: 1,
        clipId: UUID_B,
        mask: [],
        additive: false,
      };

      expect(() => e.evaluate([], [missing], 0)).toThrow(
        "references missing clip",
      );
    });

    it("rejects canonical evaluation without a tick", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c);

      expect(() =>
        (e.evaluate as unknown as (
          clips: MotionClip[],
          layers: MotionLayer[],
        ) => unknown)([c], [l]),
      ).toThrow("Canonical animation evaluation requires a tick.");
    });

    it("rejects a non-finite evaluation tick", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c);

      expect(() => e.evaluate([c], [l], Number.NaN)).toThrow(
        "Animation evaluation tick must be finite.",
      );
    });
  });

  describe("legacy evaluation", () => {
    it("supports the legacy two-argument API", () => {
      const e = engine();
      const c = clip(e, { tracks: [track("motion.root.x", 0, 100)] });
      const l: LegacyMotionLayer = {
        id: UUID_A,
        order: 0,
        kind: "base",
        weight: 1,
        mask: [],
        additive: false,
        clip: c,
      };

      expect(e.evaluate([l], 50)).toEqual({ "motion.root.x": 50 });
    });

    it("supports legacy masks", () => {
      const e = engine();
      const c = clip(e, {
        tracks: [track("arm", 0, 100), track("leg", 0, 100)],
      });
      const l: LegacyMotionLayer = {
        id: UUID_A,
        order: 0,
        kind: "base",
        weight: 1,
        mask: ["arm"],
        additive: false,
        clip: c,
      };

      expect(e.evaluate([l], 50)).toEqual({ arm: 50 });
    });
  });

  describe("direct clip evaluation", () => {
    it("evaluates a clip directly", () => {
      const e = engine();
      const c = clip(e, { tracks: [track("head.rotation", 0, 90)] });
      expect(e.evaluateClip(c, 50)).toEqual({ "head.rotation": 45 });
    });

    it("respects loop mode", () => {
      const e = engine();
      const c = clip(e, {
        durationTicks: 100,
        loopMode: "loop",
        tracks: [track("x", 0, 100)],
      });
      expect(e.evaluateClip(c, 125)).toEqual({ x: 25 });
    });

    it("returns isolated result data", () => {
      const e = engine();
      const c = clip(e);
      const first = e.evaluateClip(c, 50);
      first["pose.arm.rotation"] = 999;
      expect(e.evaluateClip(c, 50)["pose.arm.rotation"]).toBe(50);
    });
  });

  describe("built-in motions", () => {
    it("creates walk", () => {
      const c = engine().walk();
      expect(c.name).toBe("walk");
      expect(c.durationTicks).toBe(DEFAULT_WALK_DURATION_TICKS);
      expect(c.loopMode).toBe("loop");
      expect(c.semanticCategory).toBe("locomotion");
      expect(c.rigRequirements).toEqual(["humanoid", "legs"]);
    });

    it("creates run", () => {
      const c = engine().run();
      expect(c.name).toBe("run");
      expect(c.durationTicks).toBe(DEFAULT_RUN_DURATION_TICKS);
      expect(c.loopMode).toBe("loop");
      expect(c.semanticCategory).toBe("locomotion");
    });

    it("creates jump", () => {
      const c = engine().jump();
      expect(c.name).toBe("jump");
      expect(c.durationTicks).toBe(DEFAULT_JUMP_DURATION_TICKS);
      expect(c.loopMode).toBe("once");
    });

    it("creates wave", () => {
      const c = engine().wave();
      expect(c.name).toBe("wave");
      expect(c.durationTicks).toBe(DEFAULT_WAVE_DURATION_TICKS);
      expect(c.loopMode).toBe("once");
      expect(c.semanticCategory).toBe("gesture");
    });

    it("creates dance", () => {
      const c = engine().dance();
      expect(c.name).toBe("dance");
      expect(c.durationTicks).toBe(DEFAULT_DANCE_DURATION_TICKS);
      expect(c.loopMode).toBe("loop");
      expect(c.semanticCategory).toBe("dance");
    });

    it("supports custom built-in durations", () => {
      const e = engine();
      expect(e.walk(240).durationTicks).toBe(240);
      expect(e.run(180).durationTicks).toBe(180);
      expect(e.jump(120).durationTicks).toBe(120);
      expect(e.wave(90).durationTicks).toBe(90);
      expect(e.dance(300).durationTicks).toBe(300);
    });
  });

  describe("determinism and immutability", () => {
    it("creates identical clips for identical deterministic input", () => {
      const e = engine();
      const a = clip(e, { deterministicKey: "same" });
      const b = clip(e, { deterministicKey: "same" });

      expect(a.id).toBe(b.id);
      expect(a).toEqual(b);
    });

    it("changes clip identity when deterministic key changes", () => {
      const e = engine();
      const a = clip(e, { deterministicKey: "a" });
      const b = clip(e, { deterministicKey: "b" });
      expect(a.id).not.toBe(b.id);
    });

    it("produces a stable SHA-256 fingerprint", () => {
      const e = engine();
      const c = clip(e, { deterministicKey: "fingerprint" });
      const a = e.fingerprint(c);
      const b = e.fingerprint(structuredClone(c));

      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it("changes fingerprint when clip state changes", () => {
      const e = engine();
      const c = clip(e, { deterministicKey: "fingerprint" });
      const changed = structuredClone(c);
      changed.tracks[0].keyframes[0].value = 999;

      expect(e.fingerprint(c)).not.toBe(e.fingerprint(changed));
    });

    it("does not expose mutable references from validation", () => {
      const e = engine();
      const c = clip(e, {
        rootMotion: { x: 1, nested: { y: 2 } },
        events: [{ tick: 10, type: "test", payload: { value: 1 } }],
      });

      const validated = e.validateClip(c);
      validated.rootMotion.x = 99;
      (validated.rootMotion.nested as Record<string, unknown>).y = 99;
      validated.events[0].type = "changed";

      expect(c.rootMotion.x).toBe(1);
      expect((c.rootMotion.nested as Record<string, unknown>).y).toBe(2);
      expect(c.events[0].type).toBe("test");
    });

    it("does not mutate source layers during evaluation", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c, { mask: ["pose.arm.rotation"] });
      const before = structuredClone(l);

      e.evaluate([c], [l], 50);

      expect(l).toEqual(before);
    });

    it("does not expose mutable evaluation values", () => {
      const e = engine();
      const c = clip(e);
      const l = layer(e, c);
      const first = e.evaluate([c], [l], 50);

      first.values["pose.arm.rotation"] = 999;

      expect(e.evaluate([c], [l], 50).values["pose.arm.rotation"]).toBe(50);
    });
  });
});
