/**
 * Runtime patch applier — verbatim port of `.recon/pretty/playapp/1w8d13szpogkp.js:2548-2870`
 * (module 432014 helpers `k/R/C/A/E/P/j/q/T/O/w/S/B` + the 21 `RuntimePatchOperation` cases) and
 * the rune-conservation guard (module 618260: `_`/`M`/`N`/`w`).
 *
 * `applyRuntimePatch` throws on malformed operations exactly like the original (the caller treats a
 * throw as `resync { reason: "invalid_patch" }`).
 */

import type { GameplayLogEntry, Room, RuntimePatch, RuntimePatchOperation } from "@rift/protocol";

/** Zones that hold arrays of cards (`965166.g`). */
const CARD_ZONES: ReadonlySet<string> = new Set([
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
]);

export interface RuntimePatchState {
  room: Room;
  sequence: number;
  gameplayLogEntries: GameplayLogEntry[];
  actionClock?: unknown;
}

/** deep clone with structuredClone fallback (`w`). */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function unset(target: Record<string, unknown>, key: string): void {
  delete target[key];
}

interface MutationContext {
  state: RuntimePatchState & { room: Room; session?: Record<string, unknown> };
  baseState: RuntimePatchState & { room: Room; session?: Record<string, unknown> };
  mutablePlayerIds: Set<string>;
  mutableBoardPlayerIds: Set<string>;
  mutableZonesByPlayerId: Map<string, Set<string>>;
  mutableCards: WeakSet<object>;
}

function roomOf(ctx: MutationContext): Record<string, unknown> {
  const state = ctx.state as unknown as Record<string, unknown>;
  const base = ctx.baseState as unknown as Record<string, unknown>;
  if (state.room === base.room) state.room = { ...(state.room as object) };
  return state.room as Record<string, unknown>;
}

function sessionOf(ctx: MutationContext): Record<string, unknown> {
  const state = ctx.state as unknown as Record<string, unknown>;
  const base = ctx.baseState as unknown as Record<string, unknown>;
  if (!state.session || state.session === base.session)
    state.session = { ...(state.session as object) };
  return state.session as Record<string, unknown>;
}

function resetMutations(ctx: MutationContext): void {
  ctx.mutablePlayerIds.clear();
  ctx.mutableBoardPlayerIds.clear();
  ctx.mutableZonesByPlayerId.clear();
}

function resetBoardMutations(ctx: MutationContext, playerId: string): void {
  ctx.mutableBoardPlayerIds.delete(playerId);
  ctx.mutableZonesByPlayerId.delete(playerId);
}

function mutablePlayer(ctx: MutationContext, playerId: string): Record<string, unknown> {
  const room = roomOf(ctx);
  const players = room.players as Array<Record<string, unknown>>;
  const index = players.findIndex((player) => player.id === playerId);
  if (index < 0) throw new Error(`Cannot apply runtime patch for unknown player ${playerId}.`);
  const player = players[index];
  if (!player) throw new Error(`Cannot patch missing runtime player ${playerId}.`);
  if (ctx.mutablePlayerIds.has(playerId)) return player;
  const baseRoom = ctx.baseState.room as unknown as { players: unknown[] };
  if (players === baseRoom.players) room.players = players.slice();
  const copy = { ...player };
  (room.players as Array<Record<string, unknown>>)[index] = copy;
  ctx.mutablePlayerIds.add(playerId);
  return copy;
}

function mutableBoard(ctx: MutationContext, playerId: string): Record<string, unknown> {
  const player = mutablePlayer(ctx, playerId);
  const board = player.board as Record<string, unknown> | undefined;
  if (!board) throw new Error(`Cannot apply runtime patch without board for ${playerId}.`);
  if (ctx.mutableBoardPlayerIds.has(playerId)) return board;
  const copy = { ...board };
  player.board = copy;
  ctx.mutableBoardPlayerIds.add(playerId);
  return copy;
}

function mutableZone(
  ctx: MutationContext,
  playerId: string,
  board: Record<string, unknown>,
  zone: string,
): Array<Record<string, unknown>> {
  let zones = ctx.mutableZonesByPlayerId.get(playerId);
  if (!zones) {
    zones = new Set();
    ctx.mutableZonesByPlayerId.set(playerId, zones);
  }
  const current = board[zone] as Array<Record<string, unknown>> | undefined;
  if (zones.has(zone)) {
    if (current) return current;
    const created: Array<Record<string, unknown>> = [];
    board[zone] = created;
    return created;
  }
  zones.add(zone);
  if (current) {
    const copy = current.slice();
    board[zone] = copy;
    return copy;
  }
  const created: Array<Record<string, unknown>> = [];
  board[zone] = created;
  return created;
}

