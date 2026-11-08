/**
 * Runtime patch applier — exact port of the client's `applyRuntimePatch`
 * (`.recon/pretty/playapp/1w8d13szpogkp.js:2560-2810`, module scope helpers at 180-400).
 *
 * The applier is copy-on-write in the original (structural sharing); this port deep-clones the
 * working state once, then mutates it. Functional behaviour, validation order and error messages
 * match the original; input state is never mutated.
 */

import type {
  GameplayLogEntry,
  RawActionClock,
  Room,
  RoomPlayer,
  PlayerBoard,
  RuntimePatch,
  RuntimePatchOperation,
  Zone,
} from "@rift/protocol";

/** Every card-holding zone (`965166.g`). */
export const BOARD_ZONES: readonly Zone[] = [
  "deck",
  "hand",
  "base",
  "trash",
  "banished",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "champion",
  "legend",
  "runeDeck",
  "runeArea",
];

const BOARD_ZONE_SET: ReadonlySet<string> = new Set(BOARD_ZONES);
export function isBoardZone(zone: string): boolean {
  return BOARD_ZONE_SET.has(zone);
}

export interface RuntimePatchState {
  room: Room;
  sequence: number;
  gameplayLogEntries: GameplayLogEntry[];
  actionClock?: RawActionClock;
  session?: Record<string, unknown>;
}

type MutableState = RuntimePatchState;

function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function getPlayer(state: MutableState, playerId: string): RoomPlayer {
  const player = state.room.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw Error(`Cannot apply runtime patch for unknown player ${playerId}.`);
  }
  return player;
}

function getBoard(player: RoomPlayer, playerId: string): PlayerBoard {
  if (!player.board) {
    throw Error(`Cannot apply runtime patch without board for ${playerId}.`);
  }
  return player.board;
}

function getZone(board: PlayerBoard, zone: string): unknown[] {
  const value = (board as unknown as Record<string, unknown>)[zone];
  if (Array.isArray(value)) return value;
  const created: unknown[] = [];
  (board as unknown as Record<string, unknown>)[zone] = created;
  return created;
}

function findCardIndex(zoneCards: unknown[], cardId: string): number {
  return zoneCards.findIndex((card) => (card as { id?: unknown } | null)?.id === cardId);
}

function requireCardIndex(zoneCards: unknown[], cardId: string): number {
  const index = findCardIndex(zoneCards, cardId);
  if (index < 0) throw Error(`Cannot patch missing runtime card ${cardId}.`);
  return index;
}

function removeCard(board: PlayerBoard, zone: string, cardId: string): unknown {
  const cards = getZone(board, zone);
  const index = findCardIndex(cards, cardId);
  if (index < 0) throw Error(`Cannot remove missing runtime card ${cardId}.`);
  const [card] = cards.splice(index, 1);
  if (!card) throw Error(`Cannot remove missing runtime card ${cardId}.`);
  return card;
}

function insertCards(board: PlayerBoard, zone: string, index: number, cards: unknown[]): void {
  const target = getZone(board, zone);
  if (index < 0 || index > target.length) {
    throw Error(`Cannot insert runtime cards at index ${index}.`);
  }
  target.splice(index, 0, ...cards);
}

function findCardInBoard(
  board: PlayerBoard,
  zone: string,
  cardId: string,
): { cards: unknown[]; index: number } {
  const raw = (board as unknown as Record<string, unknown>)[zone];
  if (!Array.isArray(raw)) throw Error(`Cannot patch missing runtime card ${cardId}.`);
  const index = requireCardIndex(raw, cardId);
  return { cards: raw, index };
}

/* ------------------------------------------------------------------ rune invariants */

export const RUNE_COUNT_CHANGED_MESSAGE =
  "That action would add or remove runes from a rune pool, so it was not applied.";

function runePoolSize(board: PlayerBoard): number {
  return (board.runeDeck?.length ?? 0) + (board.runeArea?.length ?? 0);
}

/**
 * `618260._` — every player's rune-pool *size* must be unchanged. This is the check the client
 * runs on every incoming `authoritative_patch_commit`; a violation forces a resync.
 *
 * Named `runeCountsPreserved` to match the client runtime adapter (`apps/play/src/runtime/adapters/sync.ts`).
 */
