/**
 * @rift/engine transition entry — the port of `cU`/`cY` plus the server-only room shell.
 *
 *   applyGameAction(state, actorPlayerId, action, ctx)
 *     ↳ guard → clone → handler → Neeko normalise → rune conservation → chain cap
 *       → realized-change victory cleanup → presence cleanup → logs → rewind history
 */
import type { BattlefieldZone, Room, Zone } from "@rift/protocol";
import type { ActionContext, EngineResult, HandlerContext, LogDraft } from "./types";
import { ACTION_HANDLERS, GAMEPLAY_ACTION_TYPES, REWIND_ACTION_TYPES } from "./actions";
import { deepClone, deepEqualRoom, emptyBoard } from "./state/board";
import { makeIdFactory } from "./state/ids";
import { targetedInactiveBattlefield } from "./state/selectors";
import { hasRealizedChange, isPureSameZoneReorder, runePoolsPreserved } from "./rules/realized";
import { cleanupPostBeginningPresence } from "./rules/chain";
import { normalizeNeeko } from "./rules/neeko";
import { settleRoom } from "./rules/victory";
import { isValidAutoPaySpec, validateBatch } from "./rules/batch";
import { buildAutoPayPaymentBatch } from "./rules/autopay";
import { applyArrowAction, cleanupArrows } from "./actions/arrows";
import {
  copyTimeline,
  createInitialTimeline,
  forwardLastRewind,
  isMeaningfulAction,
  markRewindable,
  MAX_STRICT_REWIND_ENTRIES,
  newRewindRequestId,
  recordHistory,
  respondRewind,
  rewindAllowedForRoom,
  rewindLastAction,
} from "./rules/rewind";
import { createStrictRandom, type StrictRandom } from "./strict/rng";
import { appendLog } from "./log/entries";
import { ENGINE_ERRORS, ERROR_CODES } from "./errors";
import type { RulesIntent, Verdict } from "@rift/protocol";
import { applyRulesIntent, defaultAutoPassFor, gate, initializeStrictRules } from "@rift/rules";
import { createEngineRulesHost } from "./strict/host";
import { translateGesture } from "./strict/gestures";
import { boardSettingsFor } from "./state/selectors";

const CHAIN_LIMIT = 20;

function failure(error: string, errorCode?: string): EngineResult {
  return { ok: false, error, ...(errorCode ? { errorCode } : {}) };
}

/** §5: turn a strict Verdict into the engine's failure shape (rule included in the message). */
function verdictFailure(verdict: Extract<Verdict, { ok: false }>): EngineResult {
  const suffix = [verdict.rule ? `rule ${verdict.rule}` : "", verdict.detail ?? ""].filter(Boolean).join(" — ");
  return {
    ...failure(suffix ? `${verdict.code}: ${suffix}` : verdict.code, verdict.code),
    // R2-int: the realtime server forwards code + rule (+ detail) to the sender.
    ...(verdict.rule ? { rule: verdict.rule } : {}),
    ...(verdict.detail ? { detail: verdict.detail } : {}),
  };
}

/** §3 lobby toggle: host only, lobby phase. */
function setLobbyRulesMode(
  state: Room,
  actorPlayerId: string,
  action: Record<string, unknown> & { type: string },
  ctx: ActionContext,
): EngineResult | null {
  if (action.type !== "set_lobby_rules_mode") return null;
  if (state.phase !== "lobby") return failure("Rules mode can only be changed in the lobby.", "invalid_phase");
  if (state.hostPlayerId && state.hostPlayerId !== actorPlayerId) {
    return failure("Only the host can change the rules mode.", "host_only");
  }
  const mode = action.mode;
  if (mode !== "sandbox" && mode !== "strict") {
    return failure("Rules mode must be sandbox or strict.", "invalid_rules_mode");
  }
  const draft = deepClone(state);
  draft.rulesMode = mode;
  if (mode === "sandbox") delete draft.rules;
  draft.updatedAt = ctx.now;
  return { ok: true, state: draft, log: [] };
}

