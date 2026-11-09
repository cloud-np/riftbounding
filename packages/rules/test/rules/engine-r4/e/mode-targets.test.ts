/**
 * Lane E (R4-engine) — 355.8 / 420.2.a: a mode prompt must not offer a mode whose mandatory
 * choices cannot be made.
 *
 * Self-play finding 3 (`.orchestrator/reports/r4-selfplay-findings.md`): `requiredChoices`
 * pushed every `choose_mode` option whose `requires` condition held without probing the mode's
 * targets. The bot answered such a mode, the engine opened the play, and then `bindChoices`
 * failed with `no_legal_targets` (355.8), cancelling the play; the card stayed in hand and the
 * same play stayed legal.
 *
 * 355.8: "In order to put a spell or ability on the chain, valid choices must be made for all
 * targets." 355.3: the mode is a play-time choice, so its targets must exist when it is offered.
 */
import { describe, expect, it } from "vitest";
import { getCardScript, requiredChoices, validateChoices } from "../../../../src";
import { place } from "../../effects/helpers";
import { scenario } from "../../../scenarios/dsl";

function sanctionAbility() {
  const ability = getCardScript("Sanction")?.abilities[0];
  if (!ability) throw new Error("Sanction script missing");
  return ability;
}

describe("[R355.8][R355.3] mode options are filtered to modes with legal mandatory targets", () => {
  it("[C:Sanction][R355.8] only the mode whose target exists is offered", () => {
    // Mode 1: "Empower a unit." Mode 2: "Disempower a unit that's [Empowered]."
    // One plain unit exists → only the empower mode has a legal choice.
    const s = scenario({ extraCards: { p2: ["Caitlyn, Patrolling"] } });
    place(s, "p2", "Caitlyn, Patrolling", "base");
    const specs = requiredChoices(s.room, s.host, sanctionAbility(), {
      controller: "p1",
      sourceObjectId: "sanction-item",
      choices: {},
    });
    expect(specs).toHaveLength(1);
    expect(specs[0]!.key).toBe("mode");
    expect(specs[0]!.options.map((option) => option.id)).toEqual(["empower"]);
  });

  it("[C:Sanction][R355.8] with no unit at all there is no legal mode (no_legal_targets)", () => {
    const s = scenario();
    const specs = requiredChoices(s.room, s.host, sanctionAbility(), {
      controller: "p1",
      sourceObjectId: "sanction-item",
      choices: {},
    });
    expect(specs[0]!.options).toEqual([]);
    const verdict = validateChoices(s.room, s.host, sanctionAbility(), {
      controller: "p1",
      sourceObjectId: "sanction-item",
      choices: {},
    });
    expect(verdict).toMatchObject({ ok: false, code: "no_legal_targets", rule: "355.8" });
  });
});
