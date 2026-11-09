/**
 * R4-gestures: pure `translateGesture` unit tests.
 *
 * One case per mapping row: the gesture becomes the strict intent it means, an illegal gesture
 * carries the precise rules reason, cosmetic actions and the §6.4 manual window pass through.
 * Nothing here mutates the room (translateGesture is read-only).
 */
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";
import { getCardScript, legalIntents, registerCardScript } from "@rift/rules";

import { createEngineRulesHost } from "../src/strict/host";
import { translateGesture } from "../src/strict/gestures";
import {
  apply,
  deepCopy,
  strictGestureRoom,
  takeFromDeck,
  type StrictGestureFixture,
} from "./strict-gestures-fixture";

function setup(): { fixture: StrictGestureFixture; host: ReturnType<typeof createEngineRulesHost> } {
  const fixture = strictGestureRoom();
  return { fixture, host: createEngineRulesHost(fixture.ctx) };
}

describe("translateGesture: play gestures [R355.2][R420.1.a]", () => {
  it("hand → Base becomes rules_play with the Base location", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "base", cardId: fixture.ids.keeperHand },
      host,
    );
    expect(result).toEqual({
      kind: "intent",
      intent: { type: "rules_play", cardId: fixture.ids.keeperHand, location: "base" },
    });
  });

  it("hand → battlefield becomes rules_play with that battlefield as the location", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: fixture.ids.keeperHand },
      host,
    );
    expect(result).toEqual({
      kind: "intent",
      intent: { type: "rules_play", cardId: fixture.ids.keeperHand, location: "battlefieldA" },
    });
  });

  it("a spell dragged to play (chain_add) becomes rules_play with no location", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "chain_add", from: "hand", cardId: fixture.ids.meditation, clientEntryId: "chain-x" },
      host,
    );
    expect(result).toEqual({ kind: "intent", intent: { type: "rules_play", cardId: fixture.ids.meditation } });
  });

  it("a Hide drop (move_card asHidden) is explained as a Hide play of that card", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "battlefieldA", cardId: fixture.ids.keeperHand, asHidden: true },
      host,
    );
    // The mapped intent is rules_play { hide: true } (this fixture card has no Hidden keyword, so
    // the rules layer rejects it — the gesture is still explained as the Hide it meant).
    expect(result).toMatchObject({ kind: "reject" });
    if (result.kind !== "reject") return;
    expect(result.code).not.toBe("strict_mode_action");
    expect(result.rule).toBeTruthy();
  });

  it("playing a card that is not in hand is rejected with the rules verdict", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "base", cardId: fixture.ids.caitlyn },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "not_in_hand", rule: "420.1.a" });
  });
});

describe("translateGesture: Standard Move gestures [R144][R449–455]", () => {
  it("Base → Battlefield becomes rules_move", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "base", to: "battlefieldA", cardId: fixture.ids.keeperBase },
        host,
      ),
    ).toEqual({ kind: "intent", intent: { type: "rules_move", unitIds: [fixture.ids.keeperBase], to: "battlefieldA" } });
  });

  it("several units move together when the gesture carries cardIds", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        {
          type: "move_card",
          from: "battlefieldA",
          to: "base",
          cardId: fixture.ids.caitlyn,
          cardIds: [fixture.ids.caitlyn, fixture.ids.hunter],
        },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: { type: "rules_move", unitIds: [fixture.ids.caitlyn, fixture.ids.hunter], to: "base" },
    });
  });

  it("a multi-card off-board batch shape maps to one Standard Move", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_off_board_cards_batch", from: "battlefieldA", to: "base", cardIds: [fixture.ids.caitlyn, fixture.ids.hunter] },
      host,
    );
    expect(result).toEqual({
      kind: "intent",
      intent: { type: "rules_move", unitIds: [fixture.ids.caitlyn, fixture.ids.hunter], to: "base" },
    });
  });

  it("Battlefield → Battlefield without Ganking is rejected with 144.4.c and the unit", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "battlefieldA", to: "battlefieldB", cardId: fixture.ids.hunter },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "invalid_location", rule: "144.4.c" });
    if (result.kind === "reject") expect(result.detail).toContain(fixture.ids.hunter);
  });

  it("same-zone reordering is not a strict game action", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "hand", to: "hand", cardId: fixture.ids.keeperHand, toIndex: 0 },
        host,
      ),
    ).toMatchObject({ kind: "reject", code: "strict_mode_action" });
  });

  it("arbitrary zone movement (hand → trash) is rejected", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "hand", to: "trash", cardId: fixture.ids.keeperHand },
        host,
      ),
    ).toMatchObject({ kind: "reject", code: "strict_mode_action" });
  });
});

