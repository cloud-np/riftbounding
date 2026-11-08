/**
 * Scoring / victory helpers ported from:
 *  - 91500 (victory score incl. Aspirant's Climb)
 *  - 856018 (conquer result + all-battlefields-would-be-scored)
 *  - 320083 (Tianna / Ivern)
 *  - 357603 `S` (gear cleanup + game outcome detection)
 */
import type {
  BattlefieldPresenceMap,
  BattlefieldZone,
  CardInstance,
  Room,
} from "@rift/protocol";
import {
  battlefieldZones,
  emptyPresence,
  isBattlefieldZone,
  moveCardCleanup,
  zoneList,
} from "../state/board";
import { battlefieldCount, playerIndexById } from "../state/selectors";
import {
  battlefieldContributorIds,
  entityGroups,
  scoreVictoryPlayerIds,
  turnOrderForRoom,
  turnOrderAdjustments,
  VARIANT_RULES,
  variantForPlayerCount,
  variantForRoom,
} from "../state/variant";
import { getCard, isDeployGear, isGearCardType, isUnitCardType } from "../catalog";

export const DEFAULT_VICTORY_SCORE = 8;

/** 91500 `N`: variant victory score + Aspirant's Climb modifiers. */
export function victoryScoreForRoom(
  room: Pick<
    Room,
    "gameVariant" | "players" | "firstPlayerId" | "battlefieldBrushByZone" | "sharedBattlefieldToken"
  >,
): number {
  const variant = variantForPlayerCount(room.gameVariant, room.players.length);
  let score = VARIANT_RULES[variant].victoryScore;
  const owners = battlefieldOwnerByZone(room);
  if (owners.length === 0) return score;
  if (!owners.every(({ player }) => !!player.selectedBattlefield?.trim())) return score;
  for (const { player, zone } of owners) {
    if (room.battlefieldBrushByZone?.[zone]) continue;
    if (isAspirantsClimb(player.selectedBattlefield)) score += 1;
  }
  return score;
}

function isAspirantsClimb(name: string | undefined): boolean {
  const trimmed = normalizeBattlefieldName(name).toLowerCase();
  return trimmed === "ogn-276" || trimmed === "aspirant's climb" || trimmed === "aspirants climb";
}

/** 91500 `s`: threshold used by the "final point" conquer rule. */
export function nearVictoryScore(victoryScore: number): number {
  return Number.isFinite(victoryScore) ? Math.max(0, Math.trunc(victoryScore) - 1) : 7;
}

/** 91500 `Y`: victory score at least equal to the highest current score. */
export function victoryScoreFloor(victoryScore: number, scores: readonly number[]): number {
  let value = Math.max(0, Math.trunc(victoryScore));
  for (const score of scores) {
    if (typeof score !== "number" || Number.isNaN(score)) continue;
    value = Math.max(value, Math.max(0, Math.trunc(score)));
  }
  return value;
}

/** 988474 `Y` / `J`: battlefield zone → owning player. */
export function battlefieldOwnerByZone(
  room: Pick<Room, "gameVariant" | "players" | "firstPlayerId">,
): Array<{
  player: Room["players"][number];
  zone: Exclude<BattlefieldZone, "battlefieldToken">;
}> {
  const contributors = battlefieldContributorIds(room);
  const zones: Array<Exclude<BattlefieldZone, "battlefieldToken">> = [
    "battlefieldA",
    "battlefieldB",
    "battlefieldC",
  ];
  const byId = new Map(room.players.map((player) => [player.id, player]));
  return contributors.flatMap((id, index) => {
    const player = byId.get(id);
    const zone = zones[index];
    return player && zone ? [{ player, zone }] : [];
  });
}

/** 138558 `n`: normalize a battlefield name (blank sealed placeholders become ""). */
export function normalizeBattlefieldName(name: string | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.startsWith("__sealed_blank_battlefield__:")) return "";
  return trimmed;
}

/** 509396 `q` via 70094 beginning phase: first-draw / extra-rune adjustments. */
export function beginningAdjustments(room: Room, playerId: string) {
  const variant = variantForRoom(room);
  const activeIds = room.players.filter((player) => !!player.board && !player.leftAt).map((player) => player.id);
  const order = turnOrderForRoom(room, room.firstPlayerId ?? room.players[0]?.id ?? playerId, activeIds);
  return turnOrderAdjustments({ variant, playerId, turnOrderPlayerIds: order });
}

