/** Royal Guard. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { HERE_ZONE, sandSoldier } from "./custom";

registerCardScript({
  name: "Royal Guard",
  text: "When you play me, play a 2 [Might] Sand Soldier unit token here.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: sandSoldier(HERE_ZONE) }],
});
