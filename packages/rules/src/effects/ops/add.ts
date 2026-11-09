/**
 * `add` — rule 430 (430.5: "Add [2]" = 2 Energy, "[Add] [C]" = 1 Calm Power; `any` = Power of
 * any domain). The primitive runs the `add_resources` replacement interceptor.
 */
import { addResources } from "../../actions/resources";
import { RESOLVED } from "../execute";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { amountOf, playersOf } from "./util";

registerEffectOp("add", (effect, context) => {
  if (effect.op !== "add") return { status: "manual", reason: "effect_not_implemented:add" };
  const energy =
    effect.resources.energy !== undefined ? Math.max(0, amountOf(context, effect.resources.energy) ?? 0) : 0;
  const power: Partial<Record<string, number>> = {};
  for (const [domain, value] of Object.entries(effect.resources.power ?? {})) {
    if (typeof value === "number" && value > 0) power[domain] = value;
  }
  const players = playersOf(context, effect.player);
  for (const playerId of players) addResources(context.room, playerId, { energy, power }, context.step);
  recordOutcome(context, [], players.length > 0 && (energy > 0 || Object.keys(power).length > 0));
  return RESOLVED;
});
