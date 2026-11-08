/**
 * Variant table + entity/turn-order math — original module 509396 (1kx2ucot0m321.js:2428).
 * Values are verbatim from the bundle.
 */
import type { GameVariant, Room, VariantRules } from "@rift/protocol";

export const GAME_VARIANTS: GameVariant[] = ["duel", "free_for_all_3", "free_for_all_4", "teams_2v2"];

export const VARIANT_RULES: Record<GameVariant, VariantRules> = {
  duel: {
    id: "duel",
    label: "Duel",
    shortLabel: "1v1",
    formation: "duel",
    playerCount: 2,
    opponentsPerPlayer: 1,
    teammatesPerPlayer: 0,
    victoryScore: 8,
    scoreScope: "player",
    initialBattlefieldCount: 2,
    battlefieldContributorPolicy: "every_player",
    battlefieldsBroughtPerPlayer: 3,
    selectedBattlefieldsPerContributor: 1,
    turnOrderPolicy: "clockwise",
    matchFormat: "bo1",
    firstPlayerSkipsFirstDraw: false,
    lastPlayerExtraRunesOnFirstChannel: 1,
    showdownFocusParticipants: "all_players",
    chainPriorityParticipants: "all_players",
    combatPlayerLimit: 2,
    thirdPartyCombatEntryAllowed: false,
    victoryCheckTiming: "cleanup",
    victoryRequiresStrictLead: true,
    baronAddsBattlefield: true,
  },
  free_for_all_3: {
    id: "free_for_all_3",
    label: "Skirmish",
    shortLabel: "1v1v1",
    formation: "free_for_all",
    playerCount: 3,
    opponentsPerPlayer: 2,
    teammatesPerPlayer: 0,
    victoryScore: 8,
    scoreScope: "player",
    initialBattlefieldCount: 3,
    battlefieldContributorPolicy: "every_player",
    battlefieldsBroughtPerPlayer: 3,
    selectedBattlefieldsPerContributor: 1,
    turnOrderPolicy: "clockwise",
    matchFormat: "bo1",
    firstPlayerSkipsFirstDraw: true,
    lastPlayerExtraRunesOnFirstChannel: 1,
    showdownFocusParticipants: "all_players",
    chainPriorityParticipants: "all_players",
    combatPlayerLimit: 2,
    thirdPartyCombatEntryAllowed: false,
    victoryCheckTiming: "cleanup",
    victoryRequiresStrictLead: true,
    baronAddsBattlefield: true,
  },
  free_for_all_4: {
    id: "free_for_all_4",
    label: "War",
    shortLabel: "1v1v1v1",
    formation: "free_for_all",
    playerCount: 4,
    opponentsPerPlayer: 3,
    teammatesPerPlayer: 0,
    victoryScore: 8,
    scoreScope: "player",
    initialBattlefieldCount: 3,
    battlefieldContributorPolicy: "all_except_first_player",
    battlefieldsBroughtPerPlayer: 3,
    selectedBattlefieldsPerContributor: 1,
    turnOrderPolicy: "clockwise",
    matchFormat: "bo1",
    firstPlayerSkipsFirstDraw: true,
    lastPlayerExtraRunesOnFirstChannel: 1,
    showdownFocusParticipants: "all_players",
    chainPriorityParticipants: "all_players",
    combatPlayerLimit: 2,
    thirdPartyCombatEntryAllowed: false,
    victoryCheckTiming: "cleanup",
    victoryRequiresStrictLead: true,
    baronAddsBattlefield: true,
  },
  teams_2v2: {
    id: "teams_2v2",
    label: "Magma Chamber",
    shortLabel: "2v2",
    formation: "teams",
    playerCount: 4,
    opponentsPerPlayer: 2,
    teammatesPerPlayer: 1,
    victoryScore: 11,
    scoreScope: "team",
    initialBattlefieldCount: 3,
    battlefieldContributorPolicy: "all_except_first_player",
    battlefieldsBroughtPerPlayer: 3,
    selectedBattlefieldsPerContributor: 1,
    turnOrderPolicy: "alternate_teams",
    matchFormat: "bo1",
    firstPlayerSkipsFirstDraw: true,
    lastPlayerExtraRunesOnFirstChannel: 1,
    showdownFocusParticipants: "all_players",
    chainPriorityParticipants: "all_players",
    combatPlayerLimit: 2,
    thirdPartyCombatEntryAllowed: false,
    victoryCheckTiming: "cleanup",
    victoryRequiresStrictLead: true,
    baronAddsBattlefield: true,
    teamRules: {
      teamSize: 2,
      scoreShared: true,
      xpShared: false,
      controlShared: false,
      friendlyIncludesTeammate: true,
      beginningStepAllyControlBlocksTeamScoring: true,
      finalConquerExcludesBeginningStepAllyBattlefields: true,
      teammatePrivateInformationMayBeShown: true,
      duplicateChampionLegendAllowed: false,
      duplicateBattlefieldNamesAllowed: false,
      winLossAndConcessionShared: true,
    },
  },
};

