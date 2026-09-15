import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { randomUUID } from "node:crypto";

import { CaeError } from "../../domain/src/index.js";

import {
  ProjectRepository,
} from "../../project-engine/src/index.js";

import {
  CommandExecutor,
} from "../../command-execution/src/index.js";

import {
  RuleBasedPromptPlanner,
} from "../../prompt-planning/src/index.js";

import {
  ProceduralGenerationEngine,
} from "../../generation-engine/src/index.js";

/* -------------------------------------------------------------------------- */
/* Versioning                                                                  */
/* -------------------------------------------------------------------------- */

export const API_SERVER_VERSION = "1.0.0";

const CORE_ADAPTER_ID = "core";
const CORE_ADAPTER_VERSION = "1.0.0";
const CORE_CONTRACT_VERSION = "1.0.0";

/* -------------------------------------------------------------------------- */
/* Core capabilities                                                           */
/* -------------------------------------------------------------------------- */

const CORE_CAPABILITIES: Record<
  string,
  "supported" | "unsupported" | "experimental"
> = {
  "character.create": "supported",
  "character.modify": "supported",
  "scene.compose": "supported",

  "motion.walk": "supported",
  "motion.run": "supported",
  "motion.jump": "supported",
  "motion.wave": "supported",

  "facial.emotion": "supported",
  "facial.lip-sync": "supported",

  "render.2d": "supported",
  "render.3d.scene-export": "supported",

  "generation.procedural": "supported",
};

/* -------------------------------------------------------------------------- */
/* Request types                                                               */
/* -------------------------------------------------------------------------- */

interface RequestBody {
  readonly [key: string]: unknown;
}

interface ProjectIdParams {
  readonly projectId: string;
}

interface CommandValidateBody
  extends RequestBody {
  readonly projectId?: unknown;
  readonly command?: unknown;
}

interface CommandExecuteBody
  extends RequestBody {
  readonly command?: unknown;
}

interface PromptBody
  extends RequestBody {
  readonly projectId?: unknown;
  readonly prompt?: unknown;
}

interface PromptExecuteBody
  extends PromptBody {
  readonly planHash?: unknown;
  readonly approved?: unknown;
}

interface GenerationBody
  extends RequestBody {}

/* -------------------------------------------------------------------------- */
/* Preview types                                                              */
/* -------------------------------------------------------------------------- */

interface PreviewCommand {
  readonly commandType: string;
  readonly payload: unknown;
}

/* -------------------------------------------------------------------------- */
/* Request helpers                                                             */
/* -------------------------------------------------------------------------- */

function bodyOf<
  T extends RequestBody = RequestBody,
>(
  request: FastifyRequest,
): T {
  const body = request.body;

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return {} as T;
  }

  return body as T;
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

function optionalString(
  value: unknown,
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (
    typeof value !== "string"
  ) {
    throw new CaeError(
      "INVALID_REQUEST",
      "Value must be a string when provided.",
    );
  }

  const result =
    value.trim();

  return result.length > 0
    ? result
    : undefined;
}

function getRequestId(
  request: FastifyRequest,
): string {
  const incoming =
    request.headers[
      "x-request-id"
    ];

  if (
    typeof incoming === "string" &&
    incoming.trim().length > 0
  ) {
    return incoming.trim();
  }

  return randomUUID();
}

/* -------------------------------------------------------------------------- */
/* Capability descriptor                                                       */
/* -------------------------------------------------------------------------- */

