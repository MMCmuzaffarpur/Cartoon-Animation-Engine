import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKGROUND,
  DEFAULT_RENDER_LAYERS,
  DEFAULT_SCENE_HEIGHT,
  DEFAULT_SCENE_WIDTH,
  SCENE_ENGINE_VERSION,
  SceneEngine,
  createSceneEngine,
  createTransform,
  type Scene,
} from "../packages/scene-engine/src/index.js";

const makeEngine = (): SceneEngine => createSceneEngine();

const scene = (
  type: "2d" | "3d" | "hybrid" = "2d",
): Scene => makeEngine().create("Test Scene", type);

function withCharacter(
  s: Scene,
  name = "Hero",
): Scene {
  return makeEngine().addCharacter(
    s,
    name,
    10,
    20,
    0,
    "char-1",
  );
}

describe("scene-engine", () => {
  /* ---------------------------------------------------------------------- */
  /* VERSION / DEFAULTS                                                     */
  /* ---------------------------------------------------------------------- */

  it("exposes version and defaults", () => {
    expect(SCENE_ENGINE_VERSION).toBe("1.0.0");

    expect(DEFAULT_SCENE_WIDTH).toBe(1280);
    expect(DEFAULT_SCENE_HEIGHT).toBe(720);

    expect(DEFAULT_BACKGROUND).toEqual({
      kind: "solid",
      color: "#87CEEB",
    });

    expect(
      DEFAULT_RENDER_LAYERS.map((x) => x.id),
    ).toEqual([
      "background",
      "characters",
      "props",
      "effects",
      "foreground",
    ]);
  });

  /* ---------------------------------------------------------------------- */
  /* SCENE CREATION                                                         */
  /* ---------------------------------------------------------------------- */

  it("creates 2d, 3d and hybrid scenes", () => {
    const e = makeEngine();

    expect(e.create("A").type).toBe("2d");
    expect(e.create("B", "3d").type).toBe("3d");
    expect(e.create("C", "hybrid").type).toBe("hybrid");
  });

  it("creates valid default scene state", () => {
    const s = scene();

    expect(s.id).toBeTruthy();
    expect(s.name).toBe("Test Scene");

    expect(s.width).toBe(1280);
    expect(s.height).toBe(720);

    expect(s.entities).toEqual([]);
    expect(s.lights).toEqual([]);
    expect(s.navigationAnchors).toEqual([]);
    expect(s.navigationPaths).toEqual([]);

    expect(s.renderLayers).toHaveLength(5);
    expect(s.settings).toEqual({});
  });

  it("validates scene names and dimensions", () => {
    const e = makeEngine();

    expect(() =>
      e.create(" "),
    ).toThrow(
      "Scene name must not be empty.",
    );

    expect(() =>
      e.create("Bad", "2d", 0, 720),
    ).toThrow(
      "Scene width must be a positive number.",
    );

    expect(() =>
      e.create("Bad", "2d", 1280, -1),
    ).toThrow(
      "Scene height must be a positive number.",
    );

    expect(
      e.create("  Hello  ").name,
    ).toBe("Hello");
  });

  it("rounds dimensions", () => {
    const s = makeEngine().create(
      "Rounded",
      "2d",
      1280.7,
      720.3,
    );

    expect(s.width).toBe(1281);
    expect(s.height).toBe(720);
  });

  /* ---------------------------------------------------------------------- */
  /* TRANSFORMS / CLONING                                                   */
  /* ---------------------------------------------------------------------- */

  it("creates and clones transforms safely", () => {
    const e = makeEngine();

    const t = createTransform(1, 2, 3);

    expect(t).toEqual({
      position: {
        x: 1,
        y: 2,
        z: 3,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
    });

    const original = e.addCharacter(
      scene(),
      "Hero",
    );

    const cloned = e.cloneScene(
      original,
      {
        newId: false,
      },
    );

    cloned.entities[0].components.changed = true;

    expect(
      cloned.entities[0].components.changed,
    ).toBe(true);

    expect(
      original.entities[0].components.changed,
    ).toBeUndefined();
  });

  /* ---------------------------------------------------------------------- */
  /* VALIDATION                                                             */
  /* ---------------------------------------------------------------------- */

  it("validates a scene and rejects invalid structures", () => {
    const e = makeEngine();

    const s = scene();

    expect(
      e.validateScene(s),
    ).toEqual({
      valid: true,
      errors: [],
    });

    s.id = "";

    expect(
      e.validateScene(s).errors,
    ).toContain(
      "Scene id must not be empty.",
    );

    s.id = "id";
    s.width = 0;

    expect(
      e.validateScene(s).errors,
    ).toContain(
      "Scene width must be a positive integer.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* BACKGROUND                                                             */
  /* ---------------------------------------------------------------------- */

  it("sets background without mutating input", () => {
    const e = makeEngine();

    const original = scene();

    const updated = e.setBackground(
      original,
      {
        kind: "gradient",
        from: "#fff",
        to: "#000",
      },
    );

    expect(
      original.background,
    ).toEqual(DEFAULT_BACKGROUND);

    expect(
      updated.background,
    ).toEqual({
      kind: "gradient",
      from: "#fff",
      to: "#000",
    });

    expect(() =>
      e.setBackground(
        original,
        null as never,
      ),
    ).toThrow(
      "Background must be an object.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* ENTITIES                                                               */
  /* ---------------------------------------------------------------------- */

  it("adds generic entities with aliases and components", () => {
    const e = makeEngine();

    const s = e.addEntity(
      scene(),
      {
        id: "entity-1",
        type: "prop",
        name: "Chair",
        aliases: ["seat"],
        representation: "2d",
        transform: createTransform(),
        components: {
          kind: "chair",
        },
      },
    );

    expect(s.entities[0]).toMatchObject({
      id: "entity-1",
      name: "Chair",
      aliases: ["seat"],
    });

    expect(
      e.findEntity(
        s,
        "entity-1",
      ),
    ).toEqual(
      s.entities[0],
    );

    expect(
      e.findEntityByName(
        s,
        "chair",
      ),
    ).toMatchObject({
      id: "entity-1",
    });

    expect(
      e.findEntityByName(
        s,
        "SEAT",
      ),
    ).toMatchObject({
      id: "entity-1",
    });
  });

  it("rejects duplicate entity ids and unknown entities", () => {
    const e = makeEngine();

    const s = e.addCharacter(
      scene(),
      "Hero",
    );

    expect(() =>
      e.addCharacterEntity(
        s,
        s.entities[0].id,
        "Other",
      ),
    ).not.toThrow();

    expect(() =>
      e.addEntity(
        s,
        {
          id: s.entities[0].id,
          type: "prop",
          name: "X",
          representation: "2d",
          transform: createTransform(),
          components: {},
        },
      ),
    ).toThrow(
      `Entity id already exists: ${s.entities[0].id}`,
    );

    expect(() =>
      e.place(
        s,
        "missing",
        0,
        0,
      ),
    ).toThrow(
      "Unknown scene entity: missing",
    );

    expect(() =>
      e.removeEntity(
        s,
        "missing",
      ),
    ).toThrow(
      "Unknown scene entity: missing",
    );
  });

  it("adds character, prop, background and effect entities", () => {
    const e = makeEngine();

    let s = e.addCharacter(
      scene("hybrid"),
      "Hero",
      1,
      2,
      3,
      "char-7",
    );

    s = e.addProp(
      s,
      "Desk",
      "desk",
      10,
      20,
      0,
      {
        width: 100,
      },
    );

    s = e.addBackgroundEntity(
      s,
      "Sky",
      {
        assetId: "sky-1",
      },
    );

    s = e.addEffect(
      s,
      "Dust",
      "dust",
      4,
      5,
      0,
      {
        density: 0.5,
      },
    );

    expect(
      s.entities.map(
        (x) => x.type,
      ),
    ).toEqual([
      "character",
      "prop",
      "background",
      "effect",
    ]);

    expect(
      s.entities[0].representation,
    ).toBe("hybrid");

    expect(
      s.entities[0].components.characterId,
    ).toBe("char-7");
  });

  it("updates, places, rotates and scales entities", () => {
    const e = makeEngine();

    let s = e.addCharacter(
      scene(),
      "Hero",
      1,
      2,
      3,
    );

    const id = s.entities[0].id;

    s = e.place(
      s,
      id,
      100,
      200,
      300,
    );

    s = e.rotate(
      s,
      id,
      10,
      20,
      30,
    );

    s = e.scale(
      s,
      id,
      2,
      1.5,
      0.5,
    );

    expect(
      s.entities[0].transform,
    ).toEqual({
      position: {
        x: 100,
        y: 200,
        z: 300,
      },
      rotation: {
        x: 10,
        y: 20,
        z: 30,
      },
      scale: {
        x: 2,
        y: 1.5,
        z: 0.5,
      },
    });

    expect(() =>
      e.scale(
        s,
        id,
        0,
        1,
        1,
      ),
    ).toThrow(
      "Entity scale values must not be zero.",
    );
  });

  it("renames, aliases, components and removes entities", () => {
    const e = makeEngine();

    let s = e.addCharacter(
      scene(),
      "Hero",
    );

    const id = s.entities[0].id;

    s = e.renameEntity(
      s,
      id,
      "Champion",
    );

    s = e.addEntityAlias(
      s,
      id,
      "Main Hero",
    );

    s = e.addEntityAlias(
      s,
      id,
      "Main Hero",
    );

    s = e.setEntityComponent(
      s,
      id,
      "emotion",
      "happy",
    );

    expect(
      s.entities[0].name,
    ).toBe("Champion");

    expect(
      s.entities[0].aliases,
    ).toEqual([
      "Main Hero",
    ]);

    expect(
      s.entities[0].components.emotion,
    ).toBe("happy");

    s = e.removeEntity(
      s,
      id,
    );

    expect(
      s.entities,
    ).toEqual([]);
  });

  /* ---------------------------------------------------------------------- */
  /* LIGHTS                                                                 */
  /* ---------------------------------------------------------------------- */

  it("adds and removes lights", () => {
    const e = makeEngine();

    let s = e.addLight(
      scene(),
      {
        name: "Key",
      },
    );

    expect(
      s.lights[0],
    ).toMatchObject({
      type: "point",
      color: "#FFFFFF",
      intensity: 1,
      castShadow: false,
    });

    s = e.addLight(
      s,
      {
        id: "sun",
        type: "directional",
        name: "Sun",
        position: {
          x: 1,
          y: 2,
          z: 3,
        },
        color: "#FFF",
        intensity: 2,
        range: 50,
        castShadow: true,
      },
    );

    expect(
      s.lights,
    ).toHaveLength(2);

    expect(() =>
      e.addLight(
        s,
        {
          id: "sun",
          name: "Duplicate",
        },
      ),
    ).toThrow(
      "Light id already exists: sun",
    );

    s = e.removeLight(
      s,
      "sun",
    );

    expect(
      s.lights,
    ).toHaveLength(1);

    expect(() =>
      e.addLight(
        scene(),
        {
          name: "Bad",
          intensity: -1,
        },
      ),
    ).toThrow(
      "Light intensity must be non-negative.",
    );
  });

  /* ---------------------------------------------------------------------- */
  /* NAVIGATION                                                             */
  /* ---------------------------------------------------------------------- */

  it("creates anchors and navigation paths", () => {
    const e = makeEngine();

    let s = scene();

    s = e.anchor(
      s,
      "a",
      0,
      0,
      0,
    );

    s = e.anchor(
      s,
      "b",
      100,
      50,
      0,
    );

    s = e.addNavigationPath(
      s,
      {
        name: "A to B",
        fromAnchorId: "a",
        toAnchorId: "b",
      },
    );

    expect(
      s.navigationPaths[0].points,
    ).toEqual([
      {
        x: 0,
        y: 0,
        z: 0,
      },
      {
        x: 100,
        y: 50,
        z: 0,
      },
    ]);

    expect(
      s.navigationPaths[0].bidirectional,
    ).toBe(true);

    expect(
      s.navigationPaths[0].id,
    ).toMatch(
      /^[a-f0-9-]{36}$/,
    );
  });

  it("rejects invalid navigation operations", () => {
    const e = makeEngine();

    expect(() =>
      e.addNavigationPath(
        scene(),
        {
          name: "Broken",
          fromAnchorId: "a",
          toAnchorId: "b",
        },
      ),
    ).toThrow(
      "Unknown navigation anchor: a",
    );

    let s = e.anchor(
      scene(),
      "a",
      0,
      0,
    );

    expect(() =>
      e.anchor(
        s,
        "a",
        1,
        1,
      ),
    ).toThrow(
      "Navigation anchor already exists: a",
    );

    expect(() =>
      e.addNavigationPath(
        s,
        {
          name: "Self",
          fromAnchorId: "a",
          toAnchorId: "a",
        },
      ),
    ).toThrow(
      "Navigation path cannot connect an anchor to itself.",
    );
  });

  it("removes paths and protects referenced anchors", () => {
    const e = makeEngine();

    let s = e.anchor(
      scene(),
      "a",
      0,
      0,
    );

    s = e.anchor(
      s,
      "b",
      10,
      0,
    );

    s = e.addNavigationPath(
      s,
      {
        name: "Path",
        fromAnchorId: "a",
        toAnchorId: "b",
      },
    );

    expect(() =>
      e.removeAnchor(
        s,
        "a",
      ),
    ).toThrow(
      "is referenced by a navigation path",
    );

    const pathId =
      s.navigationPaths[0].id;

    s = e.removeNavigationPath(
      s,
      pathId,
    );

    s = e.removeAnchor(
      s,
      "a",
    );

    expect(
      s.navigationAnchors.map(
        (x) => x.id,
      ),
    ).toEqual([
      "b",
    ]);
  });

  /* ---------------------------------------------------------------------- */
  /* RENDER LAYERS                                                          */
  /* ---------------------------------------------------------------------- */

  it("adds, sorts and removes render layers", () => {
    const e = makeEngine();

    let s = scene();

    s = e.addRenderLayer(
      s,
      "z",
      250,
      "Z",
    );

    s = e.addRenderLayer(
      s,
      "a",
      250,
      "A",
    );

    expect(
      s.renderLayers.at(-2)?.id,
    ).toBe("a");

    expect(
      s.renderLayers.at(-1)?.id,
    ).toBe("z");

    s = e.removeRenderLayer(
      s,
      "a",
    );

    expect(
      s.renderLayers.some(
        (x) => x.id === "a",
      ),
    ).toBe(false);
  });

  /* ---------------------------------------------------------------------- */
  /* SETTINGS / DIMENSIONS                                                   */
  /* ---------------------------------------------------------------------- */

  it("sets settings and dimensions", () => {
    const e = makeEngine();

    let s = scene();

    s = e.setSetting(
      s,
      "theme",
      {
        style: "cartoon",
        quality: "high",
      },
    );

    s = e.setDimensions(
      s,
      1920,
      1080,
    );

    expect(
      s.settings.theme,
    ).toEqual({
      style: "cartoon",
      quality: "high",
    });

    expect([
      s.width,
      s.height,
    ]).toEqual([
      1920,
      1080,
    ]);
  });

  /* ---------------------------------------------------------------------- */
  /* TEMPLATES                                                               */
  /* ---------------------------------------------------------------------- */

  it("creates empty and classroom templates", () => {
    const e = makeEngine();

    const empty = e.empty(
      "Empty",
      "3d",
    );

    expect(
      empty.type,
    ).toBe("3d");

    const classroom =
      e.classroom();

    expect(
      classroom.background.kind,
    ).toBe("classroom");

    /*
     * Classroom currently contains:
     * - Blackboard
     * - Teacher Desk
     * - 4 Student Desks
     * - Door
     * - 2 Windows
     *
     * Total = 9 entities.
     */
    expect(
      classroom.entities,
    ).toHaveLength(9);

    expect(
      classroom.navigationAnchors,
    ).toHaveLength(5);

    expect(
      classroom.navigationPaths,
    ).toHaveLength(3);

    expect(
      classroom.lights,
    ).toHaveLength(2);
  });

  /* ---------------------------------------------------------------------- */
  /* STATISTICS                                                             */
  /* ---------------------------------------------------------------------- */

  it("reports scene statistics", () => {
    const e = makeEngine();

    let s = e.addCharacter(
      scene(),
      "Hero",
    );

    s = e.addProp(
      s,
      "Chair",
      "chair",
    );

    s = e.addEffect(
      s,
      "Dust",
      "dust",
    );

    s = e.addLight(
      s,
      {
        name: "Key",
      },
    );

    s = e.anchor(
      s,
      "a",
      0,
      0,
    );

    s = e.anchor(
      s,
      "b",
      10,
      0,
    );

    s = e.addNavigationPath(
      s,
      {
        name: "Path",
        fromAnchorId: "a",
        toAnchorId: "b",
      },
    );

    expect(
      e.statistics(s),
    ).toEqual({
      entityCount: 3,
      characterCount: 1,
      propCount: 1,
      effectCount: 1,
      lightCount: 1,
      anchorCount: 2,
      navigationPathCount: 1,
      renderLayerCount: 5,
    });
  });

  /* ---------------------------------------------------------------------- */
  /* FINGERPRINT                                                             */
  /* ---------------------------------------------------------------------- */

  it("produces deterministic fingerprints", () => {
    const e = makeEngine();

    const s = e.addCharacter(
      scene(),
      "Hero",
      10,
      20,
    );

    const a = e.fingerprint(s);
    const b = e.fingerprint(s);

    expect(a).toBe(b);

    expect(a).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("changes fingerprint when content changes", () => {
    const e = makeEngine();

    const a = e.addCharacter(
      scene(),
      "Hero",
    );

    const b = e.place(
      a,
      a.entities[0].id,
      100,
      100,
    );

    expect(
      e.fingerprint(a),
    ).not.toBe(
      e.fingerprint(b),
    );
  });

  /* ---------------------------------------------------------------------- */
  /* DETERMINISTIC ID                                                       */
  /* ---------------------------------------------------------------------- */

  it("produces deterministic scene identity", () => {
    const e = makeEngine();

    const a = e.deterministicId(
      "Classroom",
      "2d",
      1280,
      720,
    );

    const b = e.deterministicId(
      "Classroom",
      "2d",
      1280,
      720,
    );

    const c = e.deterministicId(
      "Classroom",
      "3d",
      1280,
      720,
    );

    expect(a).toBe(b);
    expect(a).not.toBe(c);

    /*
     * UUID v5:
     * xxxxxxxx-xxxx-5xxx-[8|9|a|b]xxx-xxxxxxxxxxxx
     *
     * Fourth group contains 4 hexadecimal characters.
     */
    expect(a).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* CLONE                                                                  */
  /* ---------------------------------------------------------------------- */

  it("cloneScene supports new id, preserved id and renamed copy", () => {
    const e = makeEngine();

    const original = e.addCharacter(
      scene(),
      "Hero",
    );

    const copy = e.cloneScene(
      original,
      {
        name: "Copy",
      },
    );

    expect(
      copy.id,
    ).not.toBe(
      original.id,
    );

    expect(
      copy.name,
    ).toBe("Copy");

    const same = e.cloneScene(
      original,
      {
        newId: false,
      },
    );

    expect(
      same.id,
    ).toBe(
      original.id,
    );

    expect(
      same,
    ).not.toBe(
      original,
    );
  });

  /* ---------------------------------------------------------------------- */
  /* IMMUTABILITY                                                           */
  /* ---------------------------------------------------------------------- */

  it("keeps mutation APIs immutable", () => {
    const e = makeEngine();

    const original = scene();

    const updated = e.addCharacter(
      original,
      "Hero",
    );

    expect(
      original.entities,
    ).toHaveLength(0);

    expect(
      updated.entities,
    ).toHaveLength(1);
  });
});