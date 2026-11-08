/**
 * "Realized change" classifier — original module 357603 `z` (14u_g6w741h2k.js:1362).
 *
 * The transition only runs the victory/gear cleanup and the post-beginning presence
 * cleanup when an action produced a change in the compared gameplay fields. This keeps
 * coordination/peek/roll actions from triggering score checks.
 */
import type { CardInstance, Room } from "@rift/protocol";
import { readZoneList } from "../state/board";
import { battlefieldZones } from "../state/board";

const COMPARED_ZONES = [
  "base",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "legend",
  "runeArea",
] as const;

function snapshotRoom(room: Room): Record<string, unknown> {
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    players: room.players,
    roomMode: room.roomMode,
    playMode: room.playMode,
    setupOrderVersion: room.setupOrderVersion,
    singlePlayerTurnOrder: room.singlePlayerTurnOrder,
    soloSetupPending: room.soloSetupPending,
    firstPlayerChooserId: room.firstPlayerChooserId,
    firstPlayerId: room.firstPlayerId,
    activeTurnPlayerId: room.activeTurnPlayerId,
    activeTurnStep: room.activeTurnStep,
    turnNumber: room.turnNumber,
    playerTurnCounts: room.playerTurnCounts,
    pendingExtraTurns: room.pendingExtraTurns,
    extraTurnResumePlayerId: room.extraTurnResumePlayerId,
    initiativeRound: room.initiativeRound,
    initiativeRolls: room.initiativeRolls,
    sideboardDonePlayerIds: room.sideboardDonePlayerIds,
    sideboardSkipRequest: room.sideboardSkipRequest,
    mulliganDonePlayerIds: room.mulliganDonePlayerIds,
    mulliganPlaybackByPlayerId: room.mulliganPlaybackByPlayerId,
    chainEntries: room.chainEntries,
    chainResolveVotes: room.chainResolveVotes,
    battlefieldBrushByZone: room.battlefieldBrushByZone,
    sharedBattlefieldToken: room.sharedBattlefieldToken,
    postBeginningBattlefieldUnitPresenceByPlayer: room.postBeginningBattlefieldUnitPresenceByPlayer,
    beginningBattlefieldUnitPresenceByPlayer: room.beginningBattlefieldUnitPresenceByPlayer,
    battlefieldScoredThisTurnByPlayer: room.battlefieldScoredThisTurnByPlayer,
    pendingBattlefieldConquerAssist: room.pendingBattlefieldConquerAssist,
    battlefieldConquerAssistExcludedZones: room.battlefieldConquerAssistExcludedZones,
    targetArrowsByPlayer: room.targetArrowsByPlayer,
  };
}

function cardsEqual(a: CardInstance[] | undefined, b: CardInstance[] | undefined): boolean {
  if (a === b) return true;
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const x = left[index];
    const y = right[index];
    if (!x || !y) return false;
    if (
      x.id !== y.id ||
      x.type !== y.type ||
      x.exhausted !== y.exhausted ||
      !!x.hidden !== !!y.hidden ||
      (x.attachedToCardId ?? null) !== (y.attachedToCardId ?? null) ||
      (x.temporaryMightBuff ?? 0) !== (y.temporaryMightBuff ?? 0) ||
      (x.whiteCounter ?? 0) !== (y.whiteCounter ?? 0) ||
      (x.redCounter ?? 0) !== (y.redCounter ?? 0)
    ) {
      return false;
    }
  }
  return true;
}

/** 357603 `z`: did the action have a realized gameplay change? */
export function hasRealizedChange(previous: Room, next: Room, action: { type: string }): boolean {
  if (next === previous) return false;
  if (previous.chainEntries.length > 0 || next.chainEntries.length > 0) return false;
  if (action.type === "chain_add" || action.type === "chain_resolve") return false;
  if (action.type === "set_score" || action.type === "adjust_score") return true;
  if (!!previous.sharedBattlefieldToken?.active !== !!next.sharedBattlefieldToken?.active) return true;
  if (previous.players.length !== next.players.length) return true;
  const zones = battlefieldZones(
    next.sharedBattlefieldToken,
    next.players.length === 2 && (!next.gameVariant || next.gameVariant === "duel") ? 2 : 3,
  );
  for (const zone of ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"] as const) {
    if (!!previous.battlefieldBrushByZone?.[zone] !== !!next.battlefieldBrushByZone?.[zone]) return true;
  }
  // The original compares only base + active battlefields + legend + runeArea.
  const compared = ["base", ...zones, "legend", "runeArea"] as const;
  for (let index = 0; index < previous.players.length; index += 1) {
    const beforePlayer = previous.players[index];
    const afterPlayer = next.players[index];
    if (!afterPlayer || beforePlayer?.id !== afterPlayer.id) return true;
    if (!!beforePlayer.board !== !!afterPlayer.board) return true;
    for (const zone of compared) {
      const before = beforePlayer.board ? readZoneList(beforePlayer.board, zone) : undefined;
      const after = afterPlayer.board ? readZoneList(afterPlayer.board, zone) : undefined;
      if (!cardsEqual(before, after)) return true;
    }
  }
  return false;
}

/**
 * 35qz `d4`/`d3`: a same-zone move that only changed card order (each zone sorted by id
 * compares equal) is a pure reorder, which the rewind classifier treats as incidental.
 */
export function isPureSameZoneReorder(previous: Room, next: Room, zone: string): boolean {
  if (previous.players.length !== next.players.length) return false;
  for (let index = 0; index < previous.players.length; index += 1) {
    const before = previous.players[index]?.board ? readZoneList(previous.players[index]!.board!, zone) : [];
    const after = next.players[index]?.board ? readZoneList(next.players[index]!.board!, zone) : [];
    const sortedBefore = [...before].sort((a, b) => a.id.localeCompare(b.id));
    const sortedAfter = [...after].sort((a, b) => a.id.localeCompare(b.id));
    if (!cardsEqual(sortedBefore, sortedAfter)) return false;
  }
  return true;
}

/** 618260 `M`: rune conservation invariant (same total + same multiset per player). */
export function runePoolsPreserved(previous: Room, next: Room): boolean {
  if (previous.players.length !== next.players.length) return false;
  for (const beforePlayer of previous.players) {
    const afterPlayer = next.players.find((candidate) => candidate.id === beforePlayer.id);
    if (!afterPlayer) return false;
    if (!!beforePlayer.board !== !!afterPlayer.board) return false;
    if (!beforePlayer.board || !afterPlayer.board) continue;
    const beforePool = [...beforePlayer.board.runeDeck, ...beforePlayer.board.runeArea];
    const afterPool = [...afterPlayer.board.runeDeck, ...afterPlayer.board.runeArea];
    if (beforePool.length !== afterPool.length) return false;
    const counts = new Map<string, number>();
    for (const card of beforePool) counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
    for (const card of afterPool) {
      const remaining = counts.get(card.id) ?? 0;
      if (remaining === 0) return false;
      counts.set(card.id, remaining - 1);
    }
  }
  return true;
}

export { snapshotRoom, COMPARED_ZONES };
