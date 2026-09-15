import { CaeError, type CapabilityDescriptor } from "../../domain/src/index.js";
import {
  validateCommand,
  topologicalOrder,
} from "../../command-validation/src/index.js";
import { ProjectRepository } from "../../project-engine/src/index.js";

type CachedExecutionResult = {
  fingerprint: string;
  result: any;
};

export class CommandExecutor {
  /**
   * Idempotency cache.
   *
   * key:
   *   canonical command idempotencyKey
   *
   * value:
   *   fingerprint of the original command
   *   + complete transaction result
   *
   * Keeping the fingerprint prevents the same idempotency key
   * from being reused for a different command.
   */
  private seen = new Map<
    string,
    CachedExecutionResult
  >();

  constructor(
    private projects: ProjectRepository,
    private capabilities: CapabilityDescriptor[] = [],
  ) {}

  /**
   * Validate a canonical command against a supplied project revision.
   */
  validate(
    input: unknown,
    revisionId: string,
  ) {
    return validateCommand(
      input,
      revisionId,
      this.capabilities,
    );
  }

  /**
   * Execute one or more canonical commands as one atomic transaction.
   *
   * Idempotency rules:
   *
   * 1. No cached keys:
   *      normal validation + execution.
   *
   * 2. All keys cached and fingerprints match:
   *      return the original transaction result.
   *
   * 3. Some keys cached and some uncached:
   *      reject the transaction.
   *
   * 4. A cached key is reused with a different command:
   *      reject the transaction.
   *
   * 5. Duplicate idempotency keys inside one transaction:
   *      reject the transaction.
   */
  async executeMany(
    inputs: unknown[],
    approve = true,
  ) {
    if (!approve) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Explicit approval is required for mutation",
      );
    }

    const commands =
      topologicalOrder(
        inputs as any[],
      );

    if (!commands.length) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Command list is empty",
      );
    }

    /*
     * Every command in a transaction must target the
     * same project.
     */
    const projectId = String(
      (commands[0] as any).projectId,
    );

    if (
      commands.some(
        (command: any) =>
          command.projectId !==
          projectId,
      )
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "All commands in a transaction must target the same project",
      );
    }

    /*
     * Validate the minimum canonical command shape before
     * looking at idempotency state.
     *
     * Full semantic/revision/capability validation happens
     * later for genuinely new transactions.
     */
    const canonicalCommands =
      commands.map(
        (command: unknown) =>
          this.validateShape(
            command,
          ),
      );

    /*
     * A transaction must never contain the same
     * idempotency key more than once.
     */
    const keyOwners =
      new Map<string, number>();

    for (
      let index = 0;
      index <
      canonicalCommands.length;
      index += 1
    ) {
      const command =
        canonicalCommands[index];

      const key =
        command.idempotencyKey;

      if (keyOwners.has(key)) {
        throw new CaeError(
          "COMMAND_INVALID",
          "Duplicate idempotency key in transaction",
          [key],
        );
      }

      keyOwners.set(
        key,
        index,
      );
    }

    /*
     * Calculate deterministic fingerprints before consulting
     * the idempotency cache.
     *
     * The fingerprint intentionally includes the complete
     * canonical command. Therefore reusing a key for a
     * different command is detected.
     */
    const fingerprints =
      canonicalCommands.map(
        (command) =>
          this.commandFingerprint(
            command,
          ),
      );

    /*
     * Check which commands are already cached.
     */
    const cachedEntries =
      canonicalCommands.map(
        (command, index) => {
          const cached =
            this.seen.get(
              command.idempotencyKey,
            );

          return {
            command,
            fingerprint:
              fingerprints[index],
            cached,
          };
        },
      );

    const cachedCount =
      cachedEntries.filter(
        (entry) =>
          entry.cached !==
          undefined,
      ).length;

    /*
     * ---------------------------------------------------------
     * CASE 1
     * Entire transaction is already cached.
     * ---------------------------------------------------------
     */
    if (
      cachedCount ===
      canonicalCommands.length
    ) {
      /*
       * Before returning the cached result, verify that every
       * command is byte-for-byte equivalent at the canonical
       * semantic representation level.
       */
      for (
        const entry of cachedEntries
      ) {
        const cached =
          entry.cached!;

        if (
          cached.fingerprint !==
          entry.fingerprint
        ) {
          throw new CaeError(
            "COMMAND_INVALID",
            "Idempotency key has already been used with a different command",
            [
              entry.command
                .idempotencyKey,
            ],
          );
        }
      }

      /*
       * Every command from one successful transaction points
       * to the same transaction result.
       *
       * Returning the first result preserves object identity
       * for in-process retries and guarantees that replay does
       * not create another revision.
       */
      return cachedEntries[0]
        .cached!.result;
    }

    /*
     * ---------------------------------------------------------
     * CASE 2
     * Partial transaction is cached.
     * ---------------------------------------------------------
     *
     * Executing only the uncached commands would violate
     * transaction semantics and could produce duplicated or
     * incomplete project state.
     */
    if (
      cachedCount > 0
    ) {
      /*
       * Check cached entries first for fingerprint conflicts.
       * A changed command must receive the more specific
       * idempotency conflict error.
       */
      for (
        const entry of cachedEntries
      ) {
        if (
          entry.cached &&
          entry.cached.fingerprint !==
            entry.fingerprint
        ) {
          throw new CaeError(
            "COMMAND_INVALID",
            "Idempotency key has already been used with a different command",
            [
              entry.command
                .idempotencyKey,
            ],
          );
        }
      }

      throw new CaeError(
        "COMMAND_INVALID",
        "Transaction contains a mixture of cached and uncached idempotency keys",
        cachedEntries
          .filter(
            (entry) =>
              entry.cached !==
              undefined,
          )
          .map(
            (entry) =>
              entry.command
                .idempotencyKey,
          ),
      );
    }

    /*
     * ---------------------------------------------------------
     * CASE 3
     * No cached commands.
     *
     * This is a genuinely new transaction.
     * ---------------------------------------------------------
     */
    const current =
      await this.projects.latest(
        projectId,
      );

    /*
     * Full canonical validation is performed against the
     * current project revision.
     */
    const validated =
      canonicalCommands.map(
        (command) =>
          validateCommand(
            command,
            current.revisionId,
            this.capabilities,
          ).command,
      );

    /*
     * Recalculate fingerprints from the validated canonical
     * representation. This protects the cache from accidental
     * differences between the pre-validation object and the
     * actual canonical command.
     */
    const validatedEntries =
      validated.map(
        (command) => ({
          command,
          fingerprint:
            this.commandFingerprint(
              command,
            ),
        }),
      );

    /*
     * Execute the entire transaction through ProjectRepository.
     *
     * If any command throws, ProjectRepository.mutate() does
     * not persist the transaction and the cache is NOT updated.
     */
    const result =
      await this.projects.mutate(
        projectId,
        current.revisionId,
        `Executed ${validated.length} canonical command(s)`,
        (project: any) => {
          let next = project;

          for (
            const entry of
              validatedEntries
          ) {
            next = this.apply(
              next,
              entry.command,
            );
          }

          return next;
        },
        "local",
        "canonical-command-transaction",
      );

    /*
     * Only AFTER successful repository mutation do we populate
     * the idempotency cache.
     *
     * Therefore a failed transaction can never leave behind
     * a false successful idempotency result.
     */
    for (
      const entry of
        validatedEntries
    ) {
      this.seen.set(
        entry.command
          .idempotencyKey,
        {
          fingerprint:
            entry.fingerprint,
          result,
        },
      );
    }

    return result;
  }

  /**
   * Execute a single canonical command.
   */
  async execute(
    input: unknown,
    approve = true,
  ) {
    return this.executeMany(
      [input],
      approve,
    );
  }

  /**
   * Minimal structural validation required before idempotency
   * lookup.
   *
   * Full schema validation remains the responsibility of
   * command-validation/validateCommand().
   */
  private validateShape(
    input: unknown,
  ): Record<
    string,
    any
  > {
    if (
      typeof input !==
        "object" ||
      input === null ||
      Array.isArray(input)
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Canonical command must be an object",
      );
    }

    const command =
      input as Record<
        string,
        any
      >;

    if (
      typeof command.projectId !==
      "string"
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Command projectId is required",
      );
    }

    if (
      typeof command.idempotencyKey !==
        "string" ||
      command.idempotencyKey.length ===
        0
    ) {
      throw new CaeError(
        "COMMAND_INVALID",
        "Command idempotencyKey is required",
      );
    }

    return command;
  }

  /**
   * Create a deterministic fingerprint for a canonical command.
   *
   * Object keys are sorted recursively so that equivalent
   * objects produce the same fingerprint regardless of key
   * insertion order.
   *
   * No crypto hash is required here because the fingerprint is
   * only an in-memory equality token. The canonical serialized
   * representation is sufficient and avoids introducing another
   * runtime dependency into command execution.
   */
  private commandFingerprint(
    command: unknown,
  ): string {
    return JSON.stringify(
      this.sortCanonicalValue(
        command,
      ),
    );
  }

  /**
   * Recursively canonicalize objects before fingerprinting.
   */
  private sortCanonicalValue(
    value: any,
  ): any {
    if (
      value === null ||
      value === undefined
    ) {
      return value;
    }

    if (
      typeof value !==
      "object"
    ) {
      return value;
    }

    if (
      Array.isArray(value)
    ) {
      return value.map(
        (item) =>
          this.sortCanonicalValue(
            item,
          ),
      );
    }

    const output: Record<
      string,
      any
    > = {};

    for (
      const key of Object.keys(
        value,
      ).sort()
    ) {
      output[key] =
        this.sortCanonicalValue(
          value[key],
        );
    }

    return output;
  }

  /**
   * Apply one validated canonical command to the project draft.
   *
   * ProjectRepository owns transaction persistence and revision
   * creation. This method only performs domain mutation.
   */
  private apply(
    p: any,
    c: any,
  ) {
    const byId = (
      id: string,
    ) =>
      p.entities.find(
        (entity: any) =>
          entity.id === id,
      );

    switch (
      c.commandType
    ) {
      case "CREATE_CHARACTER": {
        const name =
          String(
            c.payload.name ??
              "",
          ).trim();

        if (!name) {
          throw new CaeError(
            "COMMAND_INVALID",
            "Character name is required",
          );
        }

        if (
          p.entities.some(
            (entity: any) =>
              entity.type ===
                "character" &&
              entity.name
                .toLowerCase() ===
                name.toLowerCase(),
          )
        ) {
          throw new CaeError(
            "ENTITY_DUPLICATE",
            "Character already exists",
            [name],
          );
        }

        const id =
          c.payload.entityId ??
          crypto.randomUUID();

        p.entities.push({
          id,
          type: "character",
          name,
          aliases:
            c.payload.aliases ??
            [],
          representation:
            c.payload
              .representation ??
            "2d",

          transform: {
            position: {
              x:
                c.payload.x ??
                640,
              y:
                c.payload.y ??
                420,
              z: 0,
            },

            rotation: {
              x: 0,
              y: 0,
              z: 0,
            },

            scale: {
              x: 1,
              y: 1,
              z: 1,
            },
          },

          components: {
            skin:
              c.payload.skin ??
              "#F1C7A8",

            hairColor:
              c.payload
                .hairColor ??
              "#24170F",

            topColor:
              c.payload.topColor ??
              "#3A6EA5",

            character:
              c.payload,
          },
        });

        break;
      }

      case "MODIFY_CHARACTER": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.components = {
          ...entity.components,
          ...c.payload,
        };

        break;
      }

      case "MODIFY_OUTFIT": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.components = {
          ...entity.components,
          ...c.payload,
        };

        break;
      }

      case "APPLY_MAKEUP": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.components = {
          ...entity.components,
          makeup:
            c.payload,
        };

        break;
      }

      case "CREATE_SCENE": {
        const id =
          c.payload.sceneId ??
          crypto.randomUUID();

        p.scenes.push({
          ...c.payload,
          id,
        });

        p.entities.push({
          id,
          type: "scene",

          name:
            c.payload.name ??
            c.payload.template ??
            "Scene",

          aliases: [],

          representation:
            c.payload.type ??
            "2d",

          transform: {
            position: {
              x: 0,
              y: 0,
              z: 0,
            },

            rotation: {
              x: 0,
              y: 0,
              z: 0,
            },

            scale: {
              x: 1,
              y: 1,
              z: 1,
            },
          },

          components:
            c.payload,
        });

        break;
      }

      case "ADD_PROP": {
        const scene =
          p.scenes.find(
            (item: any) =>
              item.id ===
              c.payload.sceneId,
          );

        if (!scene) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Scene not found",
          );
        }

        scene.entities ??=
          [];

        scene.entities.push({
          id:
            c.payload.entityId ??
            crypto.randomUUID(),

          type: "prop",

          name:
            c.payload.name ??
            "Prop",

          representation:
            "2d",

          transform: {
            position: {
              x:
                c.payload.x ??
                0,
              y:
                c.payload.y ??
                0,
              z:
                c.payload.z ??
                0,
            },

            rotation: {
              x: 0,
              y: 0,
              z: 0,
            },

            scale: {
              x: 1,
              y: 1,
              z: 1,
            },
          },

          components:
            c.payload,
        });

        break;
      }

      case "PLACE_CHARACTER": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.transform.position =
          {
            x:
              c.payload.x ??
              640,
            y:
              c.payload.y ??
              420,
            z:
              c.payload.z ??
              0,
          };

        break;
      }

      case "CREATE_EXPRESSION": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.components.expression =
          c.payload.expression ??
          "neutral";

        break;
      }

      case "CREATE_ANIMATION": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.components.motionLayers ??=
          [];

        entity.components.motionLayers.push(
          c.payload.layer,
        );

        break;
      }

      case "CREATE_DIALOGUE": {
        p.settings.dialogueTracks ??=
          [];

        p.settings.dialogueTracks.push(
          c.payload,
        );

        break;
      }

      case "MODIFY_CAMERA": {
        p.settings.camera = {
          ...(p.settings.camera ??
            {}),
          ...c.payload,
        };

        break;
      }

      case "CREATE_CAMERA_SHOT": {
        p.settings.shots ??=
          [];

        p.settings.shots.push(
          c.payload,
        );

        break;
      }

      case "CREATE_LIPSYNC": {
        const entity =
          byId(
            c.targetIds[0],
          );

        if (!entity) {
          throw new CaeError(
            "ENTITY_NOT_FOUND",
            "Character not found",
          );
        }

        entity.components.lipSync =
          c.payload.track;

        break;
      }

      case "CREATE_SEQUENCE": {
        p.sequences.push(
          c.payload,
        );

        break;
      }

      case "CREATE_RENDER": {
        p.settings.renderRequests ??=
          [];

        p.settings.renderRequests.push(
          c.payload,
        );

        break;
      }
    }

    return p;
  }
}