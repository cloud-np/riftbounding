/**
 * Combat destinations — rules 449.2.a, 464.1, 464.2, 466.2.c.1/.2.
 *
 * Kept out of `combat/begin.ts` so the effects layer can read destination legality without
 * importing the trigger/showdown/composition modules (avoids an import cycle through
 * `triggers` → `play/keywords` → `effects/ops`).
 */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { turnOrderStartingAt } from "../state";
import { areOpponents } from "../scoring/teams";
import { battlefieldController } from "../actions/control";
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
 * Standard Moves, Unit plays and effect Moves all consult this helper (449.2.a: "Moves of all
 * kinds (Standard Moves or otherwise)").
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
