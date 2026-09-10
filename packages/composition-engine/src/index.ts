import {
  canonicalHash,
  uuid,
} from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export type CompositionRepresentation =
  | "2d"
  | "3d"
  | "hybrid";

export type TransitionType =
  | "cut"
  | "fade"
  | "dissolve"
  | "slide";

export interface CompositionRange {
  startTick: number;
  endTick: number;
}

export interface Caption
  extends CompositionRange {
  id: string;
  text: string;
  x: number;
  y: number;
  style: Record<string, unknown>;
}

export interface Transition
  extends CompositionRange {
  id: string;
  type: TransitionType;
  params: Record<string, unknown>;
}

export interface CompositionScene
  extends CompositionRange {
  id: string;
  name: string;
  sceneId: string;
  representation: CompositionRepresentation;
  layerIds: string[];
  transitionInId?: string;
  transitionOutId?: string;
  metadata?: Record<string, unknown>;
}

export interface CompositionLayer
  extends CompositionRange {
  id: string;
  entityId: string;
  sceneId: string;
  zIndex: number;
  visible: boolean;
  opacity: number;
  metadata?: Record<string, unknown>;
}

export interface CompositionAudio
  extends CompositionRange {
  id: string;
  assetId: string | null;
  volume: number;
  pan: number;
  fadeInTicks: number;
  fadeOutTicks: number;
  metadata?: Record<string, unknown>;
}

export interface Composition {
  schemaVersion: "1.0.0";
  id: string;
  name: string;
  representation: CompositionRepresentation;

  startTick: number;
  endTick: number;

  scenes: CompositionScene[];
  layers: CompositionLayer[];
  captions: Caption[];
  transitions: Transition[];
  audio: CompositionAudio[];

  metadata: Record<string, unknown>;
}

export interface CompositionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompositionBuildOptions {
  name?: string;
  representation?: CompositionRepresentation;
  metadata?: Record<string, unknown>;
}

export interface CompositionCapabilities {
  adapterId: "composition-core";
  adapterVersion: "1.0.0";
  contractVersion: "1.0.0";
  capabilities: {
    "composition.scenes": "supported";
    "composition.layers": "supported";
    "composition.captions": "supported";
    "composition.transitions": "supported";
    "composition.audio": "supported";
    "composition.timeline": "supported";
    "composition.deterministic": "supported";
  };
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const COMPOSITION_VERSION =
  "1.0.0" as const;

const DEFAULT_CAPTION_X = 640;
const DEFAULT_CAPTION_Y = 660;

const DEFAULT_CAPTION_STYLE: Record<
  string,
  unknown
> = {
  fontFamily: "sans-serif",
  fontSize: 32,
};

const EPSILON = 0.000001;

/* -------------------------------------------------------------------------- */
/* Numeric Helpers                                                            */
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

function nonNegativeNumber(
  value: unknown,
  fallback: number,
): number {
  const result =
    finiteNumber(
      value,
      fallback,
    );

  return result >= 0
    ? result
    : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function cloneRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...value,
  };
}

/* -------------------------------------------------------------------------- */
/* Timeline Helpers                                                           */
/* -------------------------------------------------------------------------- */

function validateRange(
  range: CompositionRange,
  label: string,
): string[] {
  const errors: string[] = [];

  if (
    !Number.isFinite(range.startTick) ||
    !Number.isFinite(range.endTick)
  ) {
    errors.push(
      `${label} must contain finite startTick and endTick.`,
    );

    return errors;
  }

  if (
    range.startTick < 0
  ) {
    errors.push(
      `${label} startTick must not be negative.`,
    );
  }

  if (
    range.endTick <= range.startTick
  ) {
    errors.push(
      `${label} endTick must be greater than startTick.`,
    );
  }

  return errors;
}

function durationOf(
  range: CompositionRange,
): number {
  return Math.max(
    0,
    range.endTick -
      range.startTick,
  );
}

function overlaps(
  a: CompositionRange,
  b: CompositionRange,
): boolean {
  return (
    a.startTick < b.endTick &&
    b.startTick < a.endTick
  );
}

