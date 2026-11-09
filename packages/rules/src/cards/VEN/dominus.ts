/**
 * Dominus (VEN-142) — "[Action] This turn, double a unit's Might and give it "[Rune][Rune]: Ready
 * me."" (433 Double, 479.4.c)
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Dominus",
  text: '[Action] (Play on your turn or in showdowns.)\nThis turn, double a unit\'s Might and give it "[Rune][Rune]: Ready me."',
  status: "partial",
  notes:
    'Granting the activated ability "[Rune][Rune]: Ready me." is not automated: there is no ability-granting modifier (grantedAbilities are not read by the activation layer, 376/801).',
  abilities: [{ kind: "spell", effect: { op: "double", target: aUnit() } }],
});
