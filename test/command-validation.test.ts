import { describe, expect, it } from "vitest";

import {
  CaeError,
} from "../packages/domain/src/index.js";

import {
  topologicalOrder,
  validateCommand,
} from "../packages/command-validation/src/index.js";

import {
  CanonicalCommand,
} from "../packages/contracts/src/index.js";

const PROJECT_ID =
  "00000000-0000-4000-8000-000000000001";

const REVISION_ID =
  "00000000-0000-4000-8000-000000000002";

const OTHER_REVISION_ID =
  "00000000-0000-4000-8000-000000000003";

const COMMAND_ID =
  "00000000-0000-4000-8000-000000000010";

const COMMAND_ID_2 =
  "00000000-0000-4000-8000-000000000011";

const COMMAND_ID_3 =
  "00000000-0000-4000-8000-000000000012";

const COMMAND_ID_4 =
  "00000000-0000-4000-8000-000000000013";

const REQUIRED_CAPABILITY =
  "render.3d.scene-export";

const FALLBACK_CAPABILITY =
  "render.3d";

function baseCommand(
  overrides: Record<string, unknown> = {},
) {
  return {
    commandId: COMMAND_ID,

    schemaVersion: "1.0.0",

    commandType: "CREATE_SCENE",

    projectId: PROJECT_ID,

    expectedProjectRevisionId:
      REVISION_ID,

    idempotencyKey:
      "test-idempotency-key",

    targetIds: [],

    payload: {},

    dependencies: [],

    preconditions: {},

    authorization: {},

    requiredCapabilities: [],

    provenance: {},

    expectedEffects: [],

    undoMetadata: {},

    ...overrides,
  };
}

function capabilityRequirement(
  id: string,
  level:
    | "required"
    | "preferred" = "required",
  fallbacks?: string[],
) {
  return {
    id,
    level,
    ...(fallbacks === undefined
      ? {}
      : { fallbacks }),
  };
}

function inventory(
  capabilities: Record<
    string,
    "supported" |
    "unsupported" |
    "experimental"
  >,
) {
  return [
    {
      adapterId: "test-adapter",
      adapterVersion: "1.0.0",
      contractVersion: "1.0.0",
      capabilities,
    },
  ];
}

function command(
  commandId: string,
  dependencies: string[] = [],
) {
  return {
    commandId,
    dependencies,
  };
}

