/**
 * R4-gestures: pure `translateGesture` unit tests.
 *
 * One case per mapping row: the gesture becomes the strict intent it means, an illegal gesture
 * carries the precise rules reason, cosmetic actions and the §6.4 manual window pass through.
 * Nothing here mutates the room (translateGesture is read-only).
 */
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";
import { legalIntents } from "@rift/rules";

import { createEngineRulesHost } from "../src/strict/host";
import { translateGesture } from "../src/strict/gestures";
import { deepCopy, strictGestureRoom, type StrictGestureFixture } from "./strict-gestures-fixture";

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
        targets: [fixture.ids.keeperBase],
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

function makeContextFor(room: Room) {
  return {
    now: room.updatedAt ?? 1_760_000_000_000,
    rng: () => 0.5,
    mode: room.roomMode ?? ("multiplayer" as const),
  };
}
