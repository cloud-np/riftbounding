/**
 * Scoring — rules 469–474; 491.8.b / 491.8.g (2v2); victory 193–196.
 *
 * Scoring is not Gaining Points (470.1). A player scores a battlefield at most once per turn,
 * from either Conquer (471.1) or Hold (471.2), and in 2v2 at most once per team (491.8.b). The
 * point a Conquer would give is replaced by a draw when the player is within one point of the
 * Victory Score and has not scored every battlefield this turn (473.1.b.1, 491.8.g.1).
 */
import type { BattlefieldZone, Room, ScoringStepSnapshot } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { drawCards } from "../actions/draw";
import { battlefieldController } from "../actions/control";
import { interceptAction } from "../timing/hooks";
import { restrictionFor } from "../layers/restrictions";
import { isTeamMode, teamOf, teammatesOf } from "./teams";

export type ScoreKind = "conquer" | "hold";

export interface ScoreResult {
  scored: boolean;
  points: number;
  drew: boolean;
  /** Why the battlefield could not be scored (rule id), when `scored` is false. */
  blockedBy?: string;
}

/** 472 / 491.8.b: has the player — or, in 2v2, their team — already scored `zone` this turn? */
export function teamHasScored(room: Room, playerId: string, zone: BattlefieldZone, step: RulesStepContext): boolean {
  return teamOf(room, playerId).some((id) => step.host.hasScored(room, id, zone));
}

/**
 * 471.1.a / 491.8.b.1: in 2v2, battlefields controlled by the Turn Player's teammate during this
 * turn's Scoring Step cannot be scored by the Turn Player's team this turn.
 */
export function disqualifiedByTeammate(room: Room, playerId: string, zone: BattlefieldZone): boolean {
  if (!isTeamMode(room)) return false;
  const snapshot = room.rules?.history.scoringSnapshot;
  if (!snapshot) return false;
  const team = teamOf(room, snapshot.player);
  if (!team.includes(playerId)) return false;
  const controller = snapshot.control[zone];
  return !!controller && controller !== snapshot.player && team.includes(controller);
}

/**
 * 473.1.b.1 / 491.8.g.1: "has the player Scored every Battlefield this turn" (including the one
 * being scored now). In 2v2, during the player's or a teammate's turn, battlefields occupied by an
 * ally during that turn's Scoring Step are excepted.
 *
 * RULES-QUESTION(491.8.g.1): read literally per player — a battlefield the teammate scored this
 * turn does not count for the player.
 */
export function scoredEveryBattlefield(room: Room, playerId: string, step: RulesStepContext): boolean {
  const { host } = step;
  const snapshot = room.rules?.history.scoringSnapshot;
  const allies = teammatesOf(room, playerId);
  const ownOrTeammateTurn = !!room.rules && teamOf(room, playerId).includes(room.rules.turn.player);
  return host.battlefieldZones(room).every((zone) => {
    if (host.hasScored(room, playerId, zone)) return true;
    if (!isTeamMode(room) || !ownOrTeammateTurn || !snapshot) return false;
    return (snapshot.occupiedBy[zone] ?? []).some((id) => allies.includes(id));
  });
}

export function scoreBattlefield(
  room: Room,
  playerId: string,
  zone: BattlefieldZone,
  kind: ScoreKind,
  step: RulesStepContext,
): ScoreResult {
  const { host, events } = step;
  const rules = room.rules;
  if (!rules) return { scored: false, points: 0, drew: false };
  // 472 / 491.8.b: once per battlefield per turn (per team in 2v2), from either method.
  if (teamHasScored(room, playerId, zone, step)) {
    return { scored: false, points: 0, drew: false, blockedBy: isTeamMode(room) ? "491.8.b" : "472" };
  }
  // 471.1.a / 491.8.b.1
  if (kind === "conquer" && disqualifiedByTeammate(room, playerId, zone)) {
    return { scored: false, points: 0, drew: false, blockedBy: "491.8.b.1" };
  }
  const restriction = restrictionFor(room, host, { kind: "score", playerId, to: zone });
  if (restriction) return { scored: false, points: 0, drew: false, blockedBy: restriction.rule ?? "470" };

  host.markScored(room, playerId, zone);
  const victory = host.victoryScore(room);
  const current = host.score(room, playerId);

  // 473.1.b / 473.1.b.1: the Final Point may only come from a Conquer once every battlefield was
  // scored this turn (473.1.a.1: points from Hold are not restricted).
  if (kind === "conquer" && current >= victory - 1 && !scoredEveryBattlefield(room, playerId, step)) {
    // 473.1.b.1 / 432: the replacement draw is a normal draw and therefore Burns Out when the
    // Main Deck is empty instead of silently drawing nothing.
    const draw = drawCards(room, playerId, 1, step);
    pushEvent(events, {
      type: "score_draw_instead",
      playerId,
      zone,
      amount: 1,
      data: { kind, drawn: draw.drawn.length, awaitingPrompt: draw.awaitingPrompt, rule: "473.1.b.1" },
    });
    // 473.2 / 383.4.d.2.c: the battlefield was Scored, so Score abilities still trigger.
    pushEvent(events, { type: "conquer", playerId, zone, data: { scoredThisTurn: true, finalPointReplaced: true } });
    return { scored: true, points: 0, drew: draw.drawn.length > 0 || draw.awaitingPrompt };
  }

  // 473.1: gain up to one point. Gaining points is its own action for replacement effects (470.1).
  const proposal = interceptAction(room, step, {
    type: "gain_points",
    playerId,
    amount: 1,
    zone,
    data: { via: "score", kind },
  });
  const gained = proposal ? host.gainPoints(room, playerId, Math.max(0, Math.trunc(proposal.amount ?? 1))) : 0;
  pushEvent(events, {
    type: "score",
    playerId,
    zone,
    amount: gained,
    data: { kind, points: host.score(room, playerId) },
  });
  // 473.2: Conquer/Hold abilities trigger at the battlefield that scored (383.4.d.2.c: even when
  // the point was negated or replaced).
  pushEvent(events, {
    type: kind === "conquer" ? "conquer" : "hold",
    playerId,
    zone,
    data: { scoredThisTurn: true },
  });
  return { scored: true, points: gained, drew: false };
}

/** 315.2 / 471.1.a / 491.8.b.1 / 491.8.g.1: record control and occupancy at the Scoring Step. */
export function snapshotScoringStep(room: Room, playerId: string, step: RulesStepContext): ScoringStepSnapshot {
  const { host } = step;
  const snapshot: ScoringStepSnapshot = { player: playerId, control: {}, occupiedBy: {} };
  for (const zone of host.battlefieldZones(room)) {
    snapshot.control[zone] = battlefieldController(room, zone, host);
    snapshot.occupiedBy[zone] = host.activePlayerIds(room).filter((id) => host.hasUnitAt(room, id, zone));
  }
  if (room.rules) room.rules.history.scoringSnapshot = snapshot;
  return snapshot;
}

/**
 * 315.2.b / 471.2: the Turn Player Holds every battlefield they control (190) at the Scoring Step
 * of their Beginning Phase. The snapshot taken first feeds the 2v2 rules (491.8.b.1 / 491.8.g.1).
 */
export function holdBattlefields(room: Room, playerId: string, step: RulesStepContext): number {
  const { host } = step;
  snapshotScoringStep(room, playerId, step);
  let points = 0;
  for (const zone of host.battlefieldZones(room)) {
    // 190.4.b: control is frozen while a Showdown or Combat is ongoing there.
    if (room.rules?.showdown?.battlefield === zone || room.rules?.combat?.battlefield === zone) continue;
    if (battlefieldController(room, zone, host) !== playerId) continue;
    // 367–375: Hold and the Scoring process are game actions for replacement effects (as `hold`).
    if (!interceptAction(room, step, { type: "hold", playerId, zone })) continue;
    if (!interceptAction(room, step, { type: "score", playerId, zone, data: { kind: "hold" } })) continue;
    points += scoreBattlefield(room, playerId, zone, "hold", step).points;
  }
  return points;
}

/**
 * 323.1 / 474 / 194.2: in a cleanup, a player (2v2: team, 491.6.a) at or above the Victory Score
 * of the Mode of Play (487.3 / 488.3 / 489.3 / 490.3 / 491.3, 194.3.a) with more points than every
 * opponent wins; 194.2.b: tied leaders keep playing. 196: the game ends.
 */
export function checkVictory(room: Room, step: RulesStepContext): string[] {
  if (room.gameOutcome) return room.gameOutcome.winnerPlayerIds;
  const winners = step.host.settleVictory(room);
  if (winners.length > 0) {
    pushEvent(step.events, { type: "game_over", data: { winnerPlayerIds: winners, reason: "score" } });
  }
  return winners;
}

/** Convenience event used by actions that only gain raw points (not Scoring). */
export function gainPointsEvent(
  room: Room,
  playerId: string,
  amount: number,
  step: RulesStepContext,
): number {
  const gained = step.host.gainPoints(room, playerId, amount);
  pushEvent(step.events, { type: "gain_points", playerId, amount: gained });
  return gained;
}
