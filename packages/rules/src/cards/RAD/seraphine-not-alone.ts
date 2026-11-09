/** Seraphine, Not Alone. */
import { registerCardScript, SELF, token, WHEN_I_BECOME_EXHAUSTED, WHEN_PLAYED } from "../sdk";

/**
 * Seraphine, Not Alone (RAD-SP5) — "When you play me or when I become exhausted, play a 1 [Might]
 * Recruit unit token to your base. I have +1 [Might] for each other exhausted unit you control."
 */
const RECRUIT_TO_BASE = {
  op: "create" as const,
  token: token("Recruit", { might: 1, play: true }),
  zone: "base" as const,
};

registerCardScript({
  name: "Seraphine, Not Alone",
  text: "When you play me or when I become exhausted, play a 1[Might] Recruit unit token to your base.\nI have +1[Might] for each other exhausted unit you control.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: RECRUIT_TO_BASE },
    { kind: "triggered", trigger: WHEN_I_BECOME_EXHAUSTED, effect: RECRUIT_TO_BASE },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: {
          kind: "count",
          selector: { cardType: "unit", controller: "self", exhausted: true, excludeSource: true },
        },
        target: SELF,
      },
    },
  ],
});
