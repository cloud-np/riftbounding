import { beforeAll, describe, expect, it } from "vitest";
import type { Effect } from "@rift/protocol";
import {
  evaluateAmount,
  evaluateCondition,
  makeEnv,
  matchingIds,
  registeredEffectOps,
  resolvePlayers,
  xpOf,
} from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, fund, place, registerAll, run, spell, zoneOf } from "./helpers";

const DRAW_THEN_XP: Effect = {
  op: "seq",
  effects: [
    { op: "draw", amount: 1 },
    { op: "gain_xp", amount: 2 },
  ],
};

beforeAll(() =>
  registerAll([
    spell("Rebuke", DRAW_THEN_XP, "[ACTION] test: draw 1, gain 2 XP"),
    spell(
      "Gust",
      { op: "seq", effects: [{ op: "may", effect: { op: "draw", amount: 2 } }, { op: "gain_xp", amount: 1 }] },
      "[REACTION] test: you may draw 2. Gain 1 XP.",
    ),
    spell(
      "Defy",
      {
        op: "choose_mode",
        modes: [
          { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
          { id: "xp", label: "Gain 3 XP", effect: { op: "gain_xp", amount: 3 } },
        ],
      },
      "[REACTION] test: choose one — draw 1; gain 3 XP.",
    ),
  ]),
);

function handSize(s: ReturnType<typeof scenario>, player = "p1"): number {
  return boardOf(s, player).hand.length;
}

describe("effect interpreter — control ops [§6.2][R359.3.d]", () => {
  it("[R359.3.d] a spell's instructions execute from top to bottom when it resolves", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    s.as("p1").play("Rebuke").expectOk();
    const before = handSize(s);
    s.as("p2").pass().expectOk();
    expect(handSize(s)).toBe(before + 1);
    expect(xpOf(s.room, "p1")).toBe(2);
    s.expectZone("p1", "Rebuke", "trash");
    expect(s.room.rules?.chain).toHaveLength(0);
    expect(s.room.rules?.manual).toBe(null);
  });

  it("[R383.3.a.3][R355.18] a later \"you may\" is decided on resolution through a prompt", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    s.as("p1").play("Gust").expectOk();
    const before = handSize(s);
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    expect(s.room.rules?.prompt?.data?.reason).toBe("effects.resume");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(handSize(s)).toBe(before + 2);
    expect(xpOf(s.room, "p1")).toBe(1);
    expect(s.room.rules?.prompt).toBe(null);
  });

  it("[R340.1][R359][R355.18] a spell waiting on a resolution prompt stays on the chain until its last instruction", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    s.as("p1").play("Gust").expectOk();
    const card = s.room.rules!.chain[0]!.cardSnapshot!;
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    // Still resolving: on the chain, not in the trash, no spell_resolved yet.
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Gust"]);
    expect(s.events().map((event) => event.type)).not.toContain("spell_resolved");
    expect(zoneOf(s, card.id)).toBe(null);
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    const types = s.events().map((event) => event.type);
    expect(types.indexOf("draw")).toBeGreaterThanOrEqual(0);
    expect(types.indexOf("gain_xp")).toBeGreaterThan(types.indexOf("draw"));
    expect(types.indexOf("spell_resolved")).toBeGreaterThan(types.indexOf("gain_xp"));
    expect(s.room.rules?.chain).toEqual([]);
    expect(zoneOf(s, card.id)).toBe("trash");
  });

  it("[R383.3.a.3] declining the \"may\" skips only that instruction", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    s.as("p1").play("Gust").expectOk();
    const before = handSize(s);
    s.as("p2").pass().expectOk();
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    expect(handSize(s)).toBe(before);
    expect(xpOf(s.room, "p1")).toBe(1);
  });

  it("[R411.2] only the instructed player may answer a resolution prompt", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    s.as("p1").play("Gust").expectOk();
    s.as("p2").pass().expectOk();
    s.as("p2").choose({ optionIds: ["yes"] }).expectError("not_your_priority");
    s.as("p1").choose({ optionIds: ["maybe"] }).expectError("invalid_choice");
  });

  it("[R355.3] choose_mode executes the mode chosen on play", () => {
    const s = scenario({ p1: { hand: ["Defy"] } });
    fund(s, "p1", "Defy");
    s.as("p1").play("Defy", { choices: { mode: "xp" } }).expectOk();
    const before = handSize(s);
    s.as("p2").pass().expectOk();
    expect(xpOf(s.room, "p1")).toBe(3);
    expect(handSize(s)).toBe(before);
  });

  it("[R355.3] a mode the intent leaves unbound is chosen while the spell is played", () => {
    const s = scenario({ p1: { hand: ["Defy"] } });
    fund(s, "p1", "Defy");
    s.as("p1").play("Defy").expectOk();
    s.expectPrompt("choose-mode", "p1");
    expect(s.room.rules?.prompt?.rule).toBe("355.3");
    expect(s.room.rules?.prompt?.options?.map((option) => option.id)).toEqual(["draw", "xp"]);
    s.as("p1").choose({ optionIds: ["draw"] }).expectOk();
    const before = handSize(s);
    s.as("p2").pass().expectOk();
    expect(handSize(s)).toBe(before + 1);
    expect(xpOf(s.room, "p1")).toBe(0);
  });

  it("[R355.18][§6.2] a mode reached on resolution without a play-time binding is asked then", () => {
    const s = scenario();
    const result = run(s, {
      op: "choose_mode",
      modes: [
        { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
        { id: "xp", label: "Gain 3 XP", effect: { op: "gain_xp", amount: 3 } },
      ],
    });
    expect(result.status).toBe("await");
    s.expectPrompt("choose-mode", "p1");
    expect(s.room.rules?.prompt?.options?.map((option) => option.id)).toEqual(["draw", "xp"]);
  });

  it("[§6.2] for_each binds each matching object as \"it\"; repeat runs N times", () => {
    const s = scenario();
    const a = place(s, "p1", "Treasure Hunter", "base");
    const b = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, {
      op: "for_each",
      selector: { cardType: "unit", controller: "self", zone: "base" },
      effect: { op: "stun", target: { targetRef: "it" } },
    });
    expect(s.room.rules?.objects[a.id]?.stunned).toBe(true);
    expect(s.room.rules?.objects[b.id]?.stunned).toBe(true);
    const before = handSize(s);
    run(s, { op: "repeat", times: 3, effect: { op: "draw", amount: 1 } });
    expect(handSize(s)).toBe(before + 3);
  });

  it("[§6.2] if executes then/else from a condition checked on execution (359.3.f.2)", () => {
    const s = scenario();
    const effect: Effect = {
      op: "if",
      condition: { kind: "exists", selector: { cardType: "unit", controller: "opponent", zone: "battlefield" } },
      then: { op: "gain_xp", amount: 5 },
      else: { op: "gain_xp", amount: 1 },
    };
    run(s, effect);
    expect(xpOf(s.room, "p1")).toBe(1);
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    run(s, effect);
    expect(xpOf(s.room, "p1")).toBe(6);
  });

  it("[§6.2] every core game action and control op is registered", () => {
    const ops = registeredEffectOps();
    for (const op of [
      "seq", "may", "if", "for_each", "repeat", "choose_mode", "draw", "exhaust", "ready", "recycle",
      "deal", "heal", "play", "move", "discard", "stun", "reveal", "counter", "buff", "banish", "kill",
      "add", "channel", "burn_out", "double", "swap", "attach", "detach", "predict", "prevent",
      "replace", "create", "burn", "empower", "disempower", "skip", "pay", "recall", "score_points",
      "gain_xp", "spend_xp", "look", "search", "shuffle", "temporary_might", "grant_keyword",
      "return_to_hand", "custom",
    ]) {
      expect(ops, op).toContain(op);
    }
  });
});

