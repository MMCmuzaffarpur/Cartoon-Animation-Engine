import { CaeError, uuid } from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Job State Machine                                                          */
/* -------------------------------------------------------------------------- */

export type JobState =
  | "queued"
  | "preparing"
  | "running"
  | "finalizing"
  | "succeeded"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "retrying";

const transitions: Record<
  JobState,
  readonly JobState[]
> = {
  queued: [
    "preparing",
    "cancelled",
  ],

  preparing: [
    "running",
    "cancelling",
    "failed",
  ],

  running: [
    "finalizing",
    "cancelling",
    "failed",
  ],

  finalizing: [
    "succeeded",
    "failed",
  ],

  succeeded: [],

  cancelling: [
    "cancelled",
    "failed",
  ],

  cancelled: [],

  failed: [
    "retrying",
  ],

  retrying: [
    "queued",
  ],
};

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export interface JobCheckpoint {
  [key: string]: unknown;
}

export interface JobRecord {
  id: string;

  type: string;

  state: JobState;

  progress: number;

  attempts: number;

  idempotencyKey: string;

  logs: string[];

  checkpoint?: JobCheckpoint;

  createdAt: string;

  updatedAt: string;

  startedAt?: string;

  completedAt?: string;

  error?: string;
}

export interface JobCreateOptions {
  idempotencyKey: string;

  initialProgress?: number;

  checkpoint?: JobCheckpoint;
}

export interface JobListOptions {
  states?: JobState[];

  type?: string;

  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MIN_PROGRESS = 0;

const MAX_PROGRESS = 100;

const DEFAULT_PROGRESS = 0;

const MAX_LOG_LENGTH = 4_096;

const MAX_LOG_ENTRIES = 1_000;

/* -------------------------------------------------------------------------- */
/* Safe Helpers                                                               */
/* -------------------------------------------------------------------------- */

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function validateNonEmptyString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `${field} must be a non-empty string.`,
    );
  }

  return value.trim();
}

function validateProgress(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      "Job progress must be a finite number.",
    );
  }

  if (
    value < MIN_PROGRESS ||
    value > MAX_PROGRESS
  ) {
    throw new Error(
      "Job progress must be between 0 and 100.",
    );
  }

  return value;
}

function normalizeProgress(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_PROGRESS;
  }

  return validateProgress(value);
}

