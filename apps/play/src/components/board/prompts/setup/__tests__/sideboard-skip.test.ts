import { describe, expect, it } from "vitest";

import {
  acceptedSkipCount,
  resolveSideboardSkipControlState,
  sideboardSkipRows,
} from "../sideboard-skip";

describe("sideboard skip control state (original ej)", () => {
  it("is hidden for sealed, BO3 and champion-only skips", () => {
    expect(
      resolveSideboardSkipControlState({ roomMode: "multiplayer", playMode: "sealed", playerId: "a" }),
    ).toBe("hidden");
    expect(
      resolveSideboardSkipControlState({ roomMode: "multiplayer", matchFormat: "bo3", playerId: "a" }),
    ).toBe("hidden");
    expect(
      resolveSideboardSkipControlState({
        roomMode: "multiplayer",
        request: { requesterPlayerId: "b", acceptedPlayerIds: [], championSelectionOnly: true },
        playerId: "a",
      }),
    ).toBe("hidden");
  });

  it("is immediate in solo/practice and requestable in multiplayer", () => {
    expect(resolveSideboardSkipControlState({ roomMode: "single_player", playerId: "a" })).toBe(
      "immediate",
    );
    expect(resolveSideboardSkipControlState({ roomMode: "solo_lab", playerId: "a" })).toBe(
      "immediate",
    );
    expect(resolveSideboardSkipControlState({ roomMode: "multiplayer", playerId: "a" })).toBe(
      "request",
    );
  });

  it("resolves requester/responder/declined states", () => {
    const request = { requesterPlayerId: "a", acceptedPlayerIds: ["c"] };
    expect(resolveSideboardSkipControlState({ request, playerId: "a" })).toBe("requester_waiting");
    expect(resolveSideboardSkipControlState({ request, playerId: "b" })).toBe("recipient_pending");
    expect(resolveSideboardSkipControlState({ request, playerId: "c" })).toBe(
      "recipient_accepted_waiting",
    );
    expect(
      resolveSideboardSkipControlState({
        request: { ...request, declinedPlayerId: "b" },
        playerId: "b",
      }),
    ).toBe("declined");
  });
});

describe("sideboard skip rows", () => {
  const players = [
    { id: "a", name: "Atlas" },
    { id: "b", name: "Guest" },
    { id: "c", name: "Third" },
  ];
  const request = { requesterPlayerId: "a", acceptedPlayerIds: ["c"] };

  it("counts the requester and accepted players", () => {
    expect(acceptedSkipCount(request)).toBe(2);
    expect(acceptedSkipCount({ ...request, declinedPlayerId: "c" })).toBe(1);
    expect(acceptedSkipCount(null)).toBe(0);
  });

  it("marks accepted, pending and declined seats", () => {
    const rows = sideboardSkipRows({
      players,
      request: { ...request, declinedPlayerId: "b" },
      playerLabel: (player) => (player.id === "a" ? "You" : "Opponent"),
      labels: { accepted: "Accepted", declined: "Declined", pending: "Pending" },
    });
    expect(rows.map((row) => row.responseStatus)).toEqual(["accepted", "declined", "accepted"]);
    expect(rows.map((row) => row.statusLabel)).toEqual(["Accepted", "Declined", "Accepted"]);
  });
});
