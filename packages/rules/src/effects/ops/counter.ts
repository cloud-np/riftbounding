/**
 * `counter` — rule 426.
 *
 * 426.1.a: a countered card or ability does nothing and is cleared from the chain; cards go to
 * their owner's trash (426.1.a.1). 426.1.b: it is not considered played (no `spell_resolved`).
 * 426.1.c: costs are not refunded.
 */
import { pushEvent } from "../../types";
import { removeChainItem } from "../../timing/fepr/chain";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf } from "./util";
import { findChainItem } from "../objects";

registerEffectOp("counter", (effect, context) => {
  if (effect.op !== "counter") return { status: "manual", reason: "effect_not_implemented:counter" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const done: string[] = [];
  for (const id of found.ids) {
    const item = findChainItem(context.room, id);
    if (!item) continue;
    removeChainItem(context.room, id);
    if (item.kind === "card" && item.cardSnapshot) {
      const owner = item.cardSnapshot.ownerPlayerId ?? item.controller;
      host.putCard(context.room, owner, "trash", item.cardSnapshot);
    }
    done.push(id);
    pushEvent(context.step.events, {
      type: "counter",
      playerId: context.controller,
      cardName: item.cardName,
      ...(item.cardSnapshot ? { cardId: item.cardSnapshot.id } : {}),
      data: { itemId: id, controller: item.controller, kind: item.kind },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
