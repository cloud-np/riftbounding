/**
 * Fortified Position (OGN-279, battlefield) — "When you defend here, choose a unit. It gains
 * [SHIELD 2] this combat."
 *
 * Defend triggers fire when the player gains the Defender designation (383.4.f; R2-combat emits
 * the player-level `defend` event once per combat, 466.2.c.3). Shield itself is R2-combat's keyword, read through
 * `effectiveKeywordValues` (value 2).
 */
import { aUnit, registerCardScript, WHEN_YOU_DEFEND_HERE } from "../sdk";

registerCardScript({
  name: "Fortified Position",
  text: "When you defend here, choose a unit. It gains [SHIELD 2] this combat. (+2 [Might] while It's a defender.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      effect: {
        op: "grant_keyword",
        keyword: "Shield",
        value: 2,
        target: aUnit(),
        duration: "this-combat",
      },
    },
  ],
});