/** 856018 `a`: merge a presence snapshot for the current turn. */
export function mergePresence(
  snapshot: BattlefieldPresenceMap | undefined,
  turnNumber: number | undefined,
): BattlefieldPresenceMap {
  if (!snapshot) return emptyPresence(turnNumber);
  if (
    typeof snapshot.turnNumber === "number" &&
    typeof turnNumber === "number" &&
    snapshot.turnNumber !== turnNumber
  ) {
    return emptyPresence(turnNumber);
  }
  return { ...emptyPresence(turnNumber), ...snapshot, ...(turnNumber !== undefined ? { turnNumber } : {}) };
}

/** 856018 `B`: did the player already score this battlefield this turn? */
export function scoredThisTurn(
  snapshot: BattlefieldPresenceMap | undefined,
  zone: BattlefieldZone,
  turnNumber: number | undefined,
): boolean {
  return mergePresence(snapshot, turnNumber)[zone] === true;
}

/** 856018 `M`: record a scored battlefield for the turn. */
export function withScoredBattlefield(
  snapshot: BattlefieldPresenceMap | undefined,
  zone: BattlefieldZone,
  turnNumber: number | undefined,
): BattlefieldPresenceMap {
  return {
    ...mergePresence(snapshot, turnNumber),
    [zone]: true,
    ...(turnNumber !== undefined ? { turnNumber } : {}),
  };
}

export interface ConquerDecision {
  kind: "conquer" | "conquer_and_score" | "conquer_and_draw";
  gainPoint: boolean;
  drawCard: boolean;
}

/** 856018 `N`: how a confirmed conquer resolves. */
export function resolveConquerDecision(input: {
  currentPoints: number;
  allActiveBattlefieldsWouldBeScored: boolean;
  victoryScore: number;
  canGainPoint: boolean;
  alreadyScoredThisTurn: boolean;
}): ConquerDecision {
  if (input.alreadyScoredThisTurn) return { kind: "conquer", gainPoint: false, drawCard: false };
  const threshold = nearVictoryScore(input.victoryScore);
  const finalPointScenario = input.currentPoints >= threshold && !input.allActiveBattlefieldsWouldBeScored;
  if (finalPointScenario) return { kind: "conquer_and_draw", gainPoint: false, drawCard: true };
  if (!input.canGainPoint) return { kind: "conquer", gainPoint: false, drawCard: false };
  return { kind: "conquer_and_score", gainPoint: true, drawCard: false };
}

/** 856018 `h`: after confirming this conquer, would every active battlefield be scored? */
export function allActiveBattlefieldsWouldBeScored(input: {
  snapshot: BattlefieldPresenceMap | undefined;
  zone: BattlefieldZone;
  turnNumber: number | undefined;
  sharedBattlefieldToken: Room["sharedBattlefieldToken"];
  normalBattlefieldCount: number;
  currentPoints: number;
  victoryScore: number;
  playerId: string;
  playerIdsInSeatOrder: string[];
  gameVariant: Room["gameVariant"];
  teamIdByPlayerId?: Record<string, string>;
  beginningBattlefieldUnitPresenceByPlayer?: Room["beginningBattlefieldUnitPresenceByPlayer"];
  activeTurnPlayerId?: string;
}): boolean {
  const snapshot = mergePresence(input.snapshot, input.turnNumber);
  const variant = variantForPlayerCount(input.gameVariant, input.playerIdsInSeatOrder.length);
  const threshold = nearVictoryScore(input.victoryScore);
  const teammates =
    variant === "teams_2v2" && input.currentPoints >= threshold
      ? (entityGroups({
          variant,
          playerIdsInSeatOrder: input.playerIdsInSeatOrder,
          teamIdByPlayerId: input.teamIdByPlayerId,
        }).find((entity) => entity.playerIds.includes(input.playerId))?.playerIds ?? [])
      : [];
  const excludedTeammates = teammates.includes(input.activeTurnPlayerId ?? "")
    ? teammates.filter((id) => id !== input.playerId)
    : [];
  return battlefieldZones(input.sharedBattlefieldToken, input.normalBattlefieldCount).every(
    (zone) =>
      zone === input.zone ||
      !!snapshot[zone] ||
      excludedTeammates.some((id) => !!input.beginningBattlefieldUnitPresenceByPlayer?.[id]?.[zone]),
  );
}

