/** Begin Combat — rules 462–464, 466.1–466.2.f, 323.12 / 323.13, 345. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { turnOrderStartingAt, unstageCombat } from "../state";
import { beginShowdown } from "../timing/showdown";
import { flushPendingTriggers } from "../triggers";
import { designateCombatants } from "./designate";
import { combatParticipants } from "./destinations";

export { combatBarsDestination, combatParticipants } from "./destinations";
export type { CombatParticipants } from "./destinations";

/**
 * 466.1 / 466.2: open a Combat at `zone`.
 *
 * 466.2.b (start of combat / start of showdown effects) → `combat_begin` + `showdown_begin`;
 * 466.2.c establish Attacker/Defender and their designations (466.2.c.3 → `attack`/`defend`);
 * 466.2.d put pending triggers on the Combat Chain, Attacker first, then every non-Defender in
 * Turn Order, then the Defender (466.2.d.1). 466.2.e: the state closes when a chain was created.
 *
 * Focus: a Combat Showdown that opens now gives Focus to the Attacker (466.2.c.1.a); a Showdown
 * already ongoing at the battlefield keeps its Focus holder (466.2.c.1.b / 323.13).
 */
export function beginCombat(
  room: Room,
  zone: BattlefieldZone,
  step: RulesStepContext,
  options: { preserveFocus?: boolean } = {},
): boolean {
  const rules = room.rules;
  if (!rules || rules.combat) return false;
  // 462: no Showdown or Combat may be ongoing at any other battlefield.
  if (rules.showdown && rules.showdown.battlefield !== zone) return false;
  const participants = combatParticipants(room, zone, step.host);
  if (!participants) return false;
  const { attacker, defender } = participants;
  const upgrading = rules.showdown?.kind === "non_combat" && rules.showdown.battlefield === zone;
  const preserveFocus = options.preserveFocus === true || upgrading;
  rules.combat = { battlefield: zone, attacker, defender, step: "showdown" };
  rules.history.combatProgress = { battlefield: zone, stage: "damage" };
  rules.showdown = null;
  unstageCombat(rules, zone);
  pushEvent(step.events, {
    type: "combat_begin",
    zone,
    playerId: attacker,
    data: { attacker, defender, upgrade: upgrading },
  });
  // 466.2.b / 466.2.c.1.a: the Combat Showdown opens (or the current Showdown becomes one).
  beginShowdown(room, zone, "combat", attacker, step, { force: true, preserveFocus });
  // 466.2.c.3: the players, then their units at the battlefield, gain their designations.
  pushEvent(step.events, { type: "attack", playerId: attacker, zone, data: { rule: "466.2.c.3", player: true } });
  pushEvent(step.events, { type: "defend", playerId: defender, zone, data: { rule: "466.2.c.3", player: true } });
  designateCombatants(room, step);
  // 466.2.d / 466.2.d.1: the Combat Chain.
  flushPendingTriggers(room, step, { order: combatTriggerOrder(room, attacker, defender, step.host) });
  return true;
}

/**
 * 466.2.d.1: Attacker, then all non-Defender players in Turn Order (303.2.a, from the Turn
 * Player), then the Defender.
 */
export function combatTriggerOrder(room: Room, attacker: string, defender: string, host: RulesHost): string[] {
  const turnPlayer = room.rules?.turn.player ?? attacker;
  const others = turnOrderStartingAt(room, turnPlayer, host).filter((id) => id !== attacker && id !== defender);
  return [attacker, ...others, defender];
}
