/**
 * Unleashed (UNL) batch 8 — holds, looks, hand tricks, gear and battlefields.
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

/** p1 controls battlefieldA with `name` there at the start of its next turn (hold, 383.4.d). */
function holdWith(s: S, name: string): ReturnType<typeof place> {
  const unit = place(s, "p1", name, "battlefieldA");
  s.room.rules!.objects.battlefieldA = { controller: "p1" };
  nextOwnTurn(s);
  return unit;
}

describe("Unleashed batch 8 — holds and delayed triggers", () => {
  it("[C:Blue Sentinel][R390][R430] when I hold, add a Rune at the start of your next Main Phase", () => {
    const s = withCards(["Blue Sentinel"]);
    const before = s.room.rules!.pools.p1?.power?.any ?? 0;
    place(s, "p1", "Blue Sentinel", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    nextOwnTurn(s);
    settle(s);
    const pool = s.room.rules!.pools.p1!;
    const total = Object.values(pool.power).reduce((sum, n) => sum + (n ?? 0), 0);
    expect(total).toBeGreaterThan(before);
    expect(
      effectiveKeywords(s.room, s.findBoardCardAnywhere("Blue Sentinel")!.id, s.host),
    ).toContain("Shield");
  });

  it("[C:Iascylla][R390][R421] when I hold, at the start of your next Main Phase you may move an enemy unit here", () => {
    const s = withCards(["Iascylla"]);
    const enemy = place(s, "p2", "Treasure Hunter", "base");
    place(s, "p1", "Iascylla", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === enemy.id) ? [enemy.id] : undefined),
      until: () => zoneOf(s, enemy.id) === "battlefieldA",
    });
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
  });

  it("[C:Ashe, Focused][R425][R428][R393] reveal their hand, banish a card; when they hold it returns to their hand", () => {
    const s = withCards(["Ashe, Focused"], ["Treasure Hunter"]);
    fund(s, "p1", "Ashe, Focused");
    const target = s.handCard("p2", "Treasure Hunter")!;
    s.as("p1").play("Ashe, Focused").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === target.id) ? [target.id] : undefined,
    });
    expect(zoneOf(s, target.id)).toBe("banished");
    // p2 holds a battlefield at the start of its turn: the card returns to its hand.
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    s.room.rules!.objects.battlefieldB = { controller: "p2" };
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(zoneOf(s, target.id)).toBe("hand");
  });
});

describe("Unleashed batch 8 — look, hand and play effects", () => {
  it("[C:Rift Herald][R425][R414][R417] when I move to a battlefield, look at the top 3, reveal a unit and draw it; recycle the rest", () => {
    const s = withCards(["Rift Herald"]);
    place(s, "p1", "Rift Herald", "base");
    const deck = boardOf(s, "p1").deck;
    const unit = deck.splice(
      deck.findIndex((card) => card.name === "Treasure Hunter"),
      1,
    )[0]!;
    deck.push(unit); // the end of the array is the top of the deck
    s.as("p1").move("Rift Herald", "battlefieldB").expectOk();
    settle(s, {
      onPrompt: (prompt) => (prompt.options?.some((o) => o.id === unit.id) ? [unit.id] : undefined),
      until: () => zoneOf(s, unit.id) === "hand",
    });
    expect(zoneOf(s, unit.id)).toBe("hand");
  });

  it("[C:Insightful Investigator][R425][R423] pay 2 XP: the chosen card from their hand is discarded and they draw 1", () => {
    const s = withCards(["Insightful Investigator"], ["Treasure Hunter"]);
    run(s, { op: "gain_xp", amount: 2 });
    fund(s, "p1", "Insightful Investigator");
    const target = s.handCard("p2", "Treasure Hunter")!;
    const before = hand(s, "p2").length;
    s.as("p1").play("Insightful Investigator").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === target.id) ? [target.id] : undefined),
    });
    expect(zoneOf(s, target.id)).toBe("trash");
    expect(hand(s, "p2")).toHaveLength(before);
    expect(xpOf(s.room, "p1")).toBe(0);
  });

  it("[C:Hwei, Brooding Painter][R423][R414][R479.4] when I move: draw 1, discard 1; a discarded unit gives me +3 Might", () => {
    const s = withCards(["Hwei, Brooding Painter", "Treasure Hunter"]);
    const hwei = place(s, "p1", "Hwei, Brooding Painter", "base");
    const fodder = s.handCard("p1", "Treasure Hunter")!;
    s.as("p1").move("Hwei, Brooding Painter", "battlefieldB").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === fodder.id) ? [fodder.id] : undefined,
      until: () => zoneOf(s, fodder.id) === "trash",
    });
    expect(zoneOf(s, fodder.id)).toBe("trash");
    expect(effectiveMight(s.room, hwei.id, s.host)).toBe(8);
    void boardOf;
  });

  it("[C:Diana, Lunari][R437][R425][R414] when a showdown begins here, pay 1 to Predict, reveal the top card; a spell is drawn", () => {
    const s = withCards(["Diana, Lunari", "Moonlight Affliction"], [], { firstPlayer: "p2" });
    place(s, "p1", "Diana, Lunari", "battlefieldA");
    const spell = s.handCard("p1", "Moonlight Affliction")!;
    const board = boardOf(s, "p1");
    board.deck.push(
      ...board.hand.splice(
        board.hand.findIndex((card) => card.id === spell.id),
        1,
      ),
    );
    place(s, "p2", "Treasure Hunter", "base");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p2").move("Treasure Hunter", "battlefieldA").expectOk();
    settle(s, {
      onPrompt: (prompt) => say("yes")(prompt) ?? [],
      until: () => zoneOf(s, spell.id) === "hand",
    });
    expect(zoneOf(s, spell.id)).toBe("hand");
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Diana, Lunari][R425] a revealed non-spell stays on top of the deck", () => {
    const s = withCards(["Diana, Lunari"], [], { firstPlayer: "p2" });
    place(s, "p1", "Diana, Lunari", "battlefieldA");
    const board = boardOf(s, "p1");
    const unit = board.deck.splice(
      board.deck.findIndex((card) => card.name === "Treasure Hunter"),
      1,
    )[0]!;
    board.deck.push(unit); // the end of the array is the top of the deck
    place(s, "p2", "Treasure Hunter", "base");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p2").move("Treasure Hunter", "battlefieldA").expectOk();
    settle(s, { onPrompt: (prompt) => say("yes")(prompt) ?? [], guard: 12 });
    expect(zoneOf(s, unit.id)).toBe("deck");
  });
});
