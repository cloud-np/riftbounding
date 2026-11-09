/** Star Spring. */
import { aUnit, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Star Spring",
  text: "The first time a player plays a non-token unit here each turn, they may move another unit they control here to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          zone: HERE,
          condition: {
            kind: "not",
            condition: { kind: "exists", selector: { targetRef: "event", token: true } },
          },
        },
      },
      limit: { kind: "once-per-turn" },
      optional: true,
      effect: {
        op: "move",
        target: aUnit({ controller: "self", zone: HERE, excludeRefs: ["event"] }),
        to: "base",
      },
    },
  ],
});
