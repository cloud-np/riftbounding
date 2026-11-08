import { describe, expect, it } from "vitest";
import type { Room } from "@rift/protocol";
import {
  createInitialTimeline,
  MAX_REWIND_ENTRIES,
  recordHistory,
} from "../src/rules/rewind";

function tinyRoom(index: number): Room {
  return {
    roomCode: "ABC123",
    createdAt: 1,
    updatedAt: index,
    phase: "in_game",
    players: [
      { id: "alice", seat: 0, name: "Alice", joinedAt: 1 },
      { id: "bob", seat: 1, name: "Bob", joinedAt: 1 },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
  } as Room;
}

describe("rewind timeline bookkeeping", () => {
  it("assigns monotonic storage ids and bounds the persisted history", () => {
    let timeline = createInitialTimeline();
    for (let index = 0; index < MAX_REWIND_ENTRIES + 100; index += 1) {
      timeline = recordHistory(
        tinyRoom(index),
        "alice",
        "adjust_score",
        true,
        index,
        timeline,
      );
    }
    expect(timeline.entries).toHaveLength(MAX_REWIND_ENTRIES);
    expect(timeline.cursor).toBe(MAX_REWIND_ENTRIES);
    expect(timeline.entries[0]?.seq).toBe(100);
    expect(timeline.entries.at(-1)?.seq).toBe(MAX_REWIND_ENTRIES + 99);
    expect(timeline.nextSeq).toBe(MAX_REWIND_ENTRIES + 100);
    // Rewinding still works against the retained window.
    expect(timeline.entries.every((entry) => entry.meaningful)).toBe(true);
  });

  it("branches without reusing storage ids", () => {
    let timeline = createInitialTimeline();
    for (let index = 0; index < 5; index += 1) {
      timeline = recordHistory(tinyRoom(index), "alice", "adjust_score", true, index, timeline);
    }
    timeline = { ...timeline, cursor: 2 };
    timeline = recordHistory(tinyRoom(99), "alice", "adjust_score", true, 99, timeline);
    expect(timeline.entries).toHaveLength(3);
    expect(timeline.entries.map((entry) => entry.seq)).toEqual([0, 1, 5]);
    expect(timeline.nextSeq).toBe(6);
  });
});
