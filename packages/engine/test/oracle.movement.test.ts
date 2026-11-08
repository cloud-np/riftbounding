import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CardInstance, Room } from "@rift/protocol";
import { applyGameAction } from "../src";

const ROOT = path.resolve(__dirname, "../../..");
const ORACLE = path.join(ROOT, ".recon/oracle/load.mjs");
const FIXTURE = path.join(ROOT, ".recon/oracle/fixtures/duel-in-game-t1-main.json");

function normalize(room: Room): unknown {
  const copy = JSON.parse(JSON.stringify(room)) as Record<string, unknown>;
  delete copy.updatedAt;
  delete copy.gameOutcome;
  delete copy.log;
  delete copy.rewindProtocolVersion;
  delete copy.rewindablePlayerIds;
  delete copy.forwardablePlayerIds;
  delete copy.forwardAvailableUntil;
  delete copy.rewindConfirmation;
  return copy;
}
function counterFactory() {
  let n = 0;
  return (kind: string) => `${kind}_t${n++}`;
}
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 0x3c6ef35f) >>> 0;
    return state / 0x100000000;
  };
}
type Action = Record<string, unknown> & { type: string };

function fixture(): Room {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
}

function syntheticBoard(room: Room): void {
  const p1 = room.players[0]!;
  const board = p1.board!;
  const unit = board.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
  const spell = board.hand.find((card) => card.type?.toLowerCase().includes("spell"))!;
  const gear = board.hand.find((card) => card.type?.toLowerCase().includes("gear"))!;
  const hiddenUnit: CardInstance = { ...unit, id: "synthetic-hidden", keywords: [...(unit.keywords ?? []), "Hidden"] };
  const token: CardInstance = { ...unit, id: "synthetic-token", source: "token", name: "Recruit", type: "Unit" };
  board.hand = [
    { ...unit, id: "synthetic-unit" },
    { ...spell, id: "synthetic-spell" },
    { ...gear, id: "synthetic-gear" },
    hiddenUnit,
    token,
    { ...unit, id: "synthetic-unit-2" },
  ];
  board.base = [];
  board.battlefieldA = [];
  board.deck.push({ ...unit, id: "synthetic-deck-unit" });
  board.deck.push({ ...spell, id: "synthetic-deck-spell" });
  board.deck.push({ ...token, id: "synthetic-deck-token" });
}

const scenarios: Array<{ name: string; action: Action; setup?: (room: Room) => void }> = [
  { name: "unit hand→base", action: { type: "move_card", from: "hand", to: "base", cardId: "synthetic-unit" } },
  { name: "spell hand→base (reject)", action: { type: "move_card", from: "hand", to: "base", cardId: "synthetic-spell" } },
  { name: "hidden hand→battlefield asHidden", action: { type: "move_card", from: "hand", to: "battlefieldA", cardId: "synthetic-hidden", asHidden: true } },
  { name: "hidden hand→base asHidden (reject)", action: { type: "move_card", from: "hand", to: "base", cardId: "synthetic-hidden", asHidden: true } },
  { name: "unit hand→battlefield", action: { type: "move_card", from: "hand", to: "battlefieldA", cardId: "synthetic-unit" } },
  {
    name: "hidden battlefield→base",
    setup: (room) => {
      const board = room.players[0]!.board!;
      const unit = board.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
      board.battlefieldA.push({ ...unit, id: "synthetic-hidden", hidden: true, exhausted: true });
    },
    action: { type: "move_card", from: "battlefieldA", to: "base", cardId: "synthetic-hidden" },
  },
  {
    name: "champion→base",
    action: { type: "move_card", from: "champion", to: "base", cardId: "" },
  },
  {
    name: "unit→champion occupied (reject)",
    action: { type: "move_card", from: "hand", to: "champion", cardId: "synthetic-unit" },
  },
  { name: "token hand→hand burn", action: { type: "move_card", from: "hand", to: "hand", cardId: "synthetic-token" } },
  { name: "same-zone reorder", action: { type: "move_card", from: "hand", to: "hand", cardId: "synthetic-unit", toIndex: 0 } },
  { name: "spell hand→trash", action: { type: "move_card", from: "hand", to: "trash", cardId: "synthetic-spell" } },
  { name: "deck→hand (reject)", action: { type: "move_card", from: "deck", to: "hand", cardId: "synthetic-deck-unit" } },
  { name: "runeArea→runeDeck (reject)", action: { type: "move_card", from: "runeArea", to: "runeDeck", cardId: "" } },
  { name: "legend→base (reject)", action: { type: "move_card", from: "legend", to: "base", cardId: "" } },
  { name: "take deck unit→battlefield", action: { type: "take_card_from_deck", cardId: "synthetic-deck-unit", to: "battlefieldA" } },
  { name: "take deck spell→base (reject)", action: { type: "take_card_from_deck", cardId: "synthetic-deck-spell", to: "base" } },
  { name: "take deck token→hand burn", action: { type: "take_card_from_deck", cardId: "synthetic-deck-token", to: "hand" } },
  { name: "send gear→deck top", action: { type: "send_to_deck", from: "hand", cardId: "synthetic-gear", position: "top" } },
  { name: "send unit→deck bottom", action: { type: "send_to_deck", from: "hand", cardId: "synthetic-unit", position: "bottom" } },
];

describe.skipIf(!fs.existsSync(ORACLE) || !fs.existsSync(path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks")) || !fs.existsSync(FIXTURE))("oracle movement matrix", () => {
  it("matches move legality and exhaustion", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index]!;
      const mineRoom = fixture();
      const theirRoom = fixture();
      syntheticBoard(mineRoom);
      syntheticBoard(theirRoom);
      if ("setup" in scenario && scenario.setup) scenario.setup(mineRoom);
      if ("setup" in scenario && scenario.setup) scenario.setup(theirRoom);
      const action = actionFor(scenario);
      fill(action, mineRoom);
      const now = 1760000500000 + index * 1000;
      const mine = applyGameAction(mineRoom, "p1", action, {
        now,
        rng: seeded(600 + index),
        mode: "multiplayer",
        idFactory: counterFactory(),
      });
      const oracle = original.applyDirect(theirRoom, "p1", action, {
        now: () => now,
        random: seeded(600 + index),
        idFactory: counterFactory(),
      });
      expect(normalize(mine.ok ? mine.state : mineRoom), scenario.name).toEqual(normalize(oracle.state));
    }
  });
});

function actionFor(scenario: { action: Action }): Action {
  return JSON.parse(JSON.stringify(scenario.action)) as Action;
}

function fill(action: Action, room: Room): void {
  const board = room.players[0]!.board!;
  if (action.cardId === "") {
    if (action.type === "move_card" && action.from === "champion") action.cardId = board.champion[0]!.id;
    else if (action.type === "move_card" && action.from === "runeArea") action.cardId = board.runeArea[0]!.id;
    else if (action.type === "move_card" && action.from === "legend") action.cardId = board.legend[0]!.id;
    else action.cardId = board.hand[0]!.id;
  }
}
