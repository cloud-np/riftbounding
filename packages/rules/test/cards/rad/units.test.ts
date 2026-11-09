/**
 * RAD units with triggered, activated or conditional abilities (wave R3).
 */
import { describe, expect, it } from "vitest";
import {
  combatContribution,
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
} from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import {
  answer,
  drain,
  namesIn,
  put,
  resolveAll,
  settle,
  withCards,
  withDeck,
  type S,
} from "./helpers";

function activate(
  s: S,
  player: string,
  id: string,
  index = 0,
  extra: Record<string, unknown> = {},
): void {
  const name = s.host.findCard(s.room, id)!.card.name;
  const ref = listActivatedAbilities(name)[index]!.ref;
  s.as(player)
    .apply({ type: "rules_activate", objectId: id, ability: ref, ...extra } as never)
    .expectOk();
}

/** A unit at p1's base with its rules object (as a played unit has). */
function unit(s: S, player: string, name: string, zone: string, might: number, exhausted = false) {
  const card = put(s, player, name, zone, exhausted);
  s.room.rules!.objects[card.id] = { ...(s.room.rules!.objects[card.id] ?? {}), baseMight: might };
  return card;
}

/** Step through prompts (first option / "yes") and passes until `done` holds or nothing is pending. */
function drive(s: S, done: () => boolean, guard = 30): void {
  for (let index = 0; index < guard && !done(); index += 1) {
    const rules = s.room.rules!;
    if (rules.prompt) {
      const first = rules.prompt.options?.[0]?.id ?? "yes";
      s.as(rules.prompt.playerId)
        .choose({ optionIds: [first] })
        .expectOk();
      continue;
    }
    const holder = rules.priority ?? rules.focus;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
}

describe("RAD units with abilities", () => {
  it("[C:Ahri, Confident][R412.4][R479.4] reducing an enemy unit's Might here gives me +1 this turn", () => {
    const away = withCards(["Frigid Touch", "Ahri, Confident"]);
    const lonely = unit(away, "p1", "Ahri, Confident", "battlefieldA", 4);
    const far = unit(away, "p2", "Stellacorn Herder", "battlefieldB", 3);
    fund(away, "p1", "Frigid Touch");
    away
      .as("p1")
      .play("Frigid Touch", { choices: { "target:0": far.id } })
      .expectOk();
    away.as("p2").pass().expectOk();
    expect(away.room.rules!.chain).toHaveLength(0);
    expect(effectiveMight(away.room, lonely.id, away.host)).toBe(4);

    const s = withCards(["Frigid Touch", "Ahri, Confident"]);
    const ahri = unit(s, "p1", "Ahri, Confident", "battlefieldA", 4);
    const here = unit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", 3);
    fund(s, "p1", "Frigid Touch");
    s.as("p1")
      .play("Frigid Touch", { choices: { "target:0": here.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, here.id, s.host)).toBe(1);
    expect(s.room.rules!.chain[0]?.cardName).toBe("Ahri, Confident");
    s.as(s.room.rules!.priority!).pass().expectOk();
    s.as(s.room.rules!.priority!).pass().expectOk();
    expect(effectiveMight(s.room, ahri.id, s.host)).toBe(5);
  });

  it("[C:Angler Wyrm][R355.18][R421] [Tap]: the opponent must move a unit they control to my battlefield", () => {
    const s = withDeck(["Angler Wyrm"]);
    const wyrm = unit(s, "p1", "Angler Wyrm", "battlefieldA", 8);
    const victim = unit(s, "p2", "Treasure Hunter", "base", 1);
    activate(s, "p1", wyrm.id);
    settle(s);
    expect(zoneOf(s, victim.id)).toBe("battlefieldA");
  });

  it("[C:Armored Tusker][R814.2] When I move, you may deal damage equal to my Shield to a unit at a battlefield", () => {
    const s = withDeck(["Armored Tusker"]);
    unit(s, "p1", "Armored Tusker", "base", 4);
    const enemy = unit(s, "p2", "Astral Heron", "battlefieldB", 7);
    s.as("p1").move("Armored Tusker", "battlefieldA").expectOk();
    settle(s);
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [enemy.id]);
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    resolveAll(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(3);
  });

  it("[C:Battlefield Armorer][R383.2.c.3.b][R740.4.a] a friendly gear dies at a battlefield: pay [1] to return it", () => {
    const s = withCards(["Lost to the Sands"], ["Battlefield Armorer", "Banner of Conquest"]);
    unit(s, "p2", "Battlefield Armorer", "base", 3);
    // A Deploy gear stays at the battlefield (other unattached gear is recalled in cleanups).
    const gear = put(s, "p2", "Banner of Conquest", "battlefieldA");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "kill", "target:1": gear.id } })
      .expectOk();
    s.room.rules!.pools.p2 = { energy: 1, power: {} };
    s.as("p2").pass().expectOk();
    drive(s, () => zoneOf(s, gear.id) === "hand");
    expect(zoneOf(s, gear.id)).toBe("hand");
  });

  it("[C:Bedeviling Stranger][R355.7][R053.3] choose a battlefield with 4+ units: you may return an enemy unit there", () => {
    const s = withCards(["Bedeviling Stranger"]);
    unit(s, "p1", "Treasure Hunter", "battlefieldA", 1);
    unit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", 3);
    const enemy = unit(s, "p2", "Astral Heron", "battlefieldA", 7);
    unit(s, "p2", "Treasure Hunter", "battlefieldA", 1);
    fund(s, "p1", "Bedeviling Stranger");
    s.as("p1").play("Bedeviling Stranger").expectOk();
    settle(s);
    answer(s, ["battlefield:battlefieldA"]);
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [enemy.id]);
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    resolveAll(s);
    expect(zoneOf(s, enemy.id)).toBe("hand");
  });

  it("[C:Coalesced Energy][R417][R431.2.a] at the end of your turn, recycle all your runes, then channel 4 exhausted", () => {
    const s = withDeck(["Coalesced Energy"]);
    unit(s, "p1", "Coalesced Energy", "base", 4);
    const before = boardOf(s, "p1").runeArea.map((rune) => rune.id);
    s.as("p1").endTurn().expectOk();
    drive(s, () => s.room.rules!.turn.player === "p2" && s.room.rules!.chain.length === 0, 10);
    const area = boardOf(s, "p1").runeArea;
    expect(area).toHaveLength(4);
    expect(area.every((rune) => rune.exhausted)).toBe(true);
    expect(area.some((rune) => before.includes(rune.id))).toBe(false);
  });

  it("[C:Ekko, Revolutionary][R369.3][R428][R420.3] enters ready; [Action] discard 1, [1][Fury]: banish me, play me to base", () => {
    const s = withCards(["Ekko, Revolutionary", "Gust"]);
    fund(s, "p1", "Ekko, Revolutionary");
    s.as("p1").play("Ekko, Revolutionary").expectOk();
    resolveAll(s);
    const ekko = s.findBoardCardAnywhere("Ekko, Revolutionary")!;
    expect(s.host.isExhausted(s.room, ekko.id)).toBe(false);
    expect(effectiveKeywords(s.room, ekko.id, s.host)).not.toContain("Action");
    s.host.setExhausted(s.room, ekko.id, true);
    s.room.rules!.pools.p1 = { energy: 1, power: { Fury: 1 } };
    activate(s, "p1", ekko.id);
    resolveAll(s);
    expect(zoneOf(s, ekko.id)).toBe("base");
    expect(s.host.isExhausted(s.room, ekko.id)).toBe(false);
    expect(namesIn(s, "p1", "trash")).toContain("Gust");
  });

  it("[C:Evelynn, in Control][C:Evelynn in Control][R383.4.d.2.a][R470.2] When I hold with a facedown card here, score 1", () => {
    // RAD-SP3 ("Evelynn in Control") prints the same text; the catalog resolves it to RAD-109's card.
    expect(getCardScript("Evelynn in Control")?.abilities).toEqual(
      getCardScript("Evelynn, in Control")?.abilities,
    );
    const s = withDeck(["Evelynn, in Control", "Gust"]);
    unit(s, "p1", "Evelynn, in Control", "battlefieldB", 4);
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    const hidden = put(s, "p1", "Gust", "battlefieldB");
    boardOf(s, "p1").battlefieldB!.find((card) => card.id === hidden.id)!.hidden = true;
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    // 1 point for holding battlefieldB + 1 from Evelynn.
    s.expectScore("p1", 2);
  });

  it("[C:Graves, Blasting Through][R383.4.e][R424.1.b] When I attack, deal my Might to all enemy units here; no combat damage", () => {
    const s = withDeck(["Graves, Blasting Through"]);
    const graves = unit(s, "p1", "Graves, Blasting Through", "base", 4);
    const a = unit(s, "p2", "Treasure Hunter", "battlefieldA", 1);
    const b = unit(s, "p2", "Astral Heron", "battlefieldA", 7);
    s.room.rules!.objects["battlefieldA"] = { controller: "p2" };
    expect(combatContribution(s.room, graves.id, s.host)).toBe(0);
    s.as("p1").move("Graves, Blasting Through", "battlefieldA").expectOk();
    drive(s, () => zoneOf(s, a.id) === "trash");
    expect(zoneOf(s, a.id)).toBe("trash");
    expect(s.room.rules!.objects[b.id]?.damage ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("[C:Heartening Soul] partial: When you play me, ready a friendly legend", () => {
    const s = withCards(["Heartening Soul"]);
    const legend = boardOf(s, "p1").legend[0]!;
    s.host.setExhausted(s.room, legend.id, true);
    fund(s, "p1", "Heartening Soul");
    s.as("p1").play("Heartening Soul").expectOk();
    resolveAll(s);
    expect(s.host.isExhausted(s.room, legend.id)).toBe(false);
    expect(getCardScript("Heartening Soul")?.status).toBe("partial");
  });

  it("[C:Iridescent Avian][R427][R702.3] [Tap]: buff a unit; if already buffed, +2 Might this turn instead", () => {
    const s = withDeck(["Iridescent Avian"]);
    const avian = unit(s, "p1", "Iridescent Avian", "base", 3);
    const target = unit(s, "p1", "Caitlyn, Patrolling", "base", 3);
    activate(s, "p1", avian.id, 0, { choices: { "target:0": target.id } });
    resolveAll(s);
    expect(s.room.rules!.objects[target.id]?.buffs).toBe(1);
    expect(effectiveMight(s.room, target.id, s.host)).toBe(4);
    s.host.setExhausted(s.room, avian.id, false);
    activate(s, "p1", avian.id, 0, { choices: { "target:0": target.id } });
    resolveAll(s);
    expect(s.room.rules!.objects[target.id]?.buffs).toBe(1);
    expect(effectiveMight(s.room, target.id, s.host)).toBe(6);
  });

  it("[C:Jarvan IV, Exemplar of Demacia][R383.3.b] play a Deploy gear: exhaust me and pay [A] to move a friendly unit there", () => {
    const s = withCards(["Banner of Conquest", "Jarvan IV, Exemplar of Demacia"]);
    const jarvan = put(s, "p1", "Jarvan IV, Exemplar of Demacia", "legend");
    const mover = unit(s, "p1", "Caitlyn, Patrolling", "base", 3);
    fund(s, "p1", "Banner of Conquest");
    s.room.rules!.pools.p1!.power = { ...s.room.rules!.pools.p1!.power, Calm: 1 };
    s.as("p1").play("Banner of Conquest", { location: "battlefieldB" }).expectOk();
    drive(s, () => zoneOf(s, mover.id) === "battlefieldB");
    expect(zoneOf(s, mover.id)).toBe("battlefieldB");
    expect(s.host.isExhausted(s.room, jarvan.id)).toBe(true);
  });

  it("[C:Jarvan IV, Martial Paragon][R383.4.c.2.a] partial: When I conquer with a friendly Deploy gear here, channel 1 exhausted", () => {
    const s = withDeck(["Jarvan IV, Martial Paragon", "Banner of Conquest"]);
    unit(s, "p1", "Jarvan IV, Martial Paragon", "base", 4);
    put(s, "p1", "Banner of Conquest", "battlefieldA");
    const runes = boardOf(s, "p1").runeArea.length;
    s.as("p1").move("Jarvan IV, Martial Paragon", "battlefieldA").expectOk();
    resolveAll(s);
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(runes + 1);
    expect(area.at(-1)!.exhausted).toBe(true);
    expect(getCardScript("Jarvan IV, Martial Paragon")?.status).toBe("partial");
  });

  it("[C:Jarvan IV, Royal Heir][R383.4.e] When I attack, you may move a unit you control to my battlefield", () => {
    const s = withDeck(["Jarvan IV, Royal Heir"]);
    unit(s, "p1", "Jarvan IV, Royal Heir", "base", 7);
    const ally = unit(s, "p1", "Caitlyn, Patrolling", "base", 3);
    unit(s, "p2", "Treasure Hunter", "battlefieldA", 1);
    s.room.rules!.objects["battlefieldA"] = { controller: "p2" };
    s.as("p1").move("Jarvan IV, Royal Heir", "battlefieldA").expectOk();
    drive(s, () => zoneOf(s, ally.id) === "battlefieldA");
    expect(zoneOf(s, ally.id)).toBe("battlefieldA");
  });

  it("[C:K'Sante, Dauntless][R433][R814.2] When I attack, double the Shield of a unit you control here", () => {
    const s = withDeck(["K'Sante, Dauntless"]);
    const ksante = unit(s, "p1", "K'Sante, Dauntless", "base", 4);
    unit(s, "p2", "Treasure Hunter", "battlefieldA", 1);
    s.room.rules!.objects["battlefieldA"] = { controller: "p2" };
    s.as("p1").move("K'Sante, Dauntless", "battlefieldA").expectOk();
    drive(s, () => (effectiveKeywordValues(s.room, ksante.id, s.host).shield ?? 0) >= 2);
    expect(effectiveKeywordValues(s.room, ksante.id, s.host).shield).toBe(2);
  });

  it("[C:Momentary Companion][R816] gains Temporary only when played on an opponent's turn; it has no printed Temporary", () => {
    const s = withCards(["Momentary Companion"]);
    fund(s, "p1", "Momentary Companion");
    s.as("p1").play("Momentary Companion").expectOk();
    resolveAll(s);
    const companion = s.findBoardCardAnywhere("Momentary Companion")!;
    expect(effectiveKeywords(s.room, companion.id, s.host)).not.toContain("Temporary");
  });

  it("[C:Mordekaiser, Dominating][R740.4.a][R423] When you play me, you may discard 1 to kill a unit or gear", () => {
    const s = withCards(["Mordekaiser, Dominating", "Gust"]);
    const gear = put(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Mordekaiser, Dominating");
    s.as("p1").play("Mordekaiser, Dominating").expectOk();
    drive(
      s,
      () => zoneOf(s, gear.id) === "trash" || s.room.rules!.prompt?.kind === "choose-target",
    );
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [gear.id]);
    drive(s, () => zoneOf(s, gear.id) === "trash");
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(namesIn(s, "p1", "trash")).toContain("Gust");
  });

  it("[C:Overloaded Traveler][R364.3.a] +1 Might while a friendly Deploy gear is at my battlefield", () => {
    const s = withDeck(["Overloaded Traveler", "Banner of Conquest"]);
    const traveler = unit(s, "p1", "Overloaded Traveler", "battlefieldA", 2);
    expect(effectiveMight(s.room, traveler.id, s.host)).toBe(2);
    expect(effectiveKeywords(s.room, traveler.id, s.host)).not.toContain("Deploy");
    put(s, "p1", "Banner of Conquest", "battlefieldA");
    expect(effectiveMight(s.room, traveler.id, s.host)).toBe(3);
  });

  it("[C:Party Crasher][R356.4][R366.2.a] costs [1] less for each exhausted unit you control", () => {
    const s = withCards(["Party Crasher"]);
    const crasher = s.handCard("p1", "Party Crasher")!;
    unit(s, "p1", "Treasure Hunter", "base", 1, true);
    unit(s, "p1", "Caitlyn, Patrolling", "base", 3, true);
    unit(s, "p1", "Stellacorn Herder", "base", 3);
    const total = costAdjustments(s.room, s.host, { playerId: "p1", cardId: crasher.id }).reduce(
      (sum, entry) => sum + (entry.energy ?? 0),
      0,
    );
    expect(total).toBe(-2);
    drain(s, "p1");
    s.room.rules!.pools.p1 = { energy: 7, power: { Order: 1 } };
    s.as("p1").play("Party Crasher").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Raving Witness][R425][R710] When I move, reveal the top card: draw it if Mighty, else recycle it", () => {
    const s = withDeck(["Raving Witness"]);
    unit(s, "p1", "Raving Witness", "base", 3);
    const deck = boardOf(s, "p1").deck;
    const heron = deck.splice(
      deck.findIndex((card) => card.name === "Astral Heron"),
      1,
    )[0]!;
    deck.push(heron);
    s.as("p1").move("Raving Witness", "battlefieldA").expectOk();
    resolveAll(s);
    expect(zoneOf(s, heron.id)).toBe("hand");
  });

  it("[C:Riven, Deserter][R415][R377.1] +1 when another friendly unit becomes exhausted; exhaust a friendly unit: ready a unit (once a turn)", () => {
    const s = withDeck(["Riven, Deserter"]);
    const riven = unit(s, "p1", "Riven, Deserter", "base", 5);
    const fodder = unit(s, "p1", "Treasure Hunter", "base", 1);
    const tired = unit(s, "p1", "Caitlyn, Patrolling", "base", 3, true);
    activate(s, "p1", riven.id, 0, {
      choices: { "target:0": tired.id },
      plan: { exhaust: [fodder.id] },
    });
    resolveAll(s);
    expect(s.host.isExhausted(s.room, tired.id)).toBe(false);
    expect(effectiveMight(s.room, riven.id, s.host)).toBe(6);
    const ref = listActivatedAbilities("Riven, Deserter")[0]!.ref;
    s.as("p1").apply({
      type: "rules_activate",
      objectId: riven.id,
      ability: ref,
      choices: { "target:0": fodder.id },
    } as never);
    expect(s.lastError()).not.toBeNull();
  });

  it("[C:Sanctum Conservator][R420.4.a] When you play a card with Energy cost 7 or more, ready me", () => {
    const t = withCards(["Astral Heron", "Sanctum Conservator"]);
    const sanctum = unit(t, "p1", "Sanctum Conservator", "base", 5, true);
    fund(t, "p1", "Astral Heron");
    t.as("p1").play("Astral Heron").expectOk();
    resolveAll(t);
    expect(t.host.isExhausted(t.room, sanctum.id)).toBe(false);
  });

  it("[C:Steadfast Outrider][R364.3.a] +2 Might with 2 or more other friendly units and/or gear at my battlefield", () => {
    const s = withDeck(["Steadfast Outrider"]);
    const outrider = unit(s, "p1", "Steadfast Outrider", "battlefieldA", 3);
    unit(s, "p1", "Treasure Hunter", "battlefieldA", 1);
    expect(effectiveMight(s.room, outrider.id, s.host)).toBe(3);
    put(s, "p1", "Blade of the Exile", "battlefieldA");
    expect(effectiveMight(s.room, outrider.id, s.host)).toBe(5);
  });

  it("[C:Stoic Ferryman][R421] When you play me to a battlefield, you may move another unit you control here to base", () => {
    const s = withCards(["Stoic Ferryman"]);
    const passenger = unit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", 3);
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    fund(s, "p1", "Stoic Ferryman");
    s.as("p1").play("Stoic Ferryman", { location: "battlefieldA" }).expectOk();
    drive(s, () => zoneOf(s, passenger.id) === "base");
    expect(zoneOf(s, passenger.id)).toBe("base");
  });

  it("[C:Orianna, Exquisite][R424.1.b][R467.2.a] deals no combat damage unless there's a friendly gear here", () => {
    const s = withDeck(["Orianna, Exquisite"]);
    const orianna = unit(s, "p1", "Orianna, Exquisite", "battlefieldA", 4);
    expect(combatContribution(s.room, orianna.id, s.host)).toBe(0);
    put(s, "p1", "Blade of the Exile", "battlefieldA");
    expect(combatContribution(s.room, orianna.id, s.host)).toBe(4);
  });

  it("[C:Elnuk Herd] partial: When you play me, give a friendly unit +3 Might this turn", () => {
    const s = withCards(["Elnuk Herd"]);
    const friend = unit(s, "p1", "Caitlyn, Patrolling", "base", 3);
    fund(s, "p1", "Elnuk Herd");
    s.as("p1").play("Elnuk Herd").expectOk();
    drive(s, () => effectiveMight(s.room, friend.id, s.host) === 6);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(6);
    expect(getCardScript("Elnuk Herd")?.status).toBe("partial");
  });

  it("[C:Clocktower Guardian][R437.1][R808] partial: Predict 3 on play; Deathknell banishes the top card", () => {
    const s = withCards(["Clocktower Guardian"]);
    fund(s, "p1", "Clocktower Guardian");
    s.as("p1").play("Clocktower Guardian").expectOk();
    settle(s);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.options).toHaveLength(3);
    expect(getCardScript("Clocktower Guardian")?.status).toBe("partial");
  });

  it("[C:Transpositionist][R359.3.e.13] partial: return a friendly unit; play a unit with less Might than it had, free", () => {
    const s = withDeck(["Transpositionist"]);
    const trans = unit(s, "p1", "Transpositionist", "base", 4);
    const big = unit(s, "p1", "Astral Heron", "battlefieldA", 7);
    s.moveDeckCardToHand("p1", "Caitlyn, Patrolling");
    const small = s.handCard("p1", "Caitlyn, Patrolling")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 1 } };
    activate(s, "p1", trans.id, 0, { choices: { "target:0": big.id } });
    drive(s, () => s.room.rules!.prompt?.kind === "choose-card");
    expect(s.room.rules!.prompt!.options!.map((option) => option.id)).toContain(small.id);
    answer(s, [small.id]);
    resolveAll(s);
    expect(zoneOf(s, big.id)).toBe("hand");
    expect(zoneOf(s, small.id)).toBe("base");
  });

  it("[C:Trifarian Captain][R425][R417.5] look at 4: may reveal and draw a cheap unit or gear; recycle the rest", () => {
    const s = withCards(["Trifarian Captain"]);
    const deck = boardOf(s, "p1").deck;
    const hunter = deck.splice(
      deck.findIndex((card) => card.name === "Treasure Hunter"),
      1,
    )[0]!;
    deck.push(hunter);
    fund(s, "p1", "Trifarian Captain");
    s.as("p1").play("Trifarian Captain").expectOk();
    drive(s, () => s.room.rules!.prompt?.kind === "choose-card");
    expect(s.room.rules!.prompt!.options!.map((option) => option.id)).toContain(hunter.id);
    answer(s, [hunter.id]);
    resolveAll(s);
    expect(zoneOf(s, hunter.id)).toBe("hand");
  });

  it("[C:Drakehound Packmaster][R425][R428] partial: banish the opponent's revealed top card and play it free", () => {
    const s = withCards(["Drakehound Packmaster"]);
    const top = boardOf(s, "p2").deck.at(-1)!;
    fund(s, "p1", "Drakehound Packmaster");
    s.as("p1").play("Drakehound Packmaster").expectOk();
    drive(s, () => zoneOf(s, top.id) !== "deck", 6);
    expect(zoneOf(s, top.id)).not.toBe("deck");
    expect(zoneOf(s, top.id)).not.toBe("banished");
  });
});
