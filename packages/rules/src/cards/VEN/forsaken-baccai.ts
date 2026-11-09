/** Forsaken Baccai. */
import { registerCardScript, SELF } from "../sdk";
import { FEWER_RUNES } from "./custom";

registerCardScript({
  name: "Forsaken Baccai",
  text: "If you control fewer runes than an opponent at the start of your Beginning phase, give me +1[might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      condition: FEWER_RUNES,
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});
