/**
 * RAD battlefields, Bomb makers and the remaining automatable cards (wave R3).
 */
import { describe, expect, it } from "vitest";
import {
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
} from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import { answer, namesIn, put, resolveAll, settle, withCards, withDeck, type S } from "./helpers";

function unit(s: S, player: string, name: string, zone: string, might: number, exhausted = false) {
  const card = put(s, player, name, zone, exhausted);
  s.room.rules!.objects[card.id] = { ...(s.room.rules!.objects[card.id] ?? {}), baseMight: might };
  return card;
}

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

/** Step through prompts (first option) and passes until `done` holds or nothing is pending. */
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

const bombs = (s: S, player: string, zone: string) =>
  namesIn(s, player, zone).filter((name) => name === "Bomb").length;

describe("RAD battlefields", () => {
  it("[C:Bandle Scouts' Academy][R422][R811.1.b] When you hide a card here, play an exhausted Gold", () => {
    const s = withCards(["The Waters' Wage"], [], {
      battlefields: { p1: "Bandle Scouts' Academy" },
    });
    unit(s, "p1", "Treasure Hunter", "battlefieldA", 1);
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    const card = s.handCard("p1", "The Waters' Wage")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: card.id, hide: true, location: "battlefieldA" } as never)
      .expectOk();
    settle(s);
    const golds = boardOf(s, "p1").base.filter((entry) => entry.name === "Gold");
    expect(golds).toHaveLength(1);
    expect(golds[0]!.exhausted).toBe(true);
  });

  it("[C:Black Rose Sanctum][R383.1.b][R185] the first non-token unit of each player dying here each turn gives a Recruit", () => {
    const s = withCards(["Avalanche", "Supernova", "Supernova"], [], {
      battlefields: { p1: "Black Rose Sanctum" },
    });
    const first = unit(s, "p2", "Treasure Hunter", "battlefieldA", 1);
    const second = unit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", 3);
    fund(s, "p1", "Supernova");
    s.as("p1")
      .play("Supernova", { choices: { "target:0": first.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(namesIn(s, "p2", "base").filter((name) => name === "Recruit")).toHaveLength(1);
    fund(s, "p1", "Supernova");
    s.as("p1")
      .play("Supernova", { choices: { "target:0": second.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(zoneOf(s, second.id)).toBe("trash");
    expect(namesIn(s, "p2", "base").filter((name) => name === "Recruit")).toHaveLength(1);
  });

  it("[C:Cosmic Vista][R383.2.a.1][R470.2] When you hold here with an empty Rune Deck, score 1 point", () => {
    const s = withDeck([], [], { battlefields: { p1: "Cosmic Vista" } });
    unit(s, "p1", "Treasure Hunter", "battlefieldA", 1);
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    boardOf(s, "p1").runeDeck.splice(0);
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    // Hold (1) + Cosmic Vista (1).
    s.expectScore("p1", 2);
  });

  it("[C:Durand Memorial][R383.4.f][R815] When you defend here, a unit you control here gets Tank this combat", () => {
    const s = withDeck([], [], { battlefields: { p1: "Durand Memorial" } });
    const defender = unit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", 3);
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    unit(s, "p2", "Astral Heron", "base", 7);
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    s.as("p2").move("Astral Heron", "battlefieldA").expectOk();
    drive(s, () => effectiveKeywords(s.room, defender.id, s.host).includes("Tank"), 12);
    expect(effectiveKeywords(s.room, defender.id, s.host)).toContain("Tank");
  });

  it("[C:Rakelstake][R437][R440.2.c] the first unit or gear a player plays here each turn: they Predict", () => {
    const s = withCards(["Banner of Conquest", "Pillaged Armory"], [], {
      battlefields: { p1: "Rakelstake" },
    });
    fund(s, "p1", "Banner of Conquest");
    s.as("p1").play("Banner of Conquest", { location: "battlefieldA" }).expectOk();
    settle(s);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
    answer(s, []);
    resolveAll(s);
    fund(s, "p1", "Pillaged Armory");
    s.as("p1").play("Pillaged Armory", { location: "battlefieldA" }).expectOk();
    settle(s);
    // Only Pillaged Armory's own buff trigger (no second Predict this turn).
    expect(s.room.rules!.prompt?.rule).not.toBe("437.1");
  });

  it("[C:Ruined Monastery][R383.4.c.2.b] When you conquer here, you may discard 1 and channel 1 rune exhausted", () => {
    const s = withCards(["Gust"], [], { battlefields: { p1: "Ruined Monastery" } });
    unit(s, "p1", "Treasure Hunter", "base", 1);
    const runes = boardOf(s, "p1").runeArea.length;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    drive(s, () => boardOf(s, "p1").runeArea.length > runes);
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 1);
    expect(boardOf(s, "p1").runeArea.at(-1)!.exhausted).toBe(true);
    expect(namesIn(s, "p1", "trash")).toContain("Gust");
  });
});

describe("RAD Bomb makers (partial: the Bomb token's Deathknell is a token script)", () => {
  it("[C:Amateur Demolitionist][R440.2.c][R830.1.b] When you play me, play a Bomb gear token to a battlefield", () => {
    const s = withCards(["Amateur Demolitionist"]);
    fund(s, "p1", "Amateur Demolitionist");
    s.as("p1").play("Amateur Demolitionist").expectOk();
    settle(s);
    s.expectPrompt("choose-battlefield", "p1");
    answer(s, ["battlefieldB"]);
    settle(s);
    expect(bombs(s, "p1", "battlefieldB")).toBe(1);
    expect(getCardScript("Amateur Demolitionist")?.status).toBe("implemented");
  });

  it("[C:Explosimian][R383.4.d.2.a] When I hold, play three Bombs to a single battlefield", () => {
    const s = withDeck(["Explosimian"]);
    unit(s, "p1", "Explosimian", "battlefieldB", 6);
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    s.as("p2").endTurn().expectOk();
    drive(s, () => bombs(s, "p1", "battlefieldA") + bombs(s, "p1", "battlefieldB") === 3, 12);
    expect(bombs(s, "p1", "battlefieldA") + bombs(s, "p1", "battlefieldB")).toBe(3);
  });

  it("[C:Satchel Charge][R421][R440.2.c] move a friendly unit, then play a Bomb to a battlefield", () => {
    const s = withCards(["Satchel Charge"]);
    const mover = unit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", 3);
    fund(s, "p1", "Satchel Charge");
    s.as("p1")
      .play("Satchel Charge", {
        choices: { "target:0": mover.id, destination: "base", bomb: "battlefieldB" },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mover.id)).toBe("base");
    expect(bombs(s, "p1", "battlefieldB")).toBe(1);
  });

  it("[C:Hexplosive Minefield][R390][R393] kill any number of your Bombs; at end of turn play that many to one battlefield", () => {
    const s = withCards(["Hexplosive Minefield", "Amateur Demolitionist", "Amateur Demolitionist"]);
    for (const zone of ["battlefieldA", "battlefieldB"]) {
      fund(s, "p1", "Amateur Demolitionist");
      s.as("p1").play("Amateur Demolitionist").expectOk();
      settle(s);
      answer(s, [zone]);
      resolveAll(s);
    }
    const ids = [...boardOf(s, "p1").battlefieldA!, ...boardOf(s, "p1").battlefieldB!]
      .filter((card) => card.name === "Bomb")
      .map((card) => card.id);
    expect(ids).toHaveLength(2);
    fund(s, "p1", "Hexplosive Minefield");
    s.as("p1")
      .play("Hexplosive Minefield", { choices: { "target:0": ids } })
      .expectOk();
    s.as("p2").pass().expectOk();
    // The two Bombs' Deathknells trigger simultaneously (383.3.d): order them, then resolve.
    answer(
      s,
      s.room.rules!.prompt!.options!.map((option) => option.id),
    );
    resolveAll(s);
    expect(bombs(s, "p1", "battlefieldA") + bombs(s, "p1", "battlefieldB")).toBe(0);
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.expectPrompt("choose-battlefield", "p1");
    answer(s, ["battlefieldB"]);
    settle(s);
    expect(bombs(s, "p1", "battlefieldB")).toBe(2);
  });

  it("[C:Ziggs, Explosive][R377.1][R383.4.f] [1],[Tap]: a Bomb; when I defend you may kill a friendly gear for +2", () => {
    const s = withDeck(["Ziggs, Explosive"]);
    const ziggs = unit(s, "p1", "Ziggs, Explosive", "base", 4);
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", ziggs.id, 0, { choices: { bomb: "battlefieldA" } });
    resolveAll(s);
    expect(bombs(s, "p1", "battlefieldA")).toBe(1);
    expect(getCardScript("Ziggs, Explosive")?.status).toBe("implemented");
  });

  it("[C:Ziggs, Hexplosives Expert][R377.1] [1][A],[Tap]: play a Bomb to a battlefield", () => {
    const s = withDeck(["Ziggs, Hexplosives Expert"]);
    const ziggs = put(s, "p1", "Ziggs, Hexplosives Expert", "legend");
    s.room.rules!.pools.p1 = { energy: 1, power: { Calm: 1 } };
    activate(s, "p1", ziggs.id, 0, { choices: { bomb: "battlefieldB" } });
    resolveAll(s);
    expect(bombs(s, "p1", "battlefieldB")).toBe(1);
  });

  it("[C:Ziggs, Short-Fused][R440.2.c] When you play me, play a Bomb to a battlefield", () => {
    const s = withCards(["Ziggs, Short-Fused"]);
    fund(s, "p1", "Ziggs, Short-Fused");
    s.as("p1").play("Ziggs, Short-Fused").expectOk();
    settle(s);
    answer(s, ["battlefieldA"]);
    settle(s);
    expect(bombs(s, "p1", "battlefieldA")).toBe(1);
    expect(getCardScript("Ziggs, Short-Fused")?.status).toBe("partial");
  });
});

describe("RAD remaining automatable cards", () => {
  it("[C:Scrutinizing Scope][R355.18][R425] the opponent guesses a type: recycle on a hit, draw on a miss", () => {
    const s = withDeck(["Scrutinizing Scope", "Scrutinizing Scope"]);
    const scope = put(s, "p1", "Scrutinizing Scope", "base");
    const deck = boardOf(s, "p1").deck;
    const gust = deck.splice(
      deck.findIndex((card) => card.name === "Gust"),
      1,
    )[0]!;
    deck.push(gust);
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", scope.id);
    settle(s);
    s.expectPrompt("choose-mode", "p2");
    answer(s, ["unit"]);
    resolveAll(s);
    expect(zoneOf(s, gust.id)).toBe("hand");

    const hunter = boardOf(s, "p1").deck.splice(
      boardOf(s, "p1").deck.findIndex((card) => card.name === "Treasure Hunter"),
      1,
    )[0]!;
    boardOf(s, "p1").deck.push(hunter);
    const second = put(s, "p1", "Scrutinizing Scope", "base");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", second.id);
    settle(s);
    answer(s, ["unit"]);
    resolveAll(s);
    expect(boardOf(s, "p1").deck[0]!.id).toBe(hunter.id);
  });

  it("[C:Shimmering Swimmer][R356.2.b.1][R383.2.a.1] killing a friendly unit or gear as the optional cost: deal 2 to a unit", () => {
    const s = withCards(["Shimmering Swimmer"]);
    const fodder = put(s, "p1", "Blade of the Exile", "base");
    const enemy = unit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", 3);
    fund(s, "p1", "Shimmering Swimmer");
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: s.handCard("p1", "Shimmering Swimmer")!.id,
        optionalCosts: ["optional:0"],
        plan: { kill: [fodder.id] },
      } as never)
      .expectOk();
    expect(zoneOf(s, fodder.id)).toBe("trash");
    drive(
      s,
      () =>
        (s.room.rules!.objects[enemy.id]?.damage ?? 0) > 0 ||
        s.room.rules!.prompt?.kind === "choose-target",
    );
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [enemy.id]);
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(2);

    // Without the optional cost there is no trigger.
    const t = withCards(["Shimmering Swimmer"]);
    fund(t, "p1", "Shimmering Swimmer");
    t.as("p1").play("Shimmering Swimmer").expectOk();
    expect(t.room.rules!.chain).toHaveLength(0);
    expect(effectiveMight(t.room, t.findBoardCardAnywhere("Shimmering Swimmer")!.id, t.host)).toBe(
      3,
    );
  });
});
