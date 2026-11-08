/**
 * Room selectors ported from module 357603 (`dq`) + 650417 (board settings) and the
 * 822434 presence helpers. Pure functions over a Room.
 */
import type {
  BattlefieldPresenceMap,
  BattlefieldZone,
  BoardSettings,
  CardInstance,
  ChainEntry,
  Room,
} from "@rift/protocol";
import {
  battlefieldPresence,
  battlefieldZones,
  emptyPresence,
  hasUnitAt,
  isBattlefieldZone,
  isFieldZone,
  readZoneList,
  zoneList,
} from "./board";
import {
  battlefieldContributorIds,
  entityGroups,
  relationship,
  turnOrderForRoom,
  variantForRoom,
  VARIANT_RULES,
} from "./variant";

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  showLegendXpCounter: false,
  stopAtBeginningPhase: false,
  skipDrawPhase: false,
  autoScoreFromHold: true,
};

/** 650417 `c`: merge stored settings with defaults. */
export function normalizeBoardSettings(
  value: Partial<BoardSettings> | undefined,
  fallback: BoardSettings = DEFAULT_BOARD_SETTINGS,
): BoardSettings {
  const input = value && typeof value === "object" ? value : {};
  return {
    showLegendXpCounter:
      typeof input.showLegendXpCounter === "boolean"
        ? input.showLegendXpCounter
        : (fallback.showLegendXpCounter ?? false),
    stopAtBeginningPhase:
      typeof input.stopAtBeginningPhase === "boolean"
        ? input.stopAtBeginningPhase
        : (fallback.stopAtBeginningPhase ?? false),
    skipDrawPhase:
      typeof input.skipDrawPhase === "boolean" ? input.skipDrawPhase : (fallback.skipDrawPhase ?? false),
    autoScoreFromHold:
      typeof input.autoScoreFromHold === "boolean"
        ? input.autoScoreFromHold
        : (fallback.autoScoreFromHold ?? true),
  };
}

/** 357603 `c`: settings for one player. */
export function boardSettingsFor(room: Room, playerId: string): BoardSettings {
  return normalizeBoardSettings(room.boardSettingsByPlayerId?.[playerId]);
}

/** 357603 `s` / `G`: settings for every player. */
export function boardSettingsByPlayer(room: Room): Record<string, BoardSettings> {
  return Object.fromEntries(room.players.map((player) => [player.id, boardSettingsFor(room, player.id)]));
}

/** 357603 `o`: update one player's settings; unchanged when all four flags match. */
export function updateBoardSettings(room: Room, playerId: string, patch: Partial<BoardSettings>): Room {
  const current = boardSettingsFor(room, playerId);
  const next = { ...current, ...patch };
  if (
    current.showLegendXpCounter === next.showLegendXpCounter &&
    current.stopAtBeginningPhase === next.stopAtBeginningPhase &&
    current.skipDrawPhase === next.skipDrawPhase &&
    current.autoScoreFromHold === next.autoScoreFromHold
  ) {
    return room;
  }
  room.boardSettingsByPlayerId = { ...boardSettingsByPlayer(room), [playerId]: next };
  return room;
}

/** 357603 `f` / `m`: room variant. */
export function roomVariant(room: Room) {
  return variantForRoom(room);
}

/** 357603 `h` / `R`: number of battlefields in play. */
export function battlefieldCount(room: Pick<Room, "gameVariant" | "players">): 2 | 3 {
  return roomVariant({ gameVariant: room.gameVariant, players: room.players } as Room) === "duel" ? 2 : 3;
}

/** 357603 `p` / `T`: variant is non-duel. */
export function isMultiplayerVariant(room: Room): boolean {
  return roomVariant(room) !== "duel";
}

/** 357603 `I` / `H`: player index by id. */
export function playerIndexById(room: Room, playerId: string): number {
  return room.players.findIndex((player) => player.id === playerId);
}