/** §3/§4: strict-rules intent routing. */
function applyStrictRulesIntent(
  state: Room,
  actorPlayerId: string,
  action: Record<string, unknown> & { type: string },
  ctx: ActionContext,
  seeded: StrictRandom | null,
): EngineResult {
  if (state.rulesMode !== "strict") {
    return failure("Strict rules intents require a strict room.", "strict_mode_action");
  }
  const beforeLog = state.log.length;
  const host = createEngineRulesHost(ctx);
  const result = applyRulesIntent(state, actorPlayerId, action as unknown as RulesIntent, ctx, host);
  if (!result.ok) return verdictFailure(result);
  const next = result.room;
  const changed = !deepEqualRoom(state, next);
  let timeline = ctx.timeline;
  if (changed) {
    finalizeSeededAction(state, next, actorPlayerId, seeded);
    // Only practice/solo strict rooms keep a rewind history; human-vs-human never does. The
    // history starts once strict rules are live (setup actions are part of the initial snapshot).
    if (
      timeline &&
      state.phase === "in_game" &&
      !!state.rules &&
      rewindAllowedForRoom(state, ctx.mode)
    ) {
      markRewindable(next, actorPlayerId);
      timeline = recordHistory(
        state,
        actorPlayerId,
        action.type,
        true,
        ctx.now,
        timeline,
        action,
        MAX_STRICT_REWIND_ENTRIES,
      );
    }
  }
  return {
    ok: true,
    state: next,
    log: next.log.slice(beforeLog),
    ...(timeline && timeline !== ctx.timeline ? { timeline } : {}),
  };
}

/**
 * Persist the seeded RNG position, the action index and the bot-pause release on an accepted
 * action. Rewind/forward actions never call this (they restore a snapshot instead).
 */
function finalizeSeededAction(
  previous: Room,
  next: Room,
  actorId: string,
  seeded: StrictRandom | null,
): void {
  if (!seeded) return;
  next.rngCursor = seeded.position();
  next.actionCount = (previous.actionCount ?? 0) + 1;
  const actor = previous.players.find((player) => player.id === actorId);
  if (previous.botPause && actor && !actor.isBot) delete next.botPause;
  // A new accepted action starts a new step; the rewind toast marker no longer applies.
  delete next.rewindStep;
}

/** Setup actions that may call `beginGame` (and therefore the sandbox turn automation). */
const STRICT_SETUP_ENTRY_ACTIONS: ReadonlySet<string> = new Set([
  "submit_mulligan",
  "auto_start_test_setup",
]);

/**
 * In strict rooms the first turn must run @rift/rules' Start-of-Turn tasks, not the sandbox
 * automation. `startTurn` honours `stopAtBeginningPhase`; force it for the duration of the
 * setup handler, then restore the player's own preference.
 */
function holdSandboxFirstTurn(room: Room): Partial<Room>["boardSettingsByPlayerId"] {
  const previous = room.boardSettingsByPlayerId;
  room.boardSettingsByPlayerId = Object.fromEntries(
    room.players.map((player) => [
      player.id,
      { ...boardSettingsFor(room, player.id), stopAtBeginningPhase: true },
    ]),
  );
  return previous;
}

function restoreSandboxFirstTurn(room: Room, previous: Partial<Room>["boardSettingsByPlayerId"]): void {
  if (!room.boardSettingsByPlayerId) return;
  const restored: NonNullable<Room["boardSettingsByPlayerId"]> = {};
  for (const [playerId, settings] of Object.entries(room.boardSettingsByPlayerId)) {
    const original = previous?.[playerId];
    restored[playerId] = {
      ...settings,
      stopAtBeginningPhase: original?.stopAtBeginningPhase ?? false,
    };
  }
  room.boardSettingsByPlayerId = restored;
}

function resultLog(room: Room, count: number): Room["log"] {
  if (count <= 0) return [];
  return room.log.slice(Math.max(0, room.log.length - count));
}

