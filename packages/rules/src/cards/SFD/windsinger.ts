/** Windsinger. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Windsinger",
  text: "Hidden (Hide now for [Rune] to react with later for [0].)\nWhen you play me, you may return another unit at a battlefield with 3 [Might] or less to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "return_to_hand",
        target: target({ zone: "battlefield", might: { op: "lte", value: 3 }, excludeSelf: true }),
      },
    },
  ],
});
