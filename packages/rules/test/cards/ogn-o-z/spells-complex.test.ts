/** Origins O–Z: spells with several instructions, player decisions or zone choices. */
import { describe, expect, it } from "vitest";
import { effectiveKeywords, effectiveMight, getCardScript } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { boardCard, resolveAll, setMight, withCards } from "./helpers";

describe("Origins O–Z complex spells", () => {
  it("[C:Overt Operation][R702.2.b][R427.1.b] may spend each friendly buff to ready that unit, then buffs all friendly units", () => {
    const s = withCards(["Overt Operation"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const b = place(s, "p1", "Treasure Hunter", "base", { exhausted: true });
    const c = place(s, "p1", "Stellacorn Herder", "base", { exhausted: true });
    s.room.rules!.objects[a.id] = { buffs: 1 };
    s.room.rules!.objects[b.id] = { buffs: 1 };
    fund(s, "p1", "Overt Operation");
    s.as("p1").play("Overt Operation").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1")
      .choose({ optionIds: ["no"] })
      .expectOk();
    resolveAll(s);
    // The first buffed unit spent its buff and readied, then got a new buff.
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    expect(s.host.isExhausted(s.room, b.id)).toBe(true);
    expect(s.host.isExhausted(s.room, c.id)).toBe(true);
    for (const unit of [a, b, c]) expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
  });

  it("[C:Salvage][R355.13] may kill up to one gear, then draws 1", () => {
    const s = withCards(["Salvage", "Salvage"], ["Blade of the Exile"]);
    const gear = place(s, "p2", "Blade of the Exile", "base");
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Salvage");
    s.as("p1")
      .play("Salvage", { choices: { "target:0": [gear.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 1);
    fund(s, "p1", "Salvage");
    s.as("p1")
      .play("Salvage", { choices: { "target:0": [] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(before - 2 + 2);
  });

  it("[C:Stacked Deck][R425][R417] looks at the top 3, puts 1 into hand and recycles the rest", () => {
    const s = withCards(["Stacked Deck"]);
    fund(s, "p1", "Stacked Deck");
    s.as("p1").play("Stacked Deck").expectOk();
    const top = s.host.lookAtTop(s.room, "p1", "deck", 3).map((card) => card.id);
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    s.as("p1")
      .choose({ optionIds: [top[1]!] })
      .expectOk();
    resolveAll(s);
    expect(zoneOf(s, top[1]!)).toBe("hand");
    // The end of the deck array is the top; recycled cards go to index 0 (the bottom).
    const bottom = boardOf(s, "p1")
      .deck.slice(0, 2)
      .map((card) => card.id)
      .sort();
    expect(bottom).toEqual([top[0]!, top[2]!].sort());
    expect(s.events().some((event) => event.type === "return_to_hand")).toBe(false);
  });

  it("[C:Unchecked Power][R415][R418] exhausts all friendly units, then deals 12 to all units at battlefields", () => {
    const s = withCards(["Unchecked Power"]);
    const mineBase = place(s, "p1", "Caitlyn, Patrolling", "base");
    const mineField = place(s, "p1", "Treasure Hunter", "battlefieldA");
    setMight(s, mineField.id, 20);
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldB");
    const enemyBase = place(s, "p2", "Whiteflame Protector", "base");
    fund(s, "p1", "Unchecked Power");
    s.as("p1").play("Unchecked Power").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.isExhausted(s.room, mineBase.id)).toBe(true);
    expect(s.room.rules!.objects[mineBase.id]?.damage).toBeUndefined();
    expect(s.room.rules!.objects[mineField.id]?.damage).toBe(12);
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(s.host.isExhausted(s.room, enemyBase.id)).toBe(false);
  });

  it("[C:Possession][R456] takes control of an enemy unit at a battlefield and recalls it to your base", () => {
    const s = withCards(["Possession"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Possession");
    s.as("p1")
      .play("Possession", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").base.map((card) => card.id)).toContain(enemy.id);
    expect(s.events().some((event) => event.type === "move" && event.cardId === enemy.id)).toBe(
      false,
    );
  });

  it("[C:Portal Rescue][R428][R420.3] banishes a friendly unit, then its owner plays it to base ignoring its cost", () => {
    const s = withCards(["Portal Rescue"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { damage: 2, buffs: 1 };
    fund(s, "p1", "Portal Rescue");
    s.as("p1")
      .play("Portal Rescue", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(zoneOf(s, unit.id)).toBe("base");
    // A new object: no damage, no buff (705), and the Energy pool was not charged again.
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
    expect(s.room.rules!.objects[unit.id]?.buffs).toBeUndefined();
    expect(getCardScript("Portal Rescue")?.status).toBe("partial");
  });

  it("[C:Zenith Blade][R424][R355.12] stuns an enemy at a battlefield; you may move a friendly unit to its battlefield", () => {
    const s = withCards(["Zenith Blade"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    setMight(s, enemy.id, 9);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Zenith Blade");
    s.as("p1")
      .play("Zenith Blade", { choices: { "target:0": enemy.id, "target:1": [friend.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(zoneOf(s, friend.id)).toBe("battlefieldB");
  });

  it("[C:Shakedown][R355.18][R418] deals 6 to the enemy unit unless its controller lets you draw 2", () => {
    const s = withCards(["Shakedown", "Shakedown"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, enemy.id, 9);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Shakedown");
    s.as("p1")
      .play("Shakedown", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p2");
    s.as("p2")
      .choose({ optionIds: ["no"] })
      .expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
    fund(s, "p1", "Shakedown");
    s.as("p1")
      .play("Shakedown", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p2");
    s.as("p2")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
    expect(boardOf(s, "p1").hand.length).toBe(before - 2 + 2);
  });

  it("[C:Siphon Power][R479.4.b] at the chosen battlefield: friendly units +1, enemy units -1 to a minimum of 1", () => {
    const s = withCards(["Siphon Power"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, theirs.id, 4);
    const small = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const elsewhere = place(s, "p1", "Stellacorn Herder", "battlefieldB");
    const elsewhereMight = effectiveMight(s.room, elsewhere.id, s.host);
    fund(s, "p1", "Siphon Power");
    s.as("p1")
      .play("Siphon Power", { choices: { "target:0": "battlefield:battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, mine.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, theirs.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, small.id, s.host)).toBe(1);
    expect(effectiveMight(s.room, elsewhere.id, s.host)).toBe(elsewhereMight);
  });

  it("[C:Sabotage][R425][R417] the opponent reveals their hand; you pick a non-unit card and it is recycled", () => {
    const s = withCards(["Sabotage"], ["Progress Day", "Caitlyn, Patrolling"]);
    const spell = boardOf(s, "p2").hand.find((card) => card.name === "Progress Day")!;
    const unit = boardOf(s, "p2").hand.find((card) => card.name === "Caitlyn, Patrolling")!;
    fund(s, "p1", "Sabotage");
    s.as("p1")
      .play("Sabotage", { choices: { opponent: "p2" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(s.events().some((event) => event.type === "reveal" && event.cardId === unit.id)).toBe(
      true,
    );
    // The only non-unit card is picked automatically and recycled; the unit stays.
    expect(zoneOf(s, spell.id)).toBe("deck");
    expect(boardOf(s, "p2").deck[0]!.id).toBe(spell.id);
    expect(zoneOf(s, unit.id)).toBe("hand");
  });

  it("[C:Stormbringer][R418.6.a][R421] deals your base unit's Might to all enemy units at a battlefield, then moves it there", () => {
    const s = withCards(["Stormbringer"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    setMight(s, mine.id, 4);
    const a = place(s, "p2", "Treasure Hunter", "battlefieldB");
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    setMight(s, b.id, 9);
    const away = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Stormbringer");
    s.as("p1")
      .play("Stormbringer", {
        choices: { "target:0": mine.id, "target:1": "battlefield:battlefieldB" },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, a.id)).toBe("trash");
    expect(s.room.rules!.objects[b.id]?.damage).toBe(4);
    expect(s.room.rules!.objects[away.id]?.damage).toBeUndefined();
    expect(zoneOf(s, mine.id)).toBe("battlefieldB");
  });

  it("[C:Sprite Call][R184.1][R440.2.c] plays a ready 3 Might Sprite token with Temporary", () => {
    const s = withCards(["Sprite Call"]);
    fund(s, "p1", "Sprite Call");
    s.as("p1").play("Sprite Call").expectOk();
    s.as("p2").pass().expectOk();
    const sprite = boardCard(s, "p1", "Sprite")!;
    expect(sprite.exhausted).toBe(false);
    expect(effectiveMight(s.room, sprite.id, s.host)).toBe(3);
    expect(effectiveKeywords(s.room, sprite.id, s.host)).toContain("Temporary");
  });

  it("[C:The Harrowing][R420.3][R357] plays a unit from your trash paying only its Power cost", () => {
    const s = withCards(["The Harrowing", "Riptide Rex"]);
    const rex = s.handCard("p1", "Riptide Rex")!;
    s.host.moveCardToOwnerZone(s.room, rex.id, "trash");
    fund(s, "p1", "The Harrowing");
    const pool = s.room.rules!.pools.p1!;
    pool.power = { ...pool.power, Mind: (pool.power.Mind ?? 0) + 2 };
    s.as("p1").play("The Harrowing").expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(boardCard(s, "p1", "Riptide Rex")).toBeTruthy();
    expect(s.room.rules!.pools.p1!.power.Mind ?? 0).toBe(0);
  });

  it("[C:Soulgorger][R403.1][R420.3] when played, may play a unit from your trash ignoring its Energy cost", () => {
    const s = withCards(["Soulgorger", "Pouty Poro"]);
    const poro = s.handCard("p1", "Pouty Poro")!;
    s.host.moveCardToOwnerZone(s.room, poro.id, "trash");
    fund(s, "p1", "Soulgorger");
    s.as("p1").play("Soulgorger").expectOk();
    s.expectPrompt(undefined, "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    resolveAll(s);
    expect(zoneOf(s, poro.id)).toBe("base");
  });

  it("[C:Spectral Matron][R420.3] when played, may play a unit costing ≤ [3] and ≤ [Rune] from your trash for free", () => {
    const s = withCards(["Spectral Matron", "Pouty Poro", "Riptide Rex"]);
    for (const name of ["Pouty Poro", "Riptide Rex"]) {
      s.host.moveCardToOwnerZone(s.room, s.handCard("p1", name)!.id, "trash");
    }
    fund(s, "p1", "Spectral Matron");
    s.as("p1").play("Spectral Matron").expectOk();
    s.expectPrompt(undefined, "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    resolveAll(s);
    // Riptide Rex (cost 6) is not eligible; the only eligible unit is played without paying.
    expect(boardCard(s, "p1", "Pouty Poro")).toBeTruthy();
    expect(boardOf(s, "p1").trash.map((card) => card.name)).toContain("Riptide Rex");
  });

  it("[C:Reinforce][R428][R420.3] banishes a looked-at unit and plays it for [5] less; recycles the rest", () => {
    const s = withCards(["Reinforce"]);
    fund(s, "p1", "Reinforce");
    s.as("p1").play("Reinforce").expectOk();
    const top = s.host.lookAtTop(s.room, "p1", "deck", 5);
    const unit = top.find((card) =>
      s.host.cardInfo(s.room, card.id)?.type.toLowerCase().includes("unit"),
    )!;
    const info = s.host.cardInfo(s.room, unit.id)!;
    s.room.rules!.pools.p1 = {
      energy: Math.max(0, (info.energyCost ?? 0) - 5),
      power: { [info.domains?.[0] ?? "any"]: info.powerCost ?? 0 },
    };
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    s.as("p1")
      .choose({ optionIds: [unit.id] })
      .expectOk();
    resolveAll(s);
    expect(boardCard(s, "p1", unit.name)).toBeTruthy();
    for (const card of top.filter((entry) => entry.id !== unit.id))
      expect(zoneOf(s, card.id)).toBe("deck");
    expect(getCardScript("Reinforce")?.status).toBe("partial");
  });

  it("[C:Whirlwind][R303.2.a][R056] starting with the next player, each player may return a unit to its owner's hand", () => {
    const s = withCards(["Whirlwind"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Whirlwind");
    s.as("p1").play("Whirlwind").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p2");
    s.as("p2")
      .choose({ optionIds: [mine.id] })
      .expectOk();
    s.expectPrompt("choose-card", "p1");
    s.as("p1").choose({ optionIds: [] }).expectOk();
    resolveAll(s);
    expect(zoneOf(s, mine.id)).toBe("hand");
    expect(zoneOf(s, theirs.id)).toBe("battlefieldA");
  });

  it("[C:Unyielding Spirit][R438.3.c] prevents all damage dealt this turn by spells and abilities (any player's)", () => {
    const s = withCards(["Hextech Ray"], ["Unyielding Spirit"]);
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    fund(s, "p2", "Unyielding Spirit");
    s.as("p2").play("Unyielding Spirit").expectOk();
    s.as("p1").pass().expectOk();
    resolveAll(s);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
    expect(s.events().some((event) => event.type === "prevented")).toBe(true);
  });

  it("[C:Unyielding Spirit][R467] combat damage is not prevented", () => {
    const s = withCards(["Unyielding Spirit"]);
    const attacker = place(s, "p1", "Caitlyn, Patrolling", "base");
    const defender = place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Unyielding Spirit");
    s.as("p1").play("Unyielding Spirit").expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    resolveAll(s);
    expect(zoneOf(s, defender.id)).toBe("trash");
    void attacker;
  });

  it("[C:Party Favors][R355.18][R414][R431.2.a] each other player chooses Cards (both draw 1) or Runes (both channel 1 exhausted)", () => {
    const s = withCards(["Party Favors", "Party Favors"]);
    const hands = () => [boardOf(s, "p1").hand.length, boardOf(s, "p2").hand.length];
    const [h1, h2] = hands();
    fund(s, "p1", "Party Favors");
    s.as("p1").play("Party Favors").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-mode", "p2");
    s.as("p2")
      .choose({ optionIds: ["cards"] })
      .expectOk();
    resolveAll(s);
    expect(hands()).toEqual([h1! - 1 + 1, h2! + 1]);
    const runes = [boardOf(s, "p1").runeArea.length, boardOf(s, "p2").runeArea.length];
    fund(s, "p1", "Party Favors");
    s.as("p1").play("Party Favors").expectOk();
    s.as("p2").pass().expectOk();
    s.as("p2")
      .choose({ optionIds: ["runes"] })
      .expectOk();
    resolveAll(s);
    expect([boardOf(s, "p1").runeArea.length, boardOf(s, "p2").runeArea.length]).toEqual([
      runes[0]! + 1,
      runes[1]! + 1,
    ]);
  });

  it("[C:Super Mega Death Rocket!][C:Spoils of War] deal 5 to a unit / draw 2 (their conditional parts are partial)", () => {
    const s = withCards(["Super Mega Death Rocket!", "Spoils of War"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, enemy.id, 9);
    fund(s, "p1", "Super Mega Death Rocket!");
    s.as("p1")
      .play("Super Mega Death Rocket!", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(5);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Spoils of War");
    s.as("p1").play("Spoils of War").expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 2);
    expect(getCardScript("Super Mega Death Rocket!")?.status).toBe("partial");
    expect(getCardScript("Spoils of War")?.status).toBe("partial");
  });

  it("[C:Time Warp][C:Promising Future] are manual with gap notes", () => {
    expect(getCardScript("Time Warp")?.status).toBe("manual");
    expect(getCardScript("Promising Future")?.status).toBe("manual");
  });
});
