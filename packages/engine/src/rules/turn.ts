/**
 * Turn structure — original modules:
 *  - 70094 (`o.k` start turn, `o.T` beginning phase, `o.c` auto-resolve chain, `o.O`)
 *  - 408727 (`H` next player / extra turns)
 *  - 51407 (`v` end beginning phase, `x` end turn)
 */
import type { PlayerBoard, Room } from "@rift/protocol";
import {
  battlefieldZones,
  clearBoardPeekUnlessRune,
  cloneCard,
  hasUnitAt,
  isTokenOrDuplicate,
  pruneDeckPeek,
  recycledBottomCount,
  setRecycledBottomCount,
  zoneList,
} from "../state/board";
import {
  battlefieldCount,
  beginningStepAllyControls,
  boardSettingsByPlayer,
  boardSettingsFor,
  clampScoreForVictory,
  entityScore,
  markBattlefieldScored,
  setEntityScore,
  snapshotBattlefieldPresence,
} from "../state/selectors";
import {
  battlefieldContributorIds,
  entityGroups,
  turnOrderForRoom,
  VARIANT_RULES,
  variantForRoom,
} from "../state/variant";
import {
  beginningAdjustments,
  nearVictoryScore,
  resolveConquerDecision,
  scoredThisTurn,
  settleRoom,
  tiannaBlocksPointGain,
  victoryScoreForRoom,
} from "./victory";
import { autoResolveChain } from "./chain";
import type { LogDraft } from "../types";
import { logDraft } from "../log/entries";
import type { DeckData } from "../types";

export type LogSink = (draft: LogDraft) => void;

export interface TurnStartResult {
  nextRoom: Room;
  readied: number;
  channeledRuneIds: string[];
  drawnCardIds: string[];
  scoredPoints: number;
}

interface BeginningResult {
  nextRoom: Room;
  channeledRuneIds: string[];
  drawnCardIds: string[];
  scoredPoints: number;
}

const READY_ZONES = [
  "legend",
  "runeArea",
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
] as const;

/** 70094 `k` / `m`: begin a player's turn (ready, bookkeeping, then auto beginning). */
export function startTurn(room: Room, playerIndex: number, log?: LogSink): TurnStartResult | null {
  const player = room.players[playerIndex];
  if (!player?.board) return null;

  let readied = 0;
  for (const zone of READY_ZONES) {
    const list = zoneList(player.board, zone);
    for (let index = 0; index < list.length; index += 1) {
      const card = list[index];
      if (card?.exhausted) {
        list[index] = { ...card, exhausted: false };
        readied += 1;
      }
    }
  }

  const previousCount = room.playerTurnCounts?.[player.id] ?? 0;
  const counts: Record<string, number> = { ...(room.playerTurnCounts ?? {}) };
  for (const candidate of room.players) {
    if (!(candidate.id in counts)) counts[candidate.id] = 0;
  }
  counts[player.id] = previousCount + 1;

  room.activeTurnPlayerId = player.id;
  room.activeTurnStep = "beginning";
  room.playerTurnCounts = counts;
  room.boardSettingsByPlayerId = boardSettingsByPlayer(room);
  room.pendingBattlefieldConquerAssist = undefined;
  room.battlefieldConquerAssistExcludedZones = undefined;
  room.postBeginningBattlefieldUnitPresenceByPlayer = undefined;
  room.beginningBattlefieldUnitPresenceByPlayer = undefined;

  if (readied > 0) {
    log?.(logDraft("readiedAllRunes", undefined, { authorPlayerId: player.id, actionKind: "turn" }));
  }

  if (boardSettingsFor(room, player.id).stopAtBeginningPhase) {
    return { nextRoom: room, readied, channeledRuneIds: [], drawnCardIds: [], scoredPoints: 0 };
  }

  const beginning = runBeginningPhase(room, playerIndex, log);
  if (!beginning) {
    return { nextRoom: room, readied, channeledRuneIds: [], drawnCardIds: [], scoredPoints: 0 };
  }
  return {
    nextRoom: beginning.nextRoom,
    readied,
    channeledRuneIds: beginning.channeledRuneIds,
    drawnCardIds: beginning.drawnCardIds,
    scoredPoints: beginning.scoredPoints,
  };
}

