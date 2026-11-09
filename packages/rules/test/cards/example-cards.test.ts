/**
 * Card scripts for cards named in the official examples (each test cites the card and, where it
 * reproduces the example, the example's rule id).
 */
import { describe, expect, it } from "vitest";
import {
  combatMight,
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
  registerActionInterceptor,
  requiredChoices,
  lookupAbility,
  registerCardScript,
  xpOf,
} from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, fund, place, run, spell, zoneOf } from "../rules/effects/helpers";

type S = ReturnType<typeof scenario>;

function passBoth(s: S, first = "p1"): void {
  s.as(first).pass().expectOk();
  s.as(first === "p1" ? "p2" : "p1").pass().expectOk();
}

function withCards(p1: string[], p2: string[] = [], extra: Parameters<typeof scenario>[0] = {}): S {
  const s = scenario({ ...extra, extraCards: { p1, p2 } });
  // Extra cards sit on top of the deck and may already be in the opening hand.
  for (const [player, names] of [["p1", p1], ["p2", p2]] as const) {
    const wanted: Record<string, number> = {};
    for (const name of names) wanted[name] = (wanted[name] ?? 0) + 1;
    for (const [name, count] of Object.entries(wanted)) {
      const inHand = boardOf(s, player).hand.filter((card) => card.name === name).length;
      for (let index = inHand; index < count; index += 1) s.moveDeckCardToHand(player, name);
    }
  }
  return s;
}

