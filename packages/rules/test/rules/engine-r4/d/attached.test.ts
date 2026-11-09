/**
 * Lane D — attached cards (718–719). The synthetic script below is registered only by this
 * suite; it models an Equipment whose Effect Text has a triggered ability plus passives for the
 * top-most card and for other units at the same location.
 *
 * 718.2: while attached, the card's printed Rules Text is Inactive.
 * 718.3 / 719.1: Abilities in its Effect Text are appended to the Top-Most card's Rules Text.
 * 718.4: its Might Bonus modulates the Top-Most card's Might.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { effectiveKeywords, effectiveMight } from "../../../../src";
import { boardOf, run } from "../../effects/helpers";
import { put, settle, withDeck } from "./helpers";
import { registerTestCardScript } from "../../../../src/testing";

const ATTACHED_EFFECT_TEXT: CardScript = {
  name: "Guardian Angel",
  text: "[Equip][Calm]\nWhen I move, draw 1.\nFriendly units here have [Ganking].\n+1 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "move", subject: { targetRef: "self" } } },
      effect: { op: "draw", amount: 1 },
    },
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Ganking",
        target: { cardType: "unit", controller: "self", zone: { kind: "chosen", ref: "here" } },
      },
    },
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { targetRef: "host" } } },
  ],
};

/** A passive that models printed Rules Text (Inactive while attached, 718.2). */
const RULES_TEXT_PASSIVE: CardScript = {
  name: "Doran's Blade",
  text: "[Equip][Body]\nFriendly units have +2 [Might].\n+1 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "rules-text",
        params: { modifier: { kind: "might", amount: 2, target: { cardType: "unit", controller: "self" } } },
      },
    },
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { targetRef: "host" } } },
  ],
};

beforeAll(() => {
  registerTestCardScript(ATTACHED_EFFECT_TEXT);
  registerTestCardScript(RULES_TEXT_PASSIVE);
});

describe("attached cards [R718][R719]", () => {
  it("[C:Guardian Angel][R718.3][R718.4] an attached card's Effect Text applies to the Top-Most card and other units here", () => {
    const s = withDeck(["Guardian Angel"]);
    const host = put(s, "p1", "Caitlyn, Patrolling", "base");
    const friend = put(s, "p1", "Treasure Hunter", "base");
    const gear = put(s, "p1", "Guardian Angel", "base");
    // Unattached: host-targeted Effect Text is inactive (724). (A location-scoped passive of an
    // unattached card is still collected by the engine's script model; see the lane report.)
    expect(effectiveMight(s.room, host.id, s.host)).toBe(3);
    run(s, { op: "attach", gear: { targetRef: `obj:${gear.id}` }, to: { targetRef: `obj:${host.id}` } });
    // 718.4: +1 Might Bonus; 718.3: the location-scoped keyword passive applies to friendly units here.
    expect(effectiveMight(s.room, host.id, s.host)).toBe(4);
    expect(effectiveKeywords(s.room, host.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, friend.id, s.host)).toContain("Ganking");
  });

  it("[C:Guardian Angel][R718.3][R719.1] a triggered ability in attached Effect Text fires with the host as its source", () => {
    const s = withDeck(["Guardian Angel"]);
    const host = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = put(s, "p1", "Guardian Angel", "base");
    run(s, { op: "attach", gear: { targetRef: `obj:${gear.id}` }, to: { targetRef: `obj:${host.id}` } });
    const before = boardOf(s, "p1").hand.length;
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    const item = s.room.rules!.chain.find((entry) => entry.cardName === "Guardian Angel");
    expect(item).toMatchObject({
      kind: "triggered",
      sourceObjectId: host.id,
      sourceName: "Guardian Angel",
      abilityRef: "triggered:0",
    });
    expect(item!.triggerEvent).toMatchObject({ type: "move", cardId: host.id, zone: "battlefieldA" });
    settle(s);
    // The attached card's own script resolves (718.3): draw 1.
    expect(boardOf(s, "p1").hand.length).toBe(before + 1);
  });

  it("[C:Doran's Blade][R718.2] a passive marked as printed Rules Text is Inactive while attached", () => {
    const s = withDeck(["Doran's Blade"]);
    const host = put(s, "p1", "Caitlyn, Patrolling", "base");
    const friend = put(s, "p1", "Treasure Hunter", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    // Unattached: the rules-text passive is active (+2 to every friendly unit).
    expect(effectiveMight(s.room, host.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(3);
    run(s, { op: "attach", gear: { targetRef: `obj:${gear.id}` }, to: { targetRef: `obj:${host.id}` } });
    // 718.2: the attached card's printed Rules Text is Inactive; its Effect Text (+1 Might Bonus,
    // 718.4) still modulates the Top-Most card.
    expect(effectiveMight(s.room, host.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(1);
    run(s, { op: "detach", target: { targetRef: `obj:${gear.id}` } });
    expect(effectiveMight(s.room, host.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(3);
  });
});
