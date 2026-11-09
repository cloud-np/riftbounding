/**
 * `swap` — rule 434.
 *
 * 434.1.b: find the difference, increase the lower value and decrease the higher by it (two
 * separate effects, "this turn" for Might, 434.1.d); 434.1.c: equal values → no effect.
 * `zone` swaps the two objects' locations (Moves, 421); `control` exchanges controllers.
 */
import { pushEvent } from "../../types";
import { movePrimitive } from "../../actions/move";
import { addMight } from "../../layers/mods";
import { rawMight } from "../../layers";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { ctxOf, hostOf, isOnBoard } from "./util";
import { controllerOf, locationOf } from "../objects";

registerEffectOp("swap", (effect, context) => {
  if (effect.op !== "swap") return { status: "manual", reason: "effect_not_implemented:swap" };
  const first = targets(context, effect.a);
  if (!first.ok) return first.result;
  const second = targets(context, effect.b);
  if (!second.ok) return second.result;
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const a = first.ids[0];
  const b = second.ids[0];
  if (!a || !b || a === b || !isOnBoard(context.room, host, a) || !isOnBoard(context.room, host, b)) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const property = effect.property ?? "might";
  if (property === "might") {
    const mightA = rawMight(context.room, a, host);
    const mightB = rawMight(context.room, b, host);
    const diff = Math.abs(mightA - mightB);
    if (diff === 0) {
      recordOutcome(context, [], false);
      return RESOLVED;
    }
    const [low, high] = mightA < mightB ? [a, b] : [b, a];
    addMight(context.room, host, low, diff, "this-turn", ctx.env.controller, ctx.env.sourceObjectId);
    addMight(context.room, host, high, -diff, "this-turn", ctx.env.controller, ctx.env.sourceObjectId);
    pushEvent(context.step.events, { type: "swap", targetIds: [a, b], data: { property, diff } });
  } else if (property === "zone") {
    const zoneA = locationOf(context.room, host, a);
    const zoneB = locationOf(context.room, host, b);
    if (!zoneA || !zoneB || zoneA === zoneB) {
      recordOutcome(context, [], false);
      return RESOLVED;
    }
    movePrimitive(context.room, a, zoneB, context.step);
    movePrimitive(context.room, b, zoneA, context.step);
    pushEvent(context.step.events, { type: "swap", targetIds: [a, b], data: { property } });
  } else {
    const controllerA = controllerOf(context.room, host, a);
    const controllerB = controllerOf(context.room, host, b);
    if (!controllerA || !controllerB || controllerA === controllerB) {
      recordOutcome(context, [], false);
      return RESOLVED;
    }
    host.setController(context.room, a, controllerB);
    host.setController(context.room, b, controllerA);
    pushEvent(context.step.events, { type: "swap", targetIds: [a, b], data: { property } });
  }
  recordOutcome(context, [a, b], true);
  return RESOLVED;
});
