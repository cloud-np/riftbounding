/** Oasis Raider. */
import { notIntrinsic, registerCardScript, SELF } from "../sdk";
import { FEWER_RUNES } from "./custom";

registerCardScript({
  name: "Oasis Raider",
  text: "If you control fewer runes than an opponent at the start of your Beginning Phase, give me +2 [Might] and [Ganking] this turn. (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      condition: FEWER_RUNES,
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: SELF },
          { op: "grant_keyword", keyword: "Ganking", target: SELF, duration: "this-turn" },
        ],
      },
    },
  ],
});
