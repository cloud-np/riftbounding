/**
 * `cost_then` — costs within instructions, "[do X] to [do Y]" (740.4.a, 383.3.b, 355.10.c.1).
 *
 * 740.4.a.1: for spells (and later parts of triggered abilities, 740.4.a.2.a) the cost is paid on
 * resolution; the effect happens only if it was paid. `optional` = "you may [do X] to [do Y]":
 * the player chooses (445.2: declining negates). Cost parts that are game actions in this
 * layer (exhaust 415.4, kill, discard 423.3, spend XP, pay points) must be completable in full
 * (415.4 / 417.3 / 423.3); Energy/Power go through R2-play's `payCost` (445).
 */
import type { Cost } from "@rift/protocol";
import { pushEvent } from "../../types";
import { exhaust } from "../../actions/ready";
import { kill } from "../../actions/move";
import { canPayCost, payCost } from "../../play/payment";
import type { EffectExecutionContext } from "../execute";
import { RESOLVED } from "../execute";
import { resolveSelector, setXp, xpOf } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, ctxOf, hostOf, isOnBoard, playersOf } from "./util";

function resourcePart(cost: Cost): Cost {
  return {
    ...(cost.energy !== undefined ? { energy: cost.energy } : {}),
    ...(cost.power ? { power: cost.power } : {}),
  };
}

function hasResources(cost: Cost): boolean {
  return cost.energy !== undefined || (!!cost.power && Object.keys(cost.power).length > 0);
}

/** Can `player` complete every part of `cost` now? */
export function costPayable(context: EffectExecutionContext, player: string, cost: Cost): boolean {
  const host = hostOf(context);
  const ctx = ctxOf(context);
  if (hasResources(cost) && !canPayCost(context.room, host, player, resourcePart(cost))) return false;
  if (cost.exhaust) {
    const ids = resolveSelector(ctx, cost.exhaust);
    if (ids.length === 0 || ids.some((id) => !isOnBoard(context.room, host, id) || host.isExhausted(context.room, id))) {
      return false;
    }
  }
  if (cost.kill) {
    const ids = resolveSelector(ctx, cost.kill);
    if (ids.length === 0) return false;
  }
  if (cost.discard !== undefined) {
    const amount = amountOf(context, cost.discard) ?? 0;
    if (host.zoneCards(context.room, player, "hand").length < amount) return false;
  }
  if (cost.spendXp !== undefined && xpOf(context.room, player) < (amountOf(context, cost.spendXp) ?? 0)) return false;
  if (cost.payPoints !== undefined && host.score(context.room, player) < (amountOf(context, cost.payPoints) ?? 0)) {
    return false;
  }
  return true;
}

/** Pay every part of `cost` (call `costPayable` first). Returns whether it was paid. */
export function payInstructionCost(context: EffectExecutionContext, player: string, cost: Cost): boolean {
  const host = hostOf(context);
  const ctx = ctxOf(context);
  if (hasResources(cost)) {
    const verdict = payCost(context.room, context.step, player, resourcePart(cost), {
      ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
    });
    if (!verdict.ok) return false;
  }
  if (cost.exhaust) for (const id of resolveSelector(ctx, cost.exhaust)) exhaust(context.room, id, context.step);
  if (cost.kill) {
    for (const id of resolveSelector(ctx, cost.kill)) {
      kill(context.room, id, context.step, { playerId: player, ...(ctx.env.sourceObjectId ? { objectId: ctx.env.sourceObjectId } : {}) });
    }
  }
  if (cost.discard !== undefined) {
    const amount = amountOf(context, cost.discard) ?? 0;
    // TODO(R2-effects): let the player choose which cards (423.1.a); the newest cards go first.
    const hand = host.zoneCards(context.room, player, "hand").map((card) => card.id).slice(-amount);
    for (const id of hand) {
      if (host.moveCardToOwnerZone(context.room, id, "trash")) {
        pushEvent(context.step.events, { type: "discard", cardId: id, playerId: player, data: { cost: true } });
      }
    }
  }
  if (cost.spendXp !== undefined) {
    const amount = amountOf(context, cost.spendXp) ?? 0;
    setXp(context.room, player, xpOf(context.room, player) - amount);
    pushEvent(context.step.events, { type: "spend_xp", playerId: player, amount, data: { cost: true } });
  }
  if (cost.payPoints !== undefined) {
    const amount = amountOf(context, cost.payPoints) ?? 0;
    host.setScore(context.room, player, host.score(context.room, player) - amount);
    pushEvent(context.step.events, { type: "pay_points", playerId: player, amount });
  }
  return true;
}

registerEffectOp("cost_then", (effect, context) => {
  if (effect.op !== "cost_then") return { status: "manual", reason: "effect_not_implemented:cost_then" };
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const player = playersOf(context, effect.player)[0] ?? context.controller;
  if (!costPayable(context, player, effect.cost)) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  if (effect.optional) {
    const answer = machine.frame.answer;
    if (answer === undefined) {
      return machine.ask({
        kind: "yes-no",
        playerId: player,
        options: [
          { id: "yes", label: "Pay" },
          { id: "no", label: "Decline" },
        ],
        min: 1,
        max: 1,
        rule: "445.2",
        promptKey: "rules.prompt.payCost",
        data: { answer: "boolean" },
      });
    }
    machine.frame.answer = undefined;
    const yes = answer === true || answer === "yes" || (Array.isArray(answer) && answer.includes("yes"));
    if (!yes) {
      recordOutcome(context, [], false);
      return RESOLVED;
    }
  }
  const paid = payInstructionCost(context, player, effect.cost);
  recordOutcome(context, [], paid);
  if (paid) machine.push({ effect: effect.effect });
  return RESOLVED;
});
