import { describe, expect, it } from "vitest";

import {
  canForwardState,
  canRewindState,
  formatElapsed,
  matchClockBaseMs,
  matchElapsedMs,
  turnAdvanceIntent,
} from "../clock";

describe("formatElapsed", () => {
  it("matches the original hv format", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(1_000)).toBe("00:01");
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(35 * 60_000 + 25_000)).toBe("35:25");
    expect(formatElapsed(3_600_000 + 4 * 60_000 + 5_000)).toBe("1:04:05");
  });
});

describe("match clock", () => {
  it("uses createdAt for game 1 and seriesStartedAt later", () => {
    const base = 1_700_000_000_000;
    expect(matchClockBaseMs({ createdAt: base, seriesStartedAt: base + 800, gameNumber: 1 })).toBe(
      base,
    );
    expect(matchClockBaseMs({ createdAt: base, seriesStartedAt: base + 800, gameNumber: 2 })).toBe(
      base + 800,
    );
    expect(matchClockBaseMs({ createdAt: base, gameNumber: 3 })).toBe(base);
    expect(
      matchElapsedMs({ createdAt: base, seriesStartedAt: base + 800, gameNumber: 2 }, base + 1800),
    ).toBe(1000);
  });

  it("treats synthetic/stale fixture timestamps as zero elapsed", () => {
    expect(matchElapsedMs({ createdAt: 1, gameNumber: 1 }, 1_700_000_000_000)).toBe(0);
    expect(matchElapsedMs({ createdAt: 1_600_000_000_000, gameNumber: 1 }, 1_700_000_000_000)).toBe(
      0,
    );
  });
});

describe("rewind/forward gates", () => {
  it("requires in_game and the player in rewindablePlayerIds", () => {
    expect(canRewindState({ phase: "in_game", rewindablePlayerIds: ["p1"] }, "p1")).toBe(true);
    expect(canRewindState({ phase: "in_game", rewindablePlayerIds: ["p1"] }, "p2")).toBe(false);
    expect(canRewindState({ phase: "mulligan", rewindablePlayerIds: ["p1"] }, "p1")).toBe(false);
  });

  it("only allows forward while the window is open", () => {
    expect(
      canForwardState(
        { phase: "in_game", forwardablePlayerIds: ["p1"], forwardAvailableUntil: 2000 },
        "p1",
        1500,
      ),
    ).toBe(true);
    expect(
      canForwardState(
        { phase: "in_game", forwardablePlayerIds: ["p1"], forwardAvailableUntil: 2000 },
        "p1",
        2000,
      ),
    ).toBe(false);
  });
});

describe("turnAdvanceIntent", () => {
  it("ends the beginning phase before the main phase", () => {
    expect(
      turnAdvanceIntent({ activeTurnStep: "beginning", turnNumber: 3, activeTurnPlayerId: "p1" }),
    ).toEqual({
      type: "end_beginning_phase",
      observed: { turnNumber: 3, activePlayerId: "p1", activeStep: "beginning" },
    });
  });

  it("ends the turn in the main phase", () => {
    expect(
      turnAdvanceIntent({ activeTurnStep: "main", turnNumber: 3, activeTurnPlayerId: "p1" }),
    ).toEqual({
      type: "end_turn",
      observed: { turnNumber: 3, activePlayerId: "p1", activeStep: "main" },
    });
  });
});
