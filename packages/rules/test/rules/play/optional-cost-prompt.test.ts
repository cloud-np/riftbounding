/**
 * 355.1.a / 356.2.b.1 / 356.4.f.1 / 805: an optional additional cost is a choice made during
 * step 2 of the process of play. When a `rules_play` omits `optionalCosts` (the board gesture),
 * the engine asks one yes/no prompt per cost the player can afford on top of the base cost.
 * An explicit `optionalCosts` field (including `[]`) still means "decided by the caller".
 *
 * These tests use the real strict room + engine host and drive the hand→battlefield gesture
 * (`move_card`) through `applyGameAction`, exactly like the strict client.
 */
import { describe, expect, it } from "vitest";

import type { Room } from "@rift/protocol";
import { applyGameAction } from "../../../../engine/src/index";

import type { RulesScenario } from "../../scenarios/dsl";
import { settle } from "../../cards/sfd/helpers";
import { bareScenario, boardOf, place } from "./helpers";

function poolOf(room: Room, playerId: string) {
  return room.rules?.pools[playerId] ?? { energy: 0, power: {} };
}

function gesturePlay(s: RulesScenario, cardId: string, to = "base"): Room {
  const result = applyGameAction(s.room, "p1", { type: "move_card", from: "hand", to, cardId }, s.ctx);
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  return result.ok ? result.state : s.room;
}

function choose(room: Room, s: RulesScenario, optionIds: string[]): Room {
  const prompt = room.rules?.prompt;
  expect(prompt, "no prompt is pending").toBeTruthy();
  const result = applyGameAction(
    room,
    prompt!.playerId,
    { type: "rules_choose", promptId: prompt!.id, answer: { optionIds } },
    s.ctx,
  );
  expect(result.ok, result.ok ? "" : result.error).toBe(true);
  return result.ok ? result.state : room;
}

function cardAt(room: Room, playerId: string, zone: "base" | "battlefieldA", cardId: string) {
  return room.players.find((player) => player.id === playerId)?.board?.[zone].find((card) => card.id === cardId);
}

function azirScenario(energy: number, power: Record<string, number>): { s: RulesScenario; azirId: string } {
  const s = bareScenario({ extraCards: { p1: ["Azir, Sovereign"] }, p1: { energy, power } });
  const azir = place(s, "p1", "Azir, Sovereign", "hand");
  return { s, azirId: azir.id };
}

