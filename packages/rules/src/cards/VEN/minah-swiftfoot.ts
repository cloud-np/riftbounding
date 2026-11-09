/** Minah Swiftfoot. */
import { registerCardScript } from "../sdk";
import { WHEN_I_MOVE_TO_A_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Minah Swiftfoot",
  text: "When I move to a battlefield, choose one —\n- Each player discards 1. \n- Each player draws 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_A_BATTLEFIELD,
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "discard",
            label: "Each player discards 1.",
            effect: { op: "discard", amount: 1, player: "each" },
          },
          {
            id: "draw",
            label: "Each player draws 1.",
            effect: { op: "draw", amount: 1, player: "each" },
          },
        ],
      },
    },
  ],
});
