/**
 * Unleashed R4b — Smite and Tactical Retreat no longer use the R3 `unl:replace-next-death`
 * workaround: R4-engine lane C lets a delayed `replace` matcher see the choices of the ability
 * that created it (359.3.f.3.a / 391.3), so both scripts use the engine path.
 */
import { describe, expect, it } from "vitest";
import { customEffectIds, getCardScript } from "../../../src";
import { fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { playWith, resolveChain, withCards } from "./helpers";

describe("Unleashed R4b — delayed death replacements [R391.3][R359.3.f.3.a]", () => {
  it("[C:Smite][R391.3] the chosen unit is banished instead of dying", () => {
    const s = withCards(["Smite"]);
    const victim = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Treasure Hunter", "battlefieldB");
    fund(s, "p1", "Smite");
    playWith(s, "p1", "Smite", { choices: { "target:0": victim.id } });
    resolveChain(s);
    expect(zoneOf(s, victim.id)).toBe("banished");
    expect(getCardScript("Smite")?.status).toBe("implemented");
    expect(customEffectIds()).not.toContain("unl:replace-next-death");
  });

  it("[C:Smite][R355.7] the damage target is chosen on play", () => {
    const s = withCards(["Smite"]);
    const first = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const second = place(s, "p2", "Treasure Hunter", "battlefieldB");
    fund(s, "p1", "Smite");
    s.as("p1").play("Smite").expectOk();
    expect(s.room.rules?.prompt?.kind).toBe("choose-target");
    const options = s.room.rules?.prompt?.options?.map((option) => option.id) ?? [];
    expect(options).toEqual(expect.arrayContaining([first.id, second.id]));
    s.as("p1").choose({ optionIds: [second.id] }).expectOk();
    resolveChain(s);
    // 3 damage is lethal to a 2-Might unit, so the delayed replacement banishes it.
    expect(zoneOf(s, second.id)).toBe("banished");
    expect(zoneOf(s, first.id)).toBe("battlefieldA");
  });

  it("[C:Tactical Retreat][R391.3] the next time the chosen unit would die: heal, exhaust, recall", () => {
    const s = withCards(["Tactical Retreat"]);
    const chosen = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const other = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Tactical Retreat");
    playWith(s, "p1", "Tactical Retreat", { choices: { "target:0": chosen.id } });
    resolveChain(s);
    // A different friendly unit still dies normally.
    run(s, { op: "kill", target: { targetRef: `obj:${other.id}` } });
    expect(zoneOf(s, other.id)).toBe("trash");
    expect(zoneOf(s, chosen.id)).toBe("battlefieldA");
    // The chosen unit is healed, exhausted and recalled instead.
    run(s, { op: "kill", target: { targetRef: `obj:${chosen.id}` } });
    expect(zoneOf(s, chosen.id)).toBe("base");
    expect(s.host.isExhausted(s.room, chosen.id)).toBe(true);
    expect(s.room.rules!.objects[chosen.id]?.damage ?? 0).toBe(0);
    expect(getCardScript("Tactical Retreat")?.status).toBe("implemented");
    expect(customEffectIds()).not.toContain("unl:replace-next-death");
  });
});
