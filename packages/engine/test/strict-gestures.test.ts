/**
 * R4-gestures: end-to-end gesture routing through `applyGameAction`.
 *
 * In a strict room a board gesture produces exactly the state of the equivalent `rules_*` intent
 * (same `applyRulesIntent` path, same prompts/events/log); an illegal gesture is rejected with
 * the `explainIllegal` code/rule and leaves the room untouched. Sandbox rooms keep the original
 * handlers. The §6.4 manual window keeps its free board actions.
 */
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";
import { getCardScript, registerCardScript } from "@rift/rules";

import { applyGameAction, strictLegalIntents } from "../src";
import {
  apply,
  deepCopy,
  inGame,
  makeContext,
  sandboxInGame,
  strictGestureRoom,
  takeFromDeck,
} from "./strict-gestures-fixture";

type Action = Record<string, unknown> & { type: string };

function outcome(room: Room, actor: string, action: Action) {
  return applyGameAction(room, actor, action, makeContext());
}

/** Both calls start from the same room and an identical deterministic context. */
function expectSameState(room: Room, gesture: Action, intent: Action): Room {
  const viaGesture = outcome(room, "p1", gesture);
  const direct = outcome(room, "p1", intent);
  expect(viaGesture.ok, gesture.type).toBe(true);
  expect(direct.ok, intent.type).toBe(true);
  if (!viaGesture.ok || !direct.ok) return room;
  expect(viaGesture.state).toEqual(direct.state);
  return viaGesture.state;
}

function expectRejected(room: Room, actor: string, action: Action, code: string, rule?: string) {
  const before = deepCopy(room);
  const result = outcome(room, actor, action);
  expect(result.ok, `${action.type} should be rejected`).toBe(false);
  if (result.ok) return;
  expect(result.errorCode).toBe(code);
  if (rule) expect(result.rule).toBe(rule);
  expect(room).toEqual(before);
}

describe("strict gestures equal their rules_* intent [R349–359][R449–455]", () => {
  it("hand → Base plays the card (rules_play, Base)", () => {
    const { room, ids } = strictGestureRoom();
    const next = expectSameState(
      room,
      { type: "move_card", from: "hand", to: "base", cardId: ids.keeperHand },
      { type: "rules_play", cardId: ids.keeperHand, location: "base" },
    );
    expect(next.players[0]?.board?.base.some((card) => card.id === ids.keeperHand)).toBe(true);
  });

  it("hand → battlefield plays the card at that battlefield", () => {
    const { room, ids } = strictGestureRoom();
    const next = expectSameState(
      room,
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: ids.keeperHand },
      { type: "rules_play", cardId: ids.keeperHand, location: "battlefieldA" },
    );
    expect(next.players[0]?.board?.battlefieldA.some((card) => card.id === ids.keeperHand)).toBe(true);
  });

  it("a spell dragged out to play (chain_add) plays it", () => {
    const { room, ids } = strictGestureRoom();
    expectSameState(
      room,
      { type: "chain_add", from: "hand", cardId: ids.meditation, clientEntryId: "chain-1" },
      { type: "rules_play", cardId: ids.meditation },
    );
  });

  it("Base → Battlefield is a Standard Move", () => {
    const { room, ids } = strictGestureRoom();
    const next = expectSameState(
      room,
      { type: "move_card", from: "base", to: "battlefieldA", cardId: ids.keeperBase },
      { type: "rules_move", unitIds: [ids.keeperBase], to: "battlefieldA" },
    );
    expect(next.players[0]?.board?.battlefieldA.some((card) => card.id === ids.keeperBase)).toBe(true);
  });

  it("several units dragged together move as one Standard Move", () => {
    const { room, ids } = strictGestureRoom();
    expectSameState(
      room,
      {
        type: "move_card",
        from: "battlefieldA",
        to: "base",
        cardId: ids.caitlyn,
        cardIds: [ids.caitlyn, ids.hunter],
      },
      { type: "rules_move", unitIds: [ids.caitlyn, ids.hunter], to: "base" },
    );
  });

  it("tapping a card with one legal ability activates it", () => {
    const { room, ids } = strictGestureRoom();
    // The ability ref comes from the read side, exactly as a client would learn it.
    const ability = strictLegalIntents(room, "p1")!.activatable.find(
      (entry) => entry.objectId === ids.caitlyn,
    )!.ability;
    expectSameState(
      room,
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: ids.caitlyn, expectedExhausted: false },
      { type: "rules_activate", objectId: ids.caitlyn, ability },
    );
  });

  it("dropping Gear on a unit equips it (rules_activate equip:0)", () => {
    const { room, ids } = strictGestureRoom();
    expectSameState(
      room,
      { type: "equip_card", equipmentCardId: ids.blade, unitCardId: ids.keeperBase },
      { type: "rules_activate", objectId: ids.blade, ability: "equip:0", targets: [ids.keeperBase] },
    );
  });

  it("the sandbox turn button (end_turn) ends the strict turn", () => {
    const { room } = strictGestureRoom();
    const next = expectSameState(room, { type: "end_turn" }, { type: "rules_end_turn" });
    expect(next.rules?.turn.player).toBe("p2");
  });
});

