import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CardInstance, ChainEntry, Room } from "@rift/protocol";
import { applyGameAction } from "../src";
import { getCardByCode, getCardByName } from "../src/catalog";

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
type Setup = (room: Room) => void;

function fixture(): Room {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
}

function makeCard(code: string, id: string, overrides: Partial<CardInstance> = {}): CardInstance {
  const card = getCardByCode(code);
  if (!card) throw new Error(`unknown card ${code}`);
  return {
    id,
    name: card.name,
    source: "mainDeck",
    exhausted: false,
    createdAt: 1760000000000,
    ownerPlayerId: "p1",
    cardCode: card.id,
    type: card.type,
    domains: card.domains,
    text: card.text,
    energyCost: card.energyCost,
    powerCost: card.powerCost,
    might: card.might,
    keywords: card.keywords,
    subtypes: card.subtypes,
    isPlaceholder: false,
    ...overrides,
  };
}

function withHiddenInHand(room: Room): void {
  const hidden = makeCard("OGN-045", "synthetic-hidden", { keywords: ["Hidden"], type: "Spell" });
  room.players[0]!.board!.hand.push(hidden);
}

const scenarios: Array<{ name: string; setup?: Setup; actor?: string; action: Action }> = [
  { name: "adjust_floating_resource", action: { type: "adjust_floating_resource", resource: "energy", delta: 3 } },
  {
    name: "floating_resource_batch",
    setup: (room) => {
      room.players[0]!.board!.floatingEnergy = 2;
      room.players[0]!.board!.floatingPower = 1;
    },
    action: {
      type: "floating_resource_batch",
      operations: [
        { type: "adjust_floating_resource", resource: "energy", delta: -1 },
        { type: "adjust_floating_resource", resource: "power", delta: 2 },
      ],
    },
  },
  {
    name: "clear_floating_resources",
    setup: (room) => {
      room.players[0]!.board!.floatingEnergy = 2;
      room.players[0]!.board!.floatingPower = 1;
    },
    action: { type: "clear_floating_resources" },
  },
  { name: "set_hand_reveal_public", action: { type: "set_hand_reveal", reveal: true } },
  {
    name: "set_hand_reveal_target",
    action: { type: "set_hand_reveal", reveal: true, targetPlayerId: "p2" },
  },
  {
    name: "set_card_revealed_to_opponent",
    action: {
      type: "set_card_revealed_to_opponent",
      zone: "hand",
      cardId: "",
      revealed: true,
    },
  },
  {
    name: "set_card_hidden",
    setup: withHiddenInHand,
    action: { type: "set_card_hidden", zone: "hand", cardId: "synthetic-hidden", hidden: true },
  },
  { name: "peek_deck_bottom", action: { type: "peek_deck_bottom" } },
  { name: "peek_deck_top", action: { type: "peek_deck_top", count: 4 } },
  {
    name: "set_deck_peek_card_reveal",
    setup: (room) => {
      const board = room.players[0]!.board!;
      board.deckPeek = { cardIds: [board.deck[board.deck.length - 1]!.id], revealedCardIds: [] };
    },
    action: { type: "set_deck_peek_card_reveal", cardId: "", reveal: true },
    // cardId filled by the harness from the setup room
  },
  {
    name: "set_deck_peek_cards_reveal",
    setup: (room) => {
      const board = room.players[0]!.board!;
      const ids = [board.deck[board.deck.length - 1]!.id, board.deck[board.deck.length - 2]!.id];
      board.deckPeek = { cardIds: ids, revealedCardIds: [] };
    },
    action: { type: "set_deck_peek_cards_reveal", cardIds: [], reveal: true, autoRevealNewCards: true },
  },
  { name: "take_top_from_deck", action: { type: "take_top_from_deck", to: "hand" } },
  { name: "take_top_from_deck_banished", action: { type: "take_top_from_deck", to: "banished" } },
  { name: "send_rune_to_deck_bottom", action: { type: "send_rune_to_deck_bottom", cardId: "" } },
  { name: "recycle_rune_for_floating_energy", action: { type: "recycle_rune_for_floating_energy", cardId: "" } },
  { name: "send_to_rune_deck", action: { type: "send_to_rune_deck", from: "runeArea", cardId: "", position: "top" } },
  {
    name: "rune_batch",
    action: {
      type: "rune_batch",
      operations: [
        { type: "draw_rune" },
        { type: "send_rune_to_deck_bottom", cardId: "" },
      ],
    },
  },
  {
    name: "payment_batch",
    setup: (room) => {
      room.players[0]!.board!.floatingEnergy = 2;
    },
    action: {
      type: "payment_batch",
      operations: [
        { type: "toggle_exhausted", zone: "runeArea", cardId: "", expectedExhausted: false },
        { type: "adjust_floating_resource", resource: "energy", delta: -1 },
      ],
    },
  },
  {
    name: "duplicate_card",
    action: { type: "duplicate_card", zone: "hand", cardId: "" },
  },
  {
    name: "move_cards_to_trash_batch",
    action: { type: "move_cards_to_trash_batch", from: "hand", cardIds: [] },
  },
  {
    name: "move_off_board_cards_batch_to_trash",
    action: { type: "move_off_board_cards_batch", from: "hand", to: "trash", cardIds: [] },
  },
  {
    name: "move_off_board_cards_batch_to_deck",
    action: { type: "move_off_board_cards_batch", from: "hand", to: "deck", cardIds: [] },
  },
  {
    name: "transfer_card_control",
    setup: (room) => {
      const card = room.players[0]!.board!.hand.find((candidate) => candidate.type?.toLowerCase().includes("unit"))!;
      room.players[0]!.board!.base.push({ ...card, id: "synthetic-unit", exhausted: false });
    },
    action: { type: "transfer_card_control", zone: "base", cardId: "synthetic-unit", targetPlayerId: "p2" },
  },
  { name: "send_to_deck", action: { type: "send_to_deck", from: "hand", cardId: "", position: "top" } },
  {
    name: "adjust_card_counter_clear",
    setup: (room) => {
      room.players[0]!.board!.base.push(makeCard("OGN-045", "synthetic-unit", { type: "Unit", might: 3 }));
      room.players[0]!.board!.base[0]!.whiteCounter = 4;
    },
    action: { type: "clear_card_counter", zone: "base", cardId: "synthetic-unit", counter: "white" },
  },
  {
    name: "set_card_label_count",
    setup: (room) => {
      room.players[0]!.board!.base.push(makeCard("OGN-045", "synthetic-unit", { type: "Unit", might: 3 }));
      room.players[0]!.board!.base[0]!.customLabels = ["Shield 2"];
    },
    action: { type: "set_card_label", zone: "base", cardId: "synthetic-unit", slot: 0, label: "Shield 2", countDelta: 1 },
  },
  {
    name: "set_battlefield_brush",
    setup: (room) => {
      room.players[0]!.board!.legend = [makeCard("UNL-195", "synthetic-ivern", { type: "Legend" })];
    },
    action: { type: "set_battlefield_brush", zone: "battlefieldA", active: true },
  },
  {
    name: "set_extra_turn",
    setup: (room) => {
      const card = makeCard("OGN-122", "synthetic-timewarp", { type: "Spell", ownerPlayerId: "p1" });
      const entry: ChainEntry = {
        id: "chain_test",
        card,
        addedAt: room.updatedAt,
        fromZone: "hand",
        sourceCardId: card.id,
        byPlayerId: "p1",
        byPlayerName: "Alice",
      };
      room.chainEntries = [entry];
    },
    action: { type: "set_extra_turn", entryId: "chain_test", enabled: true },
  },
  {
    name: "animate_orianna_gear",
    setup: (room) => {
      const orianna = getCardByName("Orianna, Lady of Clockwork")!;
      room.players[0]!.board!.legend = [makeCard(orianna.id, "synthetic-orianna", { type: "Legend" })];
      room.players[0]!.board!.base.push(makeCard("OGN-077", "synthetic-gear", { type: "Gear", source: "mainDeck" }));
    },
    action: { type: "animate_orianna_gear", legendId: "synthetic-orianna", zone: "base", cardId: "synthetic-gear" },
  },
  {
    name: "dockside_banish_unit",
    setup: (room) => {
      const dockside = getCardByName("Dockside Lock-Up")!;
      room.players[0]!.board!.battlefieldA.push(makeCard(dockside.id, "synthetic-dockside", { type: "Gear" }));
      const unit = room.players[1]!.board!.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
      room.players[1]!.board!.battlefieldA.push({ ...unit, id: "synthetic-target", exhausted: false });
      delete room.players[1]!.board!.battlefieldA[0]!.hidden;
    },
    action: { type: "dockside_banish_unit", zone: "battlefieldA", cardId: "synthetic-dockside", targetCardId: "synthetic-target" },
  },
  {
    name: "unlink_banished_card",
    setup: (room) => {
      room.players[0]!.board!.base.push(makeCard("OGN-077", "synthetic-dockside", { type: "Gear" }));
      room.players[1]!.board!.banished.push({
        ...makeCard("OGN-045", "synthetic-banished", { ownerPlayerId: "p2" }),
        banishedByCardId: "synthetic-dockside",
      });
    },
    actor: "p2",
    action: { type: "unlink_banished_card", zone: "battlefieldA", cardId: "synthetic-banished", targetCardId: "synthetic-banished" },
  },
  {
    name: "clear_deck_peek",
    setup: (room) => {
      const board = room.players[0]!.board!;
      board.deckPeek = { cardIds: [board.deck[board.deck.length - 1]!.id], revealedCardIds: [] };
    },
    action: { type: "clear_deck_peek" },
  },
  {
    name: "dismiss_deck_peek",
    setup: (room) => {
      const board = room.players[0]!.board!;
      board.deckPeek = { cardIds: [board.deck[board.deck.length - 1]!.id], revealedCardIds: [] };
    },
    action: { type: "dismiss_deck_peek" },
  },
  {
    name: "recycle_deck_peek_card",
    setup: (room) => {
      const board = room.players[0]!.board!;
      board.deckPeek = { cardIds: [board.deck[board.deck.length - 1]!.id], revealedCardIds: [] };
    },
    action: { type: "recycle_deck_peek_card", cardId: "" },
  },
  {
    name: "put_deck_peek_card_on_top",
    setup: (room) => {
      const board = room.players[0]!.board!;
      board.deckPeek = { cardIds: [board.deck[0]!.id], revealedCardIds: [] };
    },
    action: { type: "put_deck_peek_card_on_top", cardId: "" },
  },
  {
    name: "reveal_hidden_board_card",
    setup: (room) => {
      const unit = room.players[0]!.board!.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
      room.players[0]!.board!.battlefieldA.push({
        ...unit,
        id: "synthetic-hidden",
        hidden: true,
        keywords: [...(unit.keywords ?? []), "Hidden"],
        exhausted: true,
      });
    },
    action: { type: "set_card_hidden", zone: "battlefieldA", cardId: "synthetic-hidden", hidden: false },
  },
  {
    name: "reveal_hidden_board_card_to_opponent",
    setup: (room) => {
      const unit = room.players[0]!.board!.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
      room.players[0]!.board!.battlefieldA.push({
        ...unit,
        id: "synthetic-hidden",
        hidden: true,
        keywords: [...(unit.keywords ?? []), "Hidden"],
        exhausted: true,
      });
    },
    action: {
      type: "set_card_revealed_to_opponent",
      zone: "battlefieldA",
      cardId: "synthetic-hidden",
      revealed: true,
    },
  },
  {
    name: "chain_set_repeat",
    setup: (room) => {
      const card = makeCard("OGN-045", "synthetic-spell", { type: "Spell", keywords: ["Repeat", "Flow"] });
      room.chainEntries = [{
        id: "chain_test",
        card,
        addedAt: room.updatedAt,
        fromZone: "hand",
        sourceCardId: card.id,
        byPlayerId: "p1",
        byPlayerName: "Alice",
      }];
    },
    action: { type: "chain_set_repeat", entryId: "chain_test", enabled: true },
  },
  {
    name: "chain_set_flow",
    setup: (room) => {
      const card = makeCard("OGN-045", "synthetic-spell", { type: "Spell", keywords: ["Repeat", "Flow"] });
      room.chainEntries = [{
        id: "chain_test",
        card,
        addedAt: room.updatedAt,
        fromZone: "hand",
        sourceCardId: card.id,
        byPlayerId: "p1",
        byPlayerName: "Alice",
      }];
    },
    action: { type: "chain_set_flow", entryId: "chain_test", enabled: true },
  },
  {
    name: "chain_set_resolve_vote",
    setup: (room) => {
      const card = makeCard("OGN-045", "synthetic-spell", { type: "Spell" });
      room.chainEntries = [{
        id: "chain_test",
        card,
        addedAt: room.updatedAt,
        fromZone: "hand",
        sourceCardId: card.id,
        byPlayerId: "p1",
        byPlayerName: "Alice",
      }];
    },
    actor: "p2",
    action: { type: "chain_set_resolve_vote", entryId: "chain_test", approved: true },
  },
  {
    name: "take_top_from_deck_with_banish_source",
    setup: (room) => {
      const source = getCardByName("Runeblade Anvil")!;
      room.players[0]!.board!.base.push(makeCard(source.id, "synthetic-dockside", { type: "Gear" }));
    },
    action: { type: "take_top_from_deck", to: "banished", sourceCardId: "synthetic-dockside" },
  },
  {
    name: "dockside_play_banished",
    setup: (room) => {
      const dockside = getCardByName("Dockside Lock-Up")!;
      room.players[0]!.board!.battlefieldA.push(makeCard(dockside.id, "synthetic-dockside", { type: "Gear" }));
      const unit = room.players[1]!.board!.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
      room.players[1]!.board!.banished.push({
        ...unit,
        id: "synthetic-banished",
        ownerPlayerId: "p2",
        banishedByCardId: "synthetic-dockside",
      });
    },
    action: { type: "dockside_play_banished", zone: "battlefieldA", cardId: "synthetic-dockside", banishedCardId: "synthetic-banished", to: "base" },
  },
  {
    name: "dockside_play_banished_spell_rejected",
    setup: (room) => {
      const dockside = getCardByName("Dockside Lock-Up")!;
      room.players[0]!.board!.battlefieldA.push(makeCard(dockside.id, "synthetic-dockside", { type: "Gear" }));
      room.players[1]!.board!.banished.push({
        ...makeCard("OGN-045", "synthetic-banished", { ownerPlayerId: "p2" }),
        banishedByCardId: "synthetic-dockside",
      });
    },
    action: { type: "dockside_play_banished", zone: "battlefieldA", cardId: "synthetic-dockside", banishedCardId: "synthetic-banished", to: "base" },
  },
  {
    name: "kharox_play_from_trash",
    setup: (room) => {
      room.players[0]!.board!.base.push(
        makeCard("VEN-114", "synthetic-kharox", { type: "Unit", customLabels: ["Empowered"] }),
      );
      const unit = room.players[1]!.board!.hand.find((card) => card.type?.toLowerCase().includes("unit"))!;
      room.players[1]!.board!.trash.push({ ...unit, id: "synthetic-trash-unit" });
    },
    action: {
      type: "kharox_play_from_trash",
      zone: "base",
      cardId: "synthetic-kharox",
      targetPlayerId: "p2",
      trashCardId: "synthetic-trash-unit",
      to: "base",
    },
  },
  {
    name: "choose_neeko_legend_add",
    setup: (room) => {
      const neeko = getCardByName("Neeko, Blending In")!;
      const legend = getCardByName("Jinx, Loose Cannon") ?? getCardByName("Riven, The Exile")!;
      room.players[0]!.board!.base.push(makeCard(neeko.id, "synthetic-neeko", { type: "Legend" }));
      room.players[0]!.board!.additionalLegends = [makeCard(legend.id, "synthetic-extra-legend", { type: "Legend" })];
    },
    action: {
      type: "choose_neeko_legend",
      neekoCardId: "synthetic-neeko",
      zone: "base",
      legendId: "synthetic-extra-legend",
    },
  },
  {
    name: "choose_neeko_legend_return",
    setup: (room) => {
      const neeko = getCardByName("Neeko, Blending In")!;
      room.players[0]!.board!.base.push(makeCard(neeko.id, "synthetic-neeko", { type: "Legend" }));
      room.players[0]!.board!.legend = [
        makeCard(neeko.id, "synthetic-extra-legend", { type: "Legend", neekoSourceCardId: "synthetic-neeko" }),
      ];
      room.players[0]!.board!.additionalLegends = [];
    },
    action: { type: "choose_neeko_legend", neekoCardId: "synthetic-neeko", zone: "base", legendId: null },
  },
  {
    name: "create_token_merge",
    setup: (room) => {
      room.players[0]!.board!.base.push(makeCard("OGN-045", "synthetic-token-1", { type: "Unit", source: "token", name: "Recruit", exhausted: true }));
    },
    action: { type: "create_token", zone: "base", name: "Recruit" },
  },
  {
    name: "set_stop_at_beginning_phase",
    action: { type: "set_stop_at_beginning_phase", enabled: true },
  },
  {
    name: "set_skip_draw_phase",
    action: { type: "set_skip_draw_phase", enabled: true },
  },
  {
    name: "set_auto_score_from_hold",
    action: { type: "set_auto_score_from_hold", enabled: false },
  },
  {
    name: "set_show_legend_xp_counter",
    action: { type: "set_show_legend_xp_counter", visible: true },
  },
  {
    name: "end_beginning_phase",
    setup: (room) => {
      room.activeTurnStep = "beginning";
      room.playerTurnCounts = { p1: 1, p2: 0 };
      room.boardSettingsByPlayerId = {
        p1: { showLegendXpCounter: false, stopAtBeginningPhase: true, skipDrawPhase: false, autoScoreFromHold: true },
        p2: { showLegendXpCounter: false, stopAtBeginningPhase: false, skipDrawPhase: false, autoScoreFromHold: true },
      };
    },
    action: {
      type: "end_beginning_phase",
      observed: { turnNumber: 1, activePlayerId: "p1", activeStep: "beginning" },
    },
  },
  {
    name: "end_turn_from_beginning",
    setup: (room) => {
      room.activeTurnStep = "beginning";
      room.playerTurnCounts = { p1: 1, p2: 0 };
    },
    action: {
      type: "end_turn",
      observed: { turnNumber: 1, activePlayerId: "p1", activeStep: "beginning" },
    },
  },
  {
    name: "end_turn_stale_observed_noop",
    setup: (room) => {
      room.activeTurnStep = "beginning";
    },
    action: {
      type: "end_turn",
      observed: { turnNumber: 99, activePlayerId: "p1", activeStep: "beginning" },
    },
  },
  {
    name: "target_arrow_add",
    action: { type: "target_arrow_add", sourceCardId: "", targetCardId: "", sourceAnchor: "board", targetAnchor: "board" },
  },
  {
    name: "roll_die",
    action: { type: "roll_die", sides: 6 },
  },
];

