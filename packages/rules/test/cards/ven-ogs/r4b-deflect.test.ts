/**
 * Wave R4-cards (VEN/OGS): cards unblocked by R4-engine lane B (Deflect 809).
 *
 * Deflect payment now reads `effectiveKeywordValues`, so [Deflect 2]/[Deflect 3] printed in the
 * text and [Deflect]/[Deflect N] granted by a dependent (Empowered) passive are charged at their
 * real value (809.1.c / 809.2).
 */
import { describe, expect, it } from "vitest";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import { addPool, exhaustRunes, keywordValue, settle, withCards } from "./helpers";

/** Put a Deflect unit under p2's control and give it the given Empowered stacks. */
function warded(
  s: ReturnType<typeof withCards>,
  name: string,
  stacks: number,
) {
  const unit = place(s, "p2", name, "battlefieldA");
  if (stacks > 0) {
    s.room.rules!.objects[unit.id] = {
      ...(s.room.rules!.objects[unit.id] ?? {}),
      empowered: stacks,
    };
  }
  return unit;
}

/** p1 has only the spell's base cost funded; one Power short of a Deflect `value` surcharge. */
function tryPayOneShort(s: ReturnType<typeof withCards>, id: string, value: number) {
  exhaustRunes(s, "p1");
  // 164.2.b: an exhausted Basic Rune can still be recycled for Power, so empty the Rune Area.
  boardOf(s, "p1").runeArea = [];
  fund(s, "p1", "Hextech Ray");
  addPool(s, "p1", 0, { any: Math.max(0, value - 1) });
  s.as("p1")
    .play("Hextech Ray", { choices: { "target:0": id } })
    .expectError("insufficient_resources");
}

describe("Deflect from printed text and Empowered passives [R809]", () => {
  it("[C:Nasus, Ascended][R809.1.c][R809.2] [Deflect 2] costs [Rune][Rune] more", () => {
    const s = withCards(["Hextech Ray"], ["Nasus, Ascended"]);
    const nasus = warded(s, "Nasus, Ascended", 0);
    expect(keywordValue(s, nasus.id, "Deflect")).toBe(2);
    tryPayOneShort(s, nasus.id, 2);
  });

  it("[C:Baccai Sandspinner][R809.1.c][R809.2] the Empowered passive grants and charges [Deflect]", () => {
    const s = withCards(["Hextech Ray"], ["Baccai Sandspinner"]);
    const spinner = warded(s, "Baccai Sandspinner", 0);
    expect(keywordValue(s, spinner.id, "Deflect")).toBe(0);
    s.room.rules!.objects[spinner.id] = { ...(s.room.rules!.objects[spinner.id] ?? {}), empowered: 1 };
    expect(keywordValue(s, spinner.id, "Deflect")).toBe(1);
    tryPayOneShort(s, spinner.id, 1);
  });

  it("[C:Grumpy Rockbear][R809.1.c][R809.2] the Empowered passive grants and charges [Deflect]", () => {
    const s = withCards(["Hextech Ray"], ["Grumpy Rockbear"]);
    const bear = warded(s, "Grumpy Rockbear", 1);
    expect(keywordValue(s, bear.id, "Deflect")).toBe(1);
    tryPayOneShort(s, bear.id, 1);
  });

  it("[C:Serene Ascetic][R809.1.c][R809.2] the Empowered passive grants and charges [Deflect]", () => {
    const s = withCards(["Hextech Ray"], ["Serene Ascetic"]);
    const ascetic = warded(s, "Serene Ascetic", 1);
    expect(keywordValue(s, ascetic.id, "Deflect")).toBe(1);
    tryPayOneShort(s, ascetic.id, 1);
  });

  it("[C:Solari Sunhawk][R809.1.c][R809.2] the Empowered passive grants [Deflect 2]", () => {
    const s = withCards(["Hextech Ray"], ["Solari Sunhawk"]);
    const hawk = warded(s, "Solari Sunhawk", 1);
    expect(keywordValue(s, hawk.id, "Deflect")).toBe(2);
    tryPayOneShort(s, hawk.id, 2);
  });

  it("[C:Renekton, Brute][R809.1.c][R809.2] the Empowered passive grants [Deflect]", () => {
    const s = withCards(["Hextech Ray"], ["Renekton, Brute"]);
    const brute = warded(s, "Renekton, Brute", 1);
    expect(keywordValue(s, brute.id, "Deflect")).toBe(1);
    tryPayOneShort(s, brute.id, 1);
  });

  it("[C:Kayle, Justified][R442.1.c.1][R809.1.c] three Empowered stacks grant and charge [Deflect 3]", () => {
    const s = withCards(["Hextech Ray"], ["Kayle, Justified"]);
    const kayle = warded(s, "Kayle, Justified", 2);
    expect(keywordValue(s, kayle.id, "Deflect")).toBe(0);
    s.room.rules!.objects[kayle.id] = { ...(s.room.rules!.objects[kayle.id] ?? {}), empowered: 3 };
    expect(keywordValue(s, kayle.id, "Deflect")).toBe(3);
    tryPayOneShort(s, kayle.id, 3);
  });

  it("[C:Nasus, Ascended][R809.2] paying the exact surcharge resolves the spell", () => {
    const s = withCards(["Hextech Ray"], ["Nasus, Ascended"]);
    const nasus = warded(s, "Nasus, Ascended", 0);
    exhaustRunes(s, "p1");
    boardOf(s, "p1").runeArea = [];
    fund(s, "p1", "Hextech Ray");
    addPool(s, "p1", 0, { any: 2 });
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": nasus.id } })
      .expectOk();
    settle(s);
    expect(s.room.rules!.pools.p1!.power.any ?? 0).toBe(0);
    expect((s.room.rules!.objects[nasus.id]?.damage ?? 0) >= 3).toBe(true);
  });
});
