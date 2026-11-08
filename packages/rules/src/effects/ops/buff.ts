/**
 * `buff` / `spend_buff` — rules 427 and 701–705.
 *
 * 427.1.b / 702.3: a unit has at most one buff; buffing a buffed unit does nothing (no event,
 * so "when you buff me" does not trigger, EX[213]). 702.2.b: spending removes one buff; only
 * from a unit with a buff (702.2.b.1) that the spender controls (702.2.b.2). 703: +1 Might each
 * (read by `effectiveMight`).
 */
import { pushEvent } from "../../types";
import { interceptAction } from "../../timing/hooks";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf, isOnBoard } from "./util";
import { controllerOf, isUnit } from "../objects";

registerEffectOp("buff", (effect, context) => {
  if (effect.op !== "buff") return { status: "manual", reason: "effect_not_implemented:buff" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const rules = context.room.rules;
  const done: string[] = [];
  for (const id of found.ids) {
    if (!rules || !isOnBoard(context.room, host, id) || !isUnit(context.room, host, id)) continue;
    const object = (rules.objects[id] ??= {});
    if ((object.buffs ?? 0) >= 1) continue;
    if (!interceptAction(context.room, context.step, { type: "buff", cardId: id })) continue;
    object.buffs = 1;
    done.push(id);
    pushEvent(context.step.events, { type: "buff", cardId: id, playerId: context.controller });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerEffectOp("spend_buff", (effect, context) => {
  if (effect.op !== "spend_buff") return { status: "manual", reason: "effect_not_implemented:spend_buff" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const rules = context.room.rules;
  const done: string[] = [];
  for (const id of found.ids) {
    const object = rules?.objects[id];
    if (!object || (object.buffs ?? 0) <= 0) continue;
    if (controllerOf(context.room, host, id) !== context.controller) continue;
    object.buffs = (object.buffs ?? 1) - 1;
    if (object.buffs <= 0) delete object.buffs;
    done.push(id);
    pushEvent(context.step.events, { type: "spend_buff", cardId: id, playerId: context.controller });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
