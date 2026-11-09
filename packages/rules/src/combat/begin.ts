/** Begin Combat — rules 462–464, 466.1–466.2.f, 323.12 / 323.13, 345. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { turnOrderStartingAt, unstageCombat } from "../state";
import { beginShowdown } from "../timing/showdown";
import { flushPendingTriggers } from "../triggers";
import { areOpponents } from "../scoring/teams";
import { battlefieldController } from "../actions/control";
import { designateCombatants } from "./designate";
import { hasUnitPresentAt } from "../state/presence";

export interface CombatParticipants {
  attacker: string;
  defender: string;
}

/**
 * 466.2.c.1 / 466.2.c.2 / 463 / 464: who would fight at `zone`.
 *
 * The Attacker is the player whose units applied Contested (466.2.c.1); the Defender is the
 * opposing player (463 "two opposing players"; teammates never fight, 491) who did not apply it
 * (466.2.c.2). Returns null when fewer than two opposing players have units there.
 *
 * RULES-QUESTION(466.2.c.1): if the Contested applier has no units there (or nobody applied it),
 * the first present player in Turn Order from the Turn Player (303.2.a) attacks.
 * RULES-QUESTION(464.3): if units of more than two opposing players are present (choices that
 * cause it are invalid, so only effects can), the battlefield's controller defends when present,
 * otherwise the next opposing player in Turn Order after the Attacker.
 */
export function combatParticipants(room: Room, zone: BattlefieldZone, host: RulesHost): CombatParticipants | null {
  const rules = room.rules;
  if (!rules) return null;
  const present = turnOrderStartingAt(room, rules.turn.player, host).filter((id) => hasUnitPresentAt(room, host, id, zone));
  if (present.length < 2) return null;
  const applier = rules.contested[zone];
  const attacker = applier && present.includes(applier) ? applier : present[0]!;
  const opponents = turnOrderStartingAt(room, attacker, host).filter(
    (id) => present.includes(id) && areOpponents(room, attacker, id),
  );
  if (opponents.length === 0) return null;
  const controller = battlefieldController(room, zone, host);
  const defender = controller && opponents.includes(controller) ? controller : opponents[0]!;
  return { attacker, defender };
}

/**
 * 464.1 / 464.2: in Modes of Play with more than two players, a battlefield with a staged Combat
 * or a Combat in progress is an invalid destination for players not involved in it.
 *
 * - `"move"` (464.1): invalid for Units of a player not involved in the Combat **or** who has no
 *   Units there already. RULES-QUESTION(464.1): read literally ("or"), an involved player whose
 *   units all left is also barred.
 * - `"play"` (464.2): invalid for a player not involved in that Combat (464.2.a: an effect that
 *   requires it plays the Unit to its controller's Base instead — R2-play / R2-effects).
 *
 * For R2-play's destination checks (moves 449.2.a, plays 355): not called by this domain.
 */
export function combatBarsDestination(
  room: Room,
  playerId: string,
  zone: BattlefieldZone,
  kind: "move" | "play",
  host: RulesHost,
): boolean {
  const rules = room.rules;
  if (!rules || host.activePlayerIds(room).length <= 2) return false;
  let involved: string[] = [];
  if (rules.combat?.battlefield === zone) involved = [rules.combat.attacker, rules.combat.defender];
  else if (rules.staged.combats.includes(zone)) {
    const participants = combatParticipants(room, zone, host);
    involved = participants ? [participants.attacker, participants.defender] : [];
  } else return false;
  if (!involved.includes(playerId)) return true;
  return kind === "move" && !hasUnitPresentAt(room, host, playerId, zone);
}

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
