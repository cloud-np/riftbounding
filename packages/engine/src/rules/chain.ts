/**
 * Chain + conquer/showdown assist state machine — original module 487939
 * (25vik2nxxo51i.js:9152-9964). All functions mutate the draft room.
 */
import type {
  BattlefieldPresenceMap,
  BattlefieldZone,
  CardInstance,
  ChainEntry,
  Room,
} from "@rift/protocol";
import {
  battlefieldZones,
  clearPileCard,
  deckPeekZone,
  hasUnitAt,
  isBattlefieldZone,
  isTokenOrDuplicate,
  moveCardCleanup,
  pruneDeckPeek,
  recycledBottomCount,
  resetDeckPeek,
  setRecycledBottomCount,
  zoneList,
} from "../state/board";
import {
  allyControlsZone,
  beginningStepAllyControls,
  battlefieldCount,
  clampScoreForVictory,
  entityScore,
  isTeamOrFfa,
  markBattlefieldScored,
  markPostBeginningPresence,
  seatRelationship,
  setEntityScore,
  turnOrderStartingAt,
} from "../state/selectors";
import { isSpellCardType, isUnitCardType, isTimeWarp } from "../catalog";
import {
  allActiveBattlefieldsWouldBeScored,
  battlefieldLabel,
  resolveConquerDecision,
  scoredThisTurn,
  settleRoom,
  tiannaBlocksPointGain,
  victoryScoreForRoom,
} from "./victory";
import { variantForRoom } from "../state/variant";
import { advanceIfActivePlayerLeft, type LogSink } from "./turn";
import type { HandlerContext } from "../types";
import { logDraft } from "../log/entries";

/* ------------------------------------------------------------------ small helpers */

export function clearPassesFocus(room: Room): Room {
  let changed = false;
  const entries = room.chainEntries.map((entry) => {
    if (entry.passesShowdownFocusOnResolution !== true) return entry;
    changed = true;
    return { ...entry, passesShowdownFocusOnResolution: false };
  });
  if (changed) room.chainEntries = entries;
  return room;
}

export function clearOptionalPasses(room: Room): Room {
  const assist = room.pendingBattlefieldConquerAssist;
  if (!assist || (assist.optionalPassedPlayerIds?.length ?? 0) === 0) return room;
  room.pendingBattlefieldConquerAssist = { ...assist, optionalPassedPlayerIds: undefined };
  return room;
}

/** 487939 `e`: advance the stage once the focus-holder's entry resolves. */
export function advanceAssistStage(assist: NonNullable<Room["pendingBattlefieldConquerAssist"]>) {
  return assist.actualDefenderPlayerId && assist.stage === "attacker_focus"
    ? { ...assist, stage: "defender_response" as const, attackerCanPassFocus: true }
    : assist;
}

/** 487939 `p`: battlefield zones a resolving card actually enters. */
export function unitZones(card: CardInstance, zones: readonly string[]): BattlefieldZone[] {
  return isUnitCardType(card) ? (zones.filter(isBattlefieldZone) as BattlefieldZone[]) : [];
}

/* ------------------------------------------------------------------ assist normalization */

