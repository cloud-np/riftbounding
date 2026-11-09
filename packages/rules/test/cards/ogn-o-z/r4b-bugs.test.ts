/**
 * OGN O–Z R4b engine regression — Solari Shrine's "When you kill …" (429.5).
 *
 * R4-engine lane E attributes a Passive Kill caused by lethal damage in the Cleanup to the
 * spell/ability that dealt the damage (429.5.c / 429.5.c.1); direct Kill instructions also work.
 */
import { describe, expect, it } from "vitest";
import { fund, place } from "../../rules/effects/helpers";
import { driveAll, setMight, withCards } from "./helpers";

describe("OGN O–Z engine reproductions", () => {
  it("[C:Solari Shrine][R429.5.c][R429.5.c.1] a damage kill is attributed to the spell's controller", () => {
    const s = withCards(["Solari Shrine", "Hextech Ray"], ["Caitlyn, Patrolling"]);
    const shrine = place(s, "p1", "Solari Shrine", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    setMight(s, enemy.id, 2, { stunned: true });
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": enemy.id } }).expectOk();
    driveAll(s, (prompt) => (prompt.kind === "yes-no" ? ["yes"] : [prompt.options![0]!.id]));
    expect(s.host.isExhausted(s.room, shrine.id)).toBe(true);
  });
});
