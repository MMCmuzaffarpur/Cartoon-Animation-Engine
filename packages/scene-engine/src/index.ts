import { createHash } from "node:crypto";

import { uuid } from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SceneType =
  | "2d"
  | "3d"
  | "hybrid";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SceneTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface SceneEntity {
  id: string;
  type: string;
  name: string;
  representation: SceneType;
  transform: SceneTransform;
  components: Record<string, unknown>;
}

export interface NavigationAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface RenderLayer {
  id: string;
  order: number;
  name: string;
}

export interface Scene {
  id: string;
  name: string;
  type: SceneType;
  width: number;
  height: number;
  background: Record<string, unknown>;
  entities: SceneEntity[];
  navigationAnchors: NavigationAnchor[];
  renderLayers: RenderLayer[];
  settings: Record<string, unknown>;
}

export interface SceneValidationResult {
  valid: boolean;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SCENE_WIDTH = 1280;
export const DEFAULT_SCENE_HEIGHT = 720;

export const DEFAULT_BACKGROUND = {
  kind: "solid",
  color: "#87CEEB",
};

export const DEFAULT_RENDER_LAYERS: RenderLayer[] = [
  {
    id: "background",
    order: 0,
    name: "Background",
  },
  {
    id: "characters",
    order: 100,
    name: "Characters",
  },
  {
    id: "props",
    order: 150,
    name: "Props",
  },
  {
    id: "foreground",
    order: 200,
    name: "Foreground",
  },
];

/* -------------------------------------------------------------------------- */
/* Utility                                                                    */
/* -------------------------------------------------------------------------- */

function assertFinite(
  value: number,
  field: string,
): void {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${field} must be a finite number.`,
    );
  }
}

function assertPositive(
  value: number,
  field: string,
): void {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      `${field} must be a positive number.`,
    );
  }
}

function assertNonEmpty(
  value: string,
  field: string,
): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${field} must not be empty.`,
    );
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/* -------------------------------------------------------------------------- */
/* Canonical Serialization                                                    */
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
/* Transform                                                                   */
/* -------------------------------------------------------------------------- */

export function createTransform(
  x = 0,
  y = 0,
  z = 0,
): SceneTransform {
  assertFinite(x, "position.x");
  assertFinite(y, "position.y");
  assertFinite(z, "position.z");

  return {
    position: {
      x,
      y,
      z,
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
  };
}

/* -------------------------------------------------------------------------- */
/* Scene Engine                                                                */
/* -------------------------------------------------------------------------- */

export class SceneEngine {
  /* ------------------------------------------------------------------------ */
  /* Scene Creation                                                            */
  /* ------------------------------------------------------------------------ */

  create(
    name: string,
    type: SceneType = "2d",
    width = DEFAULT_SCENE_WIDTH,
    height = DEFAULT_SCENE_HEIGHT,
  ): Scene {
    assertNonEmpty(
      name,
      "Scene name",
    );

    assertPositive(
      width,
      "Scene width",
    );

    assertPositive(
      height,
      "Scene height",
    );

    const scene: Scene = {
      id: uuid(),

      name: name.trim(),

      type,

      width: Math.round(width),

      height: Math.round(height),

      background:
        clone(
          DEFAULT_BACKGROUND,
        ),

      entities: [],

      navigationAnchors: [],

      renderLayers:
        clone(
          DEFAULT_RENDER_LAYERS,
        ),

      settings: {},
    };

    return this.validate(scene);
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Validation                                                          */
  /* ------------------------------------------------------------------------ */

  validate(
    scene: Scene,
  ): Scene {
    const result =
      this.validateScene(
        scene,
      );

    if (!result.valid) {
      throw new Error(
        `Invalid scene: ${result.errors.join("; ")}`,
      );
    }

    return clone(scene);
  }

  validateScene(
    scene: Scene,
  ): SceneValidationResult {
    const errors: string[] = [];

    if (!scene.id.trim()) {
      errors.push(
        "Scene id must not be empty.",
      );
    }

    if (!scene.name.trim()) {
      errors.push(
        "Scene name must not be empty.",
      );
    }

    if (
      !["2d", "3d", "hybrid"].includes(
        scene.type,
      )
    ) {
      errors.push(
        `Invalid scene type: ${String(
          scene.type,
        )}`,
      );
    }

    if (
      !Number.isInteger(scene.width) ||
      scene.width <= 0
    ) {
      errors.push(
        "Scene width must be a positive integer.",
      );
    }

    if (
      !Number.isInteger(scene.height) ||
      scene.height <= 0
    ) {
      errors.push(
        "Scene height must be a positive integer.",
      );
    }

    /* --------------------------- Entity IDs ------------------------------ */

    const entityIds =
      new Set<string>();

    for (
      const entity of scene.entities
    ) {
      if (entityIds.has(entity.id)) {
        errors.push(
          `Duplicate scene entity id: ${entity.id}`,
        );
      }

      entityIds.add(entity.id);

      if (!entity.name.trim()) {
        errors.push(
          `Entity ${entity.id} has an empty name.`,
        );
      }

      const position =
        entity.transform.position;

      const rotation =
        entity.transform.rotation;

      const scale =
        entity.transform.scale;

      for (
        const [field, value] of Object.entries(
          position,
        )
      ) {
        if (!Number.isFinite(value)) {
          errors.push(
            `Entity ${entity.id} position.${field} must be finite.`,
          );
        }
      }

      for (
        const [field, value] of Object.entries(
          rotation,
        )
      ) {
        if (!Number.isFinite(value)) {
          errors.push(
            `Entity ${entity.id} rotation.${field} must be finite.`,
          );
        }
      }

      for (
        const [field, value] of Object.entries(
          scale,
        )
      ) {
        if (!Number.isFinite(value)) {
          errors.push(
            `Entity ${entity.id} scale.${field} must be finite.`,
          );
        }

        if (value === 0) {
          errors.push(
            `Entity ${entity.id} scale.${field} must not be zero.`,
          );
        }
      }
    }

    /* ------------------------- Navigation IDs ---------------------------- */

    const anchorIds =
      new Set<string>();

    for (
      const anchor of scene.navigationAnchors
    ) {
      if (anchorIds.has(anchor.id)) {
        errors.push(
          `Duplicate navigation anchor id: ${anchor.id}`,
        );
      }

      anchorIds.add(anchor.id);

      for (
        const [field, value] of Object.entries(
          anchor,
        )
      ) {
        if (
          field !== "id" &&
          !Number.isFinite(
            value as number,
          )
        ) {
          errors.push(
            `Navigation anchor ${anchor.id} contains non-finite ${field}.`,
          );
        }
      }
    }

    /* --------------------------- Layer IDs ------------------------------- */

    const layerIds =
      new Set<string>();

    for (
      const layer of scene.renderLayers
    ) {
      if (layerIds.has(layer.id)) {
        errors.push(
          `Duplicate render layer id: ${layer.id}`,
        );
      }

      layerIds.add(layer.id);

      if (!layer.name.trim()) {
        errors.push(
          `Render layer ${layer.id} has an empty name.`,
        );
      }

      if (!Number.isInteger(layer.order)) {
        errors.push(
          `Render layer ${layer.id} order must be an integer.`,
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
  /* Background                                                                */
  /* ------------------------------------------------------------------------ */

  setBackground(
    scene: Scene,
    background: Record<
      string,
      unknown
    >,
  ): Scene {
    if (
      !background ||
      typeof background !==
        "object"
    ) {
      throw new Error(
        "Background must be an object.",
      );
    }

    return this.validate({
      ...clone(scene),

      background:
        clone(background),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Generic Entity                                                             */
  /* ------------------------------------------------------------------------ */

  addEntity(
    scene: Scene,
    entity: Omit<
      SceneEntity,
      "id"
    > & {
      id?: string;
    },
  ): Scene {
    assertNonEmpty(
      entity.name,
      "Entity name",
    );

    const id =
      entity.id ??
      uuid();

    if (
      scene.entities.some(
        (item) =>
          item.id === id,
      )
    ) {
      throw new Error(
        `Entity id already exists: ${id}`,
      );
    }

    const nextEntity: SceneEntity = {
      id,

      type: entity.type,

      name: entity.name.trim(),

      representation:
        entity.representation,

      transform:
        clone(
          entity.transform,
        ),

      components:
        clone(
          entity.components,
        ),
    };

    return this.validate({
      ...clone(scene),

      entities: [
        ...scene.entities,
        nextEntity,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Character                                                                 */
  /* ------------------------------------------------------------------------ */

  addCharacter(
    scene: Scene,
    name: string,
    x = 0,
    y = 0,
    z = 0,
    characterId?: string,
  ): Scene {
    assertNonEmpty(
      name,
      "Character name",
    );

    return this.addEntity(
      scene,
      {
        id:
          characterId,
        type: "character",
        name,
        representation:
          scene.type ===
          "hybrid"
            ? "hybrid"
            : scene.type,
        transform:
          createTransform(
            x,
            y,
            z,
          ),
        components: {
          characterId:
            characterId ??
            null,
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Prop                                                                      */
  /* ------------------------------------------------------------------------ */

  addProp(
    scene: Scene,
    name: string,
    kind = "box",
    x = 0,
    y = 0,
    z = 0,
    props: Record<
      string,
      unknown
    > = {},
  ): Scene {
    assertNonEmpty(
      name,
      "Prop name",
    );

    assertNonEmpty(
      kind,
      "Prop kind",
    );

    return this.addEntity(
      scene,
      {
        type: "prop",

        name,

        /*
         * Keep 2D as the default
         * representation for backwards
         * compatibility with the existing
         * scene API.
         */
        representation: "2d",

        transform:
          createTransform(
            x,
            y,
            z,
          ),

        components: {
          kind,

          ...clone(props),
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Place Entity                                                              */
  /* ------------------------------------------------------------------------ */

  place(
    scene: Scene,
    entityId: string,
    x: number,
    y: number,
    z = 0,
  ): Scene {
    assertNonEmpty(
      entityId,
      "Entity id",
    );

    assertFinite(
      x,
      "position.x",
    );

    assertFinite(
      y,
      "position.y",
    );

    assertFinite(
      z,
      "position.z",
    );

    const exists =
      scene.entities.some(
        (entity) =>
          entity.id ===
          entityId,
      );

    if (!exists) {
      throw new Error(
        `Unknown scene entity: ${entityId}`,
      );
    }

    return this.validate({
      ...clone(scene),

      entities:
        scene.entities.map(
          (entity) =>
            entity.id ===
            entityId
              ? {
                  ...clone(
                    entity,
                  ),
                  transform: {
                    ...clone(
                      entity.transform,
                    ),
                    position: {
                      x,
                      y,
                      z,
                    },
                  },
                }
              : clone(entity),
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Transform Update                                                          */
  /* ------------------------------------------------------------------------ */

  updateTransform(
    scene: Scene,
    entityId: string,
    patch: Partial<SceneTransform>,
  ): Scene {
    const entity =
      scene.entities.find(
        (item) =>
          item.id ===
          entityId,
      );

    if (!entity) {
      throw new Error(
        `Unknown scene entity: ${entityId}`,
      );
    }

    const current =
      entity.transform;

    const nextTransform: SceneTransform =
      {
        position: {
          ...current.position,
          ...(patch.position ??
            {}),
        },

        rotation: {
          ...current.rotation,
          ...(patch.rotation ??
            {}),
        },

        scale: {
          ...current.scale,
          ...(patch.scale ??
            {}),
        },
      };

    return this.validate({
      ...clone(scene),

      entities:
        scene.entities.map(
          (item) =>
            item.id ===
            entityId
              ? {
                  ...clone(item),
                  transform:
                    nextTransform,
                }
              : clone(item),
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove Entity                                                             */
  /* ------------------------------------------------------------------------ */

  removeEntity(
    scene: Scene,
    entityId: string,
  ): Scene {
    assertNonEmpty(
      entityId,
      "Entity id",
    );

    const exists =
      scene.entities.some(
        (entity) =>
          entity.id ===
          entityId,
      );

    if (!exists) {
      throw new Error(
        `Unknown scene entity: ${entityId}`,
      );
    }

    return this.validate({
      ...clone(scene),

      entities:
        scene.entities.filter(
          (entity) =>
            entity.id !==
            entityId,
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Navigation Anchor                                                         */
  /* ------------------------------------------------------------------------ */

  anchor(
    scene: Scene,
    id: string,
    x: number,
    y: number,
    z = 0,
  ): Scene {
    assertNonEmpty(
      id,
      "Navigation anchor id",
    );

    assertFinite(
      x,
      "anchor.x",
    );

    assertFinite(
      y,
      "anchor.y",
    );

    assertFinite(
      z,
      "anchor.z",
    );

    if (
      scene.navigationAnchors.some(
        (anchor) =>
          anchor.id === id,
      )
    ) {
      throw new Error(
        `Navigation anchor already exists: ${id}`,
      );
    }

    return this.validate({
      ...clone(scene),

      navigationAnchors: [
        ...scene.navigationAnchors,

        {
          id,
          x,
          y,
          z,
        },
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove Navigation Anchor                                                  */
  /* ------------------------------------------------------------------------ */

  removeAnchor(
    scene: Scene,
    id: string,
  ): Scene {
    assertNonEmpty(
      id,
      "Navigation anchor id",
    );

    return this.validate({
      ...clone(scene),

      navigationAnchors:
        scene.navigationAnchors.filter(
          (anchor) =>
            anchor.id !== id,
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Render Layers                                                              */
  /* ------------------------------------------------------------------------ */

  addRenderLayer(
    scene: Scene,
    id: string,
    order: number,
    name: string,
  ): Scene {
    assertNonEmpty(
      id,
      "Render layer id",
    );

    assertNonEmpty(
      name,
      "Render layer name",
    );

    if (!Number.isInteger(order)) {
      throw new Error(
        "Render layer order must be an integer.",
      );
    }

    if (
      scene.renderLayers.some(
        (layer) =>
          layer.id === id,
      )
    ) {
      throw new Error(
        `Render layer already exists: ${id}`,
      );
    }

    return this.validate({
      ...clone(scene),

      renderLayers: [
        ...scene.renderLayers,

        {
          id,
          order,
          name: name.trim(),
        },
      ].sort(
        (a, b) =>
          a.order - b.order ||
          a.id.localeCompare(
            b.id,
          ),
      ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Settings                                                             */
  /* ------------------------------------------------------------------------ */

  setSetting(
    scene: Scene,
    key: string,
    value: unknown,
  ): Scene {
    assertNonEmpty(
      key,
      "Setting key",
    );

    return this.validate({
      ...clone(scene),

      settings: {
        ...clone(
          scene.settings,
        ),

        [key]:
          clone(value),
      },
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Classroom Template                                                        */
  /* ------------------------------------------------------------------------ */

  classroom(
    name = "Classroom",
  ): Scene {
    let scene =
      this.create(
        name,
        "2d",
        1280,
        720,
      );

    scene =
      this.setBackground(
        scene,
        {
          kind: "classroom",

          wall: "#F4E7C5",

          floor: "#C69C6D",
        },
      );

    scene =
      this.addProp(
        scene,
        "Teacher Desk",
        "desk",
        900,
        520,
        0,
        {
          width: 180,
          height: 70,
          color: "#7A4E2D",
        },
      );

    scene =
      this.addProp(
        scene,
        "Blackboard",
        "blackboard",
        640,
        180,
        0,
        {
          width: 700,
          height: 180,
          color: "#173D2D",
        },
      );

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      scene =
        this.addProp(
          scene,

          `Student Desk ${
            index + 1
          }`,

          "desk",

          220 +
            index *
              180,

          500,

          0,

          {
            width: 130,
            height: 55,
            color: "#9B6B43",
          },
        );
    }

    /* ---------------------- Classroom Anchors ---------------------------- */

    scene =
      this.anchor(
        scene,
        "teacher-area",
        900,
        430,
        0,
      );

    scene =
      this.anchor(
        scene,
        "student-area-left",
        250,
        430,
        0,
      );

    scene =
      this.anchor(
        scene,
        "student-area-right",
        850,
        430,
        0,
      );

    return this.validate(
      scene,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Fingerprint                                                         */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    scene: Scene,
  ): string {
    const validated =
      this.validate(
        scene,
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
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

export function createSceneEngine(): SceneEngine {
  return new SceneEngine();
}