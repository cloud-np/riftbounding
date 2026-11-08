import { describe, expect, it } from "vitest";
import type { EngineTimeline, EngineTimelineEntry, Room } from "@rift/protocol";
import {
  DO_STORAGE_VALUE_LIMIT_BYTES,
  TIMELINE_META_KEY,
  TimelinePersistence,
} from "../src/core/TimelinePersistence";
import { FakeTimelineStorage } from "./helpers/timeline-storage";

function room(index: number): Room {
  return {
    roomCode: "ABC123",
    createdAt: 1,
    updatedAt: index,
    phase: "in_game",
    players: [
      { id: "alice", seat: 0, name: "Alice", joinedAt: 1 },
      { id: "bob", seat: 1, name: "Bob", joinedAt: 1 },
    ],
    log: [
      {
        id: `log-${index}`,
        at: index,
        text: `action ${index}`,
        authorPlayerId: "alice",
        turnNumber: 1,
        actionKind: "board",
      },
    ],
    chainEntries: [],
    chainResolveVotes: [],
  } as Room;
}

function entry(index: number, extra: Record<string, unknown> = {}): EngineTimelineEntry {
  return {
    actionType: "adjust_score",
    actorId: "alice",
    before: { ...room(index), ...extra },
    meaningful: true,
    at: index,
    seq: index,
  };
}

function timeline(entries: EngineTimelineEntry[], cursor = entries.length): EngineTimeline {
  return {
    version: 1,
    entries,
    cursor,
    nextSeq: (entries.at(-1)?.seq ?? -1) + 1,
  };
}

describe("TimelinePersistence", () => {
  it("keeps every storage value below the Durable Object limit and round-trips the timeline", async () => {
    const storage = new FakeTimelineStorage(DO_STORAGE_VALUE_LIMIT_BYTES);
    const huge = "x".repeat(1_200_000);
    const original = timeline([
      entry(0, { __largeAnnotation: huge }),
      entry(1),
      entry(2),
    ]);
    const { persistence } = await TimelinePersistence.load(storage);
    await persistence.save(original);

    expect(storage.maxValueBytes).toBeLessThan(DO_STORAGE_VALUE_LIMIT_BYTES);
    // The >1 MB snapshot is split across several keys instead of one oversized value.
    expect(storage.keysWithPrefix("timeline:e:0:")).not.toHaveLength(0);

    const reloaded = await TimelinePersistence.load(storage);
    expect(reloaded.timeline).toEqual(original);
    expect(reloaded.timeline?.entries).toHaveLength(3);
  });

  it("writes only new entries, deletes branched history and preserves forward state", async () => {
    const storage = new FakeTimelineStorage();
    const first = timeline([entry(0), entry(1), entry(2)]);
    let { persistence } = await TimelinePersistence.load(storage);
    await persistence.save(first);
    expect(
      storage.writes.filter((key) => key.startsWith("timeline:e:")).sort(),
    ).toEqual(["timeline:e:0", "timeline:e:1", "timeline:e:2"]);

    // Rewind: entries are unchanged, only cursor + forward state move.
    const forwardRoom = room(99);
    const rewound: EngineTimeline = {
      ...first,
      cursor: 1,
      forward: { actorId: "alice", state: forwardRoom, expiresAt: 5_000 },
    };
    storage.writes.length = 0;
    await persistence.save(rewound);
    expect(storage.writes.filter((key) => key.startsWith("timeline:e:"))).toEqual([]);
    expect(storage.values.has("timeline:f")).toBe(true);

    // Branch from the cursor: entry 1 is replaced and entries 2.. are dropped.
    const branched = timeline([entry(0), entry(1, { __branch: true })]);
    storage.writes.length = 0;
    await persistence.save(branched);
    expect(storage.values.has("timeline:e:2")).toBe(false);
    expect(storage.writes).toContain("timeline:e:1");

    const reloaded = await TimelinePersistence.load(storage);
    expect(reloaded.timeline?.entries).toHaveLength(2);
    expect(reloaded.timeline?.cursor).toBe(2);
    expect(reloaded.timeline?.entries[1]?.before).toMatchObject({ __branch: true });
  });

  it("survives a Durable Object restart after a 1,000-entry game", async () => {
    const storage = new FakeTimelineStorage(DO_STORAGE_VALUE_LIMIT_BYTES);
    const entries: EngineTimelineEntry[] = [];
    for (let index = 0; index < 1_000; index += 1) {
      entries.push(entry(index, { log: undefined, __turn: index }));
    }
    const original = timeline(entries, 1_000);
    let { persistence } = await TimelinePersistence.load(storage);
    await persistence.save(original);
    expect(storage.maxValueBytes).toBeLessThan(DO_STORAGE_VALUE_LIMIT_BYTES);
    expect(storage.totalBytes()).toBeLessThan(10 * 1024 * 1024 * 1024);
    expect(storage.values.has(TIMELINE_META_KEY)).toBe(true);

    // Simulate eviction: a fresh persistence handle only has the storage.
    ({ persistence } = await TimelinePersistence.load(storage));
    const reloaded = await TimelinePersistence.load(storage);
    expect(reloaded.timeline?.entries).toHaveLength(1_000);
    expect(reloaded.timeline?.entries[999]?.seq).toBe(999);
    expect(reloaded.timeline?.cursor).toBe(1_000);
    await persistence.save(reloaded.timeline!);
  });
});
