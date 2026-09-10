import { createHash } from "node:crypto";
import { uuid } from "../../domain/src/index.js";

/* -------------------------------------------------------------------------- */
/* Core Types                                                                 */
/* -------------------------------------------------------------------------- */

export type TimelineTick = number;

export type TimelineItemKind =
  | "animation"
  | "facial"
  | "lipsync"
  | "audio"
  | "camera"
  | "scene"
  | "effect"
  | "event"
  | "custom";

export interface TimelineItem {
  id: string;
  track: string;
  startTick: TimelineTick;
  endTick: TimelineTick;
  targetId?: string;
  data: Record<string, unknown>;
  kind?: TimelineItemKind;
  enabled?: boolean;
  priority?: number;
}

export interface TimelineMarker {
  id: string;
  tick: TimelineTick;
  name: string;
  data?: Record<string, unknown>;
}

export interface TimelineTrack {
  id: string;
  name: string;
  order: number;
  muted: boolean;
  locked: boolean;
}

export interface TimelineEvent {
  id: string;
  tick: TimelineTick;
  type: string;
  targetId?: string;
  data: Record<string, unknown>;
}

export interface Timeline {
  id: string;
  name: string;
  ticksPerSecond: number;
  items: TimelineItem[];
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  events: TimelineEvent[];
}

export interface TimelineValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TimelineRange {
  startTick: number;
  endTick: number;
}

export interface TimelineTimebase {
  ticksPerSecond: number;
}

export interface TimelineEvaluation {
  tick: number;
  activeItems: TimelineItem[];
  activeEvents: TimelineEvent[];
  markersAtTick: TimelineMarker[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_TICKS_PER_SECOND = 48_000;

/* -------------------------------------------------------------------------- */
/* Internal Helpers                                                            */
/* -------------------------------------------------------------------------- */

function assertFinite(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${name} must be a finite number.`,
    );
  }
}

function assertInteger(
  value: number,
  name: string,
): void {
  if (!Number.isInteger(value)) {
    throw new Error(
      `${name} must be an integer.`,
    );
  }
}

function assertNonNegativeInteger(
  value: number,
  name: string,
): void {
  assertInteger(value, name);

  if (value < 0) {
    throw new Error(
      `${name} must be non-negative.`,
    );
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compareItems(
  a: TimelineItem,
  b: TimelineItem,
): number {
  return (
    a.startTick -
      b.startTick ||
    a.endTick -
      b.endTick ||
    a.track.localeCompare(
      b.track,
    ) ||
    (b.priority ?? 0) -
      (a.priority ?? 0) ||
    a.id.localeCompare(
      b.id,
    )
  );
}

function compareTracks(
  a: TimelineTrack,
  b: TimelineTrack,
): number {
  return (
    a.order -
      b.order ||
    a.name.localeCompare(
      b.name,
    ) ||
    a.id.localeCompare(
      b.id,
    )
  );
}

function compareMarkers(
  a: TimelineMarker,
  b: TimelineMarker,
): number {
  return (
    a.tick -
      b.tick ||
    a.name.localeCompare(
      b.name,
    ) ||
    a.id.localeCompare(
      b.id,
    )
  );
}

function compareEvents(
  a: TimelineEvent,
  b: TimelineEvent,
): number {
  return (
    a.tick -
      b.tick ||
    a.type.localeCompare(
      b.type,
    ) ||
    a.id.localeCompare(
      b.id,
    )
  );
}

function canonicalize(
  value: unknown,
): string {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(canonicalize)
      .join(",")}]`;
  }

  const object =
    value as Record<
      string,
      unknown
    >;

  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(
          key,
        )}:${canonicalize(
          object[key],
        )}`,
    )
    .join(",")}}`;
}

/* -------------------------------------------------------------------------- */
/* Timeline Engine                                                             */
/* -------------------------------------------------------------------------- */

export class TimelineEngine {
  /* ------------------------------------------------------------------------ */
  /* Timeline Creation                                                        */
  /* ------------------------------------------------------------------------ */

