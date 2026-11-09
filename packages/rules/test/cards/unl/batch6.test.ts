/**
 * Unleashed (UNL) batch 6 — spells.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywordValues, xpOf } from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, hand, playWith, resolveChain, withCards } from "./helpers";

describe("Unleashed batch 6 — spells", () => {
  it("[C:Square Up][R820.1.d][R801.3.a] Repeat: discard 1; Assault 4 this turn to a unit (and a second one)", () => {
    const s = withCards(["Square Up", "Gust"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Square Up");
    playWith(s, "p1", "Square Up", {
      optionalCosts: ["repeat"],
      choices: { "target:0": a.id, "repeat:1:target:0": b.id },
    });
    resolveChain(s);
    expect(effectiveKeywordValues(s.room, a.id, s.host).assault).toBe(4);
    expect(effectiveKeywordValues(s.room, b.id, s.host).assault).toBe(4);
    s.expectZone("p1", "Gust", "trash");
  });

  it("[C:Existential Dread][R424][R056] stuns an attacking unit; an already stunned one returns to its owner's hand", () => {
    const s = withCards(["Existential Dread", "Existential Dread"], [], { firstPlayer: "p2" });
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    const attacker = place(s, "p2", "Caitlyn, Patrolling", "base");
    s.as("p2").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[attacker.id]?.designation).toBe("attacker");
    fund(s, "p1", "Existential Dread", "Existential Dread");
    s.as("p1")
      .play("Existential Dread", { choices: { "target:0": attacker.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[attacker.id]?.stunned).toBe(true);
    expect(zoneOf(s, attacker.id)).toBe("battlefieldA");
    s.as("p2").pass().expectOk();
    s.as("p1")
      .play("Existential Dread", { choices: { "target:0": attacker.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, attacker.id)).toBe("hand");
  });

  it("[C:Existential Dread][R424] a unit that is not attacking is not a legal target", () => {
    const s = withCards(["Existential Dread"]);
    const idle = place(s, "p2", "Treasure Hunter", "battlefieldA");
    s.as("p1").pass(); // (no showdown: the unit is simply not attacking)
    fund(s, "p1", "Existential Dread");
    const result = s.as("p1").play("Existential Dread", { choices: { "target:0": idle.id } });
    expect(result.lastError()).toBeTruthy();
  });

  it("[C:Skyward Strike][R421] moves an enemy unit to a chosen location", () => {
    const s = withCards(["Skyward Strike"]);
    const enemy = place(s, "p2", "Treasure Hunter", "base");
    const other = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Skyward Strike");
    s.as("p1")
      .play("Skyward Strike", {
        choices: { "target:0": enemy.id, destination: "battlefieldA", "target:1": other.id },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    expect(s.room.rules!.objects[other.id]?.stunned).toBeFalsy();
  });

  it("[C:Skyward Strike][R824][R424] at Level 6 it also stuns an enemy unit", () => {
    const s = withCards(["Skyward Strike"]);
    const enemy = place(s, "p2", "Treasure Hunter", "base");
    const other = place(s, "p2", "Caitlyn, Patrolling", "base");
    run(s, { op: "gain_xp", amount: 6 });
    expect(xpOf(s.room, "p1")).toBe(6);
    fund(s, "p1", "Skyward Strike");
    s.as("p1")
      .play("Skyward Strike", {
        choices: { "target:0": enemy.id, destination: "battlefieldA", "target:1": other.id },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    expect(s.room.rules!.objects[other.id]?.stunned).toBe(true);
  });

  it("[C:Deadly Flourish][R418][R390] 3 damage; when the unit dies this turn, play an exhausted Gold", () => {
    const s = withCards(["Deadly Flourish", "Moonlight Affliction"]);
    // A Might-8 enemy survives the 3 damage; Moonlight Affliction (-10) later kills it this turn.
    const victim = place(s, "p2", "Whiteflame Protector", "base");
    fund(s, "p1", "Deadly Flourish", "Moonlight Affliction");
    s.as("p1")
      .play("Deadly Flourish", { choices: { "target:0": victim.id } })
      .expectOk();
    resolveChain(s);
    expect(cardsNamed(s, "p1", "base", "Gold")).toHaveLength(0);
    expect(zoneOf(s, victim.id)).toBe("base");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": victim.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    const gold = cardsNamed(s, "p1", "base", "Gold");
    expect(gold).toHaveLength(1);
    expect(gold[0]!.exhausted).toBe(true);
  });

  it("[C:Deadly Flourish][R390] a unit that dies from the damage itself also gives the Gold", () => {
    const s = withCards(["Deadly Flourish"]);
    const victim = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Deadly Flourish");
    s.as("p1")
      .play("Deadly Flourish", { choices: { "target:0": victim.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(cardsNamed(s, "p1", "base", "Gold")).toHaveLength(1);
  });

  it("[C:Sacrifice][R356.2.a.1][R414][R431] kill a friendly Mighty unit as a cost; draw 2, channel 1 exhausted", () => {
    const s = withCards(["Sacrifice"]);
    const mighty = place(s, "p1", "Whiteflame Protector", "base");
    place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Sacrifice");
    const before = hand(s, "p1").length;
    const runes = boardOf(s, "p1").runeArea.length;
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: s.handCard("p1", "Sacrifice")!.id,
        plan: { kill: [mighty.id] },
      } as never)
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, mighty.id)).toBe("trash");
    expect(hand(s, "p1")).toHaveLength(before - 1 + 2);
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 1);
  });

  it("[C:Thrill of the Hunt][R428][R420.3.b] banish a friendly unit, then play it to a battlefield ignoring cost", () => {
    const s = withCards(["Thrill of the Hunt"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    // 355.2.a: a unit can only enter a battlefield where its controller has units (see the BUG note).
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Thrill of the Hunt");
    s.as("p1")
      .play("Thrill of the Hunt", {
        choices: { "target:0": unit.id, destination: "battlefieldA" },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
  });

  it("[C:Smoke and Mirrors][R434.1][R414] with a [Temporary] unit among two at different locations, swap them; draw 1", () => {
    const s = withCards(["Smoke and Mirrors", "Sprite Burst"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    run(s, { op: "create", token: { name: "Sprite", play: true }, zone: "base" });
    const sprite = boardOf(s, "p1").base.find((card) => card.name === "Sprite")!;
    fund(s, "p1", "Smoke and Mirrors");
    const before = hand(s, "p1").length;
    s.as("p1")
      .play("Smoke and Mirrors", { choices: { "target:0": a.id, "target:1": sprite.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, a.id)).toBe("base");
    expect(zoneOf(s, sprite.id)).toBe("battlefieldA");
    expect(hand(s, "p1")).toHaveLength(before - 1 + 1);
  });

  it("[C:Smoke and Mirrors][R434.1] without a [Temporary] unit nobody moves, but you still draw 1", () => {
    const s = withCards(["Smoke and Mirrors"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Smoke and Mirrors");
    s.as("p1")
      .play("Smoke and Mirrors", { choices: { "target:0": a.id, "target:1": b.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, a.id)).toBe("battlefieldA");
    expect(zoneOf(s, b.id)).toBe("base");
  });
});
