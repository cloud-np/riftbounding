/**
 * RAD wave R4 units — new scripts and Show Off/optional-cost upgrades.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywordValues,
  effectiveMight,
  getCardScript,
} from "../../../src";
import { boardOf, fund, run, zoneOf } from "../../rules/effects/helpers";
import { answer, flushWork, put, resolveAll, withCards } from "./helpers";

describe("RAD wave R4 units", () => {
  it("[C:Akali, Brash][R430] first move Adds [1][Rune]; second banishes the top card", () => {
    const s = withCards(["Akali, Brash"]);
    const akali = put(s, "p1", "Akali, Brash", "base");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    s.as("p1").move("Akali, Brash", "battlefieldA").expectOk();
    resolveAll(s);
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
    expect(s.room.rules!.pools.p1!.power.any).toBe(1);
    const top = boardOf(s, "p1").deck.at(-1)!;
    s.host.setExhausted(s.room, akali.id, false);
    s.as("p1").move("Akali, Brash", "base").expectOk();
    resolveAll(s);
    expect(zoneOf(s, top.id)).toBe("banished");
    expect(zoneOf(s, akali.id)).toBe("base");
  });

  it("[C:Dune Devourer][R356.2.b.1] offers the optional kill additional cost", () => {
    const s = withCards(["Dune Devourer"]);
    const victim = put(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Dune Devourer");
    const card = s.handCard("p1", "Dune Devourer")!;
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: card.id,
        optionalCosts: ["optional:0"],
        plan: { kill: [victim.id] },
      } as never)
      .expectOk();
    resolveAll(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(zoneOf(s, card.id)).toBe("base");
  });

  it("[C:Entrenched Boar][R369.3][R054.1] may enter ready; then it can't move this turn", () => {
    const s = withCards(["Entrenched Boar"]);
    fund(s, "p1", "Entrenched Boar");
    const card = s.handCard("p1", "Entrenched Boar")!;
    s.as("p1")
      .apply({ type: "rules_play", cardId: card.id, optionalCosts: ["optional:0"] } as never)
      .expectOk();
    resolveAll(s);
    expect(s.host.isExhausted(s.room, card.id)).toBe(false);
    s.as("p1").move("Entrenched Boar", "battlefieldA").expectError("restricted");
  });

  it("[C:Firebrand Raider][R416][R369.3] enters ready and readies all enemy units", () => {
    const s = withCards(["Firebrand Raider"]);
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA", true);
    fund(s, "p1", "Firebrand Raider");
    s.as("p1").play("Firebrand Raider").expectOk();
    resolveAll(s);
    const raider = boardOf(s, "p1").base.find((card) => card.name === "Firebrand Raider")!;
    expect(s.host.isExhausted(s.room, raider.id)).toBe(false);
    expect(s.host.isExhausted(s.room, enemy.id)).toBe(false);
  });

  it("[C:Gutter Guardian][R832][R430] Show Off a Hidden card: Add [Rune]", () => {
    const s = withCards(["Gutter Guardian", "Momentary Companion"]);
    const hidden = s.handCard("p1", "Momentary Companion")!;
    s.room.rules!.pools.p1 = { energy: 10, power: {} };
    s.as("p1")
      .play("Gutter Guardian", { choices: { showOff: [hidden.id] } })
      .expectOk();
    resolveAll(s);
    expect(s.room.rules!.pools.p1!.power.any).toBe(1);
    expect(zoneOf(s, hidden.id)).toBe("hand");
  });

  it("[C:Herald of the Emperor][R479] a friendly unit's base Might becomes 5", () => {
    const s = withCards(["Herald of the Emperor"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Herald of the Emperor");
    s.as("p1").play("Herald of the Emperor").expectOk();
    resolveAll(s);
    s.expectPrompt("choose-target", "p1");
    answer(s, [unit.id]);
    resolveAll(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
  });

  it("[C:K'Sante, Pride of Nazumah][R807.2] grants Assault equal to the unit's Shield", () => {
    const s = withCards(["K'Sante, Pride of Nazumah", "Wrath of the Freljord"]);
    const unit = put(s, "p1", "Wrath of the Freljord", "base");
    const legend = put(s, "p1", "K'Sante, Pride of Nazumah", "legend");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: legend.id,
        ability: "activated:0",
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    resolveAll(s);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(3);
  });

  it("[C:Lulu, Whimsical][R479] moving may set another unit's base Might to 4", () => {
    const s = withCards(["Lulu, Whimsical"]);
    const other = put(s, "p1", "Treasure Hunter", "base");
    put(s, "p1", "Lulu, Whimsical", "base");
    s.as("p1").move("Lulu, Whimsical", "battlefieldA").expectOk();
    resolveAll(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    resolveAll(s);
    expect(effectiveMight(s.room, other.id, s.host)).toBe(4);
  });

  it("[C:Mordekaiser, Iron Revenant][R430] banishes a trash card and Adds [Rune]", () => {
    const s = withCards(["Mordekaiser, Iron Revenant"]);
    const trash = put(s, "p1", "Treasure Hunter", "trash");
    const legend = put(s, "p1", "Mordekaiser, Iron Revenant", "legend");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: legend.id, ability: "activated:1" } as never)
      .expectOk();
    resolveAll(s);
    if (s.room.rules!.prompt) answer(s, [trash.id]);
    expect(zoneOf(s, trash.id)).toBe("banished");
    expect(s.room.rules!.pools.p1!.power.any).toBe(1);
  });

  it("[C:Orianna, Mechanical Marvel][R356.4] discounts the next gear by [1][Rune] while at a battlefield", () => {
    const s = withCards(["Orianna, Mechanical Marvel", "Blade of the Exile"]);
    const orianna = put(s, "p1", "Orianna, Mechanical Marvel", "battlefieldA");
    const gear = s.handCard("p1", "Blade of the Exile")!;
    const deltas = costAdjustments(s.room, s.host, { playerId: "p1", cardId: gear.id });
    expect(deltas.some((entry) => entry.energy === -1 && entry.power?.any === -1)).toBe(true);
    expect(orianna.id).toBeTruthy();
  });

  it("[C:Piltovan Guidebot][R479] may set its base Might to the played card's Energy cost", () => {
    const s = withCards(["Piltovan Guidebot", "Supernova"]);
    const guidebot = put(s, "p1", "Piltovan Guidebot", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Supernova");
    s.as("p1").play("Supernova", { choices: { "target:0": enemy.id } }).expectOk();
    resolveAll(s);
    if (s.room.rules!.prompt?.kind === "yes-no") answer(s, "yes");
    resolveAll(s);
    expect(effectiveMight(s.room, guidebot.id, s.host)).toBe(9);
  });

  it("[C:Seraphic Wyvern][R431] channels that many runes plus 1 exhausted rune instead", () => {
    const s = withCards(["Seraphic Wyvern"]);
    put(s, "p1", "Seraphic Wyvern", "base");
    const before = new Set(boardOf(s, "p1").runeArea.map((rune) => rune.id));
    run(s, { op: "channel", amount: 1 });
    const fresh = boardOf(s, "p1").runeArea.filter((rune) => !before.has(rune.id));
    expect(fresh).toHaveLength(2);
    expect(fresh.filter((rune) => rune.exhausted)).toHaveLength(1);
    expect(getCardScript("Seraphic Wyvern")?.status).toBe("partial");
  });

  it("[C:Mordekaiser, Twice Slain][R371.2] may kill a friendly unit instead of dying", () => {
    const s = withCards(["Supernova", "Mordekaiser, Twice Slain"]);
    const morde = put(s, "p1", "Mordekaiser, Twice Slain", "base");
    const friend = put(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Supernova");
    s.as("p1").play("Supernova", { choices: { "target:0": morde.id } }).expectOk();
    for (let index = 0; index < 8; index += 1) {
      resolveAll(s);
      const prompt = s.room.rules!.prompt;
      if (!prompt) break;
      if (prompt.kind === "yes-no") answer(s, "yes");
      else if (prompt.kind === "choose-target") answer(s, [friend.id]);
      else break;
    }
    expect(zoneOf(s, friend.id)).toBe("trash");
    expect(zoneOf(s, morde.id)).toBe("base");
    expect(s.host.isExhausted(s.room, morde.id)).toBe(true);
  });

  it("[C:Ekko, Boy Who Shattered Time][R391.2] the next unit is killed at end of turn", () => {
    const s = withCards(["Ekko, Boy Who Shattered Time", "Treasure Hunter"]);
    const ekko = put(s, "p1", "Ekko, Boy Who Shattered Time", "legend");
    s.room.rules!.pools.p1 = { energy: 10, power: {} };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: ekko.id, ability: "activated:0" } as never)
      .expectOk();
    resolveAll(s);
    s.as("p1")
      .apply({ type: "rules_activate", objectId: ekko.id, ability: "activated:1" } as never)
      .expectOk();
    resolveAll(s);
    s.as("p1").play("Treasure Hunter").expectOk();
    flushWork(s);
    const unit = boardOf(s, "p1").base.find((card) => card.name === "Treasure Hunter")!;
    s.as("p1").endTurn().expectOk();
    flushWork(s);
    expect(zoneOf(s, unit.id)).toBe("trash");
  });

  it.each([
    ["Bloodscent Swarm", "partial"],
    ["Kai'Sa, Rebel", "partial"],
    ["Skystrike Squadron", "partial"],
    ["Spirit of the Forge", "partial"],
  ] as const)("[C:%s] still plays as a normal unit (%s)", (name, status) => {
    const s = withCards([name]);
    s.room.rules!.pools.p1 = {
      energy: 30,
      power: { Fury: 30, Calm: 30, Mind: 30, Body: 30, Chaos: 30, Order: 30 },
    };
    s.as("p1").play(name).expectOk();
    resolveAll(s);
    expect(boardOf(s, "p1").base.some((card) => card.name === name)).toBe(true);
    expect(getCardScript(name)?.status).toBe(status);
  });

  it("[C:Bloodscent Swarm] is partial: per-turn conquered battlefields are not tracked", () => {
    expect(getCardScript("Bloodscent Swarm")?.status).toBe("partial");
  });
});