/** 487939 `i` inner: recompute multiplayer defender/optional-pass state. */
function normalizeMultiplayerAssist(
  room: Room,
  assist: NonNullable<Room["pendingBattlefieldConquerAssist"]>,
): NonNullable<Room["pendingBattlefieldConquerAssist"]> {
  if (!isTeamOrFfa(room)) return assist;
  const order = turnOrderStartingAt(room, assist.attackerPlayerId);
  const attackerIndex = room.players.findIndex((player) => player.id === assist.attackerPlayerId);
  const defender =
    order
      .slice(1)
      .map((id) => room.players.find((player) => player.id === id) ?? null)
      .find((player) => {
        if (!player?.board || !hasUnitAt(player.board, assist.zone)) return false;
        const index = room.players.findIndex((candidate) => candidate.id === player.id);
        return playerRelation(room, attackerIndex, index) === "opponent";
      }) ?? null;
  const defenderId = defender?.id;
  const defenderChanged = assist.actualDefenderPlayerId !== defenderId;
  const stage = defenderId
    ? defenderChanged
      ? "defender_response"
      : assist.stage
    : "attacker_confirm_conquer";
  const otherIds = new Set(
    room.players
      .filter(
        (player) =>
          !!player.board &&
          !player.leftAt &&
          player.id !== assist.attackerPlayerId &&
          player.id !== defenderId,
      )
      .map((player) => player.id),
  );
  const optionalPassed = defenderChanged
    ? []
    : (assist.optionalPassedPlayerIds ?? []).filter((id) => otherIds.has(id));
  const resolvedDefender = defenderId ?? assist.defenderPlayerId;
  const canPassFocus = !!defenderId && (stage !== "attacker_confirm_conquer" || assist.attackerCanPassFocus);
  if (
    assist.actualDefenderPlayerId === defenderId &&
    assist.defenderPlayerId === resolvedDefender &&
    assist.stage === stage &&
    assist.attackerCanPassFocus === canPassFocus &&
    arraysEqual(assist.optionalPassedPlayerIds, optionalPassed)
  ) {
    return assist;
  }
  return {
    ...assist,
    defenderPlayerId: resolvedDefender,
    actualDefenderPlayerId: defenderId,
    stage,
    optionalPassedPlayerIds: optionalPassed.length > 0 ? optionalPassed : undefined,
    attackerCanPassFocus: canPassFocus,
  };
}

function arraysEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function playerRelation(room: Room, perspective: number, other: number): "self" | "ally" | "opponent" {
  if (perspective === other) return "self";
  return seatRelationship(room, perspective, other);
}

/* ------------------------------------------------------------------ assist lifecycle */

/** 487939 `v` / `n`: refresh/dismiss/advance an active assist. */
export function refreshConquerAssist(room: Room): Room {
  const assist = room.pendingBattlefieldConquerAssist;
  if (!assist) return room;
  const attackerIndex = room.players.findIndex((player) => player.id === assist.attackerPlayerId);
  if (attackerIndex >= 0 && allyControlsZone(room, attackerIndex, assist.zone)) {
    return dismissConquerAssist(room, assist.zone);
  }
  let normalized = assist;
  if (
    room.roomMode === "solo_lab" &&
    (assist.stage !== "attacker_confirm_conquer" || assist.attackerCanPassFocus !== false)
  ) {
    normalized = { ...assist, stage: "attacker_confirm_conquer", attackerCanPassFocus: false };
  }
  const next = normalizeMultiplayerAssist(room, normalized);
  if (next !== assist) room.pendingBattlefieldConquerAssist = next;
  const attacker = room.players.find((player) => player.id === next.attackerPlayerId) ?? null;
  const defender = room.players.find((player) => player.id === next.defenderPlayerId) ?? null;
  if (
    !attacker?.board ||
    !defender ||
    (typeof next.turnNumber === "number" &&
      typeof room.turnNumber === "number" &&
      next.turnNumber !== room.turnNumber)
  ) {
    return dismissConquerAssist(room, next.zone);
  }
  if (!hasUnitAt(attacker.board, next.zone)) {
    const defenderHas = !!defender.board && hasUnitAt(defender.board, next.zone);
    if (next.defenderSideWasEmptyAtStart === true && defenderHas) {
      room.pendingBattlefieldConquerAssist = {
        zone: next.zone,
        attackerPlayerId: next.defenderPlayerId,
        defenderPlayerId: next.attackerPlayerId,
        stage: "attacker_confirm_conquer",
        attackerCanPassFocus: false,
        turnNumber: next.turnNumber,
      };
      return finalizeAssistIfReady(room);
    }
    return dismissConquerAssist(room, next.zone);
  }
  return room;
}

/** 487939 `k`: dismiss the assist and retry the next battlefield. */
export function dismissConquerAssist(room: Room, zone: BattlefieldZone, log?: LogSink): Room {
  const excluded = new Set([...(room.battlefieldConquerAssistExcludedZones ?? []), zone]);
  clearPassesFocus(room);
  room.pendingBattlefieldConquerAssist = undefined;
  room.battlefieldConquerAssistExcludedZones = undefined;
  log?.(logDraft("dismissedShowdown", { zone: battlefieldLabel(room, zone) }, { actionKind: "battle" }));
  const settled = room.chainEntries.length > 0 ? room : settleRoom(room);
  const triggered = tryTriggerConquerAssist(settled, {
    excludedZones: excluded,
    carryExcludedZones: excluded,
  });
  return advanceIfActivePlayerLeft(triggered);
}

