/**
 * Disintegrate (OGN-005, Origins errata) — "Deal 3 to a unit at a battlefield. If this kills it,
 * do this: draw 1."
 * The damage is automated. Lethal damage kills in the next Cleanup (429.5.c attributes that kill
 * to this spell), after the resolution ended, so the reflexive "do this: draw 1" (387) cannot be
 * conditioned on it.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Disintegrate",
  text: "[ACTION] (Play on your turn or in showdowns.)\n\nDeal 3 to a unit at a battlefield. If this kills it, do this: draw 1.",
  status: "partial",
  notes:
    'Not automated: "If this kills it, do this: draw 1" — the kill happens in the Cleanup after the resolution (429.5.c); no reflexive trigger keyed to a cleanup kill attributed to the spell (387).',
  abilities: [
    { kind: "spell", effect: { op: "deal", amount: 3, target: aUnit({ zone: "battlefield" }) } },
  ],
});