describe.skipIf(!fs.existsSync(ORACLE) || !fs.existsSync(path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks")) || !fs.existsSync(FIXTURE))("oracle action matrix", () => {
  it("matches every scenario", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index]!;
      const mineRoom = fixture();
      const theirRoom = fixture();
      scenario.setup?.(mineRoom);
      scenario.setup?.(theirRoom);
      // Fill placeholder ids from the (identical) setup states.
      const action: Action = JSON.parse(JSON.stringify(scenario.action));
      fillIds(action, mineRoom);
      const actor = scenario.actor ?? "p1";
      const beforeOracle = normalize(theirRoom);
      const now = 1760000300000 + index * 1000;
      const mine = applyGameAction(mineRoom, actor, action, {
        now,
        rng: seeded(500 + index),
        mode: "multiplayer",
        idFactory: counterFactory(),
      });
      const oracle = original.applyDirect(theirRoom, actor, action, {
        now: () => now,
        random: seeded(500 + index),
        idFactory: counterFactory(),
      });
      expect(normalize(mine.ok ? mine.state : mineRoom), scenario.name).toEqual(normalize(oracle.state));
      if (JSON.stringify(beforeOracle) === JSON.stringify(normalize(oracle.state))) {
        // eslint-disable-next-line no-console
        console.log(`[no-op scenario] ${scenario.name}`);
      }
    }
  });
});

