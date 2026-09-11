import { z } from "zod";

export const SchemaVersion = "1.0.0";
const Uuid = z.string().uuid();
const Time = z.string().datetime();

export const Vec2 = z.object({ x: z.number(), y: z.number() });
export const Vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
export const Transform = z.object({
  position: Vec3.default({x:0,y:0,z:0}),
  rotation: Vec3.default({x:0,y:0,z:0}),
  scale: Vec3.default({x:1,y:1,z:1})
});

export const AssetRef = z.object({ assetId: Uuid, revision: z.number().int().nonnegative().optional(), contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional() });
export const Entity = z.object({
  id: Uuid, type: z.string(), name: z.string().min(1), aliases: z.array(z.string()).default([]),
  representation: z.enum(["2d","3d","hybrid"]).default("2d"), transform: Transform.default({}),
  components: z.record(z.unknown()).default({})
});

export const ProjectManifest = z.object({
  id: Uuid, projectId: Uuid, name: z.string().min(1), schemaVersion: z.string(),
  revision: z.number().int().nonnegative(), createdAt: Time, updatedAt: Time,
  tickRate: z.number().int().positive(), frameRate: z.object({numerator:z.number().int().positive(),denominator:z.number().int().positive()}),
  durationTicks: z.number().int().nonnegative().default(0),
  assets: z.array(AssetRef).default([]), entities: z.array(Entity).default([]),
  characters: z.array(z.record(z.unknown())).default([]),
  scenes: z.array(z.record(z.unknown())).default([]),
  sequences: z.array(z.record(z.unknown())).default([]),
  settings: z.record(z.unknown()).default({})
});

export const ProjectRevision = z.object({
  revisionId: Uuid, projectId: Uuid, parentRevisionId: Uuid.nullable(), number:z.number().int().nonnegative(),
  author:z.string(), source:z.string(), createdAt:Time, schemaVersion:z.string(), contentHash:z.string().regex(/^[a-f0-9]{64}$/),
  changeSummary:z.string(), snapshot:z.record(z.unknown())
});

export const CharacterDefinition = z.object({
  id:Uuid, schemaVersion:z.string(), name:z.string(), representations:z.array(z.enum(["2d","3d","hybrid"])),
  parameterSchema:z.record(z.unknown()), slots:z.array(z.string()), rigProfiles:z.array(z.string()),
  defaults:z.record(z.unknown()).default({}), capabilities:z.array(z.string()).default([])
});
export const CharacterAssembly = z.object({
  id:Uuid, schemaVersion:z.string(), name:z.string(), definitionId:Uuid, definitionRevision:z.number().int().nonnegative(),
  representation:z.enum(["2d","3d","hybrid"]), seed:z.number().int().nonnegative(),
  parameters:z.record(z.unknown()).default({}), outfit:z.record(z.unknown()).default({}),
  makeup:z.record(z.unknown()).default({}), hair:z.record(z.unknown()).default({}),
  rigId:Uuid.nullable().default(null), variants:z.array(z.record(z.unknown())).default([])
});
export const CharacterVariant = z.object({ id:Uuid, baseAssemblyId:Uuid, name:z.string(), delta:z.record(z.unknown()) });

export const RigDefinition = z.object({
  id:Uuid, name:z.string(), dimension:z.enum(["2d","3d"]), joints:z.array(z.object({id:z.string(),parentId:z.string().nullable(),rest:z.object({x:z.number(),y:z.number(),z:z.number()})})),
  controls:z.array(z.object({id:z.string(),kind:z.string(),targetIds:z.array(z.string())})), constraints:z.array(z.record(z.unknown())).default([])
});