function actionChanged(action: { type: string; from?: unknown; to?: unknown }, before: Room, after: Room): boolean {
  if (deepEqualRoom(before, after)) return false;
  if (action.type === "move_card" && action.from === action.to) {
    // Same-zone reorder is incidental even when the array order changed.
    return false;
  }
  return true;
}

function applyRewindAction(
  state: Room,
  actorIndex: number,
  action: Record<string, unknown> & { type: string },
  ctx: ActionContext,
): EngineResult {
  const actor = state.players[actorIndex];
  if (!actor) return failure(ENGINE_ERRORS.unknownPlayer, ERROR_CODES.unknownPlayer);
  const draft = deepClone(state);
  const timeline = ctx.timeline ? copyTimeline(ctx.timeline) : null;
  const idFactory = makeIdFactory(ctx);
  if (!timeline) {
    return failure(
      action.type === "respond_rewind_confirmation"
        ? ENGINE_ERRORS.rewindRequestNotFound
        : action.type === "forward_last_rewind"
          ? ENGINE_ERRORS.forwardUnavailable
          : ENGINE_ERRORS.rewindUnavailable,
      action.type === "respond_rewind_confirmation"
        ? ERROR_CODES.rewindRequestNotFound
        : action.type === "forward_last_rewind"
          ? ERROR_CODES.forwardUnavailable
          : ERROR_CODES.rewindUnavailable,
    );
  }
  if (action.type === "rewind_last_action") {
    const result = rewindLastAction(draft, actor.id, ctx.now, newRewindRequestId(idFactory), timeline);
    if (!result.ok) return failure(result.error, result.errorCode);
    draft.updatedAt = ctx.now;
    if (result.state === draft) return { ok: true, state: draft, log: [], timeline: result.timeline };
    return { ok: true, state: result.state, log: resultLog(result.state, 1), timeline: result.timeline };
  }
  if (action.type === "forward_last_rewind") {
    const result = forwardLastRewind(draft, actor.id, ctx.now, timeline);
    if (!result.ok) return failure(result.error, result.errorCode);
    result.state.updatedAt = ctx.now;
    return { ok: true, state: result.state, log: resultLog(result.state, 1), timeline: result.timeline };
  }
  if (action.type === "respond_rewind_confirmation") {
    const requestId = typeof action.requestId === "string" ? action.requestId : "";
    const response = action.response === "approve" || action.response === "decline" || action.response === "cancel"
      ? action.response
      : null;
    if (!requestId || !response) return failure(ENGINE_ERRORS.rewindRequestNotFound, ERROR_CODES.rewindRequestNotFound);
    const result = respondRewind(draft, actor.id, requestId, response, ctx.now, timeline);
    if (!result.ok) return failure(result.error, result.errorCode);
    result.state.updatedAt = ctx.now;
    return {
      ok: true,
      state: result.state,
      log: resultLog(result.state, result.state === draft ? 0 : 1),
      timeline: result.timeline,
    };
  }
  return failure(ENGINE_ERRORS.unknownAction(action.type), ERROR_CODES.unknownAction);
}

