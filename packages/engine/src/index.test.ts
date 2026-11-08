import { describe, expect, it } from "vitest";

import { createInitialGameState } from "./index";

describe("@rift/engine", () => {
  it("creates a seeded setup room", () => {
    const room = createInitialGameState({
      roomCode: "TEST1",
      createdAt: 1,
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
    });
    expect(room.roomCode).toBe("TEST1");
    expect(room.phase).toBe("battlefield_pick");
    expect(room.setupOrderVersion).toBe(2);
  });
});
