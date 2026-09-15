import { describe, expect, it } from "vitest";

import {
  CompositionEngine,
  createCompositionEngine,
  type Caption,
  type Composition,
  type CompositionAudio,
  type CompositionLayer,
  type CompositionScene,
  type Transition,
} from "../packages/composition-engine/src/index.js";

const makeEngine = (): CompositionEngine =>
  createCompositionEngine();

const makeScene = (
  e: CompositionEngine,
  start = 0,
  end = 100,
  options: Parameters<CompositionEngine["scene"]>[3] = {},
): CompositionScene =>
  e.scene(
    "scene-1",
    start,
    end,
    {
      name: "Scene 1",
      representation: "hybrid",
      ...options,
    },
  );

const makeLayer = (
  e: CompositionEngine,
  start = 0,
  end = 100,
  options: Parameters<CompositionEngine["layer"]>[4] = {},
): CompositionLayer =>
  e.layer(
    "entity-1",
    "scene-1",
    start,
    end,
    options,
  );

const makeCaption = (
  e: CompositionEngine,
  start = 0,
  end = 100,
  options: Partial<Caption> = {},
): Caption =>
  e.caption(
    "Hello",
    start,
    end,
    options,
  );

const makeAudio = (
  e: CompositionEngine,
  start = 0,
  end = 100,
  options: Parameters<CompositionEngine["audio"]>[3] = {},
): CompositionAudio =>
  e.audio(
    "audio-1",
    start,
    end,
    options,
  );

const makeTransition = (
  e: CompositionEngine,
  start = 0,
  end = 10,
): Transition =>
  e.transition(
    "fade",
    start,
    end,
  );

function emptyComposition(
  e: CompositionEngine,
): Composition {
  return e.build(
    [],
    [],
    [],
    [],
    [],
  );
}