describe("effect interpreter — selectors, amounts, conditions [§6.2][R740.1][R355.9.a.1]", () => {
  it("[R740.1.a][R740.1.b] controller filters mean friendly/enemy relative to the ability's controller", () => {
    const s = scenario();
    const mine = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const theirs = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(matchingIds(ctx, { cardType: "unit", controller: "self" })).toEqual([mine.id]);
    expect(matchingIds(ctx, { cardType: "unit", controller: "opponent" })).toEqual([theirs.id]);
    expect(matchingIds(ctx, { cardType: "unit" }).sort()).toEqual([mine.id, theirs.id].sort());
  });

  it("[R355.9.a.1] \"unit\" refers to objects on the Board unless specified otherwise", () => {
    const s = scenario();
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(matchingIds(ctx, { cardType: "unit" })).toEqual([]);
    const handUnits = matchingIds(ctx, { cardType: "unit", zone: "deck", controller: "self" });
    expect(handUnits.length).toBeGreaterThan(0);
  });

  it("[R143.2][R710] might comparisons use effective Might; \"another\" excludes the source", () => {
    const s = scenario();
    const small = place(s, "p1", "Treasure Hunter", "base");
    const big = place(s, "p1", "Astral Heron", "base");
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1", sourceObjectId: small.id }) };
    expect(matchingIds(ctx, { cardType: "unit", might: { op: "lte", value: 3 } })).toEqual([small.id]);
    expect(matchingIds(ctx, { cardType: "unit", mighty: true })).toEqual([big.id]);
    expect(matchingIds(ctx, { cardType: "unit", excludeSource: true })).toEqual([big.id]);
    s.room.rules!.objects[small.id] = { temporaryMight: 5 };
    expect(matchingIds(ctx, { cardType: "unit", mighty: true }).sort()).toEqual([small.id, big.id].sort());
  });

  it("[R359.3.f.1] \"here\" is the source's location; sameLocationAs compares locations", () => {
    const s = scenario();
    const source = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const enemyHere = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "battlefieldB");
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1", sourceObjectId: source.id }) };
    expect(matchingIds(ctx, { cardType: "unit", controller: "opponent", zone: { kind: "chosen", ref: "here" } })).toEqual([
      enemyHere.id,
    ]);
    const bound = { ...ctx, env: makeEnv({ controller: "p1", choices: { pick: enemyHere.id } }) };
    expect(matchingIds(bound, { cardType: "unit", sameLocationAs: "pick" }).sort()).toEqual([source.id, enemyHere.id].sort());
  });

  it("[§6.2] amounts: count, might, cards in hand, sum/min/max and X", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const env = makeEnv({ controller: "p1", sourceObjectId: unit.id, choices: { x: 4 } });
    const ctx = { room: s.room, host: s.host, env };
    expect(evaluateAmount(ctx, { kind: "count", selector: { cardType: "unit", controller: "self" }, per: 2 })).toBe(2);
    expect(evaluateAmount(ctx, { kind: "might", selector: { targetRef: "self" } })).toBe(3);
    expect(evaluateAmount(ctx, { kind: "cards-in-hand" })).toBe(boardOf(s, "p1").hand.length);
    expect(evaluateAmount(ctx, { kind: "x" })).toBe(4);
    expect(evaluateAmount(ctx, { kind: "sum", amounts: [1, { kind: "x" }] })).toBe(5);
    expect(evaluateAmount(ctx, { kind: "min", amounts: [9, { kind: "x" }], cap: 2 })).toBe(2);
    expect(evaluateAmount(ctx, { kind: "max", amounts: [1, { kind: "x" }] })).toBe(4);
    // 359.3.e.12: Might of something that is not there is unavailable (null).
    expect(evaluateAmount(ctx, { kind: "might", selector: { targetRef: "missing" } })).toBe(null);
  });

  it("[§6.2] conditions: and/or/not/compare/has-keyword/turn player/score/controls", () => {
    const s = scenario();
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(evaluateCondition(ctx, { kind: "is-turn-player" })).toBe(true);
    expect(evaluateCondition(ctx, { kind: "is-turn-player", player: "opponent" })).toBe(false);
    expect(evaluateCondition(ctx, { kind: "controls", zone: "battlefieldA" })).toBe(true);
    expect(evaluateCondition(ctx, { kind: "controls", player: "opponent" })).toBe(false);
    expect(evaluateCondition(ctx, { kind: "player-score", comparison: { op: "eq", value: 0 } })).toBe(true);
    expect(
      evaluateCondition(ctx, {
        kind: "and",
        conditions: [{ kind: "true" }, { kind: "not", condition: { kind: "false" } }],
      }),
    ).toBe(true);
    expect(evaluateCondition(ctx, { kind: "or", conditions: [{ kind: "false" }, { kind: "compare", left: 2, op: "gt", right: 1 }] })).toBe(true);
    expect(evaluateCondition(ctx, { kind: "has-keyword", selector: { cardType: "unit" }, keyword: "Shield" })).toBe(false);
    expect(evaluateCondition(ctx, { kind: "is-phase", phase: "main" })).toBe(true);
    expect(evaluateCondition(ctx, { kind: "is-state", state: "neutral_open" })).toBe(true);
  });

  it("[R303.2.a] \"each player\" is Turn Order starting with the Turn Player", () => {
    const s = scenario({ firstPlayer: "p2" });
    const ctx = { room: s.room, host: s.host, env: makeEnv({ controller: "p1" }) };
    expect(resolvePlayers(ctx, "each")).toEqual(["p2", "p1"]);
    expect(resolvePlayers(ctx, "opponent")).toEqual(["p2"]);
  });
});
