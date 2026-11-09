/** Corina Veraza. */
import { registerCardScript } from "../sdk";
import { HERE_ZONE, recruit, WHEN_I_MOVE_TO_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Corina Veraza",
  text: "[Accelerate] (You may pay [1][Order] as an additional cost to have me enter ready.)\nWhen I move to a battlefield, play three 1 [Might] Recruit unit tokens here.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_MOVE_TO_BATTLEFIELD, effect: recruit(HERE_ZONE, 3) },
  ],
});
