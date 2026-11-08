/** `seq` — §6.2 control op. R1 only resolves the empty sequence (no-op). */
import { registerEffectOp } from "../registry";
import type { EffectExecutionResult } from "../execute";

registerEffectOp("seq", (effect): EffectExecutionResult => {
  if (effect.op !== "seq") return { status: "manual", reason: "effect_not_implemented:seq" };
  if (effect.effects.length === 0) return { status: "resolved", events: [] };
  return { status: "manual", reason: "effect_not_implemented:seq" };
});
