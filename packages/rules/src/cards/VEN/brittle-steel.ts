/** Brittle Steel. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Brittle Steel",
  text: "Kill a gear.\n[Flow][4][Fury] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "kill", target: { chosen: true, cardType: "gear" } } },
  ],
});
