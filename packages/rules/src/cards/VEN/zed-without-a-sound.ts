/** Zed, Without a Sound. */
import { notIntrinsic, registerCardScript, SELF, token, WHEN_I_CONQUER } from "../sdk";

registerCardScript({
  name: "Zed, Without a Sound",
  text: 'When I conquer, play a 0 [Might] Shadow Clone unit token to your base. (It has "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn.")\n[Action] [1][Chaos]: Move me and a Shadow Clone you control to each other\'s locations.',
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: {
        op: "create",
        token: token("Shadow Clone", { might: 0, play: true, zone: "base" }),
      },
    },
    {
      kind: "activated",
      cost: { energy: 1, power: { Chaos: 1 } },
      keywords: ["action"],
      effect: {
        op: "swap",
        a: SELF,
        b: {
          chosen: true,
          cardType: "unit",
          name: "Shadow Clone",
          controller: "self",
          targetRef: "target:0",
        },
        property: "zone",
      },
    },
    ...notIntrinsic("Assault"),
  ],
});