/** 70094 `T` / `p`: hold scoring → victory check → channel → draw → main step. */
export function runBeginningPhase(room: Room, playerIndex: number, log?: LogSink): BeginningResult | null {
  const player = room.players[playerIndex];
  if (!player?.board) return null;
  const settings = boardSettingsFor(room, player.id);
  const presence = snapshotBattlefieldPresence(room);
  room.postBeginningBattlefieldUnitPresenceByPlayer = presence;
  room.beginningBattlefieldUnitPresenceByPlayer = presence;

  const scored = scoreHolds(room, playerIndex, settings.autoScoreFromHold, log);
  if (room.chainEntries.length === 0) settleRoom(room);

  const board = room.players[playerIndex]?.board;
  if (!board) return null;

  const channel = channelRunes(room, playerIndex);
  const channeledRuneIds = channel.channeledRuneIds;
  for (let i = 0; i < channeledRuneIds.length; i += 1) {
    log?.(logDraft("channeledRune", undefined, { authorPlayerId: player.id, actionKind: "turn" }));
  }

  const firstTurn = (room.playerTurnCounts?.[player.id] ?? 0) <= 1;
  const deckData = player.deck as DeckData | undefined;
  const sealedExtra =
    room.playMode === "sealed" && firstTurn ? sealedExtraDrawCountFromSections(deckData?.sections) : 0;
  const adjustments = beginningAdjustments(room, player.id);
  const variant = variantForRoom(room);
  const drawCount =
    Number(!(variant !== "duel" && firstTurn && adjustments.skipFirstDraw)) + sealedExtra;

  const draw =
    settings.skipDrawPhase || drawCount === 0
      ? { nextBoard: channel.nextBoard, drawnCardIds: [], burnedCardIds: [] as string[] }
      : drawFromTop(channel.nextBoard, drawCount);
  if (draw.drawnCardIds.length > 0) {
    log?.(logDraft("drewCards", { count: draw.drawnCardIds.length }, {
      authorPlayerId: player.id,
      actionKind: "turn",
    }));
  }
  if (draw.burnedCardIds.length > 0) {
    log?.(logDraft("burnedCards", { count: draw.burnedCardIds.length }, {
      authorPlayerId: player.id,
      actionKind: "turn",
    }));
  }

  updatePlayerBoard(room, playerIndex, draw.nextBoard);
  room.activeTurnStep = "main";
  return {
    nextRoom: room,
    channeledRuneIds,
    drawnCardIds: draw.drawnCardIds,
    scoredPoints: scored,
  };
}

/** 70094 `p` inner hold loop. */
export function scoreHolds(room: Room, playerIndex: number, awardPoints: boolean, log?: LogSink): number {
  const player = room.players[playerIndex];
  const board = player?.board;
  if (!player || !board) return 0;
  const zones = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
  const blocked = tiannaBlocksPointGain(room, player.id);
  const victoryScore = victoryScoreForRoom(room);
  let scored = 0;
  for (const zone of zones) {
    const currentBoard = room.players[playerIndex]?.board;
    if (!currentBoard) continue;
    if (!hasUnitAt(currentBoard, zone)) continue;
    if (beginningStepAllyControls(room, playerIndex, zone)) continue;
    const before = entityScore(room, player.id);
    markBattlefieldScored(room, player.id, zone);
    if (!room.players[playerIndex]?.board || !awardPoints || blocked) continue;
    const next = clampScoreForVictory(room, entityScore(room, player.id) + 1, victoryScore);
    if (next !== before) {
      scored += next - before;
      setEntityScore(room, player.id, next);
    }
  }
  if (scored > 0) {
    log?.(logDraft("scoredAtTurnStart", {
      points: scored,
      from: entityScore(room, player.id) - scored,
      to: entityScore(room, player.id),
    }, { authorPlayerId: player.id, actionKind: "turn" }));
  }
  return scored;
}

/** 70094 `p`: rune channel count for this turn. */
export function runeChannelCount(room: Room, playerIndex: number): number {
  const player = room.players[playerIndex];
  if (!player) return 2;
  const firstTurn = (room.playerTurnCounts?.[player.id] ?? 0) <= 1;
  const variant = variantForRoom(room);
  if (variant !== "duel" && firstTurn) {
    return 2 + beginningAdjustments(room, player.id).extraRunesOnFirstChannel;
  }
  if (
    firstTurn &&
    ((!!room.firstPlayerId && room.firstPlayerId !== player.id) ||
      (room.roomMode === "single_player" && room.singlePlayerTurnOrder === "play_second"))
  ) {
    return 3;
  }
  return 2;
}

