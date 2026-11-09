/**
 * Engine bugs found while scripting RAD cards (lane discipline: reproduced here, not fixed).
 */
import { describe, expect, it } from "vitest";
import { boardOf, fund } from "../../rules/effects/helpers";
import { put, resolveAll, withCards } from "./helpers";

describe("RAD lane — engine bug reproductions", () => {
  /**
   * 811.1.b: a card hidden on an earlier turn may be played from face down ignoring its base cost.
   * `play/hidden.ts` records `hiddenTurn`/`hiddenBy` on the card's rules object, but the 317.2.c
   * expiration step (`cleanup/cleanup.ts`, "expire-this-turn") deletes every rules object without
   * buffs/baseMight/counters/grants/controller — so at the end of the turn the record is gone and
   * `facedownPermission` refuses the play (`not_in_hand`). The same keep-list also drops
   * `keywordGrants`, `mightMods`, `prevent`, `empowered` and `paidAdditionalCost`.
   */
  it.skip("[BUG][C:The Waters' Wage][R811.1.b][R317.2.c] a card hidden last turn can be played from face down", () => {
    const s = withCards(["The Waters' Wage"]);
    put(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    const wage = s.handCard("p1", "The Waters' Wage")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: wage.id, hide: true, location: "battlefieldA" } as never)
      .expectOk();
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    expect(s.room.rules!.objects[wage.id]?.hiddenTurn).toBe(1);
    s.as("p1").apply({ type: "rules_play", cardId: wage.id }).expectOk();
    resolveAll(s);
    expect(boardOf(s, "p1").base.filter((card) => card.name === "Gold")).toHaveLength(3);
  });

  /**
   * 830.1.b: Deploy is short for, among others, "When an opponent holds here, kill this." The task
   * lists Deploy as implemented, but `triggers/keywords.ts` has no Deploy trigger (only Vision,
   * Temporary, Hunt, Disarm), so a Deploy gear survives an opponent's hold.
   */
  it.skip("[BUG][C:Banner of Conquest][R830.1.b] a Deploy gear is killed when an opponent holds its battlefield", () => {
    const s = withCards(["Banner of Conquest"]);
    const banner = put(s, "p1", "Banner of Conquest", "battlefieldB");
    put(s, "p2", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p2" };
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    expect(s.host.findCard(s.room, banner.id)?.zone).toBe("trash");
  });

  /**
   * 818.1.c.2: "[Equip] [Cost]" means "[Cost]: Attach this gear to a unit you control." The play
   * layer lists the built-in `equip:<n>` ability, but `executeCardScript` finds no script ability for
   * that ref, so the activation resolves in the §6.4 manual window instead of attaching.
   */
  it.skip("[BUG][C:Nazuman Ntofo][R818.1.c.2] the built-in Equip ability attaches the gear", () => {
    const s = withCards(["Nazuman Ntofo"]);
    const gear = put(s, "p1", "Nazuman Ntofo", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: gear.id,
        ability: "equip:0",
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    resolveAll(s);
    expect(s.room.rules!.manual).toBeNull();
    expect(s.host.findCard(s.room, gear.id)?.card.attachedToCardId).toBe(unit.id);
  });

  /**
   * 356.4.f.1 / 383.2.a.1: "if you paid the additional cost" means the optional additional cost.
   * `triggers/finalize.ts` (`notePaidAdditionalCost`) treats any non-empty `paid.additional` as
   * paid, but `play/payment.ts` (`paidCostRecord`) also records `exhaustedRunes`/`recycledRunes`/
   * `power` there — so paying a card with runes makes every "if you paid the additional cost"
   * effect apply (Clockwork Keeper, Shimmering Swimmer).
   */
  it.skip("[BUG][C:Shimmering Swimmer][C:Clockwork Keeper][R356.4.f.1] paying with runes is not paying the optional additional cost", () => {
    const s = withCards(["Clockwork Keeper"]);
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = false;
    s.as("p1").play("Clockwork Keeper").expectOk();
    expect(boardOf(s, "p1").runeArea.every((rune) => rune.exhausted)).toBe(true);
    // No optional cost was chosen: the "if you paid the additional cost" trigger must not fire.
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  /**
   * `effects/choices.ts` builds the choice-scan environment without the trigger event or the
   * leaving source's last-known location, so a chosen target "here" (or by "event-zone") of a
   * Deathknell resolves to no zone and the trigger is dropped (Mournful Spirit uses a `choose`).
   */
  it.skip("[BUG][C:Mournful Spirit][R355.7][R383.2.c.3] a Deathknell can choose a Target 'here' when put on the chain", () => {
    const s = withCards(["Lost to the Sands"], ["Mournful Spirit"]);
    const spirit = put(s, "p2", "Mournful Spirit", "battlefieldA");
    put(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "deal", "target:0": spirit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    // Expected: a choose-target prompt for p2 (kill target uses `{ chosen: true, zone: HERE }`).
    expect(s.room.rules!.prompt?.kind).toBe("choose-target");
  });

  /**
   * The die event/last-known information has no stunned status (424), so "When a stunned enemy
   * unit here dies" (Storm Raptor) can't be scripted.
   */
  it.skip("[BUG][C:Storm Raptor][R424][R383.2.c.3] the die event keeps the dead unit's stunned status", () => {
    const s = withCards(["Lost to the Sands"], ["Storm Raptor"]);
    const victim = put(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[victim.id] = { ...s.room.rules!.objects[victim.id], stunned: true };
    expect(s.room.rules!.objects[victim.id]?.stunned).toBe(true);
    throw new Error("no event/LKI field carries 'stunned' after the kill (objects[id] is deleted)");
  });
});
