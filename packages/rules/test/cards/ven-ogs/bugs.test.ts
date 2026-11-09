/**
 * Engine bugs found while scripting Vendetta / Proving Grounds (ven-ogs lane). Each test is the
 * minimal reproduction of rules-wrong behaviour, skipped until the engine is fixed (the engine
 * is outside this lane). Unskip to verify a fix.
 */
import { describe, expect, it } from "vitest";
import { fund } from "../../rules/effects/helpers";
import { activate, addPool, empowered, exhaustRunes, place, settle, withCards } from "./helpers";

describe("[BUG] engine reproductions (ven-ogs)", () => {
  // cleanup/cleanup.ts "expire-this-turn" (317.2.c step 3d) deletes every rules object without
  // buffs/baseMight/counters/grantedKeywords/grantedAbilities/controller. Gear, legends and units
  // with 0 base Might lose their Empowered status (and keyword grants, prevention, Might mods) at
  // the end of the turn, although Empowered lasts until the object leaves the board (442.2, 828).
  it.skip("[BUG][C:Steel Paws][R442.2][R317.2.c] a 0-Might unit loses Empowered in the Expiration Step", () => {
    const s = withCards(["Steel Paws"]);
    fund(s, "p1", "Steel Paws");
    s.as("p1").play("Steel Paws").expectOk();
    settle(s);
    const paws = s.findBoardCardAnywhere("Steel Paws")!;
    exhaustRunes(s, "p1");
    addPool(s, "p1", 7);
    activate(s, "p1", paws, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, paws.id)).toBe(true);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(empowered(s, paws.id)).toBe(true);
  });

  it.skip("[BUG][C:Tools of Empire][R442.2][R317.2.c] an Empowered gear loses Empowered in the Expiration Step", () => {
    const s = withCards(["Tools of Empire"]);
    const tools = place(s, "p1", "Tools of Empire", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 2);
    activate(s, "p1", tools, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, tools.id)).toBe(true);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(empowered(s, tools.id)).toBe(true);
  });

  // play/additional-costs.ts `deflectCosts` reads `cardKeywords` → the array form of
  // `effectiveKeywords`, which returns bare keyword names ("Deflect", not "Deflect 2"), so
  // `keywordValue` counts 1: a [Deflect 2] unit costs [Rune] instead of [Rune][Rune] (809.1.c /
  // 809.2).
  it.skip("[BUG][C:Nasus, Ascended][R809.1.c][R809.2] choosing a [Deflect 2] unit costs [Rune][Rune] more", () => {
    const s = withCards(["Hextech Ray"], ["Nasus, Ascended"]);
    const nasus = place(s, "p2", "Nasus, Ascended", "battlefieldA");
    exhaustRunes(s, "p1");
    fund(s, "p1", "Hextech Ray");
    addPool(s, "p1", 0, { any: 1 });
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": nasus.id } })
      .expectError("insufficient_resources");
  });
});