/** 487939 `C` / `m`: confirm the conquer → score/draw/plain. */
export function resolveConquer(
  room: Room,
  playerIndex: number,
  assist: NonNullable<Room["pendingBattlefieldConquerAssist"]>,
  log?: LogSink,
): Room {
  const attackerId = assist.attackerPlayerId;
  if (beginningStepAllyControls(room, playerIndex, assist.zone)) {
    return dismissConquerAssist(room, assist.zone, log);
  }
  const alreadyScored = scoredThisTurn(
    room.battlefieldScoredThisTurnByPlayer?.[attackerId],
    assist.zone,
    room.turnNumber,
  );
  markPostBeginningPresence(room, attackerId, assist.zone);
  markBattlefieldScored(room, attackerId, assist.zone);
  const board = room.players[playerIndex]?.board;
  if (!board) return dismissConquerAssist(room, assist.zone, log);
  const victoryScore = victoryScoreForRoom(room);
  const currentPoints = entityScore(room, attackerId);
  const allWouldBeScored = allActiveBattlefieldsWouldBeScored({
    snapshot: room.battlefieldScoredThisTurnByPlayer?.[attackerId],
    zone: assist.zone,
    turnNumber: room.turnNumber,
    sharedBattlefieldToken: room.sharedBattlefieldToken,
    normalBattlefieldCount: battlefieldCount(room),
    currentPoints,
    victoryScore,
    playerId: attackerId,
    playerIdsInSeatOrder: room.players.map((player) => player.id),
    gameVariant: room.gameVariant,
    teamIdByPlayerId: room.teamIdByPlayerId,
    beginningBattlefieldUnitPresenceByPlayer: room.beginningBattlefieldUnitPresenceByPlayer,
    activeTurnPlayerId: room.activeTurnPlayerId,
  });
  const decision = resolveConquerDecision({
    currentPoints,
    allActiveBattlefieldsWouldBeScored: allWouldBeScored,
    victoryScore,
    canGainPoint: !tiannaBlocksPointGain(room, attackerId),
    alreadyScoredThisTurn: alreadyScored,
  });
  const zoneLabel = battlefieldLabel(room, assist.zone);
  if (decision.drawCard) {
    if (board.deck.length === 0) return dismissConquerAssist(room, assist.zone, log);
    const bottom = recycledBottomCount(board);
    const card = board.deck.pop();
    if (card && !isTokenOrDuplicate(card)) board.hand.push(card);
    setRecycledBottomCount(board, Math.min(bottom, board.deck.length));
    log?.(logDraft("conqueredAndDrew", { zone: zoneLabel, count: 1 }, {
      authorPlayerId: attackerId,
      actionKind: "battle",
    }));
    return dismissConquerAssist(room, assist.zone, log);
  }
  if (!decision.gainPoint) {
    log?.(logDraft("conquered", { zone: zoneLabel }, { authorPlayerId: attackerId, actionKind: "battle" }));
    return dismissConquerAssist(room, assist.zone, log);
  }
  const next = clampScoreForVictory(room, currentPoints + 1, victoryScore);
  if (next !== currentPoints) setEntityScore(room, attackerId, next);
  log?.(logDraft("conqueredAndScored", {
    zone: zoneLabel,
    count: next - currentPoints,
  }, { authorPlayerId: attackerId, actionKind: "battle" }));
  return dismissConquerAssist(room, assist.zone, log);
}

/** 487939 `S` / `b`: auto-resolve a confirm-stage assist that already scored this turn. */
export function finalizeAssistIfReady(room: Room, log?: LogSink): Room {
  const assist = room.pendingBattlefieldConquerAssist;
  if (!assist || assist.stage !== "attacker_confirm_conquer" || assist.attackerCanPassFocus !== false) {
    return room;
  }
  const index = room.players.findIndex((player) => player.id === assist.attackerPlayerId);
  if (index < 0) return room;
  const alreadyScored = scoredThisTurn(
    room.battlefieldScoredThisTurnByPlayer?.[assist.attackerPlayerId],
    assist.zone,
    room.turnNumber,
  );
  return alreadyScored ? resolveConquer(room, index, assist, log) : room;
}

