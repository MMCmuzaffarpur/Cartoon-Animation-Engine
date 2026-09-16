import {
  canonicalHash,
  CaeError,
  uuid,
} from "../../domain/src/index.js";

import {
  AssetCatalog,
  type AssetManifest,
} from "../../asset-engine/src/index.js";

/* -------------------------------------------------------------------------- */
/* Character Assembly Engine                                                  */
/* -------------------------------------------------------------------------- */

export const CHARACTER_ASSEMBLY_ENGINE_VERSION =
  "1.0.0";

export const CHARACTER_ASSEMBLY_SCHEMA_VERSION =
  "1.0.0";

/* -------------------------------------------------------------------------- */
/* Supported Part Types                                                       */
/* -------------------------------------------------------------------------- */

export const CHARACTER_PART_TYPES = [
  "root",
  "body",
  "torso",
  "head",
  "face",
  "eye",
  "eyebrow",
  "nose",
  "mouth",
  "ear",
  "hair",
  "arm",
  "hand",
  "leg",
  "foot",
  "clothing",
  "accessory",
  "makeup",
  "custom",
] as const;

export type CharacterPartType =
  (typeof CHARACTER_PART_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Supported Representations                                                  */
/* -------------------------------------------------------------------------- */

export const CHARACTER_REPRESENTATIONS = [
  "2d",
  "3d",
  "hybrid",
] as const;

export type CharacterRepresentation =
  (typeof CHARACTER_REPRESENTATIONS)[number];

/* -------------------------------------------------------------------------- */
/* Transform                                                                  */
/* -------------------------------------------------------------------------- */

export interface AssemblyTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

/* -------------------------------------------------------------------------- */
/* Anchor                                                                     */
/* -------------------------------------------------------------------------- */

export interface AssemblyAnchor {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

/* -------------------------------------------------------------------------- */
/* Appearance                                                                 */
/* -------------------------------------------------------------------------- */

export interface AssemblyAppearance {
  readonly visible: boolean;
  readonly opacity: number;
  readonly tint?: string;
  readonly blendMode:
    | "normal"
    | "multiply"
    | "screen"
    | "overlay";
}

/* -------------------------------------------------------------------------- */
/* Character Assembly Part                                                    */
/* -------------------------------------------------------------------------- */

export interface CharacterAssemblyPart {
  readonly partId: string;
  readonly name: string;
  readonly type: CharacterPartType;
  readonly assetId: string;

  readonly parentPartId?: string;

  readonly anchor?: AssemblyAnchor;

  readonly transform: AssemblyTransform;

  readonly appearance: AssemblyAppearance;

  readonly zIndex: number;

  readonly visible: boolean;

  readonly metadata: Readonly<
    Record<string, unknown>
  >;
}

/* -------------------------------------------------------------------------- */
/* Character Assembly                                                         */
/* -------------------------------------------------------------------------- */

export interface CharacterAssembly {
  readonly assemblyId: string;

  readonly schemaVersion: string;

  readonly characterId: string;

  readonly definitionId: string;

  readonly representation:
    CharacterRepresentation;

  readonly parts:
    readonly CharacterAssemblyPart[];

  readonly rootPartId: string;

  readonly metadata: Readonly<
    Record<string, unknown>
  >;

  readonly createdBy: string;

  readonly contentHash: string;
}

/* -------------------------------------------------------------------------- */
/* Part Input                                                                 */
/* -------------------------------------------------------------------------- */

export interface CharacterAssemblyPartInput {
  readonly partId?: string;

  readonly name: string;

  readonly type: CharacterPartType;

  readonly assetId: string;

  readonly parentPartId?: string;

  readonly anchor?: Partial<AssemblyAnchor>;

  readonly transform?: Partial<AssemblyTransform>;

  readonly appearance?: Partial<AssemblyAppearance>;

  readonly zIndex?: number;

  readonly visible?: boolean;

  readonly metadata?: Readonly<
    Record<string, unknown>
  >;
}

/* -------------------------------------------------------------------------- */
/* Assembly Input                                                             */
/* -------------------------------------------------------------------------- */

export interface CharacterAssemblyInput {
  readonly assemblyId?: string;

  readonly characterId: string;

  readonly definitionId: string;

  readonly representation:
    CharacterRepresentation;

  readonly parts:
    readonly CharacterAssemblyPartInput[];

  readonly rootPartId?: string;

  readonly metadata?: Readonly<
    Record<string, unknown>
  >;

  readonly createdBy?: string;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_TRANSFORM: AssemblyTransform =
  Object.freeze({
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  });

const DEFAULT_APPEARANCE: AssemblyAppearance =
  Object.freeze({
    visible: true,
    opacity: 1,
    blendMode: "normal",
  });

const DEFAULT_ANCHOR: AssemblyAnchor =
  Object.freeze({
    x: 0,
    y: 0,
    rotation: 0,
  });

/* -------------------------------------------------------------------------- */
/* Generic Helpers                                                            */
/* -------------------------------------------------------------------------- */

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function clone<T>(
  value: T,
): T {
  return structuredClone(value);
}

function requiredString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function finiteNumber(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be a finite number.`,
    );
  }

  return value;
}

function integer(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must be an integer.`,
    );
  }

  return value;
}

function nonNegativeInteger(
  value: unknown,
  field: string,
): number {
  const result =
    integer(
      value,
      field,
    );

  if (result < 0) {
    throw new CaeError(
      "INVALID_REQUEST",
      `${field} must not be negative.`,
    );
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Enum Validation                                                            */
/* -------------------------------------------------------------------------- */

function assertPartType(
  value: unknown,
): CharacterPartType {
  if (
    typeof value !== "string" ||
    !(
      CHARACTER_PART_TYPES as readonly string[]
    ).includes(value)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported character part type: ${String(
        value,
      )}.`,
      [
        ...CHARACTER_PART_TYPES,
      ],
    );
  }

  return value as CharacterPartType;
}

function assertRepresentation(
  value: unknown,
): CharacterRepresentation {
  if (
    typeof value !== "string" ||
    !(
      CHARACTER_REPRESENTATIONS as readonly string[]
    ).includes(value)
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported character representation: ${String(
        value,
      )}.`,
      [
        ...CHARACTER_REPRESENTATIONS,
      ],
    );
  }

  return value as CharacterRepresentation;
}

/* -------------------------------------------------------------------------- */
/* Transform                                                                  */
/* -------------------------------------------------------------------------- */

function createTransform(
  input?: Partial<AssemblyTransform>,
): AssemblyTransform {
  const result: AssemblyTransform = {
    x:
      input?.x ??
      DEFAULT_TRANSFORM.x,

    y:
      input?.y ??
      DEFAULT_TRANSFORM.y,

    rotation:
      input?.rotation ??
      DEFAULT_TRANSFORM.rotation,

    scaleX:
      input?.scaleX ??
      DEFAULT_TRANSFORM.scaleX,

    scaleY:
      input?.scaleY ??
      DEFAULT_TRANSFORM.scaleY,
  };

  finiteNumber(
    result.x,
    "transform.x",
  );

  finiteNumber(
    result.y,
    "transform.y",
  );

  finiteNumber(
    result.rotation,
    "transform.rotation",
  );

  finiteNumber(
    result.scaleX,
    "transform.scaleX",
  );

  finiteNumber(
    result.scaleY,
    "transform.scaleY",
  );

  return result;
}

/* -------------------------------------------------------------------------- */
/* Appearance                                                                 */
/* -------------------------------------------------------------------------- */

function createAppearance(
  input?: Partial<AssemblyAppearance>,
): AssemblyAppearance {
  const opacity =
    input?.opacity ??
    DEFAULT_APPEARANCE.opacity;

  finiteNumber(
    opacity,
    "appearance.opacity",
  );

  if (
    opacity < 0 ||
    opacity > 1
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "appearance.opacity must be between 0 and 1.",
    );
  }

  const blendMode =
    input?.blendMode ??
    DEFAULT_APPEARANCE.blendMode;

  const validBlendModes = [
    "normal",
    "multiply",
    "screen",
    "overlay",
  ] as const;

  if (
    !validBlendModes.includes(
      blendMode,
    )
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      `Unsupported blend mode: ${String(
        blendMode,
      )}.`,
    );
  }

  return {
    visible:
      input?.visible ??
      DEFAULT_APPEARANCE.visible,

    opacity,

    ...(input?.tint !== undefined
      ? {
          tint: input.tint,
        }
      : {}),

    blendMode,
  };
}

