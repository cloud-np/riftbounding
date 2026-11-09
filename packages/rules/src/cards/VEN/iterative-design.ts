/** Iterative Design. */
import { registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Iterative Design",
  text: "Play a 3 [Might] Mech unit token.\n[Flow][2][Mind] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "create", token: token("Mech", { might: 3, play: true }) } },
  ],
});
