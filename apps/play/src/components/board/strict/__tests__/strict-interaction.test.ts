import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyGameAction, createInitialGameState, strictExplainIllegal, strictLegalIntents } from "@rift/engine";
import { createTranslator } from "@rift/i18n";
import type { DeckSections, LegalIntents, PlayableCardDetail, Room, WireAction } from "@rift/protocol";

import { buildDropIntent } from "../../drag/drop-intents";
import {
  buildStrictCardMenu,
  buildStrictHandMenu,
  emptyPaymentDraft,
  strictActivateIntent,
  strictDropAttempt,
  strictEndTurnIntent,
  strictMoveIntent,
  strictPassIntent,
  strictPaymentPlan,
  strictPlayIntent,
  strictViewFromLegal,
  type StrictBoardView,
  type StrictMenuContext,
} from "../strict-interaction";
import { strictPlayIntentFromDialog } from "../StrictPlayDialog";

const t = createTranslator("en");
const DECKS = path.resolve(
  __dirname,
  "../../../../../../../packages/rules/test/fixtures/decks.json",
);
const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as Record<
  "deckA" | "deckB",
  { raw: string; sections: DeckSections }
>;

let seed = 99;
const ctx = () => ({
  now: 1_760_000_000_000,
  rng: () => {
    seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
    return seed / 0x100000000;
  },
  mode: "multiplayer" as const,
});

