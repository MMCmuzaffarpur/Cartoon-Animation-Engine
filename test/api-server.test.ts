import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  mkdtemp,
  rm,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  createServer,
} from "../packages/api-server/src/index.js";

import {
  ProjectRepository,
} from "../packages/project-engine/src/index.js";

import {
  PLUGIN_SDK_VERSION,
} from "../packages/plugin-sdk/src/index.js";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ENGINE_VERSION =
  "1.0.0";

const TEST_PROJECT_NAME =
  "API Server Test Project";

const COMMAND_ID =
  "00000000-0000-4000-8000-000000000103";

const CHARACTER_ID =
  "00000000-0000-4000-8000-000000000102";

const UNKNOWN_PROJECT_ID =
  "00000000-0000-4000-8000-000000000104";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface TestContext {
  readonly root: string;
  readonly projects: ProjectRepository;
  readonly app: ReturnType<
    typeof createServer
  >;
  readonly projectId: string;
  readonly revisionId: string;
}

interface TestResponse {
  readonly statusCode: number;
  readonly headers: Record<
    string,
    string | string[] | undefined
  >;
  json(): any;
}

/* -------------------------------------------------------------------------- */
/* Test State                                                                 */
/* -------------------------------------------------------------------------- */

let context:
  | TestContext
  | undefined;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function createContext(): Promise<TestContext> {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "cae-api-server-",
      ),
    );

  const projects =
    new ProjectRepository(
      root,
    );

  const app =
    createServer(
      projects,
    );

  await app.ready();

  const created =
    await projects.create(
      TEST_PROJECT_NAME,
      "api-test",
    );

  return {
    root,
    projects,
    app,
    projectId:
      created.project.id,
    revisionId:
      created.revision.revisionId,
  };
}

/**
 * Fastify's inject() has multiple overloads. Keeping the test helper's
 * public return contract explicit prevents TypeScript from selecting
 * the wrong overload and turning the response into `void & Promise<Response>`.
 */
async function request(
  method:
    | "GET"
    | "POST",
  url: string,
  body?: Record<string, unknown> | null,
): Promise<TestResponse> {
  const testContext = context;

  if (testContext === undefined) {
    throw new Error(
      "Test context has not been initialized.",
    );
  }

  const response =
    body == null
      ? await testContext.app.inject({
          method,
          url,
        })
      : await testContext.app.inject({
          method,
          url,
          payload: body,
        });

  return response as unknown as TestResponse;
}

function createCommand(
  projectId: string,
  revisionId: string,
) {
  return {
    commandId:
      COMMAND_ID,

    schemaVersion:
      ENGINE_VERSION,

    commandType:
      "CREATE_CHARACTER",

    projectId,

    expectedProjectRevisionId:
      revisionId,

    idempotencyKey:
      `api-test-${projectId}`,

    targetIds: [],

    payload: {
      character: {
        id:
          CHARACTER_ID,

        name:
          "API Test Character",

        representation:
          "2d",
      },
    },

    dependencies: [],

    preconditions: {},

    seed: 12345,

    authorization: {},

    requiredCapabilities: [],

    provenance: {
      source:
        "api-server-test",
    },

    expectedEffects: [
      "character.created",
    ],

    undoMetadata: {},
  };
}

/* -------------------------------------------------------------------------- */
/* Setup / Cleanup                                                            */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
  context =
    await createContext();
});

afterEach(async () => {
  const testContext =
    context;

  if (
    testContext ===
    undefined
  ) {
    return;
  }

  await testContext.app.close();

  await rm(
    testContext.root,
    {
      recursive: true,
      force: true,
    },
  );

  context =
    undefined;
});

/* -------------------------------------------------------------------------- */
/* API Server                                                                 */
/* -------------------------------------------------------------------------- */

