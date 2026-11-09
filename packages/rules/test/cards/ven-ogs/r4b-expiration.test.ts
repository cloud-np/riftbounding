/**
 * Wave R4-cards (VEN/OGS): cards unblocked by R4-engine lane A — persistent object state
 * (Empowered, keyword grants, Might mods) survives the Expiration Step's `expire-this-turn`
 * cleanup (317.2.c / 442.2 / 828).
 */
import { describe, expect, it } from "vitest";
import { place } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  empowered,
  exhaustRunes,
  keywordValue,
  might,
  settle,
  withCards,
} from "./helpers";

describe("Empowered survives the Expiration Step [R442.2][R317.2.c]", () => {
  it("[C:Steel Paws][R442.2][R317.2.c] a 0-Might unit keeps Empowered and its +7 Might", () => {
    const s = withCards(["Steel Paws"]);
    const paws = place(s, "p1", "Steel Paws", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 7);
    activate(s, "p1", paws, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, paws.id)).toBe(true);
    expect(might(s, paws.id)).toBe(7);
    s.as("p1").endTurn().expectOk();
    settle(s);
    // 442.2: Empowered is a board state, not a this-turn effect.
    expect(empowered(s, paws.id)).toBe(true);
    expect(might(s, paws.id)).toBe(7);
    // Printed [Deflect] is still there too.
    expect(keywordValue(s, paws.id, "Deflect")).toBe(1);
  });

  it("[C:Tools of Empire][R442.2][R317.2.c] an Empowered gear keeps Empowered", () => {
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
});