function removeCard(
  ctx: MutationContext,
  playerId: string,
  board: Record<string, unknown>,
  zone: string,
  cardId: string,
): Record<string, unknown> {
  const cards = mutableZone(ctx, playerId, board, zone);
  const index = cards.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error(`Cannot remove missing runtime card ${cardId}.`);
  const [removed] = cards.splice(index, 1);
  if (!removed) throw new Error(`Cannot remove missing runtime card ${cardId}.`);
  return removed;
}

function insertCards(
  ctx: MutationContext,
  playerId: string,
  board: Record<string, unknown>,
  zone: string,
  index: number,
  cards: Array<Record<string, unknown>>,
): void {
  const target = mutableZone(ctx, playerId, board, zone);
  if (index < 0 || index > target.length) {
    throw new Error(`Cannot insert runtime cards at index ${index}.`);
  }
  target.splice(index, 0, ...cards);
}

function mutableCard(
  ctx: MutationContext,
  playerId: string,
  board: Record<string, unknown>,
  zone: string,
  cardId: string,
): Record<string, unknown> {
  const source = (board[zone] as Array<Record<string, unknown>> | undefined) ?? [];
  const index = source.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error(`Cannot patch missing runtime card ${cardId}.`);
  const cards = mutableZone(ctx, playerId, board, zone);
  const card = cards[index];
  if (!card) throw new Error(`Cannot patch missing runtime card ${cardId}.`);
  if (ctx.mutableCards.has(card)) return card;
  const copy = { ...card };
  cards[index] = copy;
  ctx.mutableCards.add(copy);
  return copy;
}