function fillIds(action: Action, room: Room): void {
  const board = room.players[0]!.board!;
  if (action.type === "unlink_banished_card") action.cardId = "synthetic-banished";
  else if (action.type === "recycle_deck_peek_card" || action.type === "put_deck_peek_card_on_top") {
    action.cardId = board.deckPeek.cardIds[0] ?? board.deck[0]!.id;
  } else if (action.cardId === "") action.cardId = board.hand[0]!.id;
  if (action.type === "send_rune_to_deck_bottom" || action.type === "recycle_rune_for_floating_energy" || action.type === "send_to_rune_deck") {
    action.cardId = board.runeArea[0]!.id;
  }
  if (action.type === "set_deck_peek_card_reveal") {
    action.cardId = board.deckPeek.cardIds[0] ?? board.deck[0]!.id;
  }
  if (action.type === "set_card_revealed_to_opponent" && action.cardId === "") {
    action.cardId = board.hand[0]!.id;
  }
  if (action.type === "set_deck_peek_cards_reveal") {
    action.cardIds = [...board.deckPeek.cardIds];
  }
  if (action.type === "move_cards_to_trash_batch") {
    action.cardIds = board.hand.slice(0, 2).map((card) => card.id);
  }
  if (action.type === "move_off_board_cards_batch") {
    action.cardIds = board.hand.slice(0, 2).map((card) => card.id);
  }
  if (action.type === "payment_batch") {
    const ops = action.operations as Array<Record<string, unknown>>;
    const toggle = ops.find((op) => op.type === "toggle_exhausted");
    if (toggle) toggle.cardId = board.runeArea[0]!.id;
  }
  if (action.type === "rune_batch") {
    const ops = action.operations as Array<Record<string, unknown>>;
    const send = ops.find((op) => op.type === "send_rune_to_deck_bottom");
    if (send) send.cardId = board.runeArea[0]!.id;
  }
  if (action.type === "target_arrow_add") {
    action.sourceCardId = board.legend[0]!.id;
    action.targetCardId = room.players[1]!.board!.champion[0]!.id;
    action.sourceAnchor = "board";
    action.targetAnchor = "board";
  }
}
