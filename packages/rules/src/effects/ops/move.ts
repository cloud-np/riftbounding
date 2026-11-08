/**
 * `move` — rules 421, 447–455.
 *
 * 421.2: a Limited Action instructed by an effect (not the Standard Move, 144). 355.4.a: the
 * destination must differ from the current location. 451.2: units cannot move to a battlefield
 * that already has units of two other players. 054/358.3.a: a "can't move" restriction negates
 * the instruction on resolution. 452: the primitive applies Contested; 455: the Cleanup after the
 * action stages the Showdown/Combat.
 */
import { movePrimitive } from "../../actions/move";
import { restrictionFor } from "../../layers/restrictions";
import { RESOLVED } from "../execute";
import { resolveZoneNames } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { ctxOf, hostOf } from "./util";
import { controllerOf, isBattlefieldZone, locationOf, locationZones } from "../objects";

registerEffectOp("move", (effect, context) => {
  if (effect.op !== "move") return { status: "manual", reason: "effect_not_implemented:move" };
  const ctx = ctxOf(context);
  const host = hostOf(context);
  const machine = context.machine;
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  let zones = resolveZoneNames(ctx, effect.to).filter((zone) => locationZones(context.room, host).includes(zone));
  if (zones.length > 1) {
    const answer = machine?.frame.answer;
    if (typeof answer === "string" && zones.includes(answer)) {
      zones = [answer];
      if (machine) machine.frame.answer = undefined;
    } else if (machine) {
      return machine.ask({
        kind: "choose-battlefield",
        playerId: ctx.env.controller,
        options: zones.map((zone) => ({ id: zone, zone })),
        min: 1,
        max: 1,
        rule: "355.4",
        promptKey: "rules.prompt.chooseDestination",
        data: { answer: "zone" },
      });
    }
  }
  const destination = zones[0];
  const done: string[] = [];
  if (!destination) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  for (const id of found.ids) {
    const from = locationOf(context.room, host, id);
    if (!from || from === destination) continue; // 355.4.a
    const controller = controllerOf(context.room, host, id);
    if (isBattlefieldZone(context.room, host, destination)) {
      const others = host
        .activePlayerIds(context.room)
        .filter((player) => player !== controller && host.hasUnitAt(context.room, player, destination));
      if (others.length >= 2) continue; // 451.2
    }
    if (restrictionFor(context.room, host, { kind: "move", objectId: id, to: destination })) continue;
    if (movePrimitive(context.room, id, destination, context.step)) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
