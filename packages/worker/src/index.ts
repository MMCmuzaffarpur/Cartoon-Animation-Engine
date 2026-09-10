/* -------------------------------------------------------------------------- */
/* Worker Engine                                                              */
/* -------------------------------------------------------------------------- */

export interface WorkerTask<T = unknown> {
  id: string;
  run(signal: AbortSignal): Promise<T>;
}

export type WorkerState = "idle" | "running" | "stopping";

export interface WorkerOptions {
  id?: string;
  name?: string;
  capabilities?: string[];
  defaultTimeoutMs?: number;
  heartbeatIntervalMs?: number;
}

export interface WorkerTaskOptions {
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkerTaskRecord<T = unknown> {
  id: string;
  state: "running" | "succeeded" | "failed" | "cancelled" | "timed_out";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerExecutionResult<T = unknown> {
  task: WorkerTaskRecord<T>;
}

export interface WorkerStatistics {
  workerId: string;
  state: WorkerState;
  currentTaskId?: string;
  totalStarted: number;
  totalSucceeded: number;
  totalFailed: number;
  totalCancelled: number;
  totalTimedOut: number;
  totalRejected: number;
  uptimeMs: number;
}

export interface WorkerHeartbeat {
  workerId: string;
  state: WorkerState;
  taskId?: string;
  timestamp: string;
  uptimeMs: number;
}

function cloneValue<T>(value: T): T {
  if (value === undefined) return value;

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function elapsedMs(start: number): number {
  return Math.max(0, Date.now() - start);
}

function validateNonEmptyString(
  value: unknown,
  message: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
}

function validateNonNegativeInteger(
  value: unknown,
  message: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(message);
  }
}

function validatePositiveInteger(
  value: unknown,
  message: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export class SequentialWorker {
  public readonly id: string;
  public readonly name: string;

  private readonly capabilities: string[];
  private readonly defaultTimeoutMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly startedAtMs: number;

  private active = false;
  private stopping = false;
  private currentTaskIdValue: string | undefined;

  private activeController: AbortController | undefined;
  private activeCancellationRequested = false;
  private activeTimedOut = false;

  private shutdownPromise: Promise<void> | undefined;
  private shutdownResolve: (() => void) | undefined;

  private heartbeatTimer:
    | ReturnType<typeof setInterval>
    | undefined;

  private lastHeartbeatValue: WorkerHeartbeat;

  private totalStartedValue = 0;
  private totalSucceededValue = 0;
  private totalFailedValue = 0;
  private totalCancelledValue = 0;
  private totalTimedOutValue = 0;
  private totalRejectedValue = 0;

  constructor(options: WorkerOptions = {}) {
    if (options.id !== undefined) {
      validateNonEmptyString(
        options.id,
        "Worker id must be a non-empty string.",
      );
    }

    if (options.name !== undefined) {
      validateNonEmptyString(
        options.name,
        "Worker name must be a non-empty string.",
      );
    }

    if (options.defaultTimeoutMs !== undefined) {
      validateNonNegativeInteger(
        options.defaultTimeoutMs,
        "Worker default timeout must be a non-negative integer.",
      );
    }

    if (options.heartbeatIntervalMs !== undefined) {
      validatePositiveInteger(
        options.heartbeatIntervalMs,
        "Worker heartbeat interval must be a positive integer.",
      );
    }

    const rawCapabilities = options.capabilities ?? [];

    for (const capability of rawCapabilities) {
      validateNonEmptyString(
        capability,
        "Worker capability must be a non-empty string.",
      );
    }

    const generatedId =
      options.id ??
      `worker-${crypto.randomUUID()}`;

    this.id = generatedId;
    this.name = options.name ?? generatedId;
    this.capabilities = [
      ...new Set(rawCapabilities.map((value) => value.trim())),
    ];

    this.defaultTimeoutMs =
      options.defaultTimeoutMs ?? 0;

    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? 1_000;

    this.startedAtMs = Date.now();

    this.lastHeartbeatValue = this.makeHeartbeat();

    this.startHeartbeat();
  }

  public get state(): WorkerState {
    if (this.stopping) return "stopping";
    return this.active ? "running" : "idle";
  }

  public get currentTask(): string | undefined {
    return this.currentTaskIdValue;
  }

  public getCapabilities(): string[] {
    return [...this.capabilities];
  }

  public hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  public statistics(): WorkerStatistics {
    return {
      workerId: this.id,
      state: this.state,
      currentTaskId: this.currentTaskIdValue,
      totalStarted: this.totalStartedValue,
      totalSucceeded: this.totalSucceededValue,
      totalFailed: this.totalFailedValue,
      totalCancelled: this.totalCancelledValue,
      totalTimedOut: this.totalTimedOutValue,
      totalRejected: this.totalRejectedValue,
      uptimeMs: elapsedMs(this.startedAtMs),
    };
  }

  public async run<T>(
    task: WorkerTask<T> | (() => Promise<T>),
    options: WorkerTaskOptions = {},
  ): Promise<T> {
    /*
     * Shutdown state MUST be checked before the busy state.
     * A stopping worker has priority over an active task.
     */
    if (this.stopping) {
      this.totalRejectedValue += 1;
      throw new Error("Worker is stopping.");
    }

    if (this.active) {
      this.totalRejectedValue += 1;
      throw new Error("Worker is busy.");
    }

    const normalized = this.normalizeTask(task);

    if (options.timeoutMs !== undefined) {
      validateNonNegativeInteger(
        options.timeoutMs,
        "Worker task timeout must be a non-negative integer.",
      );
    }

    const metadata = this.normalizeMetadata(options.metadata);

    this.active = true;
    this.currentTaskIdValue = normalized.id;
    this.activeController = new AbortController();
    this.activeCancellationRequested = false;
    this.activeTimedOut = false;
    this.totalStartedValue += 1;

    this.updateHeartbeat();

    const timeoutMs =
      options.timeoutMs ?? this.defaultTimeoutMs;

    let timeoutHandle:
      | ReturnType<typeof setTimeout>
      | undefined;

    try {
      const taskPromise = normalized.run(
        this.activeController.signal,
      );

      let executionPromise = taskPromise;

      if (timeoutMs > 0) {
        executionPromise = new Promise<T>(
          (resolve, reject) => {
            timeoutHandle = setTimeout(() => {
              if (!this.active) return;

              this.activeTimedOut = true;
              this.totalTimedOutValue += 1;

              this.activeController?.abort();

              reject(
                new Error(
                  `Worker task timed out after ${timeoutMs} ms`,
                ),
              );
            }, timeoutMs);

            taskPromise.then(
              resolve,
              reject,
            );
          },
        );
      }

      const result = await executionPromise;

      if (this.activeCancellationRequested) {
        throw new Error("Worker task cancelled.");
      }

      if (this.activeTimedOut) {
        throw new Error(
          `Worker task timed out after ${timeoutMs} ms`,
        );
      }

      this.totalSucceededValue += 1;
      return cloneValue(result);
    } catch (error) {
      if (this.activeCancellationRequested) {
        this.totalCancelledValue += 1;
        throw new Error("Worker task cancelled.");
      }

      if (this.activeTimedOut) {
        /*
         * The timeout counter was already incremented when the timer fired.
         */
        throw new Error(
          `Worker task timed out after ${timeoutMs} ms`,
        );
      }

      this.totalFailedValue += 1;
      throw error;
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }

      this.active = false;
      this.currentTaskIdValue = undefined;
      this.activeController = undefined;
      this.activeCancellationRequested = false;
      this.activeTimedOut = false;

      this.updateHeartbeat();

      if (
        this.stopping &&
        this.shutdownResolve !== undefined
      ) {
        const resolve =
          this.shutdownResolve;

        this.shutdownResolve = undefined;
        this.shutdownPromise = undefined;

        this.stopping = false;
        resolve();
        this.stopHeartbeat();
        this.updateHeartbeat();
        this.startHeartbeat();
      }
    }
  }

  public async execute<T>(
    task: WorkerTask<T>,
    options: WorkerTaskOptions = {},
  ): Promise<WorkerExecutionResult<T>> {
    validateNonEmptyString(
      task?.id,
      "Worker task id must be a non-empty string.",
    );

    const metadata = this.normalizeMetadata(options.metadata);
    const startedAt = nowIso();
    const startedAtMs = Date.now();

    const record: WorkerTaskRecord<T> = {
      id: task.id,
      state: "running",
      startedAt,
      ...(metadata === undefined
        ? {}
        : { metadata: cloneValue(metadata) }),
    };

    try {
      const result = await this.run(task, options);

      record.state = "succeeded";
      record.result = cloneValue(result);
      record.completedAt = nowIso();
      record.durationMs = elapsedMs(startedAtMs);

      return {
        task: cloneValue(record),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (message === "Worker task cancelled.") {
        record.state = "cancelled";
      } else if (
        message.startsWith(
          "Worker task timed out after ",
        )
      ) {
        record.state = "timed_out";
      } else {
        record.state = "failed";
      }

      record.error = message;
      record.completedAt = nowIso();
      record.durationMs = elapsedMs(startedAtMs);

      return {
        task: cloneValue(record),
      };
    }
  }

  public cancel(): boolean {
    if (!this.active || !this.activeController) {
      return false;
    }

    if (
      this.activeCancellationRequested ||
      this.activeController.signal.aborted
    ) {
      return false;
    }

    this.activeCancellationRequested = true;
    this.activeController.abort();

    this.updateHeartbeat();

    return true;
  }

  public heartbeat(): WorkerHeartbeat {
    const heartbeat = this.makeHeartbeat();
    this.lastHeartbeatValue = heartbeat;

    return cloneValue(heartbeat);
  }

  public getLastHeartbeat():
    | WorkerHeartbeat
    | undefined {
    return cloneValue(this.lastHeartbeatValue);
  }

  public async shutdown(
    graceful = false,
  ): Promise<void> {
    if (this.stopping) {
      return this.shutdownPromise ?? Promise.resolve();
    }

    if (!this.active) {
      this.stopHeartbeat();
      this.updateHeartbeat();
      return;
    }

    this.stopping = true;
    this.updateHeartbeat();

    this.shutdownPromise = new Promise<void>(
      (resolve) => {
        this.shutdownResolve = resolve;
      },
    );

    if (!graceful) {
      this.cancel();
    }

    return this.shutdownPromise;
  }

  private normalizeTask<T>(
    task: WorkerTask<T> | (() => Promise<T>),
  ): WorkerTask<T> {
    if (typeof task === "function") {
      return {
        id: `task-${crypto.randomUUID()}`,
        run: async () => task(),
      };
    }

    if (!task || typeof task !== "object") {
      throw new Error(
        "Worker task must be an object or function.",
      );
    }

    validateNonEmptyString(
      task.id,
      "Worker task id must be a non-empty string.",
    );

    if (typeof task.run !== "function") {
      throw new Error(
        "Worker task run must be a function.",
      );
    }

    return task;
  }

  private normalizeMetadata(
    metadata:
      | Record<string, unknown>
      | undefined,
  ): Record<string, unknown> | undefined {
    if (metadata === undefined) {
      return undefined;
    }

    if (!isRecord(metadata)) {
      throw new Error(
        "Worker task metadata must be an object.",
      );
    }

    return cloneValue(metadata);
  }

  private makeHeartbeat(): WorkerHeartbeat {
    return {
      workerId: this.id,
      state: this.state,
      taskId: this.currentTaskIdValue,
      timestamp: nowIso(),
      uptimeMs: elapsedMs(this.startedAtMs),
    };
  }

  private updateHeartbeat(): void {
    this.lastHeartbeatValue =
      this.makeHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer === undefined) {
      return;
    }

    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createWorker(
  options: WorkerOptions = {},
): SequentialWorker {
  return new SequentialWorker(options);
}
