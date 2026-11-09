/**
 * Vendetta batch 4b: damage-history, turn-count, Flow-spell effects, Empower/Disempower gear.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  answer,
  boardOf,
  empowered,
  exhaustRunes,
  place,
  setControl,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

type S = ReturnType<typeof withCards>;

/** The opponent of the chain's controller passes: the top item resolves (340). */
function resolveTop(s: S): void {
  const rules = s.room.rules!;
  const controller = rules.chain[rules.chain.length - 1]?.controller ?? "p1";
  s.as(controller === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

function runCombat(s: S): void {
  settle(s);
  for (let i = 0; i < 8 && s.room.rules!.combat; i += 1) {
    s.as(s.room.rules!.priority!).pass().expectOk();
    settle(s);
  }
}

describe("Vendetta batch 4b", () => {
  it("[C:Affectionate Poro][R468.7.b] draws after a combat only if I was not dealt damage this turn", () => {
    for (const enemyName of ["Scuttle Crab", "Treasure Hunter"]) {
      const s = withCards(["Affectionate Poro"], ["Scuttle Crab", "Treasure Hunter"], {
        battlefields: { p2: "Bandle Tree" },
      });
      place(s, "p2", enemyName, "battlefieldA");
      setControl(s, "battlefieldA", "p2");
      place(s, "p1", "Affectionate Poro", "base");
      const hand = boardOf(s, "p1").hand.length;
      s.as("p1").move("Affectionate Poro", "battlefieldA").expectOk();
      runCombat(s);
      expect(boardOf(s, "p1").hand.length).toBe(enemyName === "Scuttle Crab" ? hand + 1 : hand);
    }
  });

  // layers/restrictions.ts `restrictionFor` only reads modifiers of objects on the board, so a
  // `play` restriction printed on a card in hand is never consulted (054.1).
  it("[C:Ol' Poro][R054.1] a play restriction on a card in hand is not applied", () => {
    const s = withCards(["Ol' Poro"]);
    fund(s, "p1", "Ol' Poro");
    s.as("p1").play("Ol' Poro").expectError("restricted");
  });

  it("[C:Ol' Poro][R054.1] is a manual card (restriction in hand not enforceable)", () => {
    expect(getCardScript("Ol' Poro")?.status).toBe("manual");
  });

  it("[C:Ocean Drake][R383.4.a] when you play me, may return a non-Dragon unit to its owner's hand", () => {
    const s = withCards(["Ocean Drake", "Treasure Hunter"]);
    const enemy = place(s, "p2", "Treasure Hunter", "base");
    expect(getCardScript("Ocean Drake")?.status).toBe("partial");
    fund(s, "p1", "Ocean Drake");
    s.as("p1").play("Ocean Drake").expectOk();
    settle(s);
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    settle(s);
    if (s.room.rules!.prompt) answer(s, [enemy.id]);
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("hand");
  });

  it("[C:Hungry Wolf][R357] [Calm]: ready me and +1 Might; once each turn", () => {
    const s = withCards(["Hungry Wolf"]);
    const wolf = place(s, "p1", "Hungry Wolf", "base", { exhausted: true });
    exhaustRunes(s, "p1");
    addPool(s, "p1", 0, { Calm: 2 });
    activate(s, "p1", wolf, "activated:0").expectOk();
    resolveTop(s);
    expect(boardOf(s, "p1").base.find((c) => c.id === wolf.id)?.exhausted).toBeFalsy();
    // 376: the once-per-turn Limit.
    activate(s, "p1", wolf, "activated:0").expectError("illegal_action");
  });

  it("[C:Kennen, Storm of Shuriken][R441] when you play me, burn 2", () => {
    const s = withCards(["Kennen, Storm of Shuriken"]);
    const trash = boardOf(s, "p1").trash.length;
    fund(s, "p1", "Kennen, Storm of Shuriken");
    s.as("p1").play("Kennen, Storm of Shuriken").expectOk();
    settle(s);
    expect(boardOf(s, "p1").trash.length).toBe(trash + 2);
  });

  it("[C:Zed, Without a Sound][R383.4.c][R440.2.c] conquering plays a Shadow Clone to base; the Action swaps my place with a clone", () => {
    const s = withCards(["Zed, Without a Sound"]);
    const zed = place(s, "p1", "Zed, Without a Sound", "base");
    s.as("p1").move("Zed, Without a Sound", "battlefieldA").expectOk();
    settle(s);
    s.expectScore("p1", 1);
    const clone = boardOf(s, "p1").base.find((c) => c.name === "Shadow Clone");
    expect(clone).toBeTruthy();
    exhaustRunes(s, "p1");
    addPool(s, "p1", 1, { Chaos: 1 });
    activate(s, "p1", zed, "activated:1", { "target:0": clone!.id }).expectOk();
    resolveTop(s);
    expect(boardOf(s, "p1").base.some((c) => c.id === zed.id)).toBe(true);
    expect(boardOf(s, "p1").battlefieldA.some((c) => c.id === clone!.id)).toBe(true);
  });

  it("[C:Death Mark][R441][R187] burn 3 and play a 0 Might Shadow Clone", () => {
    const s = withCards(["Death Mark"]);
    const trash = boardOf(s, "p1").trash.length;
    fund(s, "p1", "Death Mark");
    s.as("p1").play("Death Mark").expectOk();
    resolveTop(s);
    settle(s);
    expect(boardOf(s, "p1").trash.length).toBe(trash + 1 + 3);
    expect(boardOf(s, "p1").base.some((c) => c.name === "Shadow Clone")).toBe(true);
  });

  it("[C:Lightning Rush][R425][R441] look at 3, may draw one, the rest go to the trash", () => {
    const s = withCards([
      "Lightning Rush",
      "Treasure Hunter",
      "Caitlyn, Patrolling",
      "Hextech Ray",
    ]);
    const top = place(s, "p1", "Treasure Hunter", "deck");
    const second = place(s, "p1", "Caitlyn, Patrolling", "deck");
    const third = place(s, "p1", "Hextech Ray", "deck");
    fund(s, "p1", "Lightning Rush");
    s.as("p1").play("Lightning Rush").expectOk();
    resolveTop(s);
    settle(s);
    const prompt = s.room.rules!.prompt!;
    expect(prompt.options!.length).toBe(3);
    const pick = prompt.options!.find((o) => o.id === second.id) ?? prompt.options![1]!;
    answer(s, [pick.id]);
    settle(s);
    expect(zoneOf(s, pick.id)).toBe("hand");
    for (const other of [top, second, third].filter((c) => c.id !== pick.id))
      expect(zoneOf(s, other.id)).toBe("trash");
  });

  it("[C:Questionable Tome][R827.1.c.1][R357.2] empower for [Tap]; Disempower, [1], [Tap]: draw 1", () => {
    const s = withCards(["Questionable Tome"]);
    const tome = place(s, "p1", "Questionable Tome", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 1);
    // Not Empowered: the second ability is rejected.
    activate(s, "p1", tome, "activated:1").expectError("illegal_action");
    activate(s, "p1", tome, "activated:0").expectOk();
    resolveTop(s);
    expect(empowered(s, tome.id)).toBe(true);
    s.host.setExhausted(s.room, tome.id, false);
    const hand = boardOf(s, "p1").hand.length;
    activate(s, "p1", tome, "activated:1").expectOk();
    resolveTop(s);
    expect(empowered(s, tome.id)).toBe(false);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
  });

  it("[C:Hextech Disc][R827.1.c.1][R357.2] Disempower, [1], [Tap]: play a 3 Might Mech to base", () => {
    const s = withCards(["Hextech Disc"]);
    const disc = place(s, "p1", "Hextech Disc", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 1);
    activate(s, "p1", disc, "activated:0").expectOk();
    resolveTop(s);
    s.host.setExhausted(s.room, disc.id, false);
    activate(s, "p1", disc, "activated:1").expectOk();
    resolveTop(s);
    expect(empowered(s, disc.id)).toBe(false);
    expect(boardOf(s, "p1").base.some((c) => c.name === "Mech")).toBe(true);
  });
});
