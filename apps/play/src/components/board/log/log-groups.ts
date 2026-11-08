import type { GameplayLogEntry } from "@rift/protocol";

export type LogGroup =
  | {
      kind: "turn";
      turnNumber: number | null;
      turnPlayerId: string;
      entries: GameplayLogEntry[];
    }
  | { kind: "activity"; entries: GameplayLogEntry[] };

export interface GroupLogEntriesInput {
  entries: readonly GameplayLogEntry[];
  currentTurnNumber?: number | null;
  currentTurnPlayerId?: string | null;
}

function explicitTurn(
  entry: GameplayLogEntry,
): { turnNumber: number; turnPlayerId: string } | null {
  if (
    typeof entry.turnNumber !== "number" ||
    !Number.isInteger(entry.turnNumber) ||
    entry.turnNumber < 1 ||
    typeof entry.turnPlayerId !== "string" ||
    entry.turnPlayerId.length === 0
  ) {
    return null;
  }
  return { turnNumber: entry.turnNumber, turnPlayerId: entry.turnPlayerId };
}

function pushEntry(
  groups: LogGroup[],
  entry: GameplayLogEntry,
  turn: { turnNumber: number | null; turnPlayerId: string } | null,
): void {
  const last = groups.at(-1);
  const sameTurn =
    turn !== null &&
    last?.kind === "turn" &&
    last.turnNumber === turn.turnNumber &&
    last.turnPlayerId === turn.turnPlayerId;
  if (sameTurn || (turn === null && last?.kind === "activity")) {
    last!.entries.push(entry);
    return;
  }
  groups.push(
    turn
      ? {
          kind: "turn",
          turnNumber: turn.turnNumber,
          turnPlayerId: turn.turnPlayerId,
          entries: [entry],
        }
      : { kind: "activity", entries: [entry] },
  );
}

/** The original renders at most 40 entries at a time (`ii`, 0xawjzm3yjpr1.js:11662). */
export const MATCH_LOG_PAGE_SIZE = 40;

/**
 * The original room log is newest-first: the sidebar renders `room.log` directly, so the
 * latest action sits at the top of the list and older turns follow below
 * (`51-board-with-log.png`, `50-board-rewind-overlay.png`, rewind video frame 05).
 * Our engine stores entries chronologically, so the panel flips groups + rows for display.
 */
export function orderLogGroupsForDisplay(groups: readonly LogGroup[]): LogGroup[] {
  return [...groups]
    .reverse()
    .map((group) => ({ ...group, entries: [...group.entries].reverse() }));
}

/**
 * Keep only the newest `limit` entries (the original's progressive reveal) while preserving
 * group headers. Returns the visible groups and how many entries remain hidden below.
 */
export function sliceLogGroups(
  groups: readonly LogGroup[],
  limit: number,
): { groups: LogGroup[]; remaining: number } {
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  const budget = Math.max(0, Math.min(Math.trunc(limit), total));
  if (budget >= total) return { groups: [...groups], remaining: 0 };
  let left = budget;
  const visible: LogGroup[] = [];
  for (const group of groups) {
    if (left <= 0) break;
    if (group.entries.length <= left) {
      visible.push(group);
      left -= group.entries.length;
      continue;
    }
    visible.push({ ...group, entries: group.entries.slice(0, left) });
    left = 0;
  }
  return { groups: visible, remaining: total - budget };
}

/**
 * The original log grouping (`ii`/`ir` in 0xawjzm3yjpr1.js).
 *
 * Entries without turn metadata inherit the last known turn; before the game starts
 * (no `mulligans are complete` / `auto-started test setup` marker yet) an
 * `ended their turn.` line rewinds the inherited turn by one and switches the player.
 */
export function groupLogEntries({
  entries,
  currentTurnNumber = null,
  currentTurnPlayerId = null,
}: GroupLogEntriesInput): LogGroup[] {
  const groups: LogGroup[] = [];
  let turnNumber =
    typeof currentTurnNumber === "number" &&
    Number.isInteger(currentTurnNumber) &&
    currentTurnNumber > 0
      ? currentTurnNumber
      : null;
  let turnPlayerId = currentTurnPlayerId || null;
  let started = false;

  for (const entry of entries) {
    const explicit = explicitTurn(entry);
    if (explicit) {
      turnNumber = explicit.turnNumber;
      turnPlayerId = explicit.turnPlayerId;
      pushEntry(groups, entry, explicit);
      continue;
    }

    if (
      entry.text.endsWith("mulligans are complete. Starting the game.") ||
      entry.text.endsWith(" auto-started test setup.")
    ) {
      started = true;
      turnPlayerId = null;
    }
    if (!started && entry.authorPlayerId && entry.text.endsWith(" ended their turn.")) {
      turnNumber = turnNumber === null ? null : Math.max(1, turnNumber - 1);
      turnPlayerId = entry.authorPlayerId;
    }
    pushEntry(groups, entry, !started && turnPlayerId ? { turnNumber, turnPlayerId } : null);
  }
  return groups;
}