describe("translateGesture: use/tap/activate gestures [R376–381][R403.3]", () => {
  it("tapping an object with exactly one legal ability activates it", () => {
    const { fixture, host } = setup();
    const ability = legalIntents(fixture.room, "p1", host).activatable.find(
      (entry) => entry.objectId === fixture.ids.caitlyn,
    )?.ability;
    expect(ability).toBeTruthy();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "toggle_exhausted", zone: "battlefieldA", cardId: fixture.ids.caitlyn, expectedExhausted: false },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: { type: "rules_activate", objectId: fixture.ids.caitlyn, ability },
    });
  });

  it("tapping a Rune with two legal abilities is ambiguous and lists both refs", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "toggle_exhausted", zone: "runeArea", cardId: fixture.ids.rune, expectedExhausted: false },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "ambiguous_gesture", rule: "403.3" });
    if (result.kind === "reject") {
      expect(result.detail).toContain("rune:exhaust");
      expect(result.detail).toContain("rune:recycle");
    }
  });

  it("an explicit ability resolves the ambiguity (client picker escape hatch)", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "toggle_exhausted", zone: "runeArea", cardId: fixture.ids.rune, expectedExhausted: false, ability: "rune:exhaust" },
        host,
      ),
    ).toEqual({ kind: "intent", intent: { type: "rules_activate", objectId: fixture.ids.rune, ability: "rune:exhaust" } });
  });

  it("tapping an object with no activated ability is rejected with 403.3", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "toggle_exhausted", zone: "battlefieldA", cardId: fixture.ids.hunter, expectedExhausted: false },
        host,
      ),
    ).toMatchObject({ kind: "reject", code: "illegal_action", rule: "403.3" });
  });

  it("readying a card (expectedExhausted true) is not a discretionary action", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "toggle_exhausted", zone: "base", cardId: fixture.ids.keeperBase, expectedExhausted: true },
        host,
      ),
    ).toMatchObject({ kind: "reject", code: "strict_mode_action" });
  });

  it("equipping Gear on a unit becomes rules_activate equip:<n> with the unit as target", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "equip_card", equipmentCardId: fixture.ids.blade, unitCardId: fixture.ids.keeperBase },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: {
        type: "rules_activate",
        objectId: fixture.ids.blade,
        ability: "equip:0",
        choices: { "target:0": [fixture.ids.keeperBase] },
      },
    });
  });

  it("a Quick-Draw hand attachment drop has no strict intent (819.1.d)", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "equip_card", equipmentCardId: fixture.ids.blade, unitCardId: fixture.ids.keeperBase, asAttachment: true },
        host,
      ),
    ).toMatchObject({ kind: "reject", code: "strict_mode_action", rule: "819.1.d" });
  });
});

