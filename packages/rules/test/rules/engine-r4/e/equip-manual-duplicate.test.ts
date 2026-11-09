/**
 * Lane E (R4-engine) — 818.1.c.2: a printed [Equip] line is one ability, not two.
 *
 * Self-play finding 2 (`.orchestrator/reports/r4-selfplay-findings.md`): an unscripted/manual
 * card's `[Equip]` line was exposed both as the built-in `equip:<n>` (real cost, attach effect,
 * 818.1.c.2) and as a free §6.4 `manual:<n>` entry parsed from the same printed text. When the
 * real Equip was unaffordable the free one stayed legal, opened the manual window and could be
 * activated forever without changing any state.
 *
 * 818.1.c.2: "Equip is functionally short for '[Cost]: Attach this gear to a unit you control.'"
 */
import { describe, expect, it } from "vitest";
import { activatedAbilitiesOf } from "../../../../src";
import { place } from "../../effects/helpers";
import { scenario } from "../../../scenarios/dsl";

describe("[R818.1.c.2] an unscripted Equip line is a single built-in ability", () => {
  it("[C:Svellsongur][R818.1.c.2] the manual card lists only equip:0, never a free manual:0", () => {
    const s = scenario({ firstPlayer: "p2", extraCards: { p2: ["Svellsongur", "Caitlyn, Patrolling"] } });
    const gear = place(s, "p2", "Svellsongur", "base");
    place(s, "p2", "Caitlyn, Patrolling", "base");
    const located = s.host.findCard(s.room, gear.id)!;
    const abilities = activatedAbilitiesOf(s.room, s.host, located);
    expect(abilities.map((entry) => entry.ref)).toEqual(["equip:0"]);
    expect(abilities[0]!.manual).toBe(false);
    expect(abilities[0]!.costs).toEqual([{ energy: 1, power: { Calm: 1 } }]);
  });

  it("[C:Svellsongur][R818.1.c.2] with no Calm Power the free manual duplicate is not listed", () => {
    const s = scenario({
      firstPlayer: "p2",
      extraCards: { p2: ["Svellsongur", "Caitlyn, Patrolling"] },
      p2: { energy: 5 },
    });
    const gear = place(s, "p2", "Svellsongur", "base");
    place(s, "p2", "Caitlyn, Patrolling", "base");
    const board = s.room.players.find((player) => player.id === "p2")!.board!;
    board.runeArea.splice(0, board.runeArea.length);
    // 818.1.c.2: the real Equip needs [1][Calm]; with no Calm source it is unaffordable and there
    // is no other (free, manual) entry for the same printed line.
    const activatable = s.expectLegal("p2").activatable.filter((entry) => entry.objectId === gear.id);
    expect(activatable).toEqual([]);
  });
});
