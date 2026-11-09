import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";

import {
  canStartNextGame,
  nextGameAction,
  nextGameControlState,
  nextGameDescriptionKey,
  nextGameLabelKey,
  roomActionVisibility,
} from "../room-actions";

function room(overrides: Partial<Room> = {}): Room {
  return {
    roomCode: "PZUSU",
    createdAt: 1,
    updatedAt: 1,
    phase: "in_game",
    roomMode: "multiplayer",
    gameVariant: "duel",
    matchFormat: "bo1",
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

const duel = room();

describe("strict in-progress room actions", () => {
  it("hides NEXT and rewind while a strict game is live, keeps them in sandbox/after result", () => {
    expect(roomActionVisibility(room({ rulesMode: "strict", rules: {} as Room["rules"] }))).toEqual({
      strictInProgress: true,
      showNext: false,
      showRewind: false,
    });
    expect(roomActionVisibility(room({}))).toEqual({
      strictInProgress: false,
      showNext: true,
      showRewind: true,
    });
    expect(
      roomActionVisibility(
        room({
          rulesMode: "strict",
          rules: {} as Room["rules"],
          gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 3 },
        }),
      ),
    ).toEqual({ strictInProgress: false, showNext: true, showRewind: true });
  });
});

describe("next game control", () => {
  it("is available in a BO1 game so the room can start a fresh board", () => {
    expect(nextGameControlState({ room: duel })).toBe("available");
    expect(canStartNextGame({ room: duel })).toBe(true);
    expect(nextGameLabelKey(duel)).toBe("nextGame");
    expect(nextGameDescriptionKey(duel)).toBe("nextGameDescription");
  });

  it("disables NEXT once the match ended, a player left, or the lobby is pending", () => {
    expect(
      nextGameControlState({
        room: room({
          matchFormat: "bo3",
          matchTermination: { status: "completed", winnerPlayerIds: ["me"] },
        }),
      }),
    ).toBe("match_ended");
    expect(
      nextGameControlState({ room: room({ players: [{ ...duel.players[1]!, leftAt: 5 }] }) }),
    ).toBe("player_left");
    expect(nextGameControlState({ room: room({ returnLobbyRoomCode: "ABC12" }) })).toBe(
      "returning_to_lobby",
    );
  });

  it("keeps BO1 NEXT available after a completed game so it can restart in place", () => {
    const finished = room({
      matchTermination: { status: "completed", reason: "score", winnerPlayerIds: ["me"] },
      gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 3 },
    });
    expect(nextGameControlState({ room: finished })).toBe("available");
    expect(
      nextGameControlState({
        room: { ...finished, returnLobbyRoomCode: "LOB12" },
      }),
    ).toBe("match_ended");
  });

  it("disables NEXT for a complete BO3 series but keeps it for a live BO3", () => {
    expect(
      nextGameControlState({ room: room({ matchFormat: "bo3", winsByPlayerId: { me: 2 } }) }),
    ).toBe("series_complete");
    expect(
      nextGameControlState({
        room: room({ matchFormat: "bo3", winsByPlayerId: { me: 1, them: 1 } }),
      }),
    ).toBe("available");
    expect(nextGameDescriptionKey(room({ matchFormat: "bo3", gameNumber: 3 }))).toBe(
      "endMatchDescription",
    );
    expect(nextGameLabelKey(room({ matchFormat: "bo3", gameNumber: 3 }))).toBe("endMatch");
    expect(nextGameDescriptionKey(room({ matchFormat: "bo3", gameNumber: 2 }))).toBe(
      "nextGameBo3Description",
    );
  });

  it("waits for the expected seats and respects maintenance/busy locks", () => {
    expect(nextGameControlState({ room: duel, expectedPlayers: 4 })).toBe("waiting_for_players");
    expect(nextGameControlState({ room: duel, interactionBusy: true })).toBe("busy");
    expect(nextGameControlState({ room: duel, newGamesDisabled: true })).toBe("new_games_disabled");
  });
});

describe("NEXT action routing", () => {
  it("keeps BO1 NEXT as an in-place create_next_game", () => {
    expect(nextGameAction(duel)).toBe("create_next_game");
  });

  it("asks for a winner report when a live BO3 game has no pending result", () => {
    const played = room({
      matchFormat: "bo3",
      gameNumber: 1,
      gameOutcome: { winnerPlayerIds: ["me"], reason: "score", decidedAtTurnNumber: 4 },
    });
    expect(nextGameAction(played)).toBe("request_result_confirmation");
  });

  it("only opens the existing BO3 dialog when a report or series decision exists", () => {
    expect(
      nextGameAction(
        room({
          matchFormat: "bo3",
          pendingGameResult: { winnerByReporterPlayerId: { me: "me" } },
        }),
      ),
    ).toBe("open_result_dialog");
    expect(nextGameAction(room({ matchFormat: "bo3", winsByPlayerId: { me: 2, them: 1 } }))).toBe(
      "open_result_dialog",
    );
    expect(
      nextGameAction(
        room({
          matchFormat: "bo3",
          matchTermination: { status: "completed", winnerPlayerIds: ["me"] },
        }),
      ),
    ).toBe("open_result_dialog");
  });
});
