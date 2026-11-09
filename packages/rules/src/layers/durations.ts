/**
 * Effect durations — rules 801.3.a.2/3, 391–392 (windows of applicability), 317.2.c.
 *
 * "this-turn"/"until-next-ending" effects expire in step 3d of the Expiration Step (the R1
 * cleanup insert removes them from `rules.effects`; `triggers/hooks.ts` also clears the
 * per-object entries). The remaining durations are checked lazily here so a stale entry can
 * never apply.
 */
import type { EffectDuration, Room } from "@rift/protocol";

export interface DurationStamp {
  duration: EffectDuration;
  /** Turn number when the effect began applying. */
  turn: number;
  controller?: string;
  expiresAtTurn?: number;
}

export function durationActive(room: Room, stamp: DurationStamp): boolean {
  const rules = room.rules;
  if (!rules) return false;
  const now = rules.turn.number;
  if (stamp.expiresAtTurn !== undefined && now > stamp.expiresAtTurn) return false;
  switch (stamp.duration) {
    case "this-turn":
    case "until-next-ending":
      return now === stamp.turn;
    case "this-combat":
      return now === stamp.turn && rules.combat !== null;
    case "until-your-next-turn":
      return !(stamp.controller && rules.turn.player === stamp.controller && now > stamp.turn);
    case "while":
    case "permanent":
      return true;
  }
  return true;
}
