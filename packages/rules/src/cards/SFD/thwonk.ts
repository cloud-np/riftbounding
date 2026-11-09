/** Thwonk!. */
import { custom, registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Thwonk!",
  text: "[ACTION] (Play on your turn or in showdowns.)\n[REPEAT][2] (You may pay the additional cost to repeat this spell's effect.)\nStun an attacking unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "stun", target: target({ where: custom("core:attacking", { ref: "it" }) }) },
    },
  ],
});
