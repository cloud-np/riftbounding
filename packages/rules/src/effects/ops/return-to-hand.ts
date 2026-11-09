/**
 * `return_to_hand` — 412 "return to owner's hand" (056: always the owner's hand). Leaving the
 * board removes buffs/counters/statuses (705, 748); a token put into a hand ceases to exist
 * (186.1).
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { noteLki, recordOutcome, targets } from "../targets";
import { ctxOf, forgetObject, hostOf } from "./util";
import { locate } from "../objects";

registerEffectOp("return_to_hand", (effect, context) => {
  if (effect.op !== "return_to_hand") return { status: "manual", reason: "effect_not_implemented:return_to_hand" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  noteLki(ctxOf(context), found.ids);
  const done: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    if (!located || located.zone === "hand") continue;
    const attached = located.card.attachedToCardId;
    if (attached) host.detach(context.room, id);
    if (!host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    forgetObject(context.room, host, id);
    done.push(id);
    pushEvent(context.step.events, {
      type: "return_to_hand",
      cardId: id,
      playerId: located.card.ownerPlayerId ?? located.playerId,
      cardName: located.card.name,
      data: { from: located.zone, controller: located.playerId },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
