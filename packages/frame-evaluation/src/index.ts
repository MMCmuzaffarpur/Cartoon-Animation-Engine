import { canonicalHash } from "../../domain/src/index.js";

import { AnimationEngine } from "../../animation-engine/src/index.js";
import { FacialEngine } from "../../facial-engine/src/index.js";
import { LipSyncEngine } from "../../lipsync-engine/src/index.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface EvaluatedFrameState {
  schemaVersion: "1.0.0";
  projectId: string;
  revisionId: string;
  tick: number;
  entities: EvaluatedEntity[];
  camera: EvaluatedCamera;
  audio: unknown[];
  hash: string;
}

export interface EvaluatedEntity {
  id: string;
  evaluation: {
    motion: Record<string, number>;
    facial: Record<string, number>;
    viseme: unknown;
  };
  [key: string]: unknown;
}

export interface EvaluatedCamera {
  position: {
    x: number;
    y: number;
    z: number;
  };

  target: {
    x: number;
    y: number;
    z: number;
  };

  zoom: number;

  fov?: number;

  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Internal Helpers                                                            */
/* -------------------------------------------------------------------------- */

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function assertFiniteTick(
  tick: number,
): void {
  if (!isFiniteNumber(tick)) {
    throw new Error(
      "Frame evaluation tick must be finite.",
    );
  }

  if (tick < 0) {
    throw new Error(
      "Frame evaluation tick must not be negative.",
    );
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeProjectId(
  project: any,
): string {
  const id =
    project?.projectId ??
    project?.id;

  if (
    typeof id !== "string" ||
    id.trim().length === 0
  ) {
    throw new Error(
      "Project must contain a valid projectId or id.",
    );
  }

  return id;
}

function normalizeRevisionId(
  revisionId: string,
): string {
  if (
    typeof revisionId !== "string" ||
    revisionId.trim().length === 0
  ) {
    throw new Error(
      "revisionId must be a non-empty string.",
    );
  }

  return revisionId;
}

function normalizeEntityId(
  entity: any,
  index: number,
): string {
  const id =
    typeof entity?.id === "string"
      ? entity.id
      : `entity-${index}`;

  if (id.trim().length === 0) {
    throw new Error(
      `Entity at index ${index} has an empty id.`,
    );
  }

  return id;
}

/* -------------------------------------------------------------------------- */
/* Camera                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeVec3(
  value: any,
  fallback: {
    x: number;
    y: number;
    z: number;
  },
) {
  const source =
    value ?? fallback;

  const x =
    isFiniteNumber(source.x)
      ? source.x
      : fallback.x;

  const y =
    isFiniteNumber(source.y)
      ? source.y
      : fallback.y;

  const z =
    isFiniteNumber(source.z)
      ? source.z
      : fallback.z;

  return {
    x,
    y,
    z,
  };
}

function normalizeCamera(
  camera: any,
): EvaluatedCamera {
  const source =
    camera ?? {};

  const position =
    normalizeVec3(
      source.position,
      {
        x: 0,
        y: 0,
        z: 10,
      },
    );

  const target =
    normalizeVec3(
      source.target,
      {
        x: 0,
        y: 0,
        z: 0,
      },
    );

  const zoom =
    isFiniteNumber(source.zoom) &&
    source.zoom > 0
      ? source.zoom
      : 1;

  const result: EvaluatedCamera =
    {
      ...clone(source),
      position,
      target,
      zoom,
    };

  if (
    isFiniteNumber(source.fov)
  ) {
    result.fov = source.fov;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Animation Resolution                                                       */
/* -------------------------------------------------------------------------- */

function extractAnimationClips(
  project: any,
): any[] {
  const candidates = [
    project?.animationClips,
    project?.animations?.clips,
    project?.components?.animationClips,
    project?.assets?.animationClips,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      Array.isArray(candidate)
    ) {
      return candidate;
    }
  }

  return [];
}

function resolveMotionEvaluation(
  animationEngine: AnimationEngine,
  entity: any,
  project: any,
  tick: number,
): Record<string, number> {
  const components =
    entity?.components ?? {};

  const motion =
    components.motionLayers;

  if (
    !Array.isArray(motion) ||
    motion.length === 0
  ) {
    return {};
  }

  /*
   * Legacy representation:
   *
   * [
   *   {
   *     id,
   *     order,
   *     weight,
   *     mask,
   *     additive,
   *     clip
   *   }
   * ]
   */
  const embeddedLayers =
    motion.filter(
      (layer: any) =>
        layer &&
        layer.clip &&
        typeof layer.clip === "object",
    );

  if (
    embeddedLayers.length === motion.length
  ) {
    return animationEngine.evaluate(
      embeddedLayers as any,
      tick,
    ) as Record<string, number>;
  }

  /*
   * Canonical representation:
   *
   * motionLayers contain clipId.
   *
   * Clips may be stored at project level.
   */
  const clips =
    extractAnimationClips(
      project,
    );

  if (
    clips.length === 0
  ) {
    /*
     * A malformed/incomplete animation
     * reference must not silently produce
     * a fake animation state.
     */
    throw new Error(
      `Entity ${normalizeEntityId(
        entity,
        0,
      )} contains motionLayers but no animation clips are available.`,
    );
  }

  return (
    animationEngine.evaluate(
      clips as any,
      motion as any,
      tick,
    ) as any
  ).values;
}

/* -------------------------------------------------------------------------- */
/* Facial Evaluation                                                          */
/* -------------------------------------------------------------------------- */

function resolveFacialEvaluation(
  facialEngine: FacialEngine,
  entity: any,
): Record<string, number> {
  const expression =
    entity?.components?.expression;

  if (
    expression == null
  ) {
    return {};
  }

  if (
    typeof expression === "string"
  ) {
    return facialEngine.expression(
      expression,
    );
  }

  if (
    typeof expression === "object"
  ) {
    /*
     * Modern facial state can expose
     * an expression name/weight.
     */
    const name =
      typeof expression.name ===
      "string"
        ? expression.name
        : "neutral";

    const weight =
      isFiniteNumber(
        expression.weight,
      )
        ? expression.weight
        : isFiniteNumber(
              expression.intensity,
            )
          ? expression.intensity
          : 1;

    return facialEngine.expression(
      name,
      weight,
    );
  }

  return {};
}

/* -------------------------------------------------------------------------- */
/* Lip Sync Evaluation                                                        */
/* -------------------------------------------------------------------------- */

function resolveLipSyncEvaluation(
  lipsync: LipSyncEngine,
  entity: any,
  tick: number,
): unknown {
  const track =
    entity?.components?.lipSync;

  if (
    !track ||
    typeof track !== "object"
  ) {
    return null;
  }

  if (
    !Array.isArray(track.visemes)
  ) {
    return {
      viseme: "REST",
      weight: 0,
    };
  }

  return clone(
    lipsync.visemeAt(
      track,
      tick,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                      */
/* -------------------------------------------------------------------------- */

function resolveAudio(
  project: any,
): unknown[] {
  const settings =
    project?.settings;

  if (
    Array.isArray(
      settings?.audioTracks,
    )
  ) {
    return clone(
      settings.audioTracks,
    );
  }

  if (
    Array.isArray(
      project?.audioTracks,
    )
  ) {
    return clone(
      project.audioTracks,
    );
  }

  if (
    Array.isArray(
      project?.audio,
    )
  ) {
    return clone(
      project.audio,
    );
  }

  return [];
}

/* -------------------------------------------------------------------------- */
/* Frame Evaluator                                                            */
/* -------------------------------------------------------------------------- */

export class FrameEvaluator {
  constructor(
    private readonly animations =
      new AnimationEngine(),

    private readonly facial =
      new FacialEngine(),

    private readonly lipsync =
      new LipSyncEngine(),
  ) {}

  /* ------------------------------------------------------------------------ */
  /* Main Evaluation                                                          */
  /* ------------------------------------------------------------------------ */

  evaluate(
    input: {
      project: any;
      revisionId: string;
      tick: number;
      camera?: any;
    },
  ): EvaluatedFrameState {
    if (
      !input ||
      typeof input !== "object"
    ) {
      throw new Error(
        "Frame evaluation input is required.",
      );
    }

    if (
      !input.project ||
      typeof input.project !==
        "object"
    ) {
      throw new Error(
        "Frame evaluation requires a project.",
      );
    }

    assertFiniteTick(
      input.tick,
    );

    const projectId =
      normalizeProjectId(
        input.project,
      );

    const revisionId =
      normalizeRevisionId(
        input.revisionId,
      );

    const project =
      clone(input.project);

    const entities =
      Array.isArray(
        project.entities,
      )
        ? project.entities
        : [];

    const evaluatedEntities =
      entities.map(
        (
          entity: any,
          index: number,
        ): EvaluatedEntity => {
          const motion =
            resolveMotionEvaluation(
              this.animations,
              entity,
              project,
              input.tick,
            );

          const facial =
            resolveFacialEvaluation(
              this.facial,
              entity,
            );

          const viseme =
            resolveLipSyncEvaluation(
              this.lipsync,
              entity,
              input.tick,
            );

          return {
            ...clone(entity),

            id:
              normalizeEntityId(
                entity,
                index,
              ),

            evaluation: {
              motion:
                clone(motion),

              facial:
                clone(facial),

              viseme:
                clone(viseme),
            },
          };
        },
      );

    const stateWithoutHash = {
      schemaVersion:
        "1.0.0" as const,

      projectId,

      revisionId,

      tick:
        input.tick,

      entities:
        evaluatedEntities,

      camera:
        normalizeCamera(
          input.camera ??
            project.camera ??
            project.settings
              ?.camera,
        ),

      audio:
        resolveAudio(
          project,
        ),
    };

    const hash =
      canonicalHash(
        stateWithoutHash,
      ) as string;

    return {
      ...stateWithoutHash,
      hash,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Deterministic Evaluation                                                */
  /* ------------------------------------------------------------------------ */

  evaluateDeterministic(
    input: {
      project: any;
      revisionId: string;
      tick: number;
      camera?: any;
    },
  ): EvaluatedFrameState {
    const first =
      this.evaluate(input);

    const second =
      this.evaluate(input);

    if (
      first.hash !==
      second.hash
    ) {
      throw new Error(
        "Frame evaluation is not deterministic.",
      );
    }

    return first;
  }

  /* ------------------------------------------------------------------------ */
  /* Hash                                                                      */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    state: EvaluatedFrameState,
  ): string {
    const normalized = {
      schemaVersion:
        state.schemaVersion,

      projectId:
        state.projectId,

      revisionId:
        state.revisionId,

      tick:
        state.tick,

      entities:
        state.entities,

      camera:
        state.camera,

      audio:
        state.audio,
    };

    return canonicalHash(
      normalized,
    ) as string;
  }
}