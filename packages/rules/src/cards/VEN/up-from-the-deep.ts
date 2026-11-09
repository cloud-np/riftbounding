/** Up from the Deep. */
import { registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Up from the Deep",
  text: "Play two 1 [Might] Tentacle unit tokens from Bilgewater.\n[Flow][3] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "create", token: token("Tentacle", { count: 2, might: 1, play: true }) },
    },
  ],
});
