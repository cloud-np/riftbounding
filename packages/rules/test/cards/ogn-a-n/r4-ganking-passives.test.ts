/** Wave R4 — Ganking granted by keyword passives now allows Standard Moves (810.3). */
import { describe, expect, it } from "vitest";
import { effectiveKeywords } from "../../../src";
import { place, zoneOf } from "../../rules/effects/helpers";
import { withCards } from "./helpers";

describe("Origins A–N R4 — Ganking from passives", () => {
  it("[C:Bilgewater Bully][R810.3][R144.4.c.1] while buffed, the conditional Ganking passive allows a battlefield-to-battlefield move", () => {
    const s = withCards(["Bilgewater Bully"]);
    const bully = place(s, "p1", "Bilgewater Bully", "battlefieldA");
    s.room.rules!.objects[bully.id] = { ...(s.room.rules!.objects[bully.id] ?? {}), baseMight: 3, buffs: 1 };
    expect(effectiveKeywords(s.room, bully.id, s.host)).toContain("Ganking");
    s.as("p1").move("Bilgewater Bully", "battlefieldB").expectOk();
    expect(zoneOf(s, bully.id)).toBe("battlefieldB");
  });

  it("[C:Fiora, Victorious][R810.3][R708] while Mighty, the Ganking passive allows a battlefield-to-battlefield move", () => {
    const s = withCards(["Fiora, Victorious"]);
    const fiora = place(s, "p1", "Fiora, Victorious", "battlefieldA");
    s.room.rules!.objects[fiora.id] = { ...(s.room.rules!.objects[fiora.id] ?? {}), baseMight: 5 };
    expect(effectiveKeywords(s.room, fiora.id, s.host)).toContain("Ganking");
    s.as("p1").move("Fiora, Victorious", "battlefieldB").expectOk();
    expect(zoneOf(s, fiora.id)).toBe("battlefieldB");
  });
});
