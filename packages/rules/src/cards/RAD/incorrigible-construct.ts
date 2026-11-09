/** Incorrigible Construct (RAD-011) — [Show Off] a Mech; enters ready if you showed off (832, 369.3). */
import {
  whileModifier as conditional,
  registerCardScript,
  SELF,
  SHOWED_OFF,
  showOff,
} from "../sdk";

registerCardScript({
  name: "Incorrigible Construct",
  text: "[Show Off] a Mech. (As you play me, you may reveal a Mech from your hand or pick another friendly Mech.)\nI enter ready if you showed off.",
  status: "implemented",
  abilities: [
    showOff({ tag: "Mech" }),
    {
      kind: "passive",
      modifier: conditional(SHOWED_OFF, { kind: "enter-ready", target: SELF }),
    },
  ],
});
