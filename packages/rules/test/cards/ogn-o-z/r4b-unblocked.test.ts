/**
 * OGN O–Z R4b — last-known-information triggers (lane C) and delayed replacements whose matcher
 * reads the creating ability's choices (lane C, 359.3.f.3.a / 375).
 */
import { describe, expect, it } from "vitest";
import { getCardScript, listActivatedAbilities } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { driveAll, setMight, withCards } from "./helpers";

describe("Origins O–Z R4b — last-known information on kill/die [R383.2.c.3.b]", () => {
  it("[C:Solari Shrine][R429.5][R424][R383.2.c.3.b] when you kill a stunned enemy unit, may exhaust this to draw 1", () => {
    const s = withCards(["Solari Shrine", "Vengeance"], ["Caitlyn, Patrolling"]);
    const shrine = place(s, "p1", "Solari Shrine", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    setMight(s, enemy.id, 3, { stunned: true });
    fund(s, "p1", "Vengeance");
    const before = boardOf(s, "p1").hand.length;
    s.as("p1").play("Vengeance", { choices: { "target:0": enemy.id } }).expectOk();
    driveAll(s, (prompt) => (prompt.kind === "yes-no" ? ["yes"] : [prompt.options![0]!.id]));
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(s.host.isExhausted(s.room, shrine.id)).toBe(true);
    // Played Vengeance (-1) then Solari Shrine drew 1. Damage kills are attributed too (429.5.c).
    expect(boardOf(s, "p1").hand.length).toBe(before);
    expect(getCardScript("Solari Shrine")?.status).toBe("implemented");
  });

  it("[C:Vanguard Helm][R383.2.c.3.b][R359.3.e.13] when a buffed friendly unit dies, buff another friendly unit", () => {
    const s = withCards(["Vanguard Helm", "Hextech Ray"], ["Treasure Hunter"]);
    place(s, "p1", "Vanguard Helm", "base");
    const buffed = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const other = place(s, "p1", "Treasure Hunter", "base");
    setMight(s, buffed.id, 2, { buffs: 1 });
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": buffed.id } }).expectOk();
    driveAll(s, (prompt) =>
      prompt.kind === "choose-target" ? [other.id] : prompt.options?.[0] ? [prompt.options[0].id] : [],
    );
    expect(zoneOf(s, buffed.id)).toBe("trash");
    expect(s.room.rules!.objects[other.id]?.buffs).toBe(1);
    expect(getCardScript("Vanguard Helm")?.status).toBe("implemented");
  });

  it("[C:Solari Shrine][R429.5] a kill by the Shrine's controller's opponent does not trigger it", () => {
    const s = withCards(["Vengeance"], ["Solari Shrine", "Caitlyn, Patrolling"]);
    const shrine = place(s, "p2", "Solari Shrine", "base");
    const victim = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    setMight(s, victim.id, 3, { stunned: true });
    fund(s, "p1", "Vengeance");
    s.as("p1").play("Vengeance", { choices: { "target:0": victim.id } }).expectOk();
    driveAll(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(s.host.isExhausted(s.room, shrine.id)).toBe(false);
  });
});

describe("Origins O–Z R4b — delayed replacement with choices [R375][R359.3.f.3.a]", () => {
  it("[C:Unlicensed Armory][R371.2][R445] the delayed matcher reads the chosen unit (target:0)", () => {
    const s = withCards(["Unlicensed Armory", "Progress Day", "Vengeance", "Progress Day"]);
    const armory = place(s, "p1", "Unlicensed Armory", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const ref = listActivatedAbilities("Unlicensed Armory")[0]!.ref;
    s.as("p1")
      .apply({ type: "rules_activate", objectId: armory.id, ability: ref, choices: { "target:0": unit.id } } as never)
      .expectOk();
    const discard = boardOf(s, "p1").hand.find((card) => card.name === "Progress Day")!;
    s.as("p1").choose({ optionIds: [discard.id] }).expectOk();
    driveAll(s);
    s.room.rules!.pools.p1!.power = { ...(s.room.rules!.pools.p1!.power ?? {}), Fury: 1 };
    fund(s, "p1", "Vengeance");
    s.as("p1").play("Vengeance", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    driveAll(s);
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(getCardScript("Unlicensed Armory")?.status).toBe("implemented");
  });
});
