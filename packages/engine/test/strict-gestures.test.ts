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
import { overrideCardScript } from "@rift/rules/testing";

import { applyGameAction, strictLegalIntents } from "../src";
import { redactRoomForViewer } from "../../sync/src/redact";
import {
  addSyntheticCard,
  apply,
  deepCopy,
  EVELYNN_ENTRANCING,
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
      {
        type: "rules_activate",
        objectId: ids.blade,
        ability: "equip:0",
        choices: { "target:0": [ids.keeperBase] },
      },
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
    const restore = overrideCardScript({ name: "Rebuke", text: "test manual spell", status: "manual", abilities: [] });
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
      restore();
    }
  });
});

describe("targeting gestures equal their rules_* intent [R355.7][R355.9]", () => {
  it("a spell dropped on a unit binds that target", () => {
    const { room, ids } = strictGestureRoom();
    expectSameState(
      room,
      { type: "move_card", from: "hand", to: "base", cardId: ids.rebuke, targetCardId: ids.hunter },
      { type: "rules_play", cardId: ids.rebuke, choices: { "target:0": [ids.hunter] } },
    );
  });

  it("a board ability dragged onto a unit binds that target", () => {
    const { room, ids } = strictGestureRoom();
    const ability = strictLegalIntents(room, "p1")!.activatable.find(
      (entry) => entry.objectId === ids.caitlyn,
    )!.ability;
    expectSameState(
      room,
      { type: "move_card", from: "battlefieldA", to: "battlefieldA", cardId: ids.caitlyn, targetCardId: ids.enemyHunter },
      {
        type: "rules_activate",
        objectId: ids.caitlyn,
        ability,
        choices: { "target:0": [ids.enemyHunter] },
      },
    );
  });

  it("binds only the first target spec and prompts for the rest", () => {
    const restore = overrideCardScript({
      name: "Defy",
      text: "test two-target spell",
      status: "implemented",
      abilities: [
        {
          kind: "spell",
          effect: {
            op: "seq",
            effects: [
              {
                op: "return_to_hand",
                target: {
                  chosen: true,
                  targetRef: "target:0",
                  cardType: "unit",
                  controller: "self",
                  zone: "battlefield",
                },
              },
              {
                op: "return_to_hand",
                target: {
                  chosen: true,
                  targetRef: "target:1",
                  cardType: "unit",
                  controller: "opponent",
                  zone: "battlefield",
                },
              },
            ],
          },
        },
      ],
    });
    try {
      const { room, ids, ctx } = strictGestureRoom();
      takeFromDeck(room.players[1]!.board!, "Treasure Hunter", "battlefieldB");
      const defy = takeFromDeck(room.players[0]!.board!, "Defy", "hand");
      defy.energyCost = 0;
      defy.powerCost = 0;
      const next = apply(
        room,
        "p1",
        { type: "chain_add", from: "hand", cardId: defy.id, targetCardId: ids.hunter },
        ctx,
      );
      expect(next.rules?.prompt?.kind).toBe("choose-target");
      expect(next.rules?.prompt?.options?.some((option) => option.id === ids.enemyHunter)).toBe(true);
      expect(next.rules?.prompt?.options?.some((option) => option.id === ids.hunter)).toBe(false);
    } finally {
      restore();
    }
  });

  it("a click on an open prompt's option equals rules_choose", () => {
    const { room, ids, ctx } = strictGestureRoom();
    const prompted = apply(room, "p1", { type: "rules_play", cardId: ids.rebuke }, ctx);
    const promptId = prompted.rules?.prompt?.id;
    expect(promptId).toBeTruthy();
    expectSameState(
      prompted,
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: ids.hunter, expectedExhausted: false },
      { type: "rules_choose", promptId: promptId!, answer: { optionIds: [ids.hunter] } },
    );
  });

  it("a click that is not an option is rejected and leaves the prompt open", () => {
    const { room, ids, ctx } = strictGestureRoom();
    const prompted = apply(room, "p1", { type: "rules_play", cardId: ids.rebuke }, ctx);
    expectRejected(
      prompted,
      "p1",
      { type: "toggle_exhausted", zone: "base", cardId: ids.keeperBase, expectedExhausted: false },
      "invalid_choice",
      "411.2",
    );
    expect(prompted.rules?.prompt).toBeTruthy();
  });
});