/* -------------------------------------------------------------------------- */
/* Anchor                                                                     */
/* -------------------------------------------------------------------------- */

function createAnchor(
  input?: Partial<AssemblyAnchor>,
): AssemblyAnchor {
  const result: AssemblyAnchor = {
    x:
      input?.x ??
      DEFAULT_ANCHOR.x,

    y:
      input?.y ??
      DEFAULT_ANCHOR.y,

    rotation:
      input?.rotation ??
      DEFAULT_ANCHOR.rotation,
  };

  finiteNumber(
    result.x,
    "anchor.x",
  );

  finiteNumber(
    result.y,
    "anchor.y",
  );

  finiteNumber(
    result.rotation,
    "anchor.rotation",
  );

  return result;
}

/* -------------------------------------------------------------------------- */
/* Deterministic Part Ordering                                                */
/* -------------------------------------------------------------------------- */

function sortParts(
  parts: readonly CharacterAssemblyPart[],
): CharacterAssemblyPart[] {
  return [
    ...parts,
  ].sort(
    (a, b) => {
      if (
        a.zIndex !==
        b.zIndex
      ) {
        return (
          a.zIndex -
          b.zIndex
        );
      }

      return a.partId.localeCompare(
        b.partId,
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Part Creation                                                              */
/* -------------------------------------------------------------------------- */

export function createAssemblyPart(
  input: CharacterAssemblyPartInput,
): CharacterAssemblyPart {
  if (!isObject(input)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Assembly part must be an object.",
    );
  }

  const partId =
    input.partId ??
    uuid();

  const name =
    requiredString(
      input.name,
      "part.name",
    );

  const type =
    assertPartType(
      input.type,
    );

  const assetId =
    requiredString(
      input.assetId,
      "part.assetId",
    );

  const zIndex =
    input.zIndex ??
    0;

  nonNegativeInteger(
    zIndex,
    "part.zIndex",
  );

  const parentPartId =
    input.parentPartId !== undefined
      ? requiredString(
          input.parentPartId,
          "part.parentPartId",
        )
      : undefined;

  return {
    partId,

    name,

    type,

    assetId,

    ...(parentPartId
      ? {
          parentPartId,
        }
      : {}),

    ...(input.anchor
      ? {
          anchor:
            createAnchor(
              input.anchor,
            ),
        }
      : {}),

    transform:
      createTransform(
        input.transform,
      ),

    appearance:
      createAppearance(
        input.appearance,
      ),

    zIndex,

    visible:
      input.visible ??
      true,

    metadata:
      clone(
        input.metadata ??
          {},
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Hierarchy Validation                                                       */
/* -------------------------------------------------------------------------- */

function validatePartHierarchy(
  parts: readonly CharacterAssemblyPart[],
): void {
  const byId =
    new Map(
      parts.map(
        (part) => [
          part.partId,
          part,
        ],
      ),
    );

  for (
    const part of parts
  ) {
    const visited =
      new Set<string>();

    let current:
      CharacterAssemblyPart |
      undefined =
      part;

    while (
      current?.parentPartId
    ) {
      if (
        current.parentPartId ===
        current.partId
      ) {
        throw new CaeError(
          "COMMAND_INVALID",
          `Part "${current.partId}" cannot parent itself.`,
          [current.partId],
        );
      }

      if (
        visited.has(
          current.partId,
        )
      ) {
        throw new CaeError(
          "COMMAND_INVALID",
          "Character assembly contains a cyclic part hierarchy.",
          [current.partId],
        );
      }

      visited.add(
        current.partId,
      );

      current =
        byId.get(
          current.parentPartId,
        );

      if (!current) {
        break;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Assembly Fingerprint                                                       */
/* -------------------------------------------------------------------------- */

export function fingerprintAssembly(
  assembly: Omit<
    CharacterAssembly,
    "contentHash"
  >,
): string {
  return canonicalHash({
    assemblyId:
      assembly.assemblyId,

    schemaVersion:
      assembly.schemaVersion,

    characterId:
      assembly.characterId,

    definitionId:
      assembly.definitionId,

    representation:
      assembly.representation,

    rootPartId:
      assembly.rootPartId,

    parts:
      assembly.parts,

    metadata:
      assembly.metadata,

    createdBy:
      assembly.createdBy,
  }) as string;
}

/* -------------------------------------------------------------------------- */
/* Character Assembly Creation                                                */
/* -------------------------------------------------------------------------- */

export function createCharacterAssembly(
  input: CharacterAssemblyInput,
): CharacterAssembly {
  if (!isObject(input)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Character assembly input must be an object.",
    );
  }

  const characterId =
    requiredString(
      input.characterId,
      "characterId",
    );

  const definitionId =
    requiredString(
      input.definitionId,
      "definitionId",
    );

  const representation =
    assertRepresentation(
      input.representation,
    );

  if (
    !Array.isArray(
      input.parts,
    ) ||
    input.parts.length === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Character assembly must contain at least one part.",
    );
  }

  const parts =
    input.parts.map(
      createAssemblyPart,
    );

  /* ------------------------------------------------------------------------ */
  /* 1. Duplicate Part IDs                                                   */
  /* ------------------------------------------------------------------------ */

  const partIds =
    parts.map(
      (part) =>
        part.partId,
    );

  const duplicateIds =
    partIds.filter(
      (
        id,
        index,
      ) =>
        partIds.indexOf(id) !==
        index,
    );

  if (
    duplicateIds.length > 0
  ) {
    throw new CaeError(
      "ENTITY_DUPLICATE",
      "Character assembly contains duplicate part IDs.",
      [
        ...new Set(
          duplicateIds,
        ),
      ],
    );
  }

  /* ------------------------------------------------------------------------ */
  /* 2. Self Parent Check — MUST happen before root detection                */
  /* ------------------------------------------------------------------------ */

  for (
    const part of parts
  ) {
    if (
      part.parentPartId ===
      part.partId
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        `Part "${part.partId}" cannot parent itself.`,
        [part.partId],
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 3. Parent Existence                                                      */
  /* ------------------------------------------------------------------------ */

  const partMap =
    new Map(
      parts.map(
        (part) => [
          part.partId,
          part,
        ],
      ),
    );

  for (
    const part of parts
  ) {
    if (
      part.parentPartId &&
      !partMap.has(
        part.parentPartId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Parent part "${part.parentPartId}" was not found.`,
        [
          part.parentPartId,
        ],
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 4. Root Detection                                                        */
  /* ------------------------------------------------------------------------ */

  const rootCandidates =
    parts.filter(
      (part) =>
        !part.parentPartId,
    );

  if (
    rootCandidates.length ===
    0
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      "Character assembly must contain a root part.",
    );
  }

  if (
    rootCandidates.length > 1 &&
    !input.rootPartId
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      "Multiple root parts exist; rootPartId must be specified.",
    );
  }

  const rootPartId =
    input.rootPartId ??
    rootCandidates[0].partId;

  if (
    !partMap.has(
      rootPartId,
    )
  ) {
    throw new CaeError(
      "ENTITY_NOT_FOUND",
      `Root part "${rootPartId}" was not found.`,
      [rootPartId],
    );
  }

  /* ------------------------------------------------------------------------ */
  /* 5. Root Must Actually Be Root                                            */
  /* ------------------------------------------------------------------------ */

  const selectedRoot =
    partMap.get(
      rootPartId,
    );

  if (
    selectedRoot?.parentPartId
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      `Root part "${rootPartId}" cannot have a parent.`,
      [rootPartId],
    );
  }

  /* ------------------------------------------------------------------------ */
  /* 6. Hierarchy Cycle Check                                                 */
  /* ------------------------------------------------------------------------ */

  validatePartHierarchy(
    parts,
  );

  /* ------------------------------------------------------------------------ */
  /* 7. Assembly Identity                                                     */
  /* ------------------------------------------------------------------------ */

  const assemblyId =
    input.assemblyId ??
    uuid();

  const createdBy =
    input.createdBy ??
    "local";

  const metadata =
    clone(
      input.metadata ??
        {},
    );

  /* ------------------------------------------------------------------------ */
  /* 8. Canonical Assembly                                                    */
  /* ------------------------------------------------------------------------ */

  const withoutHash: Omit<
    CharacterAssembly,
    "contentHash"
  > = {
    assemblyId,

    schemaVersion:
      CHARACTER_ASSEMBLY_SCHEMA_VERSION,

    characterId,

    definitionId,

    representation,

    parts:
      sortParts(
        parts,
      ),

    rootPartId,

    metadata,

    createdBy,
  };

  const contentHash =
    fingerprintAssembly(
      withoutHash,
    );

  return {
    ...withoutHash,

    contentHash,
  };
}

/* -------------------------------------------------------------------------- */
/* Assembly Validation                                                        */
/* -------------------------------------------------------------------------- */

export function validateCharacterAssembly(
  input: unknown,
): CharacterAssembly {
  if (!isObject(input)) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Character assembly must be an object.",
    );
  }

  const assemblyId =
    requiredString(
      input.assemblyId,
      "assemblyId",
    );

  const schemaVersion =
    requiredString(
      input.schemaVersion,
      "schemaVersion",
    );

  const characterId =
    requiredString(
      input.characterId,
      "characterId",
    );

  const definitionId =
    requiredString(
      input.definitionId,
      "definitionId",
    );

  const representation =
    assertRepresentation(
      input.representation,
    );

  const rootPartId =
    requiredString(
      input.rootPartId,
      "rootPartId",
    );

  const createdBy =
    requiredString(
      input.createdBy,
      "createdBy",
    );

  if (
    !Array.isArray(
      input.parts,
    ) ||
    input.parts.length ===
      0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Character assembly must contain parts.",
    );
  }

  const parts =
    input.parts.map(
      (part) => {
        if (!isObject(part)) {
          throw new CaeError(
            "INVALID_REQUEST",
            "Assembly part must be an object.",
          );
        }

        return createAssemblyPart(
          part as unknown as CharacterAssemblyPartInput,
        );
      },
    );

  const partIds =
    parts.map(
      (part) =>
        part.partId,
    );

  const duplicateIds =
    partIds.filter(
      (
        id,
        index,
      ) =>
        partIds.indexOf(id) !==
        index,
    );

  if (
    duplicateIds.length > 0
  ) {
    throw new CaeError(
      "ENTITY_DUPLICATE",
      "Character assembly contains duplicate part IDs.",
      [
        ...new Set(
          duplicateIds,
        ),
      ],
    );
  }

  /* Self-parent validation before root validation. */

  for (
    const part of parts
  ) {
    if (
      part.parentPartId ===
      part.partId
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        `Part "${part.partId}" cannot parent itself.`,
        [part.partId],
      );
    }
  }

  const partMap =
    new Map(
      parts.map(
        (part) => [
          part.partId,
          part,
        ],
      ),
    );

  for (
    const part of parts
  ) {
    if (
      part.parentPartId &&
      !partMap.has(
        part.parentPartId,
      )
    ) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Parent part "${part.parentPartId}" was not found.`,
        [
          part.parentPartId,
        ],
      );
    }
  }

  const root =
    partMap.get(
      rootPartId,
    );

  if (!root) {
    throw new CaeError(
      "ENTITY_NOT_FOUND",
      `Root part "${rootPartId}" was not found.`,
      [rootPartId],
    );
  }

  if (
    root.parentPartId
  ) {
    throw new CaeError(
      "COMMAND_INVALID",
      `Root part "${rootPartId}" cannot have a parent.`,
      [rootPartId],
    );
  }

  validatePartHierarchy(
    parts,
  );

  const normalized: Omit<
    CharacterAssembly,
    "contentHash"
  > = {
    assemblyId,

    schemaVersion,

    characterId,

    definitionId,

    representation,

    parts:
      sortParts(parts),

    rootPartId,

    metadata:
      isObject(
        input.metadata,
      )
        ? clone(
            input.metadata,
          )
        : {},

    createdBy,
  };

  const expectedHash =
    fingerprintAssembly(
      normalized,
    );

  const contentHash =
    requiredString(
      input.contentHash,
      "contentHash",
    );

  if (
    contentHash !==
    expectedHash
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Character assembly contentHash does not match its canonical fingerprint.",
      [
        {
          expected:
            expectedHash,

          received:
            contentHash,
        },
      ],
    );
  }

  return clone({
    ...normalized,

    contentHash,
  });
}

/* -------------------------------------------------------------------------- */
/* Character Assembly Catalog                                                 */
/* -------------------------------------------------------------------------- */

export class CharacterAssemblyCatalog {
  private readonly assemblies =
    new Map<
      string,
      CharacterAssembly
    >();

  /* ------------------------------------------------------------------------ */
  /* Register                                                                 */
  /* ------------------------------------------------------------------------ */

  register(
    assembly: CharacterAssembly,
  ): CharacterAssembly {
    const validated =
      validateCharacterAssembly(
        assembly,
      );

    const existing =
      this.assemblies.get(
        validated.assemblyId,
      );

    if (existing) {
      if (
        existing.contentHash ===
        validated.contentHash
      ) {
        return clone(
          existing,
        );
      }

      throw new CaeError(
        "ENTITY_DUPLICATE",
        `Assembly "${validated.assemblyId}" already exists with different content.`,
        [
          validated.assemblyId,
        ],
      );
    }

    this.assemblies.set(
      validated.assemblyId,
      clone(validated),
    );

    return clone(
      validated,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Get                                                                      */
  /* ------------------------------------------------------------------------ */

  get(
    assemblyId: string,
  ):
    | CharacterAssembly
    | undefined {
    const id =
      requiredString(
        assemblyId,
        "assemblyId",
      );

    const assembly =
      this.assemblies.get(
        id,
      );

    return assembly
      ? clone(assembly)
      : undefined;
  }

  /* ------------------------------------------------------------------------ */
  /* Require                                                                  */
  /* ------------------------------------------------------------------------ */

  require(
    assemblyId: string,
  ): CharacterAssembly {
    const assembly =
      this.get(
        assemblyId,
      );

    if (!assembly) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Character assembly "${assemblyId}" was not found.`,
        [assemblyId],
      );
    }

    return assembly;
  }

  /* ------------------------------------------------------------------------ */
  /* List                                                                     */
  /* ------------------------------------------------------------------------ */

  list(
    characterId?: string,
  ): CharacterAssembly[] {
    const result =
      [
        ...this.assemblies.values(),
      ]
        .filter(
          (assembly) =>
            !characterId ||
            assembly.characterId ===
              characterId,
        )
        .sort(
          (a, b) =>
            a.assemblyId.localeCompare(
              b.assemblyId,
            ),
        );

    return clone(
      result,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Remove                                                                   */
  /* ------------------------------------------------------------------------ */

  remove(
    assemblyId: string,
  ): boolean {
    return this.assemblies.delete(
      requiredString(
        assemblyId,
        "assemblyId",
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Get Part                                                                 */
  /* ------------------------------------------------------------------------ */

  getPart(
    assemblyId: string,
    partId: string,
  ):
    | CharacterAssemblyPart
    | undefined {
    const assembly =
      this.get(
        assemblyId,
      );

    if (!assembly) {
      return undefined;
    }

    const id =
      requiredString(
        partId,
        "partId",
      );

    const part =
      assembly.parts.find(
        (item) =>
          item.partId ===
          id,
      );

    return part
      ? clone(part)
      : undefined;
  }

  /* ------------------------------------------------------------------------ */
  /* Require Part                                                             */
  /* ------------------------------------------------------------------------ */

  requirePart(
    assemblyId: string,
    partId: string,
  ): CharacterAssemblyPart {
    const part =
      this.getPart(
        assemblyId,
        partId,
      );

    if (!part) {
      throw new CaeError(
        "ENTITY_NOT_FOUND",
        `Assembly part "${partId}" was not found.`,
        [partId],
      );
    }

    return part;
  }

  /* ------------------------------------------------------------------------ */
  /* Children                                                                 */
  /* ------------------------------------------------------------------------ */

  children(
    assemblyId: string,
    parentPartId: string,
  ): CharacterAssemblyPart[] {
    const assembly =
      this.require(
        assemblyId,
      );

    const parentId =
      requiredString(
        parentPartId,
        "parentPartId",
      );

    return clone(
      sortParts(
        assembly.parts.filter(
          (part) =>
            part.parentPartId ===
            parentId,
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Parts By Type                                                            */
  /* ------------------------------------------------------------------------ */

  partsByType(
    assemblyId: string,
    type: CharacterPartType,
  ): CharacterAssemblyPart[] {
    const assembly =
      this.require(
        assemblyId,
      );

    assertPartType(
      type,
    );

    return clone(
      sortParts(
        assembly.parts.filter(
          (part) =>
            part.type ===
            type,
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Asset IDs                                                                */
  /* ------------------------------------------------------------------------ */

  assetIds(
    assemblyId: string,
  ): string[] {
    const assembly =
      this.require(
        assemblyId,
      );

    return [
      ...new Set(
        assembly.parts.map(
          (part) =>
            part.assetId,
        ),
      ),
    ].sort();
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    assemblyId: string,
  ): string {
    return this.require(
      assemblyId,
    ).contentHash;
  }

  /* ------------------------------------------------------------------------ */
  /* Stats                                                                    */
  /* ------------------------------------------------------------------------ */

  stats() {
    const assemblies =
      [
        ...this.assemblies.values(),
      ];

    return {
      assemblyCount:
        assemblies.length,

      partCount:
        assemblies.reduce(
          (
            total,
            assembly,
          ) =>
            total +
            assembly.parts.length,
          0,
        ),

      characterCount:
        new Set(
          assemblies.map(
            (assembly) =>
              assembly.characterId,
          ),
        ).size,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Clear                                                                    */
  /* ------------------------------------------------------------------------ */

  clear(): void {
    this.assemblies.clear();
  }
}

/* -------------------------------------------------------------------------- */
/* Asset Compatibility                                                        */
/* -------------------------------------------------------------------------- */

export function validateAssemblyAssets(
  assembly: CharacterAssembly,
  assets: AssetCatalog,
): {
  valid: boolean;
  missingAssetIds: string[];
  incompatibleAssetIds: string[];
} {
  const missingAssetIds: string[] =
    [];

  const incompatibleAssetIds: string[] =
    [];

  const uniqueAssetIds =
    [
      ...new Set(
        assembly.parts.map(
          (part) =>
            part.assetId,
        ),
      ),
    ];

  for (
    const assetId of uniqueAssetIds
  ) {
    const asset =
      assets.get(
        assetId,
      );

    if (!asset) {
      missingAssetIds.push(
        assetId,
      );

      continue;
    }

    if (
      !asset.compatibility.representations.includes(
        assembly.representation,
      )
    ) {
      incompatibleAssetIds.push(
        assetId,
      );
    }
  }

  return {
    valid:
      missingAssetIds.length ===
        0 &&
      incompatibleAssetIds.length ===
        0,

    missingAssetIds: [
      ...new Set(
        missingAssetIds,
      ),
    ].sort(),

    incompatibleAssetIds: [
      ...new Set(
        incompatibleAssetIds,
      ),
    ].sort(),
  };
}

/* -------------------------------------------------------------------------- */
/* Resolve Assembly Assets                                                   */
/* -------------------------------------------------------------------------- */

export function resolveAssemblyAssets(
  assembly: CharacterAssembly,
  assets: AssetCatalog,
): AssetManifest[] {
  const uniqueAssetIds =
    [
      ...new Set(
        assembly.parts.map(
          (part) =>
            part.assetId,
        ),
      ),
    ].sort();

  return uniqueAssetIds.map(
    (assetId) =>
      assets.require(
        assetId,
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Rebuild Assembly                                                           */
/* -------------------------------------------------------------------------- */

function rebuildAssembly(
  assembly: CharacterAssembly,
  parts: readonly CharacterAssemblyPart[],
): CharacterAssembly {
  const withoutHash: Omit<
    CharacterAssembly,
    "contentHash"
  > = {
    assemblyId:
      assembly.assemblyId,

    schemaVersion:
      assembly.schemaVersion,

    characterId:
      assembly.characterId,

    definitionId:
      assembly.definitionId,

    representation:
      assembly.representation,

    parts:
      sortParts(parts),

    rootPartId:
      assembly.rootPartId,

    metadata:
      clone(
        assembly.metadata,
      ),

    createdBy:
      assembly.createdBy,
  };

  return {
    ...withoutHash,

    contentHash:
      fingerprintAssembly(
        withoutHash,
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Replace Part Asset                                                         */
/* -------------------------------------------------------------------------- */

export function replacePartAsset(
  assembly: CharacterAssembly,
  partId: string,
  assetId: string,
): CharacterAssembly {
  const id =
    requiredString(
      partId,
      "partId",
    );

  const nextAssetId =
    requiredString(
      assetId,
      "assetId",
    );

  const found =
    assembly.parts.some(
      (part) =>
        part.partId ===
        id,
    );

  if (!found) {
    throw new CaeError(
      "ENTITY_NOT_FOUND",
      `Assembly part "${id}" was not found.`,
      [id],
    );
  }

  const parts =
    assembly.parts.map(
      (part) =>
        part.partId ===
        id
          ? {
              ...part,
              assetId:
                nextAssetId,
            }
          : part,
    );

  return rebuildAssembly(
    assembly,
    parts,
  );
}

/* -------------------------------------------------------------------------- */
/* Transform Part                                                             */
/* -------------------------------------------------------------------------- */

export function transformPart(
  assembly: CharacterAssembly,
  partId: string,
  transform: Partial<AssemblyTransform>,
): CharacterAssembly {
  const id =
    requiredString(
      partId,
      "partId",
    );

  const found =
    assembly.parts.some(
      (part) =>
        part.partId ===
        id,
    );

  if (!found) {
    throw new CaeError(
      "ENTITY_NOT_FOUND",
      `Assembly part "${id}" was not found.`,
      [id],
    );
  }

  const parts =
    assembly.parts.map(
      (part) => {
        if (
          part.partId !==
          id
        ) {
          return part;
        }

        return {
          ...part,

          transform:
            createTransform({
              ...part.transform,
              ...transform,
            }),
        };
      },
    );

  return rebuildAssembly(
    assembly,
    parts,
  );
}

/* -------------------------------------------------------------------------- */
/* Set Part Visibility                                                        */
/* -------------------------------------------------------------------------- */

export function setPartVisibility(
  assembly: CharacterAssembly,
  partId: string,
  visible: boolean,
): CharacterAssembly {
  const id =
    requiredString(
      partId,
      "partId",
    );

  const found =
    assembly.parts.some(
      (part) =>
        part.partId ===
        id,
    );

  if (!found) {
    throw new CaeError(
      "ENTITY_NOT_FOUND",
      `Assembly part "${id}" was not found.`,
      [id],
    );
  }

  const parts =
    assembly.parts.map(
      (part) =>
        part.partId ===
        id
          ? {
              ...part,

              visible,

              appearance: {
                ...part.appearance,

                visible,
              },
            }
          : part,
    );

  return rebuildAssembly(
    assembly,
    parts,
  );
}

/* -------------------------------------------------------------------------- */
/* Default Export                                                             */
/* -------------------------------------------------------------------------- */

export default CharacterAssemblyCatalog;