
import {
  canonicalHash,
  CaeError,
} from "../../domain/src/index.js";

import type { CommandPlanT } from "../../contracts/src/index.js";

export interface Planner {
  plan(prompt: string, project: any, revisionId: string): CommandPlanT;
}

export const PROMPT_PLANNER_VERSION = "1.1.0";
export const PROMPT_PLANNER_ID = "rule-based";

const UUID_NAMESPACE = "00000000-0000-4000-8000-000000000000";

type Representation = "2d" | "3d" | "hybrid";

function deterministicId(namespace: string, value: unknown): string {
  const digest = String(canonicalHash({ namespace, value }));

  const variantByte = (
    (Number.parseInt(digest.slice(16, 18), 16) & 0x3f) | 0x80
  )
    .toString(16)
    .padStart(2, "0");

  return (
    `${digest.slice(0, 8)}-` +
    `${digest.slice(8, 12)}-` +
    `4${digest.slice(13, 16)}-` +
    `${variantByte}${digest.slice(18, 20)}-` +
    `${digest.slice(20, 32)}`
  );
}

function planIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
): string {
  return deterministicId(`${UUID_NAMESPACE}:plan`, {
    projectId,
    revisionId,
    prompt,
  });
}

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
  return deterministicId(`${UUID_NAMESPACE}:command`, {
    projectId,
    revisionId,
    prompt,
    commandIndex,
    commandType,
    payload,
    targetIds,
    dependencies,
  });
}

function intentIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
  intentIndex: number,
  operation: string,
  targetIds: string[],
  parameters: unknown,
): string {
  return deterministicId(`${UUID_NAMESPACE}:intent`, {
    projectId,
    revisionId,
    prompt,
    intentIndex,
    operation,
    targetIds,
    parameters,
  });
}

function idempotencyKeyFor(
  projectId: string,
  revisionId: string,
  commandId: string,
): string {
  return `plan-${String(
    canonicalHash({ projectId, revisionId, commandId }),
  )}`;
}

function sceneIdFor(
  projectId: string,
  revisionId: string,
  prompt: string,
  sceneName: string,
): string {
  return deterministicId(`${UUID_NAMESPACE}:scene`, {
    projectId,
    revisionId,
    prompt,
    sceneName,
  });
}

export const resolveEntity = (entities: any[], reference: string) => {
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
        (value: unknown) =>
          typeof value === "string" &&
          value.toLowerCase() === q,
      ),
  );

  const matches = exact.length > 0 ? exact : alias;

  if (matches.length === 1) {
    return {
      status: "resolved" as const,
      entityId: matches[0].id as string,
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous" as const,
      candidates: matches.map((entity) => entity.id as string),
    };
  }

  return { status: "missing" as const };
};

function projectIdentifier(project: any): string {
  const value = project?.projectId ?? project?.id;

  if (typeof value !== "string" || !value.trim()) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Project must contain a valid projectId.",
    );
  }

  return value;
}

function detectRepresentation(text: string): Representation {
  const low = text.toLowerCase();

  if (
    /\bhybrid\b/.test(low) ||
    (/\b2d\b/.test(low) && /\b3d\b/.test(low))
  ) {
    return "hybrid";
  }

  if (/\b3d\b|three[- ]dimensional/.test(low)) {
    return "3d";
  }

  return "2d";
}

/**
 * Extract the actual character name instead of swallowing the rest
 * of the sentence into the name.
 */
