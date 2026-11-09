/**
 * Portal Rescue (OGN-102, Origins errata) — "[ACTION] Banish a friendly unit, then its owner plays
 * it to their base, ignoring its cost."
 *
 * Banish (428), then a Limited Play (420.3) from the banishment zone ignoring its cost. Partial:
 * the `play` op plays as the ability's controller, so when the friendly unit is owned by another
 * player (e.g. taken with Possession) "its owner plays it" is left to the manual window.
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Portal Rescue",
  text: "[ACTION] (Play on your turn or in showdowns.)\nBanish a friendly unit, then its owner plays it to their base, ignoring its cost.",
  status: "partial",
  notes:
    "When the friendly unit is owned by another player, 'its owner plays it' resolves in the manual window: the play op (420.3) has no player parameter.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "target:0", owner: "self" } },
            then: {
              op: "play",
              target: { targetRef: "target:0" },
              cost: "ignored",
              location: "base",
            },
            else: { op: "custom", id: "manual" },
          },
        ],
      },
    },
  ],
});
