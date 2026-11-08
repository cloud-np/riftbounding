/**
 * Structured game-log entry builders.
 *
 * The wire shape stays exactly `{id, at, text, authorPlayerId?, turnNumber?, turnPlayerId?,
 * actionKind?}` (protocol `GameplayLogEntry`); `key`/`params` are additive so @rift/i18n can
 * render the same entry without re-parsing English. `text` remains the canonical English
 * sentence emitted by the original server.
 */
import type { GameplayLogEntry, Room } from "@rift/protocol";
import type { LogDraft } from "../types";
import { makeLogId } from "../state/ids";
import { actionKindFor, renderSentence } from "./templates";

export interface GameLogEntry extends GameplayLogEntry {
  key?: string;
  params?: Record<string, string | number | null | undefined>;
}

const MAX_LOG_ENTRIES = 2000;

export function buildLogEntry(
  room: Room,
  draft: LogDraft,
  index: number,
): GameLogEntry {
  const at = draft.at ?? room.updatedAt;
  return {
    id: makeLogId(at, index, 0),
    at,
    text: draft.text || renderSentence(draft.key, draft.params),
    ...(draft.authorPlayerId ? { authorPlayerId: draft.authorPlayerId } : {}),
    turnNumber: draft.turnNumber ?? room.turnNumber,
    turnPlayerId: draft.turnPlayerId ?? room.activeTurnPlayerId,
    ...(draft.actionKind ? { actionKind: draft.actionKind } : {}),
    key: draft.key,
    ...(draft.params ? { params: draft.params } : {}),
  };
}

export function appendLog(room: Room, drafts: LogDraft[]): void {
  if (drafts.length === 0) return;
  const base = room.log.length;
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (!draft) continue;
    room.log.push(buildLogEntry(room, draft, base + i));
  }
  if (room.log.length > MAX_LOG_ENTRIES) room.log.splice(0, room.log.length - MAX_LOG_ENTRIES);
}

/** Sentence builder used by handlers. */
export function logDraft(
  key: string,
  params?: LogDraft["params"],
  extra?: Partial<Omit<LogDraft, "key" | "params" | "text">>,
): LogDraft {
  return {
    key,
    params,
    text: renderSentence(key, params),
    ...extra,
  };
}

/** Convenience for a handler's `context.log` callback (adds the action kind). */
export function actionLog(
  actionType: string,
  key: string,
  params?: LogDraft["params"],
  authorPlayerId?: string,
): LogDraft {
  return logDraft(key, params, {
    ...(authorPlayerId ? { authorPlayerId } : {}),
    actionKind: actionKindFor(actionType),
  });
}
