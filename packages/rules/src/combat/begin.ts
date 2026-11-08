/** Begin Combat — rules 461/466.1, 323.13. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { unstageCombat } from "../state";
import { beginShowdown } from "../timing/showdown";

export function beginCombat(
  room: Room,
  zone: BattlefieldZone,
  step: RulesStepContext,
  options: { preserveFocus?: boolean } = {},
): boolean {
  const rules = room.rules;
  if (!rules || rules.combat) return false;
  const players = step.host.activePlayerIds(room).filter((id) => step.host.hasUnitAt(room, id, zone));
  if (players.length < 2) return false;
  const attacker = rules.contested[zone] ?? players[0];
  const defender = players.find((id) => id !== attacker) ?? players[1];
  if (!attacker || !defender) return false;
  // 323.13 / 466.2.c.1.b: a non-combat Showdown upgrading to a Combat Showdown keeps the
  // current Focus holder. 345 only awards Focus when a fresh showdown/combat opens.
  const upgrading = rules.showdown?.kind === "non_combat" && rules.showdown.battlefield === zone;
  const preserveFocus = options.preserveFocus === true || upgrading;
  rules.combat = { battlefield: zone, attacker, defender, step: "showdown" };
  rules.showdown = null;
  unstageCombat(rules, zone);
  pushEvent(step.events, {
    type: "combat_begin",
    zone,
    playerId: attacker,
    data: { attacker, defender, upgrade: upgrading },
  });
  // 466.1 / 345: combat opens with a Combat Showdown; the Contested applier gains Focus.
  beginShowdown(room, zone, "combat", attacker, step, { force: true, preserveFocus });
  return true;
}