export function runeCountsPreserved(previous: Room, next: Room): boolean {
  if (previous.players.length !== next.players.length) return false;
  for (const before of previous.players) {
    const after = next.players.find((player) => player.id === before.id);
    if (!after || !!before.board !== !!after.board) return false;
    if (before.board && after.board && runePoolSize(before.board) !== runePoolSize(after.board)) {
      return false;
    }
  }
  return true;
}

/** Alias kept for callers that prefer the explicit name. */
export const runePoolSizesPreserved = runeCountsPreserved;

/**
 * `618260.M` — the multiset of rune card ids in `runeDeck ∪ runeArea` must be preserved.
 * Used for authoritative transitions (unredacted room state), not for redacted patch guards.
 */
export function runeMultisetsPreserved(previous: Room, next: Room): boolean {
  if (previous.players.length !== next.players.length) return false;
  for (const before of previous.players) {
    const after = next.players.find((player) => player.id === before.id);
    if (!after || !!before.board !== !!after.board) return false;
    if (!before.board || !after.board) continue;
    if (
      before.board.runeDeck === after.board.runeDeck &&
      before.board.runeArea === after.board.runeArea
    ) {
      continue;
    }
    if (runePoolSize(before.board) !== runePoolSize(after.board)) return false;
    const counts = new Map<string, number>();
    for (const zone of [before.board.runeDeck ?? [], before.board.runeArea ?? []]) {
      for (const card of zone) counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
    }
    for (const zone of [after.board.runeDeck ?? [], after.board.runeArea ?? []]) {
      for (const card of zone) {
        const remaining = counts.get(card.id) ?? 0;
        if (remaining === 0) return false;
        counts.set(card.id, remaining - 1);
      }
    }
  }
  return true;
}

/* ------------------------------------------------------------------ applier */

function applyOperation(state: MutableState, operation: RuntimePatchOperation): void {
  switch (operation.op) {
    case "set_room_fields": {
      const room = state.room as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(operation.fields)) room[key] = clone(value);
      return;
    }
    case "unset_room_fields": {
      const room = state.room as unknown as Record<string, unknown>;
      for (const key of operation.fields) delete room[key];
      return;
    }
    case "chain_insert": {
      state.room.chainEntries.splice(
        operation.index,
        0,
        ...(clone(operation.entries) as Room["chainEntries"]),
      );
      return;
    }
    case "chain_remove": {
      const removed = new Set(operation.entryIds);
      state.room.chainEntries = state.room.chainEntries.filter((entry) => !removed.has(entry.id));
      return;
    }
    case "chain_replace": {
      state.room.chainEntries = clone(operation.entries) as Room["chainEntries"];
      return;
    }
    case "set_session_fields": {
      const session = (state.session ??= {});
      for (const [key, value] of Object.entries(operation.fields)) session[key] = clone(value);
      return;
    }
    case "unset_session_fields": {
      if (!state.session) return;
      for (const key of operation.fields) delete state.session[key];
      return;
    }
    case "set_player_fields": {
      const player = getPlayer(state, operation.playerId) as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(operation.fields)) player[key] = clone(value);
      return;
    }
    case "unset_player_fields": {
      const player = getPlayer(state, operation.playerId) as unknown as Record<string, unknown>;
      for (const key of operation.fields) delete player[key];
      return;
    }
    case "set_board_fields": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId) as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(operation.fields)) board[key] = clone(value);
      return;
    }
    case "unset_board_fields": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId) as unknown as Record<string, unknown>;
      for (const key of operation.fields) delete board[key];
      return;
    }
    case "zone_insert": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId);
      insertCards(board, operation.zone, operation.index, clone(operation.cards));
      return;
    }
    case "zone_remove": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId);
      for (const cardId of operation.cardIds) removeCard(board, operation.zone, cardId);
      return;
    }
    case "zone_move": {
      const fromPlayer = getPlayer(state, operation.from.playerId);
      const fromBoard = getBoard(fromPlayer, operation.from.playerId);
      const moved = removeCard(fromBoard, operation.from.zone, operation.cardId);
      const toPlayer = getPlayer(state, operation.to.playerId);
      const toBoard = getBoard(toPlayer, operation.to.playerId);
      insertCards(toBoard, operation.to.zone, operation.to.index, [
        operation.card !== undefined ? clone(operation.card) : moved,
      ]);
      return;
    }
    case "zone_reorder": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId);
      const cards = getZone(board, operation.zone) as Array<{ id?: string }>;
      if (cards.length !== operation.cardIds.length) {
        throw Error("Cannot reorder runtime zone with different card count.");
      }
      const byId = new Map(cards.map((card) => [card.id, card]));
      (board as unknown as Record<string, unknown>)[operation.zone] = operation.cardIds.map(
        (cardId) => {
          const card = byId.get(cardId);
          if (!card) {
            throw Error(`Cannot reorder missing or repeated runtime card ${cardId}.`);
          }
          byId.delete(cardId);
          return card;
        },
      );
      return;
    }
    case "zone_replace": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId);
      (board as unknown as Record<string, unknown>)[operation.zone] = clone(operation.cards);
      return;
    }
    case "patch_card_fields": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId);
      const found = findCardInBoard(board, operation.zone, operation.cardId);
      const card = found.cards[found.index] as Record<string, unknown>;
      for (const [key, value] of Object.entries(operation.fields)) card[key] = clone(value);
      return;
    }
    case "unset_card_fields": {
      const player = getPlayer(state, operation.playerId);
      const board = getBoard(player, operation.playerId);
      const found = findCardInBoard(board, operation.zone, operation.cardId);
      const card = found.cards[found.index] as Record<string, unknown>;
      for (const key of operation.fields) delete card[key];
      return;
    }
    case "log_insert": {
      state.gameplayLogEntries.splice(operation.index, 0, ...clone(operation.entries));
      return;
    }
    case "log_remove": {
      const removed = new Set(operation.entryIds);
      state.gameplayLogEntries = state.gameplayLogEntries.filter((entry) => !removed.has(entry.id));
      return;
    }
    case "log_replace": {
      state.gameplayLogEntries = clone(operation.entries);
      return;
    }
    case "set_action_clock": {
      state.actionClock = clone(operation.actionClock);
      return;
    }
    case "clear_action_clock": {
      delete state.actionClock;
      return;
    }
    default: {
      throw Error(`Unknown runtime patch operation ${String(operation)}.`);
    }
  }
}

