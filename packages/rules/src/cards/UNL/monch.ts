/** Monch. */
import type { Condition } from "@rift/protocol";
import { registerCardScript, SELF, whilePassive as whenever } from "../sdk";

const OPPONENT_HAS_STUNNED: Condition = {
  kind: "exists",
  selector: { cardType: "unit", controller: "opponent", stunned: true },
};

registerCardScript({
  name: "Monch",
  text: "If an opponent controls a stunned unit, i cost [2] less and enter ready.",
  status: "implemented",
  abilities: [
    whenever(OPPONENT_HAS_STUNNED, { kind: "cost", amount: -2, target: SELF }),
    whenever(OPPONENT_HAS_STUNNED, { kind: "enter-ready", target: SELF }),
  ],
});
