/**
 * Strict repro files (rewind/forward + determinism).
 *
 * A repro is the exact initial `Room` snapshot (which already carries decklists, board zones,
 * the seeded RNG position and `Room.rules`) plus the ordered accepted actions after it. Replaying
 * the actions through `applyGameAction` must reproduce `finalHash`.
 *
 * Additive wire/type surface: no message or action changed. The file is produced by the realtime
 * room's `export_repro` HTTP action and consumed by the engine replay harness and the dev-only
 * `load_repro` import.
 */

import type { Room, RoomMode } from "./game-state";
import type { RulesMode } from "./rules-state";

export const STRICT_REPRO_FORMAT = "rift-strict-repro" as const;
export const STRICT_REPRO_VERSION = 1 as const;

/** One accepted action in the repro. `action` is the exact wire payload (including bot actions). */
export interface StrictReproAction {
  /** 0-based position in the action list. */
  index: number;
  /** Server clock value passed as `ActionContext.now` (log ids/timestamps replay exactly). */
  at: number;
  actorId: string;
  action: Record<string, unknown> & { type: string };
}

/** The JSON file downloaded by the "Export repro" control. */
export interface StrictReproFile {
  format: typeof STRICT_REPRO_FORMAT;
  version: typeof STRICT_REPRO_VERSION;
  exportedAt: number;
  roomCode: string;
  rulesMode: RulesMode;
  roomMode: RoomMode;
  /** The room's stored game seed (also present on `initial.rngSeed`). */
  gameSeed?: number;
  /** Full room snapshot immediately before `actions[0]`; carries decks and `Room.rules`. */
  initial: Room;
  /** FNV-1a hash of the stable JSON form of `initial`. */
  initialHash?: string;
  /** Decklists by player id, copied for readability (the authoritative copy is `initial`). */
  decklists: Record<string, string | null>;
  actions: StrictReproAction[];
  /**
   * Hash of the room after each action (`stepHashes[i]`). The replay harness reports the first
   * divergent step instead of only a final mismatch.
   */
  stepHashes?: string[];
  /** FNV-1a hash of the stable JSON form of the final room (see `hashRoomState`). */
  finalHash: string;
  finalActionCount?: number;
  /** True when the room's bounded history had already dropped the earliest actions. */
  truncated?: boolean;
}
