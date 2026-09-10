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
  aliases: string[];
  representation: SceneType;
  transform: SceneTransform;
  components: Record<string, unknown>;
}

export interface SceneLight {
  id: string;
  type: string;
  name: string;
  position: Vector3;
  color: string;
  intensity: number;
  range?: number;
  castShadow?: boolean;
  components?: Record<string, unknown>;
}

export interface NavigationAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface NavigationPath {
  id: string;
  name: string;
  fromAnchorId: string;
  toAnchorId: string;
  points: Vector3[];
  bidirectional: boolean;
  metadata: Record<string, unknown>;
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
  lights: SceneLight[];
  navigationAnchors: NavigationAnchor[];
  navigationPaths: NavigationPath[];
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

export const SCENE_ENGINE_VERSION =
  "1.0.0";

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
    id: "effects",
    order: 175,
    name: "Effects",
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

function assertNonNegative(
  value: number,
  field: string,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${field} must be non-negative.`,
    );
  }
}

function assertInteger(
  value: number,
  field: string,
): void {
  if (!Number.isInteger(value)) {
    throw new Error(
      `${field} must be an integer.`,
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

function clone<T>(
  value: T,
): T {
  return structuredClone(value);
}

function normalizeColor(
  value: string,
): string {
  assertNonEmpty(
    value,
    "Color",
  );

  return value.trim();
}

function vector3(
  x = 0,
  y = 0,
  z = 0,
): Vector3 {
  assertFinite(x, "x");
  assertFinite(y, "y");
  assertFinite(z, "z");

  return {
    x,
    y,
    z,
  };
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
/* Deterministic ID                                                           */
/* -------------------------------------------------------------------------- */

function deterministicId(
  namespace: string,
  value: unknown,
): string {
  const digest =
    createHash("sha256")
      .update(
        `${namespace}:${canonicalize(value)}`,
      )
      .digest("hex");

  return (
    `${digest.slice(0, 8)}-` +
    `${digest.slice(8, 12)}-` +
    `5${digest.slice(13, 16)}-` +
    `${(
      (parseInt(
        digest.slice(16, 18),
        16,
      ) &
        0x3f) |
      0x80
    )
      .toString(16)
      .padStart(2, "0")}` +
    `${digest.slice(18, 20)}-` +
    `${digest.slice(20, 32)}`
  );
}

/* -------------------------------------------------------------------------- */
/* Transform                                                                   */
/* -------------------------------------------------------------------------- */

export function createTransform(
  x = 0,
  y = 0,
  z = 0,
): SceneTransform {
  return {
    position: vector3(
      x,
      y,
      z,
    ),

    rotation: vector3(
      0,
      0,
      0,
    ),

    scale: vector3(
      1,
      1,
      1,
    ),
  };
}

export function cloneTransform(
  transform: SceneTransform,
): SceneTransform {
  return clone(transform);
}

/* -------------------------------------------------------------------------- */
/* Scene Engine                                                               */
/* -------------------------------------------------------------------------- */

export class SceneEngine {
  readonly version =
    SCENE_ENGINE_VERSION;

  /* ------------------------------------------------------------------------ */
  /* Scene Creation                                                           */
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

      lights: [],

      navigationAnchors: [],

      navigationPaths: [],

      renderLayers:
        clone(
          DEFAULT_RENDER_LAYERS,
        ),

      settings: {},
    };

    return this.validate(
      scene,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Clone Scene                                                              */
  /* ------------------------------------------------------------------------ */

  cloneScene(
    scene: Scene,
    options: {
      newId?: boolean;
      name?: string;
    } = {},
  ): Scene {
    const copy =
      clone(scene);

    if (options.newId !== false) {
      copy.id = uuid();
    }

    if (
      options.name !== undefined
    ) {
      assertNonEmpty(
        options.name,
        "Scene name",
      );

      copy.name =
        options.name.trim();
    }

    return this.validate(
      copy,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
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

    if (
      !scene ||
      typeof scene !== "object"
    ) {
      return {
        valid: false,
        errors: [
          "Scene must be an object.",
        ],
      };
    }

    if (
      typeof scene.id !== "string" ||
      !scene.id.trim()
    ) {
      errors.push(
        "Scene id must not be empty.",
      );
    }

    if (
      typeof scene.name !== "string" ||
      !scene.name.trim()
    ) {
      errors.push(
        "Scene name must not be empty.",
      );
    }

    if (
      ![
        "2d",
        "3d",
        "hybrid",
      ].includes(scene.type)
    ) {
      errors.push(
        `Invalid scene type: ${String(
          scene.type,
        )}`,
      );
    }

    if (
      !Number.isInteger(
        scene.width,
      ) ||
      scene.width <= 0
    ) {
      errors.push(
        "Scene width must be a positive integer.",
      );
    }

    if (
      !Number.isInteger(
        scene.height,
      ) ||
      scene.height <= 0
    ) {
      errors.push(
        "Scene height must be a positive integer.",
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Entity Validation                                                      */
    /* ---------------------------------------------------------------------- */

    const entityIds =
      new Set<string>();

    for (
      const entity of scene.entities ??
      []
    ) {
      if (
        !entity.id ||
        !entity.id.trim()
      ) {
        errors.push(
          "Scene entity id must not be empty.",
        );
      }

      if (
        entityIds.has(
          entity.id,
        )
      ) {
        errors.push(
          `Duplicate scene entity id: ${entity.id}`,
        );
      }

      entityIds.add(
        entity.id,
      );

      if (
        !entity.name ||
        !entity.name.trim()
      ) {
        errors.push(
          `Entity ${entity.id} has an empty name.`,
        );
      }

      if (
        !entity.type ||
        !entity.type.trim()
      ) {
        errors.push(
          `Entity ${entity.id} has an empty type.`,
        );
      }

      if (
        ![
          "2d",
          "3d",
          "hybrid",
        ].includes(
          entity.representation,
        )
      ) {
        errors.push(
          `Entity ${entity.id} has invalid representation.`,
        );
      }

      this.validateTransform(
        entity.transform,
        `Entity ${entity.id}`,
        errors,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Light Validation                                                       */
    /* ---------------------------------------------------------------------- */

    const lightIds =
      new Set<string>();

    for (
      const light of scene.lights ??
      []
    ) {
      if (
        !light.id ||
        !light.id.trim()
      ) {
        errors.push(
          "Scene light id must not be empty.",
        );
      }

      if (
        lightIds.has(
          light.id,
        )
      ) {
        errors.push(
          `Duplicate scene light id: ${light.id}`,
        );
      }

      lightIds.add(
        light.id,
      );

      if (
        !light.name ||
        !light.name.trim()
      ) {
        errors.push(
          `Light ${light.id} has an empty name.`,
        );
      }

      if (
        !light.type ||
        !light.type.trim()
      ) {
        errors.push(
          `Light ${light.id} has an empty type.`,
        );
      }

      this.validateVector(
        light.position,
        `Light ${light.id} position`,
        errors,
      );

      if (
        typeof light.color !==
          "string" ||
        !light.color.trim()
      ) {
        errors.push(
          `Light ${light.id} color must not be empty.`,
        );
      }

      if (
        !Number.isFinite(
          light.intensity,
        ) ||
        light.intensity < 0
      ) {
        errors.push(
          `Light ${light.id} intensity must be non-negative.`,
        );
      }

      if (
        light.range !==
          undefined &&
        (!Number.isFinite(
          light.range,
        ) ||
          light.range <= 0)
      ) {
        errors.push(
          `Light ${light.id} range must be positive.`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Navigation Anchor Validation                                           */
    /* ---------------------------------------------------------------------- */

    const anchorIds =
      new Set<string>();

    for (
      const anchor of scene.navigationAnchors ??
      []
    ) {
      if (
        !anchor.id ||
        !anchor.id.trim()
      ) {
        errors.push(
          "Navigation anchor id must not be empty.",
        );
      }

      if (
        anchorIds.has(
          anchor.id,
        )
      ) {
        errors.push(
          `Duplicate navigation anchor id: ${anchor.id}`,
        );
      }

      anchorIds.add(
        anchor.id,
      );

      this.validateVector(
        anchor,
        `Navigation anchor ${anchor.id}`,
        errors,
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Navigation Path Validation                                             */
    /* ---------------------------------------------------------------------- */

    const pathIds =
      new Set<string>();

    for (
      const path of scene.navigationPaths ??
      []
    ) {
      if (
        !path.id ||
        !path.id.trim()
      ) {
        errors.push(
          "Navigation path id must not be empty.",
        );
      }

      if (
        pathIds.has(
          path.id,
        )
      ) {
        errors.push(
          `Duplicate navigation path id: ${path.id}`,
        );
      }

      pathIds.add(
        path.id,
      );

      if (
        !path.name ||
        !path.name.trim()
      ) {
        errors.push(
          `Navigation path ${path.id} name must not be empty.`,
        );
      }

      if (
        !anchorIds.has(
          path.fromAnchorId,
        )
      ) {
        errors.push(
          `Navigation path ${path.id} references unknown fromAnchorId ${path.fromAnchorId}.`,
        );
      }

      if (
        !anchorIds.has(
          path.toAnchorId,
        )
      ) {
        errors.push(
          `Navigation path ${path.id} references unknown toAnchorId ${path.toAnchorId}.`,
        );
      }

      if (
        path.fromAnchorId ===
        path.toAnchorId
      ) {
        errors.push(
          `Navigation path ${path.id} cannot connect an anchor to itself.`,
        );
      }

      if (
        !Array.isArray(
          path.points,
        ) ||
        path.points.length < 2
      ) {
        errors.push(
          `Navigation path ${path.id} must contain at least two points.`,
        );
      }

      for (
        let index = 0;
        index <
        (path.points?.length ?? 0);
        index += 1
      ) {
        this.validateVector(
          path.points[index],
          `Navigation path ${path.id} point ${index}`,
          errors,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Render Layer Validation                                                */
    /* ---------------------------------------------------------------------- */

    const layerIds =
      new Set<string>();

    for (
      const layer of scene.renderLayers ??
      []
    ) {
      if (
        !layer.id ||
        !layer.id.trim()
      ) {
        errors.push(
          "Render layer id must not be empty.",
        );
      }

      if (
        layerIds.has(
          layer.id,
        )
      ) {
        errors.push(
          `Duplicate render layer id: ${layer.id}`,
        );
      }

      layerIds.add(
        layer.id,
      );

      if (
        !layer.name ||
        !layer.name.trim()
      ) {
        errors.push(
          `Render layer ${layer.id} has an empty name.`,
        );
      }

      if (
        !Number.isInteger(
          layer.order,
        )
      ) {
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
  /* Transform Validation                                                     */
  /* ------------------------------------------------------------------------ */

  private validateVector(
    value: Vector3,
    field: string,
    errors: string[],
  ): void {
    if (
      !value ||
      typeof value !== "object"
    ) {
      errors.push(
        `${field} must be a vector.`,
      );

      return;
    }

    for (
      const axis of [
        "x",
        "y",
        "z",
      ] as const
    ) {
      if (
        !Number.isFinite(
          value[axis],
        )
      ) {
        errors.push(
          `${field}.${axis} must be finite.`,
        );
      }
    }
  }

  private validateTransform(
    transform: SceneTransform,
    field: string,
    errors: string[],
  ): void {
    if (
      !transform ||
      typeof transform !== "object"
    ) {
      errors.push(
        `${field} transform must be an object.`,
      );

      return;
    }

    this.validateVector(
      transform.position,
      `${field} position`,
      errors,
    );

    this.validateVector(
      transform.rotation,
      `${field} rotation`,
      errors,
    );

    this.validateVector(
      transform.scale,
      `${field} scale`,
      errors,
    );

    for (
      const axis of [
        "x",
        "y",
        "z",
      ] as const
    ) {
      if (
        transform.scale &&
        transform.scale[axis] === 0
      ) {
        errors.push(
          `${field} scale.${axis} must not be zero.`,
        );
      }
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Background                                                               */
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
  /* Generic Entity                                                           */
  /* ------------------------------------------------------------------------ */

  addEntity(
    scene: Scene,
    entity: Omit<
      SceneEntity,
      "id" | "aliases"
    > & {
      id?: string;
      aliases?: string[];
    },
  ): Scene {
    assertNonEmpty(
      entity.name,
      "Entity name",
    );

    assertNonEmpty(
      entity.type,
      "Entity type",
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

      type:
        entity.type.trim(),

      name:
        entity.name.trim(),

      aliases: [
        ...(entity.aliases ??
          []),
      ],

      representation:
        entity.representation,

      transform:
        clone(
          entity.transform,
        ),

      components:
        clone(
          entity.components ??
            {},
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
  /* Add Character                                                            */
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
          undefined,

        type:
          "character",

        name,

        aliases: [],

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

          entityRole:
            "character",
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Character With Explicit Entity ID                                    */
  /* ------------------------------------------------------------------------ */

  addCharacterEntity(
    scene: Scene,
    characterId: string,
    name: string,
    x = 0,
    y = 0,
    z = 0,
  ): Scene {
    assertNonEmpty(
      characterId,
      "Character id",
    );

    assertNonEmpty(
      name,
      "Character name",
    );

    return this.addEntity(
      scene,
      {
        id:
          uuid(),

        type:
          "character",

        name,

        aliases: [],

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
          characterId,

          entityRole:
            "character",
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Prop                                                                 */
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
        type:
          "prop",

        name,

        aliases: [],

        representation:
          scene.type,

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
  /* Add Background Entity                                                    */
  /* ------------------------------------------------------------------------ */

  addBackgroundEntity(
    scene: Scene,
    name: string,
    components: Record<
      string,
      unknown
    > = {},
  ): Scene {
    return this.addEntity(
      scene,
      {
        type:
          "background",

        name,

        aliases: [],

        representation:
          scene.type,

        transform:
          createTransform(),

        components: {
          ...clone(components),
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Effect Entity                                                        */
  /* ------------------------------------------------------------------------ */

  addEffect(
    scene: Scene,
    name: string,
    effectType: string,
    x = 0,
    y = 0,
    z = 0,
    parameters: Record<
      string,
      unknown
    > = {},
  ): Scene {
    assertNonEmpty(
      effectType,
      "Effect type",
    );

    return this.addEntity(
      scene,
      {
        type:
          "effect",

        name,

        aliases: [],

        representation:
          scene.type,

        transform:
          createTransform(
            x,
            y,
            z,
          ),

        components: {
          effectType,

          ...clone(parameters),
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Find Entity                                                              */
  /* ------------------------------------------------------------------------ */

  findEntity(
    scene: Scene,
    entityId: string,
  ): SceneEntity | undefined {
    assertNonEmpty(
      entityId,
      "Entity id",
    );

    const entity =
      scene.entities.find(
        (item) =>
          item.id ===
          entityId,
      );

    return entity
      ? clone(entity)
      : undefined;
  }

  /* ------------------------------------------------------------------------ */
  /* Find Entity By Name                                                      */
  /* ------------------------------------------------------------------------ */

  findEntityByName(
    scene: Scene,
    name: string,
  ): SceneEntity | undefined {
    assertNonEmpty(
      name,
      "Entity name",
    );

    const normalized =
      name
        .trim()
        .toLowerCase();

    const entity =
      scene.entities.find(
        (item) =>
          item.name
            .trim()
            .toLowerCase() ===
            normalized ||
          item.aliases.some(
            (alias) =>
              alias
                .trim()
                .toLowerCase() ===
              normalized,
          ),
      );

    return entity
      ? clone(entity)
      : undefined;
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

    if (
      !scene.entities.some(
        (entity) =>
          entity.id ===
          entityId,
      )
    ) {
      throw new Error(
        `Unknown scene entity: ${entityId}`,
      );
    }

    return this.updateTransform(
      scene,
      entityId,
      {
        position: {
          x,
          y,
          z,
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Update Transform                                                         */
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
  /* Rotate Entity                                                             */
  /* ------------------------------------------------------------------------ */

  rotate(
    scene: Scene,
    entityId: string,
    x: number,
    y: number,
    z: number,
  ): Scene {
    assertFinite(
      x,
      "rotation.x",
    );

    assertFinite(
      y,
      "rotation.y",
    );

    assertFinite(
      z,
      "rotation.z",
    );

    return this.updateTransform(
      scene,
      entityId,
      {
        rotation: {
          x,
          y,
          z,
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Scale Entity                                                              */
  /* ------------------------------------------------------------------------ */

  scale(
    scene: Scene,
    entityId: string,
    x: number,
    y: number,
    z: number,
  ): Scene {
    assertFinite(
      x,
      "scale.x",
    );

    assertFinite(
      y,
      "scale.y",
    );

    assertFinite(
      z,
      "scale.z",
    );

    if (
      x === 0 ||
      y === 0 ||
      z === 0
    ) {
      throw new Error(
        "Entity scale values must not be zero.",
      );
    }

    return this.updateTransform(
      scene,
      entityId,
      {
        scale: {
          x,
          y,
          z,
        },
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Rename Entity                                                             */
  /* ------------------------------------------------------------------------ */

  renameEntity(
    scene: Scene,
    entityId: string,
    name: string,
  ): Scene {
    assertNonEmpty(
      name,
      "Entity name",
    );

    if (
      !scene.entities.some(
        (entity) =>
          entity.id ===
          entityId,
      )
    ) {
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
                  ...clone(entity),
                  name:
                    name.trim(),
                }
              : clone(entity),
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Add Entity Alias                                                         */
  /* ------------------------------------------------------------------------ */

  addEntityAlias(
    scene: Scene,
    entityId: string,
    alias: string,
  ): Scene {
    assertNonEmpty(
      alias,
      "Entity alias",
    );

    const normalized =
      alias.trim();

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
                  ...clone(entity),

                  aliases:
                    entity.aliases.includes(
                      normalized,
                    )
                      ? [
                          ...entity.aliases,
                        ]
                      : [
                          ...entity.aliases,
                          normalized,
                        ],
                }
              : clone(entity),
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

    if (
      !scene.entities.some(
        (entity) =>
          entity.id ===
          entityId,
      )
    ) {
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
  /* Entity Components                                                         */
  /* ------------------------------------------------------------------------ */

  setEntityComponent(
    scene: Scene,
    entityId: string,
    key: string,
    value: unknown,
  ): Scene {
    assertNonEmpty(
      key,
      "Component key",
    );

    if (
      !scene.entities.some(
        (entity) =>
          entity.id ===
          entityId,
      )
    ) {
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
                  ...clone(entity),

                  components: {
                    ...clone(
                      entity.components,
                    ),

                    [key]:
                      clone(value),
                  },
                }
              : clone(entity),
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Lights                                                                   */
  /* ------------------------------------------------------------------------ */

  addLight(
    scene: Scene,
    options: {
      id?: string;
      type?: string;
      name: string;
      position?: Vector3;
      color?: string;
      intensity?: number;
      range?: number;
      castShadow?: boolean;
      components?: Record<
        string,
        unknown
      >;
    },
  ): Scene {
    assertNonEmpty(
      options.name,
      "Light name",
    );

    const type =
      options.type ??
      "point";

    assertNonEmpty(
      type,
      "Light type",
    );

    const intensity =
      options.intensity ??
      1;

    assertNonNegative(
      intensity,
      "Light intensity",
    );

    if (
      options.range !==
        undefined
    ) {
      assertPositive(
        options.range,
        "Light range",
      );
    }

    const light: SceneLight =
      {
        id:
          options.id ??
          uuid(),

        type:
          type.trim(),

        name:
          options.name.trim(),

        position:
          clone(
            options.position ??
              vector3(),
          ),

        color:
          normalizeColor(
            options.color ??
              "#FFFFFF",
          ),

        intensity,

        ...(options.range !==
        undefined
          ? {
              range:
                options.range,
            }
          : {}),

        castShadow:
          options.castShadow ??
          false,

        components:
          clone(
            options.components ??
              {},
          ),
      };

    if (
      scene.lights.some(
        (item) =>
          item.id ===
          light.id,
      )
    ) {
      throw new Error(
        `Light id already exists: ${light.id}`,
      );
    }

    return this.validate({
      ...clone(scene),

      lights: [
        ...scene.lights,
        light,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove Light                                                              */
  /* ------------------------------------------------------------------------ */

  removeLight(
    scene: Scene,
    lightId: string,
  ): Scene {
    assertNonEmpty(
      lightId,
      "Light id",
    );

    if (
      !scene.lights.some(
        (light) =>
          light.id ===
          lightId,
      )
    ) {
      throw new Error(
        `Unknown scene light: ${lightId}`,
      );
    }

    return this.validate({
      ...clone(scene),

      lights:
        scene.lights.filter(
          (light) =>
            light.id !==
            lightId,
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
        (item) =>
          item.id === id,
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
          id:
            id.trim(),

          x,
          y,
          z,
        },
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove Navigation Anchor                                                 */
  /* ------------------------------------------------------------------------ */

  removeAnchor(
    scene: Scene,
    id: string,
  ): Scene {
    assertNonEmpty(
      id,
      "Navigation anchor id",
    );

    if (
      !scene.navigationAnchors.some(
        (anchor) =>
          anchor.id ===
          id,
      )
    ) {
      throw new Error(
        `Unknown navigation anchor: ${id}`,
      );
    }

    const referenced =
      scene.navigationPaths.some(
        (path) =>
          path.fromAnchorId ===
            id ||
          path.toAnchorId ===
            id,
      );

    if (referenced) {
      throw new Error(
        `Navigation anchor ${id} is referenced by a navigation path.`,
      );
    }

    return this.validate({
      ...clone(scene),

      navigationAnchors:
        scene.navigationAnchors.filter(
          (anchor) =>
            anchor.id !==
            id,
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Navigation Path                                                           */
  /* ------------------------------------------------------------------------ */

  addNavigationPath(
    scene: Scene,
    options: {
      id?: string;
      name: string;
      fromAnchorId: string;
      toAnchorId: string;
      points?: Vector3[];
      bidirectional?: boolean;
      metadata?: Record<
        string,
        unknown
      >;
    },
  ): Scene {
    assertNonEmpty(
      options.name,
      "Navigation path name",
    );

    assertNonEmpty(
      options.fromAnchorId,
      "fromAnchorId",
    );

    assertNonEmpty(
      options.toAnchorId,
      "toAnchorId",
    );

    if (
      options.fromAnchorId ===
      options.toAnchorId
    ) {
      throw new Error(
        "Navigation path cannot connect an anchor to itself.",
      );
    }

    const anchorIds =
      new Set(
        scene.navigationAnchors.map(
          (anchor) =>
            anchor.id,
        ),
      );

    if (
      !anchorIds.has(
        options.fromAnchorId,
      )
    ) {
      throw new Error(
        `Unknown navigation anchor: ${options.fromAnchorId}`,
      );
    }

    if (
      !anchorIds.has(
        options.toAnchorId,
      )
    ) {
      throw new Error(
        `Unknown navigation anchor: ${options.toAnchorId}`,
      );
    }

    const from =
      scene.navigationAnchors.find(
        (anchor) =>
          anchor.id ===
          options.fromAnchorId,
      )!;

    const to =
      scene.navigationAnchors.find(
        (anchor) =>
          anchor.id ===
          options.toAnchorId,
      )!;

    const points =
      options.points &&
      options.points.length > 0
        ? clone(
            options.points,
          )
        : [
            {
              x: from.x,
              y: from.y,
              z: from.z,
            },
            {
              x: to.x,
              y: to.y,
              z: to.z,
            },
          ];

    if (
      points.length < 2
    ) {
      throw new Error(
        "Navigation path requires at least two points.",
      );
    }

    const path: NavigationPath =
      {
        id:
          options.id ??
          deterministicId(
            "navigation-path",
            {
              name:
                options.name.trim(),

              from:
                options.fromAnchorId,

              to:
                options.toAnchorId,

              points,
            },
          ),

        name:
          options.name.trim(),

        fromAnchorId:
          options.fromAnchorId,

        toAnchorId:
          options.toAnchorId,

        points,

        bidirectional:
          options.bidirectional ??
          true,

        metadata:
          clone(
            options.metadata ??
              {},
          ),
      };

    if (
      scene.navigationPaths.some(
        (item) =>
          item.id ===
          path.id,
      )
    ) {
      throw new Error(
        `Navigation path already exists: ${path.id}`,
      );
    }

    return this.validate({
      ...clone(scene),

      navigationPaths: [
        ...scene.navigationPaths,
        path,
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove Navigation Path                                                   */
  /* ------------------------------------------------------------------------ */

  removeNavigationPath(
    scene: Scene,
    pathId: string,
  ): Scene {
    assertNonEmpty(
      pathId,
      "Navigation path id",
    );

    if (
      !scene.navigationPaths.some(
        (path) =>
          path.id ===
          pathId,
      )
    ) {
      throw new Error(
        `Unknown navigation path: ${pathId}`,
      );
    }

    return this.validate({
      ...clone(scene),

      navigationPaths:
        scene.navigationPaths.filter(
          (path) =>
            path.id !==
            pathId,
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Render Layers                                                             */
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

    assertInteger(
      order,
      "Render layer order",
    );

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
          id:
            id.trim(),

          order,

          name:
            name.trim(),
        },
      ].sort(
        (a, b) =>
          a.order -
            b.order ||
          a.id.localeCompare(
            b.id,
          ),
      ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove Render Layer                                                       */
  /* ------------------------------------------------------------------------ */

  removeRenderLayer(
    scene: Scene,
    id: string,
  ): Scene {
    assertNonEmpty(
      id,
      "Render layer id",
    );

    if (
      !scene.renderLayers.some(
        (layer) =>
          layer.id ===
          id,
      )
    ) {
      throw new Error(
        `Unknown render layer: ${id}`,
      );
    }

    return this.validate({
      ...clone(scene),

      renderLayers:
        scene.renderLayers.filter(
          (layer) =>
            layer.id !==
            id,
        ),
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Settings                                                            */
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
  /* Set Dimensions                                                            */
  /* ------------------------------------------------------------------------ */

  setDimensions(
    scene: Scene,
    width: number,
    height: number,
  ): Scene {
    assertPositive(
      width,
      "Scene width",
    );

    assertPositive(
      height,
      "Scene height",
    );

    return this.validate({
      ...clone(scene),

      width:
        Math.round(width),

      height:
        Math.round(height),
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
          kind:
            "classroom",

          wall:
            "#F4E7C5",

          floor:
            "#C69C6D",

          ceiling:
            "#FFFFFF",
        },
      );

    /* ---------------------------------------------------------------------- */
    /* Blackboard                                                             */
    /* ---------------------------------------------------------------------- */

    scene =
      this.addProp(
        scene,
        "Blackboard",
        "blackboard",
        640,
        180,
        0,
        {
          width:
            700,

          height:
            180,

          color:
            "#173D2D",
        },
      );

    /* ---------------------------------------------------------------------- */
    /* Teacher Desk                                                           */
    /* ---------------------------------------------------------------------- */

    scene =
      this.addProp(
        scene,
        "Teacher Desk",
        "desk",
        900,
        520,
        0,
        {
          width:
            180,

          height:
            70,

          color:
            "#7A4E2D",
        },
      );

    /* ---------------------------------------------------------------------- */
    /* Student Desks                                                          */
    /* ---------------------------------------------------------------------- */

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
            width:
              130,

            height:
              55,

            color:
              "#9B6B43",
          },
        );
    }

    /* ---------------------------------------------------------------------- */
    /* Classroom Door                                                         */
    /* ---------------------------------------------------------------------- */

    scene =
      this.addProp(
        scene,
        "Classroom Door",
        "door",
        1120,
        350,
        0,
        {
          width:
            100,

          height:
            220,

          color:
            "#704214",
        },
      );

    /* ---------------------------------------------------------------------- */
    /* Windows                                                                 */
    /* ---------------------------------------------------------------------- */

    scene =
      this.addProp(
        scene,
        "Window Left",
        "window",
        180,
        180,
        0,
        {
          width:
            160,

          height:
            130,

          color:
            "#9DD9F3",
        },
      );

    scene =
      this.addProp(
        scene,
        "Window Right",
        "window",
        1100,
        180,
        0,
        {
          width:
            160,

          height:
            130,

          color:
            "#9DD9F3",
        },
      );

    /* ---------------------------------------------------------------------- */
    /* Teacher Anchor                                                         */
    /* ---------------------------------------------------------------------- */

    scene =
      this.anchor(
        scene,
        "teacher-area",
        900,
        430,
        0,
      );

    /* ---------------------------------------------------------------------- */
    /* Student Anchors                                                        */
    /* ---------------------------------------------------------------------- */

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
        "student-area-center",
        550,
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

    /* ---------------------------------------------------------------------- */
    /* Door Anchor                                                            */
    /* ---------------------------------------------------------------------- */

    scene =
      this.anchor(
        scene,
        "door",
        1120,
        430,
        0,
      );

    /* ---------------------------------------------------------------------- */
    /* Navigation                                                             */
    /* ---------------------------------------------------------------------- */

    scene =
      this.addNavigationPath(
        scene,
        {
          name:
            "Door To Teacher",

          fromAnchorId:
            "door",

          toAnchorId:
            "teacher-area",
        },
      );

    scene =
      this.addNavigationPath(
        scene,
        {
          name:
            "Teacher To Students",

          fromAnchorId:
            "teacher-area",

          toAnchorId:
            "student-area-center",
        },
      );

    scene =
      this.addNavigationPath(
        scene,
        {
          name:
            "Student Area",

          fromAnchorId:
            "student-area-left",

          toAnchorId:
            "student-area-right",
        },
      );

    /* ---------------------------------------------------------------------- */
    /* Classroom Lights                                                       */
    /* ---------------------------------------------------------------------- */

    scene =
      this.addLight(
        scene,
        {
          type:
            "ambient",

          name:
            "Classroom Ambient",

          position:
            vector3(
              640,
              300,
              100,
            ),

          color:
            "#FFFFFF",

          intensity:
            0.8,
        },
      );

    scene =
      this.addLight(
        scene,
        {
          type:
            "directional",

          name:
            "Classroom Key",

          position:
            vector3(
              640,
              100,
              300,
            ),

          color:
            "#FFF4DD",

          intensity:
            1.0,

          castShadow:
            true,
        },
      );

    return this.validate(
      scene,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Empty Scene Template                                                     */
  /* ------------------------------------------------------------------------ */

  empty(
    name = "Scene",
    type: SceneType = "2d",
  ): Scene {
    return this.create(
      name,
      type,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Statistics                                                         */
  /* ------------------------------------------------------------------------ */

  statistics(
    scene: Scene,
  ): {
    entityCount: number;
    characterCount: number;
    propCount: number;
    effectCount: number;
    lightCount: number;
    anchorCount: number;
    navigationPathCount: number;
    renderLayerCount: number;
  } {
    const validated =
      this.validate(
        scene,
      );

    return {
      entityCount:
        validated.entities
          .length,

      characterCount:
        validated.entities.filter(
          (entity) =>
            entity.type ===
            "character",
        ).length,

      propCount:
        validated.entities.filter(
          (entity) =>
            entity.type ===
            "prop",
        ).length,

      effectCount:
        validated.entities.filter(
          (entity) =>
            entity.type ===
            "effect",
        ).length,

      lightCount:
        validated.lights.length,

      anchorCount:
        validated
          .navigationAnchors
          .length,

      navigationPathCount:
        validated
          .navigationPaths
          .length,

      renderLayerCount:
        validated
          .renderLayers
          .length,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Deterministic Scene Fingerprint                                          */
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

  /* ------------------------------------------------------------------------ */
  /* Deterministic Scene Identity                                             */
  /* ------------------------------------------------------------------------ */

  deterministicId(
    name: string,
    type: SceneType,
    width: number,
    height: number,
  ): string {
    assertNonEmpty(
      name,
      "Scene name",
    );

    return deterministicId(
      "scene",
      {
        name:
          name.trim(),

        type,

        width,

        height,
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createSceneEngine(): SceneEngine {
  return new SceneEngine();
}