/**
 * Effect-op registry — §6.2.
 *
 * Module-level table of pure functions filled at import time. It holds no game state (the room
 * is always an argument). Unregistered ops resolve to `manual` exactly as in R1.
 */
import type { Effect } from "@rift/protocol";
import type { EffectExecutionContext, EffectExecutionResult } from "./execute";

export type EffectOp = Effect["op"];
export type OpHandler = (effect: Effect, context: EffectExecutionContext) => EffectExecutionResult;

const EFFECT_OPS: Partial<Record<EffectOp, OpHandler>> = {};

export function registerEffectOp(op: EffectOp, handler: OpHandler): void {
  EFFECT_OPS[op] = handler;
}

export function getEffectOp(op: EffectOp): OpHandler | undefined {
  return EFFECT_OPS[op];
}

export function registeredEffectOps(): EffectOp[] {
  return (Object.keys(EFFECT_OPS) as EffectOp[]).sort((a, b) => a.localeCompare(b));
}

export { EFFECT_OPS };
