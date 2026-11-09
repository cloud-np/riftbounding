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
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Symbol of the Solari",
  text: "If a combat where you are the attacker ends in a tie that would recall any of your units, recall all units at that battlefield instead. (Send them to base. This isn't a move. Ties are calculated after combat damage is dealt.)",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "recall", condition: custom("ogn:attacker-tie-recall") },
      replace: {
        op: "recall",
        target: { cardType: "unit", where: custom("ogn:unit-at-combat-battlefield") },
      },
    },
  ],
});
