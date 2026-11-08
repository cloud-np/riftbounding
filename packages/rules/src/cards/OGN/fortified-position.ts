/**
 * Fortified Position (OGN-279, battlefield) — "When you defend here, choose a unit. It gains
 * [SHIELD 2] this combat."
 *
 * Defend triggers fire when the player gains the Defender designation (383.4.f; the effects layer
 * emits `defend_declared` once per combat). Shield itself is R2-combat's keyword, read through
 * `effectiveKeywordValues` (value 2).
 */
import { registerCardScript } from "../registry";
import { WHEN_YOU_DEFEND_HERE, aUnit } from "../dsl";

registerCardScript({
  name: "Fortified Position",
  text: "When you defend here, choose a unit. It gains [SHIELD 2] this combat. (+2 [Might] while It's a defender.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      effect: { op: "grant_keyword", keyword: "Shield 2", target: aUnit(), duration: "this-combat" },
    },
  ],
});
