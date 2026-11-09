/** Gem Jammer. */
import { notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Gem Jammer",
  text: "When you play me, give a unit [GANKING] this turn. It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "grant_keyword", keyword: "Ganking", target: target(), duration: "this-turn" },
    },
  ],
});
