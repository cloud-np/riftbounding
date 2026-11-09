import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { explainIllegal } from "../../src";
import { clearCardScripts, registerTestCardScript, registerTestCardScripts } from "../../src/testing";
import { scenario } from "../scenarios/dsl";

// R2-effects: Treasure Hunter's printed "When I move, play a Gold gear token exhausted" now
// triggers (383 / 402.1) and keeps the state Closed until it resolves. This suite uses it as a
// vanilla unit for timing/showdown mechanics, so it overrides the production script (the trigger
// itself is covered by test/cards/fixture-deck.test.ts).
beforeAll(() => registerTestCardScript({ name: "Treasure Hunter", text: "vanilla (test)", status: "implemented", abilities: [] }));

function noop(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

beforeAll(() =>
  registerTestCardScripts([noop("Rebuke", "[ACTION] test"), noop("Defy", "[REACTION] test")]),
);
afterAll(() => clearCardScripts());

describe("timing rejections [R309][R410][R806][R813]", () => {
  it("[R410] the non-turn player cannot play a card in Neutral Open", () => {
    const s = scenario({ p2: { hand: ["Defy"] } });
    const defy = s.handCard("p2", "Defy")!;
    const verdict = explainIllegal(s.room, "p2", { type: "rules_play", cardId: defy.id }, s.host);
    expect(verdict).toMatchObject({ ok: false, code: "not_your_priority" });
  });

  it("[R309.1.a] a non-Reaction card is not legally timed in a Closed State", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    s.as("p1").play("Rebuke").expectOk();
    const unit = s.handCard("p2", "Caitlyn, Patrolling")!;
    const verdict = explainIllegal(s.room, "p2", { type: "rules_play", cardId: unit.id }, s.host);
    expect(verdict).toMatchObject({ ok: false, code: "closed_state_requires_reaction" });
    if (!verdict.ok) expect(verdict.rule).toBe("309.1.a");
  });

  it("[R806][R813] a Reaction is legally timed in a Closed State", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    s.as("p1").play("Rebuke").expectOk();
    const defy = s.handCard("p2", "Defy")!;
    expect(explainIllegal(s.room, "p2", { type: "rules_play", cardId: defy.id }, s.host).ok).toBe(
      true,
    );
  });

  it("[R316.9] only the Turn Player with Priority can end the turn", () => {
    const s = scenario({ p2: { hand: ["Defy"] } });
    expect(explainIllegal(s.room, "p2", { type: "rules_end_turn" }, s.host)).toMatchObject({
      ok: false,
      code: "not_your_turn",
    });
    expect(explainIllegal(s.room, "p1", { type: "rules_end_turn" }, s.host).ok).toBe(true);
  });

  it("[R144.4.c] a Battlefield → Battlefield move without Ganking is illegal", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    // Resolve the showdown so the move is legal again (Neutral Open).
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1");
    const moved = s.findBoardCard("Treasure Hunter")!;
    moved.exhausted = false;
    const verdict = explainIllegal(
      s.room,
      "p1",
      { type: "rules_move", unitIds: [moved.id], to: "battlefieldB" },
      s.host,
    );
    expect(verdict).toMatchObject({ ok: false, code: "invalid_location" });
    if (!verdict.ok) expect(verdict.rule).toBe("144.4.c");
  });

  it("[R144.1.b] a Move in a Closed State is chain_not_empty, not a Reaction requirement", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter", "Rebuke"], energy: 4, power: { Chaos: 2 } },
    });
    s.as("p1").play("Treasure Hunter").expectOk();
    s.findBoardCard("Treasure Hunter")!.exhausted = false;
    // 337.4 + hold: P1 keeps Priority while the Chain is open.
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    s.as("p1").apply({ type: "rules_move", unitIds: [unit.id], to: "battlefieldA" });
    expect(s.lastError()).toEqual({ code: "chain_not_empty", rule: "144.1.b" });
  });

  it("[R420.1.a] cards can only be played from hand or the Chosen Champion zone", () => {
    const s = scenario();
    const anyCard = s.room.players[0]!.board!.deck[0]!;
    expect(
      explainIllegal(s.room, "p1", { type: "rules_play", cardId: anyCard.id }, s.host),
    ).toMatchObject({
      ok: false,
      code: "not_in_hand",
    });
  });
});