describe("composition-engine", () => {
  /* ---------------------------------------------------------------------- */
  /* Factory / capabilities                                                 */
  /* ---------------------------------------------------------------------- */

  it("creates a CompositionEngine", () => {
    const e = makeEngine();

    expect(e).toBeInstanceOf(
      CompositionEngine,
    );

    expect(e.version).toBe("1.0.0");
  });

  it("exposes composition capabilities", () => {
    const e = makeEngine();

    expect(
      e.capabilities,
    ).toEqual({
      adapterId: "composition-core",
      adapterVersion: "1.0.0",
      contractVersion: "1.0.0",
      capabilities: {
        "composition.scenes": "supported",
        "composition.layers": "supported",
        "composition.captions": "supported",
        "composition.transitions": "supported",
        "composition.audio": "supported",
        "composition.timeline": "supported",
        "composition.deterministic": "supported",
      },
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Caption                                                                */
  /* ---------------------------------------------------------------------- */

  it("creates a caption with defaults", () => {
    const e = makeEngine();

    const caption = e.caption(
      "  Hello world  ",
      10,
      50,
    );

    expect(caption.text).toBe(
      "Hello world",
    );

    expect(caption.startTick).toBe(10);
    expect(caption.endTick).toBe(50);

    expect(caption.x).toBe(640);
    expect(caption.y).toBe(660);

    expect(caption.style).toEqual({
      fontFamily: "sans-serif",
      fontSize: 32,
    });

    expect(caption.id).toBeTruthy();
  });

  it("supports caption overrides", () => {
    const e = makeEngine();

    const caption = e.caption(
      "Title",
      0,
      20,
      {
        id: "caption-1",
        x: 100,
        y: 200,
        style: {
          fontSize: 48,
          fontWeight: "bold",
        },
      },
    );

    expect(caption).toEqual({
      id: "caption-1",
      text: "Title",
      startTick: 0,
      endTick: 20,
      x: 100,
      y: 200,
      style: {
        fontFamily: "sans-serif",
        fontSize: 48,
        fontWeight: "bold",
      },
    });
  });

  it("rejects empty caption text", () => {
    const e = makeEngine();

    expect(() =>
      e.caption(
        "   ",
        0,
        10,
      ),
    ).toThrow(
      "Caption text must not be empty.",
    );
  });

  it("rejects invalid caption ranges", () => {
    const e = makeEngine();

    expect(() =>
      e.caption(
        "Hello",
        10,
        10,
      ),
    ).toThrow(
      "Caption endTick must be greater than startTick.",
    );

    expect(() =>
      e.caption(
        "Hello",
        20,
        10,
      ),
    ).toThrow(
      "Caption endTick must be greater than startTick.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Transition                                                             */
  /* ---------------------------------------------------------------------- */

  it("creates supported transitions", () => {
    const e = makeEngine();

    for (
      const type of [
        "cut",
        "fade",
        "dissolve",
        "slide",
      ] as const
    ) {
      const transition = e.transition(
        type,
        10,
        20,
        {
          softness: 0.5,
        },
      );

      expect(transition).toMatchObject({
        type,
        startTick: 10,
        endTick: 20,
        params: {
          softness: 0.5,
        },
      });

      expect(transition.id).toBeTruthy();
    }
  });

  it("rejects unsupported transition types", () => {
    const e = makeEngine();

    expect(() =>
      e.transition(
        "zoom" as never,
        0,
        10,
      ),
    ).toThrow(
      'Unsupported transition type "zoom".',
    );
  });

  it("rejects invalid transition ranges", () => {
    const e = makeEngine();

    expect(() =>
      e.transition(
        "fade",
        10,
        10,
      ),
    ).toThrow(
      "Transition endTick must be greater than startTick.",
    );

    expect(() =>
      e.transition(
        "fade",
        -1,
        10,
      ),
    ).toThrow(
      "Transition startTick must not be negative.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Scene                                                                  */
  /* ---------------------------------------------------------------------- */

  it("creates a composition scene", () => {
    const e = makeEngine();

    const item = e.scene(
      "scene-42",
      100,
      200,
    );

    expect(item).toMatchObject({
      sceneId: "scene-42",
      name: "scene-42",
      startTick: 100,
      endTick: 200,
      representation: "hybrid",
      layerIds: [],
    });

    expect(item.id).toBeTruthy();
  });

  it("creates a fully configured composition scene", () => {
    const e = makeEngine();

    const item = e.scene(
      "scene-42",
      0,
      100,
      {
        id: "comp-scene-1",
        name: "Opening",
        representation: "2d",
        layerIds: [
          "layer-1",
          "layer-2",
        ],
        transitionInId: "transition-in",
        transitionOutId: "transition-out",
        metadata: {
          location: "classroom",
        },
      },
    );

    expect(item).toEqual({
      id: "comp-scene-1",
      name: "Opening",
      sceneId: "scene-42",
      representation: "2d",
      startTick: 0,
      endTick: 100,
      layerIds: [
        "layer-1",
        "layer-2",
      ],
      transitionInId: "transition-in",
      transitionOutId: "transition-out",
      metadata: {
        location: "classroom",
      },
    });
  });

  it("rejects invalid scene input", () => {
    const e = makeEngine();

    expect(() =>
      e.scene(
        "",
        0,
        10,
      ),
    ).toThrow(
      "Scene ID must not be empty.",
    );

    expect(() =>
      e.scene(
        "scene",
        10,
        10,
      ),
    ).toThrow(
      "Scene endTick must be greater than startTick.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Layer                                                                  */
  /* ---------------------------------------------------------------------- */

  it("creates a composition layer with defaults", () => {
    const e = makeEngine();

    const layer = e.layer(
      "entity-1",
      "scene-1",
      0,
      100,
    );

    expect(layer).toMatchObject({
      entityId: "entity-1",
      sceneId: "scene-1",
      startTick: 0,
      endTick: 100,
      zIndex: 0,
      visible: true,
      opacity: 1,
    });

    expect(layer.id).toBeTruthy();
  });

  it("normalizes layer zIndex and opacity", () => {
    const e = makeEngine();

    const layer = e.layer(
      "entity-1",
      "scene-1",
      0,
      100,
      {
        zIndex: 12.9,
        visible: false,
        opacity: 2,
      },
    );

    expect(layer.zIndex).toBe(12);
    expect(layer.visible).toBe(false);
    expect(layer.opacity).toBe(1);

    const lowOpacity = e.layer(
      "entity-2",
      "scene-1",
      0,
      100,
      {
        opacity: -1,
      },
    );

    expect(lowOpacity.opacity).toBe(0);
  });

  it("rejects invalid layer input", () => {
    const e = makeEngine();

    expect(() =>
      e.layer(
        "",
        "scene-1",
        0,
        10,
      ),
    ).toThrow(
      "Layer entityId must not be empty.",
    );

    expect(() =>
      e.layer(
        "entity-1",
        "",
        0,
        10,
      ),
    ).toThrow(
      "Layer sceneId must not be empty.",
    );

    expect(() =>
      e.layer(
        "entity-1",
        "scene-1",
        10,
        10,
      ),
    ).toThrow(
      "Layer endTick must be greater than startTick.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Audio                                                                  */
  /* ---------------------------------------------------------------------- */

  it("creates audio with defaults", () => {
    const e = makeEngine();

    const clip = e.audio(
      "music-1",
      0,
      100,
    );

    expect(clip).toMatchObject({
      assetId: "music-1",
      startTick: 0,
      endTick: 100,
      volume: 1,
      pan: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
    });

    expect(clip.id).toBeTruthy();
  });

  it("supports null audio assets", () => {
    const e = makeEngine();

    const clip = e.audio(
      null,
      0,
      100,
    );

    expect(clip.assetId).toBeNull();
  });

  it("clamps audio pan and fade ranges", () => {
    const e = makeEngine();

    const clip = e.audio(
      "music",
      0,
      100,
      {
        volume: -2,
        pan: 10,
        fadeInTicks: 500,
        fadeOutTicks: -1,
      },
    );

    expect(clip.volume).toBe(1);
    expect(clip.pan).toBe(1);
    expect(clip.fadeInTicks).toBe(100);
    expect(clip.fadeOutTicks).toBe(0);
  });

  it("rejects invalid audio range", () => {
    const e = makeEngine();

    expect(() =>
      e.audio(
        "music",
        100,
        100,
      ),
    ).toThrow(
      "Audio endTick must be greater than startTick.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Opacity / transition evaluation                                        */
  /* ---------------------------------------------------------------------- */

  it("evaluates fade-in opacity", () => {
    const e = makeEngine();

    expect(
      e.opacity(
        0,
        0,
        100,
        "in",
      ),
    ).toBe(0);

    expect(
      e.opacity(
        50,
        0,
        100,
        "in",
      ),
    ).toBe(0.5);

    expect(
      e.opacity(
        100,
        0,
        100,
        "in",
      ),
    ).toBe(1);
  });

  it("evaluates fade-out opacity", () => {
    const e = makeEngine();

    expect(
      e.opacity(
        0,
        0,
        100,
        "out",
      ),
    ).toBe(1);

    expect(
      e.opacity(
        50,
        0,
        100,
        "out",
      ),
    ).toBe(0.5);

    expect(
      e.opacity(
        100,
        0,
        100,
        "out",
      ),
    ).toBe(0);
  });

  it("clamps opacity outside its range", () => {
    const e = makeEngine();

    expect(
      e.opacity(
        -10,
        0,
        100,
        "in",
      ),
    ).toBe(0);

    expect(
      e.opacity(
        150,
        0,
        100,
        "in",
      ),
    ).toBe(1);

    expect(
      e.opacity(
        -10,
        0,
        100,
        "out",
      ),
    ).toBe(1);

    expect(
      e.opacity(
        150,
        0,
        100,
        "out",
      ),
    ).toBe(0);
  });

  it("rejects invalid opacity ranges and modes", () => {
    const e = makeEngine();

    expect(() =>
      e.opacity(
        10,
        10,
        10,
      ),
    ).toThrow(
      "Opacity end must be greater than start.",
    );

    expect(() =>
      e.opacity(
        10,
        0,
        100,
        "invalid" as never,
      ),
    ).toThrow(
      'Unsupported opacity mode "invalid".',
    );
  });

  it("evaluates transition opacity", () => {
    const e = makeEngine();

    const transition =
      e.transition(
        "fade",
        0,
        100,
      );

    expect(
      e.transitionOpacity(
        transition,
        -1,
      ),
    ).toBe(0);

    expect(
      e.transitionOpacity(
        transition,
        50,
      ),
    ).toBe(0.5);

    expect(
      e.transitionOpacity(
        transition,
        100,
      ),
    ).toBe(1);
  });

  /* ---------------------------------------------------------------------- */
  /* Audio gain evaluation                                                  */
  /* ---------------------------------------------------------------------- */

  it("evaluates audio gain with volume", () => {
    const e = makeEngine();

    const clip = e.audio(
      "voice",
      0,
      100,
      {
        volume: 0.75,
      },
    );

    expect(
      e.audioGainAt(
        clip,
        -1,
      ),
    ).toBe(0);

    expect(
      e.audioGainAt(
        clip,
        50,
      ),
    ).toBe(0.75);

    expect(
      e.audioGainAt(
        clip,
        100,
      ),
    ).toBe(0.75);

    expect(
      e.audioGainAt(
        clip,
        101,
      ),
    ).toBe(0);
  });

  it("evaluates audio fade-in and fade-out", () => {
    const e = makeEngine();

    const clip = e.audio(
      "voice",
      0,
      100,
      {
        volume: 1,
        fadeInTicks: 20,
        fadeOutTicks: 20,
      },
    );

    expect(
      e.audioGainAt(
        clip,
        0,
      ),
    ).toBe(0);

    expect(
      e.audioGainAt(
        clip,
        10,
      ),
    ).toBe(0.5);

    expect(
      e.audioGainAt(
        clip,
        50,
      ),
    ).toBe(1);

    expect(
      e.audioGainAt(
        clip,
        90,
      ),
    ).toBe(0.5);

    expect(
      e.audioGainAt(
        clip,
        100,
      ),
    ).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /* Collection helpers                                                     */
  /* ---------------------------------------------------------------------- */

  it("adds and sorts scenes", () => {
    const e = makeEngine();

    const first = e.scene(
      "scene-a",
      100,
      200,
    );

    const second = e.scene(
      "scene-b",
      0,
      50,
    );

    const result = e.addScene(
      [first],
      second,
    );

    expect(
      result.map(
        (x) => x.sceneId,
      ),
    ).toEqual([
      "scene-b",
      "scene-a",
    ]);

    expect(
      result,
    ).not.toBe(
      [first],
    );
  });

  it("sorts scenes with deterministic tie-breaking", () => {
    const e = makeEngine();

    const z = e.scene(
      "scene-z",
      0,
      100,
      {
        id: "z",
      },
    );

    const a = e.scene(
      "scene-a",
      0,
      100,
      {
        id: "a",
      },
    );

    const result = e.addScene(
      [z],
      a,
    );

    expect(
      result.map(
        (x) => x.id,
      ),
    ).toEqual([
      "a",
      "z",
    ]);
  });

  it("adds and sorts layers", () => {
    const e = makeEngine();

    const high = e.layer(
      "high",
      "scene",
      0,
      100,
      {
        id: "high",
        zIndex: 10,
      },
    );

    const low = e.layer(
      "low",
      "scene",
      0,
      100,
      {
        id: "low",
        zIndex: 1,
      },
    );

    const result = e.addLayer(
      [high],
      low,
    );

    expect(
      result.map(
        (x) => x.id,
      ),
    ).toEqual([
      "low",
      "high",
    ]);
  });

  it("adds and sorts captions, transitions and audio", () => {
    const e = makeEngine();

    const lateCaption =
      e.caption(
        "Late",
        100,
        200,
        {
          id: "late",
        },
      );

    const earlyCaption =
      e.caption(
        "Early",
        0,
        50,
        {
          id: "early",
        },
      );

    expect(
      e.addCaption(
        [lateCaption],
        earlyCaption,
      ).map(
        (x) => x.id,
      ),
    ).toEqual([
      "early",
      "late",
    ]);

    const lateTransition =
      e.transition(
        "fade",
        100,
        120,
      );

    const earlyTransition =
      e.transition(
        "fade",
        0,
        20,
      );

    expect(
      e.addTransition(
        [lateTransition],
        earlyTransition,
      )[0].startTick,
    ).toBe(0);

    const lateAudio =
      e.audio(
        "late",
        100,
        200,
      );

    const earlyAudio =
      e.audio(
        "early",
        0,
        50,
      );

    expect(
      e.addAudio(
        [lateAudio],
        earlyAudio,
      )[0].assetId,
    ).toBe("early");
  });

  /* ---------------------------------------------------------------------- */
  /* Duration / active items                                                */
  /* ---------------------------------------------------------------------- */

  it("calculates composition duration from all ranges", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            20,
            100,
          ),
        ],
        [
          e.layer(
            "entity",
            "scene",
            10,
            250,
          ),
        ],
        [
          e.caption(
            "Caption",
            0,
            300,
          ),
        ],
        [
          e.transition(
            "fade",
            50,
            150,
          ),
        ],
        [
          e.audio(
            "audio",
            100,
            200,
          ),
        ],
      );

    expect(
      e.duration(composition),
    ).toBe(300);
  });

  it("returns active scenes, layers, captions and audio", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            0,
            100,
          ),
        ],
        [
          e.layer(
            "entity",
            "scene",
            0,
            100,
            {
              visible: true,
            },
          ),
          e.layer(
            "hidden",
            "scene",
            0,
            100,
            {
              id: "hidden",
              visible: false,
            },
          ),
        ],
        [
          e.caption(
            "Hello",
            20,
            80,
          ),
        ],
        [
          e.transition(
            "fade",
            40,
            60,
          ),
        ],
        [
          e.audio(
            "voice",
            30,
            90,
          ),
        ],
      );

    expect(
      e.activeScenes(
        composition,
        50,
      ),
    ).toHaveLength(1);

    expect(
      e.activeLayers(
        composition,
        50,
      ).map(
        (x) => x.entityId,
      ),
    ).toEqual([
      "entity",
    ]);

    expect(
      e.activeCaptions(
        composition,
        50,
      ),
    ).toHaveLength(1);

    expect(
      e.activeAudio(
        composition,
        50,
      ),
    ).toHaveLength(1);

    expect(
      e.activeTransitions(
        composition,
        50,
      ),
    ).toHaveLength(1);
  });

  it("uses half-open active ranges", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            0,
            100,
          ),
        ],
        [],
        [],
        [],
        [],
      );

    expect(
      e.activeScenes(
        composition,
        0,
      ),
    ).toHaveLength(1);

    expect(
      e.activeScenes(
        composition,
        99,
      ),
    ).toHaveLength(1);

    expect(
      e.activeScenes(
        composition,
        100,
      ),
    ).toHaveLength(0);
  });

  /* ---------------------------------------------------------------------- */
  /* Build                                                                   */
  /* ---------------------------------------------------------------------- */

  it("builds an empty composition", () => {
    const e = makeEngine();

    const composition =
      emptyComposition(e);

    expect(
      composition.schemaVersion,
    ).toBe("1.0.0");

    expect(
      composition.name,
    ).toBe("Untitled Composition");

    expect(
      composition.representation,
    ).toBe("hybrid");

    expect(
      composition.startTick,
    ).toBe(0);

    expect(
      composition.endTick,
    ).toBe(0);

    expect(
      composition.scenes,
    ).toEqual([]);

    expect(
      composition.layers,
    ).toEqual([]);

    expect(
      composition.captions,
    ).toEqual([]);

    expect(
      composition.transitions,
    ).toEqual([]);

    expect(
      composition.audio,
    ).toEqual([]);

    expect(
      composition.metadata,
    ).toEqual({});

    expect(
      composition.id,
    ).toBeTruthy();
  });

  it("builds and sorts a configured composition", () => {
    const e = makeEngine();

    const sceneLate =
      e.scene(
        "late",
        100,
        200,
        {
          id: "scene-late",
        },
      );

    const sceneEarly =
      e.scene(
        "early",
        0,
        50,
        {
          id: "scene-early",
        },
      );

    const layer =
      e.layer(
        "entity",
        "early",
        10,
        75,
      );

    const caption =
      e.caption(
        "Caption",
        20,
        40,
      );

    const transition =
      e.transition(
        "fade",
        0,
        10,
      );

    const audio =
      e.audio(
        "audio",
        150,
        300,
      );

    const composition =
      e.build(
        [
          sceneLate,
          sceneEarly,
        ],
        [layer],
        [caption],
        [transition],
        [audio],
        {
          name: "Episode 1",
          representation: "2d",
          metadata: {
            episode: 1,
          },
        },
      );

    expect(
      composition.name,
    ).toBe("Episode 1");

    expect(
      composition.representation,
    ).toBe("2d");

    expect(
      composition.startTick,
    ).toBe(0);

    expect(
      composition.endTick,
    ).toBe(300);

    expect(
      composition.scenes.map(
        (x) => x.id,
      ),
    ).toEqual([
      "scene-early",
      "scene-late",
    ]);

    expect(
      composition.metadata,
    ).toEqual({
      episode: 1,
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Validation                                                              */
  /* ---------------------------------------------------------------------- */

  it("validates a valid composition", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            0,
            100,
          ),
        ],
        [],
        [],
        [],
        [],
      );

    expect(
      e.validate(composition),
    ).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it("rejects an unsupported schema version", () => {
    const e = makeEngine();

    const composition =
      emptyComposition(e);

    (
      composition as unknown as {
        schemaVersion: string;
      }
    ).schemaVersion = "2.0.0";

    const result =
      e.validate(composition);

    expect(
      result.valid,
    ).toBe(false);

    expect(
      result.errors,
    ).toContain(
      'Unsupported composition schema version "2.0.0".',
    );
  });

  it("rejects invalid composition range", () => {
    const e = makeEngine();

    const composition =
      emptyComposition(e);

    composition.startTick = 100;
    composition.endTick = 50;

    const result =
      e.validate(composition);

    expect(
      result.valid,
    ).toBe(false);

    expect(
      result.errors,
    ).toContain(
      "Composition endTick must be greater than startTick.",
    );
  });

  it("detects duplicate IDs", () => {
    const e = makeEngine();

    const firstScene =
      e.scene(
        "scene-1",
        0,
        100,
        {
          id: "same",
        },
      );

    const secondScene =
      e.scene(
        "scene-2",
        100,
        200,
        {
          id: "same",
        },
      );

    const firstLayer =
      e.layer(
        "entity-1",
        "scene-1",
        0,
        100,
        {
          id: "layer-same",
        },
      );

    const secondLayer =
      e.layer(
        "entity-2",
        "scene-2",
        100,
        200,
        {
          id: "layer-same",
        },
      );

    const composition =
      e.build(
        [
          firstScene,
          secondScene,
        ],
        [
          firstLayer,
          secondLayer,
        ],
        [],
        [],
        [],
      );

    const result =
      e.validate(composition);

    expect(
      result.errors,
    ).toContain(
      'Duplicate scene ID "same".',
    );

    expect(
      result.errors,
    ).toContain(
      'Duplicate layer ID "layer-same".',
    );
  });

  it("detects invalid layer opacity", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [],
        [
          {
            ...makeLayer(e),
            opacity: 2,
          },
        ],
        [],
        [],
        [],
      );

    const result =
      e.validate(composition);

    expect(
      result.valid,
    ).toBe(false);

    expect(
      result.errors,
    ).toContain(
      "Layer " +
        composition.layers[0].id +
        " opacity must be between 0 and 1.",
    );
  });

  it("detects invalid caption text", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [],
        [],
        [
          {
            ...makeCaption(e),
            text: "   ",
          },
        ],
        [],
        [],
      );

    const result =
      e.validate(composition);

    expect(
      result.valid,
    ).toBe(false);

    expect(
      result.errors,
    ).toContain(
      `Caption ${composition.captions[0].id} text must not be empty.`,
    );
  });

  it("warns about overlapping scenes", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene-a",
            0,
            100,
            {
              id: "a",
            },
          ),
          e.scene(
            "scene-b",
            50,
            150,
            {
              id: "b",
            },
          ),
        ],
        [],
        [],
        [],
        [],
      );

    const result =
      e.validate(composition);

    expect(
      result.valid,
    ).toBe(true);

    expect(
      result.warnings,
    ).toContain(
      "Scenes a and b overlap in time.",
    );
  });

  it("warns when a scene extends beyond composition end", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            0,
            200,
          ),
        ],
        [],
        [],
        [],
        [],
      );

    composition.endTick = 100;

    const result =
      e.validate(composition);

    expect(
      result.valid,
    ).toBe(true);

    expect(
      result.warnings,
    ).toContain(
      `Scene ${composition.scenes[0].id} extends beyond composition endTick.`,
    );
  });

  it("warns about long cut transitions", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [],
        [],
        [],
        [
          e.transition(
            "cut",
            0,
            5,
          ),
        ],
        [],
      );

    const result =
      e.validate(composition);

    expect(
      result.warnings,
    ).toContain(
      `Cut transition ${composition.transitions[0].id} has a duration greater than one tick.`,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* Fingerprint / clone                                                    */
  /* ---------------------------------------------------------------------- */

  it("produces a stable fingerprint for the same composition", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            0,
            100,
            {
              id: "scene-1",
            },
          ),
        ],
        [],
        [],
        [],
        [],
        {
          name: "Episode",
        },
      );

    const first =
      e.fingerprint(
        composition,
      );

    const second =
      e.fingerprint(
        composition,
      );

    expect(first).toBe(second);

    expect(first).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("changes fingerprint when composition content changes", () => {
    const e = makeEngine();

    const composition =
      e.build(
        [
          e.scene(
            "scene",
            0,
            100,
            {
              id: "scene-1",
            },
          ),
        ],
        [],
        [],
        [],
        [],
      );

    const changed =
      e.clone(composition);

    changed.name =
      "Changed Composition";

    expect(
      e.fingerprint(
        changed,
      ),
    ).not.toBe(
      e.fingerprint(
        composition,
      ),
    );
  });

  it("deep clones mutable nested composition data", () => {
    const e = makeEngine();

    const original =
      e.build(
        [
          e.scene(
            "scene",
            0,
            100,
            {
              id: "scene-1",
              layerIds: [
                "layer-1",
              ],
              metadata: {
                location: "classroom",
              },
            },
          ),
        ],
        [
          e.layer(
            "entity",
            "scene",
            0,
            100,
            {
              id: "layer-1",
              metadata: {
                role: "hero",
              },
            },
          ),
        ],
        [
          e.caption(
            "Hello",
            0,
            100,
            {
              id: "caption-1",
              style: {
                fontSize: 40,
              },
            },
          ),
        ],
        [
          e.transition(
            "fade",
            0,
            10,
            {
              softness: 0.5,
            },
          ),
        ],
        [
          e.audio(
            "voice",
            0,
            100,
            {
              id: "audio-1",
              metadata: {
                role: "dialogue",
              },
            },
          ),
        ],
        {
          name: "Original",
          metadata: {
            episode: 1,
          },
        },
      );

    const cloned =
      e.clone(original);

    cloned.scenes[0].layerIds.push(
      "layer-2",
    );

    cloned.scenes[0].metadata!.location =
      "street";

    cloned.layers[0].metadata!.role =
      "background";

    cloned.captions[0].style.fontSize =
      80;

    cloned.transitions[0].params.softness =
      1;

    cloned.audio[0].metadata!.role =
      "music";

    cloned.metadata.episode = 2;

    expect(
      original.scenes[0].layerIds,
    ).toEqual([
      "layer-1",
    ]);

    expect(
      original.scenes[0].metadata,
    ).toEqual({
      location: "classroom",
    });

    expect(
      original.layers[0].metadata,
    ).toEqual({
      role: "hero",
    });

    expect(
      original.captions[0].style,
    ).toEqual({
      fontFamily: "sans-serif",
      fontSize: 40,
    });

    expect(
      original.transitions[0].params,
    ).toEqual({
      softness: 0.5,
    });

    expect(
      original.audio[0].metadata,
    ).toEqual({
      role: "dialogue",
    });

    expect(
      original.metadata,
    ).toEqual({
      episode: 1,
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Immutability / defensive copies                                        */
  /* ---------------------------------------------------------------------- */

  it("does not mutate source collections when adding items", () => {
    const e = makeEngine();

    const first =
      e.scene(
        "first",
        0,
        10,
      );

    const source = [
      first,
    ];

    const second =
      e.scene(
        "second",
        10,
        20,
      );

    const result =
      e.addScene(
        source,
        second,
      );

    expect(
      source,
    ).toHaveLength(1);

    expect(
      result,
    ).toHaveLength(2);

    expect(
      result,
    ).not.toBe(
      source,
    );
  });

  it("does not mutate metadata or params supplied to constructors", () => {
    const e = makeEngine();

    const sceneMetadata = {
      location: "classroom",
    };

    const transitionParams = {
      softness: 0.5,
    };

    const audioMetadata = {
      role: "dialogue",
    };

    const s = e.scene(
      "scene",
      0,
      10,
      {
        metadata: sceneMetadata,
      },
    );

    const t = e.transition(
      "fade",
      0,
      10,
      transitionParams,
    );

    const a = e.audio(
      "voice",
      0,
      10,
      {
        metadata: audioMetadata,
      },
    );

    s.metadata!.location =
      "changed";

    t.params.softness = 1;

    a.metadata!.role =
      "changed";

    expect(
      sceneMetadata.location,
    ).toBe("classroom");

    expect(
      transitionParams.softness,
    ).toBe(0.5);

    expect(
      audioMetadata.role,
    ).toBe("dialogue");
  });
});
