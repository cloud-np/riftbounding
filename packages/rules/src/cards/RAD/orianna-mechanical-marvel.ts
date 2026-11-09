/**
 * Orianna, Mechanical Marvel (RAD-068) — once each turn while at a battlefield, the next gear
 * costs [1][Rune] less. Modelled as a once-per-turn cost-adjust (420.5); consumption happens on
 * the next card played of any type and the "may" is automatic.
 */
import { whileModifier as conditional, registerCardScript, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Orianna, Mechanical Marvel",
  text: "Once each turn, while I'm at a battlefield, you may pay [1] [Rune] less to play a gear.",
  status: "partial",
  notes:
    "The [1][Rune] discount is a once-per-turn cost-adjust; it is consumed by the next card played even when that card is not a gear, and the optional 'may' is automatic (420.5, 356.4).",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(SELF_AT_BATTLEFIELD, {
        kind: "cost-adjust",
        energy: -1,
        power: { any: -1 },
        target: { cardType: "gear", controller: "self" },
        once: true,
      }),
    },
  ],
});
