/** Faithful Manufactor (OGN-211) — "When you play me, play a 1 [Might] Recruit unit token here." (440.2.c, 187) */
import { registerCardScript } from "../registry";
import { HERE, WHEN_PLAYED, token } from "../dsl";

registerCardScript({
  name: "Faithful Manufactor",
  text: "When you play me, play a 1 [Might] Recruit unit token here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: HERE },
    },
  ],
});
