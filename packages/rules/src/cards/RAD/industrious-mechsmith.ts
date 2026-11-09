/** Industrious Mechsmith (RAD-049) — "When you play me, play a 3 [Might] Mech unit token here." (440.2.c) */
import { HERE, registerCardScript, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Industrious Mechsmith",
  text: "When you play me, play a 3 [Might] Mech unit token here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "create", token: token("Mech", { might: 3, play: true }), zone: HERE },
    },
  ],
});
