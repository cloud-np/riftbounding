/**
 * Lane B R4 proof test — the same optional-cost flag path on the Radiance duplicate of
 * Clockwork Keeper (card scripts are keyed by card name, so this also proves the fix is in the
 * engine, not in one script).
 */
import { describe, expect, it } from "vitest";
import { boardOf, fund } from "../../effects/helpers";
import { withCards } from "../../../cards/rad/helpers";

describe("paid optional additional cost [R356.4.f.1]", () => {
  it("[R356.4.f.1][C:Clockwork Keeper] rune payment does not trigger 'if you paid the additional cost'", () => {
    const s = withCards(["Clockwork Keeper"]);
    fund(s, "p1", "Clockwork Keeper");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = false;
    s.as("p1").play("Clockwork Keeper").expectOk();
    expect(boardOf(s, "p1").runeArea.every((rune) => rune.exhausted)).toBe(true);
    expect(s.room.rules!.chain).toHaveLength(0);
  });
});
