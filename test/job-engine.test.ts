import { describe, expect, it } from "vitest";

import {
  JobEngine,
  JobMachine,
  type JobState,
} from "../packages/job-engine/src/index.js";

describe("JobMachine", () => {
  it("starts in queued state", () => {
    const machine = new JobMachine();

    expect(machine.state).toBe("queued");
    expect(machine.attempts).toBe(0);
    expect(machine.logs).toEqual([]);
  });

  it("supports valid queued -> preparing transition", () => {
    const machine = new JobMachine();

    expect(machine.canMove("preparing")).toBe(true);

    machine.move("preparing");

    expect(machine.state).toBe("preparing");
    expect(machine.logs).toEqual(["state:preparing"]);
  });

  it("supports the normal lifecycle", () => {
    const machine = new JobMachine();

    machine.move("preparing");
    machine.move("running");
    machine.move("finalizing");
    machine.move("succeeded");

    expect(machine.state).toBe("succeeded");
    expect(machine.attempts).toBe(0);
    expect(machine.logs).toEqual([
      "state:preparing",
      "state:running",
      "state:finalizing",
      "state:succeeded",
    ]);
  });

  it("increments attempts when entering retrying", () => {
    const machine = new JobMachine("failed");

    machine.move("retrying");

    expect(machine.state).toBe("retrying");
    expect(machine.attempts).toBe(1);
  });

  it("preserves attempts across multiple retries", () => {
    const machine = new JobMachine("failed", 2);

    machine.move("retrying");

    expect(machine.attempts).toBe(3);
  });

  it("supports custom transition messages", () => {
    const machine = new JobMachine();

    machine.move(
      "preparing",
      "Preparing render resources",
    );

    expect(machine.logs).toEqual([
      "Preparing render resources",
    ]);
  });

  it("rejects invalid transitions", () => {
    const machine = new JobMachine("queued");

    expect(() =>
      machine.move("running"),
    ).toThrow();

    expect(machine.state).toBe("queued");
  });

  it("reports static transition information", () => {
    expect(
      JobMachine.canTransition(
        "queued",
        "preparing",
      ),
    ).toBe(true);

    expect(
      JobMachine.canTransition(
        "queued",
        "running",
      ),
    ).toBe(false);

    expect(
      JobMachine.canTransition(
        "failed",
        "retrying",
      ),
    ).toBe(true);

    expect(
      JobMachine.canTransition(
        "succeeded",
        "queued",
      ),
    ).toBe(false);
  });

  it("returns a defensive transition map", () => {
    const transitions = JobMachine.transitions();

    expect(transitions.queued).toContain(
      "preparing",
    );

    expect(transitions.failed).toContain(
      "retrying",
    );

    expect(transitions.succeeded).toEqual([]);
  });

  it("limits machine logs to 1000 entries", () => {
    const machine = new JobMachine();

    machine.move("preparing");

    machine.logs = Array.from(
      { length: 999 },
      (_, index) => `log-${index}`,
    );

    machine.move(
      "running",
      "final-running-message",
    );

    expect(machine.logs).toHaveLength(1000);
    expect(machine.logs.at(-1)).toBe(
      "final-running-message",
    );
  });
});

