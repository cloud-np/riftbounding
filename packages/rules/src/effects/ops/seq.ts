/** `seq` — §6.2 control op: instructions execute from top to bottom (359.3.d). */
import { registerEffectOp } from "../registry";
import { executeEffect, RESOLVED } from "../execute";

registerEffectOp("seq", (effect, context) => {
  if (effect.op !== "seq") return { status: "manual", reason: "effect_not_implemented:seq" };
  if (!context.machine) return executeEffect(effect, context);
  context.machine.push(...effect.effects.map((child) => ({ effect: child })));
  return RESOLVED;
});
