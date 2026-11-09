/**
 * `grant_keyword` / `remove_keyword` — rules 801.3.a / 801.3.b (479.3 Ability-Altering layer).
 *
 * 801.3.a.3 / 801.3.b.2: without a stated duration the change lasts while the object stays on
 * the Board (stored on its rules object, which is dropped when it leaves). A keyword with a value
 * ("Shield 2") stores the value for `effectiveKeywordValues` (823.2 / 831.2 sum values).
 */
import { pushEvent } from "../../types";
import { addKeywordGrant } from "../../layers/mods";
import { splitKeyword } from "../../layers";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { ctxOf, hostOf, isOnBoard } from "./util";

registerEffectOp("grant_keyword", (effect, context) => {
  if (effect.op !== "grant_keyword") return { status: "manual", reason: "effect_not_implemented:grant_keyword" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const { name, value } = splitKeyword(String(effect.keyword));
  const duration = effect.duration ?? "permanent";
  const done: string[] = [];
  for (const id of found.ids) {
    if (!isOnBoard(context.room, host, id)) continue;
    addKeywordGrant(context.room, host, id, name, duration, ctx.env.controller, {
      ...(value !== undefined ? { value } : {}),
      ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
    });
    done.push(id);
    pushEvent(context.step.events, {
      type: "grant_keyword",
      cardId: id,
      playerId: ctx.env.controller,
      data: { keyword: name, ...(value !== undefined ? { value } : {}), duration },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerEffectOp("remove_keyword", (effect, context) => {
  if (effect.op !== "remove_keyword") return { status: "manual", reason: "effect_not_implemented:remove_keyword" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const duration = effect.duration ?? "permanent";
  const done: string[] = [];
  for (const id of found.ids) {
    if (!isOnBoard(context.room, host, id)) continue;
    addKeywordGrant(context.room, host, id, String(effect.keyword), duration, ctx.env.controller, { removed: true });
    done.push(id);
    pushEvent(context.step.events, {
      type: "remove_keyword",
      cardId: id,
      playerId: ctx.env.controller,
      data: { keyword: String(effect.keyword), duration },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
