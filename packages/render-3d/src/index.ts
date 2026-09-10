import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { canonicalHash } from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export type GltfRepresentation =
  | "3d"
  | "hybrid";

export interface GltfCapabilities {
  adapterId: "gltf-json";
  adapterVersion: "1.0.0";
  contractVersion: "1.0.0";
  capabilities: {
    "render.3d.scene-export": "supported";
    "render.3d": "experimental";
  };
}

export interface GltfVec3 {
  x: number;
  y: number;
  z: number;
}

export interface GltfQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface GltfTransform {
  position?: Partial<GltfVec3>;
  rotation?: Partial<GltfVec3>;
  scale?: Partial<GltfVec3>;
}

export interface GltfSceneEntity {
  id?: string;
  type?: string;
  name?: string;
  representation?: GltfRepresentation | "2d";
  transform?: GltfTransform;
  components?: Record<string, unknown>;
}

export interface GltfScene {
  id?: string;
  name?: string;
  type?: "2d" | "3d" | "hybrid";
  width?: number;
  height?: number;
  background?: unknown;
  entities?: GltfSceneEntity[];
  settings?: Record<string, unknown>;
}

export interface GltfExportOptions {
  includeEngineMetadata?: boolean;
  includeEntityMetadata?: boolean;
  includeNon3DEntities?: boolean;
}

export interface GltfExportResult {
  path: string;
  hash: string;
  nodeCount: number;
  renderer: "gltf-json";
  version: "1.0.0";
}

/* -------------------------------------------------------------------------- */
/* Internal glTF Types                                                        */
/* -------------------------------------------------------------------------- */

interface GltfAsset {
  version: "2.0";
  generator: string;
  extras?: Record<string, unknown>;
}

interface GltfNode {
  name?: string;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  extras?: Record<string, unknown>;
}

interface GltfSceneDefinition {
  name?: string;
  nodes: number[];
}

interface GltfDocument {
  asset: GltfAsset;
  scene: number;
  scenes: GltfSceneDefinition[];
  nodes: GltfNode[];
  extras?: Record<string, unknown>;
}

/*
 * IMPORTANT:
 *
 * GltfTransform intentionally uses Partial<GltfVec3> because incoming
 * project data may provide only some coordinates.
 *
 * After normalization, however, the renderer must work only with complete
 * vectors. This type prevents Partial<> from leaking into the rendering
 * layer.
 */