function normalizeLog(
  message: string,
): string {
  const normalized =
    validateNonEmptyString(
      message,
      "Log message",
    );

  if (
    normalized.length >
    MAX_LOG_LENGTH
  ) {
    return normalized.slice(
      0,
      MAX_LOG_LENGTH,
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Job State Machine                                                          */
/* -------------------------------------------------------------------------- */

export class JobMachine {
  constructor(
    public state: JobState = "queued",

    public attempts = 0,

    public logs: string[] = [],
  ) {}

  canMove(
    next: JobState,
  ): boolean {
    return transitions[
      this.state
    ].includes(next);
  }

  move(
    next: JobState,
    message?: string,
  ): void {
    if (
      !this.canMove(next)
    ) {
      throw new CaeError(
        "JOB_NOT_RETRYABLE",
        `Invalid job transition ${this.state} -> ${next}`,
      );
    }

    this.state = next;

    if (
      next === "retrying"
    ) {
      this.attempts += 1;
    }

    if (
      message !== undefined
    ) {
      this.logs.push(
        normalizeLog(message),
      );
    } else {
      this.logs.push(
        `state:${next}`,
      );
    }

    if (
      this.logs.length >
      MAX_LOG_ENTRIES
    ) {
      this.logs =
        this.logs.slice(
          -MAX_LOG_ENTRIES,
        );
    }
  }

  static canTransition(
    from: JobState,
    to: JobState,
  ): boolean {
    return transitions[
      from
    ].includes(to);
  }

  static transitions(): Record<
    JobState,
    readonly JobState[]
  > {
    return {
      queued: [
        ...transitions.queued,
      ],

      preparing: [
        ...transitions.preparing,
      ],

      running: [
        ...transitions.running,
      ],

      finalizing: [
        ...transitions.finalizing,
      ],

      succeeded: [],

      cancelling: [
        ...transitions.cancelling,
      ],

      cancelled: [],

      failed: [
        ...transitions.failed,
      ],

      retrying: [
        ...transitions.retrying,
      ],
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Job Engine                                                                 */
/* -------------------------------------------------------------------------- */

export class JobEngine {
  private readonly jobs =
    new Map<string, JobRecord>();

  private readonly idempotency =
    new Map<string, string>();

  /* ------------------------------------------------------------------------ */
  /* Create                                                                    */
  /* ------------------------------------------------------------------------ */

  create(
    type: string,
    idempotencyKey: string,
    options: Omit<
      JobCreateOptions,
      "idempotencyKey"
    > = {},
  ): JobRecord {
    const normalizedType =
      validateNonEmptyString(
        type,
        "Job type",
      );

    const normalizedKey =
      validateNonEmptyString(
        idempotencyKey,
        "Idempotency key",
      );

    const existingId =
      this.idempotency.get(
        normalizedKey,
      );

    if (
      existingId !== undefined
    ) {
      return clone(
        this.get(
          existingId,
        ),
      );
    }

    const createdAt =
      now();

    const job: JobRecord = {
      id:
        uuid(),

      type:
        normalizedType,

      state:
        "queued",

      progress:
        normalizeProgress(
          options.initialProgress,
        ),

      attempts:
        0,

      idempotencyKey:
        normalizedKey,

      logs: [
        "state:queued",
      ],

      createdAt,

      updatedAt:
        createdAt,
    };

    if (
      options.checkpoint !==
      undefined
    ) {
      job.checkpoint =
        clone(
          options.checkpoint,
        );
    }

    this.jobs.set(
      job.id,
      job,
    );

    this.idempotency.set(
      normalizedKey,
      job.id,
    );

    return clone(job);
  }

  /* ------------------------------------------------------------------------ */
  /* Get                                                                       */
  /* ------------------------------------------------------------------------ */

  get(
    id: string,
  ): JobRecord {
    const normalizedId =
      validateNonEmptyString(
        id,
        "Job id",
      );

    const job =
      this.jobs.get(
        normalizedId,
      );

    if (
      !job
    ) {
      throw new CaeError(
        "JOB_NOT_FOUND",
        "Job not found",
        [normalizedId],
      );
    }

    return job;
  }

  /* ------------------------------------------------------------------------ */
  /* Safe Get                                                                  */
  /* ------------------------------------------------------------------------ */

  getSnapshot(
    id: string,
  ): JobRecord {
    return clone(
      this.get(id),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Transition                                                                */
  /* ------------------------------------------------------------------------ */

  transition(
    id: string,
    next: JobState,
    progress?: number,
    message?: string,
  ): JobRecord {
    const job =
      this.get(id);

    if (
      progress !== undefined
    ) {
      validateProgress(
        progress,
      );
    }

    const machine =
      new JobMachine(
        job.state,
        job.attempts,
        [...job.logs],
      );

    machine.move(
      next,
      message,
    );

    const timestamp =
      now();

    job.state =
      machine.state;

    job.attempts =
      machine.attempts;

    job.logs =
      machine.logs;

    if (
      progress !== undefined
    ) {
      job.progress =
        progress;
    }

    job.updatedAt =
      timestamp;

    if (
      next === "running" &&
      job.startedAt ===
        undefined
    ) {
      job.startedAt =
        timestamp;
    }

    if (
      next === "succeeded" ||
      next === "cancelled"
    ) {
      job.progress =
        next === "succeeded"
          ? 100
          : job.progress;

      job.completedAt =
        timestamp;
    }

    if (
      next === "queued"
    ) {
      job.error =
        undefined;
    }

    return clone(job);
  }

  /* ------------------------------------------------------------------------ */
  /* Progress                                                                  */
  /* ------------------------------------------------------------------------ */

  setProgress(
    id: string,
    progress: number,
  ): JobRecord {
    const job =
      this.get(id);

    const normalized =
      validateProgress(
        progress,
      );

    if (
      job.state ===
        "succeeded" &&
      normalized !== 100
    ) {
      throw new Error(
        "A succeeded job must remain at 100% progress.",
      );
    }

    if (
      job.state ===
        "cancelled"
    ) {
      throw new Error(
        "Cancelled jobs cannot update progress.",
      );
    }

    if (
      normalized <
      job.progress
    ) {
      throw new Error(
        "Job progress cannot move backwards.",
      );
    }

    job.progress =
      normalized;

    job.updatedAt =
      now();

    return clone(job);
  }

  /* ------------------------------------------------------------------------ */
  /* Log                                                                       */
  /* ------------------------------------------------------------------------ */

  log(
    id: string,
    message: string,
  ): JobRecord {
    const job =
      this.get(id);

    job.logs.push(
      normalizeLog(
        message,
      ),
    );

    if (
      job.logs.length >
      MAX_LOG_ENTRIES
    ) {
      job.logs =
        job.logs.slice(
          -MAX_LOG_ENTRIES,
        );
    }

    job.updatedAt =
      now();

    return clone(job);
  }

  /* ------------------------------------------------------------------------ */
  /* Checkpoint                                                                */
  /* ------------------------------------------------------------------------ */

  setCheckpoint(
    id: string,
    checkpoint: JobCheckpoint,
  ): JobRecord {
    const job =
      this.get(id);

    if (
      !checkpoint ||
      typeof checkpoint !==
        "object" ||
      Array.isArray(checkpoint)
    ) {
      throw new Error(
        "Job checkpoint must be an object.",
      );
    }

    job.checkpoint =
      clone(checkpoint);

    job.updatedAt =
      now();

    return clone(job);
  }

  /* ------------------------------------------------------------------------ */
  /* Failure                                                                   */
  /* ------------------------------------------------------------------------ */

  fail(
    id: string,
    error: string,
  ): JobRecord {
    const job =
      this.get(id);

    const message =
      normalizeLog(
        error,
      );

    if (
      !JobMachine.canTransition(
        job.state,
        "failed",
      )
    ) {
      throw new CaeError(
        "JOB_NOT_RETRYABLE",
        `Job cannot be failed from state ${job.state}`,
      );
    }

    const machine =
      new JobMachine(
        job.state,
        job.attempts,
        [...job.logs],
      );

    machine.move(
      "failed",
      `error:${message}`,
    );

    job.state =
      machine.state;

    job.attempts =
      machine.attempts;

    job.logs =
      machine.logs;

    job.error =
      message;

    job.updatedAt =
      now();

    return clone(job);
  }

  /* ------------------------------------------------------------------------ */
  /* Cancel                                                                    */
  /* ------------------------------------------------------------------------ */

  cancel(
    id: string,
  ): JobRecord {
    const job =
      this.get(id);

    if (
      job.state ===
        "queued"
    ) {
      return this.transition(
        id,
        "cancelled",
        job.progress,
        "Job cancelled before execution.",
      );
    }

    if (
      job.state ===
        "preparing" ||
      job.state ===
        "running"
    ) {
      return this.transition(
        id,
        "cancelling",
        job.progress,
        "Cancellation requested.",
      );
    }

    if (
      job.state ===
        "cancelling"
    ) {
      return clone(job);
    }

    throw new CaeError(
      "JOB_NOT_RETRYABLE",
      `Job cannot be cancelled from state ${job.state}`,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Complete Cancellation                                                    */
  /* ------------------------------------------------------------------------ */

  completeCancellation(
    id: string,
  ): JobRecord {
    const job =
      this.get(id);

    if (
      job.state !==
      "cancelling"
    ) {
      throw new CaeError(
        "JOB_NOT_RETRYABLE",
        `Job is not cancelling; current state is ${job.state}`,
      );
    }

    return this.transition(
      id,
      "cancelled",
      job.progress,
      "Job cancellation completed.",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Retry                                                                     */
  /* ------------------------------------------------------------------------ */

  retry(
    id: string,
  ): JobRecord {
    const job =
      this.get(id);

    if (
      job.state !==
      "failed"
    ) {
      throw new CaeError(
        "JOB_NOT_RETRYABLE",
        `Only failed jobs can be retried; current state is ${job.state}`,
      );
    }

    const retrying =
      this.transition(
        id,
        "retrying",
        0,
        "Job retry requested.",
      );

    return this.transition(
      retrying.id,
      "queued",
      0,
      "Job returned to queue.",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Convenience Lifecycle                                                     */
  /* ------------------------------------------------------------------------ */

  prepare(
    id: string,
  ): JobRecord {
    return this.transition(
      id,
      "preparing",
      undefined,
      "Job preparation started.",
    );
  }

  start(
    id: string,
  ): JobRecord {
    return this.transition(
      id,
      "running",
      undefined,
      "Job execution started.",
    );
  }

  finalize(
    id: string,
  ): JobRecord {
    return this.transition(
      id,
      "finalizing",
      undefined,
      "Job finalization started.",
    );
  }

  succeed(
    id: string,
  ): JobRecord {
    return this.transition(
      id,
      "succeeded",
      100,
      "Job completed successfully.",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Queue                                                                     */
  /* ------------------------------------------------------------------------ */

  list(
    options: JobListOptions = {},
  ): JobRecord[] {
    let jobs =
      [...this.jobs.values()];

    if (
      options.type !==
      undefined
    ) {
      const type =
        validateNonEmptyString(
          options.type,
          "Job type",
        );

      jobs =
        jobs.filter(
          (job) =>
            job.type === type,
        );
    }

    if (
      options.states !==
        undefined
    ) {
      const states =
        new Set(
          options.states,
        );

      jobs =
        jobs.filter(
          (job) =>
            states.has(
              job.state,
            ),
        );
    }

    jobs.sort(
      (a, b) =>
        a.createdAt.localeCompare(
          b.createdAt,
        ),
    );

    if (
      options.limit !==
        undefined
    ) {
      if (
        !Number.isInteger(
          options.limit,
        ) ||
        options.limit < 0
      ) {
        throw new Error(
          "Job list limit must be a non-negative integer.",
        );
      }

      jobs =
        jobs.slice(
          0,
          options.limit,
        );
    }

    return jobs.map(
      (job) =>
        clone(job),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Queue Snapshot                                                            */
  /* ------------------------------------------------------------------------ */

  queued(): JobRecord[] {
    return this.list({
      states: [
        "queued",
      ],
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Remove                                                                    */
  /* ------------------------------------------------------------------------ */

  remove(
    id: string,
  ): void {
    const job =
      this.get(id);

    if (
      job.state ===
        "running" ||
      job.state ===
        "preparing" ||
      job.state ===
        "finalizing" ||
      job.state ===
        "cancelling"
    ) {
      throw new CaeError(
        "JOB_NOT_RETRYABLE",
        `Active job ${id} cannot be removed.`,
      );
    }

    this.jobs.delete(
      job.id,
    );

    if (
      this.idempotency.get(
        job.idempotencyKey,
      ) === job.id
    ) {
      this.idempotency.delete(
        job.idempotencyKey,
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Clear                                                                     */
  /* ------------------------------------------------------------------------ */

  clear(): void {
    this.jobs.clear();
    this.idempotency.clear();
  }

  /* ------------------------------------------------------------------------ */
  /* Statistics                                                                */
  /* ------------------------------------------------------------------------ */

  statistics(): Record<
    JobState,
    number
  > {
    const result:
      Record<JobState, number> = {
        queued: 0,
        preparing: 0,
        running: 0,
        finalizing: 0,
        succeeded: 0,
        cancelling: 0,
        cancelled: 0,
        failed: 0,
        retrying: 0,
      };

    for (
      const job of
        this.jobs.values()
    ) {
      result[job.state] += 1;
    }

    return result;
  }

  /* ------------------------------------------------------------------------ */
  /* Size                                                                      */
  /* ------------------------------------------------------------------------ */

  size(): number {
    return this.jobs.size;
  }
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createJobEngine(): JobEngine {
  return new JobEngine();
}