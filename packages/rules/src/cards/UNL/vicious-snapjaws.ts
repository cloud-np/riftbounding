/** Vicious Snapjaws. */
import { registerCardScript } from "../sdk";
import { ANOTHER_FRIENDLY_UNIT_DIES } from "./custom";

registerCardScript({
  name: "Vicious Snapjaws",
  text: "When another friendly unit dies, gain 1 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: ANOTHER_FRIENDLY_UNIT_DIES,
      effect: { op: "gain_xp", amount: 1 },
    },
  ],
});
