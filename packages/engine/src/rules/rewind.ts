/**
 * Rewind / forward timeline (protocol v5).
 *
 * The original server owns the timeline and sends `authoritative_snapshot` +
 * `rewind_confirmation_state`; the client only classifies actions (`c9`, module 69535).
 *
 * This module keeps exactly the same information in an explicit, JSON-serializable
 * `EngineTimeline` value: `applyGameAction` accepts it on `ActionContext.timeline` and returns
 * the updated value on success. Durable Objects persist it next to the room; it is never placed
 * on the projected `Room` and therefore can never leak through snapshot redaction/diffing.
 */
import type { EngineTimeline, EngineTimelineEntry, RewindConfirmation, Room } from "@rift/protocol";
import { deepClone } from "../state/board";
import { logDraft } from "../log/entries";

export const REWIND_PROTOCOL_VERSION = 5 as const;
export const FORWARD_WINDOW_MS = 300_000; // 5 minutes
export const REWIND_REQUEST_TTL_MS = 30_000;
/**
 * Safety bound for the persisted timeline. The original server keeps a full-game history; a
 * Durable Object must stay well inside its 10 GB / 2 MB-per-key storage budget, so the oldest
 * meaningful actions are dropped once this many recent targets are held. 4096 covers a very long
 * game while every entry can still live in its own (chunked) storage key.
 */
export const MAX_REWIND_ENTRIES = 4096;
/**
 * Strict rooms keep much heavier snapshots (`Room.rules` carries the chain, prompts, effects and
 * per-turn records), so their history uses a smaller bound. 256 meaningful actions still covers
 * a long practice game while keeping the in-memory/DO timeline bounded (sandbox keeps 4096).
 */
export const MAX_STRICT_REWIND_ENTRIES = 256;

/** Strict rewind is allowed in solo lab and Practice-vs-Bot rooms, never human-vs-human. */
export function rewindAllowedForRoom(
  room: Pick<Room, "rulesMode" | "roomMode" | "players">,
  mode?: string,
): boolean {
  if (room.rulesMode !== "strict") return true;
  if (mode === "solo_lab" || room.roomMode === "solo_lab") return true;
  return room.players.some((player) => player.isBot === true && !player.leftAt);
}

/** Fresh timeline for a new game. */
export function createInitialTimeline(): EngineTimeline {
  return { version: 1, entries: [], cursor: 0, nextSeq: 0 };
}

/** Shallow structural copy (entries and snapshots are treated as immutable). */
export function copyTimeline(timeline: EngineTimeline): EngineTimeline {
  return {
    version: 1,
    entries: [...timeline.entries],
    cursor: timeline.cursor,
    ...(timeline.nextSeq !== undefined ? { nextSeq: timeline.nextSeq } : {}),
    ...(timeline.pending ? { pending: { ...timeline.pending } } : {}),
    ...(timeline.forward ? { forward: { ...timeline.forward } } : {}),
  };
}

/** Record a successful transition; returns the updated timeline (does not mutate the input). */
export function recordHistory(
  previous: Room,
  actorId: string,
  actionType: string,
  meaningful: boolean,
  now: number,
  timeline: EngineTimeline,
  action?: Record<string, unknown>,
  maxEntries = MAX_REWIND_ENTRIES,
  recordIncidental = false,
): EngineTimeline {
  // Branching discards entries after the cursor for *every* successful action; only meaningful
  // actions become rewind targets (protocol v5 `c9`). Strict bot/solo rooms additionally keep
  // incidental actions so a repro can replay them; sandbox keeps its original meaningful-only
  // history.
  const entries = timeline.entries.slice(0, timeline.cursor);
  if (!meaningful && !recordIncidental) {
    return { ...timeline, entries, cursor: entries.length, forward: undefined };
  }
  const highestSeq = entries.reduce(
    (highest, entry) => (typeof entry.seq === "number" ? Math.max(highest, entry.seq) : highest),
    -1,
  );
  const nextSeq = Math.max(timeline.nextSeq ?? 0, highestSeq + 1);
  const entry: EngineTimelineEntry = {
    actionType,
    actorId,
    before: deepClone(previous),
    ...(action ? { action: deepClone(action) } : {}),
    meaningful,
    at: now,
    seq: nextSeq,
  };
  entries.push(entry);
  if (entries.length > maxEntries) {
    entries.splice(0, entries.length - maxEntries);
  }
  return {
    ...timeline,
    entries,
    cursor: entries.length,
    nextSeq: nextSeq + 1,
    forward: undefined,
  };
}

