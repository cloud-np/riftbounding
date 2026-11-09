/**
 * Unleashed R4b — engine bugs found while upgrading cards unlocked by R4-engine lanes A–D.
 * The play-from-facedown persistence (lane A) works; the provenance of the play is still lost
 * before triggers are detected (811.6), so the card cannot be scripted.
 */
import { describe, expect, it } from "vitest";
import { fund, place, zoneOf } from "../../rules/effects/helpers";
import { resolveChain, settle, withCards } from "./helpers";

describe("Unleashed R4b — engine bugs", () => {
  it.skip("[BUG][C:Evelynn, Entrancing][R811.6] a unit played from facedown can trigger 'when you play me from facedown'", () => {
    const s = withCards(["Evelynn, Entrancing"], [], { firstPlayer: "p1" });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    const evelynn = s.handCard("p1", "Evelynn, Entrancing")!;
    fund(s, "p1", "Evelynn, Entrancing");
    s.as("p1")
      .apply({ type: "rules_play", cardId: evelynn.id, hide: true, location: "battlefieldA" })
      .expectOk();
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s);
    fund(s, "p1", "Evelynn, Entrancing");
    s.as("p1").apply({ type: "rules_play", cardId: evelynn.id }).expectOk();
    resolveChain(s);
    // 811.6 + the card text: the triggered "you may" move is never detected.
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
  });
});
