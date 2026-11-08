import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { CardInstance, PlayerBoard, Room } from "@rift/protocol";
import { createInitialGameState } from "../src";

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURE = path.join(ROOT, ".recon/oracle/fixtures/duel-initiative-roll.json");

function signature(card: CardInstance): unknown {
  const { imageUrl: _imageUrl, ...rest } = card;
  return rest;
}

function boardSignature(board: PlayerBoard): unknown {
  const {
    deck,
    runeDeck,
    hand,
    base,
    trash,
    banished,
    battlefieldA,
    battlefieldB,
    battlefieldC,
    battlefieldToken,
    champion,
    legend,
    runeArea,
    ...rest
  } = board;
  return {
    ...rest,
    deck: [...deck].sort((a, b) => a.id.localeCompare(b.id)).map(signature),
    runeDeck: [...runeDeck].sort((a, b) => a.id.localeCompare(b.id)).map(signature),
    hand: hand.map(signature),
    base: base.map(signature),
    trash: trash.map(signature),
    banished: banished.map(signature),
    battlefieldA: battlefieldA.map(signature),
    battlefieldB: battlefieldB.map(signature),
    battlefieldC: battlefieldC?.map(signature),
    battlefieldToken: battlefieldToken.map(signature),
    champion: champion.map(signature),
    legend: legend.map(signature),
    runeArea: runeArea.map(signature),
  };
}

describe.skipIf(!fs.existsSync(FIXTURE))("createInitialGameState (oracle fixture)", () => {
  it("seeds boards exactly like the original sz() factory", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
    const room = createInitialGameState({
      roomCode: fixture.roomCode,
      createdAt: fixture.createdAt,
      phase: "initiative_roll",
      shuffleDecks: false,
      players: fixture.players.map((player) => ({
        id: player.id,
        seat: player.seat,
        name: player.name,
        joinedAt: player.joinedAt,
        decklistRaw: player.decklistRaw,
        submittedDeck: player.submittedDeck,
        selectedBattlefield: player.selectedBattlefield,
        selectedBattlefieldCardCode: player.selectedBattlefieldCardCode,
      })),
      gameVariant: "duel",
      roomMode: "multiplayer",
      playMode: "constructed",
      deckRulesMode: "standard",
      matchFormat: "bo1",
      setupOrderVersion: 2,
    });
    expect(room.phase).toBe("initiative_roll");
    expect(room.players.map((player) => player.board).map((board) => (board ? boardSignature(board) : null))).toEqual(
      fixture.players.map((player) => (player.board ? boardSignature(player.board) : null)),
    );
  });
});
