import { describe, expect, it } from "vitest";

import {
  AudioEngine,
  DEFAULT_CHANNELS,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_VOLUME,
  DEFAULT_PAN,
  MAX_VOLUME,
  MIN_PAN,
  MAX_PAN,
  type AudioClip,
} from "../packages/audio-engine/src/index.js";

describe("AudioEngine", () => {
  const engine = new AudioEngine();

  const assetId =
    "00000000-0000-4000-8000-000000000001";

  function createClip(
    startTick = 0,
    endTick = 100,
    options: Parameters<AudioEngine["clip"]>[3] = {},
  ): AudioClip {
    return engine.clip(
      assetId,
      startTick,
      endTick,
      options,
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Creation                                                               */
  /* ---------------------------------------------------------------------- */

  it("creates a valid audio clip with defaults", () => {
    const clip = createClip();

    expect(clip.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    expect(clip.assetId).toBe(assetId);
    expect(clip.startTick).toBe(0);
    expect(clip.endTick).toBe(100);
    expect(clip.volume).toBe(
      DEFAULT_VOLUME,
    );
    expect(clip.pan).toBe(
      DEFAULT_PAN,
    );
    expect(clip.fadeInTicks).toBe(0);
    expect(clip.fadeOutTicks).toBe(0);
  });

  it("creates a clip without an asset", () => {
    const clip = engine.clip(
      null,
      10,
      20,
    );

    expect(clip.assetId).toBeNull();
    expect(clip.startTick).toBe(10);
    expect(clip.endTick).toBe(20);
  });

  it("creates a named audio track", () => {
    const track = engine.track(
      "Dialogue",
      assetId,
      10,
      200,
      {
        volume: 0.8,
        pan: -0.25,
      },
    );

    expect(track.name).toBe(
      "Dialogue",
    );
    expect(track.assetId).toBe(
      assetId,
    );
    expect(track.startTick).toBe(10);
    expect(track.endTick).toBe(200);
    expect(track.volume).toBe(0.8);
    expect(track.pan).toBe(-0.25);
  });

  it("rejects an empty track name", () => {
    expect(() =>
      engine.track(
        "   ",
        assetId,
        0,
        100,
      ),
    ).toThrow(
      "Audio track name must not be empty.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Range Validation                                                       */
  /* ---------------------------------------------------------------------- */

  it("rejects a negative start tick", () => {
    expect(() =>
      engine.clip(
        assetId,
        -1,
        100,
      ),
    ).toThrow(
      "Audio startTick must be a non-negative integer.",
    );
  });

  it("rejects a negative end tick", () => {
    expect(() =>
      engine.clip(
        assetId,
        0,
        -1,
      ),
    ).toThrow(
      "Audio endTick must be a non-negative integer.",
    );
  });

  it("rejects a non-integer start tick", () => {
    expect(() =>
      engine.clip(
        assetId,
        1.5,
        100,
      ),
    ).toThrow(
      "Audio startTick must be a non-negative integer.",
    );
  });

  it("rejects a non-integer end tick", () => {
    expect(() =>
      engine.clip(
        assetId,
        0,
        100.5,
      ),
    ).toThrow(
      "Audio endTick must be a non-negative integer.",
    );
  });

  it("rejects an end tick equal to the start tick", () => {
    expect(() =>
      engine.clip(
        assetId,
        100,
        100,
      ),
    ).toThrow(
      "Audio endTick must be greater than startTick.",
    );
  });

  it("rejects an end tick before the start tick", () => {
    expect(() =>
      engine.clip(
        assetId,
        200,
        100,
      ),
    ).toThrow(
      "Audio endTick must be greater than startTick.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Clip Validation                                                        */
  /* ---------------------------------------------------------------------- */

  it("reports a valid clip through validateClipResult", () => {
    const clip = createClip();

    const result =
      engine.validateClipResult(
        clip,
      );

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("detects an empty clip id", () => {
    const clip = createClip();

    const result =
      engine.validateClipResult({
        ...clip,
        id: " ",
      });

    expect(result.valid).toBe(
      false,
    );

    expect(
      result.errors,
    ).toContain(
      "Audio clip id must not be empty.",
    );
  });

  it("detects invalid volume", () => {
    const clip = createClip();

    const result =
      engine.validateClipResult({
        ...clip,
        volume: MAX_VOLUME + 1,
      });

    expect(result.valid).toBe(
      false,
    );

    expect(
      result.errors,
    ).toContain(
      `Audio volume must be between 0 and ${MAX_VOLUME}.`,
    );
  });

  it("detects invalid pan", () => {
    const clip = createClip();

    const result =
      engine.validateClipResult({
        ...clip,
        pan: 2,
      });

    expect(result.valid).toBe(
      false,
    );

    expect(
      result.errors,
    ).toContain(
      "Audio pan must be between -1 and 1.",
    );
  });

  it("detects invalid fade values", () => {
    const clip = createClip();

    const result =
      engine.validateClipResult({
        ...clip,
        fadeInTicks: -1,
        fadeOutTicks: 1.5,
      });

    expect(result.valid).toBe(
      false,
    );

    expect(
      result.errors,
    ).toContain(
      "Audio fadeInTicks must be a non-negative integer.",
    );

    expect(
      result.errors,
    ).toContain(
      "Audio fadeOutTicks must be a non-negative integer.",
    );
  });

  it("rejects fade-in longer than the clip", () => {
    expect(() =>
      createClip(
        0,
        100,
        {
          fadeInTicks: 101,
        },
      ),
    ).toThrow(
      "Audio fadeInTicks must not exceed clip duration.",
    );
  });

  it("rejects fade-out longer than the clip", () => {
    expect(() =>
      createClip(
        0,
        100,
        {
          fadeOutTicks: 101,
        },
      ),
    ).toThrow(
      "Audio fadeOutTicks must not exceed clip duration.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Gain Evaluation                                                        */
  /* ---------------------------------------------------------------------- */

  it("returns full volume inside a clip without fades", () => {
    const clip = createClip(
      10,
      110,
      {
        volume: 0.75,
      },
    );

    expect(
      engine.gainAt(
        clip,
        10,
      ),
    ).toBe(0.75);

    expect(
      engine.gainAt(
        clip,
        50,
      ),
    ).toBe(0.75);

    expect(
      engine.gainAt(
        clip,
        110,
      ),
    ).toBe(0.75);
  });

  it("returns zero outside a clip", () => {
    const clip = createClip(
      10,
      110,
      {
        volume: 0.75,
      },
    );

    expect(
      engine.gainAt(
        clip,
        9,
      ),
    ).toBe(0);

    expect(
      engine.gainAt(
        clip,
        111,
      ),
    ).toBe(0);
  });

  it("applies fade-in gain", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1,
        fadeInTicks: 20,
      },
    );

    expect(
      engine.gainAt(
        clip,
        0,
      ),
    ).toBe(0);

    expect(
      engine.gainAt(
        clip,
        10,
      ),
    ).toBeCloseTo(0.5);

    expect(
      engine.gainAt(
        clip,
        20,
      ),
    ).toBe(1);
  });

  it("applies fade-out gain", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1,
        fadeOutTicks: 20,
      },
    );

    expect(
      engine.gainAt(
        clip,
        100,
      ),
    ).toBe(0);

    expect(
      engine.gainAt(
        clip,
        90,
      ),
    ).toBeCloseTo(0.5);

    expect(
      engine.gainAt(
        clip,
        80,
      ),
    ).toBe(1);
  });

  it("uses the lower gain when fade-in and fade-out overlap", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1,
        fadeInTicks: 60,
        fadeOutTicks: 60,
      },
    );

    expect(
      engine.gainAt(
        clip,
        20,
      ),
    ).toBeCloseTo(
      Math.min(
        20 / 60,
        80 / 60,
      ),
    );

    expect(
      engine.gainAt(
        clip,
        50,
      ),
    ).toBeCloseTo(
      Math.min(
        50 / 60,
        50 / 60,
      ),
    );
  });

  it("rejects a non-finite evaluation tick", () => {
    const clip = createClip();

    expect(() =>
      engine.gainAt(
        clip,
        Number.NaN,
      ),
    ).toThrow(
      "Audio evaluation tick must be finite.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Stereo Evaluation                                                      */
  /* ---------------------------------------------------------------------- */

  it("evaluates centered pan equally on both channels", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1,
        pan: 0,
      },
    );

    const evaluation =
      engine.evaluate(
        clip,
        50,
      );

    expect(evaluation.active).toBe(
      true,
    );

    expect(evaluation.gain).toBe(1);

    expect(
      evaluation.leftGain,
    ).toBeCloseTo(
      Math.SQRT1_2,
    );

    expect(
      evaluation.rightGain,
    ).toBeCloseTo(
      Math.SQRT1_2,
    );
  });

  it("evaluates full-left pan", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1,
        pan: MIN_PAN,
      },
    );

    const evaluation =
      engine.evaluate(
        clip,
        50,
      );

    expect(
      evaluation.leftGain,
    ).toBeCloseTo(1);

    expect(
      evaluation.rightGain,
    ).toBeCloseTo(0);
  });

  it("evaluates full-right pan", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1,
        pan: MAX_PAN,
      },
    );

    const evaluation =
      engine.evaluate(
        clip,
        50,
      );

    expect(
      evaluation.leftGain,
    ).toBeCloseTo(0);

    expect(
      evaluation.rightGain,
    ).toBeCloseTo(1);
  });

  it("marks an evaluation inactive when gain is zero", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 0,
      },
    );

    const evaluation =
      engine.evaluate(
        clip,
        50,
      );

    expect(evaluation.active).toBe(
      false,
    );

    expect(evaluation.gain).toBe(0);
    expect(
      evaluation.leftGain,
    ).toBe(0);
    expect(
      evaluation.rightGain,
    ).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /* Volume                                                                  */
  /* ---------------------------------------------------------------------- */

  it("sets volume", () => {
    const clip = createClip();

    const updated =
      engine.setVolume(
        clip,
        0.5,
      );

    expect(updated.volume).toBe(
      0.5,
    );

    expect(clip.volume).toBe(
      DEFAULT_VOLUME,
    );
  });

  it("clamps volume to the supported range", () => {
    const clip = createClip();

    expect(
      engine.setVolume(
        clip,
        -1,
      ).volume,
    ).toBe(0);

    expect(
      engine.setVolume(
        clip,
        999,
      ).volume,
    ).toBe(MAX_VOLUME);
  });

  it("rejects a non-finite volume", () => {
    const clip = createClip();

    expect(() =>
      engine.setVolume(
        clip,
        Number.NaN,
      ),
    ).toThrow(
      "Audio volume must be finite.",
    );
  });

  it("multiplies volume", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 0.5,
      },
    );

    const updated =
      engine.multiplyVolume(
        clip,
        1.5,
      );

    expect(updated.volume).toBe(
      0.75,
    );

    expect(clip.volume).toBe(
      0.5,
    );
  });

  it("clamps multiplied volume to MAX_VOLUME", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 1.5,
      },
    );

    const updated =
      engine.multiplyVolume(
        clip,
        2,
      );

    expect(updated.volume).toBe(
      MAX_VOLUME,
    );
  });

  it("rejects a negative volume multiplier", () => {
    const clip = createClip();

    expect(() =>
      engine.multiplyVolume(
        clip,
        -1,
      ),
    ).toThrow(
      "Audio volume multiplier must be a non-negative finite number.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Pan                                                                     */
  /* ---------------------------------------------------------------------- */

  it("sets pan", () => {
    const clip = createClip();

    const updated =
      engine.setPan(
        clip,
        -0.5,
      );

    expect(updated.pan).toBe(
      -0.5,
    );

    expect(clip.pan).toBe(
      DEFAULT_PAN,
    );
  });

  it("clamps pan to the supported range", () => {
    const clip = createClip();

    expect(
      engine.setPan(
        clip,
        -10,
      ).pan,
    ).toBe(MIN_PAN);

    expect(
      engine.setPan(
        clip,
        10,
      ).pan,
    ).toBe(MAX_PAN);
  });

  it("rejects a non-finite pan", () => {
    const clip = createClip();

    expect(() =>
      engine.setPan(
        clip,
        Number.POSITIVE_INFINITY,
      ),
    ).toThrow(
      "Audio pan must be finite.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Fades                                                                   */
  /* ---------------------------------------------------------------------- */

  it("sets valid fades", () => {
    const clip = createClip(
      0,
      100,
    );

    const updated =
      engine.setFades(
        clip,
        20,
        30,
      );

    expect(
      updated.fadeInTicks,
    ).toBe(20);

    expect(
      updated.fadeOutTicks,
    ).toBe(30);
  });

  it("rejects invalid fade-in values", () => {
    const clip = createClip();

    expect(() =>
      engine.setFades(
        clip,
        -1,
        0,
      ),
    ).toThrow(
      "fadeInTicks must be a non-negative integer.",
    );
  });

  it("rejects invalid fade-out values", () => {
    const clip = createClip();

    expect(() =>
      engine.setFades(
        clip,
        0,
        1.5,
      ),
    ).toThrow(
      "fadeOutTicks must be a non-negative integer.",
    );
  });

  it("rejects fades longer than the clip duration", () => {
    const clip = createClip(
      0,
      100,
    );

    expect(() =>
      engine.setFades(
        clip,
        101,
        0,
      ),
    ).toThrow(
      "Audio fadeInTicks must not exceed clip duration.",
    );

    expect(() =>
      engine.setFades(
        clip,
        0,
        101,
      ),
    ).toThrow(
      "Audio fadeOutTicks must not exceed clip duration.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Mix Intent                                                              */
  /* ---------------------------------------------------------------------- */

  it("creates a default mix intent", () => {
    const clips = [
      createClip(
        0,
        100,
      ),
      createClip(
        100,
        200,
      ),
    ];

    const intent =
      engine.mixIntent(
        clips,
      );

    expect(
      intent.sampleRate,
    ).toBe(
      DEFAULT_SAMPLE_RATE,
    );

    expect(
      intent.channels,
    ).toBe(
      DEFAULT_CHANNELS,
    );

    expect(
      intent.normalization,
    ).toBe("peak");

    expect(
      intent.tracks,
    ).toHaveLength(2);
  });

  it("creates a custom mix intent", () => {
    const clip = createClip();

    const intent =
      engine.mixIntent(
        [clip],
        {
          sampleRate: 44_100,
          channels: 1,
          normalization: "none",
        },
      );

    expect(
      intent.sampleRate,
    ).toBe(44_100);

    expect(
      intent.channels,
    ).toBe(1);

    expect(
      intent.normalization,
    ).toBe("none");
  });

  it("rejects an invalid sample rate", () => {
    const clip = createClip();

    expect(() =>
      engine.mixIntent(
        [clip],
        {
          sampleRate: 0,
        },
      ),
    ).toThrow(
      "Audio sample rate must be a positive integer.",
    );
  });

  it("rejects an invalid channel count", () => {
    const clip = createClip();

    expect(() =>
      engine.mixIntent(
        [clip],
        {
          channels: 0,
        },
      ),
    ).toThrow(
      "Audio channel count must be a positive integer.",
    );
  });

  it("does not mutate source clips when creating a mix intent", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 0.75,
        pan: -0.25,
        fadeInTicks: 10,
        fadeOutTicks: 20,
      },
    );

    const before =
      structuredClone(
        clip,
      );

    const intent =
      engine.mixIntent(
        [clip],
      );

    expect(clip).toEqual(
      before,
    );

    expect(
      intent.tracks[0],
    ).toEqual({
      id: clip.id,
      assetId: clip.assetId,
      startTick: clip.startTick,
      endTick: clip.endTick,
      volume: clip.volume,
      pan: clip.pan,
      fadeInTicks:
        clip.fadeInTicks,
      fadeOutTicks:
        clip.fadeOutTicks,
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Track Normalization                                                     */
  /* ---------------------------------------------------------------------- */

  it("sorts tracks by start tick", () => {
    const first = createClip(
      100,
      200,
    );

    const second = createClip(
      0,
      50,
    );

    const third = createClip(
      50,
      100,
    );

    const result =
      engine.normalizeTracks([
        first,
        third,
        second,
      ]);

    expect(
      result.map(
        (clip) =>
          clip.startTick,
      ),
    ).toEqual([
      0,
      50,
      100,
    ]);
  });

  it("sorts equal start ticks by end tick", () => {
    const longClip = createClip(
      0,
      200,
    );

    const shortClip = createClip(
      0,
      100,
    );

    const result =
      engine.normalizeTracks([
        longClip,
        shortClip,
      ]);

    expect(
      result[0].endTick,
    ).toBe(100);

    expect(
      result[1].endTick,
    ).toBe(200);
  });

  it("does not mutate clips during normalization", () => {
    const first = createClip(
      100,
      200,
    );

    const second = createClip(
      0,
      100,
    );

    const beforeFirst =
      structuredClone(
        first,
      );

    const beforeSecond =
      structuredClone(
        second,
      );

    engine.normalizeTracks([
      first,
      second,
    ]);

    expect(first).toEqual(
      beforeFirst,
    );

    expect(second).toEqual(
      beforeSecond,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Duration                                                                */
  /* ---------------------------------------------------------------------- */

  it("returns zero duration for no clips", () => {
    expect(
      engine.duration([]),
    ).toBe(0);
  });

  it("returns the greatest end tick", () => {
    const clips = [
      createClip(
        0,
        100,
      ),
      createClip(
        20,
        500,
      ),
      createClip(
        50,
        300,
      ),
    ];

    expect(
      engine.duration(clips),
    ).toBe(500);
  });

  /* ---------------------------------------------------------------------- */
  /* Clone                                                                   */
  /* ---------------------------------------------------------------------- */

  it("clones a clip without sharing mutable state", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 0.5,
      },
    );

    const cloned =
      engine.clone(
        clip,
      );

    expect(cloned).toEqual(
      clip,
    );

    expect(cloned).not.toBe(
      clip,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Fingerprint                                                             */
  /* ---------------------------------------------------------------------- */

  it("produces a deterministic fingerprint", () => {
    const clip: AudioClip = {
      id: assetId,
      assetId,
      startTick: 0,
      endTick: 100,
      volume: 1,
      pan: 0,
      fadeInTicks: 10,
      fadeOutTicks: 20,
    };

    const first =
      engine.fingerprint(
        clip,
      );

    const second =
      engine.fingerprint(
        structuredClone(
          clip,
        ),
      );

    expect(first).toBe(
      second,
    );

    expect(first).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("changes the fingerprint when clip content changes", () => {
    const clip: AudioClip = {
      id: assetId,
      assetId,
      startTick: 0,
      endTick: 100,
      volume: 1,
      pan: 0,
      fadeInTicks: 10,
      fadeOutTicks: 20,
    };

    const original =
      engine.fingerprint(
        clip,
      );

    const changed =
      engine.fingerprint({
        ...clip,
        volume: 0.5,
      });

    expect(changed).not.toBe(
      original,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Canonical Contract                                                      */
  /* ---------------------------------------------------------------------- */

  it("converts a valid clip to a canonical audio track", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 0.8,
        pan: -0.2,
        fadeInTicks: 10,
        fadeOutTicks: 20,
      },
    );

    const canonical =
      engine.toCanonicalTrack(
        clip,
        "Dialogue",
      );

    expect(canonical).toEqual({
      id: clip.id,
      name: "Dialogue",
      assetId: assetId,
      startTick: 0,
      endTick: 100,
      volume: 0.8,
      pan: -0.2,
      fadeInTicks: 10,
      fadeOutTicks: 20,
    });
  });

  it("rejects an empty canonical track name", () => {
    const clip = createClip();

    expect(() =>
      engine.toCanonicalTrack(
        clip,
        " ",
      ),
    ).toThrow(
      "Audio track name must not be empty.",
    );
  });

  it("rejects a clip with a non-UUID asset id during canonical conversion", () => {
    const clip =
      engine.clip(
        "not-a-uuid",
        0,
        100,
      );

    expect(() =>
      engine.toCanonicalTrack(
        clip,
      ),
    ).toThrow(
      "Invalid canonical audio track:",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Immutability                                                            */
  /* ---------------------------------------------------------------------- */

  it("does not mutate the original clip when changing volume", () => {
    const clip = createClip(
      0,
      100,
      {
        volume: 0.5,
      },
    );

    const updated =
      engine.setVolume(
        clip,
        1.5,
      );

    expect(clip.volume).toBe(
      0.5,
    );

    expect(updated.volume).toBe(
      1.5,
    );
  });

  it("does not mutate the original clip when changing pan", () => {
    const clip = createClip(
      0,
      100,
      {
        pan: 0.2,
      },
    );

    const updated =
      engine.setPan(
        clip,
        -0.8,
      );

    expect(clip.pan).toBe(
      0.2,
    );

    expect(updated.pan).toBe(
      -0.8,
    );
  });

  it("does not mutate the original clip when changing fades", () => {
    const clip = createClip();

    const updated =
      engine.setFades(
        clip,
        10,
        20,
      );

    expect(
      clip.fadeInTicks,
    ).toBe(0);

    expect(
      clip.fadeOutTicks,
    ).toBe(0);

    expect(
      updated.fadeInTicks,
    ).toBe(10);

    expect(
      updated.fadeOutTicks,
    ).toBe(20);
  });
});