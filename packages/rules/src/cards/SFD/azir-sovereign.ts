/** Azir, Sovereign. */
import { custom, not, registerCardScript, WHEN_I_ATTACK } from "../sdk";
import { HERE_ZONE } from "./custom";

registerCardScript({
  name: "Azir, Sovereign",
  text: "[ACCELERATE] (You may pay [1][Order] as an additional cost to have me enter ready.)\nWhen I attack, you may move any number of your token units to this battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "tokens",
            selector: {
              cardType: "unit",
              controller: "self",
              token: true,
              where: not(custom("sfd:ref-here", { ref: "it" })),
            },
            min: 0,
            max: 99,
          },
          { op: "move", target: { targetRef: "tokens" }, to: HERE_ZONE },
        ],
      },
    },
  ],
});
