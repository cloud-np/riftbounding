/**
 * Runtime state diff — produce `RuntimePatch` operations that the original client applies to turn
 * `prev` into `next`.
 *
 * There is no diff generator in the client (the original server produced the patches); this module
 * fills that gap. Output only uses operations understood by `applyRuntimePatch` and respects the
 * client's structural requirements (zone index bounds, equal-length reorders, id uniqueness).
 */

import type {
  GameplayLogEntry,
  PlayerBoard,
  RawActionClock,
  Room,
  RuntimePatch,
  RuntimePatchOperation,
} from "@rift/protocol";
import { BOARD_ZONES, type RuntimePatchState } from "./patch";
import { redactRuntimeStateForViewer, type SnapshotViewer } from "./redact";

export interface DiffInput {
  room: Room;
  gameplayLogEntries?: GameplayLogEntry[];
  actionClock?: RawActionClock;
  session?: Record<string, unknown>;
}

const ZONE_SET: ReadonlySet<string> = new Set(BOARD_ZONES);

function wire<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural equality over JSON-shaped values. `undefined` object values are treated as absent. */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === undefined || right === undefined) return left === right;
  if (typeof left !== typeof right) return false;
  if (typeof left !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] === undefined && b[key] === undefined) continue;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

interface FieldDiff {
  fields: Record<string, unknown>;
  unset: string[];
}

function diffFields(
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
  skip: ReadonlySet<string> = new Set(),
): FieldDiff {
  const fields: Record<string, unknown> = {};
  const unset: string[] = [];
  const previousRecord = previous ?? {};
  const nextRecord = next ?? {};
  const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
  for (const key of keys) {
    if (skip.has(key)) continue;
    const before = previousRecord[key];
    const after = nextRecord[key];
    if (after === undefined) {
      if (before !== undefined) unset.push(key);
      continue;
    }
    if (!deepEqual(before, after)) fields[key] = wire(after);
  }
  return { fields, unset };
}

function pushFieldOps(
  operations: RuntimePatchOperation[],
  kind: "room" | "session" | "player" | "board",
  diff: FieldDiff,
  extra: { playerId?: string } = {},
): void {
  if (Object.keys(diff.fields).length > 0) {
    switch (kind) {
      case "room":
        operations.push({ op: "set_room_fields", fields: diff.fields });
        break;
      case "session":
        operations.push({ op: "set_session_fields", fields: diff.fields });
        break;
      case "player":
        operations.push({
          op: "set_player_fields",
          playerId: extra.playerId!,
          fields: diff.fields,
        });
        break;
      case "board":
        operations.push({ op: "set_board_fields", playerId: extra.playerId!, fields: diff.fields });
        break;
    }
  }
  if (diff.unset.length > 0) {
    switch (kind) {
      case "room":
        operations.push({ op: "unset_room_fields", fields: diff.unset });
        break;
      case "session":
        operations.push({ op: "unset_session_fields", fields: diff.unset });
        break;
      case "player":
        operations.push({
          op: "unset_player_fields",
          playerId: extra.playerId!,
          fields: diff.unset,
        });
        break;
      case "board":
        operations.push({
          op: "unset_board_fields",
          playerId: extra.playerId!,
          fields: diff.unset,
        });
        break;
    }
  }
}

