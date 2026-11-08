/**
 * `discard` — rule 423.
 *
 * 423.1: hand → owner's trash without executing rules text; the discarding player chooses
 * (423.1.a). 423.4: discard as many as possible; excess instructions are negated.
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { optionFor, recordOutcome } from "../targets";
import { amountOf, ctxOf, hostOf, playersOf } from "./util";

registerEffectOp("discard", (effect, context) => {
  if (effect.op !== "discard") return { status: "manual", reason: "effect_not_implemented:discard" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const machine = context.machine;
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  const players = playersOf(context, effect.player);
  // Progress across several players is kept on the frame (one prompt at a time).
  const startIndex = typeof machine?.frame.data?.player === "number" ? (machine.frame.data.player as number) : 0;
  const discarded: string[] = [];
  for (let index = startIndex; index < players.length; index += 1) {
    const playerId = players[index]!;
    const hand = host.zoneCards(context.room, playerId, "hand").map((card) => card.id);
    let chosen: string[];
    if (hand.length <= amount) {
      chosen = hand;
    } else if (machine && machine.frame.answer !== undefined) {
      const answer = machine.frame.answer;
      chosen = (Array.isArray(answer) ? answer : [answer]).filter(
        (id): id is string => typeof id === "string" && hand.includes(id),
      );
      machine.frame.answer = undefined;
    } else if (machine) {
      machine.frame.data = { ...(machine.frame.data ?? {}), player: index };
      return machine.ask({
        kind: "choose-card",
        playerId,
        options: hand.map((id) => optionFor(ctx, id)),
        min: amount,
        max: amount,
        rule: "423.1.a",
        promptKey: "rules.prompt.chooseDiscard",
        data: { answer: "objects" },
      });
    } else {
      chosen = hand.slice(0, amount);
    }
    for (const id of chosen) {
      if (!host.moveCardToOwnerZone(context.room, id, "trash")) continue;
      discarded.push(id);
      pushEvent(context.step.events, { type: "discard", cardId: id, playerId });
    }
  }
  if (machine) machine.frame.data = undefined;
  recordOutcome(context, discarded, discarded.length > 0);
  return RESOLVED;
});