describe("illegal target gestures [§5]", () => {
  it("a gear dragged on two targetable units is ambiguous", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(
      room,
      "p1",
      { type: "move_card", from: "base", to: "base", cardId: ids.blade, targetCardId: ids.keeperBase },
      "ambiguous_gesture",
      "403.3",
    );
  });

  it("Equip on an enemy unit is an illegal target", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(
      room,
      "p1",
      { type: "equip_card", equipmentCardId: ids.blade, unitCardId: ids.enemyHunter },
      "illegal_target",
      "355.9",
    );
  });

  it("a no-target spell dropped on a unit is an illegal target", () => {
    const { room, ids } = strictGestureRoom();
    expectRejected(
      room,
      "p1",
      { type: "chain_add", from: "hand", cardId: ids.meditation, targetCardId: ids.hunter },
      "illegal_target",
      "355.9",
    );
  });
});

describe("Quick-Draw hand attachment [R819.1.d]", () => {
  it("plays the gear and lets the keyword trigger prompt for the dropped unit", () => {
    const { room, ids, ctx } = strictGestureRoom();
    const board = room.players[0]!.board!;
    const blade = board.base.find((card) => card.id === ids.blade)!;
    board.base = board.base.filter((card) => card.id !== blade.id);
    blade.text =
      "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip] [1]";
    blade.keywords = [...(blade.keywords ?? []), "Quick-Draw"];
    blade.energyCost = 0;
    blade.powerCost = 0;
    board.hand.push(blade);

    const played = apply(
      room,
      "p1",
      { type: "equip_card", equipmentCardId: ids.blade, unitCardId: ids.keeperBase, asAttachment: true },
      ctx,
    );
    expect(played.rules?.prompt?.kind).toBe("choose-target");
    expect(played.rules?.prompt?.playerId).toBe("p1");
    expect(played.rules?.prompt?.options?.some((option) => option.id === ids.keeperBase)).toBe(true);

    let next = apply(
      played,
      "p1",
      { type: "toggle_exhausted", zone: "base", cardId: ids.keeperBase, expectedExhausted: false },
      ctx,
    );
    // The keyword trigger is on the chain; resolve it (priority passes) before it attaches.
    for (let step = 0; step < 8 && next.rules?.chain.length; step += 1) {
      const actor = next.rules?.priority;
      if (!actor) break;
      next = apply(next, actor, { type: "rules_pass" }, ctx);
    }
    expect(next.rules?.chain).toEqual([]);
    expect(next.players[0]?.board?.base.find((card) => card.id === ids.blade)?.attachedToCardId).toBe(
      ids.keeperBase,
    );
  });
});