/** 320083 `C`: does an opponent's Tianna Crownguard block this player's point gain? */
export function tiannaBlocksPointGain(room: Room, playerId: string): boolean {
  const zones = battlefieldZones(room.sharedBattlefieldToken, room.players.length >= 3 ? 3 : 2);
  const perspective = playerIndexById(room, playerId);
  if (perspective < 0) return false;
  for (let index = 0; index < room.players.length; index += 1) {
    const other = room.players[index];
    if (!other?.board) continue;
    if (playerRelation(room, perspective, index) !== "opponent") continue;
    for (const zone of zones) {
      if (
        zoneList(other.board, zone).some(
          (card) =>
            isUnitCardType(card) &&
            (card.cardCode?.trim() === "SFD-060" || card.name.trim() === "Tianna Crownguard"),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function playerRelation(room: Room, perspective: number, other: number): "self" | "ally" | "opponent" {
  if (perspective === other) return "self";
  const variant = variantForPlayerCount(room.gameVariant, room.players.length);
  if (variant !== "teams_2v2") return "opponent";
  const a = room.players[perspective];
  const b = room.players[other];
  const aTeam = a ? room.teamIdByPlayerId?.[a.id] : undefined;
  const bTeam = b ? room.teamIdByPlayerId?.[b.id] : undefined;
  if (aTeam && bTeam) return aTeam === bTeam ? "ally" : "opponent";
  return perspective % 2 === other % 2 ? "ally" : "opponent";
}

/** 320083 `k`: does the player control Ivern (Baron Pit brush)? */
export function hasIvernLegend(player: Room["players"][number]): boolean {
  if (!player) return false;
  if (player.board?.legend.some((card) => matchesCard(card, "UNL-195", "Ivern, Green Father"))) return true;
  const deck = player.submittedDeck ??
    (player.deck as { sections?: { legend?: Array<{ name: string; cardCode?: string }> } } | undefined);
  const legend = deck?.sections?.legend?.[0];
  return !!legend && (legend.cardCode?.trim() === "UNL-195" || legend.name.trim() === "Ivern, Green Father");
}

function matchesCard(card: CardInstance, code: string, name: string): boolean {
  return (
    card.cardCode?.trim() === code ||
    card.name.trim() === name ||
    getCard(card.cardCode, card.name)?.id === code
  );
}

/**
 * 357603 `S`: cleanup non-unit battlefield gear, then detect a victory.
 *
 * NOTE: the original *client mirror* skips the score check for duel (`if (p(e)) return`),
 * because the authoritative server owns duel game outcomes. The port intentionally runs the
 * same strict-lead check for every variant (spec E3); this is the single deliberate divergence
 * from `dq.S` and is documented in PORTING.md.
 */
export function settleRoom(room: Room): Room {
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    const moved: CardInstance[] = [];
    for (const zone of battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room))) {
      const list = zoneList(board, zone);
      const kept: CardInstance[] = [];
      for (const card of list) {
        if (card.hidden || card.attachedToCardId || !isGearCardType(card) || isUnitCardType(card) || isDeployGear(card)) {
          kept.push(card);
          continue;
        }
        const copy = { ...card };
        moveCardCleanup(copy, zone, "base");
        moved.push(copy);
      }
      list.splice(0, list.length, ...kept);
    }
    if (moved.length > 0) board.base.push(...moved);
  }

  if (room.gameOutcome) return room;
  const active = room.players.filter((player) => !!player.board && !player.leftAt);
  if (active.length === 0) return room;
  const variant = variantForPlayerCount(room.gameVariant, active.length);
  const winners = scoreVictoryPlayerIds({
    variant,
    playerScores: active.map((player) => ({ playerId: player.id, score: player.board?.score ?? 0 })),
    teamIdByPlayerId: room.teamIdByPlayerId,
    victoryScore: victoryScoreForRoom(room),
  });
  if (winners.length > 0) {
    room.gameOutcome = {
      winnerPlayerIds: winners,
      reason: "score",
      decidedAtTurnNumber: Math.max(1, room.turnNumber ?? 1),
    };
  }
  return room;
}

/** Battlefield label used in logs. */
export function battlefieldLabel(room: Room, zone: BattlefieldZone): string {
  if (zone === "battlefieldToken") return room.sharedBattlefieldToken?.title ?? "Battleground";
  const owner = battlefieldOwnerByZone(room).find((entry) => entry.zone === zone);
  return normalizeBattlefieldName(owner?.player.selectedBattlefield) || zone;
}

/** Re-export for conquer.ts. */
export { isBattlefieldZone };
