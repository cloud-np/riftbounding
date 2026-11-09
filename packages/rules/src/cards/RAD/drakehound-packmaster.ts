/** Drakehound Packmaster. */
import type { Condition } from "@rift/protocol";
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { PLAY_OP_NOTE } from "./custom";

/**
 * Drakehound Packmaster (RAD-018) — "When you play me, reveal the top card of each opponent's Main
 * Deck. Choose one and banish it, then play it, ignoring its cost. Recycle the rest."
 */
const REVEALED: Condition = { kind: "in-ref", ref: "revealed" };

registerCardScript({
  name: "Drakehound Packmaster",
  text: "When you play me, reveal the top card of each opponent's Main Deck. Choose one and banish it, then play it, ignoring its cost. Recycle the rest.",
  status: "partial",
  notes: `The banished card is played, but ${PLAY_OP_NOTE}.`,
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "rad:reveal-top-each",
            params: { player: "opponent", key: "revealed" },
          },
          {
            op: "choose",
            key: "picked",
            selector: { zone: "deck", controller: "opponent", where: REVEALED },
          },
          { op: "banish", target: { targetRef: "picked" } },
          { op: "play", target: { targetRef: "picked" }, cost: "ignored" },
          {
            op: "recycle",
            target: {
              zone: "deck",
              controller: "opponent",
              where: REVEALED,
              excludeRefs: ["picked"],
            },
          },
        ],
      },
    },
  ],
});