/** 35qz `cJ`: mark the actor as rewindable after a meaningful action. */
export function markRewindable(next: Room, actorId: string): void {
  next.rewindProtocolVersion = REWIND_PROTOCOL_VERSION;
  next.rewindablePlayerIds =
    next.roomMode === "solo_lab"
      ? [actorId]
      : [...new Set([...(next.rewindablePlayerIds ?? []), actorId])];
  next.forwardablePlayerIds = [];
  next.forwardAvailableUntil = undefined;
}

function appendLog(room: Room, text: string, key: string, actorId: string, now: number): void {
  const entry = logDraft(key, undefined, {
    authorPlayerId: actorId,
    actionKind: key === "rewound" ? "rewind" : "forward",
    at: now,
  });
  room.log.push({
    id: `log_${now.toString(36)}_${room.log.length}`,
    at: now,
    text,
    authorPlayerId: actorId,
    turnNumber: room.turnNumber,
    turnPlayerId: room.activeTurnPlayerId,
    actionKind: key === "rewound" ? "rewind" : "forward",
    key,
  });
  if (room.log.length > 2000) room.log.splice(0, room.log.length - 2000);
}

export type RewindResult =
  | { ok: true; state: Room; timeline: EngineTimeline }
  | { ok: false; errorCode: "rewind_unavailable" | "rewind_request_not_found" | "forward_unavailable"; error: string };


/** 35qz `c9` / 24460-24900: is an applied action rewind-meaningful? */
export function isMeaningfulAction(
  type: string,
  changed: boolean,
  action?: Record<string, unknown>,
  before?: Room,
  after?: Room,
): boolean {
  if (!changed) return false;
  if (type === "payment_batch" && action) {
    const operations = Array.isArray(action.operations) ? action.operations : [];
    return operations.some(
      (operation) =>
        !!operation &&
        typeof operation === "object" &&
        (operation as { type?: unknown }).type !== "set_card_label",
    );
  }
  if (type === "set_card_label" && action) {
    // Only the "Buff" helper (temporaryMightBuff) is meaningful; ordinary labels are
    // annotations (original `d8` + `d6`).
    const label = typeof action.label === "string" ? action.label : "";
    if (action.countDelta !== undefined || label.trim().toLowerCase() !== "buff") return false;
    const read = (room: Room | undefined): number | undefined => {
      if (!room) return undefined;
      const zone = typeof action.zone === "string" ? action.zone : "";
      const cardId = typeof action.cardId === "string" ? action.cardId : "";
      for (const player of room.players) {
        const board = player.board;
        if (!board) continue;
        const cards =
          zone === "hand"
            ? board.hand
            : zone === "base"
              ? board.base
              : zone === "battlefieldA"
                ? board.battlefieldA
                : zone === "battlefieldB"
                  ? board.battlefieldB
                  : zone === "battlefieldC"
                    ? (board.battlefieldC ?? [])
                    : zone === "battlefieldToken"
                      ? board.battlefieldToken
                      : zone === "champion"
                        ? board.champion
                        : zone === "legend"
                          ? board.legend
                          : zone === "runeArea"
                            ? board.runeArea
                            : [];
        const card = cards.find((candidate) => candidate.id === cardId);
        if (card) return card.temporaryMightBuff;
      }
      return undefined;
    };
    return read(before) !== read(after);
  }
  switch (type) {
    case "submit_deck":
    case "submit_sealed_draft":
    case "add_solo_opponent":
    case "start_lobby_match":
    case "set_lobby_ready":
    case "switch_lobby_seat":
    case "randomize_lobby_teams":
    case "set_lobby_play_mode":
    case "set_lobby_deck_rules":
    case "set_lobby_game_variant":
    case "set_lobby_match_format":
    case "confirm_solo_setup":
    case "submit_sideboard":
    case "request_sideboard_skip":
    case "respond_sideboard_skip":
    case "select_battlefield":
    case "auto_start_test_setup":
    case "roll_initiative":
    case "submit_mulligan":
    case "choose_first_player":
    case "choose_single_player_turn_order":
    case "request_game_result_confirmation":
    case "cancel_game_result_confirmation":
    case "report_game_result":
    case "request_bo3_rematch":
      return false;
    case "rewind_last_action":
    case "forward_last_rewind":
    case "roll_die":
    case "respond_rewind_confirmation":
    case "set_show_legend_xp_counter":
    case "set_stop_at_beginning_phase":
    case "set_skip_draw_phase":
    case "set_auto_score_from_hold":
    case "adjust_card_counter":
    case "clear_card_counter":
    case "set_card_label":
    case "chain_set_repeat":
    case "chain_set_flow":
    case "chain_set_resolve_vote":
    case "battlefield_conquer_pass_focus":
    case "battlefield_conquer_pass_response":
    case "battlefield_conquer_set_optional_pass":
    case "battlefield_conquer_dismiss":
    case "target_arrow_add":
    case "target_arrow_remove":
    case "target_arrow_remove_from_source":
    case "target_arrow_clear_all":
    case "dismiss_deck_peek":
    case "set_deck_peek_card_reveal":
    case "set_deck_peek_cards_reveal":
    case "set_hand_reveal":
    case "set_card_hidden":
    case "set_card_revealed_to_opponent":
    case "set_battlefield_brush":
      return false;
    case "move_card":
      // same-zone reorders are incidental; any other move is meaningful (the caller
      // filters no-op reorders through `changed`).
      return true;
    default:
      return true;
  }
}

