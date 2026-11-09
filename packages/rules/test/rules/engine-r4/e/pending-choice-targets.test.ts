/**
 * Lane E (R4-engine) — 355.8 / 420.2.a: an earlier pending play-time choice must not hide a
 * later mandatory target with no legal option.
 *
 * Found by the 400-game catalog self-play sweep (seeds 99, 137, 377): Battle Preparations
 * ("[Show Off] a gear. Give a unit +2 Might this turn.") was listed with no unit on the board
 * because `bindChoices` returned the optional `showOff` prompt before validating the later
 * `target:0` spec. Answering the prompt cancelled the play (`no_legal_targets`), the card stayed
 * in hand and the same play stayed legal.
 */
import { describe, expect, it } from "vitest";
import { place } from "../../effects/helpers";
import { scenario } from "../../../scenarios/dsl";

describe("[R355.8] a pending optional choice does not hide an impossible target", () => {
  it("[C:Battle Preparations][R355.8] not playable with a gear to show off but no unit to buff", () => {
    const s = scenario({
      extraCards: { p1: ["Battle Preparations", "Doran's Blade"] },
      p1: { hand: ["Battle Preparations", "Doran's Blade"] },
    });
    s.room.rules!.pools.p1 = { energy: 2, power: { Calm: 1 } };
    const spell = s.handCard("p1", "Battle Preparations")!;
    // The showOff gear exists, but "give a unit +2 Might" has no legal unit.
    expect(s.expectLegal("p1").playableCardIds).not.toContain(spell.id);
    s.as("p1").play("Battle Preparations").expectError("no_legal_targets");
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Battle Preparations][R355.8] the showOff prompt opens once a unit exists", () => {
    const s = scenario({
      extraCards: { p1: ["Battle Preparations", "Doran's Blade", "Caitlyn, Patrolling"] },
      p1: { hand: ["Battle Preparations", "Doran's Blade"] },
    });
    s.room.rules!.pools.p1 = { energy: 2, power: { Calm: 1 } };
    place(s, "p1", "Caitlyn, Patrolling", "base");
    const spell = s.handCard("p1", "Battle Preparations")!;
    expect(s.expectLegal("p1").playableCardIds).toContain(spell.id);
    s.as("p1").play("Battle Preparations").expectOk();
    s.expectPrompt("choose-card", "p1");
    expect((s.room.rules!.prompt!.data as { spec?: { showOff?: boolean } }).spec?.showOff).toBe(true);
    expect(s.room.rules!.chain[0]?.cardName).toBe("Battle Preparations");
  });
});
