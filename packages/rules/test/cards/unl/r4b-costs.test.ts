/**
 * Unleashed R4b — cards unblocked by R4-engine lane B's cost/play fixes:
 * - 356.4.f.1: paying with runes is not paying the optional additional cost;
 * - 420.3.b / 355.2.b: a limited play may enter a battlefield with no friendly units;
 * - 822.1.b / 308.1.a: Ambush during a showdown;
 * - 809: Deflect is priced from effective keyword values (passives included).
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywordValues, effectiveMight, getCardScript } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { playWith, resolveChain, settle, withCards } from "./helpers";

describe("Unleashed R4b — optional additional cost flag [R356.4.f.1]", () => {
  it("[C:Safety Inspector][R356.4.f.1] paying with runes does not count as paying the 3 XP cost", () => {
    const s = withCards(["Safety Inspector"]);
    const mine = place(s, "p1", "Treasure Hunter", "base");
    const theirs = place(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "Safety Inspector");
    s.as("p1").play("Safety Inspector").expectOk();
    settle(s);
    // No optional cost: both players kill a unit.
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(getCardScript("Safety Inspector")?.status).toBe("implemented");
  });

  it("[C:Safety Inspector][R356.4.f.1] paying the 3 XP cost skips my kill", () => {
    const s = withCards(["Safety Inspector"]);
    const mine = place(s, "p1", "Treasure Hunter", "base");
    const theirs = place(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "Safety Inspector");
    boardOf(s, "p1").legendXp = 3;
    playWith(s, "p1", "Safety Inspector", { optionalCosts: ["optional:0"] });
    settle(s);
    expect(zoneOf(s, mine.id)).toBe("base");
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(boardOf(s, "p1").legendXp).toBe(0);
  });

  it("[C:Pyke, Dockside Butcher][R356.4.f.1] rune payment does not ready me; the optional [Fury] does", () => {
    const runePaid = withCards(["Pyke, Dockside Butcher"]);
    fund(runePaid, "p1", "Pyke, Dockside Butcher");
    runePaid.as("p1").play("Pyke, Dockside Butcher").expectOk();
    settle(runePaid);
    const plain = runePaid.findBoardCardAnywhere("Pyke, Dockside Butcher")!;
    expect(plain.exhausted).toBe(true);
    expect(effectiveMight(runePaid.room, plain.id, runePaid.host)).toBe(2);

    const paid = withCards(["Pyke, Dockside Butcher"]);
    fund(paid, "p1", "Pyke, Dockside Butcher");
    paid.room.rules!.pools.p1!.power.Fury = 1;
    playWith(paid, "p1", "Pyke, Dockside Butcher", { optionalCosts: ["optional:0"] });
    settle(paid);
    const buffed = paid.findBoardCardAnywhere("Pyke, Dockside Butcher")!;
    expect(buffed.exhausted).toBe(false);
    expect(effectiveMight(paid.room, buffed.id, paid.host)).toBe(4);
  });

  it("[C:Nami, Headstrong][R356.4.f.1] rune payment does not stun; the optional [Calm] does", () => {
    const runePaid = withCards(["Nami, Headstrong"], ["Treasure Hunter"]);
    const enemy = place(runePaid, "p2", "Treasure Hunter", "battlefieldA");
    fund(runePaid, "p1", "Nami, Headstrong");
    runePaid.as("p1").play("Nami, Headstrong").expectOk();
    settle(runePaid);
    expect(runePaid.room.rules!.objects[enemy.id]?.stunned ?? false).toBe(false);

    const paid = withCards(["Nami, Headstrong"], ["Treasure Hunter"]);
    const other = place(paid, "p2", "Treasure Hunter", "battlefieldA");
    fund(paid, "p1", "Nami, Headstrong");
    paid.room.rules!.pools.p1!.power.Calm = 1;
    playWith(paid, "p1", "Nami, Headstrong", { optionalCosts: ["optional:0"] });
    settle(paid);
    expect(paid.room.rules!.objects[other.id]?.stunned).toBe(true);
  });

  it("[C:Crescent Guardian][R356.2.b.1][R356.4.f.1] the [Chaos] cost exists only after a spell; rune payment does not ready me", () => {
    const runePaid = withCards(["Crescent Guardian"]);
    fund(runePaid, "p1", "Crescent Guardian");
    runePaid.as("p1").play("Crescent Guardian").expectOk();
    settle(runePaid);
    expect(runePaid.findBoardCardAnywhere("Crescent Guardian")!.exhausted).toBe(true);
    expect(getCardScript("Crescent Guardian")?.status).toBe("implemented");

    const noSpell = withCards(["Crescent Guardian"]);
    fund(noSpell, "p1", "Crescent Guardian");
    noSpell.room.rules!.pools.p1!.power.Chaos = 1;
    noSpell
      .as("p1")
      .apply({
        type: "rules_play",
        cardId: noSpell.handCard("p1", "Crescent Guardian")!.id,
        optionalCosts: ["optional:0"],
      } as never)
      .expectError("invalid_choice");

    const paid = withCards(["Crescent Guardian", "Downstage Dramatics"]);
    fund(paid, "p1", "Downstage Dramatics");
    paid.as("p1").play("Downstage Dramatics").expectOk();
    resolveChain(paid);
    fund(paid, "p1", "Crescent Guardian");
    paid.room.rules!.pools.p1!.power.Chaos = 1;
    playWith(paid, "p1", "Crescent Guardian", { optionalCosts: ["optional:0"] });
    settle(paid);
    expect(paid.findBoardCardAnywhere("Crescent Guardian")!.exhausted).toBe(false);
  });
});

describe("Unleashed R4b — limited play location [R420.3.b][R355.2.b]", () => {
  it("[C:Thrill of the Hunt][R420.3.b][R355.2.b] the banished unit enters a battlefield with no friendly units", () => {
    const s = withCards(["Thrill of the Hunt"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Thrill of the Hunt");
    s.as("p1")
      .play("Thrill of the Hunt", { choices: { "target:0": unit.id, destination: "battlefieldA" } })
      .expectOk();
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(getCardScript("Thrill of the Hunt")?.status).toBe("implemented");
  });
});

describe("Unleashed R4b — Ambush during a showdown [R822.1.b][R308.1.a]", () => {
  it("[C:Inferna][R822.1.b] may Ambush into a battlefield you control during the showdown there", () => {
    const s = withCards(["Inferna"], [], { firstPlayer: "p2" });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    place(s, "p2", "Whiteflame Protector", "base");
    s.as("p2").move("Whiteflame Protector", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Inferna");
    s.as("p1").play("Inferna", { location: "battlefieldA" }).expectOk();
    const inferna = s.findBoardCardAnywhere("Inferna")!;
    expect(zoneOf(s, inferna.id)).toBe("battlefieldA");
  });
});

describe("Unleashed R4b — Deflect from effective keyword values [R809.2]", () => {
  it("[C:Allay, Eager Admirer][R809.2] Deflect granted by a passive is charged", () => {
    const s = withCards(["Hextech Ray"], ["Allay, Eager Admirer"]);
    place(s, "p2", "Allay, Eager Admirer", "battlefieldA");
    const warded = place(s, "p2", "Treasure Hunter", "battlefieldA");
    expect(effectiveKeywordValues(s.room, warded.id, s.host).deflect).toBe(1);
    fund(s, "p1", "Hextech Ray");
    boardOf(s, "p1").runeArea = [];
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": warded.id } })
      .expectError("insufficient_resources");
  });
});

describe("Unleashed R4b — expired state is retained [R317.2.c]", () => {
  it("[C:Shadow's Call][R801.3.a.3][R317.2.c] a granted [Temporary] survives the end of the turn and kills next Beginning Phase", () => {
    const s = withCards(["Shadow's Call"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Shadow's Call");
    s.as("p1")
      .play("Shadow's Call", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).temporary ?? 0).toBeGreaterThan(0);
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("trash");
  });

  it("[C:Turn to Dust][R801.3.a.3] a gear given [Temporary] dies at its controller's next Beginning Phase", () => {
    const s = withCards(["Turn to Dust"], ["Divining Shells"]);
    const gear = place(s, "p2", "Divining Shells", "base");
    fund(s, "p1", "Turn to Dust");
    s.as("p1")
      .play("Turn to Dust", { choices: { "target:0": gear.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveKeywordValues(s.room, gear.id, s.host).temporary ?? 0).toBeGreaterThan(0);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
  });

  it("[C:Back Off][R811.1.b] a card hidden on an earlier turn can be played from facedown", () => {
    const s = withCards(["Back Off"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldB");
    s.room.rules!.objects.battlefieldB = { controller: "p1" };
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const hidden = s.handCard("p1", "Back Off")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: hidden.id, hide: true, location: "battlefieldB" })
      .expectOk();
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s);
    s.as("p1")
      .apply({ type: "rules_play", cardId: hidden.id, choices: { "target:0": enemy.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(zoneOf(s, hidden.id)).toBe("trash");
  });
});