export function applyGameAction<A extends { type: string }>(
  state: Room,
  actorPlayerId: string,
  actionInput: A,
  ctx: ActionContext,
): EngineResult {
  if (!state || !Array.isArray(state.players)) {
    return failure(ENGINE_ERRORS.unknownPlayer, ERROR_CODES.unknownPlayer);
  }
  if (!actionInput || typeof actionInput.type !== "string" || actionInput.type.length === 0) {
    return failure(ENGINE_ERRORS.unknownAction(String(actionInput?.type)), ERROR_CODES.unknownAction);
  }
  const actorIndex = state.players.findIndex((player) => player.id === actorPlayerId);
  if (actorIndex < 0) return failure(ENGINE_ERRORS.unknownPlayer, ERROR_CODES.unknownPlayer);

  // Strict bot/solo determinism: when the room carries a game seed, every action draws from the
  // seeded cursor stored on the Room (never the server clock). The cursor is written back on the
  // resulting room, so rewinding restores the exact RNG position.
  const seeded =
    state.rulesMode === "strict" && typeof state.rngSeed === "number"
      ? createStrictRandom(state.rngSeed, state.rngCursor ?? 0)
      : null;
  const actionCtx: ActionContext = seeded ? { ...ctx, rng: seeded.rng } : ctx;

  // Strict-mode lobby toggle (§3). Handled before the handler map so the sandbox is untouched.
  const lobbyRules = setLobbyRulesMode(
    state,
    actorPlayerId,
    actionInput as unknown as Record<string, unknown> & { type: string },
    actionCtx,
  );
  if (lobbyRules) return lobbyRules;

  // Strict-mode intents (§3): routed to @rift/rules, never to the sandbox handler map.
  if (actionInput.type.startsWith("rules_")) {
    return applyStrictRulesIntent(
      state,
      actorPlayerId,
      actionInput as unknown as Record<string, unknown> & { type: string },
      actionCtx,
      seeded,
    );
  }

  if (REWIND_ACTION_TYPES.has(actionInput.type)) {
    // §4: rewind is only available in solo modes and Practice-vs-Bot, never human-vs-human.
    if (!rewindAllowedForRoom(state, actionCtx.mode)) {
      return failure("Rewind is disabled in strict multiplayer rooms.", "strict_mode_action");
    }
    return applyRewindAction(
      state,
      actorIndex,
      actionInput as unknown as Record<string, unknown> & { type: string },
      actionCtx,
    );
  }
  const gameplayAction = GAMEPLAY_ACTION_TYPES.has(actionInput.type);
  if (gameplayAction && state.rulesMode === "strict") {
    // R4-gestures: a board gesture (drag/tap/drop) is translated to the one strict rules intent
    // it means and applied through the same path as a hand-written `rules_*` action. Cosmetics
    // and the §6.4 manual-window board actions fall through to `gate()` unchanged.
    const translated = translateGesture(
      state,
      actorPlayerId,
      actionInput as unknown as Record<string, unknown> & { type: string },
      createEngineRulesHost(actionCtx),
    );
    if (translated.kind === "intent") {
      return applyStrictRulesIntent(
        state,
        actorPlayerId,
        translated.intent as unknown as Record<string, unknown> & { type: string },
        actionCtx,
        seeded,
      );
    }
    if (translated.kind === "reject") {
      return verdictFailure({
        ok: false,
        code: translated.code,
        rule: translated.rule ?? "contract:§4",
        ...(translated.detail ? { detail: translated.detail } : {}),
      });
    }
    const verdict = gate(state, actorPlayerId, actionInput.type);
    if (!verdict.ok) return verdictFailure(verdict);
  }
  if (gameplayAction) {
    if (state.phase !== "in_game") return failure(ENGINE_ERRORS.notInGame, ERROR_CODES.notInGame);
    if (!state.players[actorIndex]?.board) return failure(ENGINE_ERRORS.unknownPlayer, ERROR_CODES.unknownPlayer);
    if (
      targetedInactiveBattlefield(
        state,
        actorPlayerId,
        actionInput as unknown as Record<string, unknown> & { type: string },
      )
    ) {
      return { ok: true, state, log: [] };
    }
  }
  const handler = ACTION_HANDLERS[actionInput.type];
  if (!handler) return failure(ENGINE_ERRORS.unknownAction(actionInput.type), ERROR_CODES.unknownAction);

  let action = actionInput as unknown as Record<string, unknown> & { type: string };

  // Batch validators / auto-pay expansion happen before any handler executes.
  if (action.type === "payment_batch") {
    if (action.autoPay !== undefined) {
      if (!isValidAutoPaySpec(action.autoPay)) {
        return failure(ENGINE_ERRORS.autoPayUnavailable, ERROR_CODES.autoPayUnavailable);
      }
      const batch = buildAutoPayPaymentBatch(state, actorIndex, action.autoPay);
      if (!batch) return failure(ENGINE_ERRORS.autoPayUnavailable, ERROR_CODES.autoPayUnavailable);
      action = { ...action, operations: batch.operations, paymentGroupOrigin: "auto_pay_button" };
    }
    const error = validateBatch("payment_batch", action.operations);
    if (error) return failure(error, ERROR_CODES.invalidOperations);
  } else if (action.type === "rune_batch") {
    const error = validateBatch("rune_batch", action.operations);
    if (error) return failure(error, ERROR_CODES.invalidOperations);
  } else if (action.type === "floating_resource_batch") {
    const error = validateBatch("floating_resource_batch", action.operations);
    if (error) return failure(error, ERROR_CODES.invalidOperations);
  }

  let draft = deepClone(state);
  // In strict rooms the first turn is owned by @rift/rules. Hold the sandbox automation at
  // `beginning` while the setup handler runs, then initialize the strict Start-of-Turn tasks.
  const holdFirstTurn =
    state.rulesMode === "strict" &&
    state.phase !== "in_game" &&
    STRICT_SETUP_ENTRY_ACTIONS.has(action.type);
  const forcedFirstTurn = holdFirstTurn ? holdSandboxFirstTurn(draft) : undefined;
  const drafts: LogDraft[] = [];
  const idFactory = makeIdFactory(actionCtx);
  const timeline = actionCtx.timeline ? copyTimeline(actionCtx.timeline) : undefined;
  const context: HandlerContext = {
    now: actionCtx.now,
    rng: actionCtx.rng,
    mode: actionCtx.mode,
    idFactory,
    actorId: actorPlayerId,
    actorIndex,
    authorizedPlayerIds:
      actionCtx.mode === "solo_lab" || draft.roomMode === "solo_lab"
        ? draft.players.map((candidate) => candidate.id)
        : undefined,
    log: (draftEntry) => {
      drafts.push(draftEntry);
    },
    applyDeferred: (room) => room,
  };
  const player = draft.players[actorIndex];
  if (!player) return failure(ENGINE_ERRORS.unknownPlayer, ERROR_CODES.unknownPlayer);
  const board = player.board ?? emptyBoard();

  handler({
    room: draft,
    playerIndex: actorIndex,
    player,
    board,
    action,
    context,
  });

  if (holdFirstTurn) {
    restoreSandboxFirstTurn(draft, forcedFirstTurn);
  }
  if (draft.rulesMode === "strict" && draft.phase === "in_game" && !draft.rules) {
    // Auto-pass (docs/rules/auto-pass.md): every seat starts with the information-safe defaults.
    draft = initializeStrictRules(draft, actionCtx, createEngineRulesHost(actionCtx), {
      // A human in a room with a bot seat (Practice vs Bot) starts in fast mode.
      autoPass: (playerId) => defaultAutoPassFor(draft, playerId),
    });
  }
  // Human-vs-human strict rooms keep no history at all; practice/solo strict rooms record every
  // changed action once strict rules are live (incidental ones too) so repro replay is exact.
  const historyAllowed =
    state.rulesMode !== "strict" ||
    (state.phase === "in_game" &&
      !!state.rules &&
      rewindAllowedForRoom(state, actionCtx.mode));
  const recordIncidental = state.rulesMode === "strict" && historyAllowed;

  const arrowAction = action.type.startsWith("target_arrow_");
  if (arrowAction) {
    cleanupArrows(state, draft, action);
    if (deepEqualRoom(state, draft)) {
      return { ok: true, state, log: [], ...(timeline ? { timeline: copyTimeline(timeline) } : {}) };
    }
    draft.updatedAt = actionCtx.now;
    const nextTimeline = timeline && historyAllowed
      ? recordHistory(
          state,
          actorPlayerId,
          action.type,
          false,
          actionCtx.now,
          timeline,
          action,
          state.rulesMode === "strict" ? MAX_STRICT_REWIND_ENTRIES : undefined,
          recordIncidental,
        )
      : undefined;
    return {
      ok: true,
      state: draft,
      log: [],
      ...(nextTimeline ? { timeline: nextTimeline } : {}),
    };
  }
  // cY: if the handler returned the same room, Neeko normalisation, invariants, settle,
  // presence cleanup and arrow cleanup are all skipped.
  if (deepEqualRoom(state, draft)) {
    return { ok: true, state, log: [], ...(timeline ? { timeline: copyTimeline(timeline) } : {}) };
  }
  normalizeNeeko(draft);

  if (gameplayAction) {
    if (!runePoolsPreserved(state, draft)) {
      return failure(ENGINE_ERRORS.runeConservation, ERROR_CODES.runeConservation);
    }
    if (draft.chainEntries.length > CHAIN_LIMIT && draft.chainEntries.length > state.chainEntries.length) {
      return failure(ENGINE_ERRORS.chainFull, ERROR_CODES.chainFull);
    }
  }

  const changed = !deepEqualRoom(state, draft);
  if (!changed) {
    return { ok: true, state, log: [], ...(timeline ? { timeline: copyTimeline(timeline) } : {}) };
  }

  const realized = gameplayAction && hasRealizedChange(state, draft, action);
  if (realized) settleRoom(draft);
  // 35qz cY: `cx.h` runs for every changed handler result (not only realized changes).
  cleanupPostBeginningPresence(draft);
  // 662731 `c` runs last, after Neeko normalisation/settle/presence cleanup.
  cleanupArrows(state, draft, action);

  draft.updatedAt = actionCtx.now;
  appendLog(draft, drafts);
  const addedLogs = drafts.length;

  finalizeSeededAction(state, draft, actorPlayerId, seeded);

  const sameZoneReorder =
    action.type === "move_card" &&
    action.from === action.to &&
    typeof action.from === "string" &&
    isPureSameZoneReorder(state, draft, action.from);
  const meaningful =
    !sameZoneReorder && isMeaningfulAction(action.type, true, action, state, draft);
  if (meaningful) markRewindable(draft, actorPlayerId);
  const nextTimeline = timeline && historyAllowed
    ? recordHistory(
        state,
        actorPlayerId,
        action.type,
        meaningful,
        actionCtx.now,
        timeline,
        action,
        state.rulesMode === "strict" ? MAX_STRICT_REWIND_ENTRIES : undefined,
        recordIncidental,
      )
    : undefined;

  return {
    ok: true,
    state: draft,
    log: resultLog(draft, addedLogs),
    ...(nextTimeline ? { timeline: nextTimeline } : {}),
  };
}