  create(
    name = "Timeline",
    ticksPerSecond =
      DEFAULT_TICKS_PER_SECOND,
  ): Timeline {
    this.validateTimebase(
      ticksPerSecond,
    );

    return {
      id: uuid(),
      name,
      ticksPerSecond,
      items: [],
      tracks: [],
      markers: [],
      events: [],
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Timebase                                                                  */
  /* ------------------------------------------------------------------------ */

  validateTimebase(
    ticksPerSecond: number,
  ): void {
    if (
      !Number.isInteger(
        ticksPerSecond,
      ) ||
      ticksPerSecond <= 0
    ) {
      throw new Error(
        "ticksPerSecond must be a positive integer.",
      );
    }
  }

  secondsToTicks(
    seconds: number,
    timebase: TimelineTimebase =
      {
        ticksPerSecond:
          DEFAULT_TICKS_PER_SECOND,
      },
  ): number {
    assertFinite(
      seconds,
      "seconds",
    );

    this.validateTimebase(
      timebase.ticksPerSecond,
    );

    return Math.round(
      seconds *
        timebase.ticksPerSecond,
    );
  }

  ticksToSeconds(
    ticks: number,
    timebase: TimelineTimebase =
      {
        ticksPerSecond:
          DEFAULT_TICKS_PER_SECOND,
      },
  ): number {
    assertFinite(
      ticks,
      "ticks",
    );

    this.validateTimebase(
      timebase.ticksPerSecond,
    );

    return (
      ticks /
      timebase.ticksPerSecond
    );
  }

  frameToTick(
    frame: number,
    fps: number,
    timebase: TimelineTimebase =
      {
        ticksPerSecond:
          DEFAULT_TICKS_PER_SECOND,
      },
  ): number {
    assertFinite(
      frame,
      "frame",
    );

    assertFinite(
      fps,
      "fps",
    );

    if (fps <= 0) {
      throw new Error(
        "fps must be greater than zero.",
      );
    }

    this.validateTimebase(
      timebase.ticksPerSecond,
    );

    return Math.round(
      (frame /
        fps) *
        timebase.ticksPerSecond,
    );
  }

  tickToFrame(
    tick: number,
    fps: number,
    timebase: TimelineTimebase =
      {
        ticksPerSecond:
          DEFAULT_TICKS_PER_SECOND,
      },
  ): number {
    assertFinite(
      tick,
      "tick",
    );

    assertFinite(
      fps,
      "fps",
    );

    if (fps <= 0) {
      throw new Error(
        "fps must be greater than zero.",
      );
    }

    this.validateTimebase(
      timebase.ticksPerSecond,
    );

    return (
      tick *
      fps /
      timebase.ticksPerSecond
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Item Creation                                                            */
  /* ------------------------------------------------------------------------ */

  createItem(
    track: string,
    startTick: number,
    endTick: number,
    data: Record<
      string,
      unknown
    > = {},
    options: {
      id?: string;
      targetId?: string;
      kind?: TimelineItemKind;
      enabled?: boolean;
      priority?: number;
    } = {},
  ): TimelineItem {
    const item: TimelineItem =
      {
        id:
          options.id ??
          uuid(),

        track,

        startTick,

        endTick,

        ...(options.targetId !==
        undefined
          ? {
              targetId:
                options.targetId,
            }
          : {}),

        data: clone(data),

        ...(options.kind !==
        undefined
          ? {
              kind:
                options.kind,
            }
          : {}),

        enabled:
          options.enabled ??
          true,

        priority:
          options.priority ??
          0,
      };

    this.validateItem(
      item,
    );

    return clone(item);
  }

  /* ------------------------------------------------------------------------ */
  /* Item Validation                                                          */
  /* ------------------------------------------------------------------------ */

  validateItem(
    item: TimelineItem,
  ): void {
    if (
      typeof item.id !==
        "string" ||
      item.id.trim().length ===
        0
    ) {
      throw new Error(
        "Timeline item id must not be empty.",
      );
    }

    if (
      typeof item.track !==
        "string" ||
      item.track.trim().length ===
        0
    ) {
      throw new Error(
        `Timeline item ${item.id} must have a track.`,
      );
    }

    assertNonNegativeInteger(
      item.startTick,
      `Timeline item ${item.id} startTick`,
    );

    assertNonNegativeInteger(
      item.endTick,
      `Timeline item ${item.id} endTick`,
    );

    if (
      item.endTick <=
      item.startTick
    ) {
      throw new Error(
        `Timeline item ${item.id} must have positive duration.`,
      );
    }

    if (
      item.targetId !==
        undefined &&
      (
        typeof item.targetId !==
          "string" ||
        item.targetId.trim()
          .length === 0
      )
    ) {
      throw new Error(
        `Timeline item ${item.id} targetId must not be empty.`,
      );
    }

    if (
      item.priority !==
        undefined
    ) {
      assertFinite(
        item.priority,
        `Timeline item ${item.id} priority`,
      );
    }

    if (
      item.data === null ||
      typeof item.data !==
        "object" ||
      Array.isArray(item.data)
    ) {
      throw new Error(
        `Timeline item ${item.id} data must be an object.`,
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Add Item                                                                 */
  /* ------------------------------------------------------------------------ */

  add(
    items: TimelineItem[],
    item: TimelineItem,
  ): TimelineItem[] {
    this.validateItem(
      item,
    );

    if (
      items.some(
        (existing) =>
          existing.id ===
          item.id,
      )
    ) {
      throw new Error(
        `Timeline item id already exists: ${item.id}`,
      );
    }

    for (const existing of items) {
      this.validateItem(
        existing,
      );
    }

    return [
      ...items,
      clone(item),
    ].sort(compareItems);
  }

  /* ------------------------------------------------------------------------ */
  /* Add / Remove / Update                                                    */
  /* ------------------------------------------------------------------------ */

  remove(
    items: TimelineItem[],
    itemId: string,
  ): TimelineItem[] {
    if (
      itemId.trim().length ===
      0
    ) {
      throw new Error(
        "itemId must not be empty.",
      );
    }

    return items
      .filter(
        (item) =>
          item.id !== itemId,
      )
      .map(clone);
  }

  update(
    items: TimelineItem[],
    itemId: string,
    patch: Partial<
      Omit<TimelineItem, "id">
    >,
  ): TimelineItem[] {
    const index =
      items.findIndex(
        (item) =>
          item.id === itemId,
      );

    if (index < 0) {
      throw new Error(
        `Timeline item not found: ${itemId}`,
      );
    }

    const next =
      clone(items);

    next[index] = {
      ...next[index],
      ...patch,
      id: itemId,
    };

    this.validateItem(
      next[index],
    );

    return next.sort(
      compareItems,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Track Helpers                                                            */
  /* ------------------------------------------------------------------------ */

  createTrack(
    name: string,
    order = 0,
    options: {
      id?: string;
      muted?: boolean;
      locked?: boolean;
    } = {},
  ): TimelineTrack {
    if (
      name.trim().length ===
      0
    ) {
      throw new Error(
        "Timeline track name must not be empty.",
      );
    }

    assertFinite(
      order,
      "track order",
    );

    return {
      id:
        options.id ??
        uuid(),

      name,

      order,

      muted:
        options.muted ??
        false,

      locked:
        options.locked ??
        false,
    };
  }

  addTrack(
    tracks: TimelineTrack[],
    track: TimelineTrack,
  ): TimelineTrack[] {
    if (
      tracks.some(
        (existing) =>
          existing.id ===
          track.id,
      )
    ) {
      throw new Error(
        `Timeline track id already exists: ${track.id}`,
      );
    }

    return [
      ...tracks,
      clone(track),
    ].sort(compareTracks);
  }

  removeTrack(
    tracks: TimelineTrack[],
    items: TimelineItem[],
    trackId: string,
  ): {
    tracks: TimelineTrack[];
    items: TimelineItem[];
  } {
    return {
      tracks: tracks
        .filter(
          (track) =>
            track.id !== trackId,
        )
        .map(clone),

      items: items
        .filter(
          (item) =>
            item.track !==
            trackId,
        )
        .map(clone),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Markers                                                                  */
  /* ------------------------------------------------------------------------ */

  createMarker(
    name: string,
    tick: number,
    data?: Record<
      string,
      unknown
    >,
  ): TimelineMarker {
    if (
      name.trim().length ===
      0
    ) {
      throw new Error(
        "Timeline marker name must not be empty.",
      );
    }

    assertNonNegativeInteger(
      tick,
      "marker tick",
    );

    return {
      id: uuid(),
      tick,
      name,
      ...(data !==
      undefined
        ? {
            data: clone(data),
          }
        : {}),
    };
  }

  addMarker(
    markers: TimelineMarker[],
    marker: TimelineMarker,
  ): TimelineMarker[] {
    if (
      markers.some(
        (existing) =>
          existing.id ===
          marker.id,
      )
    ) {
      throw new Error(
        `Timeline marker id already exists: ${marker.id}`,
      );
    }

    return [
      ...markers,
      clone(marker),
    ].sort(compareMarkers);
  }

  /* ------------------------------------------------------------------------ */
  /* Events                                                                   */
  /* ------------------------------------------------------------------------ */

  createEvent(
    type: string,
    tick: number,
    data: Record<
      string,
      unknown
    > = {},
    targetId?: string,
  ): TimelineEvent {
    if (
      type.trim().length ===
      0
    ) {
      throw new Error(
        "Timeline event type must not be empty.",
      );
    }

    assertNonNegativeInteger(
      tick,
      "event tick",
    );

    return {
      id: uuid(),
      tick,
      type,
      data: clone(data),
      ...(targetId !==
      undefined
        ? {
            targetId,
          }
        : {}),
    };
  }

  addEvent(
    events: TimelineEvent[],
    event: TimelineEvent,
  ): TimelineEvent[] {
    if (
      events.some(
        (existing) =>
          existing.id ===
          event.id,
      )
    ) {
      throw new Error(
        `Timeline event id already exists: ${event.id}`,
      );
    }

    return [
      ...events,
      clone(event),
    ].sort(compareEvents);
  }

  /* ------------------------------------------------------------------------ */
  /* Active Evaluation                                                        */
  /* ------------------------------------------------------------------------ */

  active(
    items: TimelineItem[],
    tick: number,
  ): TimelineItem[] {
    assertNonNegativeInteger(
      tick,
      "timeline tick",
    );

    return items
      .filter(
        (item) =>
          (item.enabled ??
            true) &&
          tick >=
            item.startTick &&
          tick <
            item.endTick,
      )
      .sort(compareItems)
      .map(clone);
  }

  activeForTarget(
    items: TimelineItem[],
    targetId: string,
    tick: number,
  ): TimelineItem[] {
    return this.active(
      items,
      tick,
    ).filter(
      (item) =>
        item.targetId ===
        targetId,
    );
  }

  activeForTrack(
    items: TimelineItem[],
    track: string,
    tick: number,
  ): TimelineItem[] {
    return this.active(
      items,
      tick,
    ).filter(
      (item) =>
        item.track === track,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Range Queries                                                             */
  /* ------------------------------------------------------------------------ */

  duration(
    items: TimelineItem[],
  ): number {
    let duration = 0;

    for (const item of items) {
      this.validateItem(
        item,
      );

      duration = Math.max(
        duration,
        item.endTick,
      );
    }

    return duration;
  }

  range(
    items: TimelineItem[],
  ): TimelineRange {
    if (
      items.length === 0
    ) {
      return {
        startTick: 0,
        endTick: 0,
      };
    }

    let startTick =
      Number.POSITIVE_INFINITY;

    let endTick = 0;

    for (const item of items) {
      this.validateItem(
        item,
      );

      startTick = Math.min(
        startTick,
        item.startTick,
      );

      endTick = Math.max(
        endTick,
        item.endTick,
      );
    }

    return {
      startTick,
      endTick,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Overlap Queries                                                           */
  /* ------------------------------------------------------------------------ */

  overlaps(
    a: TimelineItem,
    b: TimelineItem,
  ): boolean {
    this.validateItem(a);
    this.validateItem(b);

    return (
      a.startTick <
        b.endTick &&
      b.startTick <
        a.endTick
    );
  }

  findOverlaps(
    items: TimelineItem[],
    item: TimelineItem,
  ): TimelineItem[] {
    this.validateItem(
      item,
    );

    return items
      .filter(
        (candidate) =>
          candidate.id !==
            item.id &&
          candidate.track ===
            item.track &&
          this.overlaps(
            candidate,
            item,
          ),
      )
      .sort(compareItems)
      .map(clone);
  }

  /* ------------------------------------------------------------------------ */
  /* Full Timeline Evaluation                                                  */
  /* ------------------------------------------------------------------------ */

  evaluate(
    timeline: Timeline,
    tick: number,
  ): TimelineEvaluation {
    this.validate(
      timeline.items,
    );

    assertNonNegativeInteger(
      tick,
      "timeline tick",
    );

    const activeItems =
      this.active(
        timeline.items,
        tick,
      );

    const activeEvents =
      timeline.events
        .filter(
          (event) =>
            event.tick === tick,
        )
        .sort(compareEvents)
        .map(clone);

    const markersAtTick =
      timeline.markers
        .filter(
          (marker) =>
            marker.tick ===
            tick,
        )
        .sort(compareMarkers)
        .map(clone);

    return {
      tick,
      activeItems,
      activeEvents,
      markersAtTick,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Validation                                                                */
  /* ------------------------------------------------------------------------ */

  validate(
    items: TimelineItem[],
  ): TimelineValidationResult {
    const errors: string[] = [];
    const ids = new Set<string>();

    for (const item of items) {
      try {
        this.validateItem(
          item,
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : String(error),
        );
      }

      if (
        ids.has(item.id)
      ) {
        errors.push(
          `Duplicate timeline item id: ${item.id}`,
        );
      }

      ids.add(item.id);
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }

  validateTimeline(
    timeline: Timeline,
  ): TimelineValidationResult {
    const errors: string[] = [];

    if (
      typeof timeline.id !==
        "string" ||
      timeline.id.trim()
        .length === 0
    ) {
      errors.push(
        "Timeline id must not be empty.",
      );
    }

    if (
      typeof timeline.name !==
        "string" ||
      timeline.name.trim()
        .length === 0
    ) {
      errors.push(
        "Timeline name must not be empty.",
      );
    }

    try {
      this.validateTimebase(
        timeline.ticksPerSecond,
      );
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : String(error),
      );
    }

    const itemResult =
      this.validate(
        timeline.items,
      );

    errors.push(
      ...itemResult.errors,
    );

    const trackIds =
      new Set<string>();

    for (const track of timeline.tracks) {
      if (
        trackIds.has(
          track.id,
        )
      ) {
        errors.push(
          `Duplicate timeline track id: ${track.id}`,
        );
      }

      trackIds.add(track.id);
    }

    const markerIds =
      new Set<string>();

    for (const marker of timeline.markers) {
      if (
        markerIds.has(
          marker.id,
        )
      ) {
        errors.push(
          `Duplicate timeline marker id: ${marker.id}`,
        );
      }

      markerIds.add(marker.id);

      try {
        assertNonNegativeInteger(
          marker.tick,
          `marker ${marker.id} tick`,
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : String(error),
        );
      }
    }

    const eventIds =
      new Set<string>();

    for (const event of timeline.events) {
      if (
        eventIds.has(
          event.id,
        )
      ) {
        errors.push(
          `Duplicate timeline event id: ${event.id}`,
        );
      }

      eventIds.add(event.id);

      try {
        assertNonNegativeInteger(
          event.tick,
          `event ${event.id} tick`,
        );
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : String(error),
        );
      }

      if (
        event.type.trim()
          .length === 0
      ) {
        errors.push(
          `Timeline event ${event.id} type must not be empty.`,
        );
      }
    }

    return {
      valid:
        errors.length === 0,
      errors,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Timeline Normalization                                                    */
  /* ------------------------------------------------------------------------ */

  normalize(
    timeline: Timeline,
  ): Timeline {
    const result =
      this.validateTimeline(
        timeline,
      );

    if (!result.valid) {
      throw new Error(
        `Invalid timeline: ${result.errors.join("; ")}`,
      );
    }

    return {
      ...clone(timeline),

      items: [
        ...timeline.items,
      ].sort(compareItems),

      tracks: [
        ...timeline.tracks,
      ].sort(compareTracks),

      markers: [
        ...timeline.markers,
      ].sort(compareMarkers),

      events: [
        ...timeline.events,
      ].sort(compareEvents),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                               */
  /* ------------------------------------------------------------------------ */

  fingerprint(
    timeline: Timeline,
  ): string {
    const normalized =
      this.normalize(
        timeline,
      );

    return createHash(
      "sha256",
    )
      .update(
        canonicalize(
          normalized,
        ),
      )
      .digest("hex");
  }

  /* ------------------------------------------------------------------------ */
  /* Backward-Compatible Helpers                                               */
  /* ------------------------------------------------------------------------ */

  getDuration(
    items: TimelineItem[],
  ): number {
    return this.duration(
      items,
    );
  }

  getActive(
    items: TimelineItem[],
    tick: number,
  ): TimelineItem[] {
    return this.active(
      items,
      tick,
    );
  }
}