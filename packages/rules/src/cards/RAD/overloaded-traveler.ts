/** Overloaded Traveler (RAD-072) — "While there's a friendly gear with [Deploy] at my battlefield, I have +1 [Might]." */
import {
  whileModifier as conditional,
  notIntrinsic,
  registerCardScript,
  SELF,
  SELF_AT_BATTLEFIELD,
} from "../sdk";
import { DEPLOY_GEAR_HERE } from "./custom";

registerCardScript({
  name: "Overloaded Traveler",
  text: "While there's a friendly gear with [Deploy] at my battlefield, I have +1 [Might].",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deploy"),
    {
      kind: "passive",
      modifier: conditional(
        { kind: "and", conditions: [SELF_AT_BATTLEFIELD, DEPLOY_GEAR_HERE] },
        { kind: "might", amount: 1, target: SELF },
      ),
    },
  ],
});
