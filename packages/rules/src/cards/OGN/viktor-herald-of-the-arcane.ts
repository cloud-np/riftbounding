/** Viktor, Herald of the Arcane (OGN-265, legend) — "[1], [Tap]: Play a 1 [Might] Recruit unit token." (376; 440.2.c, default location the base) */
import { registerCardScript } from "../registry";
import { SELF, token } from "../dsl";

registerCardScript({
  name: "Viktor, Herald of the Arcane",
  text: "[1], [Tap]: Play a 1 [Might] Recruit unit token.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
    },
  ],
});