describe("illegal strict gestures [§5]", () => {
  it("Battlefield → Battlefield without Ganking: 144.4.c", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(
      room,
      "p1",
      { type: "move_card", from: "battlefieldA", to: "battlefieldB", cardId: ids.hunter },
      "invalid_location",
      "144.4.c",
    );
  });

  it("playing on the opponent's turn: not_your_priority (312.1)", () => {
    const { room, ids } = strictGestureRoom();
    const afterEndTurn = apply(room, "p1", { type: "end_turn" }, makeContext());
    expectRejected(
      afterEndTurn,
      "p1",
      { type: "move_card", from: "hand", to: "base", cardId: ids.keeperHand },
      "not_your_priority",
      "312.1",
    );
  });

  it("tapping an object with no activated ability: illegal_action (403.3)", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(
      room,
      "p1",
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: ids.hunter, expectedExhausted: false },
      "illegal_action",
      "403.3",
    );
  });

  it("a Rune tap with two legal abilities: ambiguous_gesture with candidate refs", () => {
    const { room, ids } = strictGestureRoom();
    const before = deepCopy(room);
    const result = outcome(room, "p1", {
      type: "toggle_exhausted",
      zone: "runeArea",
      cardId: ids.rune,
      expectedExhausted: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("ambiguous_gesture");
    expect(result.detail).toContain("rune:exhaust");
    expect(result.detail).toContain("rune:recycle");
    expect(room).toEqual(before);
  });

  it("a Quick-Draw hand attachment drop is rejected (819.1.d) and changes nothing", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(
      room,
      "p1",
      { type: "equip_card", equipmentCardId: ids.blade, unitCardId: ids.keeperBase, asAttachment: true },
      "strict_mode_action",
      "819.1.d",
    );
  });

  it("ending another player's turn is rejected", () => {
    const { room } = strictGestureRoom();
    expectRejected(room, "p2", { type: "end_turn" }, "not_your_turn", "316.9");
  });

  it("free-form manipulation is no longer silently applied", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(room, "p1", { type: "adjust_card_might", zone: "base", cardId: ids.keeperBase, delta: 1 }, "strict_mode_action");
    expectRejected(room, "p1", { type: "draw_cards", count: 1 }, "strict_mode_action");
    expectRejected(
      room,
      "p1",
      { type: "move_cards_to_trash_batch", from: "hand", to: "trash", cardIds: [ids.meditation] },
      "strict_mode_action",
    );
  });
});

describe("§6.4 manual window keeps free board actions", () => {
  it("allows the manual player's board actions and rejects them after Done", () => {
    const original = getCardScript("Rebuke");
    registerCardScript({ name: "Rebuke", text: "test manual spell", status: "manual", abilities: [] });
    try {
      const ctx = makeContext();
      let room = inGame("strict", ctx);
      const board = room.players[0]!.board!;
      const rebuke = takeFromDeck(board, "Rebuke", "hand");
      room = apply(room, "p1", { type: "rules_play", cardId: rebuke.id }, ctx);
      expect(room.rules?.priority).toBe("p2");
      room = apply(room, "p2", { type: "rules_pass" }, ctx);
      expect(room.rules?.manual?.player).toBe("p1");

      // §6.4: the manual player's free board actions stay available (passthrough, not intents).
      const handBefore = room.players[0]!.board!.hand.length;
      room = apply(room, "p1", { type: "draw_cards", count: 1 }, ctx);
      expect(room.players[0]?.board?.hand.length).toBe(handBefore + 1);

      const card = room.players[0]!.board!.hand[0]!;
      room = apply(room, "p1", { type: "move_card", from: "hand", to: "base", cardId: card.id }, ctx);
      expect(room.players[0]?.board?.base.some((entry) => entry.id === card.id)).toBe(true);

      // The exception is only for the manual player.
      const denied = outcome(room, "p2", { type: "draw_cards", count: 1 });
      expect(denied.ok).toBe(false);
      if (!denied.ok) expect(denied.errorCode).toBe("strict_mode_action");

      room = apply(room, "p1", { type: "rules_manual_done" }, ctx);
      expect(room.rules?.manual).toBe(null);
      expectRejected(room, "p1", { type: "draw_cards", count: 1 }, "strict_mode_action");
    } finally {
      if (original) registerCardScript(original);
    }
  });
});

describe("sandbox rooms are unchanged", () => {
  it("the same gestures keep their original sandbox behaviour", () => {
    const ctx = makeContext();
    let room = sandboxInGame(ctx);
    expect(room.rules).toBeUndefined();

    room = apply(room, "p1", { type: "draw_cards", count: 1 }, ctx);
    const card = room.players[0]!.board!.hand.at(-1)!;
    expect(card).toBeTruthy();

    room = apply(room, "p1", { type: "move_card", from: "hand", to: "base", cardId: card.id }, ctx);
    expect(room.players[0]?.board?.base.some((entry) => entry.id === card.id)).toBe(true);
    expect(room.rules).toBeUndefined();

    room = apply(
      room,
      "p1",
      { type: "toggle_exhausted", zone: "base", cardId: card.id, expectedExhausted: false },
      ctx,
    );
    expect(room.players[0]?.board?.base.find((entry) => entry.id === card.id)?.exhausted).toBe(true);

    room = apply(room, "p1", { type: "chain_add", from: "base", cardId: card.id, clientEntryId: "chain-sandbox" }, ctx);
    expect(room.chainEntries.some((entry) => entry.id === "chain-sandbox")).toBe(true);
  });

  it("sandbox rooms still reject rules_* intents", () => {
    const room = sandboxInGame(makeContext());
    const denied = outcome(room, "p1", { type: "rules_end_turn" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.errorCode).toBe("strict_mode_action");
  });
});
