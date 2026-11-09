/**
 * R4-fix-wm — Weaponmaster (821) granted by Azir, Emperor of the Sands to Sand Soldier tokens.
 *
 * The legend's ability "Play a 2 [Might] Sand Soldier unit token" (187.3) plays the token
 * (440.2.c / 186), so the granted [Weaponmaster] play trigger (821.1.b) must fire for the token
 * created by the legend's activated ability, not only for a unit card played from hand.
 *
 * 821.1.c.2: the Equip cost is determined as though the Equip ability were activated choosing
 * the unit with Weaponmaster. 821.1.c.3: only [A] is reduced; a specific-Domain Equip cost is
 * still paid in full. 821.1.c.2.b: reductions that read the chosen unit (Hextech Gauntlets'
 * Energy reduction by its Might) apply too.
 */
import type { Prompt } from "@rift/protocol";
import { describe, expect, it } from "vitest";
import { scenario, type RulesScenario } from "../../../scenarios/dsl";
import { settle } from "../../../cards/sfd/helpers";
import { addPool, boardCard, put } from "../d/helpers";

/** Put `name` in p1's hand (the scenario's start-of-turn draw may already have it). */
function toHand(s: RulesScenario, name: string): void {
  if (!s.handCard("p1", name)) s.moveDeckCardToHand("p1", name);
}

/** Play the legend's "[1], [Tap]: Play a Sand Soldier" ability (third scripted ability). */
function playSandSoldier(s: RulesScenario, legendId: string): void {
  s.as("p1").apply({ type: "rules_activate", objectId: legendId, ability: "activated:2" } as never).expectOk();
}

function azirLegend(s: RulesScenario): string {
  return put(s, "p1", "Azir, Emperor of the Sands", "legend").id;
}

/** Answer every prompt, recording it; `choose` picks an option id for choose-target prompts. */
function settleWith(
  s: RulesScenario,
  choose: (prompt: Prompt) => string | undefined,
): { prompts: Prompt[]; events: ReturnType<typeof settle> } {
  const prompts: Prompt[] = [];
  const events = settle(s, (prompt) => {
    prompts.push(prompt);
    if (prompt.kind === "yes-no") return undefined;
    if (prompt.kind === "order") {
      const optionIds = (prompt.options ?? []).map((option) => option.id);
      return { optionIds, orderedIds: optionIds };
    }
    const id = choose(prompt);
    return id ? { optionIds: [id] } : undefined;
  });
  return { prompts, events };
}