interface NormalizedTransform {
  position: GltfVec3;
  rotation: GltfVec3;
  scale: GltfVec3;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const RENDERER_VERSION = "1.0.0" as const;
const GLTF_VERSION = "2.0" as const;
const GENERATOR = "Cartoon Animation Engine 1.0.0";

const DEFAULT_POSITION: GltfVec3 = {
  x: 0,
  y: 0,
  z: 0,
};

const DEFAULT_SCALE: GltfVec3 = {
  x: 1,
  y: 1,
  z: 1,
};

const DEFAULT_ROTATION: GltfVec3 = {
  x: 0,
  y: 0,
  z: 0,
};

/* -------------------------------------------------------------------------- */
/* Safe Numeric Helpers                                                       */
/* -------------------------------------------------------------------------- */

function finiteNumber(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function positiveNumber(
  value: unknown,
  fallback: number,
): number {
  const result =
    finiteNumber(
      value,
      fallback,
    );

  return result > 0
    ? result
    : fallback;
}

function vec3(
  value: unknown,
  fallback: GltfVec3,
): GltfVec3 {
  const source =
    value &&
    typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  return {
    x: finiteNumber(
      source.x,
      fallback.x,
    ),

    y: finiteNumber(
      source.y,
      fallback.y,
    ),

    z: finiteNumber(
      source.z,
      fallback.z,
    ),
  };
}

function normalizeQuaternion(
  quaternion: GltfQuaternion,
): GltfQuaternion {
  const length =
    Math.sqrt(
      quaternion.x * quaternion.x +
      quaternion.y * quaternion.y +
      quaternion.z * quaternion.z +
      quaternion.w * quaternion.w,
    );

  if (
    !Number.isFinite(length) ||
    length < 0.000001
  ) {
    return {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    };
  }

  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length,
  };
}

/* -------------------------------------------------------------------------- */
/* Euler → Quaternion                                                         */
/* -------------------------------------------------------------------------- */

function eulerToQuaternion(
  rotation: GltfVec3,
): GltfQuaternion {
  /*
   * Engine rotations are represented as degrees.
   * glTF rotations are represented as unit quaternions.
   */

  const rx =
    rotation.x *
    Math.PI /
    180;

  const ry =
    rotation.y *
    Math.PI /
    180;

  const rz =
    rotation.z *
    Math.PI /
    180;

  const cx = Math.cos(rx / 2);
  const sx = Math.sin(rx / 2);

  const cy = Math.cos(ry / 2);
  const sy = Math.sin(ry / 2);

  const cz = Math.cos(rz / 2);
  const sz = Math.sin(rz / 2);

  return normalizeQuaternion({
    x:
      sx * cy * cz -
      cx * sy * sz,

    y:
      cx * sy * cz +
      sx * cy * sz,

    z:
      cx * cy * sz +
      sx * sy * cz,

    w:
      cx * cy * cz -
      sx * sy * sz,
  });
}

/* -------------------------------------------------------------------------- */
/* Entity Helpers                                                             */
/* -------------------------------------------------------------------------- */

function entityName(
  entity: GltfSceneEntity,
  index: number,
): string {
  const name =
    typeof entity.name === "string"
      ? entity.name.trim()
      : "";

  if (name.length > 0) {
    return name;
  }

  return `Entity ${index + 1}`;
}

/*
 * Entity IDs are metadata identifiers here, not glTF node indices.
 *
 * If the source entity already has an ID, preserve it.
 * Otherwise use a deterministic fallback instead of a random UUID.
 *
 * This is important because render fingerprints must remain deterministic.
 */
function entityId(
  entity: GltfSceneEntity,
  index: number,
): string {
  if (
    typeof entity.id === "string" &&
    entity.id.trim().length > 0
  ) {
    return entity.id;
  }

  return `gltf-entity-${index}`;
}

/*
 * Converts possibly-partial incoming transforms into complete vectors.
 *
 * This function is the boundary between untrusted/partial project data
 * and the strongly typed glTF rendering layer.
 */
function transformOf(
  entity: GltfSceneEntity,
): NormalizedTransform {
  return {
    position: vec3(
      entity.transform?.position,
      DEFAULT_POSITION,
    ),

    rotation: vec3(
      entity.transform?.rotation,
      DEFAULT_ROTATION,
    ),

    scale: vec3(
      entity.transform?.scale,
      DEFAULT_SCALE,
    ),
  };
}

function is3DEntity(
  entity: GltfSceneEntity,
): boolean {
  return (
    entity.representation === "3d" ||
    entity.representation === "hybrid" ||
    entity.type === "character" ||
    entity.type === "prop" ||
    entity.type === "mesh"
  );
}

/* -------------------------------------------------------------------------- */
/* Renderer                                                                   */
/* -------------------------------------------------------------------------- */

export class GltfRenderer {
  readonly capabilities: GltfCapabilities = {
    adapterId: "gltf-json",
    adapterVersion: RENDERER_VERSION,
    contractVersion: "1.0.0",

    capabilities: {
      "render.3d.scene-export": "supported",
      "render.3d": "experimental",
    },
  };

