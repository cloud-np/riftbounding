/**
 * Lane E (R4-engine) — 420.2.a / 357.1: a pending non-standard cost must not hide an
 * unaffordable Energy/Power cost.
 *
 * Self-play finding 1 (`.orchestrator/reports/r4-selfplay-findings.md`): `planPayment` returned
 * the pending `choose-cost` choice before the resource plan ran, so a card whose kill/exhaust/
 * discard cost was still a choice was listed in `legalIntents` even when its Energy/Power cost
 * could not be paid; playing it cancelled after the cost prompt (`play_cancelled`,
 * `insufficient_resources`) and the same play stayed legal, looping.
 *
 * 420.2.a: "As long as a player has the resources to pay the costs associated with the card and
 * legal choices to make for their cards, they may Play cards." 357.1 pays the combined Energy/
 * Power cost; 357.2 pays the non-standard costs.
 */
import { describe, expect, it } from "vitest";
import { place } from "../../effects/helpers";
import { scenario } from "../../../scenarios/dsl";

describe("[R420.2.a][R357.1] pending non-standard costs and the resource check", () => {
  it("[C:Heedless Resurrection][R420.2.a][R357.1] an unaffordable play with a pending kill cost is not listed", () => {
    // "As an additional cost to play this, kill a friendly unit." Cost [2][Chaos].
    const s = scenario({
      firstPlayer: "p2",
      extraCards: { p2: ["Heedless Resurrection", "Caitlyn, Patrolling", "Whiteflame Protector"] },
      p2: { hand: ["Heedless Resurrection"], energy: 2 },
    });
    // Two friendly units make the kill a real choice (not a forced candidate).
    place(s, "p2", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Whiteflame Protector", "base");
    // No Rune may pay the [Chaos] Power (the Rune Pool holds only the 2 Energy given above).
    const board = s.room.players.find((player) => player.id === "p2")!.board!;
    board.runeArea.splice(0, board.runeArea.length);
    const spell = s.handCard("p2", "Heedless Resurrection")!;

    // 420.2.a: no legal play while the Power cannot be paid, even though the kill is still a choice.
    expect(s.expectLegal("p2").playableCardIds).not.toContain(spell.id);
    // The play verdict fails before the chain, not after a cost prompt (358.5 would cancel it).
    s.as("p2").play("Heedless Resurrection").expectError("insufficient_resources");
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(s.handCard("p2", "Heedless Resurrection")).toBeDefined();
  });

  it("[C:Heedless Resurrection][R420.2.a][R357.1] the play is listed once the Power is payable", () => {
    // Control: with a Chaos rune the pending kill choice still leaves a payable resource plan.
    const s = scenario({
      firstPlayer: "p2",
      extraCards: {
        p2: ["Heedless Resurrection", "Caitlyn, Patrolling", "Whiteflame Protector"],
      },
      p2: { hand: ["Heedless Resurrection"], runes: ["Chaos Rune"] },
    });
    place(s, "p2", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Whiteflame Protector", "base");
    s.room.rules!.pools.p2 = { energy: 2, power: {} };
    const spell = s.handCard("p2", "Heedless Resurrection")!;
    expect(s.expectLegal("p2").playableCardIds).toContain(spell.id);
    // The kill is a real choice: the play opens the cost prompt instead of finalizing.
    s.as("p2").play("Heedless Resurrection").expectOk();
    expect(s.room.rules!.prompt?.kind).toBe("choose-cost");
  });
});