/** `rewind_last_action`: branch to before the actor's last meaningful action. */
export function rewindLastAction(
  room: Room,
  actorId: string,
  now: number,
  requestId: string,
  timeline: EngineTimeline,
): RewindResult {
  const targetIndex = (() => {
    for (let index = Math.min(timeline.cursor, timeline.entries.length) - 1; index >= 0; index -= 1) {
      const entry = timeline.entries[index];
      if (entry && entry.meaningful && entry.actorId === actorId) return index;
    }
    return -1;
  })();
  if (targetIndex < 0) return rewindUnavailable();
  const opponents = timeline.entries
    .slice(targetIndex + 1, timeline.cursor)
    .filter((entry) => entry.meaningful && entry.actorId !== actorId);
  // Sandbox keeps its original confirmation rule; strict practice/solo rewinds are immediate.
  const practiceRewind =
    room.rulesMode === "strict" ? rewindAllowedForRoom(room) : room.roomMode === "solo_lab";
  if (opponents.length > 0 && !practiceRewind) {
    const approverIds = room.players
      .filter((player) => player.id !== actorId && !!player.board && !player.leftAt)
      .map((player) => player.id);
    const opponentActors = [...new Set(opponents.map((entry) => entry.actorId))];
    const confirmation: RewindConfirmation = {
      requestId,
      requesterPlayerId: actorId,
      approverPlayerId: opponentActors[0] ?? approverIds[0] ?? "",
      approverPlayerIds: opponentActors.length > 0 ? opponentActors : approverIds,
      opponentMeaningfulActionCount: opponents.length,
      requestedAt: now,
      expiresAt: now + REWIND_REQUEST_TTL_MS,
    };
    room.rewindConfirmation = confirmation;
    return {
      ok: true,
      state: room,
      timeline: { ...timeline, pending: confirmation },
    };
  }
  return { ok: true, ...performRewind(room, timeline, targetIndex, actorId, now) };
}

function rewindUnavailable(): RewindResult {
  return {
    ok: false,
    errorCode: "rewind_unavailable",
    error: "There is no action available to rewind.",
  };
}

