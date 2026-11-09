/** Jarvan IV, Martial Paragon. */
import { notIntrinsic, registerCardScript, WHEN_I_CONQUER } from "../sdk";
import { DEPLOY_GEAR_HERE } from "./custom";

registerCardScript({
  name: "Jarvan IV, Martial Paragon",
  text: "Your gear with [Deploy] have [Action]. (They can be played on your turn or in showdowns.)\nWhen I conquer, if there is a friendly gear with [Deploy] here, channel 1 rune exhausted.",
  status: "partial",
  notes:
    '"Your gear with [Deploy] have [Action]" grants a keyword to cards in hand; the play layer\'s keyword array form does not see passives (801.3, 806).',
  abilities: [
    ...notIntrinsic("Action", "Deploy"),
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      condition: DEPLOY_GEAR_HERE,
      effect: {
        op: "if",
        condition: DEPLOY_GEAR_HERE,
        then: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});