/* ------------------------------------------------------------------ assist triggers */

function assistCandidates(input: {
  preferredAttackerId?: string;
  activeTurnPlayerId?: string;
  playerIds: string[];
}): string[] {
  const out: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !out.includes(id)) out.push(id);
  };
  add(input.preferredAttackerId);
  add(input.activeTurnPlayerId);
  for (const id of input.playerIds) add(id);
  return out;
}

/** 856018 `j`: preferred zone first, then the rest of the battlefield list. */
function assistTargets(
  preferredZone: BattlefieldZone | undefined,
  room: Room,
): BattlefieldZone[] {
  const zones = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
  return preferredZone ? [preferredZone, ...zones.filter((zone) => zone !== preferredZone)] : zones;
}

/** 487939 `w` / `Y`: try to start a conquer assist at a battlefield. */
export function tryTriggerConquerAssist(
  room: Room,
  options: {
    preferredAttackerId?: string;
    preferredZone?: BattlefieldZone;
    excludedZones?: ReadonlySet<BattlefieldZone>;
    carryExcludedZones?: ReadonlySet<BattlefieldZone>;
  } = {},
  log?: LogSink,
): Room {
  if (room.pendingBattlefieldConquerAssist) return room;
  const carry =
    options.carryExcludedZones ??
    (room.battlefieldConquerAssistExcludedZones?.length
      ? new Set(room.battlefieldConquerAssistExcludedZones)
      : undefined);
  const excluded =
    options.excludedZones ??
    (carry ? new Set([...carry].filter((zone) => zone !== options.preferredZone)) : undefined);
  const targets = assistTargets(options.preferredZone, room);
  for (const attackerId of assistCandidates({
    preferredAttackerId: options.preferredAttackerId,
    activeTurnPlayerId: room.activeTurnPlayerId,
    playerIds: room.players.map((player) => player.id),
  })) {
    for (const zone of targets) {
      if (excluded?.has(zone)) continue;
      const assist = createAssist(room, attackerId, zone);
      if (!assist) continue;
      room.pendingBattlefieldConquerAssist = assist;
      room.battlefieldConquerAssistExcludedZones = filterZoneSet(
        carry,
        room,
      );
      return finalizeAssistIfReady(room, log);
    }
  }
  if (carry) {
    const next = filterZoneSet(carry, room);
    const current = filterZoneSet(
      room.battlefieldConquerAssistExcludedZones
        ? new Set(room.battlefieldConquerAssistExcludedZones)
        : undefined,
      room,
    );
    if (!arraysEqual(next, current)) room.battlefieldConquerAssistExcludedZones = next;
  }
  return room;
}

function filterZoneSet(
  zones: ReadonlySet<BattlefieldZone> | undefined,
  room: Room,
): BattlefieldZone[] | undefined {
  if (!zones) return undefined;
  const active = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
  const filtered = active.filter((zone) => zones.has(zone));
  return filtered.length > 0 ? filtered : undefined;
}

