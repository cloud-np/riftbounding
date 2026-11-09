/** Corrupted Dragon. */
import {
  aUnit,
  whilePassive as conditional,
  custom,
  HERE,
  not,
  registerCardScript,
  SELF,
  WHEN_I_ATTACK,
} from "../sdk";

registerCardScript({
  name: "Corrupted Dragon",
  text: "If your score is not within 3 points of the Victory Score, I enter ready.\nWhen I attack, you may move any number of enemy units here each with 5 [Might] or less to their base.",
  status: "implemented",
  abilities: [
    conditional(not(custom("ven:score-within", { points: 3 })), {
      kind: "enter-ready",
      target: SELF,
    }),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "move",
        target: aUnit({
          controller: "opponent",
          zone: HERE,
          might: { op: "lte", value: 5 },
          maxCount: 99,
        }),
        to: "base",
      },
    },
  ],
});
