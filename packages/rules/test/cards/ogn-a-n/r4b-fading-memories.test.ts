/**
 * OGN A–N R4b — Temporary granted to a gear survives the Expiration Step (lane A) and kills the
 * gear in its controller's next Beginning Phase (816.1.b).
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords, getCardScript } from "../../../src";
import { fund, place, zoneOf } from "../../rules/effects/helpers";
import { settle, withCards } from "./helpers";

describe("Origins A–N R4b — Temporary on gear [R317.2.c][R816.1.b]", () => {
  it("[C:Fading Memories][R317.2.c][R816.1.b] a gear given Temporary keeps it and dies next Beginning Phase", () => {
    const s = withCards(["Fading Memories"]);
    const gear = place(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Fading Memories");
    s.as("p1")
      .play("Fading Memories", { choices: { "target:0": gear.id } })
      .expectOk();
    settle(s);
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");
    s.as("p1").endTurn().expectOk();
    // 317.2.c: the permanent keyword grant is not a "this turn" effect and survives 3d.
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");
    // 816.1.b: p2's Beginning Phase, before scoring, kills it.
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(getCardScript("Fading Memories")?.status).toBe("implemented");
  });

  it("[C:Fading Memories][R816.1.b] a unit at a battlefield still gets Temporary", () => {
    const s = withCards(["Fading Memories"]);
    const unit = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.room.rules!.objects[unit.id] = { baseMight: 8 };
    fund(s, "p1", "Fading Memories");
    s.as("p1")
      .play("Fading Memories", { choices: { "target:0": unit.id } })
      .expectOk();
    settle(s);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("trash");
  });
});
