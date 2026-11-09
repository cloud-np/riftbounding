/** Ashe, Focused. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Ashe, Focused",
  text: "When you play me, choose an opponent. They reveal their hand. Choose a card revealed this way and banish it. When they hold, return it to their hand (even if I'm no longer on the board).",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "reveal", target: { zone: "hand", controller: "opponent", all: true } },
          {
            op: "choose",
            key: "banished",
            selector: { zone: "hand", controller: "opponent" },
            min: 1,
            max: 1,
            chooser: "self",
          },
          { op: "banish", target: { targetRef: "banished" } },
          {
            op: "delayed",
            trigger: { kind: "event", event: { type: "hold", player: "opponent" } },
            effect: { op: "return_to_hand", target: { targetRef: "banished" } },
            duration: "permanent",
          },
        ],
      },
    },
  ],
});
