/** Kennen, Keeper of Balance. */
import { aUnit, whilePassive as conditional, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Kennen, Keeper of Balance",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me or I attack, you may pay [2] to [Stun] a unit. (It doesn't deal combat damage this turn.)\nWhile there's a stunned enemy unit here, I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["unit_played", "attack"], subject: SELF } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 2 },
        effect: { op: "stun", target: aUnit() },
      },
    },
    conditional(
      {
        kind: "exists",
        selector: { cardType: "unit", controller: "opponent", stunned: true, zone: HERE },
      },
      { kind: "might", amount: 2, target: SELF },
    ),
  ],
});
