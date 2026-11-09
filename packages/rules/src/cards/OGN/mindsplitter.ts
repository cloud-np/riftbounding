/**
 * Mindsplitter (OGN-192) — "When you play me, choose an opponent. They reveal their hand. Choose a
 * card from it, and they discard that card." (425 reveal; 423 discard by that player)
 *
 * The opponent is chosen on resolution (355.18; in a duel there is only one), then the controller
 * picks one card of the revealed hand and that player discards it.
 */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Mindsplitter",
  text: "When you play me, choose an opponent. They reveal their hand. Choose a card from it, and they discard that card.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "custom", id: "ogn:reveal-hand-discard-chosen" },
    },
  ],
});
