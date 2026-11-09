/** Rengar, Pridestalker. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Rengar, Pridestalker",
  text: "When you play a unit, give a unit +1 [might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
      effect: { op: "temporary_might", amount: 1, target: aUnit() },
    },
  ],
});
