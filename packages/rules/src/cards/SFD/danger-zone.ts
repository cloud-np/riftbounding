/** Danger Zone. */
import { registerCardScript } from "../sdk";
import { MECHS } from "./custom";

registerCardScript({
  name: "Danger Zone",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Repeat] [1] [Rune] (You may pay the additional cost to repeat this spell's effect.)\nGive your Mechs +1 [Might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 1, target: MECHS } }],
});
