/** Wave R4 — Ganking granted by keyword passives now allows Standard Moves (810.3). */
import { describe, expect, it } from "vitest";
import { effectiveKeywords } from "../../../src";
import { place, zoneOf } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

describe("Spiritforged R4 — Ganking from passives", () => {
  it("[C:Breakneck Mech][R810.3][R144.4.c.1] \"Your Mechs have [Ganking]\" allows a battlefield-to-battlefield move", () => {
    const s = withCards(["Breakneck Mech"]);
    const mech = place(s, "p1", "Breakneck Mech", "battlefieldA");
    expect(effectiveKeywords(s.room, mech.id, s.host)).toContain("Ganking");
    s.as("p1").move("Breakneck Mech", "battlefieldB").expectOk();
    expect(zoneOf(s, mech.id)).toBe("battlefieldB");
  });
});
