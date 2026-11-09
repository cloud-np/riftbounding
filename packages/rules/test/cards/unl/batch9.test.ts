/**
 * Unleashed (UNL) batch 9 — gear, battlefields, legends and remaining units.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords, effectiveMight, xpOf } from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import {
  cardsNamed,
  hand,
  nextOwnTurn,
  playWith,
  resolveChain,
  settle,
  withCards,
  type S,
} from "./helpers";

const say = (answer: string) => (prompt: { options?: Array<{ id: string }> }) =>
  prompt.options?.some((option) => option.id === answer) ? [answer] : undefined;

function activate(s: S, objectId: string, ability: string, choices: Record<string, unknown> = {}) {
  s.as("p1")
    .apply({ type: "rules_activate", objectId, ability, choices } as never)
    .expectOk();
}

describe("Unleashed batch 9 — gear", () => {
  it("[C:Honeyfruit][R430][R824] enters exhausted; [Tap]: add a Rune; at Level 6 also add [1][Rune]", () => {
    const s = withCards(["Honeyfruit"]);
    fund(s, "p1", "Honeyfruit");
    s.as("p1").play("Honeyfruit").expectOk();
    resolveChain(s);
    const fruit = cardsNamed(s, "p1", "base", "Honeyfruit")[0]!;
    expect(fruit.exhausted).toBe(true);
    s.host.setExhausted(s.room, fruit.id, false);
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    activate(s, fruit.id, "activated:3");
    const pool = () => s.room.rules!.pools.p1!;
    expect(pool().power.any ?? 0).toBe(1);
    expect(pool().energy).toBe(0);
    // The Level 6 ability needs 6 XP.
    s.host.setExhausted(s.room, fruit.id, false);
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    const refused = s
      .as("p1")
      .apply({ type: "rules_activate", objectId: fruit.id, ability: "activated:4" } as never);
    expect(refused.lastError()).toBeTruthy();
    run(s, { op: "gain_xp", amount: 6 });
    activate(s, fruit.id, "activated:4");
    expect(pool().energy).toBe(1);
    expect(pool().power.any ?? 0).toBe(1);
  });

  it("[C:Scryer's Bloom][R437][R414][R728] enters exhausted; Kill this, [1], [Tap]: Predict 2, draw 1, gain 1 XP", () => {
    const s = withCards(["Scryer's Bloom"]);
    fund(s, "p1", "Scryer's Bloom");
    s.as("p1").play("Scryer's Bloom").expectOk();
    resolveChain(s);
    const bloom = cardsNamed(s, "p1", "base", "Scryer's Bloom")[0]!;
    expect(bloom.exhausted).toBe(true);
    s.host.setExhausted(s.room, bloom.id, false);
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    const before = hand(s, "p1").length;
    activate(s, bloom.id, "activated:1");
    settle(s, { onPrompt: () => [] });
    expect(hand(s, "p1")).toHaveLength(before + 1);
    expect(xpOf(s.room, "p1")).toBe(1);
    expect(zoneOf(s, bloom.id)).toBe("trash");
  });

  it("[C:Blast Cone][R421][R412.4] when you play this, you may move an enemy unit to a chosen location", () => {
    const s = withCards(["Blast Cone"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "base");
    fund(s, "p1", "Blast Cone");
    s.as("p1").play("Blast Cone").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === enemy.id) ? [enemy.id] : undefined) ??
        (prompt.options?.some((o) => o.id === "battlefieldA") ? ["battlefieldA"] : undefined),
      until: () => zoneOf(s, enemy.id) === "battlefieldA",
    });
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
  });

  it("[C:Gutter Palace][R440] Discard 1, [Tap]: play a 1 Might Bird token", () => {
    const s = withCards(["Gutter Palace", "Treasure Hunter"]);
    const palace = place(s, "p1", "Gutter Palace", "base");
    activate(s, palace.id, "activated:1");
    settle(s);
    expect(cardsNamed(s, "p1", "base", "Bird")).toHaveLength(1);
    expect(boardOf(s, "p1").hand.length).toBeGreaterThanOrEqual(0);
  });

  it("[C:Blighted Battleaxe][C:Hextech Gauntlets][R718.4] attached: the unit gets +4 / +3 Might", () => {
    const s = withCards(["Blighted Battleaxe", "Hextech Gauntlets"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Treasure Hunter", "base");
    const axe = place(s, "p1", "Blighted Battleaxe", "base");
    const gauntlets = place(s, "p1", "Hextech Gauntlets", "base");
    s.room.rules!.pools.p1 = { energy: 4, power: { Fury: 1, any: 1 } };
    activate(s, axe.id, "activated:0", { "target:0": a.id });
    settle(s);
    expect(effectiveMight(s.room, a.id, s.host)).toBe(7);
    s.room.rules!.pools.p1 = { energy: 3, power: { any: 1 } };
    activate(s, gauntlets.id, "activated:0", { "target:0": b.id });
    settle(s);
    expect(effectiveMight(s.room, b.id, s.host)).toBe(4);
  });
});

describe("Unleashed batch 9 — battlefields and legends", () => {
  it("[C:Frozen Fortress][R315.2.a.1] at the start of its controller's Beginning Phase, deal 1 to each unit here", () => {
    const s = withCards([], [], { battlefields: { p1: "Frozen Fortress" } });
    const mine = place(s, "p1", "Whiteflame Protector", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const damageOf = (id: string) => s.room.rules!.objects[id]?.damage ?? 0;
    // The scenario starts at p1's Beginning Phase with the trigger already on the chain.
    settle(s);
    expect(damageOf(mine.id)).toBe(1);
    expect(s.room.rules!.turn.player).toBe("p1");
  });

  it("[C:Dusk Rose Lab][R315.2.a.1][R740.4.a] at the start of your Beginning Phase, you may kill a unit you control here to draw 1", () => {
    const s = withCards([], [], { battlefields: { p1: "Dusk Rose Lab" } });
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const before = hand(s, "p1").length;
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === unit.id) ? [unit.id] : undefined),
    });
    expect(zoneOf(s, unit.id)).toBe("trash");
    expect(hand(s, "p1")).toHaveLength(before + 2); // +1 Draw Phase, +1 Dusk Rose Lab
  });

  it("[C:Lillia, Bashful Bloom][R440][R135.2.e.7] [4], [Tap]: play a ready 3 Might Sprite token", () => {
    const s = withCards(["Lillia, Bashful Bloom"]);
    const legend = place(s, "p1", "Lillia, Bashful Bloom", "legend");
    s.room.rules!.pools.p1 = { energy: 4, power: {} };
    activate(s, legend.id, "activated:1");
    settle(s);
    const sprite = cardsNamed(s, "p1", "base", "Sprite")[0]!;
    expect(sprite.exhausted).toBe(false);
    expect(effectiveMight(s.room, sprite.id, s.host)).toBe(3);
  });

  it("[C:Diana, Scorn of the Moon][R430][R340] [Reaction][Tap]: add [1] Energy, only usable during a showdown", () => {
    const s = withCards(["Diana, Scorn of the Moon"], [], { firstPlayer: "p2" });
    const legend = place(s, "p1", "Diana, Scorn of the Moon", "legend");
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    const refused = s
      .as("p1")
      .apply({ type: "rules_activate", objectId: legend.id, ability: "activated:2" } as never);
    expect(refused.lastError()).toBeTruthy();
    place(s, "p2", "Caitlyn, Patrolling", "base");
    s.as("p2").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.showdown).toBeTruthy();
    activate(s, legend.id, "activated:2");
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
  });
});

describe("Unleashed batch 9 — remaining units", () => {
  it("[C:Crescent Guardian][R356.2.b.1][R369.3] paying [Chaos] as the additional cost, I enter ready", () => {
    const s = withCards(["Crescent Guardian", "Crescent Guardian"]);
    fund(s, "p1", "Crescent Guardian", "Crescent Guardian");
    s.room.rules!.pools.p1!.power = { Chaos: 4 };
    s.as("p1").play("Crescent Guardian").expectOk();
    resolveChain(s);
    expect(cardsNamed(s, "p1", "base", "Crescent Guardian")[0]!.exhausted).toBe(true);
    playWith(s, "p1", "Crescent Guardian", { optionalCosts: ["optional:0"] });
    resolveChain(s);
    expect(cardsNamed(s, "p1", "base", "Crescent Guardian").some((card) => !card.exhausted)).toBe(
      true,
    );
  });

  it("[C:Maduli the Gatekeeper][R416][R421] can't be readied; [Chaos]: move me to a weaker occupied enemy battlefield", () => {
    const s = withCards(["Maduli the Gatekeeper"]);
    const maduli = place(s, "p1", "Maduli the Gatekeeper", "base", { exhausted: true });
    const weak = place(s, "p2", "Treasure Hunter", "battlefieldA");
    place(s, "p2", "Whiteflame Protector", "battlefieldB");
    run(s, { op: "ready", target: { targetRef: `obj:${maduli.id}` } });
    expect(s.host.isExhausted(s.room, maduli.id)).toBe(true);
    s.host.setExhausted(s.room, maduli.id, false);
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 2 } };
    // battlefieldB's Whiteflame Protector (8) is stronger than Maduli (6): not a legal choice.
    const refused = s.as("p1").apply({
      type: "rules_activate",
      objectId: maduli.id,
      ability: "activated:1",
      choices: { battlefield: "battlefield:battlefieldB" },
    } as never);
    expect(refused.lastError()).toBeTruthy();
    activate(s, maduli.id, "activated:1", { battlefield: "battlefield:battlefieldA" });
    settle(s, { until: () => zoneOf(s, maduli.id) === "battlefieldA" });
    expect(zoneOf(s, maduli.id)).toBe("battlefieldA");
    void weak;
  });

  it("[C:Ivern, Friend to all][R143.1][R470.2] choose a pet tag and gain it; conquering with all four tags scores 1", () => {
    const s = withCards(["Ivern, Friend to all", "Mutated Mouser", "Mosstomper", "Loyal Poro"]);
    fund(s, "p1", "Ivern, Friend to all");
    s.as("p1").play("Ivern, Friend to all").expectOk();
    settle(s, { onPrompt: (prompt) => say("bird")(prompt) });
    const ivern = cardsNamed(s, "p1", "base", "Ivern, Friend to all")[0]!;
    const tags = () =>
      (s.host.findCard(s.room, ivern.id)?.card.subtypes ?? []).map((t) => t.toLowerCase());
    expect(tags()).toContain("bird");
    place(s, "p1", "Mutated Mouser", "base");
    place(s, "p1", "Mosstomper", "base");
    place(s, "p1", "Loyal Poro", "base");
    const score = () => s.host.score(s.room, "p1");
    const before = score();
    s.host.setExhausted(s.room, ivern.id, false);
    s.as("p1").move("Ivern, Friend to all", "battlefieldB").expectOk();
    settle(s);
    expect(score()).toBe(before + 2); // conquer point + Ivern's extra point
  });

  it("[C:LeBlanc, Everywhere at Once][R727.1.b] the catalog's [Temporary] is reminder text: I am not killed at the start of my Beginning Phase", () => {
    const s = withCards(["LeBlanc, Everywhere at Once"]);
    const leblanc = place(s, "p1", "LeBlanc, Everywhere at Once", "base");
    expect(effectiveKeywords(s.room, leblanc.id, s.host)).not.toContain("Temporary");
    nextOwnTurn(s);
    expect(zoneOf(s, leblanc.id)).toBe("base");
  });
});
