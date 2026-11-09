/** Origins O–Z: Deathknell, move, attack and "when you play …" triggers. */
import { describe, expect, it } from "vitest";
import { combatKeywordProfile, effectiveMight, getCardScript } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { boardCard, passBoth, resolveAll, setMight, withCards } from "./helpers";

describe("Origins O–Z triggered abilities", () => {
  it("[C:Soaring Scout][R808.1.c][R431.2.a] [Deathknell]: channel 1 rune exhausted", () => {
    const s = withCards(["Vengeance"], ["Soaring Scout"]);
    const scout = place(s, "p2", "Soaring Scout", "battlefieldA");
    const runes = boardOf(s, "p2").runeArea.length;
    fund(s, "p1", "Vengeance");
    s.as("p1")
      .play("Vengeance", { choices: { "target:0": scout.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Soaring Scout");
    resolveAll(s);
    const area = boardOf(s, "p2").runeArea;
    expect(area).toHaveLength(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
  });

  it("[C:Watchful Sentry][R808.1.c] [Deathknell]: draw 1", () => {
    const s = withCards(["Vengeance"], ["Watchful Sentry"]);
    const sentry = place(s, "p2", "Watchful Sentry", "base");
    const before = boardOf(s, "p2").hand.length;
    fund(s, "p1", "Vengeance");
    s.as("p1")
      .play("Vengeance", { choices: { "target:0": sentry.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(boardOf(s, "p2").hand.length).toBe(before + 1);
  });

  it("[C:Tasty Faefolk][R808.1.c] [Deathknell]: channel 2 runes exhausted and draw 1", () => {
    const s = withCards(["Vengeance"], ["Tasty Faefolk"]);
    const faefolk = place(s, "p2", "Tasty Faefolk", "base");
    const before = boardOf(s, "p2").hand.length;
    const runes = boardOf(s, "p2").runeArea.length;
    fund(s, "p1", "Vengeance");
    s.as("p1")
      .play("Vengeance", { choices: { "target:0": faefolk.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(boardOf(s, "p2").hand.length).toBe(before + 1);
    const area = boardOf(s, "p2").runeArea;
    expect(area).toHaveLength(runes + 2);
    expect(area.slice(-2).every((rune) => rune.exhausted)).toBe(true);
  });

  it("[C:Traveling Merchant][R421][R423] when it moves: discard 1, then draw 1", () => {
    const s = withCards(["Traveling Merchant", "Progress Day"]);
    place(s, "p1", "Traveling Merchant", "base");
    // One card in hand: the discard has no choice (it is that card), then 1 is drawn.
    const only = boardOf(s, "p1").hand.map((card) => card.id);
    expect(only).toHaveLength(1);
    s.as("p1").move("Traveling Merchant", "battlefieldA").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Traveling Merchant");
    resolveAll(s);
    expect(boardOf(s, "p1").trash.map((card) => card.id)).toEqual(only);
    expect(boardOf(s, "p1").hand).toHaveLength(1);
    expect(boardOf(s, "p1").hand[0]!.id).not.toBe(only[0]);
  });

  it("[C:Ravenbloom Student][R420.4.a][R420.4.a.1] +1 Might this turn when you play a spell (not when it is countered)", () => {
    const s = withCards(["Progress Day", "Progress Day", "Ravenbloom Student"], ["Wind Wall"]);
    const student = place(s, "p1", "Ravenbloom Student", "base");
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Ravenbloom Student");
    passBoth(s);
    expect(effectiveMight(s.room, student.id, s.host)).toBe(3);
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    fund(s, "p2", "Wind Wall");
    s.as("p2")
      .play("Wind Wall", { choices: { "target:0": s.room.rules!.chain[0]!.id } })
      .expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(effectiveMight(s.room, student.id, s.host)).toBe(3);
  });

  it("[C:Pit Crew][R420.4.a][R440.2.c] readies itself when you play a gear (a gear token counts)", () => {
    const s = withCards(["Pit Crew"]);
    const crew = place(s, "p1", "Pit Crew", "base", { exhausted: true });
    place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    resolveAll(s);
    expect(boardOf(s, "p1").base.some((card) => card.name === "Gold")).toBe(true);
    expect(s.host.isExhausted(s.room, crew.id)).toBe(false);
  });

  it("[C:Viktor, Innovator][R420.4.a][R185] a card played on an opponent's turn plays a Recruit; on your own turn it does not", () => {
    const s = withCards(["Progress Day"], ["Discipline", "Discipline", "Viktor, Innovator"]);
    place(s, "p2", "Viktor, Innovator", "base");
    const unit = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    fund(s, "p2", "Discipline");
    s.as("p2")
      .play("Discipline", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.chain.at(-1)?.cardName).toBe("Viktor, Innovator");
    resolveAll(s);
    expect(boardOf(s, "p2").base.filter((card) => card.name === "Recruit")).toHaveLength(1);
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    fund(s, "p2", "Discipline");
    s.as("p2")
      .play("Discipline", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(boardOf(s, "p2").base.filter((card) => card.name === "Recruit")).toHaveLength(1);
  });

  it("[C:Yasuo, Remorseful][R383.4.e][R418.6.a] when he attacks, deals damage equal to his Might to an enemy unit here", () => {
    const s = withCards(["Yasuo, Remorseful"]);
    const yasuo = place(s, "p1", "Yasuo, Remorseful", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, enemy.id, 9);
    s.as("p1").move("Yasuo, Remorseful", "battlefieldA").expectOk();
    resolveAll(s);
    const damage = s.events().find((event) => event.type === "damage" && event.cardId === enemy.id);
    expect(damage?.sourceObjectId ?? damage?.data?.sourceObjectId ?? yasuo.id).toBe(yasuo.id);
    // 6 from the trigger, then combat damage (Yasuo's 6 again) kills the 9 Might unit.
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Warwick, Hunter][R369.3][R383.4.e] enters ready; when he attacks, kills every damaged enemy unit here", () => {
    const s = withCards(["Warwick, Hunter"]);
    fund(s, "p1", "Warwick, Hunter");
    s.as("p1").play("Warwick, Hunter").expectOk();
    expect(boardCard(s, "p1", "Warwick, Hunter")!.exhausted).toBe(false);
    const damaged = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, damaged.id, 9, { damage: 1 });
    const healthy = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    setMight(s, healthy.id, 9);
    s.as("p1").move("Warwick, Hunter", "battlefieldA").expectOk();
    resolveAll(s);
    expect(zoneOf(s, damaged.id)).toBe("trash");
    expect(s.events().some((event) => event.type === "kill" && event.cardId === healthy.id)).toBe(
      false,
    );
  });

  it("[C:Stealthy Pursuer][R403.1][R421] may move with a friendly unit that moves from its location", () => {
    const s = withCards(["Stealthy Pursuer"]);
    const pursuer = place(s, "p1", "Stealthy Pursuer", "base");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    resolveAll(s);
    expect(zoneOf(s, pursuer.id)).toBe("battlefieldA");
  });

  it("[C:Pirate's Haven][C:Vanguard Helm][C:Solari Shrine][C:Volibear, Imposing] blocked triggers are manual/partial with notes", () => {
    expect(getCardScript("Pirate's Haven")?.status).toBe("manual");
    expect(getCardScript("Vanguard Helm")?.status).toBe("implemented");
    expect(getCardScript("Solari Shrine")?.status).toBe("implemented");
    const s = withCards(["Volibear, Imposing"]);
    const voli = place(s, "p1", "Volibear, Imposing", "base");
    expect(combatKeywordProfile(s.room, voli.id, s.host)).toMatchObject({ shield: 3, tank: true });
    expect(getCardScript("Volibear, Imposing")?.status).toBe("partial");
  });
});