describe("Weaponmaster on Azir's Sand Soldiers [R821.1.b]", () => {
  it("[C:Azir, Emperor of the Sands][C:Spinning Axe][R186][R821.1.b] a played token offers the Weaponmaster trigger", () => {
    const s = scenario({
      extraCards: { p1: ["Azir, Emperor of the Sands", "Spinning Axe", "Guardian Angel"] },
    });
    toHand(s, "Spinning Axe");
    toHand(s, "Guardian Angel");
    const legend = azirLegend(s);
    addPool(s, "p1", 8, { Fury: 1 });
    // Satisfy "Use only if you've played an Equipment this turn" with a real Equipment play.
    s.as("p1").play("Spinning Axe").expectOk();
    settle(s);
    const axe = s.findBoardCardAnywhere("Spinning Axe")!;
    put(s, "p1", "Guardian Angel", "base");
    playSandSoldier(s, legend);
    const { prompts } = settleWith(s, (prompt) => {
      // 821.1.c: the trigger chooses an Equipment you control.
      return prompt.kind === "choose-target" ? axe.id : undefined;
    });
    // 403.1: "you may" is asked first; 355.7: the Equipment choice is a target-like prompt.
    expect(prompts[0]).toMatchObject({
      kind: "yes-no",
      playerId: "p1",
      rule: "403.1",
      promptKey: "rules.prompt.mayTrigger",
    });
    expect(prompts.some((prompt) => prompt.kind === "choose-target")).toBe(true);
    const soldier = s.findBoardCardAnywhere("Sand Soldier")!;
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBe(soldier.id);
  });

  it("[C:Azir, Emperor of the Sands][C:Spinning Axe][R821.1.c.2][R821.1.c.3] an [A] Equip cost is free (no rune touched)", () => {
    const s = scenario({
      extraCards: { p1: ["Azir, Emperor of the Sands", "Spinning Axe"] },
      p1: { runes: ["Calm Rune"] },
    });
    toHand(s, "Spinning Axe");
    const legend = azirLegend(s);
    addPool(s, "p1", 8, { Fury: 1 });
    s.as("p1").play("Spinning Axe").expectOk();
    settle(s);
    const axe = s.findBoardCardAnywhere("Spinning Axe")!;
    const runesBefore = s.room.players[0]!.board!.runeArea.map((rune) => rune.id).sort();
    playSandSoldier(s, legend);
    const { events } = settleWith(s, () => axe.id);
    const soldier = s.findBoardCardAnywhere("Sand Soldier")!;
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBe(soldier.id);
    // [Rune] = [A]; Weaponmaster reduces it to nothing: no rune exhausted or recycled.
    expect(events.filter((event) => event.type === "exhaust" || event.type === "recycle")).toEqual([]);
    expect(s.room.players[0]!.board!.runeArea.map((rune) => rune.id).sort()).toEqual(runesBefore);
    expect(Object.values(s.room.rules!.pools.p1!.power).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(0);
  });

  it("[C:Azir, Emperor of the Sands][C:Hextech Gauntlets][R821.1.c.2][R821.1.c.2.b] a larger Equip cost pays only the reduced amount", () => {
    const s = scenario({
      extraCards: { p1: ["Azir, Emperor of the Sands", "Hextech Gauntlets"] },
      p1: { runes: ["Order Rune"] },
    });
    toHand(s, "Hextech Gauntlets");
    const legend = azirLegend(s);
    addPool(s, "p1", 12, { Order: 1 });
    s.as("p1").play("Hextech Gauntlets").expectOk();
    settle(s);
    const gauntlets = s.findBoardCardAnywhere("Hextech Gauntlets")!;
    const energyBefore = s.room.rules!.pools.p1!.energy;
    playSandSoldier(s, legend);
    const { events } = settleWith(s, () => gauntlets.id);
    const soldier = s.findBoardCardAnywhere("Sand Soldier")!;
    expect(boardCard(s, "p1", "Hextech Gauntlets")!.attachedToCardId).toBe(soldier.id);
    // Base [3][A]: [A] reduced to nothing and Energy reduced by the 2-Might Sand Soldier's Might,
    // so exactly 1 Energy is paid for the attach (plus the legend ability's [1]) — and no rune is
    // exhausted or recycled.
    expect(s.room.rules!.pools.p1!.energy).toBe(energyBefore - 2);
    expect(events.filter((event) => event.type === "exhaust" || event.type === "recycle")).toEqual([]);
  });

  it("[C:Azir, Emperor of the Sands][C:Doran's Shield][R821.1.c.3] a specific-Domain Equip cost is paid in full", () => {
    const s = scenario({
      extraCards: { p1: ["Azir, Emperor of the Sands", "Doran's Shield"] },
      p1: { runes: ["Calm Rune"] },
    });
    toHand(s, "Doran's Shield");
    const legend = azirLegend(s);
    addPool(s, "p1", 8);
    s.as("p1").play("Doran's Shield").expectOk();
    settle(s);
    const shield = s.findBoardCardAnywhere("Doran's Shield")!;
    playSandSoldier(s, legend);
    const { events } = settleWith(s, () => shield.id);
    const soldier = s.findBoardCardAnywhere("Sand Soldier")!;
    expect(boardCard(s, "p1", "Doran's Shield")!.attachedToCardId).toBe(soldier.id);
    // [Calm] does not contain [A] (821.1.c.3): one Calm rune is recycled for the Power.
    expect(events.some((event) => event.type === "recycle" && event.zone === "runeDeck")).toBe(true);
  });

  it("[C:Azir, Emperor of the Sands][C:Spinning Axe][R821.1.b][R403.1] declining then equipping normally pays the full cost", () => {
    const s = scenario({
      extraCards: { p1: ["Azir, Emperor of the Sands", "Spinning Axe"] },
      p1: { runes: ["Calm Rune"] },
    });
    toHand(s, "Spinning Axe");
    const legend = azirLegend(s);
    addPool(s, "p1", 8, { Fury: 1 });
    s.as("p1").play("Spinning Axe").expectOk();
    settle(s);
    const axe = s.findBoardCardAnywhere("Spinning Axe")!;
    playSandSoldier(s, legend);
    // 403.1: decline the optional trigger ("No" is the second yes/no option).
    const prompts: Prompt[] = [];
    const declineEvents = settle(s, (prompt) => {
      prompts.push(prompt);
      return prompt.kind === "yes-no" ? { optionIds: ["no"] } : undefined;
    });
    expect(prompts.some((prompt) => prompt.kind === "yes-no")).toBe(true);
    expect(declineEvents.some((event) => event.type === "trigger_declined")).toBe(true);
    const soldier = s.findBoardCardAnywhere("Sand Soldier")!;
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBeUndefined();
    // Normal Equip later: [Rune] = [A], paid by recycling the ready rune.
    s.as("p1").apply({
      type: "rules_activate",
      objectId: axe.id,
      ability: "equip:0",
      choices: { "target:0": soldier.id },
    } as never).expectOk();
    const equipEvents = s.events();
    settle(s, (prompt) => (prompt.kind === "choose-target" ? { optionIds: [soldier.id] } : undefined));
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBe(soldier.id);
    expect(equipEvents.some((event) => event.type === "recycle" && event.zone === "runeDeck")).toBe(true);
  });

  it("[C:Azir, Emperor of the Sands][C:Arise!][R186][R821.1.c.7] each Sand Soldier played by an effect triggers Weaponmaster separately", () => {
    const s = scenario({
      extraCards: { p1: ["Azir, Emperor of the Sands", "Forgefire Cape", "Shurelya's Requiem", "Arise!"] },
    });
    toHand(s, "Arise!");
    azirLegend(s);
    put(s, "p1", "Forgefire Cape", "base");
    put(s, "p1", "Shurelya's Requiem", "base");
    addPool(s, "p1", 20, { Calm: 1 });
    s.as("p1").play("Arise!").expectOk();
    const picks = ["Forgefire Cape", "Shurelya's Requiem"];
    const { events } = settleWith(s, (prompt) => {
      const options = prompt.options ?? [];
      const wanted = picks.find((name) => options.some((option) => option.label === name));
      if (!wanted) return undefined;
      picks.splice(picks.indexOf(wanted), 1);
      return options.find((option) => option.label === wanted)!.id;
    });
    const soldiers = s.room.players[0]!.board!.base.filter((card) => card.name === "Sand Soldier");
    expect(soldiers).toHaveLength(2);
    expect(boardCard(s, "p1", "Forgefire Cape")!.attachedToCardId).toBe(soldiers[0]!.id);
    expect(boardCard(s, "p1", "Shurelya's Requiem")!.attachedToCardId).toBe(soldiers[1]!.id);
    expect(events.filter((event) => event.type === "exhaust" || event.type === "recycle")).toEqual([]);
  });
});