describe("chain/priority controls in strict rooms [R338.1.b][R347.2]", () => {
  function opponentChainItem() {
    const fixture = strictGestureRoom();
    let room = apply(fixture.room, "p1", { type: "end_turn" }, fixture.ctx);
    const board = room.players[1]!.board!;
    const blade = takeFromDeck(board, "Blade of the Exile", "base");
    const hunter = takeFromDeck(board, "Treasure Hunter", "base");
    room = apply(
      room,
      "p2",
      { type: "rules_activate", objectId: blade.id, ability: "equip:0", choices: { "target:0": [hunter.id] } },
      fixture.ctx,
    );
    expect(room.rules?.chain.length).toBeGreaterThan(0);
    expect(room.rules?.priority).toBe("p1");
    return { room, ctx: fixture.ctx, blade, hunter };
  }

  const controls = [
    {
      label: "Approve (chain_set_resolve_vote)",
      action: { type: "chain_set_resolve_vote", entryId: "chain-x", approved: true },
    },
    { label: "Resolve (chain_resolve)", action: { type: "chain_resolve", entryId: "chain-x", to: "trash" } },
    { label: "pass showdown focus", action: { type: "battlefield_conquer_pass_focus", zone: "battlefieldA" } },
    { label: "pass showdown response", action: { type: "battlefield_conquer_pass_response", zone: "battlefieldA" } },
    { label: "advance step", action: { type: "end_beginning_phase", observed: {} } },
  ] as const;

  it.each(controls)("$label passes priority and the item then resolves", ({ action }) => {
    const { room, ctx, blade, hunter } = opponentChainItem();
    let resolved = apply(room, "p1", action as Action, ctx);
    expect(resolved.rules?.priority).toBe("p2");
    // The controller may already have passed when its item finalized (the live "0/1 passed"
    // status); otherwise the opponent's pass completes the round.
    if (resolved.rules?.chain.length) {
      resolved = apply(resolved, "p2", { type: "rules_pass" }, ctx);
    }
    expect(resolved.rules?.chain).toEqual([]);
    expect(resolved.players[1]?.board?.base.find((card) => card.id === blade.id)?.attachedToCardId).toBe(
      hunter.id,
    );
  });

  it.each(controls)("$label without priority is rejected with the rules verdict", ({ action }) => {
    const { room } = opponentChainItem();
    expectRejected(room, "p2", action as Action, "not_your_priority", "338.1.b");
  });

  it("sandbox Approve still records the sandbox chain vote", () => {
    const ctx = makeContext();
    let room = sandboxInGame(ctx);
    room = apply(room, "p1", { type: "draw_cards", count: 1 }, ctx);
    const card = room.players[0]!.board!.hand.at(-1)!;
    room = apply(room, "p1", { type: "chain_add", from: "hand", cardId: card.id, clientEntryId: "chain-sbx" }, ctx);
    const entryId = room.chainEntries[0]!.id;
    room = apply(room, "p2", { type: "chain_set_resolve_vote", entryId, approved: true }, ctx);
    expect(room.chainResolveVotes).toContain("p2");
  });
});