  readonly version =
    RENDERER_VERSION;

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validateScene(
    scene: GltfScene,
  ): void {
    if (
      !scene ||
      typeof scene !== "object"
    ) {
      throw new Error(
        "glTF scene must be an object.",
      );
    }

    if (
      scene.type !== undefined &&
      ![
        "2d",
        "3d",
        "hybrid",
      ].includes(scene.type)
    ) {
      throw new Error(
        `Unsupported scene type "${String(scene.type)}".`,
      );
    }

    if (
      scene.width !== undefined &&
      positiveNumber(
        scene.width,
        0,
      ) <= 0
    ) {
      throw new Error(
        "Scene width must be positive.",
      );
    }

    if (
      scene.height !== undefined &&
      positiveNumber(
        scene.height,
        0,
      ) <= 0
    ) {
      throw new Error(
        "Scene height must be positive.",
      );
    }

    if (
      scene.entities !== undefined &&
      !Array.isArray(scene.entities)
    ) {
      throw new Error(
        "Scene entities must be an array.",
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Node Construction                                                        */
  /* ------------------------------------------------------------------------ */

  private buildNode(
    entity: GltfSceneEntity,
    index: number,
    includeEntityMetadata: boolean,
  ): GltfNode {
    const transform =
      transformOf(entity);

    const quaternion =
      eulerToQuaternion(
        transform.rotation,
      );

    const node: GltfNode = {
      name:
        entityName(
          entity,
          index,
        ),

      translation: [
        transform.position.x,
        transform.position.y,
        transform.position.z,
      ],

      rotation: [
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w,
      ],

      scale: [
        transform.scale.x,
        transform.scale.y,
        transform.scale.z,
      ],
    };

    if (
      includeEntityMetadata
    ) {
      node.extras = {
        cartoonAnimationEngine: {
          entityId:
            entityId(
              entity,
              index,
            ),

          entityType:
            entity.type ??
            "unknown",

          representation:
            entity.representation ??
            "3d",
        },
      };
    }

    return node;
  }

  /* ------------------------------------------------------------------------ */
  /* Build glTF Document                                                      */
  /* ------------------------------------------------------------------------ */

  build(
    scene: GltfScene,
    options: GltfExportOptions = {},
  ): GltfDocument {
    this.validateScene(
      scene,
    );

    const includeEngineMetadata =
      options.includeEngineMetadata ??
      true;

    const includeEntityMetadata =
      options.includeEntityMetadata ??
      true;

    const includeNon3DEntities =
      options.includeNon3DEntities ??
      false;

    const sourceEntities =
      Array.isArray(scene.entities)
        ? scene.entities
        : [];

    /*
     * Preserve source ordering while deterministically
     * filtering entities that belong to the 3D backend.
     */

    const entities =
      sourceEntities.filter(
        (entity) =>
          includeNon3DEntities ||
          is3DEntity(entity),
      );

    const nodes =
      entities.map(
        (
          entity,
          index,
        ) =>
          this.buildNode(
            entity,
            index,
            includeEntityMetadata,
          ),
      );

    const document: GltfDocument = {
      asset: {
        version:
          GLTF_VERSION,

        generator:
          GENERATOR,
      },

      scene: 0,

      scenes: [
        {
          name:
            typeof scene.name === "string" &&
            scene.name.trim().length > 0
              ? scene.name
              : "Scene",

          nodes:
            nodes.map(
              (_, index) => index,
            ),
        },
      ],

      nodes,
    };

    if (
      includeEngineMetadata
    ) {
      document.asset.extras = {
        cartoonAnimationEngine: {
          renderer:
            "gltf-json",

          rendererVersion:
            RENDERER_VERSION,

          contractVersion:
            "1.0.0",

          sourceSceneId:
            scene.id ??
            null,

          sourceSceneType:
            scene.type ??
            null,
        },
      };

      document.extras = {
        cartoonAnimationEngine: {
          renderer:
            "gltf-json",

          rendererVersion:
            RENDERER_VERSION,

          sourceEntityCount:
            sourceEntities.length,

          exportedEntityCount:
            entities.length,
        },
      };
    }

    return document;
  }

  /* ------------------------------------------------------------------------ */
  /* Validate Generated Document                                              */
  /* ------------------------------------------------------------------------ */

  validateDocument(
    document: GltfDocument,
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (
      document.asset.version !==
      GLTF_VERSION
    ) {
      errors.push(
        "glTF asset version must be 2.0.",
      );
    }

    if (
      !Array.isArray(
        document.scenes,
      ) ||
      document.scenes.length === 0
    ) {
      errors.push(
        "glTF document must contain at least one scene.",
      );
    }

    if (
      !Array.isArray(
        document.nodes,
      )
    ) {
      errors.push(
        "glTF document nodes must be an array.",
      );
    }

    if (
      document.scene < 0 ||
      document.scene >=
        document.scenes.length
    ) {
      errors.push(
        "Default scene index is invalid.",
      );
    }

    for (
      const [index, node] of
        document.nodes.entries()
    ) {
      if (
        node.translation &&
        node.translation.length !== 3
      ) {
        errors.push(
          `Node ${index} translation must contain 3 values.`,
        );
      }

      if (
        node.rotation &&
        node.rotation.length !== 4
      ) {
        errors.push(
          `Node ${index} rotation must contain 4 values.`,
        );
      }

      if (
        node.scale &&
        node.scale.length !== 3
      ) {
        errors.push(
          `Node ${index} scale must contain 3 values.`,
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
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    scene: GltfScene,
    options: GltfExportOptions = {},
  ): string {
    return canonicalHash(
      this.build(
        scene,
        options,
      ),
    ) as string;
  }

  /* ------------------------------------------------------------------------ */
  /* Export                                                                   */
  /* ------------------------------------------------------------------------ */

  async export(
    scene: GltfScene,
    path: string,
    options: GltfExportOptions = {},
  ): Promise<GltfExportResult> {
    const document =
      this.build(
        scene,
        options,
      );

    const validation =
      this.validateDocument(
        document,
      );

    if (
      !validation.valid
    ) {
      throw new Error(
        `Generated glTF document is invalid: ${validation.errors.join("; ")}`,
      );
    }

    const output =
      JSON.stringify(
        document,
        null,
        2,
      );

    await mkdir(
      dirname(path),
      {
        recursive: true,
      },
    );

    await writeFile(
      path,
      output,
      "utf8",
    );

    return {
      path,

      hash:
        canonicalHash(
          document,
        ) as string,

      nodeCount:
        document.nodes.length,

      renderer:
        "gltf-json",

      version:
        RENDERER_VERSION,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createGltfRenderer(): GltfRenderer {
  return new GltfRenderer();
}