function performRewind(
  room: Room,
  timeline: EngineTimeline,
  index: number,
  actorId: string,
  now: number,
): { state: Room; timeline: EngineTimeline } {
  const entry = timeline.entries[index];
  if (!entry) return { state: room, timeline };
  const target = deepClone(entry.before);
  appendLog(target, "Rewound to before their last action.", "rewound", actorId, now);
  target.rewindProtocolVersion = REWIND_PROTOCOL_VERSION;
  target.forwardablePlayerIds = [actorId];
  target.forwardAvailableUntil = now + FORWARD_WINDOW_MS;
  target.rewindConfirmation = undefined;
  // Strict-only UI marker; sandbox rooms keep their original rewind snapshot byte-for-byte.
  if (target.rulesMode === "strict") target.rewindStep = index + 1;
  // Practice-vs-Bot: hold the bot until the human submits the next action. A live rewind targets
  // the human's last meaningful action, so the restored point is always a human decision. (A
  // repro import at an arbitrary step does not set this flag; the bot may act there.)
  if (target.players.some((player) => player.isBot === true && !player.leftAt)) {
    target.botPause = true;
  }
  const forwardState = deepClone(room);
  forwardState.rewindConfirmation = undefined;
  const nextTimeline: EngineTimeline = {
    ...timeline,
    cursor: index,
    pending: undefined,
    forward: { actorId, state: forwardState, expiresAt: now + FORWARD_WINDOW_MS },
  };
  target.rewindablePlayerIds =
    target.roomMode === "solo_lab"
      ? [actorId]
      : [...new Set([...(target.rewindablePlayerIds ?? []), actorId])];
  return { state: target, timeline: nextTimeline };
}

/** `forward_last_rewind`: restore the timeline saved by the last rewind. */
export function forwardLastRewind(
  room: Room,
  actorId: string,
  now: number,
  timeline: EngineTimeline,
): RewindResult {
  const forward = timeline.forward;
  if (!forward || forward.actorId !== actorId || now > forward.expiresAt) {
    return {
      ok: false,
      errorCode: "forward_unavailable",
      error: "There is no rewound timeline to restore.",
    };
  }
  const target = deepClone(forward.state);
  appendLog(target, "Used Forward to restore the previous timeline.", "restoredTimeline", actorId, now);
  target.forwardablePlayerIds = [];
  target.forwardAvailableUntil = undefined;
  return {
    ok: true,
    state: target,
    timeline: {
      ...timeline,
      forward: undefined,
      cursor: timeline.entries.length,
    },
  };
}

/** `respond_rewind_confirmation`: approve/decline/cancel a pending request. */
export function respondRewind(
  room: Room,
  actorId: string,
  requestId: string,
  response: "approve" | "decline" | "cancel",
  now: number,
  timeline: EngineTimeline,
): RewindResult {
  const pending = timeline.pending ?? room.rewindConfirmation;
  if (!pending || pending.requestId !== requestId) {
    return {
      ok: false,
      errorCode: "rewind_request_not_found",
      error: "That rewind confirmation request is no longer active.",
    };
  }
  if (now > pending.expiresAt) {
    room.rewindConfirmation = undefined;
    return {
      ok: false,
      errorCode: "rewind_request_not_found",
      error: "That rewind confirmation request is no longer active.",
    };
  }
  if (response === "cancel") {
    if (pending.requesterPlayerId !== actorId) {
      return {
        ok: false,
        errorCode: "rewind_request_not_found",
        error: "That rewind confirmation request is no longer active.",
      };
    }
    room.rewindConfirmation = undefined;
    return { ok: true, state: room, timeline: { ...timeline, pending: undefined } };
  }
  const approvers = pending.approverPlayerIds ?? [pending.approverPlayerId];
  if (!approvers.includes(actorId)) {
    return {
      ok: false,
      errorCode: "rewind_request_not_found",
      error: "That rewind confirmation request is no longer active.",
    };
  }
  if (response === "decline") {
    room.rewindConfirmation = undefined;
    return { ok: true, state: room, timeline: { ...timeline, pending: undefined } };
  }
  const targetIndex = (() => {
    for (let index = Math.min(timeline.cursor, timeline.entries.length) - 1; index >= 0; index -= 1) {
      const entry = timeline.entries[index];
      if (entry && entry.meaningful && entry.actorId === pending.requesterPlayerId) return index;
    }
    return -1;
  })();
  if (targetIndex < 0) return rewindUnavailable();
  return {
    ok: true,
    ...performRewind(room, timeline, targetIndex, pending.requesterPlayerId, now),
  };
}

/** The original `requestId` shape is opaque; the transition passes `ctx.idFactory("rewind")`. */
export function newRewindRequestId(idFactory: (kind: string) => string): string {
  return idFactory("rewind");
}
