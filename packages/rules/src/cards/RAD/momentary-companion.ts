/** Momentary Companion. */
import { notIntrinsic, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

/** Momentary Companion (RAD-095) — "[Hidden] When you play me, if it's not your turn, give me [Temporary]." (816) */
const NOT_MY_TURN = { kind: "not" as const, condition: { kind: "is-turn-player" as const } };

registerCardScript({
  name: "Momentary Companion",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, if it's not your turn, give me [Temporary]. (Kill me at the start of my controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Temporary"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: NOT_MY_TURN,
      effect: {
        op: "if",
        condition: NOT_MY_TURN,
        then: { op: "grant_keyword", keyword: "Temporary", target: SELF },
      },
    },
  ],
});