function getCoreCapabilityDescriptor() {
  return {
    adapterId:
      CORE_ADAPTER_ID,

    adapterVersion:
      CORE_ADAPTER_VERSION,

    contractVersion:
      CORE_CONTRACT_VERSION,

    capabilities: {
      ...CORE_CAPABILITIES,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* API error serialization                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The domain layer intentionally exposes CaeError.toJSON() as:
 *
 * {
 *   error: {
 *     code,
 *     message,
 *     details
 *   }
 * }
 *
 * The HTTP API has its own public error contract.
 * Keep that contract flat:
 *
 * {
 *   code,
 *   message,
 *   details
 * }
 */
function sendError(
  error: unknown,
  reply: FastifyReply,
): void {
  if (
    error instanceof CaeError
  ) {
    reply
      .status(400)
      .send({
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,
      });

    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  reply
    .status(400)
    .send({
      code:
        "INVALID_REQUEST",

      message,

      details: [],
    });
}

/* -------------------------------------------------------------------------- */
/* Command normalization                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Canonical API commands may carry CREATE_CHARACTER data in the canonical
 * nested form:
 *
 * payload: {
 *   character: {
 *     id,
 *     name,
 *     representation
 *   }
 * }
 *
 * The current command execution domain accepts the normalized operational
 * form:
 *
 * payload: {
 *   entityId,
 *   name,
 *   representation
 * }
 *
 * This adapter belongs at the API boundary so the CommandExecutor remains
 * backward compatible with its existing canonical command tests.
 */
function normalizeCommandForExecution(
  input: unknown,
): unknown {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return input;
  }

  const command =
    input as Record<
      string,
      unknown
    >;

  if (
    command.commandType !==
    "CREATE_CHARACTER"
  ) {
    return input;
  }

  if (
    typeof command.payload !==
      "object" ||
    command.payload === null ||
    Array.isArray(command.payload)
  ) {
    return input;
  }

  const payload =
    command.payload as Record<
      string,
      unknown
    >;

  const character =
    payload.character;

  if (
    typeof character !==
      "object" ||
    character === null ||
    Array.isArray(character)
  ) {
    return input;
  }

  const characterData =
    character as Record<
      string,
      unknown
    >;

  return {
    ...command,

    payload: {
      ...payload,

      ...characterData,

      entityId:
        characterData.entityId ??
        characterData.id,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Server factory                                                              */
/* -------------------------------------------------------------------------- */

export function createServer(
  projects: ProjectRepository,
): FastifyInstance {
  const app =
    Fastify({
      bodyLimit:
        2_000_000,

      logger:
        false,
    });

  /* ------------------------------------------------------------------------ */
  /* Services                                                                 */
  /* ------------------------------------------------------------------------ */

  const executor =
    new CommandExecutor(
      projects,
      [
        getCoreCapabilityDescriptor(),
      ],
    );

  const planner =
    new RuleBasedPromptPlanner();

  const generator =
    new ProceduralGenerationEngine();

  /* ------------------------------------------------------------------------ */
  /* Request ID                                                               */
  /* ------------------------------------------------------------------------ */

  app.addHook(
    "onRequest",
    async (
      request,
      reply,
    ) => {
      reply.header(
        "x-request-id",
        getRequestId(request),
      );
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Health                                                                   */
  /* ------------------------------------------------------------------------ */

  app.get(
    "/api/v1/health",
    async () => ({
      ok: true,
      version:
        API_SERVER_VERSION,
    }),
  );

  /* ------------------------------------------------------------------------ */
  /* Capabilities                                                             */
  /* ------------------------------------------------------------------------ */

  app.get(
    "/api/v1/capabilities",
    async () => ({
      version:
        API_SERVER_VERSION,

      capabilities: [
        getCoreCapabilityDescriptor(),
      ],
    }),
  );

  /* ------------------------------------------------------------------------ */
  /* Projects                                                                 */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/projects",
    async (
      request,
    ) => {
      const body =
        bodyOf<RequestBody>(
          request,
        );

      const name =
        optionalString(
          body.name,
        ) ??
        "Untitled";

      const created =
        await projects.create(
          name,
        );

      /*
       * Public API returns the project itself.
       *
       * ProjectRepository internally returns:
       * {
       *   project,
       *   revision
       * }
       *
       * The API contract expects:
       * {
       *   projectId,
       *   id,
       *   name,
       *   revision,
       *   ...
       * }
       */
      return created.project;
    },
  );

  app.get(
    "/api/v1/projects",
    async () =>
      projects.list(),
  );

  app.get(
    "/api/v1/projects/:projectId",
    async (
      request,
    ) => {
      const params =
        request.params as ProjectIdParams;

      const projectId =
        requiredString(
          params.projectId,
          "projectId",
        );

      return projects.get(
        projectId,
      );
    },
  );

  app.get(
    "/api/v1/projects/:projectId/revisions/latest",
    async (
      request,
    ) => {
      const params =
        request.params as ProjectIdParams;

      const projectId =
        requiredString(
          params.projectId,
          "projectId",
        );

      return projects.latest(
        projectId,
      );
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Command validation                                                       */
  /* ------------------------------------------------------------------------ */

  /*
   * Fastify treats ":" as a route parameter marker.
   *
   * To expose the literal public URL:
   *
   * /api/v1/commands:validate
   *
   * the registered Fastify route uses:
   *
   * /api/v1/commands::validate
   */
  app.post(
    "/api/v1/commands::validate",
    async (
      request,
    ) => {
      const body =
        bodyOf<CommandValidateBody>(
          request,
        );

      const projectId =
        requiredString(
          body.projectId,
          "projectId",
        );

      if (
        body.command ===
        undefined
      ) {
        throw new CaeError(
          "INVALID_REQUEST",
          "command is required.",
        );
      }

      const latest =
        await projects.latest(
          projectId,
        );

      return executor.validate(
        body.command,
        latest.revisionId,
      );
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Command execution                                                        */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/commands::execute",
    async (
      request,
    ) => {
      const body =
        bodyOf<CommandExecuteBody>(
          request,
        );

      if (
        body.command ===
        undefined
      ) {
        throw new CaeError(
          "INVALID_REQUEST",
          "command is required.",
        );
      }

      const command =
        normalizeCommandForExecution(
          body.command,
        );

      return executor.execute(
        command,
      );
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Prompt planning                                                          */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/prompts::plan",
    async (
      request,
    ) => {
      const body =
        bodyOf<PromptBody>(
          request,
        );

      const projectId =
        requiredString(
          body.projectId,
          "projectId",
        );

      const prompt =
        requiredString(
          body.prompt,
          "prompt",
        );

      const project =
        await projects.get(
          projectId,
        );

      const revision =
        await projects.latest(
          projectId,
        );

      return planner.plan(
        prompt,
        project,
        revision.revisionId,
      );
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Prompt validation                                                        */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/prompts::validate",
    async (
      request,
    ) => {
      const body =
        bodyOf<PromptBody>(
          request,
        );

      const projectId =
        requiredString(
          body.projectId,
          "projectId",
        );

      const prompt =
        requiredString(
          body.prompt,
          "prompt",
        );

      const project =
        await projects.get(
          projectId,
        );

      const revision =
        await projects.latest(
          projectId,
        );

      const plan =
        planner.plan(
          prompt,
          project,
          revision.revisionId,
        );

      return {
        valid:
          plan
            .clarificationRequests
            .length === 0,

        planHash:
          plan.planHash,

        clarifications:
          plan.clarificationRequests,
      };
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Prompt preview                                                           */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/prompts::preview",
    async (
      request,
    ) => {
      const body =
        bodyOf<PromptBody>(
          request,
        );

      const projectId =
        requiredString(
          body.projectId,
          "projectId",
        );

      const prompt =
        requiredString(
          body.prompt,
          "prompt",
        );

      const project =
        await projects.get(
          projectId,
        );

      const revision =
        await projects.latest(
          projectId,
        );

      const plan =
        planner.plan(
          prompt,
          project,
          revision.revisionId,
        );

      const entityDiff: PreviewCommand[] =
        plan.commands.map(
          (
            command: PreviewCommand,
          ) => ({
            commandType:
              command.commandType,

            payload:
              command.payload,
          }),
        );

      return {
        planHash:
          plan.planHash,

        valid:
          plan
            .clarificationRequests
            .length === 0,

        validation: {
          schema: true,

          revision:
            plan.sourceProjectRevisionId ===
            revision.revisionId,
        },

        entityDiff,

        assumptions:
          plan.assumptions,

        warnings:
          plan.warnings,

        clarifications:
          plan.clarificationRequests,

        estimates:
          plan.estimates,
      };
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Prompt execution                                                         */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/prompts::execute",
    async (
      request,
    ) => {
      const body =
        bodyOf<PromptExecuteBody>(
          request,
        );

      const projectId =
        requiredString(
          body.projectId,
          "projectId",
        );

      const prompt =
        requiredString(
          body.prompt,
          "prompt",
        );

      const planHash =
        requiredString(
          body.planHash,
          "planHash",
        );

      const project =
        await projects.get(
          projectId,
        );

      const revision =
        await projects.latest(
          projectId,
        );

      const plan =
        planner.plan(
          prompt,
          project,
          revision.revisionId,
        );

      if (
        plan.planHash !==
        planHash
      ) {
        throw new CaeError(
          "PLAN_STALE",
          "Plan hash mismatch.",
        );
      }

      if (
        plan.sourceProjectRevisionId !==
        revision.revisionId
      ) {
        throw new CaeError(
          "PLAN_STALE",
          "Project revision changed after planning.",
        );
      }

      if (
        plan
          .clarificationRequests
          .length > 0
      ) {
        throw new CaeError(
          "PROMPT_UNCLEAR",
          "Clarification required.",
          plan.clarificationRequests,
        );
      }

      return executor.executeMany(
        plan.commands,
        body.approved === true,
      );
    },
  );

  /* ------------------------------------------------------------------------ */
  /* Procedural generation                                                    */
  /* ------------------------------------------------------------------------ */

  app.post(
    "/api/v1/generation/character",
    async (
      request,
    ) =>
      generator.character(
        bodyOf<GenerationBody>(
          request,
        ),
      ),
  );

  app.post(
    "/api/v1/generation/scene",
    async (
      request,
    ) =>
      generator.scene(
        bodyOf<GenerationBody>(
          request,
        ),
      ),
  );

  /* ------------------------------------------------------------------------ */
  /* Error handler                                                            */
  /* ------------------------------------------------------------------------ */

  app.setErrorHandler(
    (
      error,
      _request,
      reply,
    ) => {
      sendError(
        error,
        reply,
      );
    },
  );

  return app;
}

/* -------------------------------------------------------------------------- */
/* Default export                                                              */
/* -------------------------------------------------------------------------- */

export default createServer;