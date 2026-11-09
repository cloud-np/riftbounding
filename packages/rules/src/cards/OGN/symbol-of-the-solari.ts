/**
 * Symbol of the Solari (OGN-227, FAQ errata) — "If a combat where you are the attacker ends in a
 * tie that would recall any of your units, recall all units at that battlefield instead."
 *
 * 468.1.a.2 / 740.3.a: the tie recall of the attackers is a `recall` action and can be replaced
 * (R3-engine holds it, 371–373). The replacement applies only to a recall during the Combat
 * Special Cleanup of a combat the source's controller is attacking; its effect recalls every unit
 * at that battlefield (including the Defenders) to base. 370.2 prevents the replacement from
 * applying again to the recalls it causes itself.
 */
import { controllerOf, custom, locationOf, registerCardScript, registerCustomCondition } from "../sdk";

/** The held event is the tie recall of the controller's attacker in the current combat's cleanup. */
registerCustomCondition("ogn-oz:attacker-tie-recall", (ctx) => {
  const rules = ctx.room.rules;
  const combat = rules?.combat;
  const event = ctx.env.event;
  if (!rules || !combat || !event?.cardId) return false;
  if (combat.attacker !== ctx.env.controller) return false;
  if (controllerOf(ctx.room, ctx.host, event.cardId) !== ctx.env.controller) return false;
  if (locationOf(ctx.room, ctx.host, event.cardId) !== combat.battlefield) return false;
  return rules.history.combatProgress?.stage === "cleanup";
});

/** Candidate units for "all units at that battlefield" (the current combat's battlefield). */
registerCustomCondition("ogn-oz:unit-at-combat-battlefield", (ctx) => {
  const combat = ctx.room.rules?.combat;
  const id = ctx.env.it;
  if (!combat || !id) return false;
  return locationOf(ctx.room, ctx.host, id) === combat.battlefield;
});

registerCardScript({
  name: "Symbol of the Solari",
  text: "If a combat where you are the attacker ends in a tie that would recall any of your units, recall all units at that battlefield instead. (Send them to base. This isn't a move. Ties are calculated after combat damage is dealt.)",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "recall", condition: custom("ogn-oz:attacker-tie-recall") },
      replace: {
        op: "recall",
        target: { cardType: "unit", where: custom("ogn-oz:unit-at-combat-battlefield") },
      },
    },
  ],
});
