/**
 * @rift/engine adapter — optimistic action application.
 *
 * Contract (docs/ARCHITECTURE.md):
 *   applyGameAction(state, actorPlayerId, action, ctx):
 *     | { ok: true; state: GameState; log: GameLogEntry[]; sound?: string | null }
 *     | { ok: false; error: string; errorCode?: string }
 *
 * The original client applies a mirror of the server transition function optimistically for the
 * action types in `cV` (`35qz5rkx7yexy.js:24296-24368`, exported as `OPTIMISTIC_ACTIONS`) and lets
 * the authoritative patch reconcile/rollback. This adapter is the only place the runtime touches
 * the engine.
 *
 * `@rift/engine` is being written concurrently; until it exports `applyGameAction` the adapter
 * reports `{ ok: false, error: ENGINE_NOT_READY }` so the runtime degrades to "wait for the
 * authoritative patch" (never a broken optimistic state).
 *
 * TODO(B11→@rift/engine owner): when `applyGameAction` lands, check that the returned `state` is a
 * `Room` (the runtime passes the projected room) and that `sound` uses the SFX keys from
 * `sounds.ts`.
 */

import type { GameplayAction, Room } from "@rift/protocol";
import * as engine from "@rift/engine";

export interface EngineActionContext {
  now: number;
  rng: () => number;
  mode: "multiplayer" | "solo_lab" | "single_player";
}

export type EngineApplyResult =
  | { ok: true; state: Room; log: unknown[]; sound?: string | null }
  | { ok: false; error: string; errorCode?: string };

type EngineModule = {
  applyGameAction?: (
    state: Room,
    actorPlayerId: string,
    action: GameplayAction,
    ctx: EngineActionContext,
  ) => unknown;
};

const candidate = engine as unknown as EngineModule;

export const ENGINE_NOT_READY = "engine_not_ready";

export function hasEngineApply(): boolean {
  return typeof candidate.applyGameAction === "function";
}

/**
 * Apply one action optimistically. Never throws; an unavailable/refusing engine returns
 * `{ ok: false }` and the runtime keeps the authoritative room untouched.
 */
export function applyGameActionOptimistic(
  state: Room,
  actorPlayerId: string,
  action: GameplayAction,
  ctx: EngineActionContext,
): EngineApplyResult {
  if (!candidate.applyGameAction) {
    return { ok: false, error: ENGINE_NOT_READY, errorCode: ENGINE_NOT_READY };
  }
  try {
    const result = candidate.applyGameAction(state, actorPlayerId, action, ctx) as
      | { ok: true; state: Room; log?: unknown[]; sound?: string | null }
      | { ok: false; error: string; errorCode?: string }
      | undefined;
    if (!result || typeof result !== "object" || !("ok" in result)) {
      return { ok: false, error: "engine_invalid_result" };
    }
    if (result.ok) {
      return {
        ok: true,
        state: result.state,
        log: result.log ?? [],
        ...(result.sound === undefined ? {} : { sound: result.sound }),
      };
    }
    return {
      ok: false,
      error: result.error,
      ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