/** Real strict duel at turn 1 Main with p1 holding priority. */
function inGame(): Room {
  let room = createInitialGameState({
    roomCode: "STRICT-UI",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: false,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "Alice", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "Bob", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room.firstPlayerId = "p1";
  room.rulesMode = "strict";
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  for (const actor of ["p1", "p2"]) {
    const result = applyGameAction(room, actor, { type: "submit_mulligan", cardIds: [] }, ctx());
    if (!result.ok) throw new Error(result.error);
    room = result.state;
  }
  return room;
}

function legal(overrides: Partial<LegalIntents> = {}): LegalIntents {
  return {
    playerId: "p1",
    playableCardIds: [],
    activatable: [],
    moves: [],
    canPass: false,
    canEndTurn: false,
    canChoose: false,
    canManualDone: false,
    prompt: null,
    ...overrides,
  };
}

function detail(overrides: Partial<PlayableCardDetail> = {}): PlayableCardDetail {
  return {
    cardId: "card_1",
    locations: ["base"],
    optionalCosts: [],
    cost: { energy: 1, power: 0 },
    ...overrides,
  };
}

function stubRoom(): Room {
  return {
    roomCode: "STUB",
    createdAt: 1,
    updatedAt: 1,
    phase: "in_game",
    players: [
      {
        id: "p1",
        seat: 0,
        name: "Alice",
        joinedAt: 1,
        board: {
          hand: [{ id: "card_1", name: "Rebuke", source: "mainDeck", exhausted: false, createdAt: 1, type: "Spell" }],
          base: [{ id: "unit_1", name: "Noxus Hopeful", source: "mainDeck", exhausted: false, createdAt: 1, type: "Unit" }],
          runeArea: [],
        },
      },
      { id: "p2", seat: 1, name: "Bob", joinedAt: 1 },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    rulesMode: "strict",
    rules: {
      version: 1,
      turn: { player: "p1", number: 1, phase: "main" },
      priority: "p1",
      focus: null,
      passes: [],
      chain: [],
      showdown: null,
      combat: null,
      contested: {},
      staged: { showdowns: [], combats: [] },
      tasks: [],
      prompt: null,
      triggers: [],
      effects: [],
      objects: {},
      pools: {},
      scoredThisTurn: {},
      history: { cardsPlayedThisTurn: {} },
      manual: null,
    },
  } as unknown as Room;
}

function viewWith(value: LegalIntents): StrictBoardView {
  return strictViewFromLegal("p1", value);
}

function menuContext(view: StrictBoardView, room = stubRoom()): StrictMenuContext {
  return {
    room,
    view,
    t,
    explain: () => ({ ok: true }),
  };
}

describe("strict board interaction mapping (R4-strict-ui)", () => {
  it("[R355.2] hand drop to Base sends rules_play with the location; sandbox keeps move_card", () => {
    const room = inGame();
    const legalIntents = strictLegalIntents(room, "p1")!;
    const play = legalIntents.playable![0]!;
    const view = viewWith(legalIntents);
    const attempt = strictDropAttempt({
      view,
      sourceZone: "hand",
      cardId: play.cardId,
      targetZone: "base",
      targetOwner: "self",
    });
    expect(attempt).toEqual({
      legal: true,
      intent: { type: "rules_play", cardId: play.cardId, location: "base" },
    });
    const applied = applyGameAction(room, "p1", attempt!.intent, ctx());
    expect(applied.ok).toBe(true);

    const sandbox = buildDropIntent({
      source: {
        kind: "boardCard",
        payload: { zone: "hand", cardId: play.cardId, exhausted: false, hidden: false },
        card: room.players[0]!.board!.hand.find((card) => card.id === play.cardId),
      },
      targetZone: "base",
      targetOwner: "self",
      viewerId: "p1",
      actorPlayerId: "p1",
    });
    expect(sandbox).toEqual({
      type: "move_card",
      from: "hand",
      to: "base",
      cardId: play.cardId,
    });
  });

  it("[R355.2] a second legal Location is sent with the drop; an illegal one is explained", () => {
    const view = viewWith(
      legal({
        playableCardIds: ["card_1"],
        playable: [detail({ locations: ["base", "battlefieldA"] })],
      }),
    );
    const attempt = strictDropAttempt({
      view,
      sourceZone: "hand",
      cardId: "card_1",
      targetZone: "battlefieldA",
      targetOwner: "self",
    });
    expect(attempt).toEqual({
      legal: true,
      intent: { type: "rules_play", cardId: "card_1", location: "battlefieldA" },
    });

    const room = inGame();
    const realLegal = strictLegalIntents(room, "p1")!;
    const realView = viewWith(realLegal);
    const play = realLegal.playable![0]!;
    expect(play.locations).not.toContain("battlefieldB");
    const illegal = strictDropAttempt({
      view: realView,
      sourceZone: "hand",
      cardId: play.cardId,
      targetZone: "battlefieldB",
      targetOwner: "self",
    });
    expect(illegal?.legal).toBe(false);
    const verdict = strictExplainIllegal(room, "p1", illegal!.intent);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("invalid_location");
      expect(verdict.rule).toBeTruthy();
    }
    const trash = strictDropAttempt({
      view: realView,
      sourceZone: "hand",
      cardId: play.cardId,
      targetZone: "trash",
      targetOwner: "self",
    });
    expect(trash?.legal).toBe(false);
    expect(trash?.reason).toEqual({ code: "invalid_location", rule: "355.2" });
  });

  it("[R355.2] spells (no Location) still send rules_play when dropped on a play zone", () => {
    const view = viewWith(
      legal({
        playableCardIds: ["card_1"],
        playable: [detail({ locations: [], cost: { energy: 2, power: 0 } })],
      }),
    );
    expect(
      strictDropAttempt({
        view,
        sourceZone: "hand",
        cardId: "card_1",
        targetZone: "base",
        targetOwner: "self",
      }),
    ).toEqual({ legal: true, intent: { type: "rules_play", cardId: "card_1" } });
  });

  it("[R449] unit drag to a battlefield sends rules_move; sandbox keeps move_card", () => {
    const room = inGame();
    const p1 = room.players[0]!;
    const unit = p1.board!.hand.find((card) => /unit/i.test(card.type ?? ""))!;
    p1.board!.hand = p1.board!.hand.filter((card) => card.id !== unit.id);
    p1.board!.base.push({ ...unit, exhausted: false });
    const legalIntents = strictLegalIntents(room, "p1")!;
    const view = viewWith(legalIntents);
    const move = legalIntents.moves.find((entry) => entry.to === "battlefieldA")!;
    expect(move.unitIds).toContain(unit.id);
    const attempt = strictDropAttempt({
      view,
      sourceZone: "base",
      cardId: unit.id,
      targetZone: "battlefieldA",
      targetOwner: "self",
    });
    expect(attempt).toEqual({
      legal: true,
      intent: { type: "rules_move", unitIds: [unit.id], to: "battlefieldA" },
    });
    expect(applyGameAction(room, "p1", attempt!.intent, ctx()).ok).toBe(true);

    const sandbox = buildDropIntent({
      source: {
        kind: "boardCard",
        payload: { zone: "base", cardId: unit.id, exhausted: false, hidden: false },
        card: unit,
      },
      targetZone: "battlefieldA",
      targetOwner: "self",
      viewerId: "p1",
      actorPlayerId: "p1",
    });
    expect(sandbox).toEqual({
      type: "move_card",
      from: "base",
      to: "battlefieldA",
      cardId: unit.id,
    });
  });

  it("[R144.2] an exhausted unit is not a legal drop and the engine names the reason", () => {
    const room = inGame();
    const p1 = room.players[0]!;
    const unit = p1.board!.hand.find((card) => /unit/i.test(card.type ?? ""))!;
    p1.board!.hand = p1.board!.hand.filter((card) => card.id !== unit.id);
    p1.board!.base.push({ ...unit, exhausted: true });
    const legalIntents = strictLegalIntents(room, "p1")!;
    const view = viewWith(legalIntents);
    const attempt = strictDropAttempt({
      view,
      sourceZone: "base",
      cardId: unit.id,
      targetZone: "battlefieldA",
      targetOwner: "self",
    });
    expect(attempt?.legal).toBe(false);
    const verdict = strictExplainIllegal(room, "p1", attempt!.intent);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("unit_exhausted");
      expect(verdict.rule).toBe("144.2");
    }
  });

  it("[R376] the card menu offers Activate, incl. manual:<n>, and sends rules_activate", () => {
    const view = viewWith(
      legal({
        activatable: [
          { objectId: "unit_1", ability: "activated:0" },
          { objectId: "unit_1", ability: "manual:2" },
        ],
      }),
    );
    const entries = buildStrictCardMenu(menuContext(view), "unit_1", "base");
    const activations = entries.filter((entry) => entry.id.startsWith("activate:"));
    expect(activations.map((entry) => entry.label)).toEqual([
      "Activate: Noxus Hopeful",
      "Activate (manual): Noxus Hopeful",
    ]);
    expect(activations.map((entry) => entry.intent)).toEqual([
      { type: "rules_activate", objectId: "unit_1", ability: "activated:0" },
      { type: "rules_activate", objectId: "unit_1", ability: "manual:2" },
    ]);
    expect(activations.every((entry) => !entry.disabled)).toBe(true);
  });

  it("[R449] the card menu offers each legal Standard Move destination", () => {
    const view = viewWith(
      legal({ moves: [{ unitIds: ["unit_1"], to: "battlefieldA" }, { unitIds: ["unit_1"], to: "battlefieldB" }] }),
    );
    const entries = buildStrictCardMenu(menuContext(view), "unit_1", "base");
    expect(entries.filter((entry) => entry.id.startsWith("move:")).map((entry) => entry.intent)).toEqual([
      { type: "rules_move", unitIds: ["unit_1"], to: "battlefieldA" },
      { type: "rules_move", unitIds: ["unit_1"], to: "battlefieldB" },
    ]);
  });

  it("[R355.2] the hand menu Play entries send rules_play (per Location), never a sandbox action", () => {
    const view = viewWith(
      legal({
        playableCardIds: ["card_1"],
        playable: [detail({ locations: ["base", "battlefieldA"], optionalCosts: ["optional:0"] })],
      }),
    );
    const entries = buildStrictHandMenu(menuContext(view), "card_1");
    const plays = entries.filter((entry) => entry.id.startsWith("play"));
    expect(plays.map((entry) => entry.intent).filter(Boolean)).toEqual([
      { type: "rules_play", cardId: "card_1", location: "base" },
      { type: "rules_play", cardId: "card_1", location: "battlefieldA" },
    ]);
    expect(plays.some((entry) => entry.openPlay)).toBe(true);
    expect(entries.every((entry) => entry.intent?.type !== "move_card" && entry.intent?.type !== "chain_add")).toBe(
      true,
    );
  });

  it("[R811.1.b] Hide is offered with its battlefield and sends rules_play hide:true", () => {
    const view = viewWith(
      legal({ hideable: [{ cardId: "card_1", locations: ["battlefieldA", "battlefieldB"] }] }),
    );
    const entries = buildStrictHandMenu(menuContext(view), "card_1");
    const hides = entries.filter((entry) => entry.id.startsWith("hide:"));
    expect(hides.map((entry) => entry.intent)).toEqual([
      { type: "rules_play", cardId: "card_1", hide: true, location: "battlefieldA" },
      { type: "rules_play", cardId: "card_1", hide: true, location: "battlefieldB" },
    ]);
  });

  it("[R355.1.a][R356] optional costs and an explicit payment plan ride on the same rules_play", () => {
    const intent = strictPlayIntent({
      cardId: "card_1",
      location: "base",
      optionalCosts: ["optional:0"],
      payment: { poolEnergy: 1, exhaustRunes: ["rune_1"] },
    });
    expect(intent).toEqual({
      type: "rules_play",
      cardId: "card_1",
      location: "base",
      optionalCosts: ["optional:0"],
      plan: { poolEnergy: 1, exhaustRunes: ["rune_1"] },
    });
    expect(
      strictPaymentPlan({
        auto: false,
        exhaustRunes: ["rune_1"],
        recycleRunes: ["rune_2"],
        poolEnergy: 2,
        poolPower: 1,
      }),
    ).toEqual({
      poolEnergy: 2,
      exhaustRunes: ["rune_1"],
      recycleRunes: ["rune_2"],
      poolPower: { any: 1 },
    });
    expect(strictPaymentPlan(emptyPaymentDraft())).toBeUndefined();
  });

  it("[R811.1.b] the play dialog builds a Hide intent for the chosen battlefield", () => {
    const intent = strictPlayIntentFromDialog({
      cardId: "card_1",
      detail: detail({ locations: ["base"] }),
      hideLocations: ["battlefieldA"],
      location: "battlefieldA",
      optionalCosts: ["optional:0"],
      payment: { auto: false, exhaustRunes: ["rune_1"], recycleRunes: [], poolEnergy: 0, poolPower: 0 },
      hide: true,
    });
    expect(intent).toEqual({
      type: "rules_play",
      cardId: "card_1",
      location: "battlefieldA",
      hide: true,
    });
  });

  it("[R312][R316] Pass and End turn map to rules_pass / rules_end_turn", () => {
    expect(strictPassIntent()).toEqual({ type: "rules_pass" });
    expect(strictEndTurnIntent()).toEqual({ type: "rules_end_turn" });
    expect(strictMoveIntent(["unit_1"], "base")).toEqual({
      type: "rules_move",
      unitIds: ["unit_1"],
      to: "base",
    });
    expect(strictActivateIntent("unit_1", "manual:0")).toEqual({
      type: "rules_activate",
      objectId: "unit_1",
      ability: "manual:0",
    });
  });

  it("[R312] the real strict room's End turn intent is accepted by the engine", () => {
    const room = inGame();
    const legalIntents = strictLegalIntents(room, "p1")!;
    expect(legalIntents.canEndTurn).toBe(true);
    const result = applyGameAction(room, "p1", strictEndTurnIntent() as WireAction, ctx());
    expect(result.ok).toBe(true);
  });
});
