/** Chemtech Cask. */
import { custom, registerCardScript, SELF } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Chemtech Cask",
  text: "When you play a spell on an opponent's turn, you may exhaust me to play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "played",
          player: "self",
          condition: {
            kind: "and",
            conditions: [
              custom("sfd:event-card-type", { type: "spell" }),
              { kind: "not", condition: { kind: "is-turn-player" } },
            ],
          },
        },
      },
      effect: { op: "cost_then", optional: true, cost: { exhaust: SELF }, effect: gold() },
    },
  ],
});
