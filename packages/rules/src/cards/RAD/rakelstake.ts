/** Rakelstake. */
import { HERE, notIntrinsic, registerCardScript } from "../sdk";
import { oncePerPlayerPerTurn } from "./custom";

/**
 * Rakelstake (RAD-165) — "For each player, the first time they play a unit or gear here each turn,
 * they [Predict]." (440.2.c: playing a token counts)
 */
const RAKEL = oncePerPlayerPerTurn("rad:rakelstake:{self}", { op: "predict", amount: 1 });

registerCardScript({
  name: "Rakelstake",
  text: "For each player, the first time they play a unit or gear here each turn, they [Predict]. (They look at the top card of their Main Deck. They may recycle it.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Predict"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: ["unit_played", "gear_played"], zone: HERE, condition: RAKEL.condition },
      },
      effect: RAKEL.effect,
    },
  ],
});