/** 487939 inner: build a new assist for attacker/zone, or null. */
function createAssist(room: Room, attackerId: string, zone: BattlefieldZone): Room["pendingBattlefieldConquerAssist"] | null {
  const attacker = room.players.find((player) => player.id === attackerId) ?? null;
  if (!attacker?.board) return null;
  const order = turnOrderStartingAt(room, attackerId);
  const attackerIndex = room.players.findIndex((player) => player.id === attackerId);
  const opponents = order
    .slice(1)
    .map((id) => room.players.find((player) => player.id === id) ?? null)
    .filter((player): player is Room["players"][number] => {
      if (!player) return false;
      const index = room.players.findIndex((candidate) => candidate.id === player.id);
      return playerRelation(room, attackerIndex, index) === "opponent";
    });
  const defenderWithUnit = opponents.find((player) => !!player.board && hasUnitAt(player.board, zone)) ?? null;
  const target = defenderWithUnit ?? opponents[0] ?? null;
  const singlePlayerNoDefender = room.roomMode === "single_player" && !target;
  const autoConfirm = singlePlayerNoDefender || room.roomMode === "solo_lab";
  if (!target && !singlePlayerNoDefender) return null;
  const defenderHadUnit = !!target?.board && hasUnitAt(target.board, zone);
  const attackerHasUnit = hasUnitAt(attacker.board, zone);
  const beginning = room.postBeginningBattlefieldUnitPresenceByPlayer?.[attackerId];
  const newlyArrived = attackerHasUnit && !!beginning && !beginning[zone];
  if (allyControlsZone(room, attackerIndex, zone) || !newlyArrived) return null;
  const variant = variantForRoom(room);
  return {
    zone,
    attackerPlayerId: attackerId,
    defenderPlayerId: target?.id ?? attacker.id,
    ...(variant !== "duel" && defenderWithUnit ? { actualDefenderPlayerId: defenderWithUnit.id } : {}),
    stage:
      autoConfirm || (variant !== "duel" && !defenderWithUnit)
        ? "attacker_confirm_conquer"
        : "attacker_focus",
    attackerCanPassFocus: !autoConfirm && (variant === "duel" || !!defenderWithUnit),
    defenderSideWasEmptyAtStart: !defenderHadUnit || undefined,
    turnNumber: room.turnNumber,
  };
}

/** 487939 `G`: trigger an assist after a unit moves between zones. */
export function triggerShowdownAfterMove(
  room: Room,
  playerIndex: number,
  from: string,
  to: string,
  card: CardInstance,
  log?: LogSink,
): Room {
  if (from === to || !isUnitCardType(card)) return room;
  const destination = isBattlefieldZone(to) ? to : undefined;
  const source = from !== "deck" && isBattlefieldZone(from) ? from : undefined;
  const zone = destination ?? source;
  if (!zone) return room;
  const player = room.players[playerIndex];
  if (!player?.board) return room;
  clearExcluded(room, zone);
  if (room.pendingBattlefieldConquerAssist) return room;
  const excluded = room.battlefieldConquerAssistExcludedZones;
  const set = excluded && excluded.length > 0 ? new Set(excluded) : undefined;
  return tryTriggerConquerAssist(
    room,
    {
      preferredAttackerId: destination ? player.id : undefined,
      preferredZone: zone,
      excludedZones: set,
      carryExcludedZones: set,
    },
    log,
  );
}

function clearExcluded(room: Room, zone: BattlefieldZone): void {
  const excluded = room.battlefieldConquerAssistExcludedZones ?? [];
  const filtered = excluded.filter((item) => item !== zone);
  if (filtered.length !== excluded.length) {
    room.battlefieldConquerAssistExcludedZones = filtered.length > 0 ? filtered : undefined;
  }
}

/** 487939 `h`: clear stale post-beginning presence after units leave. */
export function cleanupPostBeginningPresence(room: Room): Room {
  if (room.activeTurnStep === "beginning") return room;
  const presence = room.postBeginningBattlefieldUnitPresenceByPlayer;
  if (!presence) return room;
  const zones = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
  let changed = false;
  const next = { ...presence };
  for (const player of room.players) {
    const map = presence[player.id];
    if (!map || !player.board) continue;
    const copy = { ...map };
    let playerChanged = false;
    for (const zone of zones) {
      if (map[zone] && room.pendingBattlefieldConquerAssist?.zone !== zone && !hasUnitAt(player.board, zone)) {
        copy[zone] = false;
        playerChanged = true;
      }
    }
    if (playerChanged) {
      next[player.id] = copy;
      changed = true;
    }
  }
  if (changed) room.postBeginningBattlefieldUnitPresenceByPlayer = next;
  return room;
}

/** 487939 `Z`: refresh the assist after a chain entry resolves. */
export function afterChainResolved(room: Room, zones: BattlefieldZone[]): Room {
  const refreshed = refreshConquerAssist(room);
  const zone = refreshed.pendingBattlefieldConquerAssist?.zone;
  return zone && zones.includes(zone) ? clearOptionalPasses(refreshed) : refreshed;
}