describe("JobEngine", () => {
  it("creates a queued job", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "video-render",
      "render-001",
    );

    expect(job.id).toBeTypeOf("string");
    expect(job.type).toBe("video-render");
    expect(job.state).toBe("queued");
    expect(job.progress).toBe(0);
    expect(job.attempts).toBe(0);
    expect(job.idempotencyKey).toBe(
      "render-001",
    );
    expect(job.logs).toEqual([
      "state:queued",
    ]);
    expect(job.createdAt).toBeTypeOf("string");
    expect(job.updatedAt).toBeTypeOf("string");
  });

  it("supports initial progress", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "render-progress",
      {
        initialProgress: 25,
      },
    );

    expect(job.progress).toBe(25);
  });

  it("supports an initial checkpoint", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "render-checkpoint",
      {
        checkpoint: {
          frame: 120,
          stage: "animation",
        },
      },
    );

    expect(job.checkpoint).toEqual({
      frame: 120,
      stage: "animation",
    });
  });

  it("rejects invalid job type", () => {
    const engine = new JobEngine();

    expect(() =>
      engine.create(
        "",
        "key-1",
      ),
    ).toThrow(
      "Job type must be a non-empty string.",
    );
  });

  it("rejects invalid idempotency key", () => {
    const engine = new JobEngine();

    expect(() =>
      engine.create(
        "render",
        "",
      ),
    ).toThrow(
      "Idempotency key must be a non-empty string.",
    );
  });

  it("enforces idempotency", () => {
    const engine = new JobEngine();

    const first = engine.create(
      "render",
      "same-key",
    );

    const second = engine.create(
      "render",
      "same-key",
    );

    expect(second.id).toBe(first.id);
    expect(engine.size()).toBe(1);
  });

  it("returns a cloned idempotent job", () => {
    const engine = new JobEngine();

    const first = engine.create(
      "render",
      "clone-key",
    );

    first.logs.push("mutated externally");

    const second = engine.create(
      "render",
      "clone-key",
    );

    expect(second.logs).not.toContain(
      "mutated externally",
    );
  });

  it("gets an existing job", () => {
    const engine = new JobEngine();

    const created = engine.create(
      "render",
      "get-key",
    );

    const job = engine.get(created.id);

    expect(job.id).toBe(created.id);
    expect(job.state).toBe("queued");
  });

  it("throws JOB_NOT_FOUND for an unknown job", () => {
    const engine = new JobEngine();

    expect(() =>
      engine.get(
        "00000000-0000-4000-8000-000000000000",
      ),
    ).toThrow("Job not found");
  });

  it("returns a safe job snapshot", () => {
    const engine = new JobEngine();

    const created = engine.create(
      "render",
      "snapshot-key",
    );

    const snapshot =
      engine.getSnapshot(created.id);

    snapshot.logs.push("external mutation");

    const fresh =
      engine.getSnapshot(created.id);

    expect(fresh.logs).not.toContain(
      "external mutation",
    );
  });

  it("runs the complete lifecycle", () => {
    const engine = new JobEngine();

    const created = engine.create(
      "video-render",
      "lifecycle",
    );

    const preparing =
      engine.prepare(created.id);

    expect(preparing.state).toBe(
      "preparing",
    );

    const running =
      engine.start(created.id);

    expect(running.state).toBe("running");
    expect(running.startedAt).toBeTypeOf(
      "string",
    );

    const finalizing =
      engine.finalize(created.id);

    expect(finalizing.state).toBe(
      "finalizing",
    );

    const succeeded =
      engine.succeed(created.id);

    expect(succeeded.state).toBe(
      "succeeded",
    );

    expect(succeeded.progress).toBe(100);
    expect(succeeded.completedAt).toBeTypeOf(
      "string",
    );
  });

  it("does not overwrite an existing startedAt", () => {
  const engine = new JobEngine();

  const job = engine.create(
    "render",
    "started-once",
  );

  // First execution.
  engine.prepare(job.id);

  const first =
    engine.start(job.id);

  const firstStartedAt =
    first.startedAt;

  expect(firstStartedAt).toBeTypeOf(
    "string",
  );

  // Simulate execution failure.
  const failed =
    engine.fail(
      job.id,
      "temporary failure",
    );

  expect(failed.state).toBe(
    "failed",
  );

  expect(
    failed.startedAt,
  ).toBe(
    firstStartedAt,
  );

  // Retry returns the job to the queue.
  const retried =
    engine.retry(job.id);

  expect(retried.state).toBe(
    "queued",
  );

  expect(
    retried.attempts,
  ).toBe(1);

  // Second execution must follow the
  // canonical lifecycle again.
  engine.prepare(
    retried.id,
  );

  const startedAgain =
    engine.start(
      retried.id,
    );

  expect(
    startedAgain.state,
  ).toBe("running");

  // startedAt is immutable once the first
  // execution has started.
  expect(
    startedAgain.startedAt,
  ).toBe(
    firstStartedAt,
  );
});

  it("updates progress forward", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "progress-forward",
    );

    const updated =
      engine.setProgress(
        job.id,
        40,
      );

    expect(updated.progress).toBe(40);
  });

  it("allows progress to reach 100", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "progress-100",
    );

    const updated =
      engine.setProgress(
        job.id,
        100,
      );

    expect(updated.progress).toBe(100);
  });

  it("rejects progress below zero", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "negative-progress",
    );

    expect(() =>
      engine.setProgress(
        job.id,
        -1,
      ),
    ).toThrow(
      "Job progress must be between 0 and 100.",
    );
  });

  it("rejects progress above 100", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "over-progress",
    );

    expect(() =>
      engine.setProgress(
        job.id,
        101,
      ),
    ).toThrow(
      "Job progress must be between 0 and 100.",
    );
  });

  it("rejects progress moving backwards", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "backward-progress",
      {
        initialProgress: 50,
      },
    );

    expect(() =>
      engine.setProgress(
        job.id,
        40,
      ),
    ).toThrow(
      "Job progress cannot move backwards.",
    );
  });

  it("allows transition progress updates", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "transition-progress",
    );

    const preparing =
      engine.transition(
        job.id,
        "preparing",
        20,
      );

    expect(preparing.progress).toBe(20);
  });

  it("rejects invalid transition progress", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "invalid-transition-progress",
    );

    expect(() =>
      engine.transition(
        job.id,
        "preparing",
        101,
      ),
    ).toThrow(
      "Job progress must be between 0 and 100.",
    );
  });

  it("adds log entries", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "logs",
    );

    const updated =
      engine.log(
        job.id,
        "Rendering frame 1",
      );

    expect(updated.logs).toContain(
      "Rendering frame 1",
    );
  });

  it("rejects empty log messages", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "empty-log",
    );

    expect(() =>
      engine.log(
        job.id,
        "   ",
      ),
    ).toThrow(
      "Log message must be a non-empty string.",
    );
  });

  it("truncates oversized log messages", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "large-log",
    );

    const message =
      "x".repeat(5_000);

    const updated =
      engine.log(
        job.id,
        message,
      );

    const last =
      updated.logs.at(-1);

    expect(last).toHaveLength(4_096);
  });

  it("sets and replaces checkpoints", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "checkpoint",
    );

    engine.setCheckpoint(
      job.id,
      {
        frame: 100,
      },
    );

    const updated =
      engine.setCheckpoint(
        job.id,
        {
          frame: 200,
          phase: "render",
        },
      );

    expect(updated.checkpoint).toEqual({
      frame: 200,
      phase: "render",
    });
  });

  it("protects checkpoint data from external mutation", () => {
    const engine = new JobEngine();

    const checkpoint = {
      frame: 100,
      nested: {
        stage: "render",
      },
    };

    const job = engine.create(
      "render",
      "checkpoint-clone",
      {
        checkpoint,
      },
    );

    checkpoint.nested.stage =
      "mutated";

    expect(
      job.checkpoint,
    ).toEqual({
      frame: 100,
      nested: {
        stage: "render",
      },
    });
  });

  it("rejects invalid checkpoint arrays", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "invalid-checkpoint",
    );

    expect(() =>
      engine.setCheckpoint(
        job.id,
        [] as unknown as Record<
          string,
          unknown
        >,
      ),
    ).toThrow(
      "Job checkpoint must be an object.",
    );
  });

  it("fails a running job", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "failure",
    );

    engine.prepare(job.id);
    engine.start(job.id);

    const failed =
      engine.fail(
        job.id,
        "FFmpeg failed",
      );

    expect(failed.state).toBe("failed");
    expect(failed.error).toBe(
      "FFmpeg failed",
    );

    expect(
      failed.logs.at(-1),
    ).toBe(
      "error:FFmpeg failed",
    );
  });

  it("supports failed -> retrying -> queued", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "retry",
    );

    engine.prepare(job.id);
    engine.start(job.id);
    engine.fail(
      job.id,
      "temporary error",
    );

    const retried =
      engine.retry(job.id);

    expect(retried.state).toBe("queued");
    expect(retried.attempts).toBe(1);
    expect(retried.progress).toBe(0);
    expect(retried.error).toBeUndefined();
  });

  it("rejects retrying a non-failed job", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "invalid-retry",
    );

    expect(() =>
      engine.retry(job.id),
    ).toThrow(
      "Only failed jobs can be retried; current state is queued",
    );
  });

  it("cancels a queued job immediately", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "cancel-queued",
    );

    const cancelled =
      engine.cancel(job.id);

    expect(cancelled.state).toBe(
      "cancelled",
    );

    expect(
      cancelled.completedAt,
    ).toBeTypeOf("string");
  });

  it("moves a preparing job into cancelling", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "cancel-preparing",
    );

    engine.prepare(job.id);

    const cancelling =
      engine.cancel(job.id);

    expect(cancelling.state).toBe(
      "cancelling",
    );
  });

  it("moves a running job into cancelling", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "cancel-running",
    );

    engine.prepare(job.id);
    engine.start(job.id);

    const cancelling =
      engine.cancel(job.id);

    expect(cancelling.state).toBe(
      "cancelling",
    );
  });

  it("completes cancellation", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "complete-cancel",
    );

    engine.prepare(job.id);
    engine.start(job.id);
    engine.cancel(job.id);

    const cancelled =
      engine.completeCancellation(
        job.id,
      );

    expect(cancelled.state).toBe(
      "cancelled",
    );

    expect(
      cancelled.completedAt,
    ).toBeTypeOf("string");
  });

  it("does not cancel a succeeded job", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "cancel-success",
    );

    engine.prepare(job.id);
    engine.start(job.id);
    engine.finalize(job.id);
    engine.succeed(job.id);

    expect(() =>
      engine.cancel(job.id),
    ).toThrow();
  });

  it("returns the queued jobs", () => {
    const engine = new JobEngine();

    const first = engine.create(
      "render",
      "queued-1",
    );

    const second = engine.create(
      "render",
      "queued-2",
    );

    engine.prepare(second.id);

    const queued =
      engine.queued();

    expect(
      queued.map((job) => job.id),
    ).toEqual([first.id]);
  });

  it("lists jobs by type", () => {
    const engine = new JobEngine();

    engine.create(
      "render",
      "type-render",
    );

    engine.create(
      "audio",
      "type-audio",
    );

    const jobs =
      engine.list({
        type: "render",
      });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe(
      "render",
    );
  });

  it("lists jobs by state", () => {
    const engine = new JobEngine();

    const queued =
      engine.create(
        "render",
        "state-queued",
      );

    const running =
      engine.create(
        "render",
        "state-running",
      );

    engine.prepare(running.id);
    engine.start(running.id);

    const jobs =
      engine.list({
        states: ["running"],
      });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(
      running.id,
    );
    expect(jobs[0].id).not.toBe(
      queued.id,
    );
  });

  it("supports list limits", () => {
    const engine = new JobEngine();

    engine.create(
      "render",
      "limit-1",
    );

    engine.create(
      "render",
      "limit-2",
    );

    engine.create(
      "render",
      "limit-3",
    );

    const jobs =
      engine.list({
        limit: 2,
      });

    expect(jobs).toHaveLength(2);
  });

  it("rejects invalid list limits", () => {
    const engine = new JobEngine();

    expect(() =>
      engine.list({
        limit: -1,
      }),
    ).toThrow(
      "Job list limit must be a non-negative integer.",
    );

    expect(() =>
      engine.list({
        limit: 1.5,
      }),
    ).toThrow(
      "Job list limit must be a non-negative integer.",
    );
  });

  it("removes a completed job", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "remove-completed",
    );

    engine.prepare(job.id);
    engine.start(job.id);
    engine.finalize(job.id);
    engine.succeed(job.id);

    engine.remove(job.id);

    expect(engine.size()).toBe(0);

    expect(() =>
      engine.get(job.id),
    ).toThrow("Job not found");
  });

  it("removes a cancelled job", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "remove-cancelled",
    );

    engine.cancel(job.id);
    engine.remove(job.id);

    expect(engine.size()).toBe(0);
  });

  it("does not remove active jobs", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "remove-active",
    );

    engine.prepare(job.id);

    expect(() =>
      engine.remove(job.id),
    ).toThrow();
  });

  it("releases idempotency after removal", () => {
    const engine = new JobEngine();

    const first = engine.create(
      "render",
      "reuse-key",
    );

    engine.remove(first.id);

    const second = engine.create(
      "render",
      "reuse-key",
    );

    expect(second.id).not.toBe(
      first.id,
    );

    expect(engine.size()).toBe(1);
  });

  it("clears all jobs", () => {
    const engine = new JobEngine();

    engine.create(
      "render",
      "clear-1",
    );

    engine.create(
      "audio",
      "clear-2",
    );

    expect(engine.size()).toBe(2);

    engine.clear();

    expect(engine.size()).toBe(0);
    expect(engine.list()).toEqual([]);
  });

  it("reports job statistics", () => {
    const engine = new JobEngine();

    const queued =
      engine.create(
        "render",
        "stats-queued",
      );

    const running =
      engine.create(
        "render",
        "stats-running",
      );

    const succeeded =
      engine.create(
        "render",
        "stats-succeeded",
      );

    engine.prepare(running.id);
    engine.start(running.id);

    engine.prepare(succeeded.id);
    engine.start(succeeded.id);
    engine.finalize(succeeded.id);
    engine.succeed(succeeded.id);

    const stats =
      engine.statistics();

    expect(stats.queued).toBe(1);
    expect(stats.running).toBe(1);
    expect(stats.succeeded).toBe(1);

    expect(stats.failed).toBe(0);
    expect(stats.cancelled).toBe(0);

    expect(
      engine.get(queued.id).state,
    ).toBe("queued");
  });

  it("returns the correct size", () => {
    const engine = new JobEngine();

    expect(engine.size()).toBe(0);

    engine.create(
      "render",
      "size-1",
    );

    expect(engine.size()).toBe(1);

    engine.create(
      "audio",
      "size-2",
    );

    expect(engine.size()).toBe(2);
  });

  it("preserves list snapshots from external mutation", () => {
    const engine = new JobEngine();

    const job = engine.create(
      "render",
      "list-clone",
    );

    const list =
      engine.list();

    list[0].logs.push(
      "external mutation",
    );

    const fresh =
      engine.list();

    expect(
      fresh[0].logs,
    ).not.toContain(
      "external mutation",
    );
  });

  it("supports every declared job state", () => {
    const states: JobState[] = [
      "queued",
      "preparing",
      "running",
      "finalizing",
      "succeeded",
      "cancelling",
      "cancelled",
      "failed",
      "retrying",
    ];

    for (const state of states) {
      const machine =
        new JobMachine(state);

      expect(machine.state).toBe(
        state,
      );
    }
  });
});