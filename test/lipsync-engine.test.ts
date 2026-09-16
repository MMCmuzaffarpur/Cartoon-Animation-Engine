import { describe, expect, it } from "vitest";

import {
  ALIGNMENT_VERSION,
  DEFAULT_COARTICULATION_STRENGTH,
  DEFAULT_COARTICULATION_TICKS,
  LIP_SYNC_VERSION,
  PHONEME_TO_VISEME,
  VISEME_TO_CONTROLS,
  LipSyncEngine,
  type LipSyncAnalyzer,
  type LipSyncCurve,
  type ManualOverride,
  type PhonemeEvent,
  type VisemeEvent,
} from "../packages/lipsync-engine/src/index.js";

const UUID_V5_SHAPED =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function phoneme(
  startTick: number,
  endTick: number,
  value: string,
  confidence = 1,
): PhonemeEvent {
  return {
    startTick,
    endTick,
    phoneme: value,
    confidence,
  };
}

function viseme(
  startTick: number,
  endTick: number,
  value: string,
  weight = 1,
): VisemeEvent {
  return {
    startTick,
    endTick,
    viseme: value,
    weight,
  };
}

describe("LipSync Engine", () => {
  const engine = new LipSyncEngine();

  describe("initialization and constants", () => {
    it("creates the engine", () => {
      expect(engine).toBeInstanceOf(LipSyncEngine);
      expect(engine.version).toBe(LIP_SYNC_VERSION);
    });

    it("exposes the canonical engine versions", () => {
      expect(LIP_SYNC_VERSION).toBe("1.0.0");
      expect(ALIGNMENT_VERSION).toBe("1.0.0");
    });

    it("exposes deterministic coarticulation defaults", () => {
      expect(DEFAULT_COARTICULATION_TICKS).toBe(1000);
      expect(DEFAULT_COARTICULATION_STRENGTH).toBe(0.65);
    });
  });

  describe("phoneme normalization", () => {
    it("normalizes whitespace and case", () => {
      expect(engine.normalizePhonemes([
        phoneme(0, 100, "  aa "),
      ])).toEqual([
        phoneme(0, 100, "AA"),
      ]);
    });

    it("normalizes silence aliases to SIL", () => {
      expect(
        engine.normalizePhonemes([
          phoneme(0, 100, "silence"),
          phoneme(100, 200, "PAUSE"),
          phoneme(200, 300, "sp"),
        ]).map((item) => item.phoneme),
      ).toEqual(["SIL", "SIL", "SIL"]);
    });

    it("normalizes numbered phonemes", () => {
      expect(
        engine.normalizePhonemes([
          phoneme(0, 100, "AH0"),
          phoneme(100, 200, "ER1"),
        ]).map((item) => item.phoneme),
      ).toEqual(["AH", "ER"]);
    });

    it("sorts normalized phonemes deterministically", () => {
      const result = engine.normalizePhonemes([
        phoneme(200, 300, "B"),
        phoneme(0, 100, "A"),
        phoneme(100, 200, "M"),
      ]);

      expect(result.map((item) => item.startTick)).toEqual([
        0,
        100,
        200,
      ]);
    });

    it("clamps invalid finite confidence values", () => {
      const result = engine.normalizePhonemes([
        phoneme(0, 100, "A", -1),
        phoneme(100, 200, "B", 2),
      ]);

      expect(result.map((item) => item.confidence)).toEqual([
        0,
        1,
      ]);
    });

    it("uses confidence 1 when confidence is non-finite", () => {
      const result = engine.normalizePhonemes([
        phoneme(0, 100, "A", Number.NaN),
        phoneme(100, 200, "B", Number.POSITIVE_INFINITY),
      ]);

      expect(result.map((item) => item.confidence)).toEqual([
        1,
        1,
      ]);
    });

    it("returns a defensive copy", () => {
      const source = [phoneme(0, 100, "A")];
      const result = engine.normalizePhonemes(source);

      result[0].phoneme = "B";

      expect(source[0].phoneme).toBe("A");
    });
  });

  describe("phoneme mapping", () => {
    it("maps vowels to canonical visemes", () => {
      expect(engine.phonemeToViseme("A")).toBe("AI");
      expect(engine.phonemeToViseme("IH")).toBe("E");
      expect(engine.phonemeToViseme("AO")).toBe("O");
      expect(engine.phonemeToViseme("UW")).toBe("U");
    });

    it("maps bilabials to MBP", () => {
      expect(engine.phonemeToViseme("B")).toBe("MBP");
      expect(engine.phonemeToViseme("M")).toBe("MBP");
      expect(engine.phonemeToViseme("P")).toBe("MBP");
    });

    it("maps consonant groups correctly", () => {
      expect(engine.phonemeToViseme("F")).toBe("FV");
      expect(engine.phonemeToViseme("S")).toBe("SZ");
      expect(engine.phonemeToViseme("SH")).toBe("SH");
      expect(engine.phonemeToViseme("K")).toBe("KG");
      expect(engine.phonemeToViseme("R")).toBe("R");
      expect(engine.phonemeToViseme("TH")).toBe("TH");
    });

    it("maps silence and glottal phonemes to REST", () => {
      expect(engine.phonemeToViseme("SIL")).toBe("REST");
      expect(engine.phonemeToViseme("HH")).toBe("REST");
      expect(engine.phonemeToViseme("silence")).toBe("REST");
    });

    it("falls back unknown phonemes to REST", () => {
      expect(engine.phonemeToViseme("UNKNOWN")).toBe("REST");
    });

    it("exposes the same mapping through getPhonemeMapping", () => {
      expect(engine.getPhonemeMapping("AA")).toBe(
        PHONEME_TO_VISEME.AA,
      );
    });
  });

  describe("phonemes to visemes", () => {
    it("converts phoneme timing without changing the timeline", () => {
      const result = engine.phonemesToVisemes([
        phoneme(0, 100, "AA", 0.9),
        phoneme(100, 250, "M", 0.7),
      ]);

      expect(result).toEqual([
        viseme(0, 100, "AI", 0.9),
        viseme(100, 250, "MBP", 0.7),
      ]);
    });

    it("preserves confidence as viseme weight", () => {
      const result = engine.phonemesToVisemes([
        phoneme(0, 100, "A", 0.35),
      ]);

      expect(result[0].weight).toBe(0.35);
    });

    it("normalizes phonemes before conversion", () => {
      const result = engine.phonemesToVisemes([
        phoneme(100, 200, " aa0 ", 1),
      ]);

      expect(result[0]).toEqual(
        viseme(100, 200, "AI", 1),
      );
    });

    it("returns a fresh array", () => {
      const source = [phoneme(0, 100, "A")];
      const result = engine.phonemesToVisemes(source);

      result[0].viseme = "REST";

      expect(source[0].phoneme).toBe("A");
    });
  });

  describe("viseme definitions and controls", () => {
    it("provides all canonical viseme definitions", () => {
      const definitions = engine.getVisemeDefinitions();

      expect(definitions.length).toBe(
        Object.keys(VISEME_TO_CONTROLS).length,
      );

      expect(definitions.map((item) => item.id)).toContain("REST");
      expect(definitions.map((item) => item.id)).toContain("AI");
      expect(definitions.map((item) => item.id)).toContain("MBP");
    });

    it("returns the canonical facial controls for a viseme", () => {
      expect(engine.getControlMapping("AI")).toEqual(
        VISEME_TO_CONTROLS.AI,
      );
    });

    it("returns REST controls for an unknown viseme", () => {
      expect(engine.getControlMapping("NOT_A_VISEME")).toEqual(
        VISEME_TO_CONTROLS.REST,
      );
    });

    it("returns defensive copies of control mappings", () => {
      const result = engine.getControlMapping("AI");
      result.mouthOpen = 0;

      expect(
        engine.getControlMapping("AI").mouthOpen,
      ).toBe(VISEME_TO_CONTROLS.AI.mouthOpen);
    });

    it("returns defensive copies of viseme definitions", () => {
      const definitions = engine.getVisemeDefinitions();
      const ai = definitions.find((item) => item.id === "AI");

      expect(ai).toBeDefined();
      ai!.controls.mouthOpen = 0;

      const again = engine.getVisemeDefinitions();
      const freshAi = again.find((item) => item.id === "AI");

      expect(freshAi!.controls.mouthOpen).toBe(
        VISEME_TO_CONTROLS.AI.mouthOpen,
      );
    });
  });

  describe("coarticulation", () => {
    it("returns an immutable-equivalent copy when there is nothing to blend", () => {
      const source = [
        viseme(0, 100, "AI"),
      ];

      const result = engine.applyCoarticulation(source);

      expect(result).toEqual(source);
      expect(result).not.toBe(source);
    });

    it("returns unchanged values when blendTicks is zero", () => {
      const source = [
        viseme(0, 100, "AI", 1),
        viseme(100, 200, "E", 0.5),
      ];

      expect(
        engine.applyCoarticulation(source, 0),
      ).toEqual(source);
    });

    it("returns unchanged values when strength is zero", () => {
      const source = [
        viseme(0, 100, "AI", 1),
        viseme(100, 200, "E", 0.5),
      ];

      expect(
        engine.applyCoarticulation(source, 1000, 0),
      ).toEqual(source);
    });

    it("rejects a negative blend duration", () => {
      expect(() =>
        engine.applyCoarticulation(
          [viseme(0, 100, "AI"), viseme(200, 300, "E")],
          -1,
        ),
      ).toThrow(/blendTicks/);
    });

    it("rejects a non-integer blend duration", () => {
      expect(() =>
        engine.applyCoarticulation(
          [viseme(0, 100, "AI"), viseme(200, 300, "E")],
          1.5,
        ),
      ).toThrow(/blendTicks/);
    });

    it("rejects an invalid coarticulation strength", () => {
      expect(() =>
        engine.applyCoarticulation(
          [viseme(0, 100, "AI"), viseme(200, 300, "E")],
          1000,
          1.1,
        ),
      ).toThrow(/strength/);
    });

    it("normalizes overlapping weights", () => {
      const result = engine.applyCoarticulation([
        viseme(0, 200, "AI", 1),
        viseme(100, 300, "E", 1),
      ]);

      expect(result[0].weight).toBe(0.5);
      expect(result[1].weight).toBe(0.5);
    });

    it("adjusts nearby non-overlapping events deterministically", () => {
      const source = [
        viseme(0, 100, "AI", 1),
        viseme(500, 600, "E", 1),
      ];

      const first = engine.applyCoarticulation(source, 1000, 0.65);
      const second = engine.applyCoarticulation(source, 1000, 0.65);

      expect(first).toEqual(second);
      expect(first[0].weight).toBeLessThan(1);
      expect(first[1].weight).toBeLessThan(1);
    });

    it("does not mutate source visemes", () => {
      const source = [
        viseme(0, 200, "AI", 1),
        viseme(100, 300, "E", 1),
      ];

      const before = structuredClone(source);
      engine.applyCoarticulation(source);

      expect(source).toEqual(before);
    });
  });

  describe("curve generation", () => {
    it("generates facial curves for every control in the active mapping", () => {
      const result = engine.generateCurves([
        viseme(0, 100, "AI", 1),
      ]);

      expect(result.length).toBe(
        Object.keys(VISEME_TO_CONTROLS.AI).length,
      );

      expect(
        result.every((curve) =>
          curve.targetPath.startsWith("facial."),
        ),
      ).toBe(true);
    });

    it("supports a custom target prefix", () => {
      const result = engine.generateCurves(
        [viseme(0, 100, "AI", 1)],
        { targetPrefix: "character.face" },
      );

      expect(result[0].targetPath).toMatch(
        /^character\.face\./,
      );
    });

    it("supports linear interpolation metadata", () => {
      const result = engine.generateCurves(
        [viseme(0, 100, "AI", 1)],
        { interpolation: "linear" },
      );

      expect(
        result.every((curve) => curve.interpolation === "linear"),
      ).toBe(true);
    });

    it("blends neighboring viseme states instead of forcing every curve to zero", () => {
      const result = engine.generateCurves([
        viseme(0, 100, "AI", 1),
        viseme(100, 200, "O", 1),
      ]);

      const mouthOpen = result.filter(
        (curve) => curve.targetPath === "facial.mouthOpen",
      );

      expect(mouthOpen.length).toBe(2);
      expect(mouthOpen[1].startValue).not.toBe(0);
    });

    it("clamps generated curve values to the canonical control range", () => {
      const result = engine.generateCurves([
        viseme(0, 100, "AI", 1),
      ]);

      expect(
        result.every(
          (curve) =>
            curve.startValue >= -1 &&
            curve.startValue <= 1 &&
            curve.endValue >= -1 &&
            curve.endValue <= 1,
        ),
      ).toBe(true);
    });

    it("is deterministic for identical viseme input", () => {
      const input = [
        viseme(0, 100, "AI", 0.8),
        viseme(100, 200, "E", 0.7),
      ];

      expect(engine.generateCurves(input)).toEqual(
        engine.generateCurves(input),
      );
    });
  });

  describe("alignment", () => {
    it("runs the complete phoneme-to-curve pipeline", () => {
      const result = engine.align([
        phoneme(0, 100, "AA", 1),
        phoneme(100, 200, "M", 1),
      ]);

      expect(result.language).toBe("en-IN");
      expect(result.phonemes.length).toBe(2);
      expect(result.visemes.length).toBe(2);
      expect(result.curves.length).toBeGreaterThan(0);
    });

    it("normalizes the language during alignment", () => {
      expect(
        engine.align([], "hindi").language,
      ).toBe("hi-IN");

      expect(
        engine.align([], "english").language,
      ).toBe("en-IN");

      expect(
        engine.align([], "hinglish").language,
      ).toBe("hi-en");
    });

    it("supports custom coarticulation settings", () => {
      const result = engine.align(
        [
          phoneme(0, 100, "A"),
          phoneme(150, 250, "E"),
        ],
        "en-IN",
        {
          coarticulationTicks: 50,
          coarticulationStrength: 0.25,
        },
      );

      expect(result.visemes).toHaveLength(2);
    });

    it("does not mutate phoneme input", () => {
      const source = [
        phoneme(100, 200, "M"),
        phoneme(0, 100, "A"),
      ];

      const before = structuredClone(source);
      engine.align(source);

      expect(source).toEqual(before);
    });
  });

  describe("track creation", () => {
    it("creates a canonical lip-sync track", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "AA"),
        phoneme(100, 200, "M"),
      ]);

      expect(track.id).toMatch(UUID_V5_SHAPED);
      expect(track.audioAssetId).toBeNull();
      expect(track.language).toBe("en-IN");
      expect(track.analyzer).toBe("phoneme-events");
      expect(track.version).toBe(LIP_SYNC_VERSION);
      expect(track.alignmentVersion).toBe(
        ALIGNMENT_VERSION,
      );
      expect(track.phonemes).toHaveLength(2);
      expect(track.visemes).toHaveLength(2);
      expect(track.curves.length).toBeGreaterThan(0);
      expect(track.manualOverrides).toEqual([]);
      expect(track.provenance.deterministic).toBe(true);
    });

    it("creates deterministic track ids for identical input", () => {
      const input = [
        phoneme(0, 100, "AA", 0.9),
        phoneme(100, 200, "M", 0.8),
      ];

      const first = engine.createTrack(input);
      const second = engine.createTrack(input);

      expect(first.id).toBe(second.id);
      expect(engine.fingerprint(first)).toBe(
        engine.fingerprint(second),
      );
    });

    it("changes track identity when the deterministic key changes", () => {
      const input = [phoneme(0, 100, "AA")];

      const first = engine.createTrack(input, {
        deterministicKey: "take-1",
      });

      const second = engine.createTrack(input, {
        deterministicKey: "take-2",
      });

      expect(first.id).not.toBe(second.id);
    });

    it("preserves audio asset identity", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "AA")],
        { audioAssetId: "00000000-0000-4000-8000-000000000010" },
      );

      expect(track.audioAssetId).toBe(
        "00000000-0000-4000-8000-000000000010",
      );
    });

    it("preserves analyzer and provenance metadata", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "AA")],
        {
          analyzer: "test-analyzer",
          version: "2.0.0",
          alignmentVersion: "2.1.0",
          provenance: {
            source: "unit-test",
            model: "local",
          },
        },
      );

      expect(track.analyzer).toBe("test-analyzer");
      expect(track.version).toBe("2.0.0");
      expect(track.alignmentVersion).toBe("2.1.0");
      expect(track.provenance).toMatchObject({
        deterministic: true,
        source: "unit-test",
        model: "local",
      });
    });

    it("accepts manual overrides during track creation", () => {
      const override: ManualOverride = {
        startTick: 20,
        endTick: 80,
        viseme: "O",
        weight: 0.75,
      };

      const track = engine.createTrack(
        [phoneme(0, 100, "AA")],
        { manualOverrides: [override] },
      );

      expect(track.manualOverrides).toEqual([override]);
    });

    it("does not mutate createTrack inputs", () => {
      const phonemes = [phoneme(0, 100, " aa ")];
      const overrides: ManualOverride[] = [
        {
          startTick: 10,
          endTick: 50,
          controls: { mouthOpen: 0.5 },
        },
      ];

      const beforePhonemes = structuredClone(phonemes);
      const beforeOverrides = structuredClone(overrides);

      engine.createTrack(phonemes, {
        manualOverrides: overrides,
      });

      expect(phonemes).toEqual(beforePhonemes);
      expect(overrides).toEqual(beforeOverrides);
    });
  });

  describe("word timing fallback", () => {
    it("creates deterministic phoneme timing from a word", () => {
      const track = engine.fromWordTiming([
        {
          word: "ABC",
          startTick: 0,
          endTick: 300,
        },
      ]);

      expect(track.phonemes).toHaveLength(3);
      expect(track.phonemes[0].startTick).toBe(0);
      expect(track.phonemes[0].endTick).toBe(100);
      expect(track.phonemes[1].startTick).toBe(100);
      expect(track.phonemes[1].endTick).toBe(200);
      expect(track.phonemes[2].startTick).toBe(200);
      expect(track.phonemes[2].endTick).toBe(300);
    });

    it("distributes remainder ticks deterministically", () => {
      const track = engine.fromWordTiming([
        {
          word: "ABC",
          startTick: 0,
          endTick: 302,
        },
      ]);

      expect(
        track.phonemes.map(
          (item) => item.endTick - item.startTick,
        ),
      ).toEqual([101, 101, 100]);
    });

    it("creates a silence phoneme for an empty word", () => {
      const track = engine.fromWordTiming([
        {
          word: "   ",
          startTick: 0,
          endTick: 100,
        },
      ]);

      expect(track.phonemes).toEqual([
        phoneme(0, 100, "SIL", 1),
      ]);
    });

    it("supports Hindi graphemes through the fallback", () => {
      const track = engine.fromWordTiming(
        [
          {
            word: "अ",
            startTick: 0,
            endTick: 100,
          },
        ],
        "hi-IN",
      );

      expect(track.phonemes[0].phoneme).toBe("AH");
      expect(track.visemes[0].viseme).toBe("AI");
    });

    it("rejects invalid word timing", () => {
      expect(() =>
        engine.fromWordTiming([
          {
            word: "ABC",
            startTick: 100,
            endTick: 100,
          },
        ]),
      ).toThrow(/Invalid word timing/);
    });

    it("rejects a word whose duration is too short for segmentation", () => {
      expect(() =>
        engine.fromWordTiming([
          {
            word: "ABC",
            startTick: 0,
            endTick: 2,
          },
        ]),
      ).toThrow(/does not have enough ticks/);
    });
  });

  describe("grapheme to phoneme", () => {
    it("maps core Hindi vowels", () => {
      expect(engine.graphemeToPhoneme("अ", "hi-IN")).toBe("AH");
      expect(engine.graphemeToPhoneme("आ", "hi-IN")).toBe("AA");
      expect(engine.graphemeToPhoneme("इ", "hi-IN")).toBe("IH");
      expect(engine.graphemeToPhoneme("ई", "hi-IN")).toBe("EE");
      expect(engine.graphemeToPhoneme("उ", "hi-IN")).toBe("UH");
      expect(engine.graphemeToPhoneme("ऊ", "hi-IN")).toBe("UW");
    });

    it("maps Hindi consonants", () => {
      expect(engine.graphemeToPhoneme("क", "hi-IN")).toBe("K");
      expect(engine.graphemeToPhoneme("ग", "hi-IN")).toBe("G");
      expect(engine.graphemeToPhoneme("च", "hi-IN")).toBe("CH");
      expect(engine.graphemeToPhoneme("ज", "hi-IN")).toBe("JH");
      expect(engine.graphemeToPhoneme("त", "hi-IN")).toBe("T");
      expect(engine.graphemeToPhoneme("द", "hi-IN")).toBe("D");
      expect(engine.graphemeToPhoneme("प", "hi-IN")).toBe("P");
      expect(engine.graphemeToPhoneme("म", "hi-IN")).toBe("M");
      expect(engine.graphemeToPhoneme("र", "hi-IN")).toBe("R");
      expect(engine.graphemeToPhoneme("स", "hi-IN")).toBe("S");
    });

    it("maps Hindi nasal and aspiration marks", () => {
      expect(engine.graphemeToPhoneme("ं", "hi-IN")).toBe("N");
      expect(engine.graphemeToPhoneme("ँ", "hi-IN")).toBe("N");
      expect(engine.graphemeToPhoneme("ः", "hi-IN")).toBe("HH");
      expect(engine.graphemeToPhoneme("्", "hi-IN")).toBe("SIL");
    });

    it("maps Latin characters for English", () => {
      expect(engine.graphemeToPhoneme("A", "en-IN")).toBe("AE");
      expect(engine.graphemeToPhoneme("B", "en-IN")).toBe("B");
      expect(engine.graphemeToPhoneme("M", "en-IN")).toBe("M");
      expect(engine.graphemeToPhoneme("R", "en-IN")).toBe("R");
    });

    it("uses Hindi-friendly Latin vowel mapping for Hindi", () => {
      expect(engine.graphemeToPhoneme("A", "hi-IN")).toBe("AA");
      expect(engine.graphemeToPhoneme("O", "hi-IN")).toBe("AO");
    });

    it("returns SIL for unsupported graphemes", () => {
      expect(engine.graphemeToPhoneme("?", "en-IN")).toBe("SIL");
    });

    it("returns SIL for an empty grapheme", () => {
      expect(engine.graphemeToPhoneme("   ", "en-IN")).toBe("SIL");
    });
  });

  describe("viseme sampling", () => {
    it("returns the strongest active viseme", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A", 0.4),
        phoneme(0, 100, "M", 0.9),
      ]);

      const sample = engine.visemeAt(track, 50);

      expect(sample.viseme).toBe("MBP");
      expect(sample.weight).toBeGreaterThanOrEqual(0.4);
    });

    it("returns REST outside all viseme intervals", () => {
      const track = engine.createTrack([
        phoneme(100, 200, "A"),
      ]);

      expect(engine.visemeAt(track, 0)).toEqual({
        viseme: "REST",
        weight: 0,
      });

      expect(engine.visemeAt(track, 200)).toEqual({
        viseme: "REST",
        weight: 0,
      });
    });

    it("uses the interval start as inclusive and end as exclusive", () => {
      const track = engine.createTrack([
        phoneme(100, 200, "A"),
      ]);

      expect(engine.visemeAt(track, 100).viseme).toBe("AI");
      expect(engine.visemeAt(track, 200).viseme).toBe("REST");
    });

    it("rejects non-integer sampling ticks", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(() =>
        engine.visemeAt(track, 1.5),
      ).toThrow(/tick must be an integer/);
    });
  });

  describe("facial controls sampling", () => {
    it("evaluates active viseme controls", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A", 1),
      ]);

      const result = engine.controlsAt(track, 50);

      expect(result.controls.mouthOpen).toBe(
        VISEME_TO_CONTROLS.AI.mouthOpen,
      );
      expect(result.controls.mouthWide).toBe(
        VISEME_TO_CONTROLS.AI.mouthWide,
      );
    });

    it("returns an empty control set outside active visemes", () => {
      const track = engine.createTrack([
        phoneme(100, 200, "A"),
      ]);

      expect(engine.controlsAt(track, 0)).toEqual({
        controls: {},
      });
    });

    it("combines multiple active visemes and clamps controls", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A", 1),
        phoneme(0, 100, "O", 1),
      ]);

      const result = engine.controlsAt(track, 50);

      expect(result.controls.mouthOpen).toBeLessThanOrEqual(1);
      expect(result.controls.mouthOpen).toBeGreaterThanOrEqual(-1);
    });

    it("applies explicit manual control overrides", () => {
      const override: ManualOverride = {
        startTick: 0,
        endTick: 100,
        controls: {
          mouthOpen: 0.9,
          jawOpen: -0.4,
        },
      };

      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        { manualOverrides: [override] },
      );

      const result = engine.controlsAt(track, 50);

      expect(result.controls.mouthOpen).toBe(0.9);
      expect(result.controls.jawOpen).toBe(-0.4);
    });

    it("applies manual override weight", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        {
          manualOverrides: [
            {
              startTick: 0,
              endTick: 100,
              weight: 0.5,
              controls: {
                mouthOpen: 1,
              },
            },
          ],
        },
      );

      expect(
        engine.controlsAt(track, 50).controls.mouthOpen,
      ).toBe(0.5);
    });

    it("supports manual viseme overrides", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        {
          manualOverrides: [
            {
              startTick: 0,
              endTick: 100,
              viseme: "O",
            },
          ],
        },
      );

      expect(engine.visemeAt(track, 50)).toEqual({
        viseme: "O",
        weight: 1,
      });

      expect(
        engine.controlsAt(track, 50).controls.mouthNarrow,
      ).toBe(VISEME_TO_CONTROLS.O.mouthNarrow);
    });

    it("rejects non-integer control sampling ticks", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(() =>
        engine.controlsAt(track, 1.25),
      ).toThrow(/tick must be an integer/);
    });
  });

  describe("manual overrides", () => {
    it("adds overrides without mutating the original track", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const override: ManualOverride = {
        startTick: 20,
        endTick: 80,
        viseme: "O",
      };

      const next = engine.applyManualOverrides(
        track,
        [override],
      );

      expect(track.manualOverrides).toEqual([]);
      expect(next.manualOverrides).toHaveLength(1);
      expect(next.manualOverrides[0]).toEqual(override);
    });

    it("preserves existing overrides", () => {
      const first: ManualOverride = {
        startTick: 0,
        endTick: 20,
        viseme: "E",
      };

      const second: ManualOverride = {
        startTick: 20,
        endTick: 40,
        viseme: "O",
      };

      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        { manualOverrides: [first] },
      );

      const next = engine.applyManualOverrides(
        track,
        [second],
      );

      expect(next.manualOverrides).toEqual([
        first,
        second,
      ]);
    });

    it("rejects invalid override timing", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(() =>
        engine.applyManualOverrides(track, [
          {
            startTick: 100,
            endTick: 100,
            viseme: "O",
          },
        ]),
      ).toThrow(/timing/);
    });

    it("rejects invalid override weights", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(() =>
        engine.applyManualOverrides(track, [
          {
            startTick: 0,
            endTick: 100,
            weight: 2,
            viseme: "O",
          },
        ]),
      ).toThrow(/between 0 and 1/);
    });

    it("rejects empty override visemes", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(() =>
        engine.applyManualOverrides(track, [
          {
            startTick: 0,
            endTick: 100,
            viseme: "   ",
          },
        ]),
      ).toThrow(/must not be empty/);
    });

    it("rejects non-finite override controls", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(() =>
        engine.applyManualOverrides(track, [
          {
            startTick: 0,
            endTick: 100,
            controls: {
              mouthOpen: Number.NaN,
            },
          },
        ]),
      ).toThrow(/must be finite/);
    });
  });

  describe("curve sampling", () => {
    const linear: LipSyncCurve = {
      startTick: 0,
      endTick: 100,
      targetPath: "facial.mouthOpen",
      startValue: 0,
      endValue: 1,
      interpolation: "linear",
    };

    it("returns the start value before the curve begins", () => {
      expect(engine.sampleCurve(linear, -1)).toBe(0);
    });

    it("returns the start value at the curve start", () => {
      expect(engine.sampleCurve(linear, 0)).toBe(0);
    });

    it("returns the end value at the curve end", () => {
      expect(engine.sampleCurve(linear, 100)).toBe(1);
    });

    it("returns the end value after the curve ends", () => {
      expect(engine.sampleCurve(linear, 200)).toBe(1);
    });

    it("samples linear interpolation", () => {
      expect(engine.sampleCurve(linear, 50)).toBe(0.5);
    });

    it("samples step interpolation", () => {
      expect(
        engine.sampleCurve(
          { ...linear, interpolation: "step" },
          50,
        ),
      ).toBe(0);
    });

    it("samples smooth interpolation", () => {
      expect(
        engine.sampleCurve(
          { ...linear, interpolation: "smooth" },
          50,
        ),
      ).toBe(0.5);
    });

    it("rejects non-finite curve sample ticks", () => {
      expect(() =>
        engine.sampleCurve(linear, Number.NaN),
      ).toThrow(/must be finite/);
    });

    it("handles a zero-span curve defensively", () => {
      expect(
        engine.sampleCurve(
          { ...linear, endTick: 0 },
          0,
        ),
      ).toBe(0);
    });
  });

  describe("track validation", () => {
    it("validates a generated canonical track", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(engine.validate(track)).toEqual(track);
    });

    it("returns valid for a canonical generated track", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const result = engine.validateResult(track);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects invalid phoneme timing", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const invalid = structuredClone(track);
      invalid.phonemes[0].endTick = 0;

      const result = engine.validateResult(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) =>
        error.includes("phonemes[0]"),
      )).toBe(true);
    });

    it("rejects invalid viseme weight", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const invalid = structuredClone(track);
      invalid.visemes[0].weight = 2;

      const result = engine.validateResult(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) =>
        error.includes("visemes[0].weight"),
      )).toBe(true);
    });

    it("rejects empty curve target paths", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const invalid = structuredClone(track);
      (
        invalid.curves[0] as Record<string, unknown>
      ).targetPath = "";

      const result = engine.validateResult(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) =>
        error.includes("targetPath"),
      )).toBe(true);
    });

    it("rejects malformed manual overrides", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const invalid = structuredClone(track);
      invalid.manualOverrides = [
        {
          startTick: 50,
          endTick: 50,
          viseme: "O",
        },
      ];

      const result = engine.validateResult(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) =>
        error.includes("manualOverrides[0]"),
      )).toBe(true);
    });

    it("rejects unsorted phoneme events", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
        phoneme(100, 200, "M"),
      ]);

      const invalid = structuredClone(track);
      [
        invalid.phonemes[0],
        invalid.phonemes[1],
      ] = [
        invalid.phonemes[1],
        invalid.phonemes[0],
      ];

      const result = engine.validateResult(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) =>
        error.includes("Phoneme events must be ordered"),
      )).toBe(true);
    });

    it("throws when validating an invalid track", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const invalid = structuredClone(track);
      invalid.phonemes[0].confidence = 2;

      expect(() =>
        engine.validate(invalid),
      ).toThrow(/Invalid lip-sync track/);
    });
  });

  describe("fingerprinting and determinism", () => {
    it("produces a SHA-256 fingerprint", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      expect(engine.fingerprint(track)).toMatch(
        /^[0-9a-f]{64}$/,
      );
    });

    it("produces identical fingerprints for identical tracks", () => {
      const input = [
        phoneme(0, 100, "A"),
        phoneme(100, 200, "M"),
      ];

      const first = engine.createTrack(input);
      const second = engine.createTrack(input);

      expect(engine.fingerprint(first)).toBe(
        engine.fingerprint(second),
      );
    });

    it("changes the fingerprint when the track changes", () => {
      const first = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const second = engine.createTrack([
        phoneme(0, 100, "E"),
      ]);

      expect(engine.fingerprint(first)).not.toBe(
        engine.fingerprint(second),
      );
    });

    it("reports deterministic processing for identical phoneme input", () => {
      expect(
        engine.isDeterministic([
          phoneme(0, 100, "A"),
          phoneme(100, 200, "M"),
        ]),
      ).toBe(true);
    });

    it("does not mutate the source while fingerprinting", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
      ]);

      const before = structuredClone(track);
      engine.fingerprint(track);

      expect(track).toEqual(before);
    });
  });

  describe("analyzer adapter", () => {
    it("runs a local analyzer adapter and creates a canonical track", async () => {
      const calls: Array<{
        audioAssetId?: string | null;
        language: string;
      }> = [];

      const analyzer: LipSyncAnalyzer = {
        id: "test-local-analyzer",
        version: "1.0.0",
        async analyze(input) {
          calls.push(input);

          return [
            phoneme(0, 100, "AA", 0.95),
            phoneme(100, 200, "M", 0.9),
          ];
        },
      };

      const track = await engine.analyze(
        analyzer,
        {
          audioAssetId:
            "00000000-0000-4000-8000-000000000010",
          language: "hindi",
        },
      );

      expect(calls).toEqual([
        {
          audioAssetId:
            "00000000-0000-4000-8000-000000000010",
          language: "hi-IN",
        },
      ]);

      expect(track.analyzer).toBe(
        "test-local-analyzer",
      );
      expect(track.provenance).toMatchObject({
        analyzerId: "test-local-analyzer",
        analyzerVersion: "1.0.0",
      });
      expect(track.language).toBe("hi-IN");
    });

    it("passes null audio asset identity when none is supplied", async () => {
      let received:
        | {
            audioAssetId?: string | null;
            language: string;
          }
        | undefined;

      const analyzer: LipSyncAnalyzer = {
        id: "test",
        version: "1.0.0",
        async analyze(input) {
          received = input;
          return [];
        },
      };

      await engine.analyze(analyzer, {});

      expect(received).toEqual({
        audioAssetId: null,
        language: "en-IN",
      });
    });

    it("rejects an invalid analyzer", async () => {
      await expect(
        engine.analyze(
          null as unknown as LipSyncAnalyzer,
          {},
        ),
      ).rejects.toThrow(/valid lip-sync analyzer/);
    });

    it("preserves caller provenance while adding analyzer provenance", async () => {
      const analyzer: LipSyncAnalyzer = {
        id: "test",
        version: "2.0.0",
        async analyze() {
          return [phoneme(0, 100, "A")];
        },
      };

      const track = await engine.analyze(
        analyzer,
        {},
        {
          provenance: {
            source: "unit-test",
          },
        },
      );

      expect(track.provenance).toMatchObject({
        deterministic: true,
        source: "unit-test",
        analyzerId: "test",
        analyzerVersion: "2.0.0",
      });
    });
  });

  describe("immutability", () => {
    it("does not mutate the canonical phoneme-to-viseme mapping", () => {
      const before = structuredClone(PHONEME_TO_VISEME);

      engine.phonemeToViseme("A");
      engine.phonemesToVisemes([
        phoneme(0, 100, "A"),
      ]);

      expect(PHONEME_TO_VISEME).toEqual(before);
    });

    it("does not mutate the canonical viseme control mapping", () => {
      const before = structuredClone(VISEME_TO_CONTROLS);

      engine.getControlMapping("AI");
      engine.generateCurves([
        viseme(0, 100, "AI"),
      ]);

      expect(VISEME_TO_CONTROLS).toEqual(before);
    });
  });

  describe("edge cases", () => {
    it("creates an empty track from an empty phoneme list", () => {
      const track = engine.createTrack([]);

      expect(track.phonemes).toEqual([]);
      expect(track.visemes).toEqual([]);
      expect(track.curves).toEqual([]);
      expect(engine.validateResult(track).valid).toBe(true);
    });

    it("supports an unknown language without changing the supplied language", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        { language: "bn-IN" },
      );

      expect(track.language).toBe("bn-IN");
    });

    it("normalizes blank language to en-IN", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        { language: "   " },
      );

      expect(track.language).toBe("en-IN");
    });

    it("supports negative facial control override values", () => {
      const track = engine.createTrack(
        [phoneme(0, 100, "A")],
        {
          manualOverrides: [
            {
              startTick: 0,
              endTick: 100,
              controls: {
                jawLeft: -1,
              },
            },
          ],
        },
      );

      expect(
        engine.controlsAt(track, 50).controls.jawLeft,
      ).toBe(-1);
    });

    it("keeps deterministic output after repeated evaluation", () => {
      const track = engine.createTrack([
        phoneme(0, 100, "A"),
        phoneme(100, 200, "E"),
        phoneme(200, 300, "M"),
      ]);

      const first = {
        viseme: engine.visemeAt(track, 150),
        controls: engine.controlsAt(track, 150),
        fingerprint: engine.fingerprint(track),
      };

      const second = {
        viseme: engine.visemeAt(track, 150),
        controls: engine.controlsAt(track, 150),
        fingerprint: engine.fingerprint(track),
      };

      expect(second).toEqual(first);
    });
  });
});
