/**
 * `burn` — rule 441 (top of the Main Deck → trash). 441.4 / 432.1.b: burning more cards than the
 * deck holds burns as many as possible, Burns Out, then burns the rest.
 *
 * The player is `target.controller` (default: the ability's controller).
 */
import type { PlayerSelector } from "@rift/protocol";
import { pushEvent } from "../../types";
import { burnOut } from "../../actions/draw";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, hostOf, playersOf } from "./util";

registerEffectOp("burn", (effect, context) => {
  if (effect.op !== "burn") return { status: "manual", reason: "effect_not_implemented:burn" };
  const host = hostOf(context);
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  const controller = effect.target.controller;
  const selector: PlayerSelector | undefined =
    controller === undefined || controller === "any" || controller === "all" ? undefined : (controller as PlayerSelector);
  const burned: string[] = [];
  for (const playerId of playersOf(context, selector)) {
    let remaining = amount;
    for (let guard = 0; guard < 100 && remaining > 0; guard += 1) {
      const top = host.lookAtTop(context.room, playerId, "deck", 1)[0];
      if (!top) {
        const result = burnOut(context.room, playerId, context.step);
        if (result.prevented || result.gameOver || result.awaitingPrompt) break;
        if (host.zoneCards(context.room, playerId, "deck").length === 0) break;
        continue;
      }
      if (!host.moveCardTo(context.room, playerId, "deck", "trash", top.id)) break;
      burned.push(top.id);
      remaining -= 1;
    }
    if (burned.length > 0) {
      pushEvent(context.step.events, { type: "burn", playerId, amount: burned.length, data: { cardIds: burned } });
    }
  }
  recordOutcome(context, burned, burned.length > 0);
  return RESOLVED;
});
