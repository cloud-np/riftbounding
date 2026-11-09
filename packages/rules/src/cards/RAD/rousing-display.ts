/** Rousing Display (RAD-127) — "[Show Off] … two Recruits, four if you showed off." (832) */
import { registerCardScript, SHOWED_OFF, showOff, token } from "../sdk";

registerCardScript({
  name: "Rousing Display",
  text: "[Show Off] a card with Energy cost [7] or more. (As you play this, you may reveal such a card from your hand or pick a friendly one.)\nPlay two 1 [Might] Recruit unit tokens to your base. If you showed off, play four to your base instead.",
  status: "implemented",
  abilities: [
    showOff({ energyCost: { op: "gte", value: 7 } }),
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: SHOWED_OFF,
        then: {
          op: "create",
          token: token("Recruit", { count: 4, might: 1, play: true }),
          zone: "base",
        },
        else: {
          op: "create",
          token: token("Recruit", { count: 2, might: 1, play: true }),
          zone: "base",
        },
      },
    },
  ],
});
