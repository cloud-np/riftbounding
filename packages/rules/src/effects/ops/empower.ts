/**
 * `empower` / `disempower` — rules 442–443 (Empowered is a binary state, 442.1.a/b/c; becoming
 * Empowered is an event, 442.2.a; disempowering an object that is not Empowered does nothing,
 * 443.1.a.1).
 * TODO(R2-effects): 442.1.c.1 stacking permissions.
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf, isOnBoard } from "./util";

registerEffectOp("empower", (effect, context) => {
  if (effect.op !== "empower") return { status: "manual", reason: "effect_not_implemented:empower" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const rules = context.room.rules;
  const done: string[] = [];
  for (const id of found.ids) {
    if (!rules || !isOnBoard(context.room, host, id)) continue;
    const object = (rules.objects[id] ??= {});
    if ((object.empowered ?? 0) > 0) continue;
    object.empowered = 1;
    done.push(id);
    pushEvent(context.step.events, { type: "empower", cardId: id, playerId: context.controller });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerEffectOp("disempower", (effect, context) => {
  if (effect.op !== "disempower") return { status: "manual", reason: "effect_not_implemented:disempower" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const rules = context.room.rules;
  const done: string[] = [];
  for (const id of found.ids) {
    const object = rules?.objects[id];
    if (!object || (object.empowered ?? 0) <= 0) continue;
    object.empowered = (object.empowered ?? 1) - 1;
    if (object.empowered <= 0) delete object.empowered;
    done.push(id);
    pushEvent(context.step.events, { type: "disempower", cardId: id, playerId: context.controller });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
