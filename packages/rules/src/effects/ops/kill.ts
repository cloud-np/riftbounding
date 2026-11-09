/**
 * `kill` — rule 429.
 *
 * 429.1.a.1: an Active Kill (Kill Instruction). 429.2/429.2.a: only permanents on the board go
 * to the trash and count as killed. 429.5.b: the spell/ability with the instruction is
 * attributed the kill; its controller is responsible (412). Leave-the-board triggers
 * (Deathknell, 808.1.d.2) are detected from the `kill` event, which carries last-known
 * information.
 */
import { kill } from "../../actions/move";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { noteLki, recordOutcome, targets } from "../targets";
import { ctxOf, hostOf, isOnBoard } from "./util";
import { typeOf } from "../objects";

registerEffectOp("kill", (effect, context) => {
  if (effect.op !== "kill") return { status: "manual", reason: "effect_not_implemented:kill" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const ids = found.ids.filter((id) => {
    if (!isOnBoard(context.room, host, id)) return false;
    const type = typeOf(context.room, host, id);
    return type.includes("unit") || type.includes("gear");
  });
  noteLki(ctx, ids);
  const done: string[] = [];
  for (const id of ids) {
    const source = {
      ...(ctx.env.sourceObjectId ? { objectId: ctx.env.sourceObjectId } : {}),
      playerId: ctx.env.controller,
    };
    if (kill(context.room, id, context.step, source)) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