/* ------------------------------------------------------------------ auto-chain */

/** 487939 `y`: put a "when you play me" card on the chain automatically. */
export function autoChainOnPlay(
  room: Room,
  playerIndex: number,
  card: CardInstance,
  fromZone: string,
  context: HandlerContext,
): Room {
  const player = room.players[playerIndex];
  if (!player || !player.board) return room;
  const id = context.idFactory("chain");
  if (room.chainEntries.some((entry) => entry.id === id)) return room;
  room.chainEntries.unshift({
    id,
    card: { ...card, id, exhausted: false },
    addedAt: context.now,
    fromZone: fromZone as ChainEntry["fromZone"],
    sourceCardId: card.id,
    byPlayerId: player.id,
    byPlayerName: player.name,
    // 487939 `y` verbatim: `(chain not empty || no pending assist) && undefined`
    // evaluates to `false` only when the chain was empty *and* a conquer assist is pending.
    ...(room.chainEntries.length === 0 && room.pendingBattlefieldConquerAssist
      ? { passesShowdownFocusOnResolution: false }
      : {}),
  });
  room.chainResolveVotes = [];
  return clearOptionalPasses(room);
}

/* ------------------------------------------------------------------ chain resolve */

/** 487939 `O`: does the pending assist require the actor's focus? */
export function assistRequiresFocus(room: Room, playerId: string): boolean {
  const assist = room.pendingBattlefieldConquerAssist;
  if (!assist) return false;
  return (
    !isTeamOrFfa(room) ||
    (assist.stage === "attacker_focus" &&
      assist.attackerPlayerId === playerId &&
      !!assist.actualDefenderPlayerId)
  );
}

/** 70094 `c`: resolve every chain entry (used by end_turn / end_beginning_phase). */
export function autoResolveChain(room: Room): Room {
  room.pendingBattlefieldConquerAssist = undefined;
  room.battlefieldConquerAssistExcludedZones = undefined;
  while (room.chainEntries.length > 0) {
    const entry = room.chainEntries[0];
    if (!entry) break;
    const before = room.chainEntries.length;
    resolveChainEntry(room, entry.byPlayerId, entry.id);
    if (room.chainEntries.length === before) break;
  }
  room.chainEntries = [];
  room.chainResolveVotes = [];
  room.pendingBattlefieldConquerAssist = undefined;
  room.battlefieldConquerAssistExcludedZones = undefined;
  return room;
}

/**
 * cU `chain_resolve`. Mutates the room and returns it.
 */