describe("Hidden cards: hide and play from facedown [R811]", () => {
  function hiddenFixture() {
    const fixture = strictGestureRoom();
    addSyntheticCard(fixture.room, "p1", EVELYNN_ENTRANCING, "hand");
    return fixture;
  }

  function hideCard(fixture: ReturnType<typeof hiddenFixture>, cardId: string) {
    return apply(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldA", cardId, asHidden: true },
      fixture.ctx,
    );
  }

  function advanceToNextOwnTurn(room: Room, fixture: ReturnType<typeof hiddenFixture>) {
    let next = apply(room, "p1", { type: "end_turn" }, fixture.ctx);
    next = apply(next, "p2", { type: "end_turn" }, fixture.ctx);
    return next;
  }

  it("a Hide drop equals rules_play hide: cost paid, facedown at the battlefield, no chain", () => {
    const fixture = hiddenFixture();
    const card = fixture.room.players[0]!.board!.hand.find(
      (entry) => entry.id === EVELYNN_ENTRANCING.id,
    )!;
    const runesBefore = fixture.room.players[0]!.board!.runeArea.length;
    const chainBefore = fixture.room.rules?.chain.length ?? 0;
    const next = expectSameState(
      fixture.room,
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: card.id, asHidden: true },
      { type: "rules_play", cardId: card.id, hide: true, location: "battlefieldA" },
    );
    const placed = next.players[0]?.board?.battlefieldA.find((entry) => entry.id === card.id);
    expect(placed?.hidden).toBe(true);
    expect(next.rules?.objects[card.id]?.hiddenTurn).toBe(next.rules?.turn.number);
    expect(next.rules?.objects[card.id]?.hiddenBy).toBe("p1");
    expect(next.players[0]?.board?.runeArea.length).toBe(runesBefore - 1);
    expect(next.rules?.chain.length).toBe(chainBefore);
    expect(next.rules?.priority).toBe("p1");
  });

  it("the opponent view of a hidden card is only a card back", () => {
    const fixture = hiddenFixture();
    const card = fixture.room.players[0]!.board!.hand.find(
      (entry) => entry.id === EVELYNN_ENTRANCING.id,
    )!;
    const hidden = hideCard(fixture, card.id);
    const opponent = redactRoomForViewer(hidden, { playerId: "p2", viewerRole: "player" });
    const zone = opponent.players[0]?.board?.battlefieldA ?? [];
    expect(zone.some((entry) => entry.isPlaceholder === true)).toBe(true);
    expect(zone.filter((entry) => entry.isPlaceholder === true).every((entry) => entry.name === "")).toBe(
      true,
    );
    expect(JSON.stringify(opponent)).not.toContain("Evelynn");
    expect(JSON.stringify(opponent)).not.toContain(card.id);
  });

  it("illegal Hide attempts are rejected with the rules and leave the room unchanged", () => {
    const fixture = hiddenFixture();
    const card = fixture.room.players[0]!.board!.hand.find(
      (entry) => entry.id === EVELYNN_ENTRANCING.id,
    )!;
    expectRejected(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: fixture.ids.keeperHand, asHidden: true },
      "illegal_action",
      "811.1",
    );
    expectRejected(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldB", cardId: card.id, asHidden: true },
      "invalid_location",
      "422.1",
    );

    const hidden = hideCard(fixture, card.id);
    addSyntheticCard(hidden, "p1", { ...EVELYNN_ENTRANCING, id: "synthetic-hidden-2" }, "hand");
    expectRejected(
      hidden,
      "p1",
      {
        type: "move_card",
        from: "hand",
        to: "battlefieldA",
        cardId: "synthetic-hidden-2",
        asHidden: true,
      },
      "invalid_location",
      "107.3.b",
    );
  });

  it("a facedown click next turn plays the card and fires the from-facedown trigger", () => {
    const fixture = hiddenFixture();
    const card = fixture.room.players[0]!.board!.hand.find(
      (entry) => entry.id === EVELYNN_ENTRANCING.id,
    )!;
    const hidden = hideCard(fixture, card.id);
    const room = advanceToNextOwnTurn(hidden, fixture);
    const next = expectSameState(
      room,
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: card.id, expectedExhausted: false },
      { type: "rules_play", cardId: card.id, location: "battlefieldA" },
    );
    const placed = next.players[0]?.board?.battlefieldA.find((entry) => entry.id === card.id);
    expect(placed?.hidden).not.toBe(true);
    expect(next.rules?.objects[card.id]?.hiddenTurn).toBeUndefined();
    // 811.6 / Evelynn: the from-facedown play trigger is on the chain with its play event.
    const trigger = next.rules?.chain.find((item) => item.sourceObjectId === card.id);
    expect(trigger?.abilityRef).toBe("triggered:0");
    expect(trigger?.triggerEvent?.data?.playedFromFacedown).toBe(true);
    // Resolve it: the "may" question opens, and answering yes moves the enemy unit here.
    let resolved = next;
    let may: string | null = null;
    for (let step = 0; step < 8; step += 1) {
      const prompt = resolved.rules?.prompt;
      if (prompt) {
        may ??= prompt.promptKey ?? null;
        resolved = apply(
          resolved,
          prompt.playerId,
          { type: "rules_choose", promptId: prompt.id, answer: { optionIds: ["yes"] } },
          fixture.ctx,
        );
        continue;
      }
      if (!resolved.rules?.chain.length) break;
      const actor = resolved.rules?.priority;
      if (!actor) break;
      resolved = apply(resolved, actor, { type: "rules_pass" }, fixture.ctx);
    }
    expect(may).toBe("rules.prompt.may");
    expect(
      resolved.players[1]?.board?.battlefieldA.some((entry) => entry.id === fixture.ids.enemyHunter),
    ).toBe(true);
    expect(resolved.players[1]?.board?.battlefieldB.some((entry) => entry.id === fixture.ids.enemyHunter)).toBe(
      false,
    );
  });

  it("playing it on the turn it was hidden is rejected with 420.1.a", () => {
    const fixture = hiddenFixture();
    const card = fixture.room.players[0]!.board!.hand.find(
      (entry) => entry.id === EVELYNN_ENTRANCING.id,
    )!;
    const hidden = hideCard(fixture, card.id);
    expectRejected(
      hidden,
      "p1",
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: card.id, expectedExhausted: false },
      "not_in_hand",
      "420.1.a",
    );
  });

  it("sandbox rooms keep the sandbox hide handler", () => {
    const ctx = makeContext();
    let room = sandboxInGame(ctx);
    const card = addSyntheticCard(room, "p1", EVELYNN_ENTRANCING, "hand");
    room = apply(
      room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: card.id, asHidden: true },
      ctx,
    );
    expect(room.rules).toBeUndefined();
    expect(room.players[0]?.board?.battlefieldA.find((entry) => entry.id === card.id)?.hidden).toBe(true);
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
