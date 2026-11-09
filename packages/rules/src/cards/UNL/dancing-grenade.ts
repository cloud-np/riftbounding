/** Dancing Grenade. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Dancing Grenade",
  text: "Deal 2 to a unit. Its controller may play this spell again for [Rune]. If they do, this deals 1 additional Bonus Damage for each time this spell has dealt damage this turn.",
  status: "partial",
  notes:
    "'Its controller may play this spell again for [Rune]' (an opponent playing this card from its Trash, with escalating Bonus Damage) is not automated (420.3, 354, 712); only the first 2 damage is.",
  abilities: [{ kind: "spell", effect: { op: "deal", amount: 2, target: aUnit() } }],
});