export function resolveChainEntry(
  room: Room,
  actorId: string,
  entryId: string,
  to?: string,
  log?: LogSink,
): Room {
  if (room.chainEntries.length === 0) return room;
  const top = room.chainEntries[0];
  if (!top || top.id !== entryId || top.byPlayerId !== actorId) return room;
  const rest = room.chainEntries.slice(1);
  if (isTeamOrFfa(room) && top.passesShowdownFocusOnResolution === true && rest.length > 0) {
    const last = rest[rest.length - 1];
    if (last && last.passesShowdownFocusOnResolution !== true) {
      rest[rest.length - 1] = { ...last, passesShowdownFocusOnResolution: true };
    }
  }
  const destination = to ?? (top.flowEnabled && isSpellCardType(top.card) ? "banished" : "trash");
  const destinationZone = destination === "hand" ? "hand" : destination === "banished" ? "banished" : "trash";
  const previousAssist = room.pendingBattlefieldConquerAssist;

  if (isSpellCardType(top.card) && !isTokenOrDuplicate(top.card)) {
    const playerIndex = room.players.findIndex((player) => player.id === top.byPlayerId);
    if (playerIndex >= 0) {
      const sourceBoard = room.players[playerIndex]?.board;
      if (sourceBoard) {
        const targetIndex = ownerIndexFor(room, top.card, top.byPlayerId, playerIndex);
        const targetBoard = room.players[targetIndex]?.board;
        if (!targetBoard) return room;
        const fromZone = top.fromZone;
        if (fromZone !== "battlefieldMarker") {
          const moved = { ...top.card, id: top.sourceCardId ?? top.card.id };
          if (destination === "deck_top" || destination === "deck_bottom") {
            if (moved.hidden) {
              delete moved.hidden;
              delete moved.revealedToPlayerIds;
              delete moved.revealedToOpponent;
            }
            moved.exhausted = false;
            clearPileCardForDeck(moved);
            const bottom = recycledBottomCount(targetBoard);
            if (destination === "deck_top") targetBoard.deck.push(moved);
            else targetBoard.deck.unshift(moved);
            setRecycledBottomCount(targetBoard, bottom + (destination !== "deck_top" ? 1 : 0));
            pruneDeckPeek(targetBoard);
            if (deckPeekZone(targetBoard.deckPeek) === "deck") resetDeckPeek(targetBoard);
          } else {
            moveCardCleanup(moved, fromZone, destinationZone);
            if (fromZone === destinationZone) {
              delete moved.revealedToPlayerIds;
              delete moved.revealedToOpponent;
            }
            zoneList(targetBoard, destinationZone).push(moved);
          }
        }
      }
    }
  }

  room.chainEntries = rest;
  room.chainResolveVotes = [];
  log?.(logDraft("chainResolved", { card: top.card.name }, {
    authorPlayerId: top.byPlayerId,
    actionKind: "spell",
  }));

  const refreshed = refreshConquerAssist(room);
  if (rest.length > 0) return refreshed;

  const settled = settleRoom(refreshed);
  const excluded = settled.battlefieldConquerAssistExcludedZones?.length
    ? new Set(settled.battlefieldConquerAssistExcludedZones)
    : undefined;
  const triggered = settled.pendingBattlefieldConquerAssist
    ? settled
    : tryTriggerConquerAssist(settled, { excludedZones: excluded, carryExcludedZones: excluded }, log);
  const assist = triggered.pendingBattlefieldConquerAssist;
  if (assist) {
    if (
      previousAssist?.zone === assist.zone &&
      previousAssist.attackerPlayerId === assist.attackerPlayerId &&
      previousAssist.turnNumber === assist.turnNumber &&
      top.passesShowdownFocusOnResolution === true &&
      isTeamOrFfa(triggered)
    ) {
      triggered.pendingBattlefieldConquerAssist = advanceAssistStage(assist);
    }
    return triggered;
  }
  return advanceIfActivePlayerLeft(triggered, log);
}

function ownerIndexFor(room: Room, card: CardInstance, currentPlayerId: string, currentIndex: number): number {
  const ownerId = typeof card.ownerPlayerId === "string" && card.ownerPlayerId.trim()
    ? card.ownerPlayerId
    : currentPlayerId;
  const index = room.players.findIndex((player) => player.id === ownerId);
  return index >= 0 ? index : currentIndex;
}

function clearPileCardForDeck(card: CardInstance): void {
  clearPileCard(card);
  delete card.banishedByCardId;
  delete card.banishedByHiddenSourcePlayerId;
  delete card.banishedUntilEndingPlayerId;
}

/* ------------------------------------------------------------------ battlefield actions */

function requireAssist(room: Room, zone: string) {
  const assist = room.pendingBattlefieldConquerAssist;
  return assist && assist.zone === zone ? assist : null;
}

