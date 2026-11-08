import { describe, expect, it } from "vitest";

import type { GameplayLogEntry } from "@rift/protocol";

import { groupLogEntries, orderLogGroupsForDisplay, sliceLogGroups } from "../log-groups";

function entry(id: string, text: string, extra: Partial<GameplayLogEntry> = {}): GameplayLogEntry {
  return { id, at: 1000, text, ...extra };
}

describe("groupLogEntries", () => {
  it("groups consecutive entries by explicit turn metadata", () => {
    const groups = groupLogEntries({
      entries: [
        entry("1", "drew 1 card.", { turnNumber: 2, turnPlayerId: "p1" }),
        entry("2", "played X.", { turnNumber: 2, turnPlayerId: "p1" }),
        entry("3", "drew 1 card.", { turnNumber: 3, turnPlayerId: "p2" }),
      ],
      currentTurnNumber: 3,
      currentTurnPlayerId: "p2",
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: "turn", turnNumber: 2, turnPlayerId: "p1" });
    expect(groups[0]?.entries).toHaveLength(2);
    expect(groups[1]).toMatchObject({ kind: "turn", turnNumber: 3, turnPlayerId: "p2" });
  });

  it("inherits the last explicit turn for entries without metadata", () => {
    const groups = groupLogEntries({
      entries: [
        entry("1", "drew 1 card.", { turnNumber: 4, turnPlayerId: "p1" }),
        entry("2", "moved a card."),
        entry("3", "moved another card."),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "turn", turnNumber: 4, turnPlayerId: "p1" });
    expect(groups[0]?.entries.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("rewinds the inherited turn on a pre-game ended-turn line", () => {
    const groups = groupLogEntries({
      entries: [
        entry("1", "Kai ended their turn.", { authorPlayerId: "p1" }),
        entry("2", "Ari ended their turn.", { authorPlayerId: "p2" }),
      ],
      currentTurnNumber: 3,
      currentTurnPlayerId: "p1",
    });
    expect(groups.map((group) => group.kind)).toEqual(["turn", "turn"]);
    expect(groups[0]).toMatchObject({ kind: "turn", turnNumber: 2, turnPlayerId: "p1" });
    expect(groups[1]).toMatchObject({ kind: "turn", turnNumber: 1, turnPlayerId: "p2" });
  });

  it("switches to activity groups after the game starts", () => {
    const groups = groupLogEntries({
      entries: [
        entry("1", "Auto-started test setup."),
        entry("2", "drew 4 cards.", { turnNumber: 1, turnPlayerId: "p1" }),
        entry("3", "shuffled their deck."),
      ],
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: "activity" });
    expect(groups[0]?.entries.map((item) => item.id)).toEqual(["1"]);
    expect(groups[1]).toMatchObject({ kind: "turn", turnNumber: 1, turnPlayerId: "p1" });
    expect(groups[1]?.entries.map((item) => item.id)).toEqual(["2", "3"]);
  });

  it("keeps the activity group until an explicit turn appears", () => {
    const groups = groupLogEntries({
      entries: [entry("1", "Closed deck peek."), entry("2", "Shuffled their deck.")],
    });
    expect(groups).toEqual([
      {
        kind: "activity",
        entries: [expect.objectContaining({ id: "1" }), expect.objectContaining({ id: "2" })],
      },
    ]);
  });
});

describe("match log display order", () => {
  it("renders the newest turn and newest row first (original newest-first log)", () => {
    const groups = groupLogEntries({
      entries: [
        entry("1", "Turn 1 action.", { turnNumber: 1, turnPlayerId: "p1" }),
        entry("2", "Turn 1 later.", { turnNumber: 1, turnPlayerId: "p1" }),
        entry("3", "Turn 2 action.", { turnNumber: 2, turnPlayerId: "p2" }),
      ],
    });
    const ordered = orderLogGroupsForDisplay(groups);
    expect(ordered.map((group) => group.kind === "turn" && group.turnNumber)).toEqual([2, 1]);
    expect(ordered[1]?.kind === "turn" && ordered[1].entries.map((row) => row.id)).toEqual([
      "2",
      "1",
    ]);
    expect(ordered[0]?.entries.map((row) => row.id)).toEqual(["3"]);
  });

  it("reveals older rows 40 at a time and reports the hidden remainder", () => {
    const rows = Array.from({ length: 95 }, (_, index) =>
      entry(`entry-${index}`, `action ${index}.`, { turnNumber: 1, turnPlayerId: "p1" }),
    );
    const ordered = orderLogGroupsForDisplay(groupLogEntries({ entries: rows }));
    const firstPage = sliceLogGroups(ordered, 40);
    expect(firstPage.remaining).toBe(55);
    expect(firstPage.groups.flatMap((group) => group.entries)).toHaveLength(40);
    expect(firstPage.groups[0]?.entries[0]?.id).toBe("entry-94");
    const secondPage = sliceLogGroups(ordered, 80);
    expect(secondPage.remaining).toBe(15);
    const all = sliceLogGroups(ordered, 1000);
    expect(all.remaining).toBe(0);
    expect(all.groups.flatMap((group) => group.entries)).toHaveLength(95);
  });
});