describe("translateGesture: end turn, cosmetic and free-form actions [§4]", () => {
  it("end_turn becomes rules_end_turn", () => {
    const { fixture, host } = setup();
    expect(translateGesture(fixture.room, "p1", { type: "end_turn" }, host)).toEqual({
      kind: "intent",
      intent: { type: "rules_end_turn" },
    });
  });

  it("cosmetic actions pass through to the existing gate", () => {
    const { fixture, host } = setup();
    for (const action of [
      { type: "roll_die", sides: 20 },
      { type: "target_arrow_clear_all" },
      { type: "set_card_label", zone: "base", cardId: fixture.ids.keeperBase, slot: 0, label: "x" },
    ]) {
      expect(translateGesture(fixture.room, "p1", action, host)).toEqual({ kind: "passthrough" });
    }
  });

  it("free-form manipulation is rejected with a reason", () => {
    const { fixture, host } = setup();
    for (const action of [
      { type: "draw_cards", count: 1 },
      { type: "adjust_card_might", zone: "base", cardId: fixture.ids.keeperBase, delta: 1 },
      { type: "adjust_card_counter", zone: "base", cardId: fixture.ids.keeperBase, counter: "white", delta: 1 },
      { type: "shuffle_deck" },
      { type: "adjust_score", playerId: "p1", delta: 1 },
      { type: "chain_resolve", entryId: "x", to: "trash" },
      { type: "create_token", zone: "base", name: "Gold" },
    ]) {
      expect(translateGesture(fixture.room, "p1", action, host)).toMatchObject({
        kind: "reject",
        code: "strict_mode_action",
      });
    }
  });

  it("a pending prompt is answered before any gesture (411.2)", () => {
    const { fixture, host } = setup();
    const room = deepCopy(fixture.room) as Room;
    room.rules!.prompt = { id: "prompt-1", kind: "yes-no", playerId: "p1" };
    expect(
      translateGesture(room, "p1", { type: "move_card", from: "hand", to: "base", cardId: fixture.ids.keeperHand }, host),
    ).toMatchObject({ kind: "reject", code: "prompt_pending", rule: "411.2" });
  });

  it("sandbox rooms pass through untouched", () => {
    const { fixture, host } = setup();
    const sandbox = deepCopy(fixture.room) as Room;
    delete sandbox.rulesMode;
    delete sandbox.rules;
    expect(
      translateGesture(sandbox, "p1", { type: "move_card", from: "hand", to: "base", cardId: fixture.ids.keeperHand }, host),
    ).toEqual({ kind: "passthrough" });
    expect(translateGesture(sandbox, "p1", { type: "draw_cards", count: 1 }, host)).toEqual({ kind: "passthrough" });
  });
});

describe("translateGesture: §6.4 manual window [contract:§6.4]", () => {
  function manualRoom(): Room {
    const { fixture } = setup();
    const room = deepCopy(fixture.room) as Room;
    room.rules!.manual = { itemId: "manual-1", player: "p1", cardName: "Rebuke" };
    return room;
  }

  it("keeps the manual player's free board actions (passthrough)", () => {
    const room = manualRoom();
    const host = createEngineRulesHost(makeContextFor(room));
    for (const action of [
      { type: "draw_cards", count: 1 },
      { type: "move_card", from: "hand", to: "base", cardId: "any-card" },
      { type: "toggle_exhausted", zone: "base", cardId: "any-card", expectedExhausted: false },
    ]) {
      expect(translateGesture(room, "p1", action, host)).toEqual({ kind: "passthrough" });
    }
  });

  it("does not extend the exception to another player", () => {
    const room = manualRoom();
    const host = createEngineRulesHost(makeContextFor(room));
    expect(translateGesture(room, "p2", { type: "draw_cards", count: 1 }, host)).toMatchObject({
      kind: "reject",
      code: "strict_mode_action",
    });
  });
});