describe("optional additional cost prompt [R355.1.a][R356.2.b.1][R805]", () => {
  it("[C:Azir, Sovereign][R805.1.b][R805.6] gesture play asks; Yes pays [1][Order] and it enters ready", () => {
    const { s, azirId } = azirScenario(5, { Order: 1 });
    const prompted = gesturePlay(s, azirId);

    const prompt = prompted.rules!.prompt!;
    expect(prompt.kind).toBe("yes-no");
    expect(prompt.playerId).toBe("p1");
    expect(prompt.rule).toBe("805.1.b");
    expect(prompt.promptKey).toBe("rules.prompt.playOptionalCostEnterReady");
    expect(prompt.options?.map((option) => option.id)).toEqual(["yes", "no"]);
    expect(prompt.data).toMatchObject({
      reason: "play.optional_cost",
      optionalCostId: "accelerate",
      cardName: "Azir, Sovereign",
      params: { cost: "Accelerate [1][Order]", card: "Azir, Sovereign" },
    });
    // The card is still Pending on the chain: no cost has been paid before the choice (355.1.a).
    expect(prompted.rules!.chain.filter((item) => item.id === prompt.sourceItemId)[0]?.status).toBe("pending");
    expect(poolOf(prompted, "p1")).toEqual({ energy: 5, power: { Order: 1 } });

    const played = choose(prompted, s, ["yes"]);
    expect(played.rules!.prompt).toBeNull();
    const azir = cardAt(played, "p1", "base", azirId);
    expect(azir).toBeTruthy();
    expect(azir?.exhausted).toBe(false);
    expect(poolOf(played, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[C:Azir, Sovereign][R355.1.a][R356.2.b.1] No pays only the base cost and it enters exhausted", () => {
    const { s, azirId } = azirScenario(5, { Order: 1 });
    const prompted = gesturePlay(s, azirId);
    const played = choose(prompted, s, ["no"]);

    expect(played.rules!.prompt).toBeNull();
    expect(cardAt(played, "p1", "base", azirId)?.exhausted).toBe(true);
    // Base [4] only: the optional [1][Order] was declined (356.2.b.1).
    expect(poolOf(played, "p1")).toEqual({ energy: 1, power: { Order: 1 } });
  });

  it("[C:Azir, Sovereign][R420.2.a] no prompt when the base is affordable but Accelerate is not", () => {
    const { s, azirId } = azirScenario(4, {});
    const played = gesturePlay(s, azirId);

    expect(played.rules!.prompt).toBeNull();
    expect(cardAt(played, "p1", "base", azirId)?.exhausted).toBe(true);
    expect(poolOf(played, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[R355.1.a] an explicit optionalCosts field (including []) never prompts", () => {
    const declined = azirScenario(5, { Order: 1 });
    declined.s.as("p1").apply({ type: "rules_play", cardId: declined.azirId, optionalCosts: [] }).expectOk();
    expect(declined.s.room.rules!.prompt).toBeNull();
    expect(cardAt(declined.s.room, "p1", "base", declined.azirId)?.exhausted).toBe(true);
    expect(poolOf(declined.s.room, "p1")).toEqual({ energy: 1, power: { Order: 1 } });

    const paid = azirScenario(5, { Order: 1 });
    paid.s.as("p1").apply({ type: "rules_play", cardId: paid.azirId, optionalCosts: ["accelerate"] }).expectOk();
    expect(paid.s.room.rules!.prompt).toBeNull();
    expect(cardAt(paid.s.room, "p1", "base", paid.azirId)?.exhausted).toBe(false);
    expect(poolOf(paid.s.room, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[C:Clockwork Keeper][R356.2.b.1][R356.4.f.1] a printed optional cost from another set prompts too", () => {
    const s = bareScenario({
      extraCards: { p1: ["Clockwork Keeper"] },
      p1: { energy: 2, power: { Calm: 1 } },
    });
    const keeper = place(s, "p1", "Clockwork Keeper", "hand");
    const prompted = gesturePlay(s, keeper.id);

    const prompt = prompted.rules!.prompt!;
    expect(prompt.kind).toBe("yes-no");
    expect(prompt.rule).toBe("356.2.b.1");
    expect(prompt.promptKey).toBe("rules.prompt.playOptionalCost");
    expect(prompt.data).toMatchObject({
      reason: "play.optional_cost",
      optionalCostId: "optional:0",
      params: { cost: "[Calm]", card: "Clockwork Keeper" },
    });

    const played = choose(prompted, s, ["yes"]);
    expect(played.rules!.prompt).toBeNull();
    expect(cardAt(played, "p1", "base", keeper.id)?.exhausted).toBe(true);
    expect(poolOf(played, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[C:Clockwork Keeper][R356.4.f.1] rune payment is not the optional cost; only the prompt Yes draws", () => {
    const keeperScenario = () => {
      const s = bareScenario({
        extraCards: { p1: ["Clockwork Keeper"] },
        p1: { energy: 2, power: { Calm: 1 } },
      });
      const keeper = place(s, "p1", "Clockwork Keeper", "hand");
      const before = boardOf(s, "p1").hand.length;
      return { s, keeper, before };
    };

    // Declined: the [Calm] stays in the pool and the "if you paid" trigger does not draw.
    const declined = keeperScenario();
    declined.s.as("p1").apply({ type: "rules_play", cardId: declined.keeper.id }).expectOk();
    expect(declined.s.room.rules!.prompt!.data?.optionalCostId).toBe("optional:0");
    declined.s.choose({ optionIds: ["no"] }).expectOk();
    settle(declined.s);
    expect(boardOf(declined.s, "p1").hand.length).toBe(declined.before - 1);
    expect(poolOf(declined.s.room, "p1")).toEqual({ energy: 0, power: { Calm: 1 } });

    // Accepted: the decision itself is recorded (356.4.f.1) and the trigger draws.
    const accepted = keeperScenario();
    accepted.s.as("p1").apply({ type: "rules_play", cardId: accepted.keeper.id }).expectOk();
    accepted.s.choose({ optionIds: ["yes"] }).expectOk();
    settle(accepted.s);
    expect(boardOf(accepted.s, "p1").hand.length).toBe(accepted.before);
    expect(poolOf(accepted.s.room, "p1")).toEqual({ energy: 0, power: {} });
  });

  it("[C:Azir, Sovereign][R411.2] only the controller's seat receives the prompt", () => {
    const { s, azirId } = azirScenario(5, { Order: 1 });
    const prompted = gesturePlay(s, azirId);
    const prompt = prompted.rules!.prompt!;
    expect(prompt.playerId).toBe("p1");
    const opponent = prompted.players.find((player) => player.id === "p2")!;
    expect(opponent.board?.base.some((card) => card.id === azirId)).toBe(false);
    // Public result: the card is on the chain, but the opponent has no board change yet.
    expect(prompted.rules!.chain.some((item) => item.id === prompt.sourceItemId && item.status === "pending")).toBe(true);
    expect(boardOf(s, "p1").base.some((card) => card.id === azirId)).toBe(false);
  });
});
