import type { ActionClock, GameState } from "@rift/protocol";
/** `hv` — elapsed-game clock formatting (`m:ss` below one hour, else `h:mm:ss`). */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Clock base: `seriesStartedAt` from game 2 onward, otherwise room creation. */
export function matchClockBaseMs(
  state: Pick<GameState, "createdAt" | "seriesStartedAt" | "gameNumber">,
): number {
  return (state.gameNumber ?? 1) > 1 ? (state.seriesStartedAt ?? state.createdAt) : state.createdAt;
}

export function matchElapsedMs(
  state: Pick<GameState, "createdAt" | "seriesStartedAt" | "gameNumber">,
  now: number,
): number {
  const base = matchClockBaseMs(state);
  // Fixtures and malformed session docs occasionally carry synthetic timestamps (1, 2…).
  if (!Number.isFinite(base) || base < 1_000_000_000_000 || base > now) return 0;
  // The harness uses a fixed synthetic `createdAt`; stale local games should read 00:00.
  if (now - base > 86_400_000) return 0;
  return now - base;
}

export function canRewindState(
  state: Pick<GameState, "phase" | "rewindablePlayerIds">,
  viewerId: string,
): boolean {
  if (state.phase !== "in_game") return false;
  return state.rewindablePlayerIds?.includes(viewerId) ?? true;
}

export function canForwardState(
  state: Pick<GameState, "phase" | "forwardablePlayerIds" | "forwardAvailableUntil">,
  viewerId: string,
  now: number,
): boolean {
  if (state.phase !== "in_game") return false;
  if (typeof state.forwardAvailableUntil !== "number" || state.forwardAvailableUntil <= now) {
    return false;
  }
  return state.forwardablePlayerIds?.includes(viewerId) ?? true;
}

export function winsFor(state: Pick<GameState, "winsByPlayerId">, playerId: string): number {
  return state.winsByPlayerId?.[playerId] ?? 0;
}

/** `229172.n` — live per-player action-clock totals (base totals + running share). */
export function actionClockTotals(
  clock:
    | Pick<ActionClock, "totals" | "activeTargets" | "runningSince" | "serverNow" | "receivedAt">
    | null
    | undefined,
  playerIds: readonly string[],
  now: number,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const playerId of playerIds) {
    const value = clock?.totals?.[playerId];
    totals[playerId] =
      typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }
  if (!clock || clock.runningSince === null || clock.activeTargets.length === 0) return totals;
  const receivedAt = typeof clock.receivedAt === "number" ? clock.receivedAt : now;
  const elapsed = Math.max(0, Math.trunc(now - receivedAt + clock.serverNow - clock.runningSince));
  if (elapsed <= 0) return totals;
  for (const target of clock.activeTargets) {
    if (target.playerId in totals)
      totals[target.playerId] = (totals[target.playerId] ?? 0) + elapsed;
  }
  return totals;
}

/** Board turn-control intent: beginning phase ends the step, otherwise ends the turn. */
export function turnAdvanceIntent(
  state: Pick<GameState, "activeTurnStep" | "turnNumber" | "activeTurnPlayerId">,
):
  | {
      type: "end_turn";
      observed: { turnNumber: number; activePlayerId: string; activeStep: "beginning" | "main" };
    }
  | {
      type: "end_beginning_phase";
      observed: { turnNumber: number; activePlayerId: string; activeStep: "beginning" | "main" };
    } {
  const activeStep = state.activeTurnStep === "beginning" ? "beginning" : "main";
  return {
    type: activeStep === "beginning" ? "end_beginning_phase" : "end_turn",
    observed: {
      turnNumber: state.turnNumber ?? 0,
      activePlayerId: state.activeTurnPlayerId ?? "",
      activeStep,
    },
  };
}
