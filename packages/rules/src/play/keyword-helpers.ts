/**
 * Keyword helpers owned by the play layer — rules 812 (Legion), 821 (Weaponmaster), 818.1.c.4.
 *
 * The effects of these keywords are R2-effects' (dependent abilities, the Weaponmaster trigger);
 * the play layer answers the questions they depend on.
 */
import type { Cost, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { parseEquipCosts } from "./cost-text";

/**
 * 812.1.c / 812.2 / 420.4.b: Legion's dependent ability is active while the player has
 * Finalized another card this turn (a countered card still counts). One card satisfies every
 * Legion ability the player controls.
 */
export function legionActive(room: Room, playerId: string, cardId?: string): boolean {
  const rules = room.rules;
  if (!rules) return false;
  if (rules.history.playHistoryTurn !== undefined && rules.history.playHistoryTurn !== rules.turn.number) return false;
  const finalized = rules.history.finalizedCardsThisTurn?.[playerId] ?? [];
  return finalized.some((id) => id !== cardId);
}

/**
 * Record a card as Finalized by `playerId` this turn (359). The process of play calls this; an
 * effect that plays a card outside `rules_play` (420.3, R2-effects' `play` op) must call it too.
 */
export function recordFinalizedCard(room: Room, playerId: string, cardId: string): void {
  const rules = room.rules;
  if (!rules) return;
  const map = (rules.history.finalizedCardsThisTurn ??= {});
  map[playerId] = [...(map[playerId] ?? []), cardId];
  rules.history.playHistoryTurn = rules.turn.number;
}

/**
 * 821.1.c / 821.1.c.2–821.1.c.4: the Equip cost alternatives of an Equipment, reduced by [A] for
 * a Weaponmaster trigger. An alternative without [A] is still payable but not reduced
 * (821.1.c.3); an Equipment without an Equip cost cannot be paid (`null`, 821.1.c.4). The Equip
 * ability is not activated (821.1.c.2.a), so only cost reductions that do not refer to playing
 * the ability apply — R2-effects adds those via `costAdjustments`.
 */
export function weaponmasterEquipCosts(room: Room, host: RulesHost, equipmentId: string): Cost[] | null {
  const info = host.cardInfo(room, equipmentId);
  const equips = parseEquipCosts(info?.text);
  if (equips.length === 0) return null;
  return equips.flatMap((alternatives) =>
    alternatives.map((cost) => {
      const any = cost.power?.any ?? 0;
      if (any <= 0) return cost;
      const power = { ...(cost.power ?? {}) };
      if (any - 1 > 0) power.any = any - 1;
      else delete power.any;
      const reduced: Cost = { ...cost };
      if (Object.keys(power).length > 0) reduced.power = power;
      else delete reduced.power;
      return reduced;
    }),
  );
}
