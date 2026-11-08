/**
 * `attach` / `detach` — rules 435–436, Attachment 716–719.
 *
 * 435.1.h: units cannot be attached (nothing happens). 435.1.f: attaching to a new top-most card
 * detaches from the old one. 435.1.g/435.1.i: attaching to the current top-most card does
 * nothing. 435.4: the attached card's location becomes the top-most card's (not a Move, 435.4.a).
 * 435.5: no other state changes (EX[223]: an exhausted Equipment stays exhausted).
 * 436.1.a.1: detaching an unattached card does nothing; 436.4: it stays at the location (a gear
 * at a battlefield is recalled by the next Cleanup, 436.4.a / 323.6).
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { hostOf, isOnBoard } from "./util";
import { isUnit, locate, locationOf } from "../objects";

registerEffectOp("attach", (effect, context) => {
  if (effect.op !== "attach") return { status: "manual", reason: "effect_not_implemented:attach" };
  const gears = targets(context, effect.gear);
  if (!gears.ok) return gears.result;
  const hosts = targets(context, effect.to);
  if (!hosts.ok) return hosts.result;
  const host = hostOf(context);
  const unitId = hosts.ids[0];
  const done: string[] = [];
  if (unitId && isOnBoard(context.room, host, unitId) && isUnit(context.room, host, unitId)) {
    const unitLocation = locationOf(context.room, host, unitId);
    for (const gearId of gears.ids) {
      const gear = locate(context.room, host, gearId);
      if (!gear || isUnit(context.room, host, gearId)) continue; // 435.1.h.1
      if (gear.card.attachedToCardId === unitId) continue; // 435.1.g
      if (unitLocation && gear.zone !== unitLocation) {
        // 435.4: the attached card moves with the top-most card's location (not a Move).
        if (!host.moveCardTo(context.room, gear.playerId, gear.zone, unitLocation, gearId)) continue;
      }
      if (!host.attach(context.room, gearId, unitId)) continue;
      done.push(gearId);
      pushEvent(context.step.events, {
        type: "attach",
        cardId: gearId,
        playerId: gear.playerId,
        targetIds: [unitId],
        ...(unitLocation ? { zone: unitLocation } : {}),
      });
    }
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerEffectOp("detach", (effect, context) => {
  if (effect.op !== "detach") return { status: "manual", reason: "effect_not_implemented:detach" };
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const host = hostOf(context);
  const done: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    const from = located?.card.attachedToCardId;
    if (!located || !from) continue; // 436.1.a.1
    if (!host.detach(context.room, id)) continue;
    done.push(id);
    pushEvent(context.step.events, { type: "detach", cardId: id, playerId: located.playerId, targetIds: [from] });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
