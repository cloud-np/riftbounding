/** Glasc Mixologist. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Glasc Mixologist",
  text: "[Deathknell] — You may play a unit with cost no more than [3] and no more than [Rune] from your trash, ignoring its cost. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "die", subject: SELF } },
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "revived",
            selector: {
              cardType: "unit",
              zone: "trash",
              owner: "self",
              energyCost: { op: "lte", value: 3 },
              powerCost: { op: "lte", value: 1 },
            },
            min: 1,
            max: 1,
          },
          { op: "play", target: { targetRef: "revived" }, cost: "ignored" },
        ],
      },
    },
  ],
});
