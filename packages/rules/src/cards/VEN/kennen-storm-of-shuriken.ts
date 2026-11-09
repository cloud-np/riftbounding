/** Kennen, Storm of Shuriken. */
import { registerCardScript, WHEN_I_CONQUER, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Kennen, Storm of Shuriken",
  text: "When you play me, [Burn 2]. (Put the top 2 cards of your Main Deck into your trash.)\nWhen I conquer, give a spell in your trash [Flow] equal to its cost this turn. (You may play it from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "burn", amount: 2, target: {} } },
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      effect: {
        op: "grant_keyword",
        // 829.2: [Flow] equal to the spell's printed cost, usable from the trash this turn.
        keyword: "Flow",
        target: {
          chosen: true,
          cardType: "spell",
          zone: "trash",
          controller: "self",
          targetRef: "target:0",
        },
        duration: "this-turn",
      },
    },
  ],
});