function extractCharacter(text: string): {
  name: string;
  age?: number;
  gender?: string;
} | null {
  const patterns = [
    /\b(?:character|cartoon character|boy|girl|man|woman)\s+(?:named|called)\s+["']?([A-Za-z][\w'-]*)/i,
    /\b(?:named|called)\s+["']?([A-Za-z][\w'-]*)/i,
  ];

  let name: string | undefined;

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      name = match[1].trim();
      break;
    }
  }

  const hasCharacterIntent =
    /\b(create|make|build|generate|design)\b/i.test(text) &&
    /\b(character|cartoon|boy|girl|man|woman)\b/i.test(text);

  if (!name && hasCharacterIntent) {
    const simple = /\b(?:create|make|build|generate|design)\s+(?:a\s+)?(?:(?:2d|3d|hybrid)\s+)?(?:cartoon\s+)?(?:character|boy|girl|man|woman)\s+([A-Za-z][\w'-]*)/i.exec(
      text,
    );

    if (simple?.[1]) {
      name = simple[1];
    }
  }

  if (!name || !hasCharacterIntent) {
    return null;
  }

  const ageMatch = /\b(\d{1,3})\s*[- ]?year[- ]old\b/i.exec(text);
  const genderMatch = /\b(boy|girl|man|woman)\b/i.exec(text);

  return {
    name,
    ...(ageMatch ? { age: Number(ageMatch[1]) } : {}),
    ...(genderMatch ? { gender: genderMatch[1].toLowerCase() } : {}),
  };
}

function extractSceneName(text: string): string {
  const low = text.toLowerCase();

  if (/classroom|school\s*room/.test(low)) return "Classroom";
  if (/\bbeach\b/.test(low)) return "Beach Scene";
  if (/\bforest\b/.test(low)) return "Forest Scene";
  if (/\bcity|street|road\b/.test(low)) return "City Street";
  if (/\bbedroom\b/.test(low)) return "Bedroom";
  if (/\bpark\b/.test(low)) return "Park Scene";
  if (/\bindoor\b/.test(low)) return "Indoor Scene";
  if (/\boutdoor|landscape|garden|green ground\b/.test(low)) {
    return "Outdoor Scene";
  }

  return "Cartoon Scene";
}

function sceneRequested(text: string): boolean {
  const low = text.toLowerCase();

  const mentionsScene =
    /\b(scene|background|environment|landscape|outdoor|indoor|classroom|school\s*room|beach|forest|bedroom|park)\b/.test(
      low,
    );

  const mentionsAction =
    /\b(create|make|build|generate|design|place|put|set|show|render|animate)\b/.test(
      low,
    );

  return mentionsScene && mentionsAction;
}

function extractDimensions(text: string): {
  width: number;
  height: number;
} {
  const match = /\b(\d{2,5})\s*[x×]\s*(\d{2,5})\b/i.exec(text);

  if (match) {
    const width = Number(match[1]);
    const height = Number(match[2]);

    if (
      Number.isInteger(width) &&
      Number.isInteger(height) &&
      width >= 64 &&
      height >= 64 &&
      width <= 16384 &&
      height <= 16384
    ) {
      return { width, height };
    }
  }

  return { width: 1280, height: 720 };
}

function extractBackground(text: string): string {
  const low = text.toLowerCase();

  if (/\bnight|nighttime|night-time\b/.test(low)) return "#17213D";
  if (/\bsunset|sunset sky\b/.test(low)) return "#F4A261";
  if (/\bindoor|classroom|bedroom\b/.test(low)) return "#F2E8CF";
  if (/\bblue sky|outdoor|landscape|garden|green ground\b/.test(low)) {
    return "#87CEEB";
  }

  return "#FFFFFF";
}

export class RuleBasedPromptPlanner implements Planner {
  plan(
    prompt: string,
    project: any,
    revisionId: string,
  ): CommandPlanT {
    const text = prompt.trim();

    if (!text) {
      throw new CaeError("PROMPT_UNCLEAR", "Prompt is empty");
    }

    if (typeof revisionId !== "string" || !revisionId.trim()) {
      throw new CaeError(
        "INVALID_REQUEST",
        "revisionId must be a non-empty string.",
      );
    }

    const projectId = projectIdentifier(project);
    const low = text.toLowerCase();
    const representation = detectRepresentation(text);

    const intents: any[] = [];
    const commands: any[] = [];
    const assumptions: string[] = [];
    const warnings: string[] = [];
    const clarifications: string[] = [];

    const plannedEntities = new Map<string, string>();

    const add = (
      type: string,
      payload: Record<string, unknown> = {},
      targets: string[] = [],
      dependencies: string[] = [],
    ): string => {
      const commandIndex = commands.length;

      const commandId = commandIdFor(
        projectId,
        revisionId,
        text,
        commandIndex,
        type,
        payload,
        targets,
        dependencies,
      );

      const command = {
        commandId,
        schemaVersion: "1.0.0",
        commandType: type,
        projectId,
        expectedProjectRevisionId: revisionId,
        idempotencyKey: idempotencyKeyFor(
          projectId,
          revisionId,
          commandId,
        ),
        targetIds: targets,
        payload,
        dependencies,
        preconditions: {},
        authorization: { scope: `project:${projectId}` },
        requiredCapabilities: [],
        provenance: {
          planner: PROMPT_PLANNER_ID,
          version: PROMPT_PLANNER_VERSION,
        },
        expectedEffects: [],
        undoMetadata: {},
      };

      commands.push(command);

      const intentIndex = intents.length;

      intents.push({
        intentId: intentIdFor(
          projectId,
          revisionId,
          text,
          intentIndex,
          type,
          targets,
          payload,
        ),
        schemaVersion: "1.0.0",
        operation: type,
        ...(targets[0] ? { targetEntityId: targets[0] } : {}),
        parameters: payload,
        constraints: [],
        references: [],
        requestedCapabilities: [],
        confidence: 0.98,
        explanation: `Mapped from: ${text}`,
        defaults: [],
        assumptions: [],
        warnings: [],
        clarificationRequests: [],
      });

      return commandId;
    };

    const resolveReference = (reference: string) => {
      const plannedId = plannedEntities.get(reference.toLowerCase());

      if (plannedId) {
        return {
          status: "resolved" as const,
          entityId: plannedId,
        };
      }

      return resolveEntity(
        Array.isArray(project?.entities) ? project.entities : [],
        reference,
      );
    };

    /* ---------------------------------------------------------------------- */
    /*                           CREATE CHARACTER                             */
    /* ---------------------------------------------------------------------- */

    const character = extractCharacter(text);
    let characterCommandId: string | undefined;
    let characterEntityId: string | undefined;

    if (character) {
      const existing = resolveEntity(
        Array.isArray(project?.entities) ? project.entities : [],
        character.name,
      );

      if (existing.status === "resolved") {
        throw new CaeError(
          "ENTITY_DUPLICATE",
          "Character already exists",
          [character.name],
        );
      }

      if (existing.status === "ambiguous") {
        throw new CaeError(
          "ENTITY_AMBIGUOUS",
          `Multiple entities match "${character.name}".`,
          existing.candidates,
        );
      }

      characterEntityId = deterministicId(
        `${UUID_NAMESPACE}:character`,
        {
          projectId,
          revisionId,
          prompt: text,
          name: character.name.toLowerCase(),
        },
      );

      plannedEntities.set(
        character.name.toLowerCase(),
        characterEntityId,
      );

      characterCommandId = add("CREATE_CHARACTER", {
        entityId: characterEntityId,
        name: character.name,
        representation,
        ...(character.age !== undefined ? { age: character.age } : {}),
        ...(character.gender ? { gender: character.gender } : {}),
      });
    }

    /* ---------------------------------------------------------------------- */
    /*                               CREATE SCENE                             */
    /* ---------------------------------------------------------------------- */

    let sceneCommandId: string | undefined;
    let sceneId: string | undefined;

    if (sceneRequested(text)) {
      const sceneName = extractSceneName(text);
      const dimensions = extractDimensions(text);

      sceneId = sceneIdFor(
        projectId,
        revisionId,
        text,
        sceneName,
      );

      const isClassroom = /classroom|school\s*room/i.test(low);

      sceneCommandId = add("CREATE_SCENE", {
        id: sceneId,
        name: sceneName,
        template: isClassroom ? "classroom" : "procedural",
        type: representation,
        width: dimensions.width,
        height: dimensions.height,
        background: extractBackground(text),
      });
    }

    /* ---------------------------------------------------------------------- */
    /*                            PLACE CHARACTER                             */
    /* ---------------------------------------------------------------------- */

    const asksPlacement =
      /\b(place|put|position|set|stand|show)\b/i.test(text) &&
      /\b(scene|background|environment|outdoor|indoor|landscape|classroom|park|beach|forest|garden)\b/i.test(
        text,
      );

    if (
      characterEntityId &&
      characterCommandId &&
      sceneCommandId &&
      sceneId &&
      asksPlacement
    ) {
      const dimensions = extractDimensions(text);

      add(
        "PLACE_CHARACTER",
        {
          x: Math.round(dimensions.width / 2),
          y: Math.round(dimensions.height * 0.75),
          z: 0,
          sceneId,
        },
        [characterEntityId],
        [characterCommandId, sceneCommandId],
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                            CREATE EXPRESSION                           */
    /* ---------------------------------------------------------------------- */

    let match =
      /\bmake\s+([A-Za-z][\w'-]*)\s+(angry|happy|sad|surprised|fearful|neutral)\b/i.exec(
        text,
      );

    if (match) {
      const reference = match[1];
      const result = resolveReference(reference);

      if (result.status === "resolved") {
        add(
          "CREATE_EXPRESSION",
          { expression: match[2].toLowerCase() },
          [result.entityId!],
          characterCommandId ? [characterCommandId] : [],
        );
      } else if (result.status === "ambiguous") {
        clarifications.push(
          `Which character is "${reference}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(`Which character is "${reference}"?`);
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                            CREATE ANIMATION                            */
    /* ---------------------------------------------------------------------- */

    match =
      /\b(?:make|let|have)\s+([A-Za-z][\w'-]*)\s+(walk|run|jump|dance|wave)\b/i.exec(
        text,
      );

    if (match) {
      const reference = match[1];
      const result = resolveReference(reference);

      if (result.status === "resolved") {
        add(
          "CREATE_ANIMATION",
          {
            motion: match[2].toLowerCase(),
            durationTicks: 48000,
          },
          [result.entityId!],
          characterCommandId ? [characterCommandId] : [],
        );
      } else if (result.status === "ambiguous") {
        clarifications.push(
          `Which character is "${reference}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(`Which character is "${reference}"?`);
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                              MODIFY OUTFIT                              */
    /* ---------------------------------------------------------------------- */

    match =
      /\bchange\s+([A-Za-z][\w'-]*)['’]s\s+(shirt|top)\s+to\s+(#[0-9a-f]{3,8}|[A-Za-z]+)\b/i.exec(
        text,
      );

    if (match) {
      const result = resolveReference(match[1]);

      if (result.status === "resolved") {
        add(
          "MODIFY_OUTFIT",
          { [match[2].toLowerCase()]: match[3] },
          [result.entityId!],
        );
      } else if (result.status === "ambiguous") {
        clarifications.push(
          `Which character is "${match[1]}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(`Which character is "${match[1]}"?`);
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                                 DIALOGUE                                */
    /* ---------------------------------------------------------------------- */

    match =
      /\bmake\s+([A-Za-z][\w'-]*)\s+say\s+["“](.+?)["”]/i.exec(text);

    if (match) {
      const result = resolveReference(match[1]);

      if (result.status === "resolved") {
        add(
          "CREATE_DIALOGUE",
          {
            speakerId: result.entityId,
            text: match[2],
            language: /\b(hindi|हिंदी)\b/i.test(low) ? "hi-IN" : "en-IN",
          },
          [result.entityId!],
        );
      } else if (result.status === "ambiguous") {
        clarifications.push(
          `Which character is "${match[1]}"? Candidates: ${result.candidates.join(", ")}.`,
        );
      } else {
        clarifications.push(`Which character is "${match[1]}"?`);
      }
    }

    /* ---------------------------------------------------------------------- */
    /*                                  CAMERA                                 */
    /* ---------------------------------------------------------------------- */

    if (/close[\s-]?up/i.test(low)) {
      add("MODIFY_CAMERA", { shot: "close-up", zoom: 2.2 });
    }

    if (/\bwide\s+shot\b/i.test(low)) {
      add("MODIFY_CAMERA", { shot: "wide", zoom: 0.8 });
    }

    /* ---------------------------------------------------------------------- */
    /*                                  LIP-SYNC                               */
    /* ---------------------------------------------------------------------- */

    if (/lip[\s-]?sync|lipsync/i.test(low)) {
      warnings.push(
        "Lip-sync requires committed audio/phoneme timing; no hidden analysis is performed during render.",
      );
    }

    /* ---------------------------------------------------------------------- */
    /*                              BOUNDED GRAMMAR                            */
    /* ---------------------------------------------------------------------- */

    if (commands.length === 0 && clarifications.length === 0) {
      throw new CaeError(
        "PROMPT_UNCLEAR",
        "Prompt is outside the bounded deterministic grammar; use canonical commands or an enabled LLM planner.",
      );
    }

    if (representation === "hybrid") {
      assumptions.push(
        "Hybrid representation requested. Actual hybrid rendering depends on the renderer and execution adapters supporting both 2D and 3D content.",
      );
    }

    if (
      character &&
      sceneRequested(text) &&
      !asksPlacement
    ) {
      assumptions.push(
        "A character and scene were planned, but explicit placement was not requested.",
      );
    }

    const plan: any = {
      planId: planIdFor(projectId, revisionId, text),
      schemaVersion: "1.0.0",
      sourceProjectRevisionId: revisionId,
      planner: {
        id: PROMPT_PLANNER_ID,
        version: PROMPT_PLANNER_VERSION,
      },
      intents,
      commands,
      dependencies: Object.fromEntries(
        commands.map((command) => [
          command.commandId,
          command.dependencies,
        ]),
      ),
      affectedEntityIds: [
        ...new Set(
          commands.flatMap((command) => command.targetIds),
        ),
      ],
      requiredCapabilities: [],
      assumptions,
      warnings,
      clarificationRequests: clarifications,
      previewable: true,
      estimates: { commandCount: commands.length },
      planHash: "",
    };

    plan.planHash = canonicalHash({
      ...plan,
      planHash: null,
    }) as string;

    return plan as CommandPlanT;
  }
}

export default RuleBasedPromptPlanner;
