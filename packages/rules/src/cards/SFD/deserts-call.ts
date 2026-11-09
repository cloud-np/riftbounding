/** Desert's Call. */
import { registerCardScript } from "../sdk";
import { sandSoldier } from "./custom";

registerCardScript({
  name: "Desert's Call",
  text: "[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\nPlay a 2 [Might] Sand Soldier unit token.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: sandSoldier() }],
});
