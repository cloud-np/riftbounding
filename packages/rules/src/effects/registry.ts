/**
 * Effect-op registry — §6.2.
 *
 * Module-level table of pure functions filled at import time. It holds no game state (the room
 * is always an argument). Unregistered ops resolve to `manual` exactly as in R1.
 */
import type { Effect } from "@rift/protocol";
import type { EffectExecutionContext, EffectExecutionResult } from "./execute";
import { keyedRegistry } from "../registry-table";

export type EffectOp = Effect["op"];
export type OpHandler = (effect: Effect, context: EffectExecutionContext) => EffectExecutionResult;

const EFFECT_OPS: Partial<Record<EffectOp, OpHandler>> = {};

/** G1: one handler per op; a second registration throws (tests: `src/testing.ts`). */
export const EFFECT_OP_REGISTRY = keyedRegistry<OpHandler>("effect op", EFFECT_OPS as Record<string, OpHandler>);

export function registerEffectOp(op: EffectOp, handler: OpHandler): void {
  EFFECT_OP_REGISTRY.register(op, handler);
}

export function getEffectOp(op: EffectOp): OpHandler | undefined {
  return EFFECT_OPS[op];
}

export function registeredEffectOps(): EffectOp[] {
  return EFFECT_OP_REGISTRY.keys() as EffectOp[];
}

export { EFFECT_OPS };