function applyOperation(ctx: MutationContext, op: RuntimePatchOperation): void {
  const { state } = ctx;
  switch (op.op) {
    case "set_room_fields":
      for (const [key, value] of Object.entries(op.fields)) {
        const room = roomOf(ctx);
        room[key] = cloneValue(value);
        if (key === "players") resetMutations(ctx);
      }
      return;
    case "unset_room_fields":
      for (const key of op.fields) {
        unset(roomOf(ctx), key);
        if (key === "players") resetMutations(ctx);
      }
      return;
    case "chain_insert": {
      const room = roomOf(ctx);
      const baseChain = (ctx.baseState.room as unknown as { chainEntries: unknown[] }).chainEntries;
      if (room.chainEntries === baseChain)
        room.chainEntries = (room.chainEntries as unknown[]).slice();
      (room.chainEntries as unknown[]).splice(
        op.index,
        0,
        ...(cloneValue(op.entries) as unknown[]),
      );
      return;
    }
    case "chain_remove": {
      const ids = new Set(op.entryIds);
      const room = roomOf(ctx);
      room.chainEntries = (
        state.room as unknown as { chainEntries: Array<{ id: string }> }
      ).chainEntries.filter((entry) => !ids.has(entry.id));
      return;
    }
    case "chain_replace":
      roomOf(ctx).chainEntries = cloneValue(op.entries);
      return;
    case "set_session_fields":
      sessionOf(ctx);
      for (const [key, value] of Object.entries(op.fields)) {
        sessionOf(ctx)[key] = cloneValue(value);
      }
      return;
    case "unset_session_fields":
      if (!(state as unknown as { session?: unknown }).session) return;
      for (const key of op.fields) unset(sessionOf(ctx), key);
      return;
    case "set_player_fields": {
      const player = mutablePlayer(ctx, op.playerId);
      for (const [key, value] of Object.entries(op.fields)) {
        player[key] = cloneValue(value);
        if (key === "board") resetBoardMutations(ctx, op.playerId);
      }
      return;
    }
    case "unset_player_fields": {
      const player = mutablePlayer(ctx, op.playerId);
      for (const key of op.fields) {
        unset(player, key);
        if (key === "board") resetBoardMutations(ctx, op.playerId);
      }
      return;
    }
    case "set_board_fields": {
      const board = mutableBoard(ctx, op.playerId);
      for (const [key, value] of Object.entries(op.fields)) {
        board[key] = cloneValue(value);
        if (CARD_ZONES.has(key)) {
          const zones = ctx.mutableZonesByPlayerId.get(op.playerId) ?? new Set<string>();
          zones.add(key);
          ctx.mutableZonesByPlayerId.set(op.playerId, zones);
        }
      }
      return;
    }
    case "unset_board_fields": {
      const board = mutableBoard(ctx, op.playerId);
      for (const key of op.fields) {
        unset(board, key);
        if (CARD_ZONES.has(key)) {
          const zones = ctx.mutableZonesByPlayerId.get(op.playerId) ?? new Set<string>();
          zones.add(key);
          ctx.mutableZonesByPlayerId.set(op.playerId, zones);
        }
      }
      return;
    }
    case "zone_insert": {
      const board = mutableBoard(ctx, op.playerId);
      insertCards(
        ctx,
        op.playerId,
        board,
        op.zone,
        op.index,
        cloneValue(op.cards) as Array<Record<string, unknown>>,
      );
      return;
    }
    case "zone_remove": {
      const board = mutableBoard(ctx, op.playerId);
      for (const cardId of op.cardIds) removeCard(ctx, op.playerId, board, op.zone, cardId);
      return;
    }
    case "zone_move": {
      const fromBoard = mutableBoard(ctx, op.from.playerId);
      const moved = removeCard(ctx, op.from.playerId, fromBoard, op.from.zone, op.cardId);
      const toBoard = mutableBoard(ctx, op.to.playerId);
      insertCards(ctx, op.to.playerId, toBoard, op.to.zone, op.to.index, [
        op.card ? (cloneValue(op.card) as Record<string, unknown>) : moved,
      ]);
      return;
    }
    case "zone_reorder": {
      const board = mutableBoard(ctx, op.playerId);
      const cards = mutableZone(ctx, op.playerId, board, op.zone);
      if (cards.length !== op.cardIds.length) {
        throw new Error("Cannot reorder runtime zone with different card count.");
      }
      const byId = new Map(cards.map((card) => [card.id as string, card]));
      board[op.zone] = op.cardIds.map((cardId) => {
        const card = byId.get(cardId);
        if (!card) throw new Error(`Cannot reorder missing or repeated runtime card ${cardId}.`);
        byId.delete(cardId);
        return card;
      });
      return;
    }
    case "zone_replace": {
      mutableBoard(ctx, op.playerId)[op.zone] = cloneValue(op.cards);
      const zones = ctx.mutableZonesByPlayerId.get(op.playerId) ?? new Set<string>();
      zones.add(op.zone);
      ctx.mutableZonesByPlayerId.set(op.playerId, zones);
      return;
    }
    case "patch_card_fields": {
      const board = mutableBoard(ctx, op.playerId);
      const card = mutableCard(ctx, op.playerId, board, op.zone, op.cardId);
      for (const [key, value] of Object.entries(op.fields)) card[key] = cloneValue(value);
      return;
    }
    case "unset_card_fields": {
      const board = mutableBoard(ctx, op.playerId);
      const card = mutableCard(ctx, op.playerId, board, op.zone, op.cardId);
      for (const key of op.fields) unset(card, key);
      return;
    }
    case "log_insert": {
      const stateRecord = state as unknown as { gameplayLogEntries: GameplayLogEntry[] };
      const baseLog = (ctx.baseState as unknown as { gameplayLogEntries: GameplayLogEntry[] })
        .gameplayLogEntries;
      if (stateRecord.gameplayLogEntries === baseLog) {
        stateRecord.gameplayLogEntries = stateRecord.gameplayLogEntries.slice();
      }
      stateRecord.gameplayLogEntries.splice(
        op.index,
        0,
        ...(cloneValue(op.entries) as GameplayLogEntry[]),
      );
      return;
    }
    case "log_remove": {
      const ids = new Set(op.entryIds);
      const stateRecord = state as unknown as { gameplayLogEntries: GameplayLogEntry[] };
      stateRecord.gameplayLogEntries = stateRecord.gameplayLogEntries.filter(
        (entry) => !ids.has(entry.id),
      );
      return;
    }
    case "log_replace":
      (state as unknown as { gameplayLogEntries: GameplayLogEntry[] }).gameplayLogEntries =
        cloneValue(op.entries);
      return;
    case "set_action_clock":
      (state as unknown as { actionClock?: unknown }).actionClock = cloneValue(op.actionClock);
      return;
    case "clear_action_clock":
      delete (state as unknown as { actionClock?: unknown }).actionClock;
      return;
    default:
      throw new Error(`Unknown runtime patch operation ${String(op)}.`);
  }
}

/**
 * Apply a runtime patch. Returns the next `{room, sequence, gameplayLogEntries, actionClock}`.
 * Throws on malformed ops (caller → `invalid_patch` resync).
 */
