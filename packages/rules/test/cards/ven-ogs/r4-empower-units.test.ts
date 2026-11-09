/**
 * Wave R4 — Empower units whose remaining gap is an engine capability.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  answer,
  empowered,
  might,
  place,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Wave R4 Empower units", () => {
  it("[C:Mel, Defiant Soul][R828.1.d][R428] on empower banish an enemy unit at a battlefield with 3 Might or less", () => {
    const s = withCards(["Mel, Defiant Soul", "Rage Amplifier"], ["Treasure Hunter", "Whiteflame Protector"]);
    const mel = place(s, "p1", "Mel, Defiant Soul", "base");
    const small = place(s, "p2", "Treasure Hunter", "battlefieldA");
    place(s, "p2", "Whiteflame Protector", "battlefieldA");
    activate(s, "p1", mel, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, mel.id)).toBe(true);
    settle(s);
    if (s.room.rules!.prompt) answer(s, [small.id]);
    settle(s);
    expect(zoneOf(s, small.id)).toBe("banished");
    expect(getCardScript("Mel, Defiant Soul")?.status).toBe("partial");
  });

  it("[C:Gangplank, Naval][R828.1.c][R424] Empowered: a stun becomes +3 Might this turn", () => {
    const s = withCards(["Gangplank, Naval"], ["Rune Prison"]);
    const gangplank = place(s, "p1", "Gangplank, Naval", "base");
    // Direct placement skips finalize's `baseMight`; set it so the Expiration Step keeps the unit.
    s.room.rules!.objects[gangplank.id] = { ...(s.room.rules!.objects[gangplank.id] ?? {}), baseMight: 6 };
    addPool(s, "p1", 0, { any: 2 });
    activate(s, "p1", gangplank, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, gangplank.id)).toBe(true);
    s.as("p1").endTurn().expectOk();
    settle(s);
    fund(s, "p2", "Rune Prison");
    s.as("p2")
      .play("Rune Prison", { choices: { "target:0": gangplank.id } })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[gangplank.id]?.stunned).toBeUndefined();
    expect(might(s, gangplank.id)).toBe(9);
    expect(getCardScript("Gangplank, Naval")?.status).toBe("partial");
  });
});
