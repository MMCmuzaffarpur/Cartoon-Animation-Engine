import {
  canonicalHash,
  CaeError,
} from "../../domain/src/index.js";

import type { CommandPlanT } from "../../contracts/src/index.js";

/* -------------------------------------------------------------------------- */
/*                                  Contract                                  */
/* -------------------------------------------------------------------------- */

export interface Planner {
  plan(
    prompt: string,
    project: any,
    revisionId: string,
  ): CommandPlanT;
}

/* -------------------------------------------------------------------------- */
/*                              Planner Constants                             */
/* -------------------------------------------------------------------------- */

export const PROMPT_PLANNER_VERSION = "1.0.0";
export const PROMPT_PLANNER_ID = "rule-based";

const UUID_NAMESPACE = "00000000-0000-4000-8000-000000000000";

/* -------------------------------------------------------------------------- */
/*                           Deterministic Utilities                          */
/* -------------------------------------------------------------------------- */

/**
 * Stable canonical serializer for planner-local deterministic IDs.
 *
 * We intentionally use the engine's canonicalHash instead of random UUIDs.
 * The generated identifier is UUID-shaped and deterministic for the same
 * namespace + input.
 */
function deterministicId(
  namespace: string,
  value: unknown,
): string {
  const digest = String(
    canonicalHash({
      namespace,
      value,
    }),
  );

  /*
   * UUID v5-like formatting.
   *
   * The identifier is not claimed to be an RFC 4122 registered namespace
   * UUID. It is simply a stable UUID-shaped engine identifier.
   */
  const variantByte =
    (
      (Number.parseInt(
        digest.slice(16, 18),
        16,
      ) &
        0x3f) |
      0x80
    )
      .toString(16)
      .padStart(2, "0");

  return (
    `${digest.slice(0, 8)}-` +
    `${digest.slice(8, 12)}-` +
    `4${digest.slice(13, 16)}-` +
    `${variantByte}` +
    `${digest.slice(18, 20)}-` +
    `${digest.slice(20, 32)}`
  );
}

/**
 * Deterministic planner identifier.
 */
function planIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
): string {
  return deterministicId(
    `${UUID_NAMESPACE}:plan`,
    {
      projectId,
      revisionId,
      prompt,
    },
  );
}

/**
 * Deterministic command identifier.
 *
 * The command index is included so two commands generated from one prompt
 * never collide while preserving deterministic output.
 */
function commandIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
  commandIndex: number,
  commandType: string,
  payload: unknown,
  targetIds: string[],
  dependencies: string[],
): string {
  return deterministicId(
    `${UUID_NAMESPACE}:command`,
    {
      projectId,
      revisionId,
      prompt,
      commandIndex,
      commandType,
      payload,
      targetIds,
      dependencies,
    },
  );
}

/**
 * Deterministic intent identifier.
 */
function intentIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
  intentIndex: number,
  operation: string,
  targetIds: string[],
  parameters: unknown,
): string {
  return deterministicId(
    `${UUID_NAMESPACE}:intent`,
    {
      projectId,
      revisionId,
      prompt,
      intentIndex,
      operation,
      targetIds,
      parameters,
    },
  );
}

/**
 * Deterministic idempotency key.
 *
 * This is intentionally derived from the command identity rather than a
 * random UUID. It therefore remains stable when the same plan is recreated.
 */
function idempotencyKeyFor(
  projectId: string,
  revisionId: string,
  commandId: string,
): string {
  return `plan-${String(
    canonicalHash({
      projectId,
      revisionId,
      commandId,
    }),
  )}`;
}

/**
 * Deterministic scene identifier used by prompt-created scenes.
 */
function sceneIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
  sceneName: string,
): string {
  return deterministicId(
    `${UUID_NAMESPACE}:scene`,
    {
      projectId,
      revisionId,
      prompt,
      sceneName,
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                              Entity Resolution                             */
/* -------------------------------------------------------------------------- */

export const resolveEntity = (
  entities: any[],
  reference: string,
) => {
  const q = reference.trim().toLowerCase();

  const exact = entities.filter(
    (entity) =>
      typeof entity?.name === "string" &&
      entity.name.toLowerCase() === q,
  );

  const alias = entities.filter(
    (entity) =>
      Array.isArray(entity?.aliases) &&
      entity.aliases.some(
        (aliasValue: unknown) =>
          typeof aliasValue === "string" &&
          aliasValue.toLowerCase() === q,
      ),
  );

  const matches =
    exact.length > 0
      ? exact
      : alias;

  if (matches.length === 1) {
    return {
      status: "resolved" as const,
      entityId: matches[0].id,
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous" as const,
      candidates: matches.map(
        (entity) => entity.id,
      ),
    };
  }

  return {
    status: "missing" as const,
  };
};

/* -------------------------------------------------------------------------- */
/*                            Deterministic Command                           */
/* -------------------------------------------------------------------------- */

function createCommand(
  projectId: string,
  revisionId: string,
  prompt: string,
  commandIndex: number,
  type: string,
  payload: Record<string, unknown>,
  targetIds: string[] = [],
  dependencies: string[] = [],
) {
  const commandId = commandIdFor(
    projectId,
    revisionId,
    prompt,
    commandIndex,
    type,
    payload,
    targetIds,
    dependencies,
  );

  return {
    commandId,

    schemaVersion:
      "1.0.0",

    commandType:
      type,

    projectId,

    expectedProjectRevisionId:
      revisionId,

    idempotencyKey:
      idempotencyKeyFor(
        projectId,
        revisionId,
        commandId,
      ),

    targetIds,

    payload,

    dependencies,

    preconditions: {},

    authorization: {
      scope:
        `project:${projectId}`,
    },

    requiredCapabilities: [],

    provenance: {
      planner:
        PROMPT_PLANNER_ID,

      version:
        PROMPT_PLANNER_VERSION,
    },

    expectedEffects: [],

    undoMetadata: {},
  };
}

/* -------------------------------------------------------------------------- */
/*                              Planner Helpers                               */
/* -------------------------------------------------------------------------- */

function normalizedPrompt(
  prompt: string,
): string {
  return prompt.trim();
}

function projectIdentifier(
  project: any,
): string {
  const value =
    project?.projectId ??
    project?.id;

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Project must contain a valid projectId.",
    );
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/*                         Rule-Based Prompt Planner                          */
/* -------------------------------------------------------------------------- */

export class RuleBasedPromptPlanner
  implements Planner
{
  plan(
    prompt: string,
    project: any,
    revisionId: string,
  ): CommandPlanT {
    const text =
      normalizedPrompt(prompt);

    if (!text) {
      throw new CaeError(
        "PROMPT_UNCLEAR",
        "Prompt is empty",
      );
    }

    if (
      typeof revisionId !== "string" ||
      revisionId.trim().length === 0
    ) {
      throw new CaeError(
        "INVALID_REQUEST",
        "revisionId must be a non-empty string.",
      );
    }

    const projectId =
      projectIdentifier(project);

    const low =
      text.toLowerCase();

    const intents: any[] = [];
    const commands: any[] = [];

    const assumptions: string[] = [];
    const warnings: string[] = [];
    const clarifications: string[] = [];

    /* ---------------------------------------------------------------------- */
    /*                           Deterministic add                            */
    /* ---------------------------------------------------------------------- */

    const add = (
      type: string,
      payload: Record<string, unknown> = {},
      targets: string[] = [],
      dependencies: string[] = [],
    ) => {
      const commandIndex =
        commands.length;

      const command =
        createCommand(
          projectId,
          revisionId,
          text,
          commandIndex,
          type,
          payload,
          targets,
          dependencies,
        );

      commands.push(command);

      const intentIndex =
        intents.length;

      intents.push({
        intentId:
          intentIdFor(
            projectId,
            revisionId,
            text,
            intentIndex,
            type,
            targets,
            payload,
          ),

        schemaVersion:
          "1.0.0",

        operation:
          type,

        ...(targets[0]
          ? {
              targetEntityId:
                targets[0],
            }
          : {}),

        parameters:
          payload,

        constraints: [],

        references: [],

        requestedCapabilities: [],

        confidence:
          0.98,

        explanation:
          `Mapped from: ${text}`,

        defaults: [],

        assumptions: [],

        warnings: [],

        clarificationRequests: [],
      });

      return command.commandId;
    };

    /* ---------------------------------------------------------------------- */
    /*                           CREATE CHARACTER                             */
    /* ---------------------------------------------------------------------- */

    let match =
      /create\s+(?:a\s+)?(?:(\d+)[-\s]?year[-\s]?old\s+)?(boy|girl|man|woman|character)?\s*(?:named|name[d]?)?\s*([A-Za-z][\w -]*)/i.exec(
        text,
      );

    if (
      match &&
      /character|boy|girl|man|woman|named/i.test(
        text,
      )
    ) {
      const age =
        match[1]
          ? Number(match[1])
          : undefined;

      const name =
        (
          match[3] ??
          match[2] ??
          "Character"
        ).trim();

      const resolved =
        resolveEntity(
          Array.isArray(project?.entities)
            ? project.entities
            : [],
          name,
        );

      if (
        resolved.status ===
        "resolved"
      ) {
        throw new CaeError(
          "ENTITY_DUPLICATE",
          "Character already exists",
          [name],
        );
      }

      if (
        resolved.status ===
        "ambiguous"
      ) {
        throw new CaeError(
          "ENTITY_AMBIGUOUS",
          `Multiple entities match "${name}".`,
          resolved.candidates,
        );
      }

      const representation =
        /3d|three dimensional/i.test(
          low,
        )
          ? "3d"
          : "2d";

      add(
        "CREATE_CHARACTER",
        {
          name,

          ...(age !== undefined
            ? { age }
            : {}),

          ...(match[2]
            ? {
                gender:
                  match[2].toLowerCase(),
              }
            : {}),

          representation,
        },
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                             CREATE SCENE                               */
    /* ---------------------------------------------------------------------- */

    if (
      /classroom|school\s*room/i.test(
        low,
      ) &&
      /create|make|build/i.test(
        low,
      )
    ) {
      const sceneId =
        sceneIdFor(
          projectId,
          revisionId,
          text,
          "Classroom",
        );

      add(
        "CREATE_SCENE",
        {
          sceneId,

          name:
            "Classroom",

          template:
            "classroom",

          type:
            /3d/i.test(low)
              ? "3d"
              : "2d",

          width:
            1280,

          height:
            720,
        },
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                           CREATE EXPRESSION                             */
    /* ---------------------------------------------------------------------- */

    match =
      /make\s+([A-Za-z][\w-]*)\s+(angry|happy|sad|surprised|fearful|neutral)/i.exec(
        text,
      );

    if (match) {
      const reference =
        match[1];

      const result =
        resolveEntity(
          Array.isArray(project?.entities)
            ? project.entities
            : [],
          reference,
        );

      if (
        result.status ===
        "resolved"
      ) {
        add(
          "CREATE_EXPRESSION",
          {
            expression:
              match[2],
          },
          [
            result.entityId!,
          ],
        );
      } else if (
        result.status ===
        "ambiguous"
      ) {
        clarifications.push(
          `Which character is "${reference}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(
          `Which character is "${reference}"?`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                           CREATE ANIMATION                              */
    /* ---------------------------------------------------------------------- */

    match =
      /(?:make|let)\s+([A-Za-z][\w-]*)\s+(walk|run|jump|dance|wave)/i.exec(
        text,
      );

    if (match) {
      const reference =
        match[1];

      const result =
        resolveEntity(
          Array.isArray(project?.entities)
            ? project.entities
            : [],
          reference,
        );

      if (
        result.status ===
        "resolved"
      ) {
        add(
          "CREATE_ANIMATION",
          {
            motion:
              match[2],

            durationTicks:
              48000,
          },
          [
            result.entityId!,
          ],
        );
      } else if (
        result.status ===
        "ambiguous"
      ) {
        clarifications.push(
          `Which character is "${reference}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(
          `Which character is "${reference}"?`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                             MODIFY OUTFIT                              */
    /* ---------------------------------------------------------------------- */

    match =
      /change\s+([A-Za-z][\w-]*)['’]s\s+(shirt|top)\s+to\s+([#A-Za-z0-9]+)/i.exec(
        text,
      );

    if (match) {
      const reference =
        match[1];

      const result =
        resolveEntity(
          Array.isArray(project?.entities)
            ? project.entities
            : [],
          reference,
        );

      if (
        result.status ===
        "resolved"
      ) {
        add(
          "MODIFY_OUTFIT",
          {
            [match[2]]:
              match[3],
          },
          [
            result.entityId!,
          ],
        );
      } else if (
        result.status ===
        "ambiguous"
      ) {
        clarifications.push(
          `Which character is "${reference}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(
          `Which character is "${reference}"?`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                              DIALOGUE                                  */
    /* ---------------------------------------------------------------------- */

    match =
      /make\s+([A-Za-z][\w-]*)\s+say\s+["“](.+?)["”]/i.exec(
        text,
      );

    if (match) {
      const reference =
        match[1];

      const result =
        resolveEntity(
          Array.isArray(project?.entities)
            ? project.entities
            : [],
          reference,
        );

      if (
        result.status ===
        "resolved"
      ) {
        add(
          "CREATE_DIALOGUE",
          {
            speakerId:
              result.entityId,

            text:
              match[2],

            language:
              /\b(hindi|हिंदी)\b/i.test(
                low,
              )
                ? "hi-IN"
                : "en-IN",
          },
          [
            result.entityId!,
          ],
        );
      } else if (
        result.status ===
        "ambiguous"
      ) {
        clarifications.push(
          `Which character is "${reference}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(
          `Which character is "${reference}"?`,
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                              CAMERA                                    */
    /* ---------------------------------------------------------------------- */

    if (
      /close[\s-]?up/i.test(low)
    ) {
      add(
        "MODIFY_CAMERA",
        {
          shot:
            "close-up",

          zoom:
            2.2,
        },
      );
    }

    if (
      /wide\s+shot/i.test(low)
    ) {
      add(
        "MODIFY_CAMERA",
        {
          shot:
            "wide",

          zoom:
            0.8,
        },
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                              LIP-SYNC                                  */
    /* ---------------------------------------------------------------------- */

    if (
      /lip[\s-]?sync|lipsync/i.test(
        low,
      )
    ) {
      warnings.push(
        "Lip-sync requires committed audio/phoneme timing; no hidden analysis is performed during render.",
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                         Bounded Grammar Guard                           */
    /* ---------------------------------------------------------------------- */

    if (
      commands.length === 0 &&
      clarifications.length === 0
    ) {
      throw new CaeError(
        "PROMPT_UNCLEAR",
        "Prompt is outside the bounded deterministic grammar; use canonical commands or an enabled LLM planner.",
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                              Plan Object                                */
    /* ---------------------------------------------------------------------- */

    const plan: any = {
      planId:
        planIdFor(
          projectId,
          revisionId,
          text,
        ),

      schemaVersion:
        "1.0.0",

      sourceProjectRevisionId:
        revisionId,

      planner: {
        id:
          PROMPT_PLANNER_ID,

        version:
          PROMPT_PLANNER_VERSION,
      },

      intents,

      commands,

      dependencies:
        Object.fromEntries(
          commands.map(
            (currentCommand) => [
              currentCommand.commandId,
              currentCommand.dependencies,
            ],
          ),
        ),

      affectedEntityIds:
        [
          ...new Set(
            commands.flatMap(
              (currentCommand) =>
                currentCommand.targetIds,
            ),
          ),
        ],

      requiredCapabilities: [],

      assumptions,

      warnings,

      clarificationRequests:
        clarifications,

      previewable:
        true,

      estimates: {
        commandCount:
          commands.length,
      },

      /*
       * Hash is calculated over the complete canonical plan except for
       * planHash itself.
       *
       * `undefined` is deliberately not used because JSON.stringify omits
       * undefined object properties. `null` makes the hashed representation
       * explicit and stable.
       */
      planHash: "",
    };

    plan.planHash =
      canonicalHash({
        ...plan,
        planHash: null,
      }) as string;

    return plan as CommandPlanT;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Default Export                               */
/* -------------------------------------------------------------------------- */

export default RuleBasedPromptPlanner;