describe("translateGesture: targeting gestures [R355.7][R355.9][R355.4]", () => {
  it("a spell dropped on a legal target binds the first target spec", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "hand", to: "base", cardId: fixture.ids.rebuke, targetCardId: fixture.ids.hunter },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: {
        type: "rules_play",
        cardId: fixture.ids.rebuke,
        choices: { "target:0": [fixture.ids.hunter] },
      },
    });
  });

  it("a spell dragged to play (chain_add) carries the dropped target", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "chain_add", from: "hand", cardId: fixture.ids.rebuke, targetCardId: fixture.ids.enemyHunter },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: {
        type: "rules_play",
        cardId: fixture.ids.rebuke,
        choices: { "target:0": [fixture.ids.enemyHunter] },
      },
    });
  });

  it("a permanent dropped on a card at a battlefield plays to that battlefield", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "hand", to: "battlefieldA", cardId: fixture.ids.keeperHand, targetCardId: fixture.ids.hunter },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: { type: "rules_play", cardId: fixture.ids.keeperHand, location: "battlefieldA" },
    });
  });

  it("a permanent dropped on a card at Base is not a target", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "hand", to: "base", cardId: fixture.ids.keeperHand, targetCardId: fixture.ids.keeperBase },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "illegal_target", rule: "355.9" });
  });

  it("a spell with no target spec dropped on a unit is rejected clearly", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "chain_add", from: "hand", cardId: fixture.ids.meditation, targetCardId: fixture.ids.hunter },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "illegal_target", rule: "355.9" });
    if (result.kind === "reject") expect(result.detail).toContain("does not target");
  });

  it("a spell dropped on a unit its target spec refuses uses the rules verdict", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "chain_add", from: "hand", cardId: fixture.ids.rebuke, targetCardId: fixture.ids.keeperBase },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "illegal_target", rule: "355.9" });
    if (result.kind === "reject") expect(result.detail).toContain("target:0");
  });

  it("a board object with a targeting ability activates with the target bound", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "battlefieldA", to: "battlefieldA", cardId: fixture.ids.caitlyn, targetCardId: fixture.ids.enemyHunter },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: {
        type: "rules_activate",
        objectId: fixture.ids.caitlyn,
        ability: "activated:1",
        choices: { "target:0": [fixture.ids.enemyHunter] },
      },
    });
  });

  it("tap + target click activates the ability with the target", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        {
          type: "toggle_exhausted",
          zone: "battlefieldA",
          cardId: fixture.ids.caitlyn,
          expectedExhausted: false,
          targetCardId: fixture.ids.enemyHunter,
        },
        host,
      ),
    ).toMatchObject({
      kind: "intent",
      intent: {
        type: "rules_activate",
        objectId: fixture.ids.caitlyn,
        ability: "activated:1",
        choices: { "target:0": [fixture.ids.enemyHunter] },
      },
    });
  });

  it("several abilities that target the same object are ambiguous", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "move_card", from: "base", to: "base", cardId: fixture.ids.blade, targetCardId: fixture.ids.keeperBase },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "ambiguous_gesture", rule: "403.3" });
    if (result.kind === "reject") {
      expect(result.detail).toContain("activated:0");
      expect(result.detail).toContain("equip:0");
    }
  });

  it("Equip on an illegal target uses the equip verdict", () => {
    const { fixture, host } = setup();
    const result = translateGesture(
      fixture.room,
      "p1",
      { type: "equip_card", equipmentCardId: fixture.ids.blade, unitCardId: fixture.ids.enemyHunter },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "illegal_target", rule: "355.9" });
  });

  it("a unit dropped on a target at a battlefield moves there when no ability targets it", () => {
    const { fixture, host } = setup();
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "move_card", from: "base", to: "battlefieldA", cardId: fixture.ids.keeperBase, targetCardId: fixture.ids.hunter },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: { type: "rules_move", unitIds: [fixture.ids.keeperBase], to: "battlefieldA" },
    });
  });

  it("a spell dropped on a battlefield binds a choose-battlefield spec by zone", () => {
    const original = getCardScript("Gust");
    registerCardScript({
      name: "Gust",
      text: "test battlefield-choice spell",
      status: "implemented",
      abilities: [
        {
          kind: "spell",
          effect: {
            op: "create",
            token: { name: "Gold" },
            zone: { kind: "chosen", ref: "zone" },
          },
        },
      ],
    });
    try {
      const { fixture, host } = setup();
      const gust = takeFromDeck(fixture.room.players[0]!.board!, "Gust", "hand");
      expect(
        translateGesture(
          fixture.room,
          "p1",
          { type: "move_card", from: "hand", to: "battlefieldA", cardId: gust.id },
          host,
        ),
      ).toEqual({
        kind: "intent",
        intent: { type: "rules_play", cardId: gust.id, choices: { zone: ["battlefieldA"] } },
      });
    } finally {
      if (original) registerCardScript(original);
    }
  });

  it("multiple target specs bind only the first spec that accepts the object", () => {
    const original = getCardScript("Defy");
    registerCardScript({
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
      const { fixture, host } = setup();
      const defy = takeFromDeck(fixture.room.players[0]!.board!, "Defy", "hand");
      defy.energyCost = 0;
      defy.powerCost = 0;
      const friendly = translateGesture(
        fixture.room,
        "p1",
        { type: "chain_add", from: "hand", cardId: defy.id, targetCardId: fixture.ids.hunter },
        host,
      );
      expect(friendly).toEqual({
        kind: "intent",
        intent: { type: "rules_play", cardId: defy.id, choices: { "target:0": [fixture.ids.hunter] } },
      });
      const enemy = translateGesture(
        fixture.room,
        "p1",
        { type: "chain_add", from: "hand", cardId: defy.id, targetCardId: fixture.ids.enemyHunter },
        host,
      );
      expect(enemy).toEqual({
        kind: "intent",
        intent: { type: "rules_play", cardId: defy.id, choices: { "target:1": [fixture.ids.enemyHunter] } },
      });
    } finally {
      if (original) registerCardScript(original);
    }
  });
});

