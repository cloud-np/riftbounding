import { describe, expect, it } from "vitest";
import {
  activeModifiers,
  costAdjustments,
  effectiveKeywords,
  effectiveKeywordValues,
  effectiveMight,
  executeEffect,
  getCardScript,
  listActivatedAbilities,
  lookupAbility,
  requiredChoices,
  validateChoices,
  victoryScoreAdjustment,
} from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, fund, place, stepFor, zoneOf } from "../rules/effects/helpers";

function passBoth(s: ReturnType<typeof scenario>, first = "p1"): void {
  const second = first === "p1" ? "p2" : "p1";
  s.as(first).pass().expectOk();
  s.as(second).pass().expectOk();
}

function hand(s: ReturnType<typeof scenario>, player: string) {
  return boardOf(s, player).hand;
}

describe("fixture deck card scripts", () => {
  it("[C:Treasure Hunter][EX:375] moving plays a Gold gear token exhausted", () => {
    const s = scenario();
    place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    expect(s.room.rules!.chain[0]).toMatchObject({ kind: "triggered", cardName: "Treasure Hunter" });
    passBoth(s);
    const gold = boardOf(s, "p1").base.find((card) => card.name === "Gold");
    expect(gold?.exhausted).toBe(true);
    expect(s.events().some((event) => event.type === "gear_played" && event.data?.token === true)).toBe(true);
    expect(getCardScript("Treasure Hunter")?.status).toBe("implemented");
  });

  it("[C:Gold][R187.5][R430.2] the Gold token's [Reaction] Add ability adds 1 Power of any domain", () => {
    const s = scenario();
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    executeEffect({ op: "create", token: { name: "Gold", play: true } }, { room: s.room, step: stepFor(s), controller: "p1" });
    const gold = boardOf(s, "p1").base.find((card) => card.name === "Gold")!;
    const entries = listActivatedAbilities("Gold");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.ability).toMatchObject({ addsResources: true, keywords: ["reaction"] });
    s.as("p1").apply({ type: "rules_activate", objectId: gold.id, ability: entries[0]!.ref }).expectOk();
    expect(s.room.rules!.pools.p1).toEqual({ energy: 0, power: { any: 1 } });
  });

  it("[C:Stellacorn Herder] moving draws 1", () => {
    const s = scenario();
    place(s, "p1", "Stellacorn Herder", "base");
    const before = hand(s, "p1").length;
    s.as("p1").move("Stellacorn Herder", "battlefieldA").expectOk();
    passBoth(s);
    expect(hand(s, "p1").length).toBe(before + 1);
  });

  it("[C:Rebuke] returns a unit at a battlefield to its owner's hand (base units are not choices)", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "base");
    const ability = lookupAbility("Rebuke", "spell")!.ability;
    expect(requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} })[0]!.options.map((o) => o.id)).toEqual([enemy.id]);
    s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(hand(s, "p2").some((card) => card.id === enemy.id)).toBe(true);
  });

  it("[C:Gust] returns a unit at a battlefield with 3 Might or less", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Astral Heron", "battlefieldA");
    const ability = lookupAbility("Gust", "spell")!.ability;
    expect(requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} })[0]!.options.map((o) => o.id)).toEqual([small.id]);
    s.as("p1").play("Gust", { choices: { "target:0": small.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, small.id)).toBe("hand");
  });

  it("[C:Defy][R426] counters a spell costing no more than [4] and [Rune]; Rebuke ([2][Rune][Rune]) is not a choice", () => {
    const s = scenario({
      p1: { hand: ["Gust", "Rebuke"], energy: 3, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    const target = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Rebuke", { hold: true, choices: { "target:0": target.id } }).expectOk();
    s.as("p1").play("Gust", { choices: { "target:0": target.id } }).expectOk();
    const [rebukeItem, gustItem] = s.room.rules!.chain;
    const defy = lookupAbility("Defy", "spell")!.ability;
    const options = requiredChoices(s.room, s.host, defy, { controller: "p2", choices: {} })[0]!.options.map((o) => o.id);
    expect(options).toContain(gustItem!.id);
    expect(options).not.toContain(rebukeItem!.id);
    s.as("p2").play("Defy", { choices: { "target:0": gustItem!.id } }).expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.chain.map((item) => item.cardName)).toEqual(["Rebuke"]);
    s.expectZone("p1", "Gust", "trash");
    expect(zoneOf(s, target.id)).toBe("battlefieldA");
  });

  it("[C:Caitlyn, Patrolling][R377.2.b] [Tap]: deal damage equal to her Might — only while at a battlefield", () => {
    const s = scenario();
    const caitlyn = place(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    const entries = listActivatedAbilities("Caitlyn, Patrolling");
    expect(entries.map((entry) => entry.ref)).toEqual(["activated:1"]);
    const ability = entries[0]!.ability;
    const ctx = (choices: Record<string, unknown>) => ({ controller: "p1", sourceObjectId: caitlyn.id, choices: choices as never });
    expect(validateChoices(s.room, s.host, ability, ctx({ "target:0": enemy.id }))).toMatchObject({ ok: false, rule: "377.2.b" });
    s.host.moveCard(s.room, "p1", "base", "battlefieldB", caitlyn.id);
    // The host's raw move applies the engine's arrival exhaustion; [Tap] needs a ready object (415.4).
    s.host.setExhausted(s.room, caitlyn.id, false);
    expect(validateChoices(s.room, s.host, ability, ctx({ "target:0": enemy.id })).ok).toBe(true);
    s.as("p1").apply({ type: "rules_activate", objectId: caitlyn.id, ability: "activated:1", choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
    // "I must be assigned combat damage last" is Backline's text (826.3), read by combat assignment
    // (test/edge-cases/combat.test.ts); the legacy modifier stays exposed.
    expect(activeModifiers(s.room, s.host).some((m) => m.modifier.kind === "assigned-last")).toBe(true);
    expect(getCardScript("Caitlyn, Patrolling")?.status).toBe("implemented");
  });

  it("[C:Astral Heron][EX:420.5] at a battlefield, the first card each turn makes the next card cost [2][Rune][Rune] less", () => {
    const s = scenario({ p1: { hand: ["Gust", "En Garde"], energy: 9 } });
    place(s, "p1", "Astral Heron", "battlefieldA");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Gust", { choices: { "target:0": friend.id } }).expectOk();
    s.as("p2").pass().expectOk();
    // Gust resolved (the first card played this turn) → Heron's trigger is on the chain.
    expect(s.room.rules!.chain[0]?.cardName).toBe("Astral Heron");
    passBoth(s);
    const garde = s.handCard("p1", "En Garde")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: garde.id })).toEqual([
      expect.objectContaining({ energy: -2, power: { any: -2 } }),
    ]);
    s.as("p1").play("En Garde", { hold: true, choices: { "target:0": s.findBoardCard("Astral Heron")!.id } }).expectOk();
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: garde.id })).toEqual([]);
  });

  it("[C:Astral Heron] does nothing while it is in the base", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 9 } });
    place(s, "p1", "Astral Heron", "base");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").play("Gust", { choices: { "target:0": friend.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Meditation][R356.4.f.1] stays manual (optional additional cost is R2-play's); its effect draws 2 if paid, else 1", () => {
    expect(getCardScript("Meditation")?.status).toBe("manual");
    const s = scenario();
    const effect = (lookupAbility("Meditation", "spell")!.ability as { effect: Parameters<typeof executeEffect>[0] }).effect;
    const before = hand(s, "p1").length;
    executeEffect(effect, { room: s.room, step: stepFor(s), controller: "p1", choices: { additionalCost: true } });
    expect(hand(s, "p1").length).toBe(before + 2);
    executeEffect(effect, { room: s.room, step: stepFor(s), controller: "p1", choices: {} });
    expect(hand(s, "p1").length).toBe(before + 3);
  });

  it("[C:Blade of the Exile][R718.3][R718.4] equipped: the unit gets +3 Might and Ganking", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const blade = place(s, "p1", "Blade of the Exile", "base");
    s.as("p1").apply({ type: "rules_activate", objectId: blade.id, ability: "activated:0", choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.findCard(s.room, blade.id)?.card.attachedToCardId).toBe(unit.id);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
  });

  it("[C:Whiteflame Protector] when played, gives a chosen unit +8 Might this turn", () => {
    const s = scenario({ p1: { hand: ["Whiteflame Protector"] } });
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Whiteflame Protector");
    s.as("p1").play("Whiteflame Protector").expectOk();
    s.expectPrompt("choose-target", "p1");
    s.as("p1").choose({ optionIds: [friend.id] }).expectOk();
    passBoth(s);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(11);
    s.as("p1").endTurn().expectOk();
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(3);
  });

  it("[C:Reckless Innovator] when exhausted, choose one: play a Gold gear token exhausted", () => {
    const s = scenario();
    place(s, "p1", "Reckless Innovator", "base");
    s.as("p1").move("Reckless Innovator", "battlefieldA").expectOk();
    s.expectPrompt("choose-mode", "p1");
    s.as("p1").choose({ optionIds: ["gold"] }).expectOk();
    passBoth(s);
    expect(boardOf(s, "p1").base.find((card) => card.name === "Gold")?.exhausted).toBe(true);
  });

  it("[C:Reckless Innovator][R740.4.a][R445.2] \"Pay [Chaos] to draw 1\" is paid on resolution through R2-play's payment", () => {
    const s = scenario();
    place(s, "p1", "Reckless Innovator", "base");
    const before = hand(s, "p1").length;
    s.as("p1").move("Reckless Innovator", "battlefieldA").expectOk();
    s.as("p1").choose({ optionIds: ["draw"] }).expectOk();
    passBoth(s);
    s.expectPrompt("yes-no", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("445.2");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(hand(s, "p1").length).toBe(before + 1);
    // The [Chaos] came from recycling one of P1's two Chaos Runes (164.2.b).
    expect(boardOf(s, "p1").runeArea).toHaveLength(1);
  });

  it("[C:En Garde][R740.2.a] +1 Might this turn, +1 more if it is the only unit you control there", () => {
    const s = scenario({ p1: { hand: ["En Garde", "En Garde"], energy: 2 } });
    const alone = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const crowdA = place(s, "p1", "Treasure Hunter", "base");
    place(s, "p1", "Stellacorn Herder", "base");
    s.as("p1").play("En Garde", { choices: { "target:0": alone.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, alone.id, s.host)).toBe(5);
    s.as("p1").play("En Garde", { choices: { "target:0": crowdA.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, crowdA.id, s.host)).toBe(2);
  });

  it("[C:Clockwork Keeper][R383.2.a.1][EX:356.4.f.1] draws 1 only if the additional cost was paid", () => {
    const s = scenario({ p1: { hand: ["Clockwork Keeper", "Clockwork Keeper"], energy: 4 } });
    const before = hand(s, "p1").length;
    s.as("p1").play("Clockwork Keeper").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    s.as("p1").play("Clockwork Keeper", { choices: { additionalCost: true } }).expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Clockwork Keeper");
    passBoth(s);
    expect(hand(s, "p1").length).toBe(before - 2 + 1);
  });

  it("[C:Riven, The Exile] units played to a battlefield you control enter ready; to the base exhausted", () => {
    const s = scenario({ p1: { hand: ["Caitlyn, Patrolling", "Stellacorn Herder"] } });
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Caitlyn, Patrolling", "Stellacorn Herder");
    s.as("p1").play("Caitlyn, Patrolling", { location: "battlefieldA" }).expectOk();
    expect(s.findBoardCard("Caitlyn, Patrolling")!.exhausted).toBe(false);
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(s.findBoardCard("Stellacorn Herder")!.exhausted).toBe(true);
  });

  it("[C:Riven, Broken Blade] when she becomes exhausted, choose a mode: buff me", () => {
    const s = scenario();
    const riven = place(s, "p1", "Riven, Broken Blade", "base");
    s.as("p1").move("Riven, Broken Blade", "battlefieldA").expectOk();
    s.expectPrompt("choose-mode", "p1");
    // 355.8: the stun mode has no enemy unit to choose, so it has no legal choices and is not
    // offered; "Buff me" and "ready me" remain.
    expect(s.room.rules!.prompt!.options!.map((option) => option.id)).toEqual(["buff", "ready"]);
    s.as("p1").choose({ optionIds: ["buff"] }).expectOk();
    passBoth(s);
    expect(s.room.rules!.objects[riven.id]?.buffs).toBe(1);
    expect(s.room.rules!.history.effects?.marks?.[`riven-broken-blade:${riven.id}`]).toEqual(["buff"]);
  });

  it("[C:Riven, Broken Blade] a mode chosen this turn is unavailable; spend my buff to ready me", () => {
    const s = scenario();
    const riven = place(s, "p1", "Riven, Broken Blade", "base");
    s.room.rules!.objects[riven.id] = { baseMight: 4, buffs: 1 };
    s.room.rules!.history.effects = { marks: { [`riven-broken-blade:${riven.id}`]: ["buff"] } };
    s.as("p1").move("Riven, Broken Blade", "battlefieldA").expectOk();
    // 355.8: only "ready me" has a legal choice (no enemy unit for the stun mode), so 411.2 binds
    // the forced mode automatically and no mode prompt opens.
    expect(s.room.rules!.prompt ?? null).toBeNull();
    passBoth(s);
    expect(s.room.rules!.objects[riven.id]?.buffs).toBeUndefined();
    expect(s.host.isExhausted(s.room, riven.id)).toBe(false);
    expect(s.room.rules!.history.effects?.marks?.[`riven-broken-blade:${riven.id}`]).toEqual(["buff", "ready"]);
  });

  it("[C:Altar to Unity] when you hold here, play a 1 Might Recruit token in your base", () => {
    const s = scenario();
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules!.turn.player).toBe("p1");
    expect(s.room.rules!.chain[0]?.cardName).toBe("Altar to Unity");
    passBoth(s);
    const recruit = boardOf(s, "p1").base.find((card) => card.name === "Recruit");
    expect(recruit).toBeTruthy();
    expect(effectiveMight(s.room, recruit!.id, s.host)).toBe(1);
  });

  it("[C:Grove of the God-Willow] when you hold here, draw 1", () => {
    const s = scenario({ battlefields: { p1: "Grove of the God-Willow" } });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Grove of the God-Willow");
    const before = hand(s, "p1").length;
    passBoth(s);
    // +1 from the hold trigger, then +1 from the Draw Phase that follows the Scoring Step.
    expect(hand(s, "p1").length).toBe(before + 2);
    expect(s.events().filter((event) => event.type === "draw")).toHaveLength(2);
  });

  it("[C:Back-Alley Bar] a unit that moves from here gets +1 Might this turn", () => {
    const s = scenario({ battlefields: { p1: "Back-Alley Bar" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").move("Caitlyn, Patrolling", "base").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Back-Alley Bar");
    passBoth(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
  });

  it("[C:Fortified Position][R383.4.f] when you defend here, a chosen unit gains [Shield 2] this combat", () => {
    const s = scenario({ firstPlayer: "p2", battlefields: { p1: "Fortified Position" } });
    const defender = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "base");
    s.as("p2").move("Stellacorn Herder", "battlefieldA").expectOk();
    // Stellacorn's own move trigger and the defend trigger: resolve until the Shield prompt.
    for (let guard = 0; guard < 10 && !s.room.rules!.prompt; guard += 1) {
      const who = s.room.rules!.priority;
      if (!who) break;
      s.as(who).pass();
    }
    s.expectPrompt("choose-target", "p1");
    s.as("p1").choose({ optionIds: [defender.id] }).expectOk();
    for (let guard = 0; guard < 10; guard += 1) {
      const item = s.room.rules!.chain.find((entry) => entry.cardName === "Fortified Position");
      if (!item) break;
      const who = s.room.rules!.priority;
      if (!who) break;
      s.as(who).pass();
    }
    expect(effectiveKeywordValues(s.room, defender.id, s.host).shield).toBe(2);
  });

  it("[C:Aspirant's Climb] increases the points needed to win by 1 (exposed for the victory check)", () => {
    const s = scenario({ battlefields: { p1: "Aspirant's Climb", p2: "Bandle Tree" } });
    expect(victoryScoreAdjustment(s.room, s.host)).toBe(1);
    const other = scenario({ battlefields: { p2: "Grove of the God-Willow" } });
    expect(victoryScoreAdjustment(other.room, other.host)).toBe(0);
  });

  it("[C:Bandle Tree] exposes one additional hidden card slot for R2-play", () => {
    const s = scenario({ battlefields: { p1: "Bandle Tree" } });
    expect(activeModifiers(s.room, s.host).some((m) => m.modifier.kind === "hide-limit")).toBe(true);
  });
});
