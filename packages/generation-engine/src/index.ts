import { canonicalHash, uuid } from "../../domain/src/index.js";

import { CharacterEngine } from "../../character-engine/src/index.js";
import { SceneEngine } from "../../scene-engine/src/index.js";

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export interface GenerationAdapter {
  id: string;
  version: string;
  capabilities: string[];
}

export interface GenerationProvenance {
  adapter: GenerationAdapter;
  deterministic: true;
  inputHash: string;
}

export interface CharacterGenerationRequest {
  name?: string;
  [key: string]: unknown;
}

export interface SceneGenerationRequest {
  name?: string;
  template?: string;
  type?: "2d" | "3d" | "hybrid";
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface GenerationResult<T> {
  requestId: string;
  result: T;
  provenance: GenerationProvenance;
}

export interface GenerationCapabilities {
  characterTemplate: "supported";
  sceneTemplate: "supported";
  propTemplate: "planned";
  outfitTemplate: "supported";
}

/* -------------------------------------------------------------------------- */
/* Internal Types                                                             */
/* -------------------------------------------------------------------------- */

interface NormalizedCharacterGenerationRequest
  extends CharacterGenerationRequest {
  name: string;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ADAPTER_ID = "procedural-local";
const ADAPTER_VERSION = "1.0.0";

const DEFAULT_CHARACTER_NAME = "Generated Character";

const DEFAULT_SCENE_NAME = "Generated Scene";

const DEFAULT_SCENE_WIDTH = 1280;
const DEFAULT_SCENE_HEIGHT = 720;

const DEFAULT_SCENE_TYPE = "2d" as const;

const SUPPORTED_SCENE_TYPES = [
  "2d",
  "3d",
  "hybrid",
] as const;

/* -------------------------------------------------------------------------- */
/* Safe Helpers                                                               */
/* -------------------------------------------------------------------------- */

function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function optionalString(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function positiveInteger(
  value: unknown,
  fallback: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return fallback;
  }

  return Math.floor(value);
}

function sceneType(
  value: unknown,
): "2d" | "3d" | "hybrid" {
  if (
    value === "2d" ||
    value === "3d" ||
    value === "hybrid"
  ) {
    return value;
  }

  return DEFAULT_SCENE_TYPE;
}

/* -------------------------------------------------------------------------- */
/* Request Normalization                                                      */
/* -------------------------------------------------------------------------- */

function normalizeCharacterRequest(
  request: CharacterGenerationRequest,
): NormalizedCharacterGenerationRequest {
  const source = asObject(request);

  const name =
    optionalString(
      source.name,
    ) ??
    DEFAULT_CHARACTER_NAME;

  return {
    ...source,
    name,
  };
}

function normalizeSceneRequest(
  request: SceneGenerationRequest,
): SceneGenerationRequest {
  const source = asObject(request);

  const name =
    optionalString(
      source.name,
    ) ??
    DEFAULT_SCENE_NAME;

  return {
    ...source,

    name,

    template:
      optionalString(
        source.template,
      ),

    type:
      sceneType(
        source.type,
      ),

    width:
      positiveInteger(
        source.width,
        DEFAULT_SCENE_WIDTH,
      ),

    height:
      positiveInteger(
        source.height,
        DEFAULT_SCENE_HEIGHT,
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Procedural Generation Engine                                               */
/* -------------------------------------------------------------------------- */

export class ProceduralGenerationEngine {
  readonly adapter: GenerationAdapter = {
    id: ADAPTER_ID,
    version: ADAPTER_VERSION,

    capabilities: [
      "generation.character.template",
      "generation.scene.template",
      "generation.outfit.template",
    ],
  };

  readonly capabilities: GenerationCapabilities = {
    characterTemplate: "supported",
    sceneTemplate: "supported",
    propTemplate: "planned",
    outfitTemplate: "supported",
  };

  readonly version =
    ADAPTER_VERSION;

  constructor(
    private readonly characters =
      new CharacterEngine(),

    private readonly scenes =
      new SceneEngine(),
  ) {}

  /* ------------------------------------------------------------------------ */
  /* Adapter Information                                                      */
  /* ------------------------------------------------------------------------ */

  getCapabilities(): GenerationAdapter {
    return {
      id:
        this.adapter.id,

      version:
        this.adapter.version,

      capabilities: [
        ...this.adapter.capabilities,
      ],
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Character Generation                                                     */
  /* ------------------------------------------------------------------------ */

  character(
    request: CharacterGenerationRequest = {},
  ): GenerationResult<
    ReturnType<CharacterEngine["create"]>
  > {
    const normalized =
      normalizeCharacterRequest(
        request,
      );

    const inputHash =
      canonicalHash(
        normalized,
      ) as string;

    const result =
      this.characters.create(
        normalized,
      );

    return {
      requestId:
        uuid(),

      result,

      provenance: {
        adapter:
          this.getCapabilities(),

        deterministic:
          true,

        inputHash,
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Generation                                                         */
  /* ------------------------------------------------------------------------ */

  scene(
    request: SceneGenerationRequest = {},
  ): GenerationResult<
    ReturnType<SceneEngine["create"]>
  > {
    const normalized =
      normalizeSceneRequest(
        request,
      );

    const inputHash =
      canonicalHash(
        normalized,
      ) as string;

    const name =
      normalized.name ??
      DEFAULT_SCENE_NAME;

    const type =
      sceneType(
        normalized.type,
      );

    const width =
      positiveInteger(
        normalized.width,
        DEFAULT_SCENE_WIDTH,
      );

    const height =
      positiveInteger(
        normalized.height,
        DEFAULT_SCENE_HEIGHT,
      );

    const template =
      optionalString(
        normalized.template,
      );

    let result:
      ReturnType<SceneEngine["create"]>;

    if (
      template === "classroom"
    ) {
      result =
        this.scenes.classroom(
          name,
        ) as ReturnType<
          SceneEngine["create"]
        >;
    } else {
      result =
        this.scenes.create(
          name,
          type,
          width,
          height,
        );
    }

    return {
      requestId:
        uuid(),

      result,

      provenance: {
        adapter:
          this.getCapabilities(),

        deterministic:
          true,

        inputHash,
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Generic Generation Dispatcher                                           */
  /* ------------------------------------------------------------------------ */

  generate(
    kind:
      | "character"
      | "scene",

    request:
      Record<string, unknown> = {},
  ):
    | GenerationResult<
        ReturnType<CharacterEngine["create"]>
      >
    | GenerationResult<
        ReturnType<SceneEngine["create"]>
      > {
    switch (kind) {
      case "character":
        return this.character(
          request,
        );

      case "scene":
        return this.scene(
          request,
        );

      default:
        throw new Error(
          `Unsupported generation kind "${String(
            kind,
          )}".`,
        );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Deterministic Fingerprints                                               */
  /* ------------------------------------------------------------------------ */

  fingerprintCharacter(
    request:
      CharacterGenerationRequest = {},
  ): string {
    return canonicalHash(
      normalizeCharacterRequest(
        request,
      ),
    ) as string;
  }

  fingerprintScene(
    request:
      SceneGenerationRequest = {},
  ): string {
    return canonicalHash(
      normalizeSceneRequest(
        request,
      ),
    ) as string;
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validateCharacterRequest(
    request:
      CharacterGenerationRequest,
  ): void {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request)
    ) {
      throw new Error(
        "Character generation request must be an object.",
      );
    }

    if (
      request.name !== undefined &&
      optionalString(
        request.name,
      ) === undefined
    ) {
      throw new Error(
        "Character generation name must be a non-empty string when provided.",
      );
    }
  }

  validateSceneRequest(
    request:
      SceneGenerationRequest,
  ): void {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request)
    ) {
      throw new Error(
        "Scene generation request must be an object.",
      );
    }

    if (
      request.type !== undefined &&
      !SUPPORTED_SCENE_TYPES.includes(
        request.type,
      )
    ) {
      throw new Error(
        `Unsupported scene type "${String(
          request.type,
        )}".`,
      );
    }

    if (
      request.width !== undefined &&
      (
        typeof request.width !== "number" ||
        !Number.isFinite(
          request.width,
        ) ||
        request.width <= 0
      )
    ) {
      throw new Error(
        "Scene width must be a positive finite number.",
      );
    }

    if (
      request.height !== undefined &&
      (
        typeof request.height !== "number" ||
        !Number.isFinite(
          request.height,
        ) ||
        request.height <= 0
      )
    ) {
      throw new Error(
        "Scene height must be a positive finite number.",
      );
    }

    if (
      request.template !== undefined &&
      optionalString(
        request.template,
      ) === undefined
    ) {
      throw new Error(
        "Scene template must be a non-empty string when provided.",
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Safe Character Generation                                               */
  /* ------------------------------------------------------------------------ */

  generateCharacter(
    request:
      CharacterGenerationRequest = {},
  ) {
    this.validateCharacterRequest(
      request,
    );

    return this.character(
      request,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Safe Scene Generation                                                    */
  /* ------------------------------------------------------------------------ */

  generateScene(
    request:
      SceneGenerationRequest = {},
  ) {
    this.validateSceneRequest(
      request,
    );

    return this.scene(
      request,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createProceduralGenerationEngine():
  ProceduralGenerationEngine {
  return new ProceduralGenerationEngine();
}