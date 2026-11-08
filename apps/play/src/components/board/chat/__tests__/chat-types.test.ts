import { describe, expect, it } from "vitest";

import type { RoomPlayer } from "@rift/protocol";

import { normalizeChatEntries, normalizeChatEntry } from "../types";

const players: RoomPlayer[] = [
  { id: "p1", seat: 0, name: "Kai", joinedAt: 0 },
  { id: "p2", seat: 1, name: "Ari", joinedAt: 0 },
];

describe("normalizeChatEntry", () => {
  it("resolves author names and defaults", () => {
    const entry = normalizeChatEntry({ authorPlayerId: "p2", text: "Hello" }, 0, players);
    expect(entry.author).toBe("Ari");
    expect(entry.authorPlayerId).toBe("p2");
    expect(entry.visibility).toBe("public");
    expect(entry.authorRole).toBe("player");
  });

  it("maps judge markers", () => {
    expect(
      normalizeChatEntry({ author: "Judge", authorRole: "judge", verifiedJudge: true }, 0, players),
    ).toMatchObject({ authorRole: "judge", verifiedJudge: true });
  });

  it("keeps ids and timestamps", () => {
    expect(normalizeChatEntry({ id: "chat-1", at: 1234, text: "hi" }, 0, players)).toMatchObject({
      id: "chat-1",
      at: 1234,
      text: "hi",
    });
  });
});

describe("normalizeChatEntries", () => {
  it("returns an empty list for absent entries", () => {
    expect(normalizeChatEntries(undefined, players)).toEqual([]);
  });
});
