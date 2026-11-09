/** Altar to Unity (OGN-275, battlefield) — "When you hold here, play a 1 [Might] Recruit unit token in your base." */
import { registerCardScript } from "../registry";
import { WHEN_YOU_HOLD_HERE, token } from "../dsl";

registerCardScript({
  name: "Altar to Unity",
  text: "When you hold here, play a 1 [Might] Recruit unit token in your base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
    },
  ],
});