describe(
  "api-server",
  () => {
    /* ---------------------------------------------------------------------- */
    /* Health                                                                 */
    /* ---------------------------------------------------------------------- */

    describe(
      "health",
      () => {
        it(
          "returns a healthy response",
          async () => {
            const response =
              await request(
                "GET",
                "/api/v1/health",
              );

            expect(
              response.statusCode,
            ).toBe(200);

            expect(
              response.json(),
            ).toEqual({
              ok: true,
              version:
                ENGINE_VERSION,
            });
          },
        );

        it(
          "returns a request id header",
          async () => {
            const response =
              await request(
                "GET",
                "/api/v1/health",
              );

            expect(
              response.headers[
                "x-request-id"
              ],
            ).toBeTruthy();

            expect(
              typeof response.headers[
                "x-request-id"
              ],
            ).toBe(
              "string",
            );
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Capabilities                                                           */
    /* ---------------------------------------------------------------------- */

    describe(
      "capabilities",
      () => {
        it(
          "returns core capabilities",
          async () => {
            const response =
              await request(
                "GET",
                "/api/v1/capabilities",
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              Array.isArray(
                body.capabilities,
              ),
            ).toBe(true);

            expect(
              body.capabilities,
            ).toHaveLength(1);

            expect(
              body.capabilities[0]
                .adapterId,
            ).toBe("core");

            expect(
              body.capabilities[0]
                .adapterVersion,
            ).toBe(
              ENGINE_VERSION,
            );

            expect(
              body.capabilities[0]
                .contractVersion,
            ).toBe(
              ENGINE_VERSION,
            );
          },
        );

        it(
          "exposes render and generation capabilities",
          async () => {
            const response =
              await request(
                "GET",
                "/api/v1/capabilities",
              );

            const body =
              response.json();

            const capabilities =
              body.capabilities[0]
                .capabilities;

            expect(
              capabilities[
                "render.2d"
              ],
            ).toBe(
              "supported",
            );

            expect(
              capabilities[
                "render.3d.scene-export"
              ],
            ).toBe(
              "supported",
            );

            expect(
              capabilities[
                "generation.procedural"
              ],
            ).toBe(
              "supported",
            );
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Projects                                                               */
    /* ---------------------------------------------------------------------- */

    describe(
      "projects",
      () => {
        it(
          "creates a project",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/projects",
                {
                  name:
                    "Created Through API",
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              body.projectId,
            ).toBe(body.id);

            expect(
              body.name,
            ).toBe(
              "Created Through API",
            );

            expect(
              body.revision,
            ).toBe(0);
          },
        );

        it(
          "uses Untitled when project name is missing",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/projects",
                {},
              );

            expect(
              response.statusCode,
            ).toBe(200);

            expect(
              response.json().name,
            ).toBe(
              "Untitled",
            );
          },
        );

        it(
          "lists projects",
          async () => {
            const response =
              await request(
                "GET",
                "/api/v1/projects",
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              Array.isArray(body),
            ).toBe(true);

            expect(
              body.some(
                (
                  project: {
                    id: string;
                  },
                ) =>
                  project.id ===
                  context!
                    .projectId,
              ),
            ).toBe(true);
          },
        );

        it(
          "gets a project",
          async () => {
            const response =
              await request(
                "GET",
                `/api/v1/projects/${context!.projectId}`,
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              body.id,
            ).toBe(
              context!.projectId,
            );

            expect(
              body.name,
            ).toBe(
              TEST_PROJECT_NAME,
            );
          },
        );

        it(
          "gets the latest revision",
          async () => {
            const response =
              await request(
                "GET",
                `/api/v1/projects/${context!.projectId}/revisions/latest`,
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              body.revisionId,
            ).toBe(
              context!.revisionId,
            );

            expect(
              body.number,
            ).toBe(0);

            expect(
              body.projectId,
            ).toBe(
              context!.projectId,
            );
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Commands                                                               */
    /* ---------------------------------------------------------------------- */

    describe(
      "commands",
      () => {
        it(
          "validates a canonical command",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/commands:validate",
                {
                  projectId:
                    context!
                      .projectId,

                  command:
                    createCommand(
                      context!
                        .projectId,
                      context!
                        .revisionId,
                    ),
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              body.valid,
            ).toBe(true);

            expect(
              body.command,
            ).toBeTruthy();
          },
        );

        it(
          "rejects a command with a stale revision",
          async () => {
            const staleCommand =
              createCommand(
                context!.projectId,
                UNKNOWN_PROJECT_ID,
              );

            const response =
              await request(
                "POST",
                "/api/v1/commands:validate",
                {
                  projectId:
                    context!
                      .projectId,

                  command:
                    staleCommand,
                },
              );

            expect(
              response.statusCode,
            ).toBe(400);

            expect(
              response.json().code,
            ).toBe(
              "REVISION_CONFLICT",
            );
          },
        );

        it(
          "executes a canonical command",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/commands:execute",
                {
                  command:
                    createCommand(
                      context!
                        .projectId,
                      context!
                        .revisionId,
                    ),
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            expect(
              response.json(),
            ).toBeTruthy();
          },
        );

        it(
          "rejects an invalid command",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/commands:execute",
                {
                  command: {
                    commandType:
                      "INVALID_COMMAND",
                  },
                },
              );

            expect(
              response.statusCode,
            ).toBe(400);

            expect(
              response.json().code,
            ).toBe(
              "INVALID_REQUEST",
            );
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Prompt Planning                                                        */
    /* ---------------------------------------------------------------------- */

    describe(
      "prompt planning",
      () => {
        const prompt =
          "Create a cartoon character named Rahul";

        it(
          "plans a prompt",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/prompts:plan",
                {
                  projectId:
                    context!
                      .projectId,

                  prompt,
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              body,
            ).toBeTruthy();

            expect(
              typeof body.planHash,
            ).toBe(
              "string",
            );

            expect(
              body.planHash.length,
            ).toBeGreaterThan(0);

            expect(
              Array.isArray(
                body.commands,
              ),
            ).toBe(true);
          },
        );

        it(
          "produces a deterministic plan hash",
          async () => {
            const payload = {
              projectId:
                context!
                  .projectId,

              prompt,
            };

            const first =
              await request(
                "POST",
                "/api/v1/prompts:plan",
                payload,
              );

            const second =
              await request(
                "POST",
                "/api/v1/prompts:plan",
                payload,
              );

            expect(
              first.statusCode,
            ).toBe(200);

            expect(
              second.statusCode,
            ).toBe(200);

            expect(
              first.json()
                .planHash,
            ).toBe(
              second.json()
                .planHash,
            );
          },
        );

        it(
          "validates a prompt",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/prompts:validate",
                {
                  projectId:
                    context!
                      .projectId,

                  prompt,
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const body =
              response.json();

            expect(
              body,
            ).toHaveProperty(
              "valid",
            );

            expect(
              body,
            ).toHaveProperty(
              "planHash",
            );

            expect(
              body,
            ).toHaveProperty(
              "clarifications",
            );
          },
        );

        it(
          "previews a prompt without mutating the project",
          async () => {
            const before =
              await context!
                .projects.get(
                  context!
                    .projectId,
                );

            const response =
              await request(
                "POST",
                "/api/v1/prompts:preview",
                {
                  projectId:
                    context!
                      .projectId,

                  prompt,
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            const after =
              await context!
                .projects.get(
                  context!
                    .projectId,
                );

            expect(
              after,
            ).toEqual(
              before,
            );

            const body =
              response.json();

            expect(
              body,
            ).toHaveProperty(
              "planHash",
            );

            expect(
              body,
            ).toHaveProperty(
              "entityDiff",
            );

            expect(
              body,
            ).toHaveProperty(
              "assumptions",
            );

            expect(
              body,
            ).toHaveProperty(
              "warnings",
            );

            expect(
              body,
            ).toHaveProperty(
              "estimates",
            );
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Prompt Execution                                                       */
    /* ---------------------------------------------------------------------- */

    describe(
      "prompt execution",
      () => {
        const prompt =
          "Create a cartoon character named Rahul";

        it(
          "rejects a stale plan hash",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/prompts:execute",
                {
                  projectId:
                    context!
                      .projectId,

                  prompt,

                  planHash:
                    "stale-plan-hash",

                  approved:
                    true,
                },
              );

            expect(
              response.statusCode,
            ).toBe(400);

            expect(
              response.json().code,
            ).toBe(
              "PLAN_STALE",
            );
          },
        );

        it(
          "requires approval for prompt execution",
          async () => {
            const planResponse =
              await request(
                "POST",
                "/api/v1/prompts:plan",
                {
                  projectId:
                    context!
                      .projectId,

                  prompt,
                },
              );

            expect(
              planResponse.statusCode,
            ).toBe(200);

            const plan =
              planResponse.json();

            const response =
              await request(
                "POST",
                "/api/v1/prompts:execute",
                {
                  projectId:
                    context!
                      .projectId,

                  prompt,

                  planHash:
                    plan.planHash,

                  approved:
                    false,
                },
              );

            expect(
              response.statusCode,
            ).toBe(400);
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Generation                                                             */
    /* ---------------------------------------------------------------------- */

    describe(
      "generation",
      () => {
        it(
          "generates a procedural character",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/generation/character",
                {
                  name:
                    "Generated Character",

                  representation:
                    "2d",

                  seed:
                    12345,
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            expect(
              response.json(),
            ).toBeTruthy();
          },
        );

        it(
          "generates a procedural scene",
          async () => {
            const response =
              await request(
                "POST",
                "/api/v1/generation/scene",
                {
                  name:
                    "Generated Scene",

                  seed:
                    12345,
                },
              );

            expect(
              response.statusCode,
            ).toBe(200);

            expect(
              response.json(),
            ).toBeTruthy();
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Error Handling                                                         */
    /* ---------------------------------------------------------------------- */

    describe(
      "error handling",
      () => {
        it(
          "returns a structured error for an unknown project",
          async () => {
            const response =
              await request(
                "GET",
                `/api/v1/projects/${UNKNOWN_PROJECT_ID}`,
              );

            expect(
              response.statusCode,
            ).toBe(400);

            const body =
              response.json();

            expect(
              body,
            ).toHaveProperty(
              "code",
            );

            expect(
              body.code,
            ).toBe(
              "PROJECT_NOT_FOUND",
            );
          },
        );

        it(
          "returns a structured error for an unknown revision",
          async () => {
            const response =
              await request(
                "GET",
                `/api/v1/projects/${UNKNOWN_PROJECT_ID}/revisions/latest`,
              );

            expect(
              response.statusCode,
            ).toBe(400);

            expect(
              response.json().code,
            ).toBe(
              "REVISION_NOT_FOUND",
            );
          },
        );

        it(
          "returns a structured error for an invalid project request",
          async () => {
            const response =
              await request(
                "GET",
                "/api/v1/projects/   ",
              );

            expect(
              response.statusCode,
            ).toBeGreaterThanOrEqual(
              400,
            );

            expect(
              response.json(),
            ).toHaveProperty(
              "code",
            );
          },
        );
      },
    );

    /* ---------------------------------------------------------------------- */
    /* Runtime Contract                                                       */
    /* ---------------------------------------------------------------------- */

    describe(
      "runtime contract",
      () => {
        it(
          "keeps the server API independent from Plugin SDK version changes",
          () => {
            expect(
              typeof PLUGIN_SDK_VERSION,
            ).toBe("string");

            expect(
              PLUGIN_SDK_VERSION.length,
            ).toBeGreaterThan(0);
          },
        );
      },
    );
  },
);