describe("command-validation", () => {
  describe("validateCommand", () => {
    it("validates a complete canonical command", () => {
      const input = baseCommand();

      const result = validateCommand(
        input,
        REVISION_ID,
        [],
      );

      expect(result.valid).toBe(true);

      expect(result.command).toEqual(
        CanonicalCommand.parse(input),
      );
    });

    it("preserves the canonical command fields", () => {
      const input = baseCommand();

      const result = validateCommand(
        input,
        REVISION_ID,
        [],
      );

      expect(
        result.command.commandId,
      ).toBe(COMMAND_ID);

      expect(
        result.command.schemaVersion,
      ).toBe("1.0.0");

      expect(
        result.command.commandType,
      ).toBe("CREATE_SCENE");

      expect(
        result.command.projectId,
      ).toBe(PROJECT_ID);

      expect(
        result.command.expectedProjectRevisionId,
      ).toBe(REVISION_ID);

      expect(
        result.command.idempotencyKey,
      ).toBe("test-idempotency-key");
    });

    it("returns successful capability negotiation", () => {
      const result = validateCommand(
        baseCommand(),
        REVISION_ID,
        [],
      );

      expect(
        result.capabilities,
      ).toBeDefined();

      expect(
        result.capabilities.valid,
      ).toBe(true);
    });

    it("accepts a command with no capability requirements", () => {
      const result = validateCommand(
        baseCommand({
          requiredCapabilities: [],
        }),
        REVISION_ID,
        [],
      );

      expect(result.valid).toBe(true);
      expect(
        result.capabilities.valid,
      ).toBe(true);
    });

    it("accepts all supported canonical command types", () => {
      const commandTypes = [
        "CREATE_CHARACTER",
        "MODIFY_CHARACTER",
        "MODIFY_OUTFIT",
        "APPLY_MAKEUP",
        "CREATE_SCENE",
        "ADD_PROP",
        "PLACE_CHARACTER",
        "CREATE_EXPRESSION",
        "CREATE_ANIMATION",
        "CREATE_DIALOGUE",
        "MODIFY_CAMERA",
        "CREATE_CAMERA_SHOT",
        "CREATE_LIPSYNC",
        "CREATE_SEQUENCE",
        "CREATE_RENDER",
      ] as const;

      for (const commandType of commandTypes) {
        const result = validateCommand(
          baseCommand({
            commandType,
          }),
          REVISION_ID,
          [],
        );

        expect(result.valid).toBe(true);
        expect(
          result.command.commandType,
        ).toBe(commandType);
      }
    });

    it("rejects an unknown command type", () => {
      expect(() =>
        validateCommand(
          baseCommand({
            commandType: "UNKNOWN_COMMAND",
          }),
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects a malformed command", () => {
      expect(() =>
        validateCommand(
          {
            commandId: "invalid",
          },
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects null input", () => {
      expect(() =>
        validateCommand(
          null,
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects undefined input", () => {
      expect(() =>
        validateCommand(
          undefined,
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects an invalid command id", () => {
      expect(() =>
        validateCommand(
          baseCommand({
            commandId: "not-a-uuid",
          }),
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects an invalid project id", () => {
      expect(() =>
        validateCommand(
          baseCommand({
            projectId: "not-a-uuid",
          }),
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects an invalid expected revision id", () => {
      expect(() =>
        validateCommand(
          baseCommand({
            expectedProjectRevisionId:
              "not-a-uuid",
          }),
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects an empty idempotency key", () => {
      expect(() =>
        validateCommand(
          baseCommand({
            idempotencyKey: "",
          }),
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects a missing schema version", () => {
      const input =
        baseCommand();

      delete (
        input as Record<string, unknown>
      ).schemaVersion;

      expect(() =>
        validateCommand(
          input,
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });

    it("rejects a stale project revision", () => {
      const input =
        baseCommand();

      expect(() =>
        validateCommand(
          input,
          OTHER_REVISION_ID,
          [],
        ),
      ).toThrow(CaeError);
    });

    it("reports REVISION_CONFLICT for a stale revision", () => {
      try {
        validateCommand(
          baseCommand(),
          OTHER_REVISION_ID,
          [],
        );

        throw new Error(
          "Expected revision conflict",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(
          CaeError,
        );

        expect(
          (error as CaeError).code,
        ).toBe("REVISION_CONFLICT");
      }
    });

    it("includes the current revision in revision conflict details", () => {
      try {
        validateCommand(
          baseCommand(),
          OTHER_REVISION_ID,
          [],
        );

        throw new Error(
          "Expected revision conflict",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(
          CaeError,
        );

        expect(
          (error as CaeError).details,
        ).toContain(
          OTHER_REVISION_ID,
        );
      }
    });

    it("checks revision before capability negotiation", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
          ),
        ],
      });

      expect(() =>
        validateCommand(
          input,
          OTHER_REVISION_ID,
          [],
        ),
      ).toThrowError(
        "Expected revision does not match current revision",
      );
    });

    it("accepts a required supported capability", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
          ),
        ],
      });

      const result = validateCommand(
        input,
        REVISION_ID,
        inventory({
          [REQUIRED_CAPABILITY]:
            "supported",
        }),
      );

      expect(result.valid).toBe(true);
      expect(
        result.capabilities.valid,
      ).toBe(true);

      expect(
        result.capabilities.selected,
      ).toContain(
        REQUIRED_CAPABILITY,
      );
    });

    it("rejects an unavailable required capability", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
          ),
        ],
      });

      expect(() =>
        validateCommand(
          input,
          REVISION_ID,
          [],
        ),
      ).toThrow(CaeError);
    });

    it("reports CAPABILITY_UNAVAILABLE for a missing required capability", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
          ),
        ],
      });

      try {
        validateCommand(
          input,
          REVISION_ID,
          [],
        );

        throw new Error(
          "Expected capability failure",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(
          CaeError,
        );

        expect(
          (error as CaeError).code,
        ).toBe(
          "CAPABILITY_UNAVAILABLE",
        );
      }
    });

    it("includes the missing required capability in the error details", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
          ),
        ],
      });

      try {
        validateCommand(
          input,
          REVISION_ID,
          [],
        );

        throw new Error(
          "Expected capability failure",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(
          CaeError,
        );

        expect(
          (error as CaeError).details,
        ).toContain(
          REQUIRED_CAPABILITY,
        );
      }
    });

    it("accepts an experimental capability only when it is not required as supported", () => {
      const input = baseCommand({
        requiredCapabilities: [],
      });

      const result = validateCommand(
        input,
        REVISION_ID,
        inventory({
          [REQUIRED_CAPABILITY]:
            "experimental",
        }),
      );

      expect(result.valid).toBe(true);
    });

    it("does not treat unsupported capabilities as supported", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
          ),
        ],
      });

      expect(() =>
        validateCommand(
          input,
          REVISION_ID,
          inventory({
            [REQUIRED_CAPABILITY]:
              "unsupported",
          }),
        ),
      ).toThrow(
        CaeError,
      );
    });

    it("supports a preferred capability with a supported fallback", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
            "preferred",
            [FALLBACK_CAPABILITY],
          ),
        ],
      });

      const result = validateCommand(
        input,
        REVISION_ID,
        inventory({
          [FALLBACK_CAPABILITY]:
            "supported",
        }),
      );

      expect(result.valid).toBe(true);

      expect(
        result.capabilities.fallbacks[
          REQUIRED_CAPABILITY
        ],
      ).toBe(FALLBACK_CAPABILITY);
    });

    it("does not use a fallback for a required capability", () => {
      const input = baseCommand({
        requiredCapabilities: [
          capabilityRequirement(
            REQUIRED_CAPABILITY,
            "required",
            [FALLBACK_CAPABILITY],
          ),
        ],
      });

      expect(() =>
        validateCommand(
          input,
          REVISION_ID,
          inventory({
            [FALLBACK_CAPABILITY]:
              "supported",
          }),
        ),
      ).toThrow(CaeError);
    });

    it("rejects malformed capability requirements", () => {
      const input = baseCommand({
        requiredCapabilities: [
          "invalid-capability",
        ],
      });

      expect(() =>
        validateCommand(
          input,
          REVISION_ID,
          [],
        ),
      ).toThrow();
    });
  });

  describe("topologicalOrder", () => {
    it("returns an empty array for empty input", () => {
      expect(
        topologicalOrder([]),
      ).toEqual([]);
    });

    it("returns a command with no dependencies", () => {
      const a =
        command(COMMAND_ID);

      expect(
        topologicalOrder([a]),
      ).toEqual([a]);
    });

    it("preserves the command object", () => {
      const a =
        command(COMMAND_ID);

      const result =
        topologicalOrder([a]);

      expect(result[0]).toBe(a);
    });

    it("orders a dependency before its dependent", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      const result =
        topologicalOrder([
          b,
          a,
        ]);

      expect(
        result.map(
          (item) => item.commandId,
        ),
      ).toEqual([
        COMMAND_ID,
        COMMAND_ID_2,
      ]);
    });

    it("orders a multi-level dependency chain", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      const c =
        command(
          COMMAND_ID_3,
          [COMMAND_ID_2],
        );

      const result =
        topologicalOrder([
          c,
          b,
          a,
        ]);

      expect(
        result.map(
          (item) => item.commandId,
        ),
      ).toEqual([
        COMMAND_ID,
        COMMAND_ID_2,
        COMMAND_ID_3,
      ]);
    });

    it("handles multiple dependencies", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(COMMAND_ID_2);

      const c =
        command(
          COMMAND_ID_3,
          [
            COMMAND_ID,
            COMMAND_ID_2,
          ],
        );

      const result =
        topologicalOrder([
          c,
          b,
          a,
        ]);

      const ids =
        result.map(
          (item) => item.commandId,
        );

      expect(
        ids.indexOf(COMMAND_ID),
      ).toBeLessThan(
        ids.indexOf(COMMAND_ID_3),
      );

      expect(
        ids.indexOf(COMMAND_ID_2),
      ).toBeLessThan(
        ids.indexOf(COMMAND_ID_3),
      );
    });

    it("handles a diamond dependency graph", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      const c =
        command(
          COMMAND_ID_3,
          [COMMAND_ID],
        );

      const d =
        command(
          COMMAND_ID_4,
          [
            COMMAND_ID_2,
            COMMAND_ID_3,
          ],
        );

      const result =
        topologicalOrder([
          d,
          c,
          b,
          a,
        ]);

      const ids =
        result.map(
          (item) => item.commandId,
        );

      expect(ids[0]).toBe(
        COMMAND_ID,
      );

      expect(
        ids.indexOf(COMMAND_ID_2),
      ).toBeLessThan(
        ids.indexOf(COMMAND_ID_4),
      );

      expect(
        ids.indexOf(COMMAND_ID_3),
      ).toBeLessThan(
        ids.indexOf(COMMAND_ID_4),
      );
    });

    it("preserves input order among independently ready commands", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(COMMAND_ID_2);

      const c =
        command(COMMAND_ID_3);

      const result =
        topologicalOrder([
          c,
          a,
          b,
        ]);

      expect(
        result.map(
          (item) => item.commandId,
        ),
      ).toEqual([
        COMMAND_ID_3,
        COMMAND_ID,
        COMMAND_ID_2,
      ]);
    });

    it("supports duplicate dependency references", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(
          COMMAND_ID_2,
          [
            COMMAND_ID,
            COMMAND_ID,
          ],
        );

      const result =
        topologicalOrder([
          b,
          a,
        ]);

      expect(
        result.map(
          (item) => item.commandId,
        ),
      ).toEqual([
        COMMAND_ID,
        COMMAND_ID_2,
      ]);
    });

    it("allows a dependency reference that is not present in the pending map", () => {
      const missingDependency =
        "00000000-0000-4000-8000-000000000099";

      const a =
        command(
          COMMAND_ID,
          [missingDependency],
        );

      const result =
        topologicalOrder([a]);

      /*
       * This reflects the CURRENT implementation:
       *
       * c.dependencies.every(d => !pending.has(d))
       *
       * A missing dependency therefore does not block
       * the command.
       */
      expect(result).toEqual([a]);
    });

    it("rejects a direct self-cycle", () => {
      const a =
        command(
          COMMAND_ID,
          [COMMAND_ID],
        );

      expect(() =>
        topologicalOrder([a]),
      ).toThrow(CaeError);
    });

    it("rejects a two-command cycle", () => {
      const a =
        command(
          COMMAND_ID,
          [COMMAND_ID_2],
        );

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      expect(() =>
        topologicalOrder([
          a,
          b,
        ]),
      ).toThrow(CaeError);
    });

    it("rejects a longer cycle", () => {
      const a =
        command(
          COMMAND_ID,
          [COMMAND_ID_2],
        );

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID_3],
        );

      const c =
        command(
          COMMAND_ID_3,
          [COMMAND_ID],
        );

      expect(() =>
        topologicalOrder([
          a,
          b,
          c,
        ]),
      ).toThrow(CaeError);
    });

    it("reports COMMAND_INVALID for a cycle", () => {
      const a =
        command(
          COMMAND_ID,
          [COMMAND_ID_2],
        );

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      try {
        topologicalOrder([
          a,
          b,
        ]);

        throw new Error(
          "Expected cycle validation failure",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(
          CaeError,
        );

        expect(
          (error as CaeError).code,
        ).toBe("COMMAND_INVALID");
      }
    });

    it("does not mutate the input array", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      const input = [b, a];
      const original = [...input];

      topologicalOrder(input);

      expect(input).toEqual(
        original,
      );
    });

    it("returns every command exactly once for a valid graph", () => {
      const a =
        command(COMMAND_ID);

      const b =
        command(
          COMMAND_ID_2,
          [COMMAND_ID],
        );

      const c =
        command(
          COMMAND_ID_3,
          [COMMAND_ID],
        );

      const result =
        topologicalOrder([
          c,
          b,
          a,
        ]);

      expect(result).toHaveLength(3);

      expect(
        new Set(
          result.map(
            (item) => item.commandId,
          ),
        ).size,
      ).toBe(3);
    });
  });
});