/** 357603 `k`: entity group ids containing the player. */
export function entityPlayerIds(room: Room, playerId: string): string[] {
  return (
    entityGroups({
      variant: roomVariant(room),
      playerIdsInSeatOrder: room.players.map((player) => player.id),
      teamIdByPlayerId: room.teamIdByPlayerId,
    }).find((entity) => entity.playerIds.includes(playerId))?.playerIds ?? []
  );
}

/** 357603 `j`: entity score (max of the team in 2v2). */
export function entityScore(room: Room, playerId: string): number {
  let score: number | undefined;
  const ids = new Set(entityPlayerIds(room, playerId));
  for (const player of room.players) {
    if (!ids.has(player.id) || !player.board) continue;
    score = score === undefined ? player.board.score : Math.max(score, player.board.score);
  }
  return score ?? 0;
}

/** 357603 `y` / `Q`: clamp a score to variant bounds. */
export function clampScore(room: Room, score: number): number {
  // 357603 `y`: duel scores go down to -99, multiplayer scores stop at 0.
  return Math.max(roomVariant(room) === "duel" ? -99 : 0, Math.min(99, score));
}

/** 357603 `$`: clamp a proposed score, capping at victory score in duel. */
export function clampScoreForVictory(room: Room, score: number, victoryScore: number): number {
  const value =
    roomVariant(room) === "duel" ? Math.min(Math.trunc(score), victoryScore) : score;
  return clampScore(room, value);
}

/** 357603 `b`: clamp 0..99. */
export function clampPositive(value: number): number {
  return Math.max(0, Math.min(99, Math.trunc(value)));
}

/** 357603 `k`: set an entity's score (teams share the score). */
export function setEntityScore(room: Room, playerId: string, score: number): Room {
  const ids = new Set(entityPlayerIds(room, playerId));
  const clamped = clampScore(room, score);
  let changed = false;
  const players = room.players.map((player) => {
    if (ids.has(player.id) && player.board && player.board.score !== clamped) {
      changed = true;
      return { ...player, board: { ...player.board, score: clamped } };
    }
    return player;
  });
  if (!changed) return room;
  room.players = players;
  return room;
}

/** 357603 `g` / `_`: relationship between two seat indexes. */
export function seatRelationship(room: Room, perspective: number, other: number) {
  const player = room.players[perspective];
  const otherPlayer = room.players[other];
  return relationship({
    variant: roomVariant(room),
    perspectivePlayerIndex: perspective,
    otherPlayerIndex: other,
    perspectiveTeamId: player ? room.teamIdByPlayerId?.[player.id] : undefined,
    otherTeamId: otherPlayer ? room.teamIdByPlayerId?.[otherPlayer.id] : undefined,
  });
}

/** 357603 `P` / `A`: allied player indexes with a board. */
export function allyIndexes(room: Room, playerIndex: number): number[] {
  return room.players.flatMap((player, index) =>
    player.board && !player.leftAt && seatRelationship(room, playerIndex, index) === "ally" ? [index] : [],
  );
}

/** 357603 `A`: allied player ids. */
export function allyPlayerIds(room: Room, playerIndex: number): string[] {
  return allyIndexes(room, playerIndex).flatMap((index) => room.players[index]?.id ?? []);
}

/** 357603 `C` / `D`: does an ally control a unit at the zone? */
export function allyControlsZone(room: Room, playerIndex: number, zone: string): boolean {
  return allyIndexes(room, playerIndex).some((index) => {
    const board = room.players[index]?.board;
    return !!board && hasUnitAt(board, zone);
  });
}

