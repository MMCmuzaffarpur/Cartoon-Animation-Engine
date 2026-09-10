import { createHash, randomUUID } from "node:crypto";

/* -------------------------------------------------------------------------- */
/*                                   Brands                                   */
/* -------------------------------------------------------------------------- */

export type Brand<T, N extends string> = T & {
  readonly __brand: N;
};

export type ProjectId = Brand<string, "ProjectId">;
export type RevisionId = Brand<string, "RevisionId">;
export type AssetId = Brand<string, "AssetId">;
export type EntityId = Brand<string, "EntityId">;
export type JobId = Brand<string, "JobId">;
export type CommandId = Brand<string, "CommandId">;
export type PlanId = Brand<string, "PlanId">;
export type ContentHash = Brand<string, "ContentHash">;
export type Tick = Brand<number, "Tick">;

/* -------------------------------------------------------------------------- */
/*                                  Identity                                  */
/* -------------------------------------------------------------------------- */

export const uuid = <T extends string = string>(): Brand<string, T> =>
  randomUUID() as Brand<string, T>;

/* -------------------------------------------------------------------------- */
/*                                    Tick                                    */
/* -------------------------------------------------------------------------- */

export const makeTick = (n: number): Tick => {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error("Tick must be a non-negative safe integer");
  }

  return n as Tick;
};

/* -------------------------------------------------------------------------- */
/*                                Rational Rate                              */
/* -------------------------------------------------------------------------- */

export interface Rational {
  numerator: number;
  denominator: number;
}

export const normalizeRate = (r: Rational): Rational => {
  if (
    !Number.isInteger(r.numerator) ||
    !Number.isInteger(r.denominator) ||
    r.numerator <= 0 ||
    r.denominator <= 0
  ) {
    throw new Error("Invalid rational rate");
  }

  return r;
};

/* -------------------------------------------------------------------------- */
/*                              Canonicalization                             */
/* -------------------------------------------------------------------------- */

/**
 * Recursively normalizes values so semantically equivalent objects
 * produce the same canonical serialization.
 *
 * Object keys are sorted.
 * Arrays preserve their original order.
 * Negative zero is normalized to zero.
 */
const normalize = (x: unknown): unknown => {
  if (Array.isArray(x)) {
    return x.map(normalize);
  }

  if (x && typeof x === "object") {
    return Object.fromEntries(
      Object.keys(x as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          normalize((x as Record<string, unknown>)[key]),
        ]),
    );
  }

  if (typeof x === "number" && Object.is(x, -0)) {
    return 0;
  }

  return x;
};

/**
 * Deterministic JSON serialization.
 */
export const canonicalSerialize = (x: unknown): string =>
  JSON.stringify(normalize(x));

/**
 * SHA-256 content hash.
 */
export const sha256 = (
  x: string | Buffer,
): ContentHash =>
  createHash("sha256")
    .update(x)
    .digest("hex") as ContentHash;

/**
 * Deterministic SHA-256 hash of canonicalized data.
 */
export const canonicalHash = (
  x: unknown,
): ContentHash =>
  sha256(canonicalSerialize(x));

/* -------------------------------------------------------------------------- */
/*                                Error Codes                                 */
/* -------------------------------------------------------------------------- */

/**
 * Canonical engine error codes.
 *
 * Keep this union centralized so all domain engines use
 * the same machine-readable error vocabulary.
 */
export type ErrorCode =
  | "INVALID_REQUEST"
  | "SCHEMA_VALIDATION_FAILED"
  | "PROJECT_NOT_FOUND"
  | "REVISION_NOT_FOUND"
  | "REVISION_CONFLICT"
  | "ASSET_NOT_FOUND"
  | "ASSET_HASH_MISMATCH"
  | "ENTITY_NOT_FOUND"
  | "ENTITY_AMBIGUOUS"
  | "ENTITY_DUPLICATE"
  | "COMMAND_INVALID"
  | "COMMAND_NOT_SUPPORTED"
  | "COMMAND_IDEMPOTENCY_CONFLICT"
  | "CAPABILITY_UNAVAILABLE"
  | "PROMPT_UNCLEAR"
  | "PLAN_INVALID"
  | "PLAN_STALE"
  | "JOB_NOT_FOUND"
  | "JOB_CANNOT_CANCEL"
  | "JOB_NOT_RETRYABLE"
  | "RENDER_FAILED"
  | "FFMPEG_NOT_FOUND"
  | "ADAPTER_UNAVAILABLE"
  | "INVALID_CHARACTER_INPUT"
  | "RIG_DIMENSION_MISMATCH";

/* -------------------------------------------------------------------------- */
/*                                 CaeError                                   */
/* -------------------------------------------------------------------------- */

export class CaeError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);

    this.name = "CaeError";

    // Required for correct instanceof behavior when extending Error
    // in some JavaScript/TypeScript runtime configurations.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                           Capability Negotiation                           */
/* -------------------------------------------------------------------------- */

export interface CapabilityDescriptor {
  adapterId: string;
  adapterVersion: string;
  contractVersion: string;

  capabilities: Record<
    string,
    "supported" | "unsupported" | "experimental"
  >;
}

export interface CapabilityRequirement {
  id: string;
  level: "required" | "preferred";
  fallbacks?: string[];
}

/**
 * Select capabilities from an adapter inventory.
 *
 * Required capabilities must be directly supported.
 * Preferred capabilities may use a declared fallback.
 */
export const negotiate = (
  inventory: CapabilityDescriptor[],
  requirements: CapabilityRequirement[],
) => {
  const supported = new Set(
    inventory.flatMap((descriptor) =>
      Object.entries(descriptor.capabilities)
        .filter(([, status]) => status === "supported")
        .map(([capability]) => capability),
    ),
  );

  const missingRequired: string[] = [];
  const selected: string[] = [];
  const fallbacks: Record<string, string> = {};

  for (const requirement of requirements) {
    if (supported.has(requirement.id)) {
      selected.push(requirement.id);
      continue;
    }

    const fallback = requirement.fallbacks?.find((candidate) =>
      supported.has(candidate),
    );

    if (
      fallback !== undefined &&
      requirement.level === "preferred"
    ) {
      fallbacks[requirement.id] = fallback;
      selected.push(fallback);
      continue;
    }

    if (requirement.level === "required") {
      missingRequired.push(requirement.id);
    }
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    selected,
    fallbacks,
  };
};

/* -------------------------------------------------------------------------- */
/*                              Numeric Helpers                               */
/* -------------------------------------------------------------------------- */

export const clamp = (
  n: number,
  min: number,
  max: number,
): number =>
  Math.max(min, Math.min(max, n));

export const lerp = (
  a: number,
  b: number,
  t: number,
): number =>
  a + (b - a) * t;

export const smoothstep = (
  t: number,
): number =>
  t * t * (3 - 2 * t);

export const degToRad = (
  d: number,
): number =>
  (d * Math.PI) / 180;