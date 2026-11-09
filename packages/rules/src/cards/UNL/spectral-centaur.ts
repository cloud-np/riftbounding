/** Spectral Centaur. */
import { registerCardScript, SELF } from "../sdk";
import { ANOTHER_FRIENDLY_UNIT_DIES } from "./custom";

registerCardScript({
  name: "Spectral Centaur",
  text: "When another friendly unit dies, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: ANOTHER_FRIENDLY_UNIT_DIES,
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