/** 70094 `p` channel block. */
export function channelRunes(
  room: Room,
  playerIndex: number,
): { nextBoard: PlayerBoard; channeledRuneIds: string[] } {
  const board = room.players[playerIndex]?.board;
  if (!board) throw new Error("channelRunes: missing board");
  const count = runeChannelCount(room, playerIndex);
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const rune = board.runeDeck.pop();
    if (!rune) break;
    board.runeArea.push({ ...rune, exhausted: false });
    ids.push(rune.id);
  }
  pruneDeckPeek(board);
  return { nextBoard: board, channeledRuneIds: ids };
}

/** 70094 `p` draw block. */
export function drawFromTop(
  board: PlayerBoard,
  count: number,
): { nextBoard: PlayerBoard; drawnCardIds: string[]; burnedCardIds: string[] } {
  const ids: string[] = [];
  const burned: string[] = [];
  const bottom = recycledBottomCount(board);
  for (let i = 0; i < count; i += 1) {
    const card = board.deck.pop();
    if (!card) break;
    if (!isTokenOrDuplicate(card)) {
      const copy = cloneCard(card);
      board.hand.push(copy);
      ids.push(copy.id);
    } else {
      burned.push(card.id);
    }
  }
  setRecycledBottomCount(board, Math.min(bottom, board.deck.length));
  return { nextBoard: board, drawnCardIds: ids, burnedCardIds: burned };
}

/** 613138 `f`: sealed first-turn extra draw when a section is missing. */
export function sealedExtraDrawCountFromSections(sections: unknown): number {
  if (!sections || typeof sections !== "object") return 0;
  const input = sections as { legend?: unknown[]; champion?: unknown[] };
  return Number((input.legend?.length ?? 0) === 0 || (input.champion?.length ?? 0) === 0);
}

function updatePlayerBoard(room: Room, playerIndex: number, board: PlayerBoard): void {
  const player = room.players[playerIndex];
  if (player) player.board = board;
}

/** 408727 `H`: next player, consuming queued extra turns first. */
export function nextTurnPlayer(
  room: Room,
  startingPlayerId: string,
): { room: Room; playerIndex: number } {
  const active = room.players.map((player) => player.id);
  const order = turnOrderForRoom(
    room,
    room.firstPlayerId ?? room.players[0]?.id ?? startingPlayerId,
    active,
  );
  const validIndex = (id: string): number =>
    room.players.findIndex((player) => player.id === id && !!player.board && !player.leftAt);
  let nextIndex = -1;
  if (room.roomMode === "single_player") {
    nextIndex = validIndex(startingPlayerId);
  } else {
    const resume = room.extraTurnResumePlayerId;
    const start = order.indexOf(resume ?? startingPlayerId);
    const offset = resume && start >= 0 ? 0 : 1;
    for (let step = offset; step < offset + order.length; step += 1) {
      const id = order[(Math.max(0, start) + step) % order.length];
      if (!id) continue;
      const index = validIndex(id);
      if (index >= 0) {
        nextIndex = index;
        break;
      }
    }
  }
  const pending = (room.pendingExtraTurns ?? []).filter((entry) => validIndex(entry.playerId) >= 0);
  const first = pending[0];
  if (first) {
    const rest = pending.slice(1);
    room.pendingExtraTurns = rest.length > 0 ? rest : undefined;
    room.extraTurnResumePlayerId = room.players[nextIndex]?.id;
    return { room, playerIndex: validIndex(first.playerId) };
  }
  if (room.pendingExtraTurns || room.extraTurnResumePlayerId) {
    room.pendingExtraTurns = undefined;
    room.extraTurnResumePlayerId = undefined;
  }
  return { room, playerIndex: nextIndex };
}

/** 51407 `v`: end the beginning phase early. */
export function endBeginningPhase(room: Room, playerIndex: number, log?: LogSink): Room {
  const board = room.players[playerIndex]?.board;
  if (!board) return room;
  clearDeckPeekFully(board);
  const beginning = runBeginningPhase(room, playerIndex, log);
  log?.(logDraft("endedBeginningPhase", undefined, {
    authorPlayerId: room.players[playerIndex]?.id,
    actionKind: "turn",
  }));
  return beginning?.nextRoom ?? room;
}

