/**
 * Ordered hook registry — the R2 effects/trigger/replacement extension points.
 *
 * Hooks are module-level ordered lists of pure functions filled at import time (contract §1
 * exemption, like the card/prompt/task registries). They hold no game state; the room and step
 * are always arguments. With no hooks registered every call point is a no-op, so R1 behaviour is
 * byte-for-byte unchanged.
 *
 * | Hook point | When it runs | Rule | Arguments |
 * |---|---|---|---|
 * | `advance:beforeTasks` | each auto-advance iteration, before Outstanding Tasks and FEPR | 303.2.a (trigger queue → chain), 334 | room, step |
 * | `advance:afterResolve` | after a pending chain item finalizes + cleans up | 334, 337 | room, step |
 * | `advance:phaseStart` | before each phase/substep switch | 335 | room, step |
 * | `finalize:afterFinalize` | immediately after an item becomes Finalized | 337.1 (“when played” triggers) | room, **item**, step |
 * | `cleanup:afterStep3a` | after the Special Cleanup inserts (3c/3d/3e) | 324.1 | room, step |
 * | `cleanup:afterStateChange` | before the 322 fixed-point check | 322 | room, step |
 * | `action:*` interceptor | at the start of every game-action primitive in `actions/**` | 367–375 (replacement effects) | room, step, **proposal** → proposal \| null |
 * | (interceptor return `null`) | tells the primitive to skip the action entirely | 368 | — |
 *
 * Action interceptors are a chain: each receives the previous proposal (so a replacement can
 * modify amounts/targets) and returning `null` prevents the action. `interceptAction` returns
 * the original proposal unchanged when no interceptor is registered.
 */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { DuplicateRegistrationError, orderedRegistry } from "../registry-table";

export type RulesHook = (room: Room, step: RulesStepContext) => void;

export type AdvanceHookPoint = "beforeTasks" | "afterResolve" | "phaseStart";
export type CleanupHookPoint = "afterStep3a" | "afterStateChange";

const ADVANCE_HOOKS: Record<AdvanceHookPoint, RulesHook[]> = {
  beforeTasks: [],
  afterResolve: [],
  phaseStart: [],
};

const CLEANUP_HOOKS: Record<CleanupHookPoint, RulesHook[]> = {
  afterStep3a: [],
  afterStateChange: [],
};

/* ---------------------------------------------------------------- finalize (337.1) */

/** 337.1: “when played” triggers need the finalized item, not only the room. */
export type FinalizeHook = (room: Room, item: ChainItem, step: RulesStepContext) => void;

/** Alias named after the hook point (`afterFinalize`). */
export type AfterFinalizeHook = FinalizeHook;

const FINALIZE_REGISTRY = orderedRegistry<FinalizeHook>("finalize hook");
const FINALIZE_HOOKS = FINALIZE_REGISTRY.list;

/** Register a 337.1 finalize hook (`afterFinalize`); returns an unsubscribe function. */
export function registerFinalizeHook(hook: FinalizeHook): () => void {
  return FINALIZE_REGISTRY.register(hook);
}

/** Alias named after the hook point (`afterFinalize`). */
export const registerAfterFinalizeHook = registerFinalizeHook;

export function runFinalizeHooks(room: Room, item: ChainItem, step: RulesStepContext): void {
  for (const hook of FINALIZE_HOOKS) hook(room, item, step);
}

/** Alias named after the hook point (`afterFinalize`). */
export const runAfterFinalizeHooks = runFinalizeHooks;

/* ---------------------------------------------------------------- action interceptors (367–375) */

/**
 * A game-action proposal. `type` is the action name (`draw`, `deal_damage`, `kill`, `move`,
 * `conquer`, …); the remaining fields are the action's arguments. Interceptors may return a
 * modified proposal (369/370 replacement) or `null` (368 prevention).
 */
export interface ActionProposal {
  type: string;
  playerId?: string;
  cardId?: string;
  objectId?: string;
  zone?: string;
  amount?: number;
  data?: Record<string, unknown>;
}

export type ActionInterceptor = (
  room: Room,
  step: RulesStepContext,
  proposal: ActionProposal,
) => ActionProposal | null;

const INTERCEPTOR_REGISTRY = orderedRegistry<ActionInterceptor>("action interceptor");
const ACTION_INTERCEPTORS = INTERCEPTOR_REGISTRY.list;

/** Register a 367–375 replacement/prevention interceptor; returns an unsubscribe function. */
export function registerActionInterceptor(interceptor: ActionInterceptor): () => void {
  return INTERCEPTOR_REGISTRY.register(interceptor);
}

/**
 * Run the action through every registered interceptor in registration order.
 * No interceptors ⇒ the same proposal object is returned (no allocation, no behaviour change).
 */
export function interceptAction(
  room: Room,
  step: RulesStepContext,
  proposal: ActionProposal,
): ActionProposal | null {
  let current: ActionProposal | null = proposal;
  for (const interceptor of ACTION_INTERCEPTORS) {
    if (!current) return null;
    current = interceptor(room, step, current);
  }
  return current;
}

/* ---------------------------------------------------------------- registry accessors */

/** Register an advance hook; returns an unsubscribe function (test isolation). */
export function registerAdvanceHook(point: AdvanceHookPoint, hook: RulesHook): () => void {
  if (ADVANCE_HOOKS[point].includes(hook)) throw new DuplicateRegistrationError(`advance hook (${point})`, hook.name || "<anonymous>");
  ADVANCE_HOOKS[point].push(hook);
  return () => {
    ADVANCE_HOOKS[point] = ADVANCE_HOOKS[point].filter((entry) => entry !== hook);
  };
}

/** Register a cleanup hook; returns an unsubscribe function (test isolation). */
export function registerCleanupHook(point: CleanupHookPoint, hook: RulesHook): () => void {
  if (CLEANUP_HOOKS[point].includes(hook)) throw new DuplicateRegistrationError(`cleanup hook (${point})`, hook.name || "<anonymous>");
  CLEANUP_HOOKS[point].push(hook);
  return () => {
    CLEANUP_HOOKS[point] = CLEANUP_HOOKS[point].filter((entry) => entry !== hook);
  };
}

export function runAdvanceHooks(point: AdvanceHookPoint, room: Room, step: RulesStepContext): void {
  for (const hook of ADVANCE_HOOKS[point]) hook(room, step);
}

export function runCleanupHooks(point: CleanupHookPoint, room: Room, step: RulesStepContext): void {
  for (const hook of CLEANUP_HOOKS[point]) hook(room, step);
}

/** Diagnostics for tests/coverage. */
export function registeredHooks(): {
  advance: Record<AdvanceHookPoint, number>;
  cleanup: Record<CleanupHookPoint, number>;
  finalize: number;
  afterFinalize: number;
  actionInterceptors: number;
} {
  return {
    advance: {
      beforeTasks: ADVANCE_HOOKS.beforeTasks.length,
      afterResolve: ADVANCE_HOOKS.afterResolve.length,
      phaseStart: ADVANCE_HOOKS.phaseStart.length,
    },
    cleanup: {
      afterStep3a: CLEANUP_HOOKS.afterStep3a.length,
      afterStateChange: CLEANUP_HOOKS.afterStateChange.length,
    },
    finalize: FINALIZE_HOOKS.length,
    afterFinalize: FINALIZE_HOOKS.length,
    actionInterceptors: ACTION_INTERCEPTORS.length,
  };
}
