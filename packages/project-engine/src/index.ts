import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import {
  canonicalHash,
  CaeError,
  uuid,
} from "../../domain/src/index.js";

import {
  ProjectManifest,
  ProjectRevision,
} from "../../contracts/src/index.js";

export class ProjectRepository {
  constructor(private readonly root: string) {}

  private dir(id: string): string {
    return join(this.root, id);
  }

  /**
   * Write a JSON document through a temporary file and rename it
   * into place so readers never intentionally observe a partially
   * written JSON document.
   */
  private async atomic(path: string, value: unknown): Promise<void> {
    const tmp = `${path}.${uuid()}.tmp`;

    await writeFile(
      tmp,
      JSON.stringify(value, null, 2),
      "utf8",
    );

    await rename(tmp, path);
  }

  /**
   * Create a new project with its initial revision.
   */
  async create(
    name: string,
    author = "local",
  ) {
    const projectId = uuid();
    const revisionId = uuid();
    const now = new Date().toISOString();

    const project = {
      id: projectId,
      projectId,
      name,
      schemaVersion: "1.0.0",
      revision: 0,
      createdAt: now,
      updatedAt: now,

      tickRate: 48000,

      frameRate: {
        numerator: 24,
        denominator: 1,
      },

      durationTicks: 0,

      assets: [],
      entities: [],
      characters: [],
      scenes: [],
      sequences: [],

      settings: {},
    };

    const parsedProject = ProjectManifest.parse(project);

    await mkdir(
      join(this.dir(projectId), "revisions"),
      { recursive: true },
    );

    await this.atomic(
      join(this.dir(projectId), "project.json"),
      parsedProject,
    );

    const revision = {
      revisionId,
      projectId,
      parentRevisionId: null,
      number: 0,
      author,
      source: "project-create",
      createdAt: now,
      schemaVersion: "1.0.0",
      contentHash: canonicalHash(parsedProject),
      changeSummary: "Created project",
      snapshot: parsedProject,
    };

    const parsedRevision = ProjectRevision.parse(revision);

    await this.atomic(
      join(
        this.dir(projectId),
        "revisions",
        `${revisionId}.json`,
      ),
      parsedRevision,
    );

    return {
      project: parsedProject,
      revision: parsedRevision,
    };
  }

  /**
   * Load the current project manifest.
   */
  async get(projectId: string) {
    try {
      const raw = await readFile(
        join(this.dir(projectId), "project.json"),
        "utf8",
      );

      return ProjectManifest.parse(
        JSON.parse(raw),
      );
    } catch (error) {
      if (
        error instanceof CaeError &&
        error.code === "PROJECT_NOT_FOUND"
      ) {
        throw error;
      }

      throw new CaeError(
        "PROJECT_NOT_FOUND",
        "Project not found",
        [projectId],
      );
    }
  }

  /**
   * Return the latest persisted revision.
   */
  async latest(projectId: string) {
    try {
      const files = await readdir(
        join(this.dir(projectId), "revisions"),
      );

      const revisionFiles = files.filter(
        (file) => file.endsWith(".json"),
      );

      const revisions = await Promise.all(
        revisionFiles.map(async (file) => {
          const raw = await readFile(
            join(
              this.dir(projectId),
              "revisions",
              file,
            ),
            "utf8",
          );

          return ProjectRevision.parse(
            JSON.parse(raw),
          );
        }),
      );

      if (revisions.length === 0) {
        throw new CaeError(
          "REVISION_NOT_FOUND",
          "No revision found",
          [projectId],
        );
      }

      revisions.sort(
        (a, b) => b.number - a.number,
      );

      return revisions[0];
    } catch (error) {
      if (
        error instanceof CaeError &&
        error.code === "REVISION_NOT_FOUND"
      ) {
        throw error;
      }

      throw new CaeError(
        "REVISION_NOT_FOUND",
        "No revision found",
        [projectId],
      );
    }
  }

  /**
   * Mutate a project and create an immutable new revision.
   *
   * The mutator may use either supported style:
   *
   * 1. In-place mutation:
   *    project => {
   *      project.settings.test = true;
   *    }
   *
   * 2. Return a new project:
   *    project => ({
   *      ...project,
   *      settings: {
   *        ...project.settings,
   *        test: true,
   *      },
   *    })
   *
   * The existing persisted revision is never passed directly
   * to the mutator.
   */
  async mutate(
    projectId: string,
    expectedRevisionId: string,
    summary: string,
    mutator: (project: any) => any,
    author = "local",
    source = "command",
  ) {
    /*
     * Optimistic concurrency check.
     *
     * If somebody already created a newer revision, this mutation
     * must fail instead of silently overwriting the newer state.
     */
    const current = await this.latest(projectId);

    if (current.revisionId !== expectedRevisionId) {
      throw new CaeError(
        "REVISION_CONFLICT",
        "Project revision is stale",
        [
          current.revisionId,
          expectedRevisionId,
        ],
      );
    }

    /*
     * Read the current canonical project and create an isolated
     * working copy.
     *
     * This is important because revisions are immutable.
     */
    const base = await this.get(projectId);
    const draft = structuredClone(base);

    /*
     * Run the caller's mutation.
     *
     * We intentionally support both mutation styles:
     *
     *   mutator(draft)
     *
     * returning undefined after modifying draft, OR
     *
     *   return newProject
     *
     * returning a replacement object.
     */
    const result = await mutator(draft);

    const next =
      result === undefined
        ? draft
        : result;

    /*
     * Revision number is controlled by the repository.
     *
     * A mutator must never be able to accidentally control the
     * canonical revision sequence.
     */
    next.revision = base.revision + 1;
    next.updatedAt = new Date().toISOString();

    /*
     * Validate the complete next project before writing anything.
     */
    const parsedNext = ProjectManifest.parse(next);

    /*
     * Build the immutable revision snapshot from the validated
     * project state.
     */
    const revision = {
      revisionId: uuid(),
      projectId,

      parentRevisionId: current.revisionId,

      number: parsedNext.revision,

      author,
      source,

      createdAt: parsedNext.updatedAt,

      schemaVersion: "1.0.0",

      contentHash: canonicalHash(parsedNext),

      changeSummary: summary,

      snapshot: parsedNext,
    };

    const parsedRevision =
      ProjectRevision.parse(revision);

    /*
     * Persist project.json first, then persist the immutable
     * revision snapshot.
     */
    await this.atomic(
      join(
        this.dir(projectId),
        "project.json",
      ),
      parsedNext,
    );

    await this.atomic(
      join(
        this.dir(projectId),
        "revisions",
        `${parsedRevision.revisionId}.json`,
      ),
      parsedRevision,
    );

    return {
      project: parsedNext,
      revision: parsedRevision,
    };
  }

  /**
   * Export the current project as formatted JSON.
   */
  async export(projectId: string): Promise<string> {
    return JSON.stringify(
      await this.get(projectId),
      null,
      2,
    );
  }

  /**
   * List all projects in the repository root.
   */
  async list() {
    await mkdir(this.root, {
      recursive: true,
    });

    const dirs = await readdir(
      this.root,
      {
        withFileTypes: true,
      },
    );

    return Promise.all(
      dirs
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.get(entry.name)),
    );
  }
}