export const Keyframe = z.object({tick:z.number().int().nonnegative(),value:z.unknown(),interpolation:z.enum(["step","linear","smooth"]).default("linear")});
export const MotionClip = z.object({
  id:Uuid,name:z.string(),durationTicks:z.number().int().positive(),loopMode:z.enum(["once","loop","pingpong"]).default("once"),
  tracks:z.array(z.object({targetPath:z.string(),keyframes:z.array(Keyframe)})), events:z.array(z.record(z.unknown())).default([]),
  rootMotion:z.record(z.unknown()).default({}), semanticCategory:z.string(), rigRequirements:z.array(z.string()).default([])
});
export const MotionLayer = z.object({ id:Uuid, order:z.number().int(), kind:z.string(), weight:z.number().min(0).max(1), mask:z.array(z.string()).default([]), clipId:Uuid, additive:z.boolean().default(false) });

export const FacialControl = z.object({ name:z.string(), value:z.number().min(-1).max(1) });
export const Expression = z.object({ id:Uuid,name:z.string(),controls:z.array(FacialControl) });
export const LipSyncTrack = z.object({
  id:Uuid,audioAssetId:Uuid.nullable(),language:z.string(),analyzer:z.string(),version:z.string(),
  phonemes:z.array(z.object({startTick:z.number().int().nonnegative(),endTick:z.number().int().nonnegative(),phoneme:z.string(),confidence:z.number().min(0).max(1)})),
  visemes:z.array(z.object({startTick:z.number().int().nonnegative(),endTick:z.number().int().nonnegative(),viseme:z.string(),weight:z.number().min(0).max(1)})),
  curves:z.array(z.record(z.unknown())).default([]),alignmentVersion:z.string(),manualOverrides:z.array(z.record(z.unknown())).default([]),
  provenance:z.record(z.unknown()).default({})
});

export const Scene = z.object({
  id:Uuid,name:z.string(),type:z.enum(["2d","3d","hybrid"]),width:z.number().int().positive(),height:z.number().int().positive(),
  background:z.record(z.unknown()).default({}), entities:z.array(Entity).default([]), lights:z.array(z.record(z.unknown())).default([]),
  navigationAnchors:z.array(z.object({id:z.string(),x:z.number(),y:z.number(),z:z.number().default(0)})).default([]),
  renderLayers:z.array(z.object({id:z.string(),order:z.number().int(),name:z.string()})).default([]),
  settings:z.record(z.unknown()).default({})
});
/* -------------------------------------------------------------------------- */
/* Camera Contract                                                            */
/* -------------------------------------------------------------------------- */

export const CameraType = z.enum([
  "orthographic",
  "perspective",
]);

export const CameraInterpolation = z.enum([
  "step",
  "linear",
  "smooth",
]);

export const CameraProjection = z.enum([
  "2d",
  "3d",
  "hybrid",
]);

export const CameraConstraint = z.object({
  id: z.string().min(1),
  type: z.enum([
    "position-limit",
    "target-limit",
    "zoom-limit",
    "fov-limit",
    "scene-bounds",
    "target-lock",
    "follow",
    "dead-zone",
  ]),
  enabled: z.boolean().default(true),
  parameters: z.record(z.unknown()).default({}),
});

/* -------------------------------------------------------------------------- */
/* Camera Composition                                                         */
/* -------------------------------------------------------------------------- */

export const CameraComposition = z.object({
  mode: z.enum([
    "free",
    "center",
    "rule-of-thirds",
    "headroom",
    "look-room",
    "custom",
  ]).default("free"),

  subjectId: Uuid.nullable().default(null),

  anchorX: z.number().min(0).max(1).default(0.5),
  anchorY: z.number().min(0).max(1).default(0.5),

  headroom: z.number().min(0).max(1).default(0.15),
  lookRoom: z.number().min(0).max(1).default(0.15),

  safeArea: z.object({
    left: z.number().min(0).max(0.5).default(0.05),
    right: z.number().min(0).max(0.5).default(0.05),
    top: z.number().min(0).max(0.5).default(0.05),
    bottom: z.number().min(0).max(0.5).default(0.05),
  }).default({}),
});

/* -------------------------------------------------------------------------- */
/* Camera Follow                                                              */
/* -------------------------------------------------------------------------- */

