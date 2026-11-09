/** Fae Dragon. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { gold, target } from "./custom";

registerCardScript({
  name: "Fae Dragon",
  text: "When you play me, buff up to four friendly units. (Give each a +1 [Might] buff if it doesn't have one.)\nWhen you spend a buff, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "buff", target: target({ controller: "self", maxCount: 4 }) },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "spend_buff", player: "self" } },
      effect: gold(),
    },
  ],
});