/** 357603 `N`: beginning-step ally control blocks team scoring. */
export function beginningStepAllyControls(room: Room, playerIndex: number, zone: string): boolean {
  const activeIndex = room.players.findIndex((player) => player.id === room.activeTurnPlayerId);
  if (activeIndex < 0) return false;
  if (playerIndex !== activeIndex && seatRelationship(room, playerIndex, activeIndex) !== "ally") return false;
  return allyIndexes(room, activeIndex).some((index) => {
    const id = room.players[index]?.id;
    return !!id && !!room.beginningBattlefieldUnitPresenceByPlayer?.[id]?.[zone as BattlefieldZone];
  });
}

/** 357603 `F` / `v`: third-party entry check (2+ other players already have units). */
export function thirdPartyEntryBlocked(room: Room, playerIndex: number, zone: string): boolean {
  if (room.players.length < 3) return false;
  const holders = room.players.flatMap((player, index) =>
    player.board && !player.leftAt && hasUnitAt(player.board, zone) ? [index] : [],
  );
  return !holders.includes(playerIndex) && holders.length >= 2;
}

/** 357603 `e`: transfer-control third-party check. */
export function transferWouldCreateThirdParty(
  room: Room,
  actorIndex: number,
  targetIndex: number,
  zone: string,
  cardId: string,
): boolean {
  if (room.players.length < 3) return false;
  const participants = new Set<number>();
  for (let index = 0; index < room.players.length; index += 1) {
    const player = room.players[index];
    if (!player?.board || player.leftAt) continue;
    const ownUnits = zoneList(player.board, zone).some(
      (card) => !card.hidden && isUnitCardTypeSafe(card) && (index !== actorIndex || card.id !== cardId),
    );
    if (index === targetIndex || ownUnits) participants.add(index);
  }
  return participants.size > 2;
}

function isUnitCardTypeSafe(card: CardInstance): boolean {
  // Local import would be circular; delegate through the catalog helper via a tiny cast.
  return card.type ? /\bunit\b/i.test(card.type) || card.type.toLowerCase().includes("unit") : false;
}

/** 357603 `w` / `O` owner resolution. */
export function resolveOwnerIndex(
  room: Room,
  actorIndex: number,
  owner: "self" | "opponent" | undefined,
  targetPlayerId: string | undefined,
): number {
  if (owner !== "opponent") {
    return targetPlayerId && targetPlayerId !== room.players[actorIndex]?.id ? -1 : actorIndex;
  }
  const others = room.players.flatMap((player, index) =>
    index !== actorIndex && player.board && !player.leftAt ? [index] : [],
  );
  if (targetPlayerId) return others.find((index) => room.players[index]?.id === targetPlayerId) ?? -1;
  return others.length === 1 ? (others[0] ?? -1) : -1;
}

/** 357603 `O` / `O`: card owner or fallback player id. */
export function cardOwnerId(card: CardInstance, fallback: string): string {
  return typeof card.ownerPlayerId === "string" && card.ownerPlayerId.trim()
    ? card.ownerPlayerId
    : fallback;
}

/** 357603 `n`: owner seat index for a chained/played card. */
export function ownerIndexForCard(
  room: Room,
  card: CardInstance,
  currentPlayerId: string,
  currentPlayerIndex: number,
): number {
  const ownerId = cardOwnerId(card, currentPlayerId);
  const index = playerIndexById(room, ownerId);
  return index >= 0 ? index : currentPlayerIndex;
}

/** 357603 `y`: reveal action without an audience (public to all others). */
export function isPublicRevealAction(action: {
  targetPlayerId?: string;
  audience?: string;
}): boolean {
  return action.targetPlayerId === undefined && (action.audience === undefined || action.audience === "all_other_players");
}

/**
 * 357603 `W`: compute the recipient ids for a reveal. Returns null when the audience is
 * invalid/empty (original handlers treat that as "reject action").
 */