/** Optional helper: a coarse list of action type strings for the current phase. */
export function getLegalActions(state: Room, playerId: string): string[] {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return [];
  if (state.phase === "lobby") {
    return [
      "set_lobby_ready",
      "switch_lobby_seat",
      "set_lobby_play_mode",
      "set_lobby_deck_rules",
      "set_lobby_game_variant",
      "set_lobby_match_format",
      "start_lobby_match",
      "submit_deck",
      "submit_sealed_draft",
      "randomize_lobby_teams",
      "add_solo_opponent",
    ];
  }
  if (state.phase === "sideboarding") {
    return ["submit_sideboard", "request_sideboard_skip", "respond_sideboard_skip", "confirm_solo_setup", "auto_start_test_setup"];
  }
  if (state.phase === "battlefield_pick") {
    return ["select_battlefield", "confirm_solo_setup", "auto_start_test_setup"];
  }
  if (state.phase === "initiative_roll") return ["roll_initiative", "auto_start_test_setup"];
  if (state.phase === "first_player_choice") {
    return state.roomMode === "single_player"
      ? ["choose_single_player_turn_order", "confirm_solo_setup", "auto_start_test_setup"]
      : ["choose_first_player", "auto_start_test_setup"];
  }
  if (state.phase === "mulligan") return ["submit_mulligan", "auto_start_test_setup"];
  if (state.phase !== "in_game") return [];
  if (!player.board) return [];
  return Object.keys(ACTION_HANDLERS).filter((type) => GAMEPLAY_ACTION_TYPES.has(type));
}

export type { BattlefieldZone };