describe("cards from the official examples", () => {
  it("[C:Void Seeker][EX:359.3.e.5] deals 4 to a unit at a battlefield and draws 1", () => {
    const s = withCards(["Void Seeker"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Void Seeker");
    s.as("p1").play("Void Seeker", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 1);
  });

  it("[C:Hidden Blade][EX:359.3.e.14] kills a unit at a battlefield; its controller draws 2", () => {
    const s = withCards(["Hidden Blade"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const before = boardOf(s, "p2").hand.length;
    fund(s, "p1", "Hidden Blade");
    s.as("p1").play("Hidden Blade", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(boardOf(s, "p2").hand.length).toBe(before + 2);
    expect(getCardScript("Hidden Blade")?.status).toBe("partial");
  });

  it("[C:Flash] moves up to 2 friendly units to base", () => {
    const s = withCards(["Flash"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const ability = lookupAbility("Flash", "spell")!.ability;
    expect(requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} })[0]).toMatchObject({ min: 0, max: 2 });
    fund(s, "p1", "Flash");
    s.as("p1").play("Flash", { choices: { "target:0": [a.id, b.id] } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, a.id)).toBe("base");
    expect(zoneOf(s, b.id)).toBe("base");
  });

  it("[C:Singularity][EX:359.3.e.8] deals 6 to each of up to two units, even if one target is gone", () => {
    const s = withCards(["Singularity"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Singularity");
    s.as("p1").play("Singularity", { choices: { "target:0": [a.id, b.id] } }).expectOk();
    s.host.moveCardToOwnerZone(s.room, b.id, "hand");
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(6);
  });

  it("[C:Annie, Fiery][C:Singularity][EX:715.2] Annie's Bonus Damage makes Singularity deal 7 to each", () => {
    const s = withCards(["Singularity", "Annie, Fiery"]);
    place(s, "p1", "Annie, Fiery", "base");
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Singularity");
    s.as("p1").play("Singularity", { choices: { "target:0": [a.id, b.id] } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(7);
    expect(zoneOf(s, b.id)).toBe("trash");
  });

  it("[C:Zhonya's Hourglass][EX:369.1] replaces a friendly unit's death: heal, exhaust, recall", () => {
    const s = withCards(["Hextech Ray"], ["Zhonya's Hourglass"]);
    const unit = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const zhonya = place(s, "p2", "Zhonya's Hourglass", "base");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
    expect(zoneOf(s, zhonya.id)).toBe("trash");
  });

  it("[C:Noxian Guillotine][EX:392] kills the chosen unit the next time it takes damage this turn", () => {
    const s = withCards(["Noxian Guillotine", "Hextech Ray"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Noxian Guillotine");
    s.as("p1").play("Noxian Guillotine", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    passBoth(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Noxian Guillotine] [Legion]: kill it now instead when another card was played this turn", () => {
    const s = withCards(["Hextech Ray", "Noxian Guillotine"]);
    const other = place(s, "p2", "Astral Heron", "battlefieldA");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": other.id } }).expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Noxian Guillotine");
    s.as("p1").play("Noxian Guillotine", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Ravenborn Tome][EX:392] [Tap]: the next spell you play this turn deals 1 Bonus Damage", () => {
    const s = withCards(["Ravenborn Tome", "Hextech Ray", "Void Seeker"]);
    const tome = place(s, "p1", "Ravenborn Tome", "base");
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    s.as("p1").apply({ type: "rules_activate", objectId: tome.id, ability: listActivatedAbilities("Ravenborn Tome")[0]!.ref }).expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": a.id } }).expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Void Seeker");
    s.as("p1").play("Void Seeker", { choices: { "target:0": b.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(4);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(4);
  });

  it("[C:Last Stand][EX:433.1.a] doubles a friendly unit's Might this turn and gives it Temporary", () => {
    const s = withCards(["Last Stand"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { baseMight: 3 };
    fund(s, "p1", "Last Stand");
    s.as("p1").play("Last Stand", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    // P1's Beginning Phase: the Temporary trigger kills it before scoring.
    passBoth(s);
    expect(zoneOf(s, unit.id)).toBe("trash");
  });

  it("[C:Last Stand][C:Eclipse][EX:258][R479.4.c][R143.2.c.1] doubling a -2 Might unit increases it by 0: it stays -2", () => {
    const s = withCards(["Last Stand"], ["Eclipse"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { baseMight: 2 };
    fund(s, "p1", "Last Stand");
    s.as("p1").play("Last Stand", { choices: { "target:0": unit.id } }).expectOk();
    // In reaction, the opponent's Eclipse gives it -4 this turn (then Predict, answered below).
    fund(s, "p2", "Eclipse");
    s.as("p2").play("Eclipse", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p1").pass().expectOk();
    // Eclipse resolved: 2 - 4 = -2 (then its Predict prompt).
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(-2);
    for (let guard = 0; guard < 6 && s.room.rules!.chain.length > 0; guard += 1) {
      const prompt = s.room.rules!.prompt;
      if (prompt) s.as(prompt.playerId).choose({ optionIds: [] }).expectOk();
      else s.as(s.room.rules!.priority!).pass().expectOk();
    }
    expect(s.room.rules!.chain).toHaveLength(0);
    // Last Stand resolved: "double" increases by the current Might, -2 → by 0 (479.4.c).
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(-2);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
    // 143.2.c: referenced or summed for combat damage it counts as 0.
    expect(combatMight(s.room, unit.id, s.host)).toBe(0);
  });

  it("[C:Discipline][C:Feral Strength][C:Frigid Touch] +2 and draw / +2 / -2 Might this turn", () => {
    const s = withCards(["Discipline", "Feral Strength", "Frigid Touch"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Discipline");
    s.as("p1").play("Discipline", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 1);
    fund(s, "p1", "Feral Strength");
    s.as("p1").play("Feral Strength", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Frigid Touch");
    s.as("p1").play("Frigid Touch", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    expect(getCardScript("Frigid Touch")?.status).toBe("partial");
  });

  it("[C:Falling Star] deals 3 to a unit and 3 to a unit (two separate targets)", () => {
    const s = withCards(["Falling Star"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "base");
    fund(s, "p1", "Falling Star");
    s.as("p1").play("Falling Star", { choices: { "target:0": a.id, "target:1": b.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(3);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(3);
  });

  it("[C:Eclipse] gives a unit -4 Might this turn, then Predict", () => {
    const s = withCards(["Eclipse"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Eclipse");
    s.as("p1").play("Eclipse", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(3);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
  });

  it("[C:Hextech Ray][EX:418.1.e.1] prevented damage that leaves nothing is not dealt", () => {
    const s = withCards(["Hextech Ray"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    run(s, { op: "prevent", amount: 3, target: { targetRef: "obj:" + enemy.id } }, { controller: "p2" });
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBeUndefined();
  });

  it("[C:Ride the Wind] moves a friendly unit and readies it", () => {
    const s = withCards(["Ride the Wind"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    fund(s, "p1", "Ride the Wind");
    s.as("p1").play("Ride the Wind", { choices: { "target:0": unit.id, destination: "battlefieldB" } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("battlefieldB");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
  });

  it("[C:Ride the Wind][EX:359.3.e.14.b] a negated move does not stop the ready", () => {
    const s = withCards(["Ride the Wind"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA", { exhausted: true });
    const stop = registerActionInterceptor((_room, _step, proposal) => (proposal.type === "move" ? null : proposal));
    try {
      fund(s, "p1", "Ride the Wind");
      s.as("p1").play("Ride the Wind", { choices: { "target:0": unit.id, destination: "base" } }).expectOk();
      s.as("p2").pass().expectOk();
    } finally {
      stop();
    }
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
  });

  it("[C:Retreat] returns a friendly unit to its owner's hand; its owner channels 1 rune exhausted", () => {
    const s = withCards(["Retreat"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const runes = boardOf(s, "p1").runeArea.length;
    fund(s, "p1", "Retreat");
    s.as("p1").play("Retreat", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("hand");
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
  });

  it("[C:Challenge][EX:418.6.b.3][EX:418.6.b.4] the chosen units deal damage equal to their Mights to each other", () => {
    const s = withCards(["Challenge"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Challenge");
    s.as("p1").play("Challenge", { choices: { "target:0": mine.id, "target:1": theirs.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(s.room.rules!.objects[theirs.id]?.damage).toBe(3);
    const damage = s.events().filter((event) => event.type === "damage");
    expect(damage.map((event) => event.sourceObjectId).sort()).toEqual([mine.id, theirs.id].sort());
  });

  it("[C:Deathgrip][EX:359.3.e.14.b] kills a friendly unit; if it did, another friendly unit gets its Might; draw 1", () => {
    const s = withCards(["Deathgrip"]);
    const victim = place(s, "p1", "Astral Heron", "base");
    const other = place(s, "p1", "Caitlyn, Patrolling", "base");
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Deathgrip");
    s.as("p1").play("Deathgrip", { choices: { "target:0": victim.id, "target:1": other.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(effectiveMight(s.room, other.id, s.host)).toBe(10);
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 1);
  });

  it("[C:Stupefy][R479.4.b] -1 Might to a minimum of 1 (no change on a 1 Might unit); draw 1", () => {
    const s = withCards(["Stupefy", "Stupefy"]);
    const one = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const three = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Stupefy");
    s.as("p1").play("Stupefy", { choices: { "target:0": one.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, one.id, s.host)).toBe(1);
    fund(s, "p1", "Stupefy");
    s.as("p1").play("Stupefy", { choices: { "target:0": three.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, three.id, s.host)).toBe(2);
  });

  it("[C:Eclipse Herald][EX:424.1.a.1] when you stun an enemy unit, ready me and give me +1 Might this turn", () => {
    const original = getCardScript("Rebuke")!;
    registerCardScript(spell("Rebuke", { op: "stun", target: { chosen: true, cardType: "unit" } }));
    try {
      const s = withCards(["Eclipse Herald"]);
      s.moveDeckCardToHand("p1", "Rebuke");
      const herald = place(s, "p1", "Eclipse Herald", "base", { exhausted: true });
      s.room.rules!.objects[herald.id] = { baseMight: 7 };
      const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
      fund(s, "p1", "Rebuke");
      s.as("p1").play("Rebuke", { choices: { "target:0": enemy.id } }).expectOk();
      s.as("p2").pass().expectOk();
      expect(s.room.rules!.chain[0]?.cardName).toBe("Eclipse Herald");
      passBoth(s);
      expect(s.host.isExhausted(s.room, herald.id)).toBe(false);
      expect(effectiveMight(s.room, herald.id, s.host)).toBe(8);
    } finally {
      registerCardScript(original);
    }
  });

  it("[C:Viktor, Leader][EX:383.2.c.2] another non-Recruit unit dies → play a Recruit; a Recruit dying does not", () => {
    const s = withCards(["Hextech Ray", "Hextech Ray"], ["Viktor, Leader"]);
    place(s, "p2", "Viktor, Leader", "base");
    const friend = place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": friend.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Viktor, Leader");
    passBoth(s, "p2");
    const recruit = boardOf(s, "p2").base.find((card) => card.name === "Recruit")!;
    expect(recruit).toBeTruthy();
    s.host.moveCard(s.room, "p2", "base", "battlefieldA", recruit.id);
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": recruit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Wraith of Echoes][EX:383.1.b] the first time another friendly unit dies each turn, draw 1", () => {
    const s = withCards(["Hextech Ray", "Hextech Ray"], ["Wraith of Echoes"]);
    place(s, "p2", "Wraith of Echoes", "base");
    const a = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const b = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": a.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(1);
    passBoth(s, "p2");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": b.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Undercover Agent][EX:423.4] [Deathknell]: discard 2, then draw 2", () => {
    const s = withCards(["Hidden Blade"], ["Undercover Agent"]);
    const agent = place(s, "p2", "Undercover Agent", "battlefieldA");
    const hand = boardOf(s, "p2").hand;
    hand.splice(0, hand.length);
    hand.push(boardOf(s, "p2").deck.pop()!);
    fund(s, "p1", "Hidden Blade");
    s.as("p1").play("Hidden Blade", { choices: { "target:0": agent.id } }).expectOk();
    s.as("p2").pass().expectOk();
    // Hidden Blade: its controller draws 2 → 3 cards; Deathknell: discard 2 (choose), draw 2.
    passBoth(s, "p2");
    s.expectPrompt("choose-card", "p2");
    const pick = s.room.rules!.prompt!.options!.slice(0, 2).map((option) => option.id);
    s.as("p2").choose({ optionIds: pick }).expectOk();
    expect(boardOf(s, "p2").hand).toHaveLength(3);
    expect(boardOf(s, "p2").trash.filter((card) => pick.includes(card.id))).toHaveLength(2);
  });

  it("[C:Sona, Harmonious][EX:383.2.a.1] at the end of your turn, if at a battlefield, ready up to 4 friendly runes", () => {
    const s = withCards(["Sona, Harmonious"]);
    place(s, "p1", "Sona, Harmonious", "battlefieldA");
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.as("p1").endTurn().expectOk();
    s.expectPrompt("choose-target", "p1");
    expect(s.room.rules!.prompt!.max).toBe(Math.min(4, boardOf(s, "p1").runeArea.length));
    const pick = s.room.rules!.prompt!.options!.slice(0, 2).map((option) => option.id);
    s.as("p1").choose({ optionIds: pick }).expectOk();
    passBoth(s);
    for (const id of pick) expect(s.host.isExhausted(s.room, id)).toBe(false);
  });

  it("[C:Dr. Mundo, Expert][EX:417.6] Might + cards in your trash; recycles 3 from the trash at the start of your Beginning Phase", () => {
    const s = withCards(["Dr. Mundo, Expert"]);
    const mundo = place(s, "p1", "Dr. Mundo, Expert", "base");
    s.room.rules!.objects[mundo.id] = { baseMight: 6 };
    const board = boardOf(s, "p1");
    board.trash.push(...board.deck.splice(0, 4));
    expect(effectiveMight(s.room, mundo.id, s.host)).toBe(10);
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Dr. Mundo, Expert");
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    s.as("p1").choose({ optionIds: s.room.rules!.prompt!.options!.slice(0, 3).map((option) => option.id) }).expectOk();
    expect(boardOf(s, "p1").trash).toHaveLength(1);
    expect(effectiveMight(s.room, mundo.id, s.host)).toBe(7);
  });

  it("[C:Ultrasoft Poro][EX:377.2.b] [Tap]: play two 1 Might Birds with Deflect — only while at a battlefield", () => {
    const s = withCards(["Ultrasoft Poro"]);
    const poro = place(s, "p1", "Ultrasoft Poro", "battlefieldA");
    s.as("p1").apply({ type: "rules_activate", objectId: poro.id, ability: "activated:0" }).expectOk();
    s.as("p2").pass().expectOk();
    const birds = boardOf(s, "p1").base.filter((card) => card.name === "Bird");
    expect(birds).toHaveLength(2);
    expect(effectiveKeywords(s.room, birds[0]!.id, s.host)).toContain("Deflect");
    expect(effectiveMight(s.room, birds[0]!.id, s.host)).toBe(1);
  });

  it("[C:Clanging Sentry][EX:831.2] your Mechs have Disarm; two Sentries give Disarm 2", () => {
    const s = withCards(["Clanging Sentry", "Clanging Sentry"]);
    const first = place(s, "p1", "Clanging Sentry", "base");
    expect(effectiveKeywordValues(s.room, first.id, s.host).disarm).toBe(1);
    place(s, "p1", "Clanging Sentry", "base");
    expect(effectiveKeywordValues(s.room, first.id, s.host).disarm).toBe(2);
  });

  it("[C:Ruin Runner][EX:757.1] can't be chosen by enemy spells and abilities", () => {
    const s = withCards(["Hextech Ray"], ["Ruin Runner"]);
    const runner = place(s, "p2", "Ruin Runner", "battlefieldA");
    const ability = lookupAbility("Hextech Ray", "spell")!.ability;
    expect(requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} })[0]!.options.map((o) => o.id)).not.toContain(runner.id);
    expect(requiredChoices(s.room, s.host, ability, { controller: "p2", choices: {} })[0]!.options.map((o) => o.id)).toContain(runner.id);
  });

  it("[C:Master Yi, Honed][EX:369.3] I enter ready", () => {
    const s = withCards(["Master Yi, Honed"]);
    fund(s, "p1", "Master Yi, Honed");
    s.as("p1").play("Master Yi, Honed").expectOk();
    expect(s.findBoardCard("Master Yi, Honed")!.exhausted).toBe(false);
  });

  it("[C:Gustwalker][EX:727.1.b.2] [Level 3]: +1 Might while you have 3 XP; [Hunt 2] value", () => {
    const s = withCards(["Gustwalker"]);
    const unit = place(s, "p1", "Gustwalker", "base");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).hunt).toBe(2);
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Ganking");
    run(s, { op: "gain_xp", amount: 3 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
    expect(xpOf(s.room, "p1")).toBe(3);
  });

  it("[C:Noxus Hopeful][EX:727.1][R366.2.a] [Legion]: I cost [2] less after another card this turn", () => {
    const s = withCards(["Noxus Hopeful", "Hextech Ray"]);
    const hopeful = s.handCard("p1", "Noxus Hopeful")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: hopeful.id })).toEqual([]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1").play("Hextech Ray", { choices: { "target:0": enemy.id } }).expectOk();
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: hopeful.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
  });
});