export function revealRecipients(input: {
  room: Room;
  actorPlayerIndex: number;
  reveal: boolean;
  targetPlayerId?: string;
  audience?: string;
  currentRecipientIds?: string[];
  publiclyRevealed?: boolean;
}): string[] | null {
  const { room, actorPlayerIndex } = input;
  const others = room.players.flatMap((player, index) =>
    index !== actorPlayerIndex && player.board && !player.leftAt ? [player.id] : [],
  );
  let recipients: string[] | null = null;
  if (input.targetPlayerId && input.audience) return null;
  const actor = room.players[actorPlayerIndex];
  if (!actor) return null;
  const activeOthers = room.players.filter(
    (player, index) => index !== actorPlayerIndex && player.board && !player.leftAt,
  );
  if (input.targetPlayerId) {
    const target = activeOthers.find((player) => player.id === input.targetPlayerId);
    recipients = target ? [target.id] : null;
  } else if (!input.audience || input.audience === "all_other_players") {
    recipients = activeOthers.map((player) => player.id);
  } else {
    const variant = roomVariant(room);
    const actorTeam = room.teamIdByPlayerId?.[actor.id];
    const ids = activeOthers.flatMap((player) => {
      const index = room.players.findIndex((candidate) => candidate.id === player.id);
      const relation = relationship({
        variant,
        perspectivePlayerIndex: actorPlayerIndex,
        otherPlayerIndex: index,
        perspectiveTeamId: actorTeam,
        otherTeamId: room.teamIdByPlayerId?.[player.id],
      });
      const matches = input.audience === "teammates" ? relation === "ally" : relation === "opponent";
      return matches ? [player.id] : [];
    });
    recipients = ids.length > 0 ? ids : null;
  }
  if (!recipients) return null;
  const set = new Set<string>(
    input.currentRecipientIds === undefined && input.publiclyRevealed ? others : (input.currentRecipientIds ?? []),
  );
  for (const id of recipients) {
    if (input.reveal) set.add(id);
    else set.delete(id);
  }
  return others.filter((id) => set.has(id));
}

/**
 * 357603 `Z`: action targets an inactive battlefield zone (or moves the shared Baron Pit
 * token). Such actions are silently ignored by the original transition.
 */
export function targetedInactiveBattlefield(room: Room, playerId: string, action: Record<string, unknown> & { type: string }): boolean {
  let zones: BattlefieldZone[] | undefined;
  const isInactive = (zone: unknown): boolean => {
    if (typeof zone !== "string" || !isBattlefieldZone(zone)) return false;
    if (!zones) zones = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
    return !zones.includes(zone);
  };
  const cardIn = (zone: unknown, cardId: unknown): CardInstance | undefined => {
    if (typeof zone !== "string" || typeof cardId !== "string") return undefined;
    const board = room.players.find((player) => player.id === playerId)?.board;
    return board ? readZoneList(board, zone).find((card) => card.id === cardId) : undefined;
  };
  const isBaron = (card: CardInstance | undefined): boolean =>
    !!card && !!room.sharedBattlefieldToken && /baron nashor/i.test(card.name ?? "");

  switch (action.type) {
    case "draw_cards":
      return isInactive(action.to);
    case "take_top_from_deck":
    case "take_card_from_deck": {
      if (!isInactive(action.to)) return false;
      const board = room.players.find((player) => player.id === playerId)?.board;
      const card =
        action.type === "take_top_from_deck"
          ? board?.deck.at(-1)
          : board?.deck.find((item) => item.id === action.cardId);
      return !(action.to === "battlefieldToken" && isBaron(card));
    }
    case "move_card":
      return isInactive(action.to) && !(action.to === "battlefieldToken" && isBaron(cardIn(action.from, action.cardId)));
    case "create_token":
    case "duplicate_card":
    case "set_battlefield_brush":
    case "set_card_hidden":
    case "set_card_revealed_to_opponent":
    case "transfer_card_control":
    case "toggle_exhausted":
    case "adjust_card_might":
    case "adjust_card_counter":
    case "clear_card_counter":
    case "animate_orianna_gear":
    case "choose_neeko_legend":
    case "set_card_label":
    case "battlefield_conquer_pass_focus":
    case "battlefield_conquer_pass_response":
    case "battlefield_conquer_set_optional_pass":
    case "battlefield_conquer_dismiss":
    case "battlefield_conquer_confirm":
    case "dockside_banish_unit":
      return isInactive(action.zone);
    case "dockside_play_banished":
    case "kharox_play_from_trash": {
      if (isInactive(action.zone)) return true;
      if (!isInactive(action.to)) return false;
      const id = action.type === "dockside_play_banished" ? action.banishedCardId : action.trashCardId;
      const card = room.players
        .flatMap((player) => [...(player.board?.banished ?? []), ...(player.board?.trash ?? [])])
        .find((item) => item.id === id);
      return !(action.to === "battlefieldToken" && isBaron(card));
    }
    case "chain_add":
      return isInactive(action.from) || (action.from === "battlefieldMarker" && isInactive(action.battlefieldZone));
    case "equip_card": {
      const board = room.players.find((player) => player.id === playerId)?.board;
      if (!board) return false;
      return battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room)).some(
        (zone) =>
          isInactive(zone) &&
          readZoneList(board, zone).some(
            (card) => card.id === action.unitCardId || card.id === action.equipmentCardId,
          ),
      );
    }
    default:
      return false;
  }
}

