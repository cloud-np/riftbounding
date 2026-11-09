/**
 * `move` — rules 421, 447–455.
 *
 * 421.2: a Limited Action instructed by an effect (not the Standard Move, 144). 355.4.a: the
 * destination must differ from the current location. 451.2: units cannot move to a battlefield
 * that already has units of two other players. 449.2.a/464.1: in 3+ player games a battlefield
 * with a Staged Combat or a Combat in progress is invalid for a player not involved (or without
 * units there). 449.2.c: when the Move would make a Unit present at an invalid destination it
 * Recalls instead (456–460; not a Move). 054/358.3.a: a "can't move" restriction negates the
 * instruction on resolution. 452: the primitive applies Contested; 455: the Cleanup after the
 * action stages the Showdown/Combat.
 *
 * Standard Move restrictions (144.1 timing, 144.2 exhaustion, 144.4.c Ganking, 144.4 origins)
 * deliberately do NOT apply here: an effect Move is a Limited Action (421.2.a), not rule 144.
 */
import { movePrimitive, recall } from "../../actions/move";
import { combatBarsDestination } from "../../combat/destinations";
import { restrictionFor } from "../../layers/restrictions";
import { RESOLVED } from "../execute";
import { resolveZoneNames } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { ctxOf, hostOf } from "./util";
import { controllerOf, isBattlefieldZone, isUnit, locationOf, locationZones } from "../objects";
import { hasUnitPresentAt } from "../../state/presence";

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
    // 054.1 / 358.3.a: "can't move" negates the instruction; it is not turned into a Recall.
    if (restrictionFor(context.room, host, { kind: "move", objectId: id, to: destination })) continue;
    if (controller && isUnit(context.room, host, id) && isBattlefieldZone(context.room, host, destination)) {
      // 451.2: Units cannot Move to a Battlefield with Units of two other players, by any means.
      const others = host
        .activePlayerIds(context.room)
        .filter((player) => player !== controller && hasUnitPresentAt(context.room, host, player, destination));
      // 449.2.a / 464.1: a Staged Combat / Combat in progress bars a non-participant (or a
      // participant without Units there) in Modes of Play with more than two players.
      const barred = combatBarsDestination(context.room, controller, destination, "move", host);
      if (others.length >= 2 || barred) {
        // 449.2.c: instead of the impossible Move, the Unit Recalls (456–460).
        if (recall(context.room, id, context.step)) done.push(id);
        continue;
      }
    }
    if (movePrimitive(context.room, id, destination, context.step)) done.push(id);
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