export const CameraFollow = z.object({
  enabled: z.boolean().default(false),

  targetEntityId: Uuid.nullable().default(null),

  offset: Vec3.default({
    x: 0,
    y: 0,
    z: 0,
  }),

  weight: z.number().min(0).max(1).default(1),

  damping: z.number().min(0).default(0),

  preserveZ: z.boolean().default(true),

  deadZone: z.object({
    x: z.number().min(0).default(0),
    y: z.number().min(0).default(0),
    z: z.number().min(0).default(0),
  }).default({}),
});

/* -------------------------------------------------------------------------- */
/* Camera Shake                                                               */
/* -------------------------------------------------------------------------- */

export const CameraShake = z.object({
  enabled: z.boolean().default(false),

  amplitude: z.number().min(0).default(0),

  frequency: z.number().min(0).default(1),

  seed: z.number().int().nonnegative().default(0),

  position: z.object({
    x: z.number().default(1),
    y: z.number().default(1),
    z: z.number().default(1),
  }).default({}),

  rotation: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }).default({}),
});

/* -------------------------------------------------------------------------- */
/* Camera Keyframe                                                            */
/* -------------------------------------------------------------------------- */

export const CameraKeyframe = z.object({
  tick: z.number().int().nonnegative(),

  position: Vec3.optional(),

  target: Vec3.optional(),

  zoom: z.number().positive().optional(),

  fov: z.number().positive().max(179).optional(),

  interpolation:
    CameraInterpolation.default("smooth"),

  tension: z.number().min(-1).max(1).default(0),

  continuity: z.enum([
    "continuous",
    "broken",
  ]).default("continuous"),
});

/* -------------------------------------------------------------------------- */
/* Camera Track                                                               */
/* -------------------------------------------------------------------------- */

export const CameraTrack = z.object({
  id: Uuid,

  name: z.string().min(1),

  keyframes: z.array(
    CameraKeyframe,
  ).min(1),

  enabled: z.boolean().default(true),

  weight: z.number().min(0).max(1).default(1),

  additive: z.boolean().default(false),
});

/* -------------------------------------------------------------------------- */
/* Camera Preset                                                              */
/* -------------------------------------------------------------------------- */

export const CameraPreset = z.object({
  id: z.string().min(1),

  name: z.string().min(1),

  shotType: z.enum([
    "extreme-close-up",
    "close-up",
    "medium-close-up",
    "medium",
    "medium-wide",
    "wide",
    "extreme-wide",
    "over-shoulder",
    "two-shot",
    "establishing",
    "custom",
  ]),

  parameters: z.record(z.unknown()).default({}),
});

/* -------------------------------------------------------------------------- */
/* Camera Contract                                                            */
/* -------------------------------------------------------------------------- */

