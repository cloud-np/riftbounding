/** Primordial Roar (RAD-082) — [Show Off] a unit; deal its Might to a unit. (832) */
import { aUnit, registerCardScript, SHOWED_OFF, showOff } from "../sdk";

registerCardScript({
  name: "Primordial Roar",
  text: "[Show Off] a unit. (As you play this, you may reveal a unit from your hand or pick a friendly unit.)\nIf you showed off a unit, deal damage equal to that unit's Might to a unit.",
  status: "implemented",
  abilities: [
    showOff({ cardType: "unit" }),
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: SHOWED_OFF,
        then: {
          op: "deal",
          amount: { kind: "shown-off", property: "might" },
          target: aUnit(),
        },
      },
    },
  ],
});
