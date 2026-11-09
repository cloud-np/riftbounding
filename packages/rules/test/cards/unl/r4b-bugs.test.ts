/**
 * Unleashed R4b — engine bugs found while upgrading cards unlocked by R4-engine lanes A–D.
 * R4-engine-e records the play-from-facedown provenance on `unit_played`/`card_played` (811.6),
 * so Evelynn, Entrancing's "when you play me from facedown" trigger is detectable.
 */
import { describe, expect, it } from "vitest";
import { fund, place, zoneOf } from "../../rules/effects/helpers";
import { settle, withCards } from "./helpers";

describe("Unleashed R4b — engine bugs", () => {
  it("[C:Evelynn, Entrancing][R811.6] a unit played from facedown can trigger 'when you play me from facedown'", () => {
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
    // Pass Priority until the triggered ability resolves on the chain.
    for (let step = 0; step < 12 && !s.room.rules!.prompt; step += 1) {
      const holder = s.room.rules!.priority;
      if (!holder) break;
      s.as(holder).pass().expectOk();
    }
    // 355.12: "you may move …" is a real yes/no choice; accept it and let the trigger resolve.
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    // 811.6 + the card text: the facedown play is on `unit_played` and the move happens.
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
  });
});
