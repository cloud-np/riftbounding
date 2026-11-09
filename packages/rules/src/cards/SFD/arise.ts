/** Arise!. */
import { registerCardScript, token } from "../sdk";
import { countOf, EQUIPMENT, target } from "./custom";

registerCardScript({
  name: "Arise!",
  text: "Play a 2 [Might] Sand Soldier unit token for each Equipment you control. Then do this: Ready up to two of them.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "sfd:create-count",
            params: {
              amount: countOf({ ...EQUIPMENT, controller: "self" }),
              token: token("Sand Soldier", { might: 2, play: true }),
            },
          },
          // 387–389: "Then do this:" is a reflexive trigger; its choices are made as it finalizes.
          {
            op: "reflexive",
            effect: {
              op: "ready",
              target: target({ maxCount: 2, where: { kind: "in-ref", ref: "created" } }),
            },
          },
        ],
      },
    },
  ],
});
