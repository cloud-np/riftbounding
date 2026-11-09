/**
 * Shared trigger conditions for card scripts (F5): one definition per printed wording. Lanes
 * import these instead of re-declaring them.
 */
import type { Trigger } from "@rift/protocol";
import { HERE, SELF } from "./selectors";


/** "When I move" (421, 447–455). */
export const WHEN_I_MOVE: Trigger = { kind: "event", event: { type: "move", subject: SELF } };

/** "When you play me / this" — a Play Effect (383.4.a). */
export const WHEN_PLAYED: Trigger = {
  kind: "event",
  event: { type: ["unit_played", "gear_played"], subject: SELF },
};

/** "When I die" / [Deathknell] (808.1.c). */
export const WHEN_I_DIE: Trigger = { kind: "event", event: { type: "die", subject: SELF } };

/** "[Empowered] When I die" (828.1.b: the trigger is a Dependent Ability, 727.1.b). */
export const WHEN_I_DIE_EMPOWERED: Trigger = {
  kind: "event",
  event: { type: "die", subject: { ...SELF, cardType: "unit", empowered: true } },
};

/** "When I become exhausted" (415). */
export const WHEN_I_BECOME_EXHAUSTED: Trigger = { kind: "event", event: { type: "exhaust", subject: SELF } };

/** "When I become [Empowered]" (827.1.d). */
export const WHEN_I_BECOME_EMPOWERED: Trigger = { kind: "event", event: { type: "empower", subject: SELF } };

/** "When I attack" (383.4.e). */
export const WHEN_I_ATTACK: Trigger = { kind: "event", event: { type: "attack", subject: SELF } };

/** "When I defend" (383.4.f). */
export const WHEN_I_DEFEND: Trigger = { kind: "event", event: { type: "defend", subject: SELF } };

/** "When I attack or defend" (383.4.e / 383.4.f). */
export const WHEN_I_ATTACK_OR_DEFEND: Trigger = {
  kind: "event",
  event: { type: ["attack", "defend"], subject: SELF },
};

/** "When I conquer" (383.4.c.2.a: I was present at the conquered battlefield). */
export const WHEN_I_CONQUER: Trigger = { kind: "event", event: { type: "conquer", subject: SELF } };

/** "When I hold" (383.4.d.2.a). */
export const WHEN_I_HOLD: Trigger = { kind: "event", event: { type: "hold", subject: SELF } };

/** "When you conquer" (any battlefield, 383.4.c.2). */
export const WHEN_YOU_CONQUER: Trigger = { kind: "event", event: { type: "conquer", player: "self" } };

/** "When you hold here" (battlefield, 383.4.d.2.b). */
export const WHEN_YOU_HOLD_HERE: Trigger = { kind: "event", event: { type: "hold", zone: HERE, player: "self" } };

/** "When you conquer here" (battlefield, 383.4.c.2.b). */
export const WHEN_YOU_CONQUER_HERE: Trigger = { kind: "event", event: { type: "conquer", zone: HERE, player: "self" } };

/**
 * "When you defend here" (battlefield, 383.4.f): the player gains the Defender designation
 * (R2-combat's player-level `defend` event, 466.2.c.3).
 */
export const WHEN_YOU_DEFEND_HERE: Trigger = {
  kind: "event",
  event: { type: "defend", zone: HERE, player: "self", data: { player: true } },
};

/** "When a unit moves from here" (battlefield). */
export const WHEN_A_UNIT_MOVES_FROM_HERE: Trigger = {
  kind: "event",
  event: { type: "move", from: HERE, cardType: "unit" },
};
