/**
 * Engine bugs found while scripting RAD cards (lane discipline: reproduced here, not fixed).
 */
import { describe, expect, it } from "vitest";
import { boardOf } from "../../rules/effects/helpers";
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
});
