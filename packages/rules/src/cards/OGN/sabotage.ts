/**
 * Sabotage (OGN-156) — "Choose an opponent. They reveal their hand. Choose a non-unit card from it,
 * and recycle that card."
 *
 * The opponent is chosen when playing (355.7; the zero-card draw only registers that player
 * choice, 414 draws nothing). Their hand is revealed (425), then the controller picks a non-unit
 * card from it (355.18, not a target) and it is recycled to the bottom of its owner's deck (417).
 */
import { registerCardScript } from "../registry";
import { not } from "../dsl";

const OPPONENT = { kind: "chosen", ref: "opponent" } as const;

registerCardScript({
  name: "Sabotage",
  text: "Choose an opponent. They reveal their hand. Choose a non-unit card from it, and recycle that card.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 0, player: OPPONENT },
          { op: "reveal", target: { zone: "hand", owner: OPPONENT } },
          {
            op: "choose",
            key: "sabotaged",
            selector: {
              zone: "hand",
              owner: OPPONENT,
              where: not({ kind: "exists", selector: { targetRef: "it", cardType: "unit" } }),
            },
            min: 1,
            max: 1,
          },
          { op: "recycle", target: { targetRef: "sabotaged" } },
        ],
      },
    },
  ],
});
