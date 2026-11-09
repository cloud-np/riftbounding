/** Shard of Undoing. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Shard of Undoing",
  text: "The first time a friendly unit dies during your Beginning Phase each turn, each opponent must kill one of their units.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: { cardType: "unit", controller: "self" },
          condition: {
            kind: "and",
            conditions: [
              { kind: "is-phase", phase: "beginning" },
              { kind: "is-turn-player", player: "self" },
            ],
          },
        },
      },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "victim",
            selector: { cardType: "unit", controller: "opponent" },
            min: 1,
            max: 1,
            chooser: "opponent",
          },
          { op: "kill", target: { targetRef: "victim" } },
        ],
      },
    },
  ],
});
