import { describe, expect, it } from "vitest";

import {
  JobEngine,
  JobMachine,
  type JobState,
} from "../packages/job-engine/src/index.js";

describe("job-engine hardening contract", () => {
  describe("JobMachine transition integrity", () => {
    it("does not mutate state when an invalid transition is attempted", () => {
      const machine = new JobMachine("queued");

      expect(() => {
        machine.move("running");
      }).toThrow();

      expect(machine.state).toBe("queued");
      expect(machine.attempts).toBe(0);
      expect(machine.logs).toEqual([]);
    });

    it("does not increment attempts for non-retry transitions", () => {
      const machine = new JobMachine("queued");

      machine.move("preparing");
      machine.move("running");
      machine.move("finalizing");
      machine.move("succeeded");

      expect(machine.attempts).toBe(0);
    });

    it("increments attempts exactly once per retry cycle", () => {
      const machine = new JobMachine("failed", 0);

      machine.move("retrying");

      expect(machine.attempts).toBe(1);

      machine.move("queued");

      expect(machine.attempts).toBe(1);
    });

    it("preserves the supplied attempt count", () => {
      const machine = new JobMachine(
        "failed",
        7,
      );

      expect(machine.attempts).toBe(7);
    });

    it("preserves existing logs when moving state", () => {
      const machine = new JobMachine(
        "queued",
        0,
        ["existing-log"],
      );

      machine.move("preparing");

      expect(machine.logs).toEqual([
        "existing-log",
        "state:preparing",
      ]);
    });

    it("supports every valid lifecycle transition", () => {
      const validTransitions: Array<
        [JobState, JobState]
      > = [
        ["queued", "preparing"],
        ["queued", "cancelled"],
        ["preparing", "running"],
        ["preparing", "cancelling"],
        ["preparing", "failed"],
        ["running", "finalizing"],
        ["running", "cancelling"],
        ["running", "failed"],
        ["finalizing", "succeeded"],
        ["finalizing", "failed"],
        ["cancelling", "cancelled"],
        ["cancelling", "failed"],
        ["failed", "retrying"],
        ["retrying", "queued"],
      ];

      for (const [from, to] of validTransitions) {
        expect(
          JobMachine.canTransition(from, to),
        ).toBe(true);
      }
    });

    it("rejects terminal-state transitions", () => {
      const terminalStates: JobState[] = [
        "succeeded",
        "cancelled",
      ];

      for (const state of terminalStates) {
        const machine = new JobMachine(state);

        for (const next of terminalStates) {
          expect(
            machine.canMove(next),
          ).toBe(false);
        }
      }
    });

    it("does not expose mutable transition internals", () => {
      const transitions =
        JobMachine.transitions();

      const queued =
        [...transitions.queued];

      queued.push(
        "succeeded",
      );

      const fresh =
        JobMachine.transitions();

      expect(
        fresh.queued,
      ).not.toContain("succeeded");
    });
  });

  describe("job snapshot isolation", () => {
    it("create returns an isolated snapshot", () => {
      const engine = new JobEngine();

      const created = engine.create(
        "render",
        "snapshot-create",
      );

      created.logs.push(
        "external mutation",
      );

      const fresh =
        engine.getSnapshot(created.id);

      expect(
        fresh.logs,
      ).not.toContain(
        "external mutation",
      );
    });

    it("getSnapshot returns isolated nested checkpoint data", () => {
      const engine = new JobEngine();

      const created = engine.create(
        "render",
        "snapshot-nested",
        {
          checkpoint: {
            stage: {
              name: "render",
              frame: 100,
            },
          },
        },
      );

      const snapshot =
        engine.getSnapshot(created.id);

      (
        snapshot.checkpoint
          ?.stage as {
          name: string;
          frame: number;
        }
      ).name = "mutated";

      const fresh =
        engine.getSnapshot(created.id);

      expect(
        (
          fresh.checkpoint
            ?.stage as {
            name: string;
            frame: number;
          }
        ).name,
      ).toBe("render");
    });

    it("list returns isolated snapshots", () => {
      const engine = new JobEngine();

      engine.create(
        "render",
        "list-isolation",
      );

      const first =
        engine.list();

      first[0].logs.push(
        "external mutation",
      );

      const second =
        engine.list();

      expect(
        second[0].logs,
      ).not.toContain(
        "external mutation",
      );
    });
  });

  describe("idempotency integrity", () => {
    it("returns the same job for repeated creation", () => {
      const engine = new JobEngine();

      const first = engine.create(
        "render",
        "same-idempotency",
      );

      const second = engine.create(
        "render",
        "same-idempotency",
      );

      expect(second.id).toBe(
        first.id,
      );

      expect(
        engine.size(),
      ).toBe(1);
    });

    it("does not create a second job when an idempotent snapshot is modified", () => {
      const engine = new JobEngine();

      const first = engine.create(
        "render",
        "idempotent-isolation",
      );

      first.progress = 99;

      const second = engine.create(
        "render",
        "idempotent-isolation",
      );

      expect(
        second.progress,
      ).toBe(0);

      expect(
        engine.size(),
      ).toBe(1);
    });

    it("keeps different idempotency keys independent", () => {
      const engine = new JobEngine();

      const first = engine.create(
        "render",
        "key-a",
      );

      const second = engine.create(
        "render",
        "key-b",
      );

      expect(second.id).not.toBe(
        first.id,
      );

      expect(
        engine.size(),
      ).toBe(2);
    });
  });

  describe("progress invariants", () => {
    it("allows equal progress", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "equal-progress",
        {
          initialProgress: 50,
        },
      );

      const updated =
        engine.setProgress(
          job.id,
          50,
        );

      expect(
        updated.progress,
      ).toBe(50);
    });

    it("allows progress to increase in multiple steps", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "step-progress",
      );

      engine.setProgress(
        job.id,
        10,
      );

      engine.setProgress(
        job.id,
        25,
      );

      engine.setProgress(
        job.id,
        50,
      );

      const final =
        engine.setProgress(
          job.id,
          100,
        );

      expect(
        final.progress,
      ).toBe(100);
    });

    it("does not allow succeeded jobs to move below 100", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "succeeded-progress",
      );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.finalize(job.id);
      engine.succeed(job.id);

      expect(() =>
        engine.setProgress(
          job.id,
          99,
        ),
      ).toThrow();
    });

    it("does not allow cancelled jobs to update progress", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "cancelled-progress",
      );

      engine.cancel(job.id);

      expect(() =>
        engine.setProgress(
          job.id,
          50,
        ),
      ).toThrow();
    });
  });

  describe("checkpoint integrity", () => {
    it("replaces checkpoints atomically", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "checkpoint-replace",
        {
          checkpoint: {
            frame: 10,
          },
        },
      );

      const updated =
        engine.setCheckpoint(
          job.id,
          {
            frame: 20,
            stage: "render",
          },
        );

      expect(
        updated.checkpoint,
      ).toEqual({
        frame: 20,
        stage: "render",
      });
    });

    it("does not retain references to checkpoint input objects", () => {
      const engine = new JobEngine();

      const checkpoint = {
        frame: 100,
        nested: {
          stage: "render",
        },
      };

      const job = engine.create(
        "render",
        "checkpoint-reference",
        {
          checkpoint,
        },
      );

      checkpoint.frame = 999;
      checkpoint.nested.stage =
        "mutated";

      const fresh =
        engine.getSnapshot(job.id);

      expect(
        fresh.checkpoint,
      ).toEqual({
        frame: 100,
        nested: {
          stage: "render",
        },
      });
    });

    it("does not retain references when replacing checkpoints", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "checkpoint-replacement-reference",
      );

      const checkpoint = {
        frame: 300,
        metadata: {
          stage: "encoding",
        },
      };

      engine.setCheckpoint(
        job.id,
        checkpoint,
      );

      checkpoint.metadata.stage =
        "mutated";

      const fresh =
        engine.getSnapshot(job.id);

      expect(
        fresh.checkpoint,
      ).toEqual({
        frame: 300,
        metadata: {
          stage: "encoding",
        },
      });
    });
  });

  describe("log safety", () => {
    it("keeps at most 1000 log entries", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "log-limit",
      );

      for (
        let index = 0;
        index < 1_100;
        index += 1
      ) {
        engine.log(
          job.id,
          `log-${index}`,
        );
      }

      const fresh =
        engine.getSnapshot(job.id);

      expect(
        fresh.logs.length,
      ).toBe(1000);

      expect(
        fresh.logs.at(-1),
      ).toBe("log-1099");
    });

    it("truncates a single oversized log message", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "log-message-limit",
      );

      const message =
        "x".repeat(10_000);

      const updated =
        engine.log(
          job.id,
          message,
        );

      expect(
        updated.logs.at(-1),
      ).toHaveLength(4_096);
    });
  });

  describe("lifecycle timestamp integrity", () => {
    it("sets startedAt only when entering running", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "timestamp-running",
      );

      const preparing =
        engine.prepare(job.id);

      expect(
        preparing.startedAt,
      ).toBeUndefined();

      const running =
        engine.start(job.id);

      expect(
        running.startedAt,
      ).toBeTypeOf("string");
    });

    it("sets completedAt when succeeding", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "timestamp-success",
      );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.finalize(job.id);

      const succeeded =
        engine.succeed(job.id);

      expect(
        succeeded.completedAt,
      ).toBeTypeOf("string");
    });

    it("sets completedAt when cancelled", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "timestamp-cancel",
      );

      const cancelled =
        engine.cancel(job.id);

      expect(
        cancelled.completedAt,
      ).toBeTypeOf("string");
    });

    it("preserves the first startedAt across retry", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "timestamp-retry",
      );

      engine.prepare(job.id);

      const first =
        engine.start(job.id);

      const firstStartedAt =
        first.startedAt;

      engine.fail(
        job.id,
        "temporary failure",
      );

      engine.retry(job.id);
      engine.prepare(job.id);

      const second =
        engine.start(job.id);

      expect(
        second.startedAt,
      ).toBe(firstStartedAt);
    });
  });

  describe("failure and retry integrity", () => {
    it("stores the failure message", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "failure-message",
      );

      engine.prepare(job.id);
      engine.start(job.id);

      const failed =
        engine.fail(
          job.id,
          "Renderer crashed",
        );

      expect(
        failed.error,
      ).toBe("Renderer crashed");
    });

    it("records failure in logs", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "failure-log",
      );

      engine.prepare(job.id);
      engine.start(job.id);

      const failed =
        engine.fail(
          job.id,
          "Renderer crashed",
        );

      expect(
        failed.logs.at(-1),
      ).toBe(
        "error:Renderer crashed",
      );
    });

    it("increments attempts after retry", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "retry-attempt",
      );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.fail(
        job.id,
        "failure",
      );

      const retried =
        engine.retry(job.id);

      expect(
        retried.attempts,
      ).toBe(1);
    });

    it("clears the error after returning to queued", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "retry-clear-error",
      );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.fail(
        job.id,
        "temporary failure",
      );

      const retried =
        engine.retry(job.id);

      expect(
        retried.error,
      ).toBeUndefined();

      expect(
        retried.state,
      ).toBe("queued");
    });
  });

  describe("cancellation integrity", () => {
    it("cancels queued jobs immediately", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "cancel-queued-hardening",
      );

      const cancelled =
        engine.cancel(job.id);

      expect(
        cancelled.state,
      ).toBe("cancelled");
    });

    it("requests cancellation for preparing jobs", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "cancel-preparing-hardening",
      );

      engine.prepare(job.id);

      const cancelling =
        engine.cancel(job.id);

      expect(
        cancelling.state,
      ).toBe("cancelling");
    });

    it("requests cancellation for running jobs", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "cancel-running-hardening",
      );

      engine.prepare(job.id);
      engine.start(job.id);

      const cancelling =
        engine.cancel(job.id);

      expect(
        cancelling.state,
      ).toBe("cancelling");
    });

    it("completes an active cancellation", () => {
      const engine = new JobEngine();

      const job = engine.create(
        "render",
        "complete-cancel-hardening",
      );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.cancel(job.id);

      const cancelled =
        engine.completeCancellation(
          job.id,
        );

      expect(
        cancelled.state,
      ).toBe("cancelled");
    });

    it("does not allow cancellation of terminal jobs", () => {
      const engine = new JobEngine();

      const succeeded =
        engine.create(
          "render",
          "cancel-terminal-success",
        );

      engine.prepare(
        succeeded.id,
      );
      engine.start(
        succeeded.id,
      );
      engine.finalize(
        succeeded.id,
      );
      engine.succeed(
        succeeded.id,
      );

      expect(() =>
        engine.cancel(
          succeeded.id,
        ),
      ).toThrow();

      const cancelled =
        engine.create(
          "render",
          "cancel-terminal-cancelled",
        );

      engine.cancel(
        cancelled.id,
      );

      expect(() =>
        engine.cancel(
          cancelled.id,
        ),
      ).toThrow();
    });
  });

  describe("queue integrity", () => {
    it("returns only queued jobs from queued()", () => {
      const engine = new JobEngine();

      const queued =
        engine.create(
          "render",
          "queue-only",
        );

      const running =
        engine.create(
          "render",
          "queue-running",
        );

      engine.prepare(
        running.id,
      );

      const result =
        engine.queued();

      expect(
        result.map(
          (job) => job.id,
        ),
      ).toEqual([
        queued.id,
      ]);
    });

    it("filters by multiple states", () => {
      const engine = new JobEngine();

      const queued =
        engine.create(
          "render",
          "filter-queued",
        );

      const running =
        engine.create(
          "render",
          "filter-running",
        );

      engine.prepare(
        running.id,
      );
      engine.start(
        running.id,
      );

      const result =
        engine.list({
          states: [
            "queued",
            "running",
          ],
        });

      const ids =
        result.map(
          (job) => job.id,
        );

      expect(ids).toContain(
        queued.id,
      );

      expect(ids).toContain(
        running.id,
      );

      expect(result).toHaveLength(
        2,
      );
    });

    it("does not mutate internal ordering when list results are modified", () => {
      const engine = new JobEngine();

      const first =
        engine.create(
          "render",
          "ordering-first",
        );

      const second =
        engine.create(
          "render",
          "ordering-second",
        );

      const result =
        engine.list();

      result.reverse();

      const fresh =
        engine.list();

      expect(
        fresh.map(
          (job) => job.id,
        ),
      ).toEqual([
        first.id,
        second.id,
      ]);
    });
  });

  describe("statistics integrity", () => {
    it("reports zero for empty engine", () => {
      const engine = new JobEngine();

      expect(
        engine.statistics(),
      ).toEqual({
        queued: 0,
        preparing: 0,
        running: 0,
        finalizing: 0,
        succeeded: 0,
        cancelling: 0,
        cancelled: 0,
        failed: 0,
        retrying: 0,
      });
    });

    it("keeps statistics synchronized with lifecycle state", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "statistics-lifecycle",
        );

      expect(
        engine.statistics().queued,
      ).toBe(1);

      engine.prepare(job.id);

      expect(
        engine.statistics().preparing,
      ).toBe(1);

      engine.start(job.id);

      expect(
        engine.statistics().running,
      ).toBe(1);

      engine.finalize(job.id);

      expect(
        engine.statistics().finalizing,
      ).toBe(1);

      engine.succeed(job.id);

      const stats =
        engine.statistics();

      expect(
        stats.succeeded,
      ).toBe(1);

      expect(
        stats.finalizing,
      ).toBe(0);
    });
  });

  describe("removal and cleanup", () => {
    it("removes completed jobs", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "remove-success",
        );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.finalize(job.id);
      engine.succeed(job.id);

      engine.remove(job.id);

      expect(
        engine.size(),
      ).toBe(0);
    });

    it("removes cancelled jobs", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "remove-cancel",
        );

      engine.cancel(job.id);
      engine.remove(job.id);

      expect(
        engine.size(),
      ).toBe(0);
    });

    it("does not remove preparing jobs", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "remove-preparing",
        );

      engine.prepare(job.id);

      expect(() =>
        engine.remove(job.id),
      ).toThrow();
    });

    it("does not remove running jobs", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "remove-running",
        );

      engine.prepare(job.id);
      engine.start(job.id);

      expect(() =>
        engine.remove(job.id),
      ).toThrow();
    });

    it("does not remove finalizing jobs", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "remove-finalizing",
        );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.finalize(job.id);

      expect(() =>
        engine.remove(job.id),
      ).toThrow();
    });

    it("does not remove cancelling jobs", () => {
      const engine = new JobEngine();

      const job =
        engine.create(
          "render",
          "remove-cancelling",
        );

      engine.prepare(job.id);
      engine.start(job.id);
      engine.cancel(job.id);

      expect(() =>
        engine.remove(job.id),
      ).toThrow();
    });

    it("releases idempotency after removal", () => {
      const engine = new JobEngine();

      const first =
        engine.create(
          "render",
          "cleanup-key",
        );

      engine.remove(
        first.id,
      );

      const second =
        engine.create(
          "render",
          "cleanup-key",
        );

      expect(
        second.id,
      ).not.toBe(first.id);

      expect(
        engine.size(),
      ).toBe(1);
    });
  });
});