describe("translateGesture: prompt clicks [R411.2]", () => {
  it("a click on a single-option prompt's option answers with rules_choose", () => {
    const { fixture, host } = setup();
    const prompted = apply(fixture.room, "p1", { type: "rules_play", cardId: fixture.ids.rebuke }, fixture.ctx);
    const prompt = prompted.rules?.prompt;
    expect(prompt?.kind).toBe("choose-target");
    expect(prompt?.playerId).toBe("p1");
    const result = translateGesture(
      prompted,
      "p1",
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: fixture.ids.hunter, expectedExhausted: false },
      host,
    );
    expect(result).toEqual({
      kind: "intent",
      intent: { type: "rules_choose", promptId: prompt!.id, answer: { optionIds: [fixture.ids.hunter] } },
    });
  });

  it("a click that is not one of the prompt's options is rejected and the prompt stays", () => {
    const { fixture, host } = setup();
    const prompted = apply(fixture.room, "p1", { type: "rules_play", cardId: fixture.ids.rebuke }, fixture.ctx);
    const promptId = prompted.rules?.prompt?.id;
    const before = deepCopy(prompted);
    const result = translateGesture(
      prompted,
      "p1",
      { type: "toggle_exhausted", zone: "base", cardId: fixture.ids.keeperBase, expectedExhausted: false },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "invalid_choice", rule: "411.2" });
    expect((prompted as Room).rules?.prompt?.id).toBe(promptId);
    expect(prompted).toEqual(before);
  });

  it("a multi-selection prompt is left to the client's accumulate-and-confirm flow", () => {
    const { fixture, host } = setup();
    const room = deepCopy(fixture.room) as Room;
    room.rules!.prompt = {
      id: "prompt-multi",
      kind: "choose-card",
      playerId: "p1",
      options: [{ id: fixture.ids.hunter }, { id: fixture.ids.caitlyn }],
      min: 2,
      max: 2,
    };
    const result = translateGesture(
      room,
      "p1",
      { type: "toggle_exhausted", zone: "battlefieldA", cardId: fixture.ids.hunter, expectedExhausted: false },
      host,
    );
    expect(result).toMatchObject({ kind: "reject", code: "invalid_choice", rule: "411.2" });
    if (result.kind === "reject") expect(result.detail).toContain("accumulate");
  });

  it("a non-object prompt still demands an answer first", () => {
    const { fixture, host } = setup();
    const room = deepCopy(fixture.room) as Room;
    room.rules!.prompt = {
      id: "prompt-yesno",
      kind: "yes-no",
      playerId: "p1",
      options: [{ id: "yes" }, { id: "no" }],
      min: 1,
      max: 1,
    };
    expect(
      translateGesture(
        room,
        "p1",
        { type: "toggle_exhausted", zone: "battlefieldA", cardId: fixture.ids.hunter, expectedExhausted: false },
        host,
      ),
    ).toMatchObject({ kind: "reject", code: "prompt_pending", rule: "411.2" });
  });
});

describe("translateGesture: Quick-Draw hand attachment [R819.1.d]", () => {
  it("plays a Quick-Draw gear dropped on a unit; the keyword trigger prompts for the target", () => {
    const { fixture, host } = setup();
    const board = fixture.room.players[0]!.board!;
    const blade = board.base.find((card) => card.id === fixture.ids.blade)!;
    board.base = board.base.filter((card) => card.id !== blade.id);
    blade.text =
      "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip] [1]";
    blade.keywords = [...(blade.keywords ?? []), "Quick-Draw"];
    blade.energyCost = 0;
    blade.powerCost = 0;
    board.hand.push(blade);
    expect(
      translateGesture(
        fixture.room,
        "p1",
        { type: "equip_card", equipmentCardId: blade.id, unitCardId: fixture.ids.keeperBase, asAttachment: true },
        host,
      ),
    ).toEqual({
      kind: "intent",
      intent: { type: "rules_play", cardId: blade.id, location: "base" },
    });
  });
});

function makeContextFor(room: Room) {
  return {
    now: room.updatedAt ?? 1_760_000_000_000,
    rng: () => 0.5,
    mode: room.roomMode ?? ("multiplayer" as const),
  };
}
