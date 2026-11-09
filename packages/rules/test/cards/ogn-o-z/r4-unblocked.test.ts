/**
 * Wave R4 — Origins O–Z upgrades unblocked by R3-engine: damage split (Volibear, Furious),
 * optional replacements with a payment (Unlicensed Armory, Sett, The Boss), replacing the combat
 * tie recall (Symbol of the Solari) and Ganking from keyword passives (Windswept Hillock).
 */
import { describe, expect, it } from "vitest";
import { getCardScript, listActivatedAbilities } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import {
  boardCard,
  placeLegend,
  resolveAll,
  setMight,
  withCards,
} from "./helpers";

function hasEvent(s: ReturnType<typeof withCards>, type: string, cardId?: string): boolean {
  return s
    .events()
    .some((event) => event.type === type && (cardId === undefined || event.cardId === cardId));
}

describe("Origins O–Z R4 upgrades", () => {
  it("[C:Volibear, Furious][R355.14][R383.4.e] when he attacks, 5 damage split among enemy units here", () => {
    const s = withCards(["Volibear, Furious"]);
    const voli = place(s, "p1", "Volibear, Furious", "base");
    const first = place(s, "p2", "Astral Heron", "battlefieldA");
    const second = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    setMight(s, first.id, 20);
    setMight(s, second.id, 20);

    s.as("p1").move("Volibear, Furious", "battlefieldA").expectOk();
    s.expectPrompt("choose-target", "p1");
    s.as("p1")
      .choose({ optionIds: [first.id, second.id] })
      .expectOk();
    // 355.14.e-g: the division is chosen on resolution, at least 1 each.
    resolveAll(s);
    const division = s.expectPrompt("damage-assignment", "p1").room.rules!.prompt!;
    s.as("p1")
      .choose({
        assignments: [
          { targetId: first.id, amount: 2 },
          { targetId: second.id, amount: 3 },
        ],
      })
      .expectOk();
    expect(s.room.rules!.objects[first.id]?.damage).toBe(2);
    expect(s.room.rules!.objects[second.id]?.damage).toBe(3);
    const split = s
      .events()
      .filter((event) => event.type === "damage" && event.sourceObjectId === voli.id);
    expect(split.map((event) => event.amount)).toEqual([2, 3]);
    expect(division.rule).toBe("355.14.e");
    expect(getCardScript("Volibear, Furious")?.status).toBe("implemented");
  });

  it("[C:Unlicensed Armory][R371.2][R445] the chosen unit's next death may pay [Fury] to be healed, exhausted and recalled", () => {
    const s = withCards(["Unlicensed Armory", "Progress Day", "Vengeance", "Progress Day"]);
    const armory = place(s, "p1", "Unlicensed Armory", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const ref = listActivatedAbilities("Unlicensed Armory")[0]!.ref;
    s.as("p1")
      .apply({ type: "rules_activate", objectId: armory.id, ability: ref, choices: { "target:0": unit.id } } as never)
      .expectOk();
    // 423.1.a: the controller chooses the discarded card.
    const discard = boardOf(s, "p1").hand.find((card) => card.name === "Progress Day")!;
    s.as("p1").choose({ optionIds: [discard.id] }).expectOk();
    resolveAll(s);
    expect(s.host.isExhausted(s.room, armory.id)).toBe(true);
    expect(boardOf(s, "p1").trash.map((card) => card.name)).toContain("Progress Day");
    expect(hasEvent(s, "replacement_created")).toBe(true);

    s.room.rules!.pools.p1!.power = { ...(s.room.rules!.pools.p1!.power ?? {}), Fury: 1 };
    fund(s, "p1", "Vengeance");
    s.as("p1").play("Vengeance", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    const prompt = s.expectPrompt("yes-no", "p1").room.rules!.prompt!;
    expect(prompt).toMatchObject({ rule: "371.2.a", promptKey: "rules.prompt.applyReplacement" });
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(s.room.rules!.objects[unit.id]?.damage ?? 0).toBe(0);
    expect(s.room.rules!.pools.p1!.power.Fury ?? 0).toBe(0);
    expect(getCardScript("Unlicensed Armory")?.status).toBe("implemented");
  });

  it("[C:Sett, The Boss][R371.2][R702.2.b] a buffed unit's death may pay [Rune], exhaust Sett and spend the buff", () => {
    const s = withCards(["Sett, The Boss", "Vengeance"]);
    const sett = placeLegend(s, "p1", "Sett, The Boss");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setMight(s, unit.id, 3, { buffs: 1 });
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    fund(s, "p1", "Vengeance");

    s.as("p1").play("Vengeance", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();

    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(s.room.rules!.objects[unit.id]?.buffs ?? 0).toBe(0);
    expect(s.host.isExhausted(s.room, sett.id)).toBe(true);
    expect(s.room.rules!.pools.p1!.power.any ?? 0).toBe(0);
    expect(getCardScript("Sett, The Boss")?.status).toBe("implemented");
  });

  it("[C:Symbol of the Solari][R468.1.a.2][R371] a tie recall recalls all units at the battlefield instead", () => {
    const s = withCards(["Symbol of the Solari"], ["Treasure Hunter"]);
    place(s, "p1", "Symbol of the Solari", "base");
    const attacker = place(s, "p1", "Caitlyn, Patrolling", "base");
    const defender = place(s, "p2", "Astral Heron", "battlefieldA");
    setMight(s, attacker.id, 20);
    setMight(s, defender.id, 20);
    // 438: prevent the combat damage so both sides remain (otherwise equal Might kills both
    // units and there is no Defenders-remain tie).
    const shield = (id: string) => ({
      id: `shield-${id}`,
      value: "all" as const,
      duration: "this-turn" as const,
      turn: s.room.rules!.turn.number,
    });
    s.room.rules!.objects[attacker.id] = { ...(s.room.rules!.objects[attacker.id] ?? {}), prevent: [shield(attacker.id)] };
    s.room.rules!.objects[defender.id] = { ...(s.room.rules!.objects[defender.id] ?? {}), prevent: [shield(defender.id)] };

    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    resolveAll(s);
    // 740.3.a: the combat is a tie (both sides remain) -> 468.1.a.2 recalls the attackers; the
    // replacement recalls the Defenders too.
    expect(zoneOf(s, attacker.id)).toBe("base");
    expect(zoneOf(s, defender.id)).toBe("base");
    expect(hasEvent(s, "replaced")).toBe(true);
    expect(getCardScript("Symbol of the Solari")?.status).toBe("implemented");
  });

  it("[C:Windswept Hillock][R810.3][R144.4.c.1] units here have Ganking and may move battlefield to battlefield", () => {
    const s = withCards([], [], { battlefields: { p1: "Windswept Hillock" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(getCardScript("Windswept Hillock")?.status).toBe("implemented");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    expect(zoneOf(s, unit.id)).toBe("battlefieldB");
    expect(boardCard(s, "p1", "Caitlyn, Patrolling")).toBeTruthy();
  });
});
