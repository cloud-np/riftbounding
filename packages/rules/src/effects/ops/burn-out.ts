/** `burn_out` — rule 432 (via the R1 primitive: recycle trash, an opponent gains 1 point). */
import { burnOut } from "../../actions/draw";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { playersOf } from "./util";

registerEffectOp("burn_out", (effect, context) => {
  if (effect.op !== "burn_out") return { status: "manual", reason: "effect_not_implemented:burn_out" };
  const players = playersOf(context, effect.player);
  for (const playerId of players) burnOut(context.room, playerId, context.step);
  recordOutcome(context, [], players.length > 0);
  return RESOLVED;
});
