import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CaeError } from "../packages/domain/src/index.js";
import { ProjectRepository } from "../packages/project-engine/src/index.js";
import { CommandExecutor } from "../packages/command-execution/src/index.js";

const CHARACTER_ID =
  "00000000-0000-4000-8000-000000000101";

const CHARACTER_ID_2 =
  "00000000-0000-4000-8000-000000000102";

const SCENE_ID =
  "00000000-0000-4000-8000-000000000201";

const PROP_ID =
  "00000000-0000-4000-8000-000000000301";

const COMMAND_ID =
  "00000000-0000-4000-8000-000000000401";

const COMMAND_ID_2 =
  "00000000-0000-4000-8000-000000000402";

const COMMAND_ID_3 =
  "00000000-0000-4000-8000-000000000403";

function makeCommand(
  projectId: string,
  revisionId: string,
  commandType:
    | "CREATE_CHARACTER"
    | "MODIFY_CHARACTER"
    | "MODIFY_OUTFIT"
    | "APPLY_MAKEUP"
    | "CREATE_SCENE"
    | "ADD_PROP"
    | "PLACE_CHARACTER"
    | "CREATE_EXPRESSION"
    | "CREATE_ANIMATION"
    | "CREATE_DIALOGUE"
    | "MODIFY_CAMERA"
    | "CREATE_CAMERA_SHOT"
    | "CREATE_LIPSYNC"
    | "CREATE_SEQUENCE"
    | "CREATE_RENDER",
  overrides: Record<string, unknown> = {},
) {
  return {
    commandId: COMMAND_ID,
    schemaVersion: "1.0.0",
    commandType,
    projectId,
    expectedProjectRevisionId: revisionId,
    idempotencyKey: `idempotency-${COMMAND_ID}`,
    targetIds: [],
    payload: {},
    dependencies: [],
    preconditions: {},
    seed: 1,
    authorization: {},
    requiredCapabilities: [],
    provenance: {},
    expectedEffects: [],
    undoMetadata: {},
    ...overrides,
  };
}

