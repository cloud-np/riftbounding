/**
 * Antagonistic Apparatus (RAD-009) — "I enter ready. When you play me, play a ready 3 [Might]
 * Mech unit token here." (369.3, 440.2.c, 184.1)
 */
import { ENTER_READY, HERE, registerCardScript, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Antagonistic Apparatus",
  text: "I enter ready.\nWhen you play me, play a ready 3 [Might] Mech unit token here.",
  status: "implemented",
  abilities: [
    ENTER_READY,
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Mech", { might: 3, exhausted: false, play: true }),
        zone: HERE,
      },
    },
  ],
});
