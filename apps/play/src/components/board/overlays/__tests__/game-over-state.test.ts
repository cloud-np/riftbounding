import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";

import { gameOverView, gameResultView } from "../game-over-state";

function room(overrides: Partial<Room>): Room {
  return {
    roomCode: "TEST-1",
    createdAt: 1,
    updatedAt: 1,
    phase: "in_game",
    roomMode: "multiplayer",
    matchFormat: "bo3",
    gameNumber: 1,
    players: [
      { id: "me", seat: 1, name: "Atlas", joinedAt: 1 },
      { id: "them", seat: 2, name: "Opponent", joinedAt: 1 },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    ...overrides,
  };
}

describe("gameOverView", () => {
  it("shows the per-game report dialog after BO3 NEXT opens it", () => {
    const view = gameOverView(
      room({ gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 3 } }),
      "me",
      "them",
      true,
      true,
    );
    expect(view.visible).toBe(true);
    expect(view.showReporting).toBe(true);
    expect(view.seriesWinnerId).toBeNull();
  });

  it("keeps a finished BO3 game on the board until NEXT (no auto dialog)", () => {
    const view = gameOverView(
      room({ gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 3 } }),
      "me",
      "them",
      true,
    );
    expect(view.visible).toBe(false);
    expect(view.showReporting).toBe(true);
  });

  it("detects a BO3 series winner from wins and exposes the series score", () => {
    const view = gameOverView(
      room({
        winsByPlayerId: { me: 2, them: 1 },
        gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 9 },
        returnLobbyRoomCode: "LOB12",
      }),
      "me",
      "them",
      true,
    );
    expect(view.seriesWinnerId).toBe("me");
    expect(view.seriesWinnerName).toBe("Atlas");
    expect(view.showReporting).toBe(false);
    expect(view.canDismiss).toBe(true);
  });

  it("keeps the series dialog modal until the room starts a lobby return", () => {
    const view = gameOverView(
      room({
        winsByPlayerId: { me: 2, them: 1 },
        gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 9 },
      }),
      "me",
      "them",
      true,
    );
    expect(view.canDismiss).toBe(false);
  });

  it("uses the match termination winner for a decided series", () => {
    const view = gameOverView(
      room({
        matchTermination: { status: "completed", reason: "concession", winnerPlayerIds: ["them"] },
      }),
      "me",
      "them",
      false,
    );
    expect(view.seriesWinnerId).toBe("them");
    expect(view.terminationReason).toBe("concession");
    expect(view.canDismiss).toBe(false);
  });

  it("never opens the BO3 result dialog for a finished BO1 game", () => {
    const view = gameOverView(
      room({
        matchFormat: "bo1",
        gameOutcome: { winnerPlayerIds: ["them"], reason: "score", decidedAtTurnNumber: 7 },
        winsByPlayerId: { them: 1 },
      }),
      "me",
      "them",
      true,
    );
    expect(view.visible).toBe(false);
    expect(view.seriesWinnerId).toBeNull();
    expect(view.showReporting).toBe(false);
  });

  it("reads reports from the pending result map", () => {
    const view = gameOverView(
      room({
        pendingGameResult: { winnerByReporterPlayerId: { me: "me", them: "me" } },
      }),
      "me",
      "them",
      true,
    );
    expect(view.myReportedWinnerId).toBe("me");
    expect(view.opponentReportedWinnerId).toBe("me");
    expect(view.visible).toBe(true);
  });
});

describe("gameResultView", () => {
  const withScores = (me: number, them: number, extra: Partial<Room> = {}) =>
    room({
      matchFormat: "bo1",
      players: [
        { id: "me", seat: 1, name: "Atlas", joinedAt: 1, board: { score: me } as never },
        { id: "them", seat: 2, name: "Bot", joinedAt: 1, isBot: true, board: { score: them } as never },
      ],
      ...extra,
    });

  it("is not finished without an outcome", () => {
    expect(gameResultView(withScores(3, 2), "me").finished).toBe(false);
  });

  it("reports a close score win for any format", () => {
    const view = gameResultView(
      withScores(8, 7, { gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 9 } }),
      "me",
    );
    expect(view).toMatchObject({ finished: true, viewerWon: true, winnerId: "me", loserId: "them" });
    expect(view.situations).toContain("close");
  });

  it("reports a defeat with the viewer as the fallen legend and a blowout for the winner", () => {
    const view = gameResultView(
      withScores(2, 8, { gameOutcome: { winnerPlayerIds: ["them"], reason: "score", decidedAtTurnNumber: 9 } }),
      "me",
    );
    expect(view).toMatchObject({ viewerWon: false, winnerId: "them", loserId: "me" });
    expect(view.situations).not.toContain("blowout");
  });

  it("flags concessions and keeps the game key stable", () => {
    const conceded = withScores(1, 0, {
      gameOutcome: { winnerPlayerIds: ["them"], reason: "concession", decidedAtTurnNumber: 4 },
    });
    const view = gameResultView(conceded, "me");
    expect(view.situations).toEqual(["concession"]);
    expect(gameResultView(conceded, "me").gameKey).toBe(view.gameKey);
  });

  it("ignores spectators", () => {
    const finished = withScores(8, 2, { gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 9 } });
    expect(gameResultView(finished, "someone-else").finished).toBe(false);
  });
});