export const Camera = z.object({
  id: Uuid,

  name: z.string().min(1),

  type: CameraType.default("orthographic"),

  projection:
    CameraProjection.default("2d"),

  /* ----------------------------- Transform ------------------------------ */

  position: Vec3,

  target: Vec3,

  up: Vec3.default({
    x: 0,
    y: 1,
    z: 0,
  }),

  /* ------------------------------ Lens ---------------------------------- */

  zoom: z.number().positive().default(1),

  fov: z.number()
    .positive()
    .max(179)
    .default(45),

  nearClip: z.number()
    .positive()
    .default(0.01),

  farClip: z.number()
    .positive()
    .default(10000),

  orthographicSize: z.number()
    .positive()
    .default(1),

  aspectRatio: z.object({
    numerator: z.number().int().positive(),
    denominator: z.number().int().positive(),
  }).default({
    numerator: 16,
    denominator: 9,
  }),

  /* --------------------------- Composition ------------------------------ */

  composition:
    CameraComposition.default({}),

  /* ------------------------------ Follow -------------------------------- */

  follow:
    CameraFollow.default({}),

  /* ------------------------------- Shake -------------------------------- */

  shake:
    CameraShake.default({}),

  /* ---------------------------- Animation ------------------------------- */

  tracks:
    z.array(CameraTrack).default([]),

  /* ---------------------------- Constraints ------------------------------ */

  constraints:
    z.array(CameraConstraint).default([]),

  /* ------------------------------ Metadata ------------------------------- */

  preset:
    z.string().nullable().default(null),

  metadata:
    z.record(z.unknown()).default({}),
});
export const Shot = z.object({
  id: Uuid,

  sceneId: Uuid,

  cameraId: Uuid,

  startTick:
    z.number().int().nonnegative(),

  endTick:
    z.number().int().positive(),

  cameraTracks:
    z.array(CameraTrack).default([]),

  transitionIn:
    z.enum([
      "cut",
      "dissolve",
      "fade",
      "push",
      "zoom",
      "match",
      "none",
    ]).default("cut"),

  transitionOut:
    z.enum([
      "cut",
      "dissolve",
      "fade",
      "push",
      "zoom",
      "match",
      "none",
    ]).default("cut"),

  transitionDurationTicks:
    z.number().int().nonnegative().default(0),

  composition:
    CameraComposition.default({}),

  metadata:
    z.record(z.unknown()).default({}),
});
export const Sequence = z.object({id:Uuid,name:z.string(),startTick:z.number().int().nonnegative(),endTick:z.number().int().positive(),shots:z.array(Shot),audioTracks:z.array(z.record(z.unknown())).default([]),captionTracks:z.array(z.record(z.unknown())).default([])});
export const Timeline = z.object({tracks:z.array(z.record(z.unknown())).default([]),durationTicks:z.number().int().nonnegative()});
export const AudioTrack = z.object({id:Uuid,name:z.string(),assetId:Uuid.nullable(),startTick:z.number().int().nonnegative(),endTick:z.number().int().nonnegative(),volume:z.number().min(0).max(2).default(1),pan:z.number().min(-1).max(1).default(0),fadeInTicks:z.number().int().nonnegative().default(0),fadeOutTicks:z.number().int().nonnegative().default(0)});
export const RenderRequest = z.object({
  projectId:Uuid,revisionId:Uuid,sequenceId:Uuid.nullable(),width:z.number().int().positive(),height:z.number().int().positive(),
  fps:z.object({numerator:z.number().int().positive(),denominator:z.number().int().positive()}),
  startTick:z.number().int().nonnegative(),endTick:z.number().int().positive(),backend:z.enum(["2d-svg","3d-gltf","blender","auto"]).default("auto"),
  outputFormat:z.enum(["frames","mp4","webm"]).default("mp4"),transparent:z.boolean().default(false)
});
export const RenderManifest = z.object({renderId:Uuid,projectId:Uuid,revisionId:Uuid,backend:z.string(),frameCount:z.number().int().nonnegative(),artifacts:z.array(z.string()),contentHash:z.string()});
export const Job = z.object({jobId:Uuid,type:z.string(),state:z.enum(["queued","preparing","running","finalizing","succeeded","cancelling","cancelled","failed","retrying"]),idempotencyKey:z.string(),progress:z.number().min(0).max(1),attempts:z.number().int().nonnegative(),checkpoint:z.record(z.unknown()).optional(),logs:z.array(z.string()).default([])});
export const CapabilityDescriptor = z.object({adapterId:z.string(),adapterVersion:z.string(),contractVersion:z.string(),capabilities:z.record(z.enum(["supported","unsupported","experimental"]))});

