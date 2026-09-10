import { describe, expect, it, vi } from "vitest";

import {
  SequentialWorker,
  createWorker,
  type WorkerTask,
} from "../packages/worker/src/index.js";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

/* -------------------------------------------------------------------------- */
/* Worker Identity                                                            */
/* -------------------------------------------------------------------------- */

describe("SequentialWorker", () => {
  it("starts idle", () => {
    const worker = new SequentialWorker();

    expect(worker.state).toBe("idle");
    expect(worker.currentTask).toBeUndefined();
  });

  it("creates a deterministic configured worker identity", () => {
    const worker = new SequentialWorker({
      id: "worker-001",
      name: "Render Worker",
      capabilities: [
        "render.2d",
        "render.3d",
      ],
    });

    expect(worker.id).toBe("worker-001");
    expect(worker.name).toBe("Render Worker");

    expect(worker.getCapabilities()).toEqual([
      "render.2d",
      "render.3d",
    ]);
  });

  it("generates an id when one is not supplied", () => {
    const worker = new SequentialWorker();

    expect(worker.id).toMatch(/^worker-/);
    expect(worker.name).toBe(worker.id);
  });

  it("removes duplicate capabilities", () => {
    const worker = new SequentialWorker({
      capabilities: [
        "render.2d",
        "render.2d",
        "audio",
      ],
    });

    expect(worker.getCapabilities()).toEqual([
      "render.2d",
      "audio",
    ]);
  });

  it("returns a defensive capability array", () => {
    const worker = new SequentialWorker({
      capabilities: [
        "render.2d",
      ],
    });

    const capabilities =
      worker.getCapabilities();

    capabilities.push("audio");

    expect(worker.getCapabilities()).toEqual([
      "render.2d",
    ]);
  });

  it("checks worker capabilities", () => {
    const worker = new SequentialWorker({
      capabilities: [
        "render.2d",
        "audio.mix",
      ],
    });

    expect(
      worker.hasCapability("render.2d"),
    ).toBe(true);

    expect(
      worker.hasCapability("render.3d"),
    ).toBe(false);
  });

  it("rejects invalid worker ids", () => {
    expect(
      () =>
        new SequentialWorker({
          id: "   ",
        }),
    ).toThrow(
      "Worker id must be a non-empty string.",
    );
  });

  it("rejects invalid worker names", () => {
    expect(
      () =>
        new SequentialWorker({
          name: "   ",
        }),
    ).toThrow(
      "Worker name must be a non-empty string.",
    );
  });

  it("rejects invalid capabilities", () => {
    expect(
      () =>
        new SequentialWorker({
          capabilities: [
            "   ",
          ],
        }),
    ).toThrow(
      "Worker capability must be a non-empty string.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Basic Execution                                                          */
  /* ------------------------------------------------------------------------ */

  it("runs a simple async task", async () => {
    const worker =
      new SequentialWorker();

    const result =
      await worker.run(
        async () => "done",
      );

    expect(result).toBe("done");
    expect(worker.state).toBe("idle");
  });

  it("supports the WorkerTask interface", async () => {
    const worker =
      new SequentialWorker();

    const task: WorkerTask<string> = {
      id: "task-001",

      async run(signal) {
        expect(signal).toBeInstanceOf(
          AbortSignal,
        );

        return "rendered";
      },
    };

    const result =
      await worker.run(task);

    expect(result).toBe("rendered");
  });

  it("passes an AbortSignal to tasks", async () => {
    const worker =
      new SequentialWorker();

    let receivedSignal:
      | AbortSignal
      | undefined;

    await worker.run({
      id: "signal-task",

      async run(signal) {
        receivedSignal = signal;

        return true;
      },
    });

    expect(receivedSignal).toBeInstanceOf(
      AbortSignal,
    );

    expect(
      receivedSignal?.aborted,
    ).toBe(false);
  });

  it("returns task results without mutation", async () => {
    const worker =
      new SequentialWorker();

    const result =
      await worker.run({
        id: "object-task",

        async run() {
          return {
            frame: 100,
            stage: "render",
          };
        },
      });

    expect(result).toEqual({
      frame: 100,
      stage: "render",
    });
  });

  it("returns to idle after successful execution", async () => {
    const worker =
      new SequentialWorker();

    await worker.run(
      async () => "ok",
    );

    expect(worker.state).toBe("idle");
    expect(worker.currentTask).toBeUndefined();
  });

  it("returns to idle after failed execution", async () => {
    const worker =
      new SequentialWorker();

    await expect(
      worker.run(
        async () => {
          throw new Error(
            "render failed",
          );
        },
      ),
    ).rejects.toThrow(
      "render failed",
    );

    expect(worker.state).toBe("idle");
    expect(worker.currentTask).toBeUndefined();
  });

  it("propagates the original task error", async () => {
    const worker =
      new SequentialWorker();

    const error =
      new Error(
        "FFmpeg failed",
      );

    await expect(
      worker.run(
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);
  });

  /* ------------------------------------------------------------------------ */
  /* Sequential Guarantee                                                     */
  /* ------------------------------------------------------------------------ */

  it("rejects a second task while busy", async () => {
    const worker =
      new SequentialWorker();

    let release:
      | (() => void)
      | undefined;

    const first =
      worker.run({
        id: "first",

        async run() {
          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );

          return "first";
        },
      });

    await sleep(5);

    expect(worker.state).toBe(
      "running",
    );

    await expect(
      worker.run(
        async () => "second",
      ),
    ).rejects.toThrow(
      "Worker is busy.",
    );

    release?.();

    await expect(first).resolves.toBe(
      "first",
    );

    expect(worker.state).toBe("idle");
  });

  it("counts rejected concurrent tasks", async () => {
    const worker =
      new SequentialWorker();

    let release:
      | (() => void)
      | undefined;

    const first =
      worker.run({
        id: "busy-task",

        async run() {
          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );
        },
      });

    await sleep(5);

    await expect(
      worker.run(
        async () => undefined,
      ),
    ).rejects.toThrow(
      "Worker is busy.",
    );

    release?.();

    await first;

    expect(
      worker.statistics().totalRejected,
    ).toBe(1);
  });

  /* ------------------------------------------------------------------------ */
  /* Statistics                                                               */
  /* ------------------------------------------------------------------------ */

  it("tracks successful tasks", async () => {
    const worker =
      new SequentialWorker();

    await worker.run(
      async () => 1,
    );

    await worker.run(
      async () => 2,
    );

    const stats =
      worker.statistics();

    expect(stats.totalStarted).toBe(2);
    expect(stats.totalSucceeded).toBe(2);
    expect(stats.totalFailed).toBe(0);
  });

  it("tracks failed tasks", async () => {
    const worker =
      new SequentialWorker();

    await expect(
      worker.run(
        async () => {
          throw new Error(
            "failure",
          );
        },
      ),
    ).rejects.toThrow(
      "failure",
    );

    const stats =
      worker.statistics();

    expect(stats.totalStarted).toBe(1);
    expect(stats.totalFailed).toBe(1);
    expect(stats.totalSucceeded).toBe(0);
  });

  it("reports current task while running", async () => {
    const worker =
      new SequentialWorker();

    let observedState:
      | string
      | undefined;

    let observedTask:
      | string
      | undefined;

    let release:
      | (() => void)
      | undefined;

    const running =
      worker.run({
        id: "observe-task",

        async run() {
          observedState =
            worker.state;

          observedTask =
            worker.currentTask;

          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );
        },
      });

    await sleep(5);

    expect(observedState).toBe(
      "running",
    );

    expect(observedTask).toBe(
      "observe-task",
    );

    release?.();

    await running;
  });

  it("reports idle state after completion", async () => {
    const worker =
      new SequentialWorker();

    await worker.run({
      id: "complete-task",

      async run() {
        return true;
      },
    });

    const stats =
      worker.statistics();

    expect(stats.state).toBe("idle");
    expect(
      stats.currentTaskId,
    ).toBeUndefined();
  });

  /* ------------------------------------------------------------------------ */
  /* Metadata                                                                  */
  /* ------------------------------------------------------------------------ */

  it("accepts task metadata", async () => {
    const worker =
      new SequentialWorker();

    const result =
      await worker.execute(
        {
          id: "metadata-task",

          async run() {
            return "ok";
          },
        },
        {
          metadata: {
            projectId: "project-1",
            frame: 100,
          },
        },
      );

    expect(result.task.metadata).toEqual({
      projectId: "project-1",
      frame: 100,
    });
  });

  it("protects metadata from external mutation", async () => {
    const worker =
      new SequentialWorker();

    const metadata = {
      nested: {
        frame: 10,
      },
    };

    const result =
      await worker.execute(
        {
          id: "metadata-clone",

          async run() {
            return true;
          },
        },
        {
          metadata,
        },
      );

    metadata.nested.frame =
      999;

    expect(
      result.task.metadata,
    ).toEqual({
      nested: {
        frame: 10,
      },
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Structured Execution                                                     */
  /* ------------------------------------------------------------------------ */

  it("returns a successful structured task record", async () => {
    const worker =
      new SequentialWorker({
        id: "worker-structured",
      });

    const result =
      await worker.execute({
        id: "structured-task",

        async run() {
          return {
            video: "output.mp4",
          };
        },
      });

    expect(result.task.id).toBe(
      "structured-task",
    );

    expect(result.task.state).toBe(
      "succeeded",
    );

    expect(result.task.result).toEqual({
      video: "output.mp4",
    });

    expect(
      result.task.startedAt,
    ).toBeTypeOf("string");

    expect(
      result.task.completedAt,
    ).toBeTypeOf("string");

    expect(
      result.task.durationMs,
    ).toBeTypeOf("number");
  });

  it("returns a failed structured task record", async () => {
    const worker =
      new SequentialWorker();

    const result =
      await worker.execute({
        id: "failed-task",

        async run() {
          throw new Error(
            "render failure",
          );
        },
      });

    expect(result.task.state).toBe(
      "failed",
    );

    expect(result.task.error).toBe(
      "render failure",
    );

    expect(
      result.task.completedAt,
    ).toBeTypeOf("string");
  });

  it("does not throw from structured execute on task failure", async () => {
    const worker =
      new SequentialWorker();

    await expect(
      worker.execute({
        id: "safe-failure",

        async run() {
          throw new Error(
            "safe error",
          );
        },
      }),
    ).resolves.toBeDefined();
  });

  /* ------------------------------------------------------------------------ */
  /* Cancellation                                                              */
  /* ------------------------------------------------------------------------ */

  it("returns false when cancelling an idle worker", () => {
    const worker =
      new SequentialWorker();

    expect(
      worker.cancel(),
    ).toBe(false);
  });

  it("cancels an active task through AbortSignal", async () => {
    const worker =
      new SequentialWorker();

    const task =
      worker.run({
        id: "cancel-task",

        async run(signal) {
          await new Promise<void>(
            (resolve, reject) => {
              const timer =
                setTimeout(
                  resolve,
                  1_000,
                );

              signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  reject(
                    new Error(
                      "aborted by worker",
                    ),
                  );
                },
                {
                  once: true,
                },
              );
            },
          );
        },
      });

    await sleep(10);

    expect(
      worker.cancel(),
    ).toBe(true);

    await expect(task).rejects.toThrow(
      "cancelled",
    );

    expect(worker.state).toBe("idle");
    expect(
      worker.statistics()
        .totalCancelled,
    ).toBe(1);
  });

  it("does not cancel an already aborted task twice", async () => {
    const worker =
      new SequentialWorker();

    let firstCancel = false;
    let secondCancel = false;

    const task =
      worker.run({
        id: "double-cancel",

        async run(signal) {
          await new Promise<void>(
            (_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => {
                  reject(
                    new Error(
                      "cancelled",
                    ),
                  );
                },
                {
                  once: true,
                },
              );
            },
          );
        },
      });

    await sleep(10);

    firstCancel =
      worker.cancel();

    secondCancel =
      worker.cancel();

    await expect(task).rejects.toThrow(
      "cancelled",
    );

    expect(firstCancel).toBe(true);
    expect(secondCancel).toBe(false);
  });

  /* ------------------------------------------------------------------------ */
  /* Timeout                                                                  */
  /* ------------------------------------------------------------------------ */

  it("times out a task", async () => {
    const worker =
      new SequentialWorker();

    const task =
      worker.run(
        {
          id: "timeout-task",

          async run(signal) {
            await new Promise<void>(
              (_resolve, reject) => {
                signal.addEventListener(
                  "abort",
                  () => {
                    reject(
                      new Error(
                        "task observed abort",
                      ),
                    );
                  },
                  {
                    once: true,
                  },
                );
              },
            );
          },
        },
        {
          timeoutMs: 20,
        },
      );

    await expect(task).rejects.toThrow(
      "timed out after 20 ms",
    );

    expect(worker.state).toBe("idle");

    expect(
      worker.statistics()
        .totalTimedOut,
    ).toBe(1);
  });

  it("does not timeout when timeout is zero", async () => {
    const worker =
      new SequentialWorker({
        defaultTimeoutMs: 0,
      });

    const result =
      await worker.run(
        async () => {
          await sleep(20);
          return "completed";
        },
      );

    expect(result).toBe(
      "completed",
    );

    expect(
      worker.statistics()
        .totalTimedOut,
    ).toBe(0);
  });

  it("supports a default worker timeout", async () => {
    const worker =
      new SequentialWorker({
        defaultTimeoutMs: 15,
      });

    const task =
      worker.run({
        id: "default-timeout",

        async run(signal) {
          await new Promise<void>(
            (_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () =>
                  reject(
                    new Error(
                      "aborted",
                    ),
                  ),
                {
                  once: true,
                },
              );
            },
          );
        },
      });

    await expect(task).rejects.toThrow(
      "timed out after 15 ms",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Heartbeat                                                                */
  /* ------------------------------------------------------------------------ */

  it("creates a heartbeat snapshot", () => {
    const worker =
      new SequentialWorker({
        id: "heartbeat-worker",
      });

    const heartbeat =
      worker.heartbeat();

    expect(
      heartbeat.workerId,
    ).toBe("heartbeat-worker");

    expect(
      heartbeat.state,
    ).toBe("idle");

    expect(
      heartbeat.timestamp,
    ).toBeTypeOf("string");

    expect(
      heartbeat.uptimeMs,
    ).toBeGreaterThanOrEqual(0);
  });

  it("tracks the current task in heartbeat", async () => {
    const worker =
      new SequentialWorker({
        id: "heartbeat-task-worker",
      });

    let release:
      | (() => void)
      | undefined;

    const task =
      worker.run({
        id: "heartbeat-task",

        async run() {
          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );
        },
      });

    await sleep(5);

    const heartbeat =
      worker.heartbeat();

    expect(
      heartbeat.taskId,
    ).toBe("heartbeat-task");

    expect(
      heartbeat.state,
    ).toBe("running");

    release?.();

    await task;
  });

  it("updates heartbeat periodically", async () => {
    vi.useFakeTimers();

    try {
      const worker =
        new SequentialWorker({
          id: "periodic-heartbeat",
          heartbeatIntervalMs: 50,
        });

      let release:
        | (() => void)
        | undefined;

      const task =
        worker.run({
          id: "heartbeat-periodic-task",

          async run() {
            await new Promise<void>(
              (resolve) => {
                release = resolve;
              },
            );
          },
        });

      await vi.advanceTimersByTimeAsync(
        60,
      );

      const heartbeat =
        worker.getLastHeartbeat();

      expect(
        heartbeat,
      ).toBeDefined();

      expect(
        heartbeat?.taskId,
      ).toBe(
        "heartbeat-periodic-task",
      );

      release?.();

      await task;
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns defensive heartbeat snapshots", () => {
    const worker =
      new SequentialWorker();

    const first =
      worker.heartbeat();

    first.timestamp =
      "mutated";

    const second =
      worker.getLastHeartbeat();

    expect(
      second?.timestamp,
    ).not.toBe("mutated");
  });

  /* ------------------------------------------------------------------------ */
  /* Shutdown                                                                 */
  /* ------------------------------------------------------------------------ */

  it("shuts down an idle worker", async () => {
    const worker =
      new SequentialWorker();

    await worker.shutdown();

    expect(worker.state).toBe(
      "idle",
    );
  });

  it("waits for an active task during graceful shutdown", async () => {
    const worker =
      new SequentialWorker();

    let release:
      | (() => void)
      | undefined;

    const task =
      worker.run({
        id: "shutdown-task",

        async run() {
          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );

          return "done";
        },
      });

    await sleep(5);

    const shutdown =
      worker.shutdown(true);

    await sleep(5);

    expect(
      worker.state,
    ).toBe("stopping");

    release?.();

    await task;
    await shutdown;

    expect(worker.state).toBe("idle");
  });

  it("rejects new tasks while stopping", async () => {
    const worker =
      new SequentialWorker();

    let release:
      | (() => void)
      | undefined;

    const task =
      worker.run({
        id: "stop-task",

        async run() {
          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );
        },
      });

    await sleep(5);

    const shutdown =
      worker.shutdown(true);

    await sleep(5);

    await expect(
      worker.run(
        async () => "blocked",
      ),
    ).rejects.toThrow(
      "Worker is stopping.",
    );

    release?.();

    await task;
    await shutdown;
  });

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  it("rejects invalid default timeout", () => {
    expect(
      () =>
        new SequentialWorker({
          defaultTimeoutMs:
            -1,
        }),
    ).toThrow(
      "Worker default timeout must be a non-negative integer.",
    );
  });

  it("rejects invalid heartbeat interval", () => {
    expect(
      () =>
        new SequentialWorker({
          heartbeatIntervalMs: 0,
        }),
    ).toThrow(
      "Worker heartbeat interval must be a positive integer.",
    );
  });

  it("rejects invalid task ids", async () => {
    const worker =
      new SequentialWorker();

    await expect(
      worker.run({
        id: "   ",

        async run() {
          return true;
        },
      }),
    ).rejects.toThrow(
      "Worker task id must be a non-empty string.",
    );
  });

  it("rejects invalid task metadata", async () => {
    const worker =
      new SequentialWorker();

    await expect(
      worker.execute(
        {
          id: "invalid-metadata",

          async run() {
            return true;
          },
        },
        {
          metadata:
            [] as unknown as Record<
              string,
              unknown
            >,
        },
      ),
    ).rejects.toThrow(
      "Worker task metadata must be an object.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Factory                                                                  */
  /* ------------------------------------------------------------------------ */

  it("creates a worker through the factory", () => {
    const worker =
      createWorker({
        id: "factory-worker",
        name: "Factory Worker",
      });

    expect(
      worker,
    ).toBeInstanceOf(
      SequentialWorker,
    );

    expect(worker.id).toBe(
      "factory-worker",
    );

    expect(worker.name).toBe(
      "Factory Worker",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Long Running Task                                                        */
  /* ------------------------------------------------------------------------ */

  it("keeps the worker locked until the task promise settles", async () => {
    const worker =
      new SequentialWorker();

    let release:
      | (() => void)
      | undefined;

    const first =
      worker.run({
        id: "long-task",

        async run() {
          await new Promise<void>(
            (resolve) => {
              release = resolve;
            },
          );

          return "finished";
        },
      });

    await sleep(5);

    expect(worker.state).toBe(
      "running",
    );

    expect(
      worker.currentTask,
    ).toBe("long-task");

    release?.();

    await expect(first).resolves.toBe(
      "finished",
    );

    expect(worker.state).toBe("idle");
  });

  it("allows a new task after the previous task settles", async () => {
    const worker =
      new SequentialWorker();

    const first =
      await worker.run(
        async () => "first",
      );

    const second =
      await worker.run(
        async () => "second",
      );

    expect(first).toBe("first");
    expect(second).toBe("second");

    expect(
      worker.statistics()
        .totalStarted,
    ).toBe(2);
  });
});