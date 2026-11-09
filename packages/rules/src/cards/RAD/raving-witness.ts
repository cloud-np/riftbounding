/**
 * Raving Witness (RAD-074) — "When I move, reveal the top card of your Main Deck. If it's
 * [Mighty], draw it. Otherwise, recycle it." (A card off the board uses its printed Might, 710/711.)
 */
import { notIntrinsic, registerCardScript, WHEN_I_MOVE } from "../sdk";
import { drawCard } from "./custom";

registerCardScript({
  name: "Raving Witness",
  text: "When I move, reveal the top card of your Main Deck. If it's [Mighty], draw it. Otherwise, recycle it. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Mighty"),
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "reveal", target: { targetRef: "looked" } },
            {
              op: "if",
              condition: { kind: "exists", selector: { targetRef: "looked", mighty: true } },
              then: drawCard("looked"),
              else: { op: "recycle", target: { targetRef: "looked" } },
            },
          ],
        },
      },
    },
  ],
});
