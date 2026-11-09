/**
 * Unleashed (UNL) batch 10 — remaining spells, gear, units and keyword suppression.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords, effectiveMight } from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, hand, nextOwnTurn, resolveChain, settle, withCards } from "./helpers";

const say = (answer: string) => (prompt: { options?: Array<{ id: string }> }) =>
  prompt.options?.some((option) => option.id === answer) ? [answer] : undefined;

describe("Unleashed batch 10 — spells", () => {
  it("[C:Call to Battle][R421][R355.18] move a unit you control to a battlefield you control; then the opponent moves a unit there", () => {
    const s = withCards(["Call to Battle"]);
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = place(s, "p2", "Astral Heron", "base");
    fund(s, "p1", "Call to Battle");
    s.as("p1")
      .play("Call to Battle", {
        choices: { battlefield: "battlefield:battlefieldA", "target:0": mine.id },
      })
      .expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === theirs.id) ? [theirs.id] : undefined,
      until: () => zoneOf(s, theirs.id) === "battlefieldA",
    });
    expect(zoneOf(s, mine.id)).toBe("battlefieldA");
    expect(zoneOf(s, theirs.id)).toBe("battlefieldA");
  });

  it("[C:Call to Battle][R190.2] a battlefield you don't control is not a legal choice", () => {
    const s = withCards(["Call to Battle"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Call to Battle");
    const result = s.as("p1").play("Call to Battle", {
      choices: { battlefield: "battlefield:battlefieldA", "target:0": mine.id },
    });
    expect(result.lastError()).toBeTruthy();
  });

  it("[C:Death from Below][R429] kills a unit at a battlefield", () => {
    const s = withCards(["Death from Below"]);
    const victim = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const safe = place(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "Death from Below");
    s.as("p1")
      .play("Death from Below", { choices: { "target:0": victim.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(zoneOf(s, safe.id)).toBe("base");
    const illegal = withCards(["Death from Below"]);
    const atBase = place(illegal, "p2", "Treasure Hunter", "base");
    fund(illegal, "p1", "Death from Below");
    expect(
      illegal
        .as("p1")
        .play("Death from Below", { choices: { "target:0": atBase.id } })
        .lastError(),
    ).toBeTruthy();
  });

  it("[C:Dancing Grenade][R418] deals 2 to a unit", () => {
    const s = withCards(["Dancing Grenade"]);
    const unit = place(s, "p2", "Whiteflame Protector", "base");
    fund(s, "p1", "Dancing Grenade");
    s.as("p1")
      .play("Dancing Grenade", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[unit.id]?.damage).toBe(2);
  });

  it("[C:Deadly Flourish][R813] the catalog's [Reaction] is Gold's reminder text: the spell cannot be played on the opponent's turn", () => {
    const s = withCards(["Deadly Flourish"], [], { firstPlayer: "p2" });
    const victim = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Deadly Flourish");
    const result = s.as("p1").play("Deadly Flourish", { choices: { "target:0": victim.id } });
    expect(result.lastError()).toBeTruthy();
  });
});

describe("Unleashed batch 10 — gear and units", () => {
  it("[C:Shard of Undoing][R383.3.e][R315.2.a.1] the first time a friendly unit dies in your Beginning Phase each turn, each opponent kills a unit", () => {
    const s = withCards(["Shard of Undoing"], [], { battlefields: { p1: "Frozen Fortress" } });
    place(s, "p1", "Shard of Undoing", "base");
    // Frozen Fortress deals 1 to each unit here at the start of the Beginning Phase: both die.
    const a = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const b = place(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const x = place(s, "p2", "Caitlyn, Patrolling", "base");
    const y = place(s, "p2", "Astral Heron", "base");
    settle(s, {
      onPrompt: (prompt) => (prompt.options?.some((o) => o.id === x.id) ? [x.id] : undefined),
    });
    expect(zoneOf(s, a.id)).toBe("trash");
    expect(zoneOf(s, b.id)).toBe("trash");
    // Two friendly units died, but the trigger is once per turn: exactly one enemy unit is killed.
    expect(zoneOf(s, x.id)).toBe("trash");
    expect(zoneOf(s, y.id)).toBe("base");
  });

  it("[C:Shard of Undoing][R383.3.e] a friendly unit dying outside your Beginning Phase does nothing", () => {
    const s = withCards(["Shard of Undoing", "Hextech Ray"]);
    place(s, "p1", "Shard of Undoing", "base");
    const mine = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const theirs = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": mine.id } })
      .expectOk();
    resolveChain(s);
    settle(s);
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(zoneOf(s, theirs.id)).toBe("base");
  });

  it("[C:Katarina, Reckless][R811][R416] when you hide a card, ready me", () => {
    const s = withCards(["Katarina, Reckless", "Smoke and Mirrors"]);
    const kat = place(s, "p1", "Katarina, Reckless", "battlefieldA", { exhausted: true });
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const gust = s.handCard("p1", "Smoke and Mirrors")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: gust.id, hide: true, location: "battlefieldA" } as never)
      .expectOk();
    settle(s);
    expect(cardsNamed(s, "p1", "battlefieldA", "Katarina, Reckless")[0]!.exhausted).toBe(false);
    void kat;
  });

  it("[C:Elder Dragon][R418] when you play me, deal 1 to up to one enemy unit at each location", () => {
    const s = withCards(["Elder Dragon"]);
    const atBase = place(s, "p2", "Caitlyn, Patrolling", "base");
    const otherAtBase = place(s, "p2", "Treasure Hunter", "base");
    const atA = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Elder Dragon");
    s.as("p1").play("Elder Dragon").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === atBase.id)
          ? [atBase.id]
          : prompt.options?.some((o) => o.id === atA.id)
            ? [atA.id]
            : [],
    });
    const damage = (id: string) => s.room.rules!.objects[id]?.damage ?? 0;
    expect(damage(atBase.id)).toBe(1);
    expect(damage(atA.id)).toBe(1);
    expect(damage(otherAtBase.id)).toBe(0);
  });

  it("[C:Yeti Brawler][R727.1.b][R135.2.e.7] the catalog's [Reaction]/[Add] are Gold's reminder text: not a Reaction unit", () => {
    const s = withCards(["Yeti Brawler"]);
    const yeti = place(s, "p1", "Yeti Brawler", "base");
    expect(effectiveKeywords(s.room, yeti.id, s.host)).not.toContain("Reaction");
    expect(effectiveKeywords(s.room, yeti.id, s.host)).not.toContain("Add");
  });

  it("[C:Wily Newtfish][R727.1.b] the catalog's [Ganking] is conditional text: a plain 4 Might unit", () => {
    const s = withCards(["Wily Newtfish"]);
    const fish = place(s, "p1", "Wily Newtfish", "base");
    expect(effectiveKeywords(s.room, fish.id, s.host)).not.toContain("Ganking");
    expect(effectiveMight(s.room, fish.id, s.host)).toBe(4);
  });
});

describe("Unleashed batch 10 — strengthened checks", () => {
  it("[C:Blue Sentinel][R390][R430] when I hold, exactly one Rune is added at the start of the next Main Phase", () => {
    const s = withCards(["Blue Sentinel"]);
    place(s, "p1", "Blue Sentinel", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    nextOwnTurn(s);
    settle(s);
    const pool = s.room.rules!.pools.p1!;
    const power = Object.values(pool.power).reduce((sum, n) => sum + (n ?? 0), 0);
    expect(power).toBe(1);
  });

  it("[C:Hwei, Brooding Painter][R423][R414] a discarded spell draws 1; a discarded gear readies up to 2 runes", () => {
    const spellRun = withCards(["Hwei, Brooding Painter", "Gust"]);
    place(spellRun, "p1", "Hwei, Brooding Painter", "base");
    const gust = spellRun.handCard("p1", "Gust")!;
    const handBefore = hand(spellRun, "p1").length;
    spellRun.as("p1").move("Hwei, Brooding Painter", "battlefieldB").expectOk();
    settle(spellRun, {
      onPrompt: (prompt) => (prompt.options?.some((o) => o.id === gust.id) ? [gust.id] : undefined),
      until: () => zoneOf(spellRun, gust.id) === "trash" && spellRun.room.rules!.chain.length === 0,
    });
    expect(zoneOf(spellRun, gust.id)).toBe("trash");
    // +1 (draw) -1 (discard) +1 (spell) relative to the start.
    expect(hand(spellRun, "p1").length).toBe(handBefore + 1);

    const gearRun = withCards(["Hwei, Brooding Painter", "Sumpworks Map"]);
    place(gearRun, "p1", "Hwei, Brooding Painter", "base");
    const gear = gearRun.handCard("p1", "Sumpworks Map")!;
    const runes = boardOf(gearRun, "p1").runeArea;
    for (const rune of runes.slice(0, 2)) gearRun.host.setExhausted(gearRun.room, rune.id, true);
    gearRun.as("p1").move("Hwei, Brooding Painter", "battlefieldB").expectOk();
    settle(gearRun, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === gear.id)
          ? [gear.id]
          : prompt.kind === "choose-card"
            ? prompt.options?.slice(0, 2).map((o) => o.id)
            : undefined,
      until: () => zoneOf(gearRun, gear.id) === "trash" && gearRun.room.rules!.chain.length === 0,
    });
    const ready = boardOf(gearRun, "p1").runeArea.filter((rune) => !rune.exhausted).length;
    expect(ready).toBe(runes.length);
    void say;
  });
});