export function isGameVariant(value: unknown): value is GameVariant {
  return typeof value === "string" && (GAME_VARIANTS as string[]).includes(value);
}

export function getVariantRules(variant: GameVariant): VariantRules {
  return VARIANT_RULES[variant];
}

export function variantPlayerCount(variant: GameVariant): number {
  return VARIANT_RULES[variant].playerCount;
}

/** 509396 `f`: explicit variant or inferred from the seat count. */
export function variantForPlayerCount(explicitVariant: unknown, playerCount: number): GameVariant {
  if (isGameVariant(explicitVariant)) return explicitVariant;
  return playerCount === 3 ? "free_for_all_3" : playerCount === 4 ? "free_for_all_4" : "duel";
}

export function variantForRoom(room: Pick<Room, "gameVariant" | "players">): GameVariant {
  return variantForPlayerCount(room.gameVariant, room.players.length);
}

/** 509396 `i`: implicit team id (0/1) from the seat index. */
export function implicitTeamIndex(variant: GameVariant, seatIndex: number): number | null {
  if (variant !== "teams_2v2") return null;
  return +(Math.abs(Math.trunc(seatIndex)) % 2 !== 0);
}

/** 509396 `o`: entity groups (players or teams). */
export function entityGroups(input: {
  variant: GameVariant;
  playerIdsInSeatOrder: string[];
  teamIdByPlayerId?: Record<string, string>;
}): Array<{ id: string; playerIds: string[] }> {
  if (input.variant !== "teams_2v2") {
    return input.playerIdsInSeatOrder.map((id) => ({ id: `player:${id}`, playerIds: [id] }));
  }
  const groups = new Map<string, { id: string; playerIds: string[] }>();
  input.playerIdsInSeatOrder.forEach((playerId, index) => {
    const teamId = input.teamIdByPlayerId?.[playerId]?.trim();
    const key = teamId
      ? `team:${teamId}`
      : `team:${implicitTeamIndex(input.variant, index) ?? 0}`;
    const existing = groups.get(key);
    if (existing) existing.playerIds.push(playerId);
    else groups.set(key, { id: key, playerIds: [playerId] });
  });
  return [...groups.values()];
}

/** 509396 `s`: rotate an array so `start` is first. */
export function rotateFrom<T>(items: readonly T[], start: T): T[] {
  const index = items.indexOf(start);
  return index < 0 ? [...items] : [...items.slice(index), ...items.slice(0, index)];
}

/** 509396 `c`: turn order starting at the first player (2v2 alternates teams). */
export function orderedTurnOrder(input: {
  variant: GameVariant;
  playerIdsInSeatOrder: string[];
  firstPlayerId: string;
  teamIdByPlayerId?: Record<string, string>;
}): string[] {
  const rotated = rotateFrom(input.playerIdsInSeatOrder, input.firstPlayerId);
  if (
    input.variant !== "teams_2v2" ||
    rotated.length !== 4 ||
    input.playerIdsInSeatOrder.indexOf(input.firstPlayerId) < 0
  ) {
    return rotated;
  }
  const teamOf = (playerId: string): string => {
    const explicit = input.teamIdByPlayerId?.[playerId]?.trim();
    if (explicit) return explicit;
    return String(implicitTeamIndex(input.variant, input.playerIdsInSeatOrder.indexOf(playerId)));
  };
  const firstTeam = teamOf(input.firstPlayerId);
  const opponent = rotated.find((id) => teamOf(id) !== firstTeam);
  const teammate = rotated.find((id) => id !== input.firstPlayerId && teamOf(id) === firstTeam);
  const lastOpponent = rotated.find((id) => id !== opponent && teamOf(id) !== firstTeam);
  return opponent && teammate && lastOpponent
    ? [input.firstPlayerId, opponent, teammate, lastOpponent]
    : rotated;
}

