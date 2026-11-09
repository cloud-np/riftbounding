/** Blood Rush. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Blood Rush",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat] [1] (You may pay the additional cost to repeat this spell's effect.)\nGive a unit [Assault 2] this turn. (+2 [Might] while it's an attacker.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "spell",
      effect: {
        op: "grant_keyword",
        keyword: "Assault",
        value: 2,
        target: target(),
        duration: "this-turn",
      },
    },
  ],
});