describe("play locations [R355.2][R355.2.a][R358.5][R359.2.d]", () => {
  it("[R355.2.a][R358.5] a Unit cannot be played to an uncontrolled Battlefield and nothing is mutated", () => {
    const s = scenario({ p1: { hand: ["Astral Heron"], energy: 7 } });
    const heron = s.handCard("p1", "Astral Heron")!;
    const intent = { type: "rules_play", cardId: heron.id, location: "battlefieldB" } as const;

    const explained = explainIllegal(s.room, "p1", intent, s.host);
    expect(explained).toMatchObject({ ok: false, code: "invalid_location" });
    if (!explained.ok) expect(explained.rule).toBe("355.2.a");

    s.as("p1").apply(intent);
    expect(s.lastError()).toEqual({ code: "invalid_location", rule: "355.2.a" });
    // 358.5: the play is cancelled, not silently redirected to Base.
    expect(s.handCard("p1", "Astral Heron")?.id).toBe(heron.id);
    expect(s.room.rules?.chain.length).toBe(0);
    const board = s.room.players[0]!.board!;
    expect(board.base.some((card) => card.id === heron.id)).toBe(false);
    expect(board.battlefieldB.some((card) => card.id === heron.id)).toBe(false);
  });

  it("[R355.2.a] a Unit may be played to a Battlefield the controller controls", () => {
    const s = scenario({ p1: { hand: ["Astral Heron"], energy: 7 } });
    // A Unit at the Battlefield is R1's control proxy (323.5).
    s.placeFromDeck("p1", "Treasure Hunter", "battlefieldA");
    s.as("p1").play("Astral Heron", { location: "battlefieldA" }).expectOk();
    const board = s.room.players[0]!.board!;
    expect(board.battlefieldA.some((card) => card.name === "Astral Heron")).toBe(true);
    expect(board.base.some((card) => card.name === "Astral Heron")).toBe(false);
  });

  it("[R359.2.d] a Non-Unit Gear always enters at Base and cannot be placed at a Battlefield", () => {
    const s = scenario({
      p1: { hand: ["Blade of the Exile"], energy: 3, power: { Calm: 1, Chaos: 1 } },
    });
    s.placeFromDeck("p1", "Treasure Hunter", "battlefieldA");
    const blade = s.handCard("p1", "Blade of the Exile")!;

    const explained = explainIllegal(
      s.room,
      "p1",
      { type: "rules_play", cardId: blade.id, location: "battlefieldA" },
      s.host,
    );
    expect(explained).toMatchObject({ ok: false, code: "invalid_location" });
    if (!explained.ok) expect(explained.rule).toBe("359.2.d");

    s.as("p1").play("Blade of the Exile", { location: "battlefieldA" });
    expect(s.lastError()).toEqual({ code: "invalid_location", rule: "359.2.d" });
    expect(s.handCard("p1", "Blade of the Exile")?.id).toBe(blade.id);
  });

  it("[R359.2.d] a Non-Unit Gear with no location enters the Board Ready at Base", () => {
    const s = scenario({
      p1: { hand: ["Blade of the Exile"], energy: 3, power: { Calm: 1, Chaos: 1 } },
    });
    s.as("p1").play("Blade of the Exile").expectOk();
    const board = s.room.players[0]!.board!;
    expect(board.base.some((card) => card.name === "Blade of the Exile")).toBe(true);
    expect(board.battlefieldA.some((card) => card.name === "Blade of the Exile")).toBe(false);
  });
});
