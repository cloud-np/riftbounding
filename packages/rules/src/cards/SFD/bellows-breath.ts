/** Bellows Breath. */
import type { Effect } from "@rift/protocol";
import { registerCardScript } from "../sdk";
import { target } from "./custom";

const DEAL_ONE_SAME_LOCATION: Effect = {
  op: "seq",
  effects: [
    { op: "deal", amount: 1, target: target({ maxCount: 1, targetRef: "target:0" }) },
    {
      op: "deal",
      amount: 1,
      target: target({
        maxCount: 2,
        targetRef: "target:1",
        sameLocationAs: "target:0",
        excludeRefs: ["target:0"],
      }),
    },
  ],
};

registerCardScript({
  name: "Bellows Breath",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat][1][Mind] (You may pay the additional cost to repeat this spell's effect.)\nDeal 1 to up to three units at the same location.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: DEAL_ONE_SAME_LOCATION }],
});