describe("command-execution", () => {
  let root: string;
  let repository: ProjectRepository;
  let executor: CommandExecutor;

  let projectId: string;
  let revisionId: string;

  beforeEach(async () => {
    root = await mkdtemp(
      join(tmpdir(), "cartoon-animation-engine-"),
    );

    repository = new ProjectRepository(root);

    const created = await repository.create(
      "Command Execution Test Project",
      "test",
    );

    projectId = created.project.projectId;
    revisionId = created.revision.revisionId;

    executor = new CommandExecutor(
      repository,
      [],
    );
  });

  afterEach(async () => {
    await rm(root, {
      recursive: true,
      force: true,
    });
  });

  describe("validate()", () => {
    it("validates a canonical command against the supplied revision", () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      const result = executor.validate(
        input,
        revisionId,
      );

      expect(result.valid).toBe(true);
      expect(result.command.commandType).toBe(
        "CREATE_CHARACTER",
      );
    });

    it("rejects a stale revision", () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
      );

      expect(() =>
        executor.validate(
          input,
          "00000000-0000-4000-8000-000000000999",
        ),
      ).toThrow(CaeError);
    });

    it("rejects malformed commands", () => {
      expect(() =>
        executor.validate(
          {
            commandType: "CREATE_CHARACTER",
          },
          revisionId,
        ),
      ).toThrow();
    });
  });

  describe("approval", () => {
    it("requires explicit approval for execute", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
      );

      await expect(
        executor.execute(input, false),
      ).rejects.toThrow(CaeError);
    });

    it("requires explicit approval for executeMany", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
      );

      await expect(
        executor.executeMany([input], false),
      ).rejects.toThrow(
        "Explicit approval is required for mutation",
      );
    });
  });

  describe("execute()", () => {
    it("executes a CREATE_CHARACTER command", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      const result = await executor.execute(input);

      expect(result.project.entities).toHaveLength(1);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(character).toBeDefined();
      expect(character.type).toBe(
        "character",
      );
      expect(character.name).toBe("Ravi");
    });

    it("creates a new revision", async () => {
      const before =
        await repository.latest(projectId);

      const input = makeCommand(
        projectId,
        before.revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.revision.revisionId,
      ).not.toBe(before.revisionId);

      expect(
        result.revision.number,
      ).toBe(before.number + 1);

      expect(
        result.revision.parentRevisionId,
      ).toBe(before.revisionId);
    });

    it("persists the mutation", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      await executor.execute(input);

      const latest =
        await repository.latest(projectId);

      const project =
        await repository.get(projectId);

      expect(
        latest.revisionId,
      ).toBeDefined();

      expect(
        project.entities.some(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        ),
      ).toBe(true);
    });

    it("rejects a character with an empty name", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "   ",
            entityId: CHARACTER_ID,
          },
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character name is required",
      );
    });

    it("rejects duplicate character names case-insensitively", async () => {
      const first = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      const firstResult =
        await executor.execute(first);

      const second = makeCommand(
        projectId,
        firstResult.revision.revisionId,
        "CREATE_CHARACTER",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "idempotency-duplicate",
          payload: {
            name: "rAvI",
            entityId: CHARACTER_ID_2,
          },
        },
      );

      await expect(
        executor.execute(second),
      ).rejects.toThrow(
        "Character already exists",
      );
    });

    it("uses supplied character defaults", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.transform.position,
      ).toEqual({
        x: 640,
        y: 420,
        z: 0,
      });

      expect(
        character.transform.scale,
      ).toEqual({
        x: 1,
        y: 1,
        z: 1,
      });

      expect(
        character.components.skin,
      ).toBe("#F1C7A8");

      expect(
        character.components.hairColor,
      ).toBe("#24170F");

      expect(
        character.components.topColor,
      ).toBe("#3A6EA5");
    });

    it("uses supplied character properties", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
            representation: "3d",
            x: 100,
            y: 200,
            skin: "#AA8844",
            hairColor: "#111111",
            topColor: "#222222",
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.representation,
      ).toBe("3d");

      expect(
        character.transform.position,
      ).toEqual({
        x: 100,
        y: 200,
        z: 0,
      });

      expect(
        character.components.skin,
      ).toBe("#AA8844");

      expect(
        character.components.hairColor,
      ).toBe("#111111");

      expect(
        character.components.topColor,
      ).toBe("#222222");
    });
  });

  describe("character modification commands", () => {
    async function createCharacter() {
      return executor.execute(
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            payload: {
              name: "Ravi",
              entityId: CHARACTER_ID,
            },
          },
        ),
      );
    }

    it("executes MODIFY_CHARACTER", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "MODIFY_CHARACTER",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "modify-character",
          targetIds: [CHARACTER_ID],
          payload: {
            skin: "#123456",
            height: 180,
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.skin,
      ).toBe("#123456");

      expect(
        character.components.height,
      ).toBe(180);
    });

    it("executes MODIFY_OUTFIT", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "MODIFY_OUTFIT",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "modify-outfit",
          targetIds: [CHARACTER_ID],
          payload: {
            shirt: "blue",
            pants: "black",
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.shirt,
      ).toBe("blue");

      expect(
        character.components.pants,
      ).toBe("black");
    });

    it("executes APPLY_MAKEUP", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "APPLY_MAKEUP",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "apply-makeup",
          targetIds: [CHARACTER_ID],
          payload: {
            lipstick: "#FF0000",
            blush: 0.4,
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.makeup,
      ).toEqual({
        lipstick: "#FF0000",
        blush: 0.4,
      });
    });

    it("rejects MODIFY_CHARACTER for a missing entity", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "MODIFY_CHARACTER",
        {
          targetIds: [
            CHARACTER_ID,
          ],
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });

    it("rejects MODIFY_OUTFIT for a missing entity", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "MODIFY_OUTFIT",
        {
          targetIds: [
            CHARACTER_ID,
          ],
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });

    it("rejects APPLY_MAKEUP for a missing entity", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "APPLY_MAKEUP",
        {
          targetIds: [
            CHARACTER_ID,
          ],
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });
  });

  describe("scene and prop commands", () => {
    it("executes CREATE_SCENE", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_SCENE",
        {
          payload: {
            sceneId: SCENE_ID,
            name: "Classroom",
            template: "classroom",
            type: "2d",
          },
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.project.scenes,
      ).toHaveLength(1);

      expect(
        result.project.scenes[0].id,
      ).toBe(SCENE_ID);

      expect(
        result.project.entities.some(
          (entity: any) =>
            entity.id === SCENE_ID &&
            entity.type === "scene",
        ),
      ).toBe(true);
    });

    it("uses template as scene name when name is absent", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_SCENE",
        {
          payload: {
            sceneId: SCENE_ID,
            template: "classroom",
          },
        },
      );

      const result =
        await executor.execute(input);

      const sceneEntity =
        result.project.entities.find(
          (entity: any) =>
            entity.id === SCENE_ID,
        );

      expect(
        sceneEntity.name,
      ).toBe("classroom");
    });

    it("defaults scene name to Scene", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_SCENE",
        {
          payload: {
            sceneId: SCENE_ID,
          },
        },
      );

      const result =
        await executor.execute(input);

      const sceneEntity =
        result.project.entities.find(
          (entity: any) =>
            entity.id === SCENE_ID,
        );

      expect(
        sceneEntity.name,
      ).toBe("Scene");
    });

    it("executes ADD_PROP", async () => {
      const sceneCommand =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_SCENE",
          {
            payload: {
              sceneId: SCENE_ID,
              name: "Classroom",
            },
          },
        );

      const sceneResult =
        await executor.execute(
          sceneCommand,
        );

      const propCommand =
        makeCommand(
          projectId,
          sceneResult.revision.revisionId,
          "ADD_PROP",
          {
            commandId: COMMAND_ID_2,
            idempotencyKey:
              "add-prop",
            payload: {
              sceneId: SCENE_ID,
              entityId: PROP_ID,
              name: "Desk",
              x: 100,
              y: 200,
              z: 10,
            },
          },
        );

      const result =
        await executor.execute(
          propCommand,
        );

      const scene =
        result.project.scenes.find(
          (item: any) =>
            item.id === SCENE_ID,
        );

      expect(scene).toBeDefined();
      expect(
        scene.entities,
      ).toHaveLength(1);

      expect(
        scene.entities[0],
      ).toMatchObject({
        id: PROP_ID,
        type: "prop",
        name: "Desk",
      });
    });

    it("rejects ADD_PROP when scene does not exist", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "ADD_PROP",
        {
          payload: {
            sceneId: SCENE_ID,
            entityId: PROP_ID,
            name: "Desk",
          },
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Scene not found",
      );
    });
  });

  describe("character placement and animation", () => {
    async function createCharacter() {
      return executor.execute(
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            payload: {
              name: "Ravi",
              entityId: CHARACTER_ID,
            },
          },
        ),
      );
    }

    it("executes PLACE_CHARACTER", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "PLACE_CHARACTER",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "place-character",
          targetIds: [CHARACTER_ID],
          payload: {
            x: 900,
            y: 500,
            z: 25,
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.transform.position,
      ).toEqual({
        x: 900,
        y: 500,
        z: 25,
      });
    });

    it("uses default position values in PLACE_CHARACTER", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "PLACE_CHARACTER",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "place-character-default",
          targetIds: [CHARACTER_ID],
          payload: {},
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.transform.position,
      ).toEqual({
        x: 640,
        y: 420,
        z: 0,
      });
    });

    it("executes CREATE_EXPRESSION", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "CREATE_EXPRESSION",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "create-expression",
          targetIds: [CHARACTER_ID],
          payload: {
            expression: "happy",
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.expression,
      ).toBe("happy");
    });

    it("defaults CREATE_EXPRESSION to neutral", async () => {
      const created =
        await createCharacter();

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "CREATE_EXPRESSION",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "create-expression-default",
          targetIds: [CHARACTER_ID],
          payload: {},
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.expression,
      ).toBe("neutral");
    });

    it("executes CREATE_ANIMATION", async () => {
      const created =
        await createCharacter();

      const layer = {
        id: "test-layer",
        clipId: "test-clip",
        weight: 1,
      };

      const input = makeCommand(
        projectId,
        created.revision.revisionId,
        "CREATE_ANIMATION",
        {
          commandId: COMMAND_ID_2,
          idempotencyKey:
            "create-animation",
          targetIds: [CHARACTER_ID],
          payload: {
            layer,
          },
        },
      );

      const result =
        await executor.execute(input);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.motionLayers,
      ).toEqual([layer]);
    });

    it("appends multiple animation layers", async () => {
      const created =
        await createCharacter();

      const firstLayer = {
        id: "layer-1",
        clipId: "clip-1",
      };

      const first =
        await executor.execute(
          makeCommand(
            projectId,
            created.revision.revisionId,
            "CREATE_ANIMATION",
            {
              commandId: COMMAND_ID_2,
              idempotencyKey:
                "animation-1",
              targetIds: [CHARACTER_ID],
              payload: {
                layer: firstLayer,
              },
            },
          ),
        );

      const secondLayer = {
        id: "layer-2",
        clipId: "clip-2",
      };

      const result =
        await executor.execute(
          makeCommand(
            projectId,
            first.revision.revisionId,
            "CREATE_ANIMATION",
            {
              commandId: COMMAND_ID_3,
              idempotencyKey:
                "animation-2",
              targetIds: [CHARACTER_ID],
              payload: {
                layer: secondLayer,
              },
            },
          ),
        );

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.motionLayers,
      ).toEqual([
        firstLayer,
        secondLayer,
      ]);
    });
  });

  describe("dialogue, camera, lip-sync and render commands", () => {
    it("executes CREATE_DIALOGUE", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_DIALOGUE",
        {
          payload: {
            speakerId: CHARACTER_ID,
            text: "Hello",
            startTick: 0,
          },
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.project.settings.dialogueTracks,
      ).toEqual([
        {
          speakerId: CHARACTER_ID,
          text: "Hello",
          startTick: 0,
        },
      ]);
    });

    it("appends multiple dialogue tracks", async () => {
      const first =
        await executor.execute(
          makeCommand(
            projectId,
            revisionId,
            "CREATE_DIALOGUE",
            {
              payload: {
                text: "Hello",
              },
            },
          ),
        );

      const second =
        await executor.execute(
          makeCommand(
            projectId,
            first.revision.revisionId,
            "CREATE_DIALOGUE",
            {
              commandId: COMMAND_ID_2,
              idempotencyKey:
                "dialogue-2",
              payload: {
                text: "Welcome",
              },
            },
          ),
        );

      expect(
        second.project.settings.dialogueTracks,
      ).toHaveLength(2);
    });

    it("executes MODIFY_CAMERA", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "MODIFY_CAMERA",
        {
          payload: {
            x: 100,
            y: 200,
            zoom: 1.5,
          },
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.project.settings.camera,
      ).toEqual({
        x: 100,
        y: 200,
        zoom: 1.5,
      });
    });

    it("merges MODIFY_CAMERA into existing camera settings", async () => {
      const first =
        await executor.execute(
          makeCommand(
            projectId,
            revisionId,
            "MODIFY_CAMERA",
            {
              payload: {
                x: 100,
                zoom: 1,
              },
            },
          ),
        );

      const second =
        await executor.execute(
          makeCommand(
            projectId,
            first.revision.revisionId,
            "MODIFY_CAMERA",
            {
              commandId: COMMAND_ID_2,
              idempotencyKey:
                "camera-2",
              payload: {
                zoom: 2,
              },
            },
          ),
        );

      expect(
        second.project.settings.camera,
      ).toEqual({
        x: 100,
        zoom: 2,
      });
    });

    it("executes CREATE_CAMERA_SHOT", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CAMERA_SHOT",
        {
          payload: {
            id: "shot-1",
            durationTicks: 48000,
          },
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.project.settings.shots,
      ).toEqual([
        {
          id: "shot-1",
          durationTicks: 48000,
        },
      ]);
    });

    it("executes CREATE_LIPSYNC", async () => {
      const character =
        await executor.execute(
          makeCommand(
            projectId,
            revisionId,
            "CREATE_CHARACTER",
            {
              payload: {
                name: "Ravi",
                entityId: CHARACTER_ID,
              },
            },
          ),
        );

      const track = {
        phonemes: [
          {
            startTick: 0,
            endTick: 1000,
            phoneme: "AA",
          },
        ],
      };

      const result =
        await executor.execute(
          makeCommand(
            projectId,
            character.revision.revisionId,
            "CREATE_LIPSYNC",
            {
              commandId: COMMAND_ID_2,
              idempotencyKey:
                "lipsync-1",
              targetIds: [
                CHARACTER_ID,
              ],
              payload: {
                track,
              },
            },
          ),
        );

      const entity =
        result.project.entities.find(
          (item: any) =>
            item.id === CHARACTER_ID,
        );

      expect(
        entity.components.lipSync,
      ).toEqual(track);
    });

    it("executes CREATE_RENDER", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_RENDER",
        {
          payload: {
            width: 1280,
            height: 720,
            format: "mp4",
          },
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.project.settings.renderRequests,
      ).toEqual([
        {
          width: 1280,
          height: 720,
          format: "mp4",
        },
      ]);
    });
  });

  describe("sequence command", () => {
    it("executes CREATE_SEQUENCE", async () => {
      const sequence = {
        id: "sequence-1",
        name: "Opening",
        shots: [],
      };

      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_SEQUENCE",
        {
          payload: sequence,
        },
      );

      const result =
        await executor.execute(input);

      expect(
        result.project.sequences,
      ).toEqual([sequence]);
    });

    it("appends multiple sequences", async () => {
      const first =
        await executor.execute(
          makeCommand(
            projectId,
            revisionId,
            "CREATE_SEQUENCE",
            {
              payload: {
                id: "sequence-1",
              },
            },
          ),
        );

      const second =
        await executor.execute(
          makeCommand(
            projectId,
            first.revision.revisionId,
            "CREATE_SEQUENCE",
            {
              commandId: COMMAND_ID_2,
              idempotencyKey:
                "sequence-2",
              payload: {
                id: "sequence-2",
              },
            },
          ),
        );

      expect(
        second.project.sequences,
      ).toHaveLength(2);
    });
  });

  describe("missing target entities", () => {
    it("rejects PLACE_CHARACTER when target is missing", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "PLACE_CHARACTER",
        {
          targetIds: [
            CHARACTER_ID,
          ],
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });

    it("rejects CREATE_EXPRESSION when target is missing", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_EXPRESSION",
        {
          targetIds: [
            CHARACTER_ID,
          ],
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });

    it("rejects CREATE_ANIMATION when target is missing", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_ANIMATION",
        {
          targetIds: [
            CHARACTER_ID,
          ],
          payload: {
            layer: {},
          },
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });

    it("rejects CREATE_LIPSYNC when target is missing", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_LIPSYNC",
        {
          targetIds: [
            CHARACTER_ID,
          ],
          payload: {
            track: {},
          },
        },
      );

      await expect(
        executor.execute(input),
      ).rejects.toThrow(
        "Character not found",
      );
    });
  });

  describe("executeMany()", () => {
    it("rejects an empty command list", async () => {
      await expect(
        executor.executeMany([]),
      ).rejects.toThrow(
        "Command list is empty",
      );
    });

    it("rejects commands targeting different projects", async () => {
      const otherRoot =
        await mkdtemp(
          join(
            tmpdir(),
            "cartoon-animation-engine-other-",
          ),
        );

      try {
        const otherRepository =
          new ProjectRepository(
            otherRoot,
          );

        const other =
          await otherRepository.create(
            "Other Project",
          );

        const first =
          makeCommand(
            projectId,
            revisionId,
            "CREATE_CHARACTER",
            {
              payload: {
                name: "Ravi",
                entityId: CHARACTER_ID,
              },
            },
          );

        const second =
          makeCommand(
            other.project.projectId,
            other.revision.revisionId,
            "CREATE_CHARACTER",
            {
              commandId:
                COMMAND_ID_2,
              idempotencyKey:
                "other-project",
              payload: {
                name: "Amit",
                entityId:
                  CHARACTER_ID_2,
              },
            },
          );

        await expect(
          executor.executeMany([
            first,
            second,
          ]),
        ).rejects.toThrow(
          "All commands in a transaction must target the same project",
        );
      } finally {
        await rm(
          otherRoot,
          {
            recursive: true,
            force: true,
          },
        );
      }
    });

    it("executes multiple commands as one revision", async () => {
      const first =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            commandId:
              COMMAND_ID,
            idempotencyKey:
              "transaction-character",
            payload: {
              name: "Ravi",
              entityId: CHARACTER_ID,
            },
          },
        );

      const second =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_SCENE",
          {
            commandId:
              COMMAND_ID_2,
            idempotencyKey:
              "transaction-scene",
            payload: {
              sceneId: SCENE_ID,
              name: "Classroom",
            },
          },
        );

      const result =
        await executor.executeMany([
          second,
          first,
        ]);

      expect(
        result.project.entities,
      ).toHaveLength(2);

      expect(
        result.project.scenes,
      ).toHaveLength(1);

      expect(
        result.revision.number,
      ).toBe(1);
    });

    it("respects dependency ordering", async () => {
      const createCharacter =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            commandId:
              COMMAND_ID,
            idempotencyKey:
              "dependency-character",
            payload: {
              name: "Ravi",
              entityId: CHARACTER_ID,
            },
          },
        );

      const modifyCharacter =
        makeCommand(
          projectId,
          revisionId,
          "MODIFY_CHARACTER",
          {
            commandId:
              COMMAND_ID_2,
            idempotencyKey:
              "dependency-modify",
            targetIds: [
              CHARACTER_ID,
            ],
            dependencies: [
              COMMAND_ID,
            ],
            payload: {
              skin: "#ABCDEF",
            },
          },
        );

      const result =
        await executor.executeMany([
          modifyCharacter,
          createCharacter,
        ]);

      const character =
        result.project.entities.find(
          (entity: any) =>
            entity.id === CHARACTER_ID,
        );

      expect(
        character.components.skin,
      ).toBe("#ABCDEF");
    });

    it("creates only one revision for a multi-command transaction", async () => {
      const commands = [
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            commandId:
              COMMAND_ID,
            idempotencyKey:
              "multi-1",
            payload: {
              name: "Ravi",
              entityId: CHARACTER_ID,
            },
          },
        ),
        makeCommand(
          projectId,
          revisionId,
          "CREATE_SCENE",
          {
            commandId:
              COMMAND_ID_2,
            idempotencyKey:
              "multi-2",
            payload: {
              sceneId: SCENE_ID,
              name: "Classroom",
            },
          },
        ),
      ];

      const result =
        await executor.executeMany(
          commands,
        );

      expect(
        result.revision.number,
      ).toBe(1);
    });
  });

  describe("idempotency", () => {
    it("returns the cached result when the same idempotency key is replayed", async () => {
      const input = makeCommand(
        projectId,
        revisionId,
        "CREATE_CHARACTER",
        {
          payload: {
            name: "Ravi",
            entityId: CHARACTER_ID,
          },
        },
      );

      const first =
        await executor.execute(input);

      const second =
        await executor.execute(input);

      expect(second).toBe(first);

      expect(
        second.revision.revisionId,
      ).toBe(
        first.revision.revisionId,
      );

      const latest =
        await repository.latest(
          projectId,
        );

      expect(
        latest.number,
      ).toBe(1);
    });

    it("does not cache commands with different idempotency keys", async () => {
      const first =
        await executor.execute(
          makeCommand(
            projectId,
            revisionId,
            "CREATE_CHARACTER",
            {
              payload: {
                name: "Ravi",
                entityId: CHARACTER_ID,
              },
            },
          ),
        );

      const second =
        await executor.execute(
          makeCommand(
            projectId,
            first.revision.revisionId,
            "CREATE_CHARACTER",
            {
              commandId:
                COMMAND_ID_2,
              idempotencyKey:
                "different-key",
              payload: {
                name: "Amit",
                entityId:
                  CHARACTER_ID_2,
              },
            },
          ),
        );

      expect(
        second.revision.number,
      ).toBe(2);

      expect(
        second.project.entities,
      ).toHaveLength(2);
    });
  });

  describe("revision concurrency", () => {
    it("rejects execution using a stale revision", async () => {
      const input =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            payload: {
              name: "Ravi",
              entityId: CHARACTER_ID,
            },
          },
        );

      await executor.execute(input);

      const stale =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            commandId:
              COMMAND_ID_2,
            idempotencyKey:
              "stale-command",
            payload: {
              name: "Amit",
              entityId:
                CHARACTER_ID_2,
            },
          },
        );

      await expect(
        executor.execute(stale),
      ).rejects.toThrow(
        CaeError,
      );
    });
  });

  describe("transaction failure behavior", () => {
    it("does not persist a transaction when a later command fails", async () => {
      const before =
        await repository.latest(
          projectId,
        );

      const valid =
        makeCommand(
          projectId,
          revisionId,
          "CREATE_CHARACTER",
          {
            commandId:
              COMMAND_ID,
            idempotencyKey:
              "transaction-valid",
            payload: {
              name: "Ravi",
              entityId:
                CHARACTER_ID,
            },
          },
        );

      const invalid =
        makeCommand(
          projectId,
          revisionId,
          "MODIFY_CHARACTER",
          {
            commandId:
              COMMAND_ID_2,
            idempotencyKey:
              "transaction-invalid",
            targetIds: [
              "00000000-0000-4000-8000-000000000999",
            ],
            dependencies: [
              COMMAND_ID,
            ],
            payload: {
              skin: "#FFFFFF",
            },
          },
        );

      await expect(
        executor.executeMany([
          valid,
          invalid,
        ]),
      ).rejects.toThrow(
        "Character not found",
      );

      const after =
        await repository.latest(
          projectId,
        );

      expect(
        after.revisionId,
      ).toBe(
        before.revisionId,
      );

      expect(
        after.number,
      ).toBe(before.number);

      const project =
        await repository.get(
          projectId,
        );

      expect(
        project.entities,
      ).toHaveLength(0);
    });
  });
});