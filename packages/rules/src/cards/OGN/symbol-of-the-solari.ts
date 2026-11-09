/**
 * Symbol of the Solari (OGN-227, FAQ errata) — "If a combat where you are the attacker ends in a tie
 * that would recall any of your units, recall all units at that battlefield instead."
 *
 * Manual: the combat cleanup's tie recall (740.3.a / 468) is not routed through the replacement
 * interceptor as a replaceable action, so it cannot be replaced.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Symbol of the Solari",
  text: "If a combat where you are the attacker ends in a tie that would recall any of your units, recall all units at that battlefield instead. (Send them to base. This isn't a move. Ties are calculated after combat damage is dealt.)",
  status: "manual",
  notes:
    "Replacing the combat-cleanup tie recall (740.3.a, 468) is not supported by the replacement layer.",
  abilities: [],
});
