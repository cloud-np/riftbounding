/**
 * Shock Blast (VEN-059) — "[Action] This costs [2] less if you control something that's
 * [Empowered]. Deal 4 to a unit at a battlefield."
 *
 * 366.2.a: the cost passive applies while the card is in hand (356.4 discount).
 */
import { aUnit, whilePassive as conditional, custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Shock Blast",
  text: "[action] (Play on your turn or in showdowns.)\nThis costs [2] less if you control something that's [empowered].\nDeal 4 to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    conditional(custom("ven:control-empowered"), { kind: "cost", amount: -2, target: SELF }),
    { kind: "spell", effect: { op: "deal", amount: 4, target: aUnit({ zone: "battlefield" }) } },
  ],
});