/** 357603 `a`: turn order starting at `startingPlayerId`. */
export function turnOrderStartingAt(room: Room, startingPlayerId: string): string[] {
  return turnOrderForRoom(
    room,
    startingPlayerId,
    room.players.filter((player) => !!player.board && !player.leftAt).map((player) => player.id),
  );
}

/** 357603 `T`: non-duel variant. */
export function isTeamOrFfa(room: Room): boolean {
  return roomVariant(room) !== "duel";
}

/** 357603 `d`: mark post-beginning unit presence at a zone. */
export function markPostBeginningPresence(room: Room, playerId: string, zone: string): void {
  const current = room.postBeginningBattlefieldUnitPresenceByPlayer?.[playerId];
  if (current?.[zone as BattlefieldZone]) return;
  room.postBeginningBattlefieldUnitPresenceByPlayer = {
    ...(room.postBeginningBattlefieldUnitPresenceByPlayer ?? {}),
    [playerId]: { ...(current ?? emptyPresence(room.turnNumber)), [zone]: true },
  };
}

/** 357603 `C`: mark a battlefield as scored this turn for a player. */
export function markBattlefieldScored(room: Room, playerId: string, zone: BattlefieldZone): void {
  const current = room.battlefieldScoredThisTurnByPlayer?.[playerId];
  room.battlefieldScoredThisTurnByPlayer = {
    ...(room.battlefieldScoredThisTurnByPlayer ?? {}),
    [playerId]: mergePresence(current, zone, room.turnNumber),
  };
}

function mergePresence(
  current: BattlefieldPresenceMap | undefined,
  zone: string,
  turnNumber?: number,
): BattlefieldPresenceMap {
  // 856018 `a` / `M`: a snapshot from a previous turn is discarded before marking.
  if (
    current &&
    typeof current.turnNumber === "number" &&
    typeof turnNumber === "number" &&
    current.turnNumber !== turnNumber
  ) {
    return { ...emptyPresence(turnNumber), [zone]: true, ...(turnNumber !== undefined ? { turnNumber } : {}) };
  }
  return {
    ...emptyPresence(turnNumber),
    ...current,
    [zone]: true,
    ...(turnNumber !== undefined ? { turnNumber } : {}),
  };
}

/** 357603 `f`: presence snapshot for all boards. */
export function snapshotBattlefieldPresence(room: Room): Record<string, Record<BattlefieldZone, boolean>> {
  return battlefieldPresence(room, battlefieldCount(room));
}

/** Export for tests/debug. */
export { battlefieldContributorIds, battlefieldZones, hasUnitAt, isFieldZone, VARIANT_RULES };