export function applyRuntimePatch(
  state: RuntimePatchState,
  patch: RuntimePatch,
): RuntimePatchState {
  if (!patch || typeof patch !== "object" || !Array.isArray(patch.operations)) {
    throw new Error("Runtime patch payload is invalid.");
  }
  if (patch.operations.length === 0) return state;
  const next: RuntimePatchState = { ...state };
  const ctx: MutationContext = {
    state: next as MutationContext["state"],
    baseState: state as MutationContext["baseState"],
    mutablePlayerIds: new Set(),
    mutableBoardPlayerIds: new Set(),
    mutableZonesByPlayerId: new Map(),
    mutableCards: new WeakSet(),
  };
  for (const op of patch.operations) applyOperation(ctx, op);
  return next;
}

/* ------------------------------------------------------------------ rune conservation (618260) */

function runePoolSize(board: { runeDeck: unknown[]; runeArea: unknown[] }): number {
  return board.runeDeck.length + board.runeArea.length;
}

function compareRunePools(
  previous: Room,
  next: Room,
  compareBoard: (
    a: Room["players"][number]["board"],
    b: Room["players"][number]["board"],
  ) => boolean,
): boolean {
  if (previous.players.length !== next.players.length) return false;
  for (const player of previous.players) {
    const other = next.players.find((candidate) => candidate.id === player.id);
    if (!other) return false;
    if (Boolean(player.board) !== Boolean(other.board)) return false;
    if (player.board && other.board && !compareBoard(player.board, other.board)) return false;
  }
  return true;
}

/** `618260.u` — rune pool *sizes* unchanged for every player. */
export function runeCountsPreserved(previous: Room, next: Room): boolean {
  return compareRunePools(previous, next, (a, b) =>
    a && b ? runePoolSize(a) === runePoolSize(b) : true,
  );
}

/** `618260.M` — rune pool *multisets* (ids) unchanged for every player. */
export function runeMultisetsPreserved(previous: Room, next: Room): boolean {
  return compareRunePools(previous, next, (a, b) => {
    if (!a || !b) return true;
    if (a.runeDeck === b.runeDeck && a.runeArea === b.runeArea) return true;
    if (runePoolSize(a) !== runePoolSize(b)) return false;
    const counts = new Map<string, number>();
    for (const card of [...a.runeDeck, ...a.runeArea]) {
      counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
    }
    for (const card of [...b.runeDeck, ...b.runeArea]) {
      const count = counts.get(card.id) ?? 0;
      if (count === 0) return false;
      counts.set(card.id, count - 1);
    }
    return true;
  });
}

/** `618260.w` — user-facing message for a rejected rune-count-changing patch. */
export const RUNE_COUNT_CHANGED_MESSAGE =
  "That action would add or remove runes from a rune pool, so it was not applied.";

/** `618260.N` — per-player rune pool sizes (diagnostics). */
export function runePoolCounts(room: Room): Record<string, number | null> {
  return Object.fromEntries(
    room.players.map((player) => [player.id, player.board ? runePoolSize(player.board) : null]),
  );
}

/* ------------------------------------------------------------------ reset token */

export interface AuthoritativeReset {
  gameInstanceId: string;
  kind: "snapshot" | "rewind" | "forward";
  sequence: number;
  token: string;
}

/** `B()` — reset token + kind from the causing action. */
export function resetToken(input: {
  action?: { type: string; [key: string]: unknown } | undefined;
  gameInstanceId: string;
  sequence: number;
  token: string;
}): AuthoritativeReset {
  const kind = isHistoryNavigationAction(input.action) ?? "snapshot";
  return {
    gameInstanceId: input.gameInstanceId,
    kind,
    sequence: input.sequence,
    token: input.token,
  };
}

/** `N()` — rewind/forward classification of the snapshot-causing action. */
export function isHistoryNavigationAction(action?: {
  type: string;
  response?: unknown;
}): "rewind" | "forward" | null {
  if (!action) return null;
  if (action.type === "rewind_last_action") return "rewind";
  if (action.type === "forward_last_rewind") return "forward";
  // `c5`: an approver accepting `respond_rewind_confirmation` performs a rewind.
  if (action.type === "respond_rewind_confirmation" && action.response === "approve")
    return "rewind";
  return null;
}

/** `x()` — clamp a cooldown: `now + remainingMs` when both are valid. */
export function cooldownUntil(remainingMs: unknown, now: number): number | null {
  return typeof remainingMs !== "number" ||
    !Number.isSafeInteger(remainingMs) ||
    remainingMs <= 0 ||
    !Number.isSafeInteger(now) ||
    now < 0
    ? null
    : Math.min(Number.MAX_SAFE_INTEGER, now + remainingMs);
}