function countById(cards: unknown[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const id = (card as { id?: unknown } | null)?.id;
    if (typeof id !== "string") continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function cardId(card: unknown): string | undefined {
  const id = (card as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : undefined;
}

function diffZone(
  operations: RuntimePatchOperation[],
  playerId: string,
  zone: string,
  previousCards: unknown[],
  nextCards: unknown[],
): void {
  if (deepEqual(previousCards, nextCards)) return;
  const previousIds = previousCards.map(cardId);
  const nextIds = nextCards.map(cardId);
  const previousValid = previousIds.every((id): id is string => typeof id === "string");
  const nextValid = nextIds.every((id): id is string => typeof id === "string");
  const duplicateIds =
    new Set(previousIds).size !== previousIds.length || new Set(nextIds).size !== nextIds.length;
  if (!previousValid || !nextValid || duplicateIds) {
    operations.push({ op: "zone_replace", playerId, zone, cards: wire(nextCards) });
    return;
  }

  const nextIdSet = new Set(nextIds as string[]);
  const removed = [...new Set((previousIds as string[]).filter((id) => !nextIdSet.has(id)))];
  if (removed.length > 0) {
    operations.push({ op: "zone_remove", playerId, zone, cardIds: removed });
  }
  const removedSet = new Set(removed);
  const remaining = previousCards.filter((card) => {
    const id = cardId(card);
    return id !== undefined && !removedSet.has(id);
  });
  const remainingIds = new Set(remaining.map((card) => cardId(card) as string));

  const missing: unknown[] = [];
  for (const card of nextCards) {
    const id = cardId(card);
    if (id !== undefined && !remainingIds.has(id)) missing.push(card);
  }
  if (missing.length > 0) {
    operations.push({
      op: "zone_insert",
      playerId,
      zone,
      index: remaining.length,
      cards: wire(missing),
    });
  }

  const previousById = new Map<string, unknown>();
  for (const card of previousCards) {
    const id = cardId(card);
    if (id !== undefined && !removedSet.has(id)) previousById.set(id, card);
  }
  for (const card of nextCards) {
    const id = cardId(card);
    if (id === undefined) continue;
    const before = previousById.get(id);
    if (before === undefined) continue;
    const diff = diffFields(before as Record<string, unknown>, card as Record<string, unknown>);
    if (Object.keys(diff.fields).length > 0) {
      operations.push({
        op: "patch_card_fields",
        playerId,
        zone,
        cardId: id,
        fields: diff.fields,
      });
    }
    if (diff.unset.length > 0) {
      operations.push({
        op: "unset_card_fields",
        playerId,
        zone,
        cardId: id,
        fields: diff.unset,
      });
    }
  }

  const currentIds = [
    ...remaining.map((card) => cardId(card) as string),
    ...missing.map((card) => cardId(card) as string),
  ];
  if (
    currentIds.length === nextIds.length &&
    currentIds.some((id, index) => id !== nextIds[index])
  ) {
    operations.push({ op: "zone_reorder", playerId, zone, cardIds: nextIds as string[] });
  }
}

function diffBoard(
  operations: RuntimePatchOperation[],
  playerId: string,
  previous: PlayerBoard,
  next: PlayerBoard,
): void {
  const skip = new Set(BOARD_ZONES);
  pushFieldOps(
    operations,
    "board",
    diffFields(
      previous as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
      skip,
    ),
    { playerId },
  );

  for (const zone of BOARD_ZONES) {
    const before = (previous as unknown as Record<string, unknown>)[zone];
    const after = (next as unknown as Record<string, unknown>)[zone];
    if (before === undefined && after === undefined) continue;
    if (before === undefined || after === undefined) {
      if (before === undefined && after !== undefined) {
        operations.push({
          op: "zone_replace",
          playerId,
          zone,
          cards: wire(Array.isArray(after) ? after : []),
        });
      } else {
        operations.push({ op: "unset_board_fields", playerId, fields: [zone] });
      }
      continue;
    }
    const beforeCards = Array.isArray(before) ? before : [];
    const afterCards = Array.isArray(after) ? after : [];
    diffZone(operations, playerId, zone, beforeCards, afterCards);
  }
}

function idsOfPlayers(players: Room["players"]): string[] {
  return players.map((player) => player.id);
}

function diffPlayers(
  operations: RuntimePatchOperation[],
  previous: Room["players"],
  next: Room["players"],
): boolean {
  const previousIds = idsOfPlayers(previous);
  const nextIds = idsOfPlayers(next);
  if (
    previousIds.length !== nextIds.length ||
    previousIds.some((id, index) => id !== nextIds[index])
  ) {
    return false;
  }
  for (let index = 0; index < next.length; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (!before || !after) continue;
    pushFieldOps(
      operations,
      "player",
      diffFields(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        new Set(["board"]),
      ),
      { playerId: after.id },
    );
    if (!before.board && after.board) {
      operations.push({
        op: "set_player_fields",
        playerId: after.id,
        fields: { board: wire(after.board) },
      });
    } else if (before.board && !after.board) {
      operations.push({ op: "unset_player_fields", playerId: after.id, fields: ["board"] });
    } else if (before.board && after.board) {
      diffBoard(operations, after.id, before.board, after.board);
    }
  }
  return true;
}

function diffLogs(
  operations: RuntimePatchOperation[],
  previous: GameplayLogEntry[],
  next: GameplayLogEntry[],
): void {
  if (deepEqual(previous, next)) return;
  let prefix = 0;
  while (
    prefix < previous.length &&
    prefix < next.length &&
    deepEqual(previous[prefix], next[prefix])
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    deepEqual(previous[previous.length - 1 - suffix], next[next.length - 1 - suffix])
  ) {
    suffix += 1;
  }
  const removed = previous.slice(prefix, previous.length - suffix);
  const inserted = next.slice(prefix, next.length - suffix);
  if (removed.length === 0 && inserted.length > 0) {
    operations.push({ op: "log_insert", index: prefix, entries: wire(inserted) });
    return;
  }
  if (inserted.length === 0 && removed.length > 0) {
    const ids = removed.map((entry) => entry.id);
    if (new Set(ids).size === ids.length) {
      operations.push({ op: "log_remove", entryIds: ids });
      return;
    }
  }
  operations.push({ op: "log_replace", entries: wire(next) });
}

/**
 * Diff a full runtime state. `sequence` is intentionally not part of the patch (`sequence` travels
 * on the `authoritative_patch_commit` envelope).
 */
export function diffRuntimeState(previous: DiffInput, next: DiffInput): RuntimePatch {
  const operations: RuntimePatchOperation[] = [];
  const roomFields = diffFields(
    previous.room as unknown as Record<string, unknown>,
    next.room as unknown as Record<string, unknown>,
    new Set(["players", "chainEntries"]),
  );
  pushFieldOps(operations, "room", roomFields);

  if (!deepEqual(previous.room.chainEntries, next.room.chainEntries)) {
    operations.push({ op: "chain_replace", entries: wire(next.room.chainEntries) });
  }

  if (!diffPlayers(operations, previous.room.players, next.room.players)) {
    operations.push({
      op: "set_room_fields",
      fields: { players: wire(next.room.players) },
    });
  }

  const previousLog = previous.gameplayLogEntries ?? [];
  const nextLog = next.gameplayLogEntries ?? [];
  diffLogs(operations, previousLog, nextLog);

  if (!deepEqual(previous.actionClock, next.actionClock)) {
    if (next.actionClock === undefined) {
      operations.push({ op: "clear_action_clock" });
    } else {
      operations.push({ op: "set_action_clock", actionClock: wire(next.actionClock) });
    }
  }

  if (previous.session !== undefined || next.session !== undefined) {
    pushFieldOps(operations, "session", diffFields(previous.session, next.session));
  }

  return { operations };
}

/**
 * Redaction-safe diff for one viewer: both sides are redacted with `redactRuntimeStateForViewer`
 * *before* diffing, so a patch can never carry a field (or a `Room.rules` value) that this
 * viewer's snapshot hides (128.4 / 107.3.f). Never diff authoritative rooms directly for clients.
 */
export function diffRuntimeStateForViewer(
  previous: DiffInput,
  next: DiffInput,
  viewer: SnapshotViewer,
): RuntimePatch {
  const redact = (input: DiffInput): DiffInput => ({
    ...redactRuntimeStateForViewer(
      {
        room: input.room,
        gameplayLogEntries: input.gameplayLogEntries ?? [],
        ...(input.actionClock ? { actionClock: input.actionClock } : {}),
      },
      viewer,
    ),
    ...(input.session !== undefined ? { session: input.session } : {}),
  });
  return diffRuntimeState(redact(previous), redact(next));
}

/** Alias used by callers that keep the full runtime state. */
export const diff = diffRuntimeState;

/** Diff two rooms only (no gameplay-log / clock / session channels). */
export function diffRoom(previous: Room, next: Room): RuntimePatch {
  return diffRuntimeState(
    { room: previous, gameplayLogEntries: [] },
    { room: next, gameplayLogEntries: [] },
  );
}

/** Diff two states that already are `RuntimePatchState` shaped. */
export function diffPatchedState(
  previous: RuntimePatchState,
  next: RuntimePatchState,
): RuntimePatch {
  return diffRuntimeState(previous, next);
}