/** cM handler body for battlefield_conquer_* actions. */
export function applyBattlefieldConquerAction(
  room: Room,
  playerIndex: number,
  action: { type: string; zone?: string; passed?: unknown },
  log?: LogSink,
): Room {
  const player = room.players[playerIndex];
  if (!player) return room;
  const refreshed = refreshConquerAssist(room);
  const assist = action.zone ? requireAssist(refreshed, action.zone) : null;
  if (!assist) return refreshed;
  const multiplayer = isTeamOrFfa(refreshed);

  if (action.type === "battlefield_conquer_set_optional_pass") {
    if (
      !multiplayer ||
      refreshed.chainEntries.length > 0 ||
      typeof action.passed !== "boolean" ||
      player.leftAt ||
      !player.board ||
      player.id === assist.attackerPlayerId ||
      player.id === assist.actualDefenderPlayerId
    ) {
      return refreshed;
    }
    const passed = assist.optionalPassedPlayerIds ?? [];
    if (passed.includes(player.id) === action.passed) return refreshed;
    const next = action.passed ? [...passed, player.id] : passed.filter((id) => id !== player.id);
    refreshed.pendingBattlefieldConquerAssist = {
      ...assist,
      optionalPassedPlayerIds: next.length > 0 ? next : undefined,
    };
    return refreshed;
  }

  if (action.type === "battlefield_conquer_dismiss") {
    if (multiplayer && assist.attackerPlayerId !== player.id) return refreshed;
    return dismissConquerAssist(refreshed, assist.zone, log);
  }

  if (
    refreshed.roomMode === "solo_lab" &&
    (action.type === "battlefield_conquer_pass_focus" ||
      action.type === "battlefield_conquer_pass_response")
  ) {
    return refreshed;
  }

  if (action.type === "battlefield_conquer_pass_focus") {
    const defenderId = multiplayer ? assist.actualDefenderPlayerId : assist.defenderPlayerId;
    if (
      assist.attackerPlayerId === player.id &&
      defenderId &&
      (assist.stage === "attacker_focus" ||
        (assist.stage === "attacker_confirm_conquer" &&
          (!multiplayer || assist.attackerCanPassFocus !== false)))
    ) {
      clearPassesFocus(refreshed);
      refreshed.pendingBattlefieldConquerAssist = {
        ...assist,
        stage: "defender_response",
        attackerCanPassFocus: true,
      };
      log?.(logDraft("passedFocus", undefined, { authorPlayerId: player.id, actionKind: "battle" }));
      return refreshed;
    }
    if (defenderId === player.id && assist.stage === "defender_response") {
      clearPassesFocus(refreshed);
      refreshed.pendingBattlefieldConquerAssist = {
        ...assist,
        stage: "attacker_confirm_conquer",
        attackerCanPassFocus: true,
      };
      log?.(logDraft("passedFocus", undefined, { authorPlayerId: player.id, actionKind: "battle" }));
      return refreshed;
    }
    return refreshed;
  }

  if (action.type === "battlefield_conquer_pass_response") {
    const defenderId = multiplayer ? assist.actualDefenderPlayerId : assist.defenderPlayerId;
    if (assist.stage !== "defender_response" || defenderId !== player.id) return refreshed;
    clearPassesFocus(refreshed);
    refreshed.pendingBattlefieldConquerAssist = {
      ...assist,
      stage: "attacker_confirm_conquer",
      attackerCanPassFocus: false,
    };
    log?.(logDraft("endedShowdownResponses", { zone: battlefieldLabel(refreshed, assist.zone) }, {
      authorPlayerId: player.id,
      actionKind: "battle",
    }));
    return finalizeAssistIfReady(refreshed, log);
  }

  if (assist.stage !== "attacker_confirm_conquer" || assist.attackerPlayerId !== player.id) {
    return refreshed;
  }
  return resolveConquer(refreshed, playerIndex, assist, log);
}

/** 408727 `m`: set/cancel a Time Warp extra turn. */
export function setExtraTurn(room: Room, playerIndex: number, entryId: string, enabled: boolean): Room {
  const player = room.players[playerIndex];
  if (!player || player.leftAt) return room;
  const queue = room.pendingExtraTurns ?? [];
  const existing = queue.find((entry) => entry.sourceEntryId === entryId);
  if (!enabled) {
    if (!existing || existing.playerId !== player.id) return room;
    const rest = queue.filter((entry) => entry !== existing);
    room.pendingExtraTurns = rest.length > 0 ? rest : undefined;
    return room;
  }
  if (existing || !room.activeTurnPlayerId) return room;
  const entry = room.chainEntries.find((candidate) => candidate.id === entryId);
  if (!entry || entry.byPlayerId !== player.id || !isTimeWarp(entry.card)) return room;
  room.pendingExtraTurns = [{ sourceEntryId: entry.id, playerId: player.id }, ...queue];
  return room;
}

/** Used by action handlers for the chain overflow message. */
export const CHAIN_LIMIT = 20;