/* -------------------------------------------------------------------------- */
/* Composition Engine                                                         */
/* -------------------------------------------------------------------------- */

export class CompositionEngine {
  readonly version =
    COMPOSITION_VERSION;

  readonly capabilities:
    CompositionCapabilities = {
      adapterId:
        "composition-core",

      adapterVersion:
        COMPOSITION_VERSION,

      contractVersion:
        COMPOSITION_VERSION,

      capabilities: {
        "composition.scenes":
          "supported",

        "composition.layers":
          "supported",

        "composition.captions":
          "supported",

        "composition.transitions":
          "supported",

        "composition.audio":
          "supported",

        "composition.timeline":
          "supported",

        "composition.deterministic":
          "supported",
      },
    };

  /* ------------------------------------------------------------------------ */
  /* Caption                                                                  */
  /* ------------------------------------------------------------------------ */

  caption(
    text: string,
    startTick: number,
    endTick: number,
    options: Partial<Caption> = {},
  ): Caption {
    if (
      endTick <= startTick
    ) {
      throw new Error(
        "Caption endTick must be greater than startTick.",
      );
    }

    const normalizedText =
      String(text ?? "").trim();

    if (
      normalizedText.length === 0
    ) {
      throw new Error(
        "Caption text must not be empty.",
      );
    }

    return {
      id:
        typeof options.id === "string" &&
        options.id.trim().length > 0
          ? options.id
          : uuid(),

      text:
        normalizedText,

      startTick,

      endTick,

      x:
        finiteNumber(
          options.x,
          DEFAULT_CAPTION_X,
        ),

      y:
        finiteNumber(
          options.y,
          DEFAULT_CAPTION_Y,
        ),

      style: {
        ...DEFAULT_CAPTION_STYLE,
        ...(options.style ?? {}),
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Transition                                                               */
  /* ------------------------------------------------------------------------ */

  transition(
    type: TransitionType,
    startTick: number,
    endTick: number,
    params: Record<
      string,
      unknown
    > = {},
  ): Transition {
    const supported: TransitionType[] = [
      "cut",
      "fade",
      "dissolve",
      "slide",
    ];

    if (
      !supported.includes(type)
    ) {
      throw new Error(
        `Unsupported transition type "${String(type)}".`,
      );
    }

    if (
      endTick <= startTick
    ) {
      throw new Error(
        "Transition endTick must be greater than startTick.",
      );
    }

    if (
      startTick < 0
    ) {
      throw new Error(
        "Transition startTick must not be negative.",
      );
    }

    return {
      id: uuid(),
      type,
      startTick,
      endTick,
      params: cloneRecord(params),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Scene                                                                    */
  /* ------------------------------------------------------------------------ */

  scene(
    sceneId: string,
    startTick: number,
    endTick: number,
    options: {
      id?: string;
      name?: string;
      representation?: CompositionRepresentation;
      layerIds?: string[];
      transitionInId?: string;
      transitionOutId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): CompositionScene {
    if (
      endTick <= startTick
    ) {
      throw new Error(
        "Scene endTick must be greater than startTick.",
      );
    }

    if (
      String(sceneId).trim().length === 0
    ) {
      throw new Error(
        "Scene ID must not be empty.",
      );
    }

    return {
      id:
        options.id ??
        uuid(),

      name:
        options.name?.trim() ||
        sceneId,

      sceneId:
        String(sceneId),

      startTick,

      endTick,

      representation:
        options.representation ??
        "hybrid",

      layerIds: [
        ...(options.layerIds ?? []),
      ],

      ...(options.transitionInId
        ? {
            transitionInId:
              options.transitionInId,
          }
        : {}),

      ...(options.transitionOutId
        ? {
            transitionOutId:
              options.transitionOutId,
          }
        : {}),

      ...(options.metadata
        ? {
            metadata:
              cloneRecord(
                options.metadata,
              ),
          }
        : {}),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Layer                                                                    */
  /* ------------------------------------------------------------------------ */

  layer(
    entityId: string,
    sceneId: string,
    startTick: number,
    endTick: number,
    options: {
      id?: string;
      zIndex?: number;
      visible?: boolean;
      opacity?: number;
      metadata?: Record<string, unknown>;
    } = {},
  ): CompositionLayer {
    if (
      endTick <= startTick
    ) {
      throw new Error(
        "Layer endTick must be greater than startTick.",
      );
    }

    if (
      String(entityId).trim().length === 0
    ) {
      throw new Error(
        "Layer entityId must not be empty.",
      );
    }

    if (
      String(sceneId).trim().length === 0
    ) {
      throw new Error(
        "Layer sceneId must not be empty.",
      );
    }

    return {
      id:
        options.id ??
        uuid(),

      entityId:
        String(entityId),

      sceneId:
        String(sceneId),

      startTick,

      endTick,

      zIndex:
        Math.trunc(
          finiteNumber(
            options.zIndex,
            0,
          ),
        ),

      visible:
        options.visible ??
        true,

      opacity:
        clamp(
          finiteNumber(
            options.opacity,
            1,
          ),
          0,
          1,
        ),

      ...(options.metadata
        ? {
            metadata:
              cloneRecord(
                options.metadata,
              ),
          }
        : {}),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Audio                                                                    */
  /* ------------------------------------------------------------------------ */

  audio(
    assetId: string | null,
    startTick: number,
    endTick: number,
    options: {
      id?: string;
      volume?: number;
      pan?: number;
      fadeInTicks?: number;
      fadeOutTicks?: number;
      metadata?: Record<string, unknown>;
    } = {},
  ): CompositionAudio {
    if (
      endTick <= startTick
    ) {
      throw new Error(
        "Audio endTick must be greater than startTick.",
      );
    }

    return {
      id:
        options.id ??
        uuid(),

      assetId,

      startTick,

      endTick,

      volume:
        nonNegativeNumber(
          options.volume,
          1,
        ),

      pan:
        clamp(
          finiteNumber(
            options.pan,
            0,
          ),
          -1,
          1,
        ),

      fadeInTicks:
        clamp(
          nonNegativeNumber(
            options.fadeInTicks,
            0,
          ),
          0,
          durationOf({
            startTick,
            endTick,
          }),
        ),

      fadeOutTicks:
        clamp(
          nonNegativeNumber(
            options.fadeOutTicks,
            0,
          ),
          0,
          durationOf({
            startTick,
            endTick,
          }),
        ),

      ...(options.metadata
        ? {
            metadata:
              cloneRecord(
                options.metadata,
              ),
          }
        : {}),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Opacity                                                                  */
  /* ------------------------------------------------------------------------ */

  opacity(
    tick: number,
    start: number,
    end: number,
    mode: "in" | "out" = "in",
  ): number {
    if (
      end <= start
    ) {
      throw new Error(
        "Opacity end must be greater than start.",
      );
    }

    if (
      mode !== "in" &&
      mode !== "out"
    ) {
      throw new Error(
        `Unsupported opacity mode "${String(mode)}".`,
      );
    }

    if (
      tick <= start
    ) {
      return mode === "in"
        ? 0
        : 1;
    }

    if (
      tick >= end
    ) {
      return mode === "in"
        ? 1
        : 0;
    }

    const progress =
      clamp(
        (tick - start) /
          (end - start),
        0,
        1,
      );

    return mode === "in"
      ? progress
      : 1 - progress;
  }

  /* ------------------------------------------------------------------------ */
  /* Transition Opacity                                                       */
  /* ------------------------------------------------------------------------ */

  transitionOpacity(
    transition: Transition,
    tick: number,
  ): number {
    if (
      tick < transition.startTick ||
      tick > transition.endTick
    ) {
      return 0;
    }

    return this.opacity(
      tick,
      transition.startTick,
      transition.endTick,
      "in",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Audio Gain                                                               */
  /* ------------------------------------------------------------------------ */

  audioGainAt(
    clip: CompositionAudio,
    tick: number,
  ): number {
    if (
      tick < clip.startTick ||
      tick > clip.endTick
    ) {
      return 0;
    }

    const fadeIn =
      clip.fadeInTicks > 0
        ? this.opacity(
            tick,
            clip.startTick,
            clip.startTick +
              clip.fadeInTicks,
            "in",
          )
        : 1;

    const fadeOut =
      clip.fadeOutTicks > 0
        ? this.opacity(
            tick,
            clip.endTick -
              clip.fadeOutTicks,
            clip.endTick,
            "out",
          )
        : 1;

    return (
      clip.volume *
      Math.min(
        fadeIn,
        fadeOut,
      )
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Scene                                                                */
  /* ------------------------------------------------------------------------ */

  addScene(
    scenes: CompositionScene[],
    scene: CompositionScene,
  ): CompositionScene[] {
    const next = [
      ...scenes,
      scene,
    ];

    return next.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.endTick -
          b.endTick ||
        a.id.localeCompare(
          b.id,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Layer                                                                */
  /* ------------------------------------------------------------------------ */

  addLayer(
    layers: CompositionLayer[],
    layer: CompositionLayer,
  ): CompositionLayer[] {
    const next = [
      ...layers,
      layer,
    ];

    return next.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.zIndex -
          b.zIndex ||
        a.id.localeCompare(
          b.id,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Caption                                                              */
  /* ------------------------------------------------------------------------ */

  addCaption(
    captions: Caption[],
    caption: Caption,
  ): Caption[] {
    const next = [
      ...captions,
      caption,
    ];

    return next.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.id.localeCompare(
          b.id,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Transition                                                           */
  /* ------------------------------------------------------------------------ */

  addTransition(
    transitions: Transition[],
    transition: Transition,
  ): Transition[] {
    const next = [
      ...transitions,
      transition,
    ];

    return next.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.id.localeCompare(
          b.id,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Add Audio                                                                */
  /* ------------------------------------------------------------------------ */

  addAudio(
    audio: CompositionAudio[],
    clip: CompositionAudio,
  ): CompositionAudio[] {
    const next = [
      ...audio,
      clip,
    ];

    return next.sort(
      (a, b) =>
        a.startTick -
          b.startTick ||
        a.id.localeCompare(
          b.id,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Duration                                                                 */
  /* ------------------------------------------------------------------------ */

  duration(
    composition: Composition,
  ): number {
    return Math.max(
      composition.endTick,
      ...composition.scenes.map(
        (x) => x.endTick,
      ),
      ...composition.layers.map(
        (x) => x.endTick,
      ),
      ...composition.captions.map(
        (x) => x.endTick,
      ),
      ...composition.transitions.map(
        (x) => x.endTick,
      ),
      ...composition.audio.map(
        (x) => x.endTick,
      ),
      0,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Active Items                                                             */
  /* ------------------------------------------------------------------------ */

  activeScenes(
    composition: Composition,
    tick: number,
  ): CompositionScene[] {
    return composition.scenes.filter(
      (scene) =>
        tick >= scene.startTick &&
        tick < scene.endTick,
    );
  }

  activeLayers(
    composition: Composition,
    tick: number,
  ): CompositionLayer[] {
    return composition.layers
      .filter(
        (layer) =>
          layer.visible &&
          tick >= layer.startTick &&
          tick < layer.endTick,
      )
      .sort(
        (a, b) =>
          a.zIndex -
            b.zIndex ||
          a.id.localeCompare(
            b.id,
          ),
      );
  }

  activeCaptions(
    composition: Composition,
    tick: number,
  ): Caption[] {
    return composition.captions.filter(
      (caption) =>
        tick >= caption.startTick &&
        tick < caption.endTick,
    );
  }

  activeAudio(
    composition: Composition,
    tick: number,
  ): CompositionAudio[] {
    return composition.audio.filter(
      (clip) =>
        tick >= clip.startTick &&
        tick < clip.endTick,
    );
  }

  activeTransitions(
    composition: Composition,
    tick: number,
  ): Transition[] {
    return composition.transitions.filter(
      (transition) =>
        tick >=
          transition.startTick &&
        tick < transition.endTick,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validate(
    composition: Composition,
  ): CompositionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !composition ||
      typeof composition !== "object"
    ) {
      return {
        valid: false,
        errors: [
          "Composition must be an object.",
        ],
        warnings: [],
      };
    }

    if (
      composition.schemaVersion !==
      COMPOSITION_VERSION
    ) {
      errors.push(
        `Unsupported composition schema version "${String(
          composition.schemaVersion,
        )}".`,
      );
    }

    errors.push(
      ...validateRange(
        composition,
        "Composition",
      ),
    );

    const sceneIds =
      new Set<string>();

    for (
      const scene of composition.scenes
    ) {
      if (
        sceneIds.has(scene.id)
      ) {
        errors.push(
          `Duplicate scene ID "${scene.id}".`,
        );
      }

      sceneIds.add(scene.id);

      errors.push(
        ...validateRange(
          scene,
          `Scene ${scene.id}`,
        ),
      );

      if (
        scene.endTick >
        composition.endTick
      ) {
        warnings.push(
          `Scene ${scene.id} extends beyond composition endTick.`,
        );
      }
    }

    const layerIds =
      new Set<string>();

    for (
      const layer of composition.layers
    ) {
      if (
        layerIds.has(layer.id)
      ) {
        errors.push(
          `Duplicate layer ID "${layer.id}".`,
        );
      }

      layerIds.add(layer.id);

      errors.push(
        ...validateRange(
          layer,
          `Layer ${layer.id}`,
        ),
      );

      if (
        layer.opacity < 0 ||
        layer.opacity > 1
      ) {
        errors.push(
          `Layer ${layer.id} opacity must be between 0 and 1.`,
        );
      }
    }

    const captionIds =
      new Set<string>();

    for (
      const caption of composition.captions
    ) {
      if (
        captionIds.has(caption.id)
      ) {
        errors.push(
          `Duplicate caption ID "${caption.id}".`,
        );
      }

      captionIds.add(
        caption.id,
      );

      errors.push(
        ...validateRange(
          caption,
          `Caption ${caption.id}`,
        ),
      );

      if (
        caption.text.trim().length ===
        0
      ) {
        errors.push(
          `Caption ${caption.id} text must not be empty.`,
        );
      }
    }

    const transitionIds =
      new Set<string>();

    for (
      const transition of
        composition.transitions
    ) {
      if (
        transitionIds.has(
          transition.id,
        )
      ) {
        errors.push(
          `Duplicate transition ID "${transition.id}".`,
        );
      }

      transitionIds.add(
        transition.id,
      );

      errors.push(
        ...validateRange(
          transition,
          `Transition ${transition.id}`,
        ),
      );
    }

    const audioIds =
      new Set<string>();

    for (
      const clip of composition.audio
    ) {
      if (
        audioIds.has(clip.id)
      ) {
        errors.push(
          `Duplicate audio ID "${clip.id}".`,
        );
      }

      audioIds.add(clip.id);

      errors.push(
        ...validateRange(
          clip,
          `Audio ${clip.id}`,
        ),
      );

      if (
        clip.volume < 0
      ) {
        errors.push(
          `Audio ${clip.id} volume must not be negative.`,
        );
      }

      if (
        clip.pan < -1 ||
        clip.pan > 1
      ) {
        errors.push(
          `Audio ${clip.id} pan must be between -1 and 1.`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Scene overlap warning                                                  */
    /* ---------------------------------------------------------------------- */

    for (
      let i = 0;
      i <
        composition.scenes.length;
      i++
    ) {
      for (
        let j = i + 1;
        j <
          composition.scenes.length;
        j++
      ) {
        const a =
          composition.scenes[i];

        const b =
          composition.scenes[j];

        if (
          overlaps(a, b)
        ) {
          warnings.push(
            `Scenes ${a.id} and ${b.id} overlap in time.`,
          );
        }
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Transition checks                                                      */
    /* ---------------------------------------------------------------------- */

    for (
      const transition of
        composition.transitions
    ) {
      if (
        transition.type === "cut" &&
        durationOf(transition) >
          1
      ) {
        warnings.push(
          `Cut transition ${transition.id} has a duration greater than one tick.`,
        );
      }
    }

    return {
      valid:
        errors.length === 0,

      errors,

      warnings,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Build Composition                                                        */
  /* ------------------------------------------------------------------------ */

  build(
    scenes: CompositionScene[],
    layers: CompositionLayer[],
    captions: Caption[],
    transitions: Transition[],
    audio: CompositionAudio[],
    options: CompositionBuildOptions = {},
  ): Composition {
    const allRanges: CompositionRange[] = [
      ...scenes,
      ...layers,
      ...captions,
      ...transitions,
      ...audio,
    ];

    const startTick =
      allRanges.length > 0
        ? Math.min(
            ...allRanges.map(
              (x) => x.startTick,
            ),
          )
        : 0;

    const endTick =
      allRanges.length > 0
        ? Math.max(
            ...allRanges.map(
              (x) => x.endTick,
            ),
          )
        : 0;

    return {
      schemaVersion:
        COMPOSITION_VERSION,

      id:
        uuid(),

      name:
        options.name?.trim() ||
        "Untitled Composition",

      representation:
        options.representation ??
        "hybrid",

      startTick,

      endTick,

      scenes: [
        ...scenes,
      ].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.id.localeCompare(
            b.id,
          ),
      ),

      layers: [
        ...layers,
      ].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.zIndex -
            b.zIndex ||
          a.id.localeCompare(
            b.id,
          ),
      ),

      captions: [
        ...captions,
      ].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.id.localeCompare(
            b.id,
          ),
      ),

      transitions: [
        ...transitions,
      ].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.id.localeCompare(
            b.id,
          ),
      ),

      audio: [
        ...audio,
      ].sort(
        (a, b) =>
          a.startTick -
            b.startTick ||
          a.id.localeCompare(
            b.id,
          ),
      ),

      metadata: {
        ...(options.metadata ?? {}),
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    composition: Composition,
  ): string {
    const normalized = {
      schemaVersion:
        composition.schemaVersion,

      id:
        composition.id,

      name:
        composition.name,

      representation:
        composition.representation,

      startTick:
        composition.startTick,

      endTick:
        composition.endTick,

      scenes:
        composition.scenes,

      layers:
        composition.layers,

      captions:
        composition.captions,

      transitions:
        composition.transitions,

      audio:
        composition.audio,

      metadata:
        composition.metadata,
    };

    return canonicalHash(
      normalized,
    ) as string;
  }

  /* ------------------------------------------------------------------------ */
  /* Clone                                                                    */
  /* ------------------------------------------------------------------------ */

  clone(
    composition: Composition,
  ): Composition {
    return {
      ...composition,

      scenes:
        composition.scenes.map(
          (x) => ({
            ...x,
            layerIds: [
              ...x.layerIds,
            ],
            metadata:
              x.metadata
                ? {
                    ...x.metadata,
                  }
                : undefined,
          }),
        ),

      layers:
        composition.layers.map(
          (x) => ({
            ...x,
            metadata:
              x.metadata
                ? {
                    ...x.metadata,
                  }
                : undefined,
          }),
        ),

      captions:
        composition.captions.map(
          (x) => ({
            ...x,
            style: {
              ...x.style,
            },
          }),
        ),

      transitions:
        composition.transitions.map(
          (x) => ({
            ...x,
            params: {
              ...x.params,
            },
          }),
        ),

      audio:
        composition.audio.map(
          (x) => ({
            ...x,
            metadata:
              x.metadata
                ? {
                    ...x.metadata,
                  }
                : undefined,
          }),
        ),

      metadata: {
        ...composition.metadata,
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createCompositionEngine(): CompositionEngine {
  return new CompositionEngine();
}