/**
 * @rift/sync adapter.
 *
 * The runtime must not depend on the internals of `@rift/sync` (written concurrently by another
 * agent). Everything sync-related goes through this adapter:
 *
 *  - patch application (`applyRuntimePatch`)
 *  - rune conservation checks (`runeCountsPreserved` / `runeMultisetsPreserved`)
 *  - reset/history-navigation classification
 *
 * If `@rift/sync` exports compatible helpers they are used; otherwise the local reference port in
 * `../patch.ts` is used. TODO(B11→@rift/sync owner): once `@rift/sync` ships `applyRuntimePatch` /
 * `runeCountsPreserved` with the same signatures, this adapter will pick them up automatically —
 * verify signature parity and delete the fallback if it becomes redundant.
 */

import type { Room, RuntimePatch } from "@rift/protocol";
import * as sync from "@rift/sync";
import {
  RUNE_COUNT_CHANGED_MESSAGE as localRuneCountChangedMessage,
  applyRuntimePatch as localApplyRuntimePatch,
  cooldownUntil as localCooldownUntil,
  runePoolCounts as localRunePoolCounts,
  isHistoryNavigationAction as localIsHistoryNavigationAction,
  resetToken as localResetToken,
  runeCountsPreserved as localRuneCountsPreserved,
  runeMultisetsPreserved as localRuneMultisetsPreserved,
  type AuthoritativeReset,
  type RuntimePatchState,
} from "../patch";

type SyncModule = {
  applyRuntimePatch?: (state: RuntimePatchState, patch: RuntimePatch) => RuntimePatchState;
  runeCountsPreserved?: (previous: Room, next: Room) => boolean;
  runeMultisetsPreserved?: (previous: Room, next: Room) => boolean;
  isHistoryNavigationAction?: (action?: {
    type: string;
    response?: unknown;
  }) => "rewind" | "forward" | null;
  resetToken?: (input: {
    action?: { type: string } | undefined;
    gameInstanceId: string;
    sequence: number;
    token: string;
  }) => AuthoritativeReset;
};

const candidate = sync as unknown as SyncModule;

export function hasSyncPackagePatchApply(): boolean {
  return typeof candidate.applyRuntimePatch === "function";
}

export function applyRuntimePatch(
  state: RuntimePatchState,
  patch: RuntimePatch,
): RuntimePatchState {
  const implementation = candidate.applyRuntimePatch ?? localApplyRuntimePatch;
  return implementation(state, patch);
}

export function runeCountsPreserved(previous: Room, next: Room): boolean {
  const implementation = candidate.runeCountsPreserved ?? localRuneCountsPreserved;
  return implementation(previous, next);
}

export function runeMultisetsPreserved(previous: Room, next: Room): boolean {
  const implementation = candidate.runeMultisetsPreserved ?? localRuneMultisetsPreserved;
  return implementation(previous, next);
}

export function isHistoryNavigationAction(action?: {
  type: string;
  response?: unknown;
}): "rewind" | "forward" | null {
  const implementation = candidate.isHistoryNavigationAction ?? localIsHistoryNavigationAction;
  return implementation(action);
}

export function resetToken(input: {
  action?: { type: string; [key: string]: unknown } | undefined;
  gameInstanceId: string;
  sequence: number;
  token: string;
}): AuthoritativeReset {
  const implementation = candidate.resetToken ?? localResetToken;
  return implementation(input);
}

export const RUNE_COUNT_CHANGED_MESSAGE = localRuneCountChangedMessage;

export function cooldownUntil(remainingMs: unknown, now: number): number | null {
  return localCooldownUntil(remainingMs, now);
}

export function runePoolCounts(room: Room): Record<string, number | null> {
  return localRunePoolCounts(room);
}

export type { AuthoritativeReset, RuntimePatchState };