/** 509396 `m`: active-player turn order starting at `startingPlayerId`. */
export function turnOrderForRoom(
  room: Pick<Room, "gameVariant" | "players" | "firstPlayerId" | "teamIdByPlayerId">,
  startingPlayerId: string,
  activePlayerIds?: readonly string[],
): string[] {
  const variant = variantForRoom(room);
  const seatOrder = room.players.map((player) => player.id);
  const active = new Set(activePlayerIds ?? seatOrder);
  const order = orderedTurnOrder({
    variant,
    playerIdsInSeatOrder: seatOrder,
    firstPlayerId: room.firstPlayerId ?? seatOrder[0] ?? startingPlayerId,
    teamIdByPlayerId: room.teamIdByPlayerId,
  }).filter((id) => active.has(id));
  return rotateFrom(order, startingPlayerId);
}

/** 509396 `o`: which players bring battlefields. */
export function battlefieldContributorIds(
  room: Pick<Room, "gameVariant" | "players" | "firstPlayerId">,
): string[] {
  const variant = variantForRoom(room);
  const ids = room.players.map((player) => player.id);
  if (VARIANT_RULES[variant].battlefieldContributorPolicy === "all_except_first_player") {
    return ids.filter((id) => id !== room.firstPlayerId);
  }
  return ids;
}

/** 509396 `n`: relationship between two seats. */
export function relationship(input: {
  variant: GameVariant;
  perspectivePlayerIndex: number;
  otherPlayerIndex: number;
  perspectiveTeamId?: string;
  otherTeamId?: string;
}): "self" | "ally" | "opponent" {
  if (input.perspectivePlayerIndex === input.otherPlayerIndex) return "self";
  if (input.variant !== "teams_2v2") return "opponent";
  if (input.perspectiveTeamId && input.otherTeamId) {
    return input.perspectiveTeamId === input.otherTeamId ? "ally" : "opponent";
  }
  return implicitTeamIndex(input.variant, input.perspectivePlayerIndex) ===
    implicitTeamIndex(input.variant, input.otherPlayerIndex)
    ? "ally"
    : "opponent";
}

/** 509396 `q`: first-draw skip / extra runes on first channel. */
export function turnOrderAdjustments(input: {
  variant: GameVariant;
  playerId: string;
  turnOrderPlayerIds: string[];
}): { skipFirstDraw: boolean; extraRunesOnFirstChannel: number } {
  const rules = VARIANT_RULES[input.variant];
  return {
    skipFirstDraw: rules.firstPlayerSkipsFirstDraw && input.turnOrderPlayerIds[0] === input.playerId,
    extraRunesOnFirstChannel:
      input.turnOrderPlayerIds.at(-1) === input.playerId ? rules.lastPlayerExtraRunesOnFirstChannel : 0,
  };
}

/** 509396 `g`: strict-lead victory detection over entities. */
export function scoreVictoryPlayerIds(input: {
  variant: GameVariant;
  playerScores: Array<{ playerId: string; score: number }>;
  teamIdByPlayerId?: Record<string, string>;
  victoryScore?: number;
}): string[] {
  const scores = new Map(input.playerScores.map(({ playerId, score }) => [playerId, score]));
  const entities = entityGroups({
    variant: input.variant,
    playerIdsInSeatOrder: input.playerScores.map(({ playerId }) => playerId),
    teamIdByPlayerId: input.teamIdByPlayerId,
  }).map((entity) => ({
    ...entity,
    score: Math.max(...entity.playerIds.map((id) => scores.get(id) ?? 0)),
  }));
  const threshold = Math.max(
    0,
    Math.trunc(input.victoryScore ?? VARIANT_RULES[input.variant].victoryScore),
  );
  for (const entity of entities) {
    if (
      entity.score >= threshold &&
      entities.filter((other) => other.id !== entity.id).every((other) => entity.score > other.score)
    ) {
      return entity.playerIds;
    }
  }
  return [];
}

/** 509396 `h`: "P1" seat label. */
export function seatLabel(seat: number): string {
  return `P${Math.max(0, Math.trunc(seat)) + 1}`;
}

/** 509396 `i`: team label for a seat. */
export function teamLabel(variant: GameVariant, seat: number): string | null {
  const team = implicitTeamIndex(variant, seat);
  return team === null ? null : `Team ${team + 1}`;
}
