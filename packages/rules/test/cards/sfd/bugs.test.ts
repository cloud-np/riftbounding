/**
 * Engine reproductions found while scripting Spiritforged (wave R3). Each case is skipped and
 * describes the rules-correct behaviour; the card scripts do not work around these.
 */
import { describe, expect, it } from "vitest";
import { effectiveMight } from "../../../src";
import { run } from "../../rules/effects/helpers";
import { addPool, boardCard, fund, put, settle, withCards } from "./helpers";

describe("SFD engine reproductions", () => {
  it.skip("[BUG] [C:Feral Strength][R820.1.d][R820.1.d.1] a paid Repeat cost executes the spell's effect a second time", () => {
    // The Repeat cost is charged (play/additional-costs.ts) and `cost:repeat` is recorded, but
    // resolution executes the instructions only once: +2 instead of +4.
    const s = withCards(["Feral Strength"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Feral Strength");
    addPool(s, "p1", 2);
    const card = s.handCard("p1", "Feral Strength")!;
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: card.id,
        optionalCosts: ["repeat"],
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    settle(s);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + 2 + 2);
  });

  it.skip("[BUG] [C:Doran's Blade][R818.1.c.2] the built-in Equip ability attaches the gear on resolution", () => {
    // `equip:<n>` is activatable and paid, but `executeCardScript` finds no script ability for
    // the ref, so the item resolves in the §6.4 manual window and nothing is attached.
    const s = withCards(["Doran's Blade"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    addPool(s, "p1", 0, { Body: 1 });
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: gear.id,
        ability: "equip:0",
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    settle(s);
    expect(s.room.rules!.manual).toBeFalsy();
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(unit.id);
  });

  it.skip("[BUG] [C:Combat Chef][R821.1.b] Weaponmaster: playing the unit offers to Equip one of your Equipment for [A] less", () => {
    // No Weaponmaster trigger is detected when the unit is played (triggers/keywords.ts has none).
    const s = withCards(["Combat Chef", "Long Sword"]);
    put(s, "p1", "Long Sword", "base");
    fund(s, "p1", "Combat Chef");
    s.as("p1").play("Combat Chef").expectOk();
    expect(
      s.room.rules!.chain.some((item) => item.kind === "triggered") || !!s.room.rules!.prompt,
    ).toBe(true);
  });

  it.skip("[BUG] [C:Counter Strike][R375][R359.3.f.3.a] a delayed replacement's matcher sees the creating ability's choices", () => {
    // `replace` stores `choices` with the replacement, but `replacements/interceptor.ts`
    // `matchesProposal` evaluates `matches` without them, so `subject: { targetRef: "target:0" }`
    // never matches (Counter Strike binds the object id instead, sfd:prevent-next-damage-to-it).
    const s = withCards(["Hextech Ray"]);
    const unit = put(s, "p2", "Astral Heron", "battlefieldA");
    run(
      s,
      {
        op: "replace",
        matches: { type: "damage", subject: { targetRef: "target:0" } },
        replace: { prevent: 9999 },
      },
      {
        choices: { "target:0": unit.id },
      },
    );
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[unit.id]?.damage ?? 0).toBe(0);
  });

  it.skip("[BUG] [C:Long Sword][R819.1.d] Quick-Draw: when you play it, attach it to a unit you control", () => {
    // The gear is played with Reaction timing (819.1.b), but no attach trigger follows.
    const s = withCards(["Long Sword"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Long Sword");
    s.as("p1").play("Long Sword").expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Long Sword")!.attachedToCardId).toBe(unit.id);
  });
});
