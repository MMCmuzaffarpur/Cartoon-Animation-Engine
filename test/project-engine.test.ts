import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { CaeError } from "../packages/domain/src/index.js";
import { ProjectRepository } from "../packages/project-engine/src/index.js";

describe("project-engine", () => {
  const roots: string[] = [];

  async function createRepository() {
    const root = await mkdtemp(
      join(tmpdir(), "cae-project-engine-"),
    );

    roots.push(root);

    return {
      root,
      repository: new ProjectRepository(root),
    };
  }

  async function createProject() {
    const { root, repository } =
      await createRepository();

    const created = await repository.create(
      "Test Project",
      "test-author",
    );

    return {
      root,
      repository,
      created,
    };
  }

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map(async (root) => {
        await rm(root, {
          recursive: true,
          force: true,
        });
      }),
    );
  });

  describe("project creation", () => {
    it("creates a project with the requested name", async () => {
      const { repository, created } =
        await createProject();

      expect(created.project.name).toBe(
        "Test Project",
      );

      expect(created.project.id).toBe(
        created.project.projectId,
      );

      const loaded = await repository.get(
        created.project.id,
      );

      expect(loaded.name).toBe("Test Project");

      expect(loaded.id).toBe(
        created.project.id,
      );
    });

    it("creates an initial revision", async () => {
      const { created } = await createProject();

      expect(created.revision.projectId).toBe(
        created.project.id,
      );

      expect(created.revision.number).toBe(0);

      expect(
        created.revision.parentRevisionId,
      ).toBeNull();

      expect(created.revision.author).toBe(
        "test-author",
      );

      expect(created.revision.source).toBe(
        "project-create",
      );

      expect(
        created.revision.changeSummary,
      ).toBe("Created project");
    });

    it("creates stable project and revision identifiers", async () => {
      const { created } =
        await createProject();

      expect(created.project.id).toMatch(
        /^[0-9a-f-]{36}$/,
      );

      expect(
        created.revision.revisionId,
      ).toMatch(/^[0-9a-f-]{36}$/);

      expect(
        created.project.id,
      ).not.toBe(
        created.revision.revisionId,
      );
    });

    it("initializes the project with the engine defaults", async () => {
      const { created } =
        await createProject();

      expect(
        created.project.schemaVersion,
      ).toBe("1.0.0");

      expect(created.project.revision).toBe(0);

      expect(created.project.tickRate).toBe(
        48000,
      );

      expect(created.project.frameRate).toEqual({
        numerator: 24,
        denominator: 1,
      });

      expect(
        created.project.durationTicks,
      ).toBe(0);

      expect(created.project.assets).toEqual([]);

      expect(created.project.entities).toEqual(
        [],
      );

      expect(created.project.characters).toEqual(
        [],
      );

      expect(created.project.scenes).toEqual([]);

      expect(created.project.sequences).toEqual(
        [],
      );

      expect(created.project.settings).toEqual(
        {},
      );
    });

    it("creates project and revision timestamps", async () => {
      const { created } =
        await createProject();

      expect(
        Number.isNaN(
          Date.parse(
            created.project.createdAt,
          ),
        ),
      ).toBe(false);

      expect(
        Number.isNaN(
          Date.parse(
            created.project.updatedAt,
          ),
        ),
      ).toBe(false);

      expect(
        Number.isNaN(
          Date.parse(
            created.revision.createdAt,
          ),
        ),
      ).toBe(false);
    });

    it("uses local as the default author", async () => {
      const { repository } =
        await createRepository();

      const created =
        await repository.create(
          "Default Author Project",
        );

      expect(
        created.revision.author,
      ).toBe("local");
    });
  });

  describe("persistence", () => {
    it("persists project.json", async () => {
      const { root, created } =
        await createProject();

      const path = join(
        root,
        created.project.id,
        "project.json",
      );

      const raw = await readFile(
        path,
        "utf8",
      );

      const persisted = JSON.parse(raw);

      expect(persisted.id).toBe(
        created.project.id,
      );

      expect(persisted.name).toBe(
        created.project.name,
      );

      expect(persisted.revision).toBe(0);
    });

    it("persists the initial revision snapshot", async () => {
      const { root, created } =
        await createProject();

      const path = join(
        root,
        created.project.id,
        "revisions",
        `${created.revision.revisionId}.json`,
      );

      const raw = await readFile(
        path,
        "utf8",
      );

      const persisted = JSON.parse(raw);

      expect(
        persisted.revisionId,
      ).toBe(
        created.revision.revisionId,
      );

      expect(persisted.projectId).toBe(
        created.project.id,
      );

      expect(persisted.number).toBe(0);

      expect(
        persisted.snapshot,
      ).toEqual(created.project);
    });

    it("loads the persisted project through get", async () => {
      const { repository, created } =
        await createProject();

      const loaded = await repository.get(
        created.project.id,
      );

      expect(loaded).toEqual(
        created.project,
      );
    });

    it("loads the latest persisted revision", async () => {
      const { repository, created } =
        await createProject();

      const latest =
        await repository.latest(
          created.project.id,
        );

      expect(latest).toEqual(
        created.revision,
      );
    });
  });

  describe("mutation", () => {
    it("creates a new revision from an in-place mutation", async () => {
      const { repository, created } =
        await createProject();

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Changed project setting",
          (project) => {
            project.settings.test = true;
          },
          "editor",
          "test-command",
        );

      expect(result.project.revision).toBe(
        1,
      );

      expect(result.project.settings).toEqual(
        {
          test: true,
        },
      );

      expect(result.revision.number).toBe(1);

      expect(
        result.revision.parentRevisionId,
      ).toBe(
        created.revision.revisionId,
      );

      expect(result.revision.author).toBe(
        "editor",
      );

      expect(result.revision.source).toBe(
        "test-command",
      );

      expect(
        result.revision.changeSummary,
      ).toBe(
        "Changed project setting",
      );
    });

    it("supports a mutator that returns a replacement project", async () => {
      const { repository, created } =
        await createProject();

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Replace project settings",
          (project) => ({
            ...project,
            settings: {
              ...project.settings,
              theme: "cartoon",
            },
          }),
        );

      expect(
        result.project.settings,
      ).toEqual({
        theme: "cartoon",
      });

      expect(result.project.revision).toBe(
        1,
      );

      expect(result.revision.number).toBe(1);
    });

    it("does not pass the persisted project object directly to the mutator", async () => {
      const { repository, created } =
        await createProject();

      let receivedProject: any;

      await repository.mutate(
        created.project.id,
        created.revision.revisionId,
        "Clone test",
        (project) => {
          receivedProject = project;

          project.settings.insideMutation =
            true;
        },
      );

      const persisted =
        await repository.get(
          created.project.id,
        );

      expect(receivedProject).toBeTruthy();

      expect(
        persisted.settings,
      ).toEqual({
        insideMutation: true,
      });

      expect(
        created.project.settings,
      ).toEqual({});
    });

    it("increments the revision number automatically", async () => {
      const { repository, created } =
        await createProject();

      const first =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "First change",
          (project) => {
            project.settings.step = 1;
          },
        );

      const second =
        await repository.mutate(
          created.project.id,
          first.revision.revisionId,
          "Second change",
          (project) => {
            project.settings.step = 2;
          },
        );

      expect(first.project.revision).toBe(
        1,
      );

      expect(first.revision.number).toBe(1);

      expect(second.project.revision).toBe(
        2,
      );

      expect(second.revision.number).toBe(2);

      expect(
        second.revision.parentRevisionId,
      ).toBe(
        first.revision.revisionId,
      );
    });

    it("does not allow the mutator to control the revision number", async () => {
      const { repository, created } =
        await createProject();

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Revision protection",
          (project) => {
            project.revision = 999999;
          },
        );

      expect(result.project.revision).toBe(
        1,
      );

      expect(result.revision.number).toBe(1);
    });

    it("updates updatedAt during mutation", async () => {
      const { repository, created } =
        await createProject();

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Timestamp change",
          (project) => {
            project.settings.updated = true;
          },
        );

      expect(
        result.project.updatedAt,
      ).toBeTruthy();

      expect(
        Number.isNaN(
          Date.parse(
            result.project.updatedAt,
          ),
        ),
      ).toBe(false);

      expect(
        result.revision.createdAt,
      ).toBe(
        result.project.updatedAt,
      );
    });

    it("preserves immutable previous revision data", async () => {
      const { repository, created } =
        await createProject();

      const first =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "First mutation",
          (project) => {
            project.settings.version = 1;
          },
        );

      await repository.mutate(
        created.project.id,
        first.revision.revisionId,
        "Second mutation",
        (project) => {
          project.settings.version = 2;
        },
      );

      const storedFirst = JSON.parse(
        await readFile(
          join(
            rootFor(repository),
            created.project.id,
            "revisions",
            `${first.revision.revisionId}.json`,
          ),
          "utf8",
        ),
      );

      expect(
        (
          storedFirst.snapshot.settings as Record<
            string,
            unknown
          >
        ).version,
      ).toBe(1);
    });

    it("stores the mutation snapshot in the revision", async () => {
      const { repository, created } =
        await createProject();

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Snapshot test",
          (project) => {
            project.settings.snapshotValue =
              "hello";
          },
        );

      expect(
        result.revision.snapshot,
      ).toEqual(result.project);

      expect(
        result.revision.snapshot.settings,
      ).toEqual({
        snapshotValue: "hello",
      });
    });
  });

  describe("optimistic concurrency", () => {
    it("rejects a stale revision id", async () => {
      const { repository, created } =
        await createProject();

      const first =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "First change",
          (project) => {
            project.settings.value = 1;
          },
        );

      await expect(
        repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Stale change",
          (project) => {
            project.settings.value = 2;
          },
        ),
      ).rejects.toMatchObject({
        code: "REVISION_CONFLICT",
      });

      const latest =
        await repository.latest(
          created.project.id,
        );

      expect(latest.revisionId).toBe(
        first.revision.revisionId,
      );

      expect(
        (
          latest.snapshot.settings as Record<
            string,
            unknown
          >
        ).value,
      ).toBe(1);
    });

    it("does not execute the mutator when revision is stale", async () => {
      const { repository, created } =
        await createProject();

      await repository.mutate(
        created.project.id,
        created.revision.revisionId,
        "Current change",
        (project) => {
          project.settings.current = true;
        },
      );

      let called = false;

      await expect(
        repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Stale change",
          () => {
            called = true;
          },
        ),
      ).rejects.toMatchObject({
        code: "REVISION_CONFLICT",
      });

      expect(called).toBe(false);
    });

    it("uses the current revision as the parent revision", async () => {
      const { repository, created } =
        await createProject();

      const first =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "First",
          (project) => {
            project.settings.step = 1;
          },
        );

      const second =
        await repository.mutate(
          created.project.id,
          first.revision.revisionId,
          "Second",
          (project) => {
            project.settings.step = 2;
          },
        );

      expect(
        first.revision.parentRevisionId,
      ).toBe(
        created.revision.revisionId,
      );

      expect(
        second.revision.parentRevisionId,
      ).toBe(
        first.revision.revisionId,
      );
    });
  });

  describe("validation and failure handling", () => {
    it("rejects a mutation that produces an invalid project", async () => {
      const { repository, created } =
        await createProject();

      await expect(
        repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Invalid mutation",
          (project) => {
            project.tickRate = "invalid";
          },
        ),
      ).rejects.toThrow();
    });

    it("does not replace project.json when validation fails", async () => {
      const { repository, created } =
        await createProject();

      await expect(
        repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Invalid mutation",
          (project) => {
            project.tickRate = "invalid";
          },
        ),
      ).rejects.toThrow();

      const project =
        await repository.get(
          created.project.id,
        );

      expect(project.revision).toBe(0);

      expect(project.tickRate).toBe(
        48000,
      );

      expect(project.settings).toEqual({});
    });

    it("propagates errors thrown by the mutator", async () => {
      const { repository, created } =
        await createProject();

      const error = new Error(
        "mutation failed",
      );

      await expect(
        repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Failed mutation",
          () => {
            throw error;
          },
        ),
      ).rejects.toBe(error);

      const project =
        await repository.get(
          created.project.id,
        );

      expect(project.revision).toBe(0);
    });

    it("returns PROJECT_NOT_FOUND for an unknown project", async () => {
      const { repository } =
        await createRepository();

      await expect(
        repository.get(
          "00000000-0000-4000-8000-000000000001",
        ),
      ).rejects.toBeInstanceOf(CaeError);

      await expect(
        repository.get(
          "00000000-0000-4000-8000-000000000001",
        ),
      ).rejects.toMatchObject({
        code: "PROJECT_NOT_FOUND",
      });
    });

    it("returns REVISION_NOT_FOUND for an unknown project revision", async () => {
      const { repository } =
        await createRepository();

      await expect(
        repository.latest(
          "00000000-0000-4000-8000-000000000001",
        ),
      ).rejects.toMatchObject({
        code: "REVISION_NOT_FOUND",
      });
    });
  });

  describe("latest revision", () => {
    it("returns the highest revision number", async () => {
      const { repository, created } =
        await createProject();

      const first =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "First",
          (project) => {
            project.settings.number = 1;
          },
        );

      const second =
        await repository.mutate(
          created.project.id,
          first.revision.revisionId,
          "Second",
          (project) => {
            project.settings.number = 2;
          },
        );

      const latest =
        await repository.latest(
          created.project.id,
        );

      expect(latest.revisionId).toBe(
        second.revision.revisionId,
      );

      expect(latest.number).toBe(2);
    });

    it("returns the latest snapshot", async () => {
      const { repository, created } =
        await createProject();

      const first =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "First",
          (project) => {
            project.settings.value =
              "first";
          },
        );

      await repository.mutate(
        created.project.id,
        first.revision.revisionId,
        "Second",
        (project) => {
          project.settings.value =
            "second";
        },
      );

      const latest =
        await repository.latest(
          created.project.id,
        );

      expect(
        (
          latest.snapshot.settings as Record<
            string,
            unknown
          >
        ).value,
      ).toBe("second");
    });
  });

  describe("export", () => {
    it("exports the current project as formatted JSON", async () => {
      const { repository, created } =
        await createProject();

      const exported =
        await repository.export(
          created.project.id,
        );

      expect(typeof exported).toBe(
        "string",
      );

      const parsed = JSON.parse(exported);

      expect(parsed).toEqual(
        created.project,
      );
    });

    it("exports the latest project state after mutation", async () => {
      const { repository, created } =
        await createProject();

      await repository.mutate(
        created.project.id,
        created.revision.revisionId,
        "Export mutation",
        (project) => {
          project.settings.exported =
            true;
        },
      );

      const exported =
        await repository.export(
          created.project.id,
        );

      const parsed = JSON.parse(exported);

      expect(parsed.revision).toBe(1);

      expect(
        parsed.settings.exported,
      ).toBe(true);
    });

    it("produces pretty formatted JSON", async () => {
      const { repository, created } =
        await createProject();

      const exported =
        await repository.export(
          created.project.id,
        );

      expect(exported).toContain("\n");

      expect(exported).toContain(
        '  "id"',
      );
    });
  });

  describe("list", () => {
    it("returns an empty list for an empty repository", async () => {
      const { repository } =
        await createRepository();

      const projects =
        await repository.list();

      expect(projects).toEqual([]);
    });

    it("lists all projects in the repository", async () => {
      const { repository } =
        await createRepository();

      const first =
        await repository.create(
          "Project One",
        );

      const second =
        await repository.create(
          "Project Two",
        );

      const projects =
        await repository.list();

      expect(projects).toHaveLength(2);

      expect(
        projects.map(
          (project) => project.id,
        ),
      ).toEqual(
        expect.arrayContaining([
          first.project.id,
          second.project.id,
        ]),
      );

      expect(
        projects.map(
          (project) => project.name,
        ),
      ).toEqual(
        expect.arrayContaining([
          "Project One",
          "Project Two",
        ]),
      );
    });

    it("returns parsed project manifests", async () => {
      const { repository } =
        await createRepository();

      await repository.create(
        "Parsed Project",
      );

      const projects =
        await repository.list();

      expect(projects).toHaveLength(1);

      expect(projects[0].name).toBe(
        "Parsed Project",
      );

      expect(
        projects[0].schemaVersion,
      ).toBe("1.0.0");
    });
  });

  describe("revision metadata", () => {
    it("stores a canonical content hash", async () => {
      const { repository, created } =
        await createProject();

      expect(
        typeof created.revision
          .contentHash,
      ).toBe("string");

      expect(
        created.revision.contentHash.length,
      ).toBeGreaterThan(0);
    });

    it("changes the content hash when project content changes", async () => {
      const { repository, created } =
        await createProject();

      const firstHash =
        created.revision.contentHash;

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Hash change",
          (project) => {
            project.settings.hashTest =
              true;
          },
        );

      expect(
        result.revision.contentHash,
      ).not.toBe(firstHash);
    });

    it("preserves the requested author and source", async () => {
      const { repository, created } =
        await createProject();

      const result =
        await repository.mutate(
          created.project.id,
          created.revision.revisionId,
          "Metadata test",
          (project) => {
            project.settings.metadata =
              true;
          },
          "admin-user",
          "admin-command",
        );

      expect(result.revision.author).toBe(
        "admin-user",
      );

      expect(result.revision.source).toBe(
        "admin-command",
      );

      expect(
        result.revision.changeSummary,
      ).toBe("Metadata test");
    });
  });
});

function rootFor(
  repository: ProjectRepository,
): string {
  return (
    repository as unknown as {
      root: string;
    }
  ).root;
}