/**
 * `banish` — rule 428 (any zone → its owner's Banishment, 428.2 / 056; not a kill, 428.2.a, and
 * not a discard, 428.2.b). Spells/abilities on the chain leave it.
 */
import { pushEvent } from "../../types";
import { removeChainItem } from "../../timing/fepr/chain";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { noteLki, recordOutcome, targets } from "../targets";
import { ctxOf, forgetObject, hostOf } from "./util";
import { findChainItem, locate } from "../objects";

registerEffectOp("banish", (effect, context) => {
  if (effect.op !== "banish") return { status: "manual", reason: "effect_not_implemented:banish" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  noteLki(ctxOf(context), found.ids);
  const done: string[] = [];
  for (const id of found.ids) {
    const item = findChainItem(context.room, id);
    if (item) {
      removeChainItem(context.room, id);
      if (item.cardSnapshot) {
        host.putCard(context.room, item.cardSnapshot.ownerPlayerId ?? item.controller, "banished", item.cardSnapshot);
      }
      done.push(id);
      pushEvent(context.step.events, { type: "banish", playerId: context.controller, data: { itemId: id } });
      continue;
    }
    const located = locate(context.room, host, id);
    if (!located || located.zone === "banished") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "banished")) continue;
    forgetObject(context.room, host, id);
    done.push(id);
    pushEvent(context.step.events, {
      type: "banish",
      cardId: id,
      playerId: located.playerId,
      cardName: located.card.name,
      ...(context.machine?.env.sourceObjectId ? { sourceObjectId: context.machine.env.sourceObjectId } : {}),
      data: { from: located.zone },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
