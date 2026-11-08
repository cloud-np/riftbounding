/**
 * Conceding and Removal of a Player — rules 649–652; 195, 196, 491.6.a.
 *
 * Draft-only (N2): mutates the room it is given. Not wired to an intent yet — the lead decides
 * whether `rules_concede` (or the engine's leave flow) calls it.
 */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { battlefieldController, setBattlefieldController } from "../actions/control";
import { isTeamMode, teamOf } from "./teams";

export interface ConcedeResult {
  /** Players who lost and were removed (651, 651.4). */
  removed: string[];
  /** Winners when the game ended (651.1 / 195 / 491.6.a); empty while the game continues. */
  winners: string[];
}

/** Board zones holding permanents, runes and facedown cards (652.1). */
const BOARD_ZONES = ["base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken", "runeArea"] as const;

/**
 * 650 / 651: a player concedes at any time and is removed from the game; 651.4 / 491.6.a.1: their
 * teammates also lose and are removed. 651.1 / 195: if only one player (in 2v2: one team, 491.6.a.3)
 * remains, they win and the game ends (196). Otherwise each loser goes through the Removal of a
 * Player (651.2 / 652).
 */
export function concede(room: Room, playerId: string, step: RulesStepContext): ConcedeResult {
  if (room.gameOutcome) return { removed: [], winners: room.gameOutcome.winnerPlayerIds };
  const active = step.host.activePlayerIds(room);
  if (!active.includes(playerId)) return { removed: [], winners: [] };
  const losers = isTeamMode(room) ? teamOf(room, playerId).filter((id) => active.includes(id)) : [playerId];
  const remaining = active.filter((id) => !losers.includes(id));
  pushEvent(step.events, { type: "concede", playerId, data: { rule: "651", losers } });
  const remainingEntities = new Set(remaining.map((id) => teamOf(room, id).slice().sort().join("+")));
  if (remainingEntities.size <= 1) {
    room.gameOutcome = {
      winnerPlayerIds: remaining,
      reason: "concession",
      decidedAtTurnNumber: Math.max(1, room.rules?.turn.number ?? room.turnNumber ?? 1),
    };
    pushEvent(step.events, { type: "game_over", data: { winnerPlayerIds: remaining, reason: "concession", rule: "651.1" } });
    return { removed: losers, winners: remaining };
  }
  for (const loser of losers) removePlayer(room, loser, step);
  return { removed: losers, winners: [] };
}

/**
 * 195.1: an effect instructs a player to lose the game → they are immediately removed from the
 * game (the 651 / 652 process; in 2v2 the team loses together, 491.6.a.2).
 */
export function playerLoses(room: Room, playerId: string, step: RulesStepContext): ConcedeResult {
  pushEvent(step.events, { type: "lose_game", playerId, data: { rule: "195.1" } });
  return concede(room, playerId, step);
}

/**
 * 195: a player wins if an effect instructs them to do so (2v2: with their team, 491.6.a.3).
 */
export function playerWins(room: Room, playerId: string, step: RulesStepContext): string[] {
  if (room.gameOutcome) return room.gameOutcome.winnerPlayerIds;
  const winners = isTeamMode(room) ? teamOf(room, playerId) : [playerId];
  room.gameOutcome = {
    winnerPlayerIds: winners,
    reason: "score",
    decidedAtTurnNumber: Math.max(1, room.rules?.turn.number ?? room.turnNumber ?? 1),
  };
  pushEvent(step.events, { type: "game_over", data: { winnerPlayerIds: winners, reason: "effect", rule: "195" } });
  return winners;
}

/**
 * 652: Removal of a Player.
 * - 652.1: banish every permanent, rune and facedown card they control or own.
 * - 652.2: their battlefield leaves the game; 652.2.a/b it is replaced by a token battlefield with
 *   no abilities and units there stay (TODO(R2-combat): battlefield cards are not modelled as
 *   objects, so only the `battlefield_replaced` event records the replacement; 652.2.c continuous
 *   effects of the removed battlefield must stop once R2-effects models battlefield abilities).
 * - 651.3: they can no longer make choices (`leftAt`, so they leave the Turn Order and
 *   `activePlayerIds`); Priority/Focus they held is dropped for `advance` to re-grant.
 */
export function removePlayer(room: Room, playerId: string, step: RulesStepContext): void {
  const { host } = step;
  const rules = room.rules;
  const banishIds: string[] = [];
  for (const player of room.players) {
    if (!player.board) continue;
    for (const zone of BOARD_ZONES) {
      for (const card of host.zoneCards(room, player.id, zone)) {
        const controlled = player.id === playerId;
        const owned = (card.ownerPlayerId ?? player.id) === playerId;
        if (controlled || owned) banishIds.push(card.id);
      }
    }
  }
  for (const cardId of banishIds) {
    // Owner-relative (412 "banish"): the engine's `host.banish` uses the controller's zone.
    if (host.moveCardToOwnerZone(room, cardId, "banished")) {
      delete rules?.objects[cardId];
      pushEvent(step.events, { type: "banish", cardId, playerId, data: { rule: "652.1" } });
    }
  }
  const contributed = contributedBattlefield(room, playerId, step);
  if (contributed) {
    pushEvent(step.events, { type: "battlefield_replaced", playerId, zone: contributed, data: { rule: "652.2.a" } });
  }
  const seat = room.players.find((player) => player.id === playerId);
  if (seat) {
    seat.leftAt = host.now();
    seat.leftReason = "manual";
  }
  if (rules) {
    for (const zone of host.battlefieldZones(room)) {
      if (rules.contested[zone] === playerId) delete rules.contested[zone];
      if (battlefieldController(room, zone, host) === playerId) setBattlefieldController(room, zone, null);
    }
    if (rules.priority === playerId) rules.priority = null;
    if (rules.focus === playerId) rules.focus = null;
    rules.passes = rules.passes.filter((id) => id !== playerId);
    if (rules.prompt?.playerId === playerId) rules.prompt = null;
    // TODO(R2-combat): 651.3 when the removed player is the Turn Player or a combatant the turn /
    // combat must move on; the rules do not say how (RULES-QUESTION(652)).
  }
  pushEvent(step.events, { type: "player_removed", playerId, data: { rule: "652" } });
}

/** 487.4.a / 491.5.a: the battlefield zone the player contributed, if any (seat order). */
function contributedBattlefield(room: Room, playerId: string, step: RulesStepContext): BattlefieldZone | null {
  const zones = step.host.battlefieldZones(room).filter((zone) => zone !== "battlefieldToken");
  const contributors = room.players
    .filter((player) => !(room.gameVariant === "free_for_all_4" || room.gameVariant === "teams_2v2") || player.id !== room.firstPlayerId)
    .map((player) => player.id);
  const index = contributors.indexOf(playerId);
  return index >= 0 ? (zones[index] ?? null) : null;
}
