import { describe, expect, it } from "vitest";

import {
  DEFAULT_TICKS_PER_SECOND,
  TimelineEngine,
  type Timeline,
  type TimelineItem,
} from "../packages/timeline-engine/src/index.js";

describe("TimelineEngine", () => {
  const engine = new TimelineEngine();

  function item(
    track = "animation",
    startTick = 0,
    endTick = 100,
    data: Record<string, unknown> = {},
    options: Parameters<
      TimelineEngine["createItem"]
    >[4] = {},
  ): TimelineItem {
    return engine.createItem(
      track,
      startTick,
      endTick,
      data,
      options,
    );
  }

  function timeline(
    overrides: Partial<Timeline> = {},
  ): Timeline {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Test Timeline",
      ticksPerSecond:
        DEFAULT_TICKS_PER_SECOND,
      items: [],
      tracks: [],
      markers: [],
      events: [],
      ...overrides,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Creation                                                                */
  /* ---------------------------------------------------------------------- */

  describe("creation", () => {
    it("creates a timeline with deterministic defaults", () => {
      const result =
        engine.create(
          "Main Timeline",
        );

      expect(result.name).toBe(
        "Main Timeline",
      );

      expect(
        result.ticksPerSecond,
      ).toBe(
        DEFAULT_TICKS_PER_SECOND,
      );

      expect(result.items).toEqual(
        [],
      );

      expect(result.tracks).toEqual(
        [],
      );

      expect(result.markers).toEqual(
        [],
      );

      expect(result.events).toEqual(
        [],
      );

      expect(result.id).toMatch(
        /^[0-9a-f-]{36}$/i,
      );
    });

    it("rejects an invalid timebase", () => {
      expect(() =>
        engine.create(
          "Timeline",
          0,
        ),
      ).toThrow(
        "ticksPerSecond must be a positive integer.",
      );
    });

    it("rejects a non-integer timebase", () => {
      expect(() =>
        engine.create(
          "Timeline",
          48_000.5,
        ),
      ).toThrow();
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Timebase                                                                */
  /* ---------------------------------------------------------------------- */

  describe("timebase conversion", () => {
    it("converts seconds to ticks", () => {
      expect(
        engine.secondsToTicks(
          1,
        ),
      ).toBe(
        DEFAULT_TICKS_PER_SECOND,
      );

      expect(
        engine.secondsToTicks(
          0.5,
        ),
      ).toBe(
        DEFAULT_TICKS_PER_SECOND / 2,
      );
    });

    it("converts ticks to seconds", () => {
      expect(
        engine.ticksToSeconds(
          DEFAULT_TICKS_PER_SECOND,
        ),
      ).toBe(1);

      expect(
        engine.ticksToSeconds(
          DEFAULT_TICKS_PER_SECOND / 2,
        ),
      ).toBe(0.5);
    });

    it("rounds fractional second-to-tick conversion", () => {
      expect(
        engine.secondsToTicks(
          1 / 3,
        ),
      ).toBe(
        Math.round(
          DEFAULT_TICKS_PER_SECOND /
            3,
        ),
      );
    });

    it("converts frames to ticks", () => {
      expect(
        engine.frameToTick(
          48,
          24,
        ),
      ).toBe(
        DEFAULT_TICKS_PER_SECOND *
          2,
      );
    });

    it("converts ticks to fractional frames", () => {
      expect(
        engine.tickToFrame(
          DEFAULT_TICKS_PER_SECOND,
          24,
        ),
      ).toBe(24);
    });

    it("rejects invalid seconds", () => {
      expect(() =>
        engine.secondsToTicks(
          Number.NaN,
        ),
      ).toThrow(
        "seconds must be a finite number.",
      );
    });

    it("rejects invalid fps", () => {
      expect(() =>
        engine.frameToTick(
          10,
          0,
        ),
      ).toThrow(
        "fps must be greater than zero.",
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Item creation                                                           */
  /* ---------------------------------------------------------------------- */

  describe("items", () => {
    it("creates an item with defaults", () => {
      const result =
        engine.createItem(
          "animation",
          10,
          100,
        );

      expect(result.track).toBe(
        "animation",
      );

      expect(result.startTick).toBe(
        10,
      );

      expect(result.endTick).toBe(
        100,
      );

      expect(result.enabled).toBe(
        true,
      );

      expect(result.priority).toBe(
        0,
      );

      expect(result.id).toMatch(
        /^[0-9a-f-]{36}$/i,
      );
    });

    it("creates an item with all optional properties", () => {
      const result =
        engine.createItem(
          "character",
          20,
          80,
          {
            action: "walk",
          },
          {
            targetId:
              "22222222-2222-4222-8222-222222222222",
            kind: "animation",
            enabled: false,
            priority: 10,
            id:
              "33333333-3333-4333-8333-333333333333",
          },
        );

      expect(result).toEqual({
        id:
          "33333333-3333-4333-8333-333333333333",
        track: "character",
        startTick: 20,
        endTick: 80,
        targetId:
          "22222222-2222-4222-8222-222222222222",
        data: {
          action: "walk",
        },
        kind: "animation",
        enabled: false,
        priority: 10,
      });
    });

    it("rejects empty track names", () => {
      expect(() =>
        engine.createItem(
          "",
          0,
          10,
        ),
      ).toThrow();
    });

    it("rejects negative start ticks", () => {
      expect(() =>
        engine.createItem(
          "animation",
          -1,
          10,
        ),
      ).toThrow();
    });

    it("rejects an end tick before the start", () => {
      expect(() =>
        engine.createItem(
          "animation",
          100,
          50,
        ),
      ).toThrow();
    });

    it("rejects zero-duration items", () => {
      expect(() =>
        engine.createItem(
          "animation",
          50,
          50,
        ),
      ).toThrow(
        "must have positive duration",
      );
    });

    it("clones item data", () => {
      const data = {
        nested: {
          value: 10,
        },
      };

      const result =
        engine.createItem(
          "animation",
          0,
          10,
          data,
        );

      data.nested.value = 99;

      expect(
        (
          result.data.nested as {
            value: number;
          }
        ).value,
      ).toBe(10);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Add / update / remove                                                   */
  /* ---------------------------------------------------------------------- */

  describe("item collection operations", () => {
    it("adds items and sorts them chronologically", () => {
      const late =
        item(
          "animation",
          100,
          200,
        );

      const early =
        item(
          "animation",
          0,
          50,
        );

      const result =
        engine.add(
          [late],
          early,
        );

      expect(
        result.map(
          (value) =>
            value.startTick,
        ),
      ).toEqual([
        0,
        100,
      ]);
    });

    it("sorts same-start items by end tick", () => {
      const long =
        item(
          "animation",
          0,
          100,
        );

      const short =
        item(
          "animation",
          0,
          50,
        );

      const result =
        engine.add(
          [long],
          short,
        );

      expect(
        result.map(
          (value) =>
            value.endTick,
        ),
      ).toEqual([
        50,
        100,
      ]);
    });

    it("uses priority for deterministic ordering", () => {
      const low =
        item(
          "animation",
          0,
          100,
          {},
          {
            priority: 1,
          },
        );

      const high =
        item(
          "animation",
          0,
          100,
          {},
          {
            priority: 10,
          },
        );

      const result =
        engine.add(
          [low],
          high,
        );

      expect(
        result.map(
          (value) =>
            value.priority,
        ),
      ).toEqual([
        10,
        1,
      ]);
    });

    it("rejects duplicate item ids", () => {
      const first =
        item(
          "animation",
          0,
          100,
          {},
          {
            id:
              "44444444-4444-4444-8444-444444444444",
          },
        );

      const second =
        item(
          "animation",
          100,
          200,
          {},
          {
            id:
              "44444444-4444-4444-8444-444444444444",
          },
        );

      expect(() =>
        engine.add(
          [first],
          second,
        ),
      ).toThrow(
        "Timeline item id already exists",
      );
    });

    it("updates an item immutably", () => {
      const original =
        item(
          "animation",
          0,
          100,
        );

      const result =
        engine.update(
          [original],
          original.id,
          {
            startTick: 20,
            endTick: 120,
          },
        );

      expect(
        original.startTick,
      ).toBe(0);

      expect(
        original.endTick,
      ).toBe(100);

      expect(
        result[0].startTick,
      ).toBe(20);

      expect(
        result[0].endTick,
      ).toBe(120);
    });

    it("removes an item without mutating the original", () => {
      const first =
        item(
          "animation",
          0,
          50,
        );

      const second =
        item(
          "animation",
          50,
          100,
        );

      const source = [
        first,
        second,
      ];

      const result =
        engine.remove(
          source,
          first.id,
        );

      expect(source).toHaveLength(
        2,
      );

      expect(result).toHaveLength(
        1,
      );

      expect(result[0].id).toBe(
        second.id,
      );
    });

    it("throws when updating an unknown item", () => {
      expect(() =>
        engine.update(
          [],
          "missing",
          {
            enabled: false,
          },
        ),
      ).toThrow(
        "Timeline item not found",
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Tracks                                                                  */
  /* ---------------------------------------------------------------------- */

  describe("tracks", () => {
    it("creates tracks with defaults", () => {
      const result =
        engine.createTrack(
          "Characters",
        );

      expect(result.name).toBe(
        "Characters",
      );

      expect(result.order).toBe(0);

      expect(result.muted).toBe(
        false,
      );

      expect(result.locked).toBe(
        false,
      );
    });

    it("creates configured tracks", () => {
      const result =
        engine.createTrack(
          "Dialogue",
          20,
          {
            muted: true,
            locked: true,
            id:
              "55555555-5555-4555-8555-555555555555",
          },
        );

      expect(result).toEqual({
        id:
          "55555555-5555-4555-8555-555555555555",
        name: "Dialogue",
        order: 20,
        muted: true,
        locked: true,
      });
    });

    it("rejects empty track names", () => {
      expect(() =>
        engine.createTrack(
          "",
        ),
      ).toThrow();
    });

    it("sorts tracks by order", () => {
      const a =
        engine.createTrack(
          "A",
          100,
        );

      const b =
        engine.createTrack(
          "B",
          10,
        );

      const result =
        engine.addTrack(
          [a],
          b,
        );

      expect(
        result.map(
          (track) =>
            track.name,
        ),
      ).toEqual([
        "B",
        "A",
      ]);
    });

    it("rejects duplicate track ids", () => {
      const first =
        engine.createTrack(
          "A",
          0,
          {
            id:
              "66666666-6666-4666-8666-666666666666",
          },
        );

      const second =
        engine.createTrack(
          "B",
          1,
          {
            id:
              "66666666-6666-4666-8666-666666666666",
          },
        );

      expect(() =>
        engine.addTrack(
          [first],
          second,
        ),
      ).toThrow(
        "Timeline track id already exists",
      );
    });

    it("removes a track and its associated items", () => {
      const keepTrack =
        engine.createTrack(
          "Keep",
        );

      const removeTrack =
        engine.createTrack(
          "Remove",
        );

      const keepItem =
        item(
          keepTrack.id,
          0,
          50,
        );

      const removeItem =
        item(
          removeTrack.id,
          0,
          50,
        );

      const result =
        engine.removeTrack(
          [
            keepTrack,
            removeTrack,
          ],
          [
            keepItem,
            removeItem,
          ],
          removeTrack.id,
        );

      expect(
        result.tracks.map(
          (track) =>
            track.id,
        ),
      ).toEqual([
        keepTrack.id,
      ]);

      expect(
        result.items.map(
          (value) =>
            value.id,
        ),
      ).toEqual([
        keepItem.id,
      ]);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Markers                                                                 */
  /* ---------------------------------------------------------------------- */

  describe("markers", () => {
    it("creates and sorts markers", () => {
      const late =
        engine.createMarker(
          "Late",
          100,
        );

      const early =
        engine.createMarker(
          "Early",
          10,
        );

      const result =
        engine.addMarker(
          [late],
          early,
        );

      expect(
        result.map(
          (marker) =>
            marker.name,
        ),
      ).toEqual([
        "Early",
        "Late",
      ]);
    });

    it("preserves marker data immutably", () => {
      const data = {
        camera: "close-up",
      };

      const marker =
        engine.createMarker(
          "Shot",
          10,
          data,
        );

      data.camera =
        "wide";

      expect(
        marker.data?.camera,
      ).toBe("close-up");
    });

    it("rejects invalid marker ticks", () => {
      expect(() =>
        engine.createMarker(
          "Invalid",
          -1,
        ),
      ).toThrow();
    });

    it("rejects duplicate marker ids", () => {
      const first =
        engine.createMarker(
          "A",
          10,
        );

      const second = {
        ...engine.createMarker(
          "B",
          20,
        ),
        id: first.id,
      };

      expect(() =>
        engine.addMarker(
          [first],
          second,
        ),
      ).toThrow(
        "Timeline marker id already exists",
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Events                                                                   */
  /* ---------------------------------------------------------------------- */

  describe("events", () => {
    it("creates events", () => {
      const result =
        engine.createEvent(
          "camera-cut",
          100,
          {
            camera: "Main",
          },
          "camera-1",
        );

      expect(result.type).toBe(
        "camera-cut",
      );

      expect(result.tick).toBe(
        100,
      );

      expect(result.targetId).toBe(
        "camera-1",
      );

      expect(result.data).toEqual({
        camera: "Main",
      });
    });

    it("rejects empty event types", () => {
      expect(() =>
        engine.createEvent(
          "",
          10,
        ),
      ).toThrow();
    });

    it("sorts events by tick", () => {
      const late =
        engine.createEvent(
          "late",
          100,
        );

      const early =
        engine.createEvent(
          "early",
          10,
        );

      const result =
        engine.addEvent(
          [late],
          early,
        );

      expect(
        result.map(
          (event) =>
            event.type,
        ),
      ).toEqual([
        "early",
        "late",
      ]);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Active evaluation                                                       */
  /* ---------------------------------------------------------------------- */

  describe("active evaluation", () => {
    it("returns an item at its start tick", () => {
      const value =
        item(
          "animation",
          100,
          200,
        );

      expect(
        engine.active(
          [value],
          100,
        ),
      ).toHaveLength(1);
    });

    it("treats endTick as exclusive", () => {
      const value =
        item(
          "animation",
          100,
          200,
        );

      expect(
        engine.active(
          [value],
          200,
        ),
      ).toHaveLength(0);
    });

    it("does not return disabled items", () => {
      const value =
        item(
          "animation",
          0,
          100,
          {},
          {
            enabled: false,
          },
        );

      expect(
        engine.active(
          [value],
          50,
        ),
      ).toHaveLength(0);
    });

    it("filters active items by target", () => {
      const target =
        "77777777-7777-4777-8777-777777777777";

      const first =
        item(
          "animation",
          0,
          100,
          {},
          {
            targetId: target,
          },
        );

      const second =
        item(
          "animation",
          0,
          100,
          {},
          {
            targetId:
              "88888888-8888-4888-8888-888888888888",
          },
        );

      expect(
        engine.activeForTarget(
          [first, second],
          target,
          50,
        ),
      ).toHaveLength(1);

      expect(
        engine.activeForTarget(
          [first, second],
          target,
          50,
        )[0].id,
      ).toBe(first.id);
    });

    it("filters active items by track", () => {
      const first =
        item(
          "animation",
          0,
          100,
        );

      const second =
        item(
          "camera",
          0,
          100,
        );

      expect(
        engine.activeForTrack(
          [first, second],
          "camera",
          50,
        ),
      ).toHaveLength(1);
    });

    it("rejects a negative evaluation tick", () => {
      expect(() =>
        engine.active(
          [],
          -1,
        ),
      ).toThrow();
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Range and duration                                                      */
  /* ---------------------------------------------------------------------- */

  describe("range queries", () => {
    it("returns zero duration for an empty collection", () => {
      expect(
        engine.duration([]),
      ).toBe(0);
    });

    it("returns the furthest end tick", () => {
      const items = [
        item(
          "a",
          0,
          100,
        ),
        item(
          "b",
          50,
          500,
        ),
        item(
          "c",
          200,
          300,
        ),
      ];

      expect(
        engine.duration(items),
      ).toBe(500);
    });

    it("returns the complete item range", () => {
      const items = [
        item(
          "a",
          100,
          200,
        ),
        item(
          "b",
          50,
          500,
        ),
      ];

      expect(
        engine.range(items),
      ).toEqual({
        startTick: 50,
        endTick: 500,
      });
    });

    it("returns zero range for empty input", () => {
      expect(
        engine.range([]),
      ).toEqual({
        startTick: 0,
        endTick: 0,
      });
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Overlaps                                                                */
  /* ---------------------------------------------------------------------- */

  describe("overlap detection", () => {
    it("detects overlapping items", () => {
      const a =
        item(
          "animation",
          0,
          100,
        );

      const b =
        item(
          "animation",
          50,
          150,
        );

      expect(
        engine.overlaps(a, b),
      ).toBe(true);
    });

    it("does not treat touching boundaries as overlap", () => {
      const a =
        item(
          "animation",
          0,
          100,
        );

      const b =
        item(
          "animation",
          100,
          200,
        );

      expect(
        engine.overlaps(a, b),
      ).toBe(false);
    });

    it("does not report overlap across tracks", () => {
      const a =
        item(
          "animation",
          0,
          100,
        );

      const b =
        item(
          "camera",
          50,
          150,
        );

      expect(
        engine.findOverlaps(
          [b],
          a,
        ),
      ).toHaveLength(0);
    });

    it("finds overlapping items on the same track", () => {
      const target =
        item(
          "animation",
          0,
          100,
        );

      const overlap =
        item(
          "animation",
          50,
          150,
        );

      const nonOverlap =
        item(
          "animation",
          100,
          200,
        );

      const result =
        engine.findOverlaps(
          [
            overlap,
            nonOverlap,
          ],
          target,
        );

      expect(
        result.map(
          (value) =>
            value.id,
        ),
      ).toEqual([
        overlap.id,
      ]);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Full timeline evaluation                                                */
  /* ---------------------------------------------------------------------- */

  describe("timeline evaluation", () => {
    it("evaluates active items, events and markers", () => {
      const activeItem =
        item(
          "animation",
          0,
          100,
        );

      const inactiveItem =
        item(
          "animation",
          100,
          200,
        );

      const event =
        engine.createEvent(
          "dialogue-start",
          50,
        );

      const marker =
        engine.createMarker(
          "important",
          50,
        );

      const result =
        engine.evaluate(
          timeline({
            items: [
              activeItem,
              inactiveItem,
            ],
            events: [
              event,
            ],
            markers: [
              marker,
            ],
          }),
          50,
        );

      expect(
        result.tick,
      ).toBe(50);

      expect(
        result.activeItems.map(
          (value) =>
            value.id,
        ),
      ).toEqual([
        activeItem.id,
      ]);

      expect(
        result.activeEvents.map(
          (value) =>
            value.id,
        ),
      ).toEqual([
        event.id,
      ]);

      expect(
        result.markersAtTick.map(
          (value) =>
            value.id,
        ),
      ).toEqual([
        marker.id,
      ]);
    });

    it("does not activate an item at endTick", () => {
      const value =
        item(
          "animation",
          0,
          100,
        );

      const result =
        engine.evaluate(
          timeline({
            items: [value],
          }),
          100,
        );

      expect(
        result.activeItems,
      ).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Validation                                                              */
  /* ---------------------------------------------------------------------- */

  describe("validation", () => {
    it("accepts a valid timeline", () => {
      const result =
        engine.validateTimeline(
          timeline(),
        );

      expect(result.valid).toBe(
        true,
      );

      expect(result.errors).toEqual(
        [],
      );
    });

    it("detects duplicate item ids", () => {
      const first =
        item(
          "animation",
          0,
          100,
          {},
          {
            id:
              "99999999-9999-4999-8999-999999999999",
          },
        );

      const second =
        item(
          "camera",
          100,
          200,
          {},
          {
            id:
              "99999999-9999-4999-8999-999999999999",
          },
        );

      const result =
        engine.validateTimeline(
          timeline({
            items: [
              first,
              second,
            ],
          }),
        );

      expect(result.valid).toBe(
        false,
      );

      expect(
        result.errors.some(
          (error) =>
            error.includes(
              "Duplicate timeline item id",
            ),
        ),
      ).toBe(true);
    });

    it("detects duplicate track ids", () => {
      const first =
        engine.createTrack(
          "A",
          0,
          {
            id:
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        );

      const second =
        engine.createTrack(
          "B",
          1,
          {
            id:
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        );

      const result =
        engine.validateTimeline(
          timeline({
            tracks: [
              first,
              second,
            ],
          }),
        );

      expect(result.valid).toBe(
        false,
      );

      expect(
        result.errors.some(
          (error) =>
            error.includes(
              "Duplicate timeline track id",
            ),
        ),
      ).toBe(true);
    });

    it("detects invalid marker ticks", () => {
      const result =
        engine.validateTimeline(
          timeline({
            markers: [
              {
                id: "marker-1",
                tick: -10,
                name: "Bad",
              },
            ],
          }),
        );

      expect(result.valid).toBe(
        false,
      );
    });

    it("detects invalid event types", () => {
      const result =
        engine.validateTimeline(
          timeline({
            events: [
              {
                id: "event-1",
                tick: 10,
                type: "",
                data: {},
              },
            ],
          }),
        );

      expect(result.valid).toBe(
        false,
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Normalization                                                           */
  /* ---------------------------------------------------------------------- */

  describe("normalization", () => {
    it("sorts all timeline collections", () => {
      const itemA =
        item(
          "z",
          100,
          200,
        );

      const itemB =
        item(
          "a",
          0,
          50,
        );

      const trackA =
        engine.createTrack(
          "Z",
          100,
        );

      const trackB =
        engine.createTrack(
          "A",
          0,
        );

      const markerA =
        engine.createMarker(
          "Z",
          100,
        );

      const markerB =
        engine.createMarker(
          "A",
          10,
        );

      const eventA =
        engine.createEvent(
          "z",
          100,
        );

      const eventB =
        engine.createEvent(
          "a",
          10,
        );

      const result =
        engine.normalize(
          timeline({
            items: [
              itemA,
              itemB,
            ],
            tracks: [
              trackA,
              trackB,
            ],
            markers: [
              markerA,
              markerB,
            ],
            events: [
              eventA,
              eventB,
            ],
          }),
        );

      expect(
        result.items[0].id,
      ).toBe(itemB.id);

      expect(
        result.tracks[0].id,
      ).toBe(trackB.id);

      expect(
        result.markers[0].id,
      ).toBe(markerB.id);

      expect(
        result.events[0].id,
      ).toBe(eventB.id);
    });

    it("does not mutate the original timeline", () => {
      const first =
        item(
          "animation",
          100,
          200,
        );

      const second =
        item(
          "animation",
          0,
          50,
        );

      const source =
        timeline({
          items: [
            first,
            second,
          ],
        });

      const originalOrder =
        source.items.map(
          (value) =>
            value.id,
        );

      const normalized =
        engine.normalize(
          source,
        );

      expect(
        source.items.map(
          (value) =>
            value.id,
        ),
      ).toEqual(
        originalOrder,
      );

      expect(
        normalized.items.map(
          (value) =>
            value.id,
        ),
      ).toEqual([
        second.id,
        first.id,
      ]);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Fingerprint                                                             */
  /* ---------------------------------------------------------------------- */

  describe("fingerprint", () => {
    it("produces a stable fingerprint for equivalent timelines", () => {
      const firstItem =
        item(
          "animation",
          0,
          100,
          {
            action: "walk",
          },
          {
            id:
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        );

      const first =
        timeline({
          items: [
            firstItem,
          ],
        });

      const secondItem =
        item(
          "animation",
          0,
          100,
          {
            action: "walk",
          },
          {
            id:
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        );

      const second =
        timeline({
          items: [
            secondItem,
          ],
        });

      expect(
        engine.fingerprint(first),
      ).toBe(
        engine.fingerprint(second),
      );
    });

    it("changes fingerprint when timeline content changes", () => {
      const first =
        timeline({
          items: [
            item(
              "animation",
              0,
              100,
              {
                action: "walk",
              },
            ),
          ],
        });

      const second =
        timeline({
          items: [
            item(
              "animation",
              0,
              100,
              {
                action: "run",
              },
            ),
          ],
        });

      expect(
        engine.fingerprint(first),
      ).not.toBe(
        engine.fingerprint(second),
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Backward compatibility                                                  */
  /* ---------------------------------------------------------------------- */

  describe("backward-compatible helpers", () => {
    it("getDuration delegates to duration", () => {
      const items = [
        item(
          "animation",
          0,
          100,
        ),
        item(
          "animation",
          100,
          250,
        ),
      ];

      expect(
        engine.getDuration(items),
      ).toBe(
        engine.duration(items),
      );
    });

    it("getActive delegates to active", () => {
      const items = [
        item(
          "animation",
          0,
          100,
        ),
      ];

      expect(
        engine.getActive(
          items,
          50,
        ),
      ).toEqual(
        engine.active(
          items,
          50,
        ),
      );
    });
  });
});