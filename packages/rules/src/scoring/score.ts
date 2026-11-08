/**
 * Scoring — rules 469–474.
 *
 * Scoring is not Gaining Points (470.1). A player scores a battlefield at most once per turn,
 * from either Conquer (471.1) or Hold (471.2). The final point from a Conquer is replaced by a
 * draw unless every active battlefield has been scored this turn (473.1.b).
 */
import type { BattlefieldZone, GameEvent, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { drawCards } from "../actions/draw";

export type ScoreKind = "conquer" | "hold";

export interface ScoreResult {
  scored: boolean;
  points: number;
  drew: boolean;
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
  // 472: once per battlefield per turn, from either method.
  if (host.hasScored(room, playerId, zone)) return { scored: false, points: 0, drew: false };

  host.markScored(room, playerId, zone);
  const victory = host.victoryScore(room);
  const current = host.score(room, playerId);
  const zones = host.battlefieldZones(room);
  const scoredAll = zones.every((entry) => host.hasScored(room, playerId, entry));

  // 473.1.b: the Final Point may only come from a Conquer when every battlefield was scored.
  if (kind === "conquer" && current >= victory - 1 && !scoredAll) {
    // 473.1.b.1 / 432: the replacement draw is a normal draw and therefore Burns Out when the
    // Main Deck is empty instead of silently drawing nothing.
    const draw = drawCards(room, playerId, 1, step);
    pushEvent(events, {
      type: "score_draw_instead",
      playerId,
      zone,
      amount: 1,
      data: { kind, drawn: draw.drawn.length, awaitingPrompt: draw.awaitingPrompt },
    });
    return { scored: true, points: 0, drew: draw.drawn.length > 0 || draw.awaitingPrompt };
  }

  const gained = host.gainPoints(room, playerId, 1);
  pushEvent(events, {
    type: "score",
    playerId,
    zone,
    amount: gained,
    data: { kind, points: host.score(room, playerId) },
  });
  // 473.2: Conquer/Hold abilities trigger at the battlefield that scored.
  pushEvent(events, {
    type: kind === "conquer" ? "conquer" : "hold",
    playerId,
    zone,
    data: { scoredThisTurn: true },
  });
  return { scored: true, points: gained, drew: false };
}

/** 315.2.b: the Turn Player Holds every battlefield they control at the Beginning Phase. */
export function holdBattlefields(room: Room, playerId: string, step: RulesStepContext): number {
  const { host } = step;
  let points = 0;
  for (const zone of host.battlefieldZones(room)) {
    // Control is established through units (188/190.4); a battlefield with no unit of the
    // turn player is not controlled by them (and battlefields with a showdown are frozen by 190.4.b).
    if (room.rules?.showdown?.battlefield === zone) continue;
    if (!host.hasUnitAt(room, playerId, zone)) continue;
    points += scoreBattlefield(room, playerId, zone, "hold", step).points;
  }
  return points;
}

/** 323.1/474: a player at/above the Victory Score with a strict lead wins. */
export function checkVictory(room: Room, step: RulesStepContext): string[] {
  const winners = step.host.settleVictory(room);
  if (winners.length > 0) {
    pushEvent(step.events, { type: "game_over", data: { winnerPlayerIds: winners } });
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
