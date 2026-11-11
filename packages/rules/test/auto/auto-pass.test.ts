/**
 * Auto-pass / auto-resolve (docs/rules/auto-pass.md).
 *
 * Every automatic action must be one the player could legally have taken (same verdict and
 * handler as the manual intent), only for the player who holds the decision (312/313/411.2), and
 * only when that player's stored preferences opt in.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AutoPassPrefsUpdate, CardScript, Effect, Prompt, Trigger } from "@rift/protocol";
import {
  AUTO_ACTION_CAP,
  DEFAULT_AUTO_PASS,
  defaultAutoPassFor,
  FAST_AUTO_PASS,
  isFastAutoPass,
  explainIllegal,
  flushPendingTriggers,
  forcedPromptAnswer,
  MANUAL_AUTO_PASS,
  promptSignature,
  validateRulesIntent,
} from "../../src";
import { clearCardScripts, registerTestCardScripts } from "../../src/testing";
import { scenario, type RulesScenario } from "../scenarios/dsl";
import { boardOf, place, stepFor } from "../rules/effects/helpers";

function noopSpell(name: string, text: string): CardScript {
  return { name, text, status: "implemented", abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }] };
}

function triggered(name: string, trigger: Trigger, effect: Effect, optional = false): CardScript {
  return {
    name,
    text: "test trigger",
    status: "implemented",
    abilities: [{ kind: "triggered", trigger, effect, ...(optional ? { optional: true } : {}) }],
  };
}

const ANY_UNIT_PLAYED: Trigger = { kind: "event", event: { type: "unit_played" } };

beforeAll(() => {
  registerTestCardScripts([
    noopSpell("Rebuke", "[ACTION] Test no-op."),
    noopSpell("Defy", "[REACTION] Test no-op."),
    noopSpell("Gust", "[REACTION] Test no-op."),
  ]);
});

afterAll(() => clearCardScripts());

function prefs(s: RulesScenario, playerId: string, update: AutoPassPrefsUpdate): RulesScenario {
  return s.as(playerId).apply({ type: "rules_set_auto_pass", prefs: update }).expectOk();
}

function defaults(s: RulesScenario, ...players: string[]): RulesScenario {
  for (const playerId of players) prefs(s, playerId, { ...DEFAULT_AUTO_PASS });
  return s;
}

function emptyHand(s: RulesScenario, playerId: string): void {
  const board = boardOf(s, playerId);
  board.deck.push(...board.hand.splice(0));
}

function autoEvents(s: RulesScenario, type: string) {
  return s.events().filter((event) => event.type === type);
}

describe("rules_set_auto_pass [contract:auto-pass]", () => {
  it("validates the wire shape", () => {
    expect(validateRulesIntent({ type: "rules_set_auto_pass", prefs: { responses: "safe" } }).ok).toBe(true);
    expect(validateRulesIntent({ type: "rules_set_auto_pass" })).toMatchObject({ ok: false, code: "illegal_action" });
    expect(validateRulesIntent({ type: "rules_set_auto_pass", prefs: { responses: "always" } })).toMatchObject({ ok: false });
    expect(validateRulesIntent({ type: "rules_set_auto_pass", prefs: { ownItems: 1 } })).toMatchObject({ ok: false });
    expect(validateRulesIntent({ type: "rules_set_auto_pass", prefs: { sneaky: true } })).toMatchObject({ ok: false });
    expect(validateRulesIntent({ type: "rules_set_auto_pass", prefs: { passUntil: { kind: "forever" } } })).toMatchObject({ ok: false });
    expect(validateRulesIntent({ type: "rules_choose", promptId: "p", answer: {}, applyToSimilar: "yes" })).toMatchObject({ ok: false });
  });

  it("[R312.1.b.1] needs no Priority, changes only the actor's entry and starts from manual", () => {
    const s = scenario();
    expect(s.room.rules?.autoPass).toBeUndefined();
    expect(explainIllegal(s.room, "p2", { type: "rules_set_auto_pass", prefs: { ownItems: true } }, s.host)).toEqual({ ok: true });
    prefs(s, "p2", { ownItems: true });
    expect(s.room.rules?.autoPass).toEqual({ p2: { ...MANUAL_AUTO_PASS, ownItems: true } });
    s.expectPriority("p1");
  });

  it("passUntil always records the current turn", () => {
    const s = scenario();
    prefs(s, "p2", { passUntil: { kind: "opponent_action", turn: 99 } });
    expect(s.room.rules?.autoPass?.p2?.passUntil).toEqual({ kind: "opponent_action", turn: s.room.rules?.turn.number });
    prefs(s, "p2", { passUntil: null });
    expect(s.room.rules?.autoPass?.p2?.passUntil).toBeUndefined();
  });
});

describe("own items [R337.4][R340.4]", () => {
  it("[R340.4] Priority returning to the controller of their own item is passed for them", () => {
    const s = scenario({
      p1: { hand: ["Rebuke", "Gust"], energy: 3, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    prefs(s, "p1", { ownItems: true });
    s.as("p1").play("Rebuke").expectOk();
    s.as("p2").play("Defy").expectOk();
    // P2's own Defy auto-passes by owner decision 3; P1 gets a response window on Defy (not theirs).
    s.expectPriority("p1");
    s.as("p1").pass().expectOk();
    // Defy resolved; 340.4 hands Priority to Rebuke's controller (P1), whose own item is on top.
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Rebuke"]);
    s.expectPriority("p2");
    expect(autoEvents(s, "auto_pass")).toEqual([
      expect.objectContaining({ playerId: "p1", data: { reason: "own_item", window: "chain" } }),
    ]);
  });

  it("[R337.4] the controller of their own trigger is passed for; without the preference they keep Priority", () => {
    registerTestCardScripts([triggered("Treasure Hunter", { kind: "event", event: { type: ["unit_played"], subject: { targetRef: "self" } } }, { op: "draw", amount: 1 })]);
    const manual = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    manual.as("p1").play("Treasure Hunter").expectOk();
    manual.expectPriority("p1");

    const auto = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    prefs(auto, "p1", { ownItems: true });
    auto.as("p1").play("Treasure Hunter").expectOk();
    auto.expectPriority("p2");
    expect(auto.room.rules?.chain).toHaveLength(1);
  });

  it("[R337.4] hold on the play suppresses every auto-pass for the actor in that transition", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    prefs(s, "p1", { ownItems: true });
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    s.expectPriority("p1");
    expect(autoEvents(s, "auto_pass")).toHaveLength(0);
  });

  it("[R337.4] full control (hold preference) also holds the owner-decision-3 pass", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    prefs(s, "p1", { ...DEFAULT_AUTO_PASS, hold: true });
    s.as("p1").play("Rebuke").expectOk();
    s.expectPriority("p1");
    s.as("p1").pass().expectOk();
    s.expectPriority("p2");
  });
});

describe("response windows [R338.1.b][R347.2] and hidden information", () => {
  it("safe: passes only when public information proves there is no response", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    defaults(s, "p1", "p2");
    emptyHand(s, "p2");
    s.as("p1").play("Rebuke").expectOk();
    // P2 holds nothing hidden and has no legal response: passed, Rebuke resolves in P1's action.
    expect(s.room.rules?.chain).toHaveLength(0);
    s.expectZone("p1", "Rebuke", "trash").expectPriority("p1");
    expect(autoEvents(s, "auto_pass")).toEqual([expect.objectContaining({ playerId: "p2", data: { reason: "pass", window: "chain" } })]);
  });

  it("safe: an unplayable card in hand keeps the stop (no instant pass that would leak the hand)", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } }, p2: { hand: ["Astral Heron"] } });
    defaults(s, "p1", "p2");
    s.as("p1").play("Rebuke").expectOk();
    expect(s.expectLegal("p2").playableCardIds).toHaveLength(0);
    s.expectPriority("p2");
    expect(autoEvents(s, "auto_pass")).toHaveLength(0);
  });

  it("no_response (leaky opt-in): passes whenever there is no legal response, even with cards in hand", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } }, p2: { hand: ["Astral Heron"] } });
    prefs(s, "p2", { responses: "no_response" });
    s.as("p1").play("Rebuke").expectOk();
    expect(s.room.rules?.chain).toHaveLength(0);
    s.expectPriority("p1");
  });

  it("never passes a player who has a legal response, in any response mode", () => {
    for (const responses of ["safe", "no_response"] as const) {
      const s = scenario({
        p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
        p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
      });
      prefs(s, "p2", { responses });
      s.as("p1").play("Rebuke").expectOk();
      s.expectPriority("p2");
    }
  });

  it("stop: never passes a response window", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    prefs(s, "p2", { responses: "stop" });
    emptyHand(s, "p2");
    s.as("p1").play("Rebuke").expectOk();
    s.expectPriority("p2");
  });
});

describe("pass until … [R338.1.b]", () => {
  it("end_of_turn passes every window this turn, even with a response in hand, then expires", () => {
    const s = scenario({
      p1: { hand: ["Rebuke", "Gust"], energy: 4, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    prefs(s, "p2", { passUntil: { kind: "end_of_turn", turn: 1 } });
    s.as("p1").play("Rebuke").expectOk();
    expect(s.room.rules?.chain).toHaveLength(0);
    s.expectZone("p2", "Defy", "hand");
    expect(autoEvents(s, "auto_pass")[0]).toMatchObject({ playerId: "p2", data: { reason: "pass_until" } });
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.autoPass?.p2?.passUntil).toBeUndefined();
  });

  it("end_of_turn on one's own turn ends the turn at Neutral Open — at most one turn per transition", () => {
    const s = scenario();
    prefs(s, "p2", { passUntil: { kind: "end_of_turn", turn: 1 } });
    prefs(s, "p1", { passUntil: { kind: "end_of_turn", turn: 1 } });
    expect(autoEvents(s, "auto_end_turn")).toEqual([expect.objectContaining({ playerId: "p1", data: { reason: "pass_until" } })]);
    expect(s.room.rules?.turn.player).toBe("p2");
    expect(s.room.rules?.turn.number).toBe(2);
  });

  it("opponent_action ends when an opponent takes a Discretionary Action", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    prefs(s, "p2", { passUntil: { kind: "opponent_action", turn: 1 } });
    s.as("p1").play("Rebuke").expectOk();
    expect(s.room.rules?.autoPass?.p2?.passUntil).toBeUndefined();
    s.expectPriority("p2");
  });
});

describe("ending one's own turn [R316.9]", () => {
  it("safe: ends the turn only when public information proves there is nothing to do", () => {
    const s = scenario();
    emptyHand(s, "p1");
    const legal = s.expectLegal("p1");
    expect(legal.playableCardIds.length + legal.moves.length).toBe(0);
    // 164.2: only the Basic Runes' resource abilities remain — not "something to do".
    expect(legal.activatable.every((entry) => entry.ability.startsWith("rune:"))).toBe(true);
    prefs(s, "p1", { endTurn: "safe" });
    expect(autoEvents(s, "auto_end_turn")).toEqual([expect.objectContaining({ playerId: "p1", data: { reason: "no_action" } })]);
    expect(s.room.rules?.turn.player).toBe("p2");
  });

  it("safe keeps the turn when the hand holds (unplayable) cards; no_action ends it", () => {
    const s = scenario();
    emptyHand(s, "p1");
    s.moveDeckCardToHand("p1", "Astral Heron");
    expect(s.expectLegal("p1").playableCardIds).toHaveLength(0);
    prefs(s, "p1", { endTurn: "safe" });
    expect(s.room.rules?.turn.player).toBe("p1");
    prefs(s, "p1", { endTurn: "no_action" });
    expect(s.room.rules?.turn.player).toBe("p2");
  });
});

describe("forced prompts [R411.2]", () => {
  function burnOutPrompt(): Prompt {
    return {
      id: "prompt-burn",
      kind: "choose-opponent",
      playerId: "p1",
      promptKey: "rules.prompt.burnOutOpponent",
      rule: "432.2.c",
      options: [{ id: "p2", playerId: "p2" }],
      min: 1,
      max: 1,
      data: { reason: "burn_out", remainingDraws: 0 },
    };
  }

  it("recognises a single legal answer and whether it is public", () => {
    const s = scenario({ p1: { hand: ["Rebuke", "Defy"] } });
    expect(forcedPromptAnswer(s.room, burnOutPrompt(), s.host)).toEqual({
      answer: { optionIds: ["p2"], playerId: "p2" },
      public: true,
    });
    const yesNo: Prompt = { id: "y", kind: "yes-no", playerId: "p1", options: [{ id: "yes" }, { id: "no" }], min: 1, max: 1 };
    expect(forcedPromptAnswer(s.room, yesNo, s.host)).toBeNull();
    const optional: Prompt = { id: "o", kind: "choose-card", playerId: "p1", options: [{ id: "a" }], min: 0, max: 1 };
    expect(forcedPromptAnswer(s.room, optional, s.host)).toBeNull();
    const hand = boardOf(s, "p1").hand;
    const oneOfHand: Prompt = {
      id: "h",
      kind: "choose-card",
      playerId: "p1",
      options: [{ id: hand[0]!.id, cardId: hand[0]!.id }],
      min: 1,
      max: 1,
    };
    // Only one of two hand cards is offered: forced, but the filter used hidden information.
    expect(forcedPromptAnswer(s.room, oneOfHand, s.host)).toMatchObject({ public: false });
    const wholeHand: Prompt = {
      ...oneOfHand,
      options: hand.map((card) => ({ id: card.id, cardId: card.id })),
      min: hand.length,
      max: hand.length,
    };
    // Every card in hand (hand size is public): forced and public.
    expect(forcedPromptAnswer(s.room, wholeHand, s.host)).toMatchObject({ public: true });
  });

  it("answers a forced public prompt through the normal handler (safe), and only for the prompted player", () => {
    const s = scenario();
    s.room.rules!.prompt = burnOutPrompt();
    prefs(s, "p2", { forcedPrompts: "safe" });
    expect(s.room.rules?.prompt?.id).toBe("prompt-burn");
    prefs(s, "p1", { forcedPrompts: "safe" });
    expect(s.room.rules?.prompt).toBeNull();
    s.expectScore("p2", 1);
    expect(s.room.rules?.history.promptAnswers?.at(-1)).toMatchObject({ promptId: "prompt-burn", playerId: "p1" });
    expect(autoEvents(s, "auto_choose")).toEqual([
      expect.objectContaining({ playerId: "p1", data: expect.objectContaining({ source: "choose" }) }),
    ]);
  });

  it("safe never answers a forced prompt whose single answer depends on hidden cards; all does", () => {
    const s = scenario({ p1: { hand: ["Rebuke", "Defy"] } });
    const card = boardOf(s, "p1").hand[0]!;
    // A prompt shape with no handler: the R1 fallback records the answer and closes it.
    s.room.rules!.prompt = { id: "prompt-h", kind: "choose-card", playerId: "p1", options: [{ id: card.id, cardId: card.id }], min: 1, max: 1 };
    prefs(s, "p1", { forcedPrompts: "safe" });
    expect(s.room.rules?.prompt?.id).toBe("prompt-h");
    prefs(s, "p1", { forcedPrompts: "all" });
    expect(s.room.rules?.prompt).toBeNull();
  });

  it("[R383.3.d] orders identical triggers automatically (order cannot matter)", () => {
    const s = scenario();
    s.room.rules!.triggers.push(
      { id: "t-1", controller: "p1", sourceName: "Echo", abilityRef: "triggered:0" },
      { id: "t-2", controller: "p1", sourceName: "Echo", abilityRef: "triggered:0" },
    );
    flushPendingTriggers(s.room, stepFor(s));
    expect(s.room.rules?.prompt?.kind).toBe("order");
    expect(forcedPromptAnswer(s.room, s.room.rules!.prompt!, s.host)).toEqual({ answer: { optionIds: [] }, public: true });
  });
});

describe("yes to all [R411.2]", () => {
  it("[R403.1] repeats a yes/no answer for identical prompts this turn, then forgets it", () => {
    registerTestCardScripts([triggered("Treasure Hunter", ANY_UNIT_PLAYED, { op: "draw", amount: 1 }, true)]);
    const s = scenario({ p1: { hand: ["Astral Heron", "Astral Heron"], energy: 20 } });
    place(s, "p1", "Treasure Hunter", "base");
    prefs(s, "p1", { ownItems: true });
    s.as("p1").play("Astral Heron").expectOk();
    const prompt = s.room.rules!.prompt!;
    expect(prompt).toMatchObject({ kind: "yes-no", playerId: "p1" });
    const signature = promptSignature(s.room, prompt);
    s.as("p1").apply({ type: "rules_choose", promptId: prompt.id, answer: { optionIds: ["yes"] }, applyToSimilar: true }).expectOk();
    expect(s.room.rules?.autoPass?.p1?.standing).toEqual([{ signature, answer: { optionIds: ["yes"] }, turn: 1 }]);
    // The trigger finalized; P1's own item auto-passes; P2 passes; it resolves.
    s.as("p2").pass().expectOk();
    s.as("p1").play("Astral Heron").expectOk();
    // Same decision again: answered automatically with the remembered "yes".
    expect(s.room.rules?.prompt).toBeNull();
    expect(autoEvents(s, "auto_choose")).toEqual([expect.objectContaining({ playerId: "p1", data: expect.objectContaining({ source: "repeat" }) })]);
    s.as("p2").pass().expectOk();
    s.as("p1").endTurn().expectOk();
    // Turn 2 (P2's): the next automatic step expires the remembered answer.
    expect(s.room.rules?.autoPass?.p1?.standing).toBeUndefined();
  });
});

describe("termination and determinism", () => {
  it("[R322] caps automatic actions per transition and hands control back", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    // A long chain of P1 triggers (a loop stand-in): both players pass everything until end of turn.
    for (let index = 0; index < AUTO_ACTION_CAP; index += 1) {
      s.room.rules!.chain.push({
        id: `chain-loop-${index}`,
        kind: "triggered",
        status: "finalized",
        controller: "p1",
        cardName: "Loop",
        choices: {},
        origin: "trigger",
        effect: { op: "seq", effects: [] },
      });
    }
    s.room.rules!.priority = "p1";
    prefs(s, "p2", { passUntil: { kind: "end_of_turn", turn: 1 } });
    prefs(s, "p1", { passUntil: { kind: "end_of_turn", turn: 1 } });
    expect(autoEvents(s, "auto_pass")).toHaveLength(AUTO_ACTION_CAP);
    expect(autoEvents(s, "auto_paused")).toHaveLength(1);
    expect(s.room.rules!.chain.length).toBe(AUTO_ACTION_CAP / 2);
    // Control is back with a person; their next action continues the automatic passes.
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.chain.length).toBeLessThan(AUTO_ACTION_CAP / 2);
  });

  it("is deterministic: the same intents give the same room", () => {
    const build = () => {
      const s = scenario({ seed: 42, roomCode: "AUTO-DET", p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
      defaults(s, "p1", "p2");
      emptyHand(s, "p2");
      s.as("p1").play("Rebuke").expectOk();
      return s.room;
    };
    expect(build()).toEqual(build());
  });
});

describe("practice-vs-bot preset", () => {
  const players = (bot: boolean) => ({
    players: [{ id: "a" }, { id: "b", ...(bot ? { isBot: true } : {}) }] as never,
  });
  it("FAST_AUTO_PASS is the defaults plus no_response and forced prompts all", () => {
    expect(FAST_AUTO_PASS).toEqual({ ...DEFAULT_AUTO_PASS, responses: "no_response", forcedPrompts: "all" });
    expect(isFastAutoPass(FAST_AUTO_PASS)).toBe(true);
    expect(isFastAutoPass(DEFAULT_AUTO_PASS)).toBe(false);
  });
  it("humans in a room with a bot seat get fast mode; the bot and PvP seats get the defaults", () => {
    expect(defaultAutoPassFor(players(true), "a")).toEqual(FAST_AUTO_PASS);
    expect(defaultAutoPassFor(players(true), "b")).toEqual(DEFAULT_AUTO_PASS);
    expect(defaultAutoPassFor(players(false), "a")).toEqual(DEFAULT_AUTO_PASS);
    expect(defaultAutoPassFor(players(false), "b")).toEqual(DEFAULT_AUTO_PASS);
  });
});
