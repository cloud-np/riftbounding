/** Fiora, Peerless. */
import { custom, registerCardScript, SELF, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";

registerCardScript({
  name: "Fiora, Peerless",
  text: "When I attack or defend one on one, double my Might this combat.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      condition: custom("sfd:one-on-one"),
      // 433.1.a / 479.4.c: doubling increases Might by its current value (0 when negative).
      effect: {
        op: "give_might",
        amount: { kind: "might", selector: SELF },
        target: SELF,
        duration: "this-combat",
      },
    },
  ],
});