function clearDeckPeekFully(board: PlayerBoard): void {
  board.deckPeek = {
    cardIds: [],
    revealedCardIds: [],
    ...(board.deckPeek?.revision !== undefined ? { revision: board.deckPeek.revision } : {}),
  };
}

/** 51407 `x`: end turn → cleanup → next player → start turn. */
export function endTurn(room: Room, actorIndex: number, allowLeftActive: boolean, log?: LogSink): Room {
  const actor = room.players[actorIndex];
  if (!actor) return room;
  const activeIndex = room.players.findIndex((player) => player.id === room.activeTurnPlayerId);
  const actingIndex = allowLeftActive ? activeIndex : actorIndex;
  const turnPlayerId = room.players[actingIndex]?.id ?? actor.id;

  const resolved = autoResolveChain(room);
  if (resolved.activeTurnStep === "beginning" && !allowLeftActive) {
    const actorBoard = resolved.players[actorIndex]?.board;
    if (actorBoard) clearDeckPeekFully(actorBoard);
    const beginning = runBeginningPhase(resolved, actorIndex, log);
    return beginning?.nextRoom ?? resolved;
  }

  const next = nextTurnPlayer(resolved, turnPlayerId);
  if (next.playerIndex < 0 || !next.room.players[next.playerIndex]?.board) return resolved;

  const board = next.room.players[actingIndex]?.board;
  if (board) clearDeckPeekFully(board);
  clearBanishedUntilEnding(next.room, turnPlayerId);
  for (const player of next.room.players) {
    if (!player.board) continue;
    player.board.floatingEnergy = 0;
    player.board.floatingPower = 0;
  }
  settleRoom(next.room);
  next.room.turnNumber = Math.max(1, (next.room.turnNumber ?? 1) + 1);

  log?.(logDraft("endedTurn", undefined, { authorPlayerId: actor.id, actionKind: "turn" }));
  const started = startTurn(next.room, next.playerIndex, log);
  return started?.nextRoom ?? next.room;
}

function clearBanishedUntilEnding(room: Room, playerId: string): void {
  for (const player of room.players) {
    if (!player.board) continue;
    for (const card of player.board.banished) {
      if (card.banishedUntilEndingPlayerId === playerId) {
        delete card.banishedUntilEndingPlayerId;
      }
    }
  }
}

/** 70094 `O` / `g`: after resolution, advance if the active player left. */
export function advanceIfActivePlayerLeft(room: Room, log?: LogSink): Room {
  if (room.chainEntries.length > 0 || room.pendingBattlefieldConquerAssist) return room;
  const index = room.players.findIndex((player) => player.id === room.activeTurnPlayerId);
  const active = room.players[index];
  if (index < 0 || !active?.leftAt) return room;
  const next = nextTurnPlayer(room, active.id);
  if (next.playerIndex >= 0) {
    next.room.turnNumber = Math.max(1, (room.turnNumber ?? 1) + 1);
    return startTurn(next.room, next.playerIndex, log)?.nextRoom ?? room;
  }
  next.room.activeTurnPlayerId = undefined;
  next.room.activeTurnStep = undefined;
  return next.room;
}

/** 822434 `L` / 357603 `C`: per-turn scored map for a player. */
export function scoredMapFor(room: Room, playerId: string) {
  return room.battlefieldScoredThisTurnByPlayer?.[playerId];
}

export { scoredThisTurn, nearVictoryScore, resolveConquerDecision, markBattlefieldScored };

/** Preserved for handlers that need a "turn owner" check. */
export function currentTurnPlayerIndex(room: Room): number {
  return room.players.findIndex((player) => player.id === room.activeTurnPlayerId);
}

/** Extra-turn queue membership (408727 `m` helper). */
export function pendingExtraTurnFor(room: Room, entryId: string) {
  return (room.pendingExtraTurns ?? []).find((entry) => entry.sourceEntryId === entryId);
}

/** Re-export to avoid a circular import in handlers. */
export { battlefieldContributorIds, entityGroups, VARIANT_RULES, clearBoardPeekUnlessRune };
