/**
 * Keyword helpers owned by the play layer — rules 812 (Legion), 821 (Weaponmaster), 818.1.c.4.
 *
 * The effects of these keywords are R2-effects' (dependent abilities, the Weaponmaster trigger);
 * the play layer answers the questions they depend on.
 */
import type { Cost, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { getCardScript } from "../cards/registry";
import { effectiveMight } from "../layers";
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
 * 818.1.c.2 / 821.1.c.2: the Equip ability's base cost. A script may model an Equip cost that
 * reads the chosen unit (e.g. Hextech Gauntlets' "[3][Rune]. This ability's Energy cost is
 * reduced by the Might of the unit you choose."); that cannot be the built-in text-parsed
 * `equip:<n>` cost, so prefer the scripted Equip ability and fall back to the printed line.
 */
function equipBaseCosts(room: Room, host: RulesHost, equipmentId: string): Cost[] | null {
  const info = host.cardInfo(room, equipmentId);
  const printed = parseEquipCosts(info?.text).flat();
  const supported = printed.filter(
    (cost) => !Object.keys(cost.additional ?? {}).some((key) => key.startsWith("unsupported:")),
  );
  if (supported.length > 0) return supported;
  // A cost that reads the chosen unit (Hextech Gauntlets) is modelled by the script's Equip
  // ability because the printed line has trailing instruction text the cost parser cannot pay.
  const script = getCardScript(info?.name ?? host.findCard(room, equipmentId)?.card.name ?? "");
  const scripted = script?.abilities.find(
    (ability) =>
      ability.kind === "activated" &&
      (ability.keywords ?? []).some((keyword) => String(keyword).toLowerCase() === "equip") &&
      !!ability.cost,
  );
  if (scripted && scripted.kind === "activated" && scripted.cost) return [scripted.cost];
  return null;
}

/**
 * 821.1.c.2.b: an ability that reduces an Equip cost without referring to the Equip ability being
 * played still applies when the cost is calculated for Weaponmaster. The chosen unit is the unit
 * with Weaponmaster (821.1.c.2: "choosing the unit with the Weaponmaster ability"), so a cost
 * that reads that unit's Might (Hextech Gauntlets) can be calculated here. Card-specific
 * modifiers are expressed in the card's own text; fixed discounts are normal `Cost` fields and
 * need no extra pass.
 */
function applyEquipCostModifiers(
  room: Room,
  host: RulesHost,
  equipmentId: string,
  cost: Cost,
  unitId: string | undefined,
): Cost {
  const info = host.cardInfo(room, equipmentId);
  const text = info?.text ?? "";
  const mightDiscount = /this ability'?s energy cost is reduced by the might of the (?:unit|card) you choose/i.test(
    text,
  );
  if (!mightDiscount || !unitId || typeof cost.energy !== "number" || cost.energy <= 0) return cost;
  const might = Math.max(0, effectiveMight(room, unitId, host));
  const energy = Math.max(0, cost.energy - might);
  const reduced: Cost = { ...cost };
  if (energy > 0) reduced.energy = energy;
  else delete reduced.energy;
  return reduced;
}

/**
 * 821.1.c / 821.1.c.2–821.1.c.4: the Equip cost alternatives of an Equipment, reduced by [A] for
 * a Weaponmaster trigger. An alternative without [A] is still payable but not reduced
 * (821.1.c.3); an Equipment without an Equip cost cannot be paid (`null`, 821.1.c.4). The Equip
 * ability is not activated (821.1.c.2.a), so only cost reductions that do not refer to playing
 * the ability apply; 821.1.c.2.b reductions that read the chosen unit are applied here.
 */
export function weaponmasterEquipCosts(
  room: Room,
  host: RulesHost,
  equipmentId: string,
  unitId?: string,
): Cost[] | null {
  const equips = equipBaseCosts(room, host, equipmentId);
  if (!equips) return null;
  return equips.map((base) => {
    const cost = applyEquipCostModifiers(room, host, equipmentId, base, unitId);
    const any = cost.power?.any ?? 0;
    if (any <= 0) return cost;
    const power = { ...(cost.power ?? {}) };
    if (any - 1 > 0) power.any = any - 1;
    else delete power.any;
    const reduced: Cost = { ...cost };
    if (Object.keys(power).length > 0) reduced.power = power;
    else delete reduced.power;
    return reduced;
  });
}