/** Validate the runtime patch payload shape (`Runtime patch payload is invalid.`). */
export function assertRuntimePatch(value: unknown): asserts value is RuntimePatch {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !Array.isArray((value as RuntimePatch).operations)
  ) {
    throw Error("Runtime patch payload is invalid.");
  }
}

/**
 * Apply a runtime patch. Returns the next state (`sequence` is not modified by the patch; callers
 * set it from `authoritative_patch_commit.sequence`).
 */
export function applyRuntimePatch(
  state: RuntimePatchState,
  patch: RuntimePatch,
): RuntimePatchState {
  assertRuntimePatch(patch);
  if (patch.operations.length === 0) return state;
  const next: MutableState = {
    ...state,
    room: clone(state.room),
    gameplayLogEntries: clone(state.gameplayLogEntries),
    ...(state.session !== undefined ? { session: clone(state.session) } : {}),
    ...(state.actionClock !== undefined ? { actionClock: clone(state.actionClock) } : {}),
  };
  for (const operation of patch.operations) applyOperation(next, operation);
  return next;
}

/** Alias used by the protocol contract (`RuntimeHelpers.applyPatch`). */
export const applyPatch = applyRuntimePatch;

/**
 * Original patch-acceptance helper: apply + rune-pool size guard. Returns `null` when the patch
 * would change a rune pool size (client triggers a resync).
 */
export function applyRuntimePatchGuarded(
  state: RuntimePatchState,
  patch: RuntimePatch,
): RuntimePatchState | null {
  const next = applyRuntimePatch(state, patch);
  return runePoolSizesPreserved(state.room, next.room) ? next : null;
}

/** `N(action)` — rewind/forward classification used by snapshots. */
export function isResetAction(
  action?: { type?: string; response?: unknown } | null,
): "rewind" | "forward" | null {
  if (action?.type === "rewind_last_action") return "rewind";
  if (action?.type === "forward_last_rewind") return "forward";
  // `c5`: approving a pending rewind performs the rewind and must reset the branch too.
  if (action?.type === "respond_rewind_confirmation" && action.response === "approve")
    return "rewind";
  return null;
}

/** Alias used by the play runtime adapter. */
export const isHistoryNavigationAction = isResetAction;

/** Empty patch. */
export function emptyPatch(): RuntimePatch {
  return { operations: [] };
}

export type { Zone };