export const PromptIntent = z.object({
  intentId:Uuid,schemaVersion:z.string(),operation:z.string(),targetEntityId:Uuid.optional(),targetEntityType:z.string().optional(),
  parameters:z.record(z.unknown()).default({}),constraints:z.array(z.string()).default([]),references:z.array(z.string()).default([]),
  requestedCapabilities:z.array(z.string()).default([]),confidence:z.number().min(0).max(1),explanation:z.string().default(""),
  defaults:z.array(z.string()).default([]),assumptions:z.array(z.string()).default([]),
  warnings:z.array(z.string()).default([]),clarificationRequests:z.array(z.string()).default([])
});
const CommandTypes = ["CREATE_CHARACTER","MODIFY_CHARACTER","MODIFY_OUTFIT","APPLY_MAKEUP","CREATE_SCENE","ADD_PROP","PLACE_CHARACTER","CREATE_EXPRESSION","CREATE_ANIMATION","CREATE_DIALOGUE","MODIFY_CAMERA","CREATE_CAMERA_SHOT","CREATE_LIPSYNC","CREATE_SEQUENCE","CREATE_RENDER"] as const;
export const CanonicalCommand = z.object({
  commandId:Uuid,schemaVersion:z.string(),commandType:z.enum(CommandTypes),projectId:Uuid,expectedProjectRevisionId:Uuid,
  idempotencyKey:z.string().min(1),targetIds:z.array(Uuid).default([]),payload:z.record(z.unknown()).default({}),
  dependencies:z.array(Uuid).default([]),preconditions:z.record(z.unknown()).default({}),seed:z.number().int().nonnegative().optional(),
  authorization:z.record(z.unknown()).default({}),requiredCapabilities:z.array(z.object({id:z.string(),level:z.enum(["required","preferred"]),fallbacks:z.array(z.string()).optional()})).default([]),
  provenance:z.record(z.unknown()).default({}),expectedEffects:z.array(z.string()).default([]),undoMetadata:z.record(z.unknown()).default({})
});
export const CommandPlan = z.object({
  planId:Uuid,schemaVersion:z.string(),sourceProjectRevisionId:Uuid,planner:z.record(z.unknown()).default({}),
  intents:z.array(PromptIntent),commands:z.array(CanonicalCommand),dependencies:z.record(z.array(Uuid)).default({}),
  affectedEntityIds:z.array(Uuid).default([]),requiredCapabilities:z.array(z.string()).default([]),
  assumptions:z.array(z.string()).default([]),warnings:z.array(z.string()).default([]),clarificationRequests:z.array(z.string()).default([]),
  previewable:z.boolean().default(true),estimates:z.record(z.unknown()).default({}),planHash:z.string()
});
export const PlanPreview = z.object({
  planHash:z.string(),valid:z.boolean(),validation:z.record(z.unknown()),entityDiff:z.array(z.record(z.unknown())).default([]),
  timelineDiff:z.array(z.record(z.unknown())).default([]),missingAssets:z.array(z.string()).default([]),
  assumptions:z.array(z.string()).default([]),warnings:z.array(z.string()).default([]),clarifications:z.array(z.string()).default([]),
  selectedCapabilities:z.array(z.string()).default([]),estimates:z.record(z.unknown()).default({}),artifacts:z.array(z.string()).default([])
});

export type ProjectManifestT = z.infer<typeof ProjectManifest>;
export type ProjectRevisionT = z.infer<typeof ProjectRevision>;
export type CanonicalCommandT = z.infer<typeof CanonicalCommand>;
export type CommandPlanT = z.infer<typeof CommandPlan>;
export type SceneT = z.infer<typeof Scene>;
export type CharacterAssemblyT = z.infer<typeof CharacterAssembly>;
export const schemaCatalog = ["ProjectManifest","ProjectRevision","AssetManifest","CharacterDefinition","CharacterAssembly","CharacterVariant","RigDefinition","MotionClip","MotionLayer","Expression","LipSyncTrack","Scene","Camera","CameraConstraint","CameraComposition","CameraFollow","CameraShake","CameraKeyframe","CameraTrack","CameraPreset","Shot","Sequence","Timeline","AudioTrack","RenderRequest","RenderManifest","Job","CapabilityDescriptor","PromptIntent","CanonicalCommand","CommandPlan","PlanPreview"] as const;
