/** Undertitan. */
import { notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Undertitan",
  text: "When you play me, give your other units +2 [Might] this turn.\nAs I'm revealed from your deck, [Add] [2].",
  status: "partial",
  notes:
    '"As I\'m revealed from your deck, [Add] [2]": abilities of cards in the Main Deck that act as they are revealed (385, 425) are not supported.',
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "temporary_might",
        amount: 2,
        target: { cardType: "unit", controller: "self", excludeSource: true },
      },
    },
  ],
});
