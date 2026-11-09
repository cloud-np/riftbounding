/** Scorched Earth (RAD-006) — "Deal 5 damage split among units at a single battlefield." (355.14) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Scorched Earth",
  text: "[Action] (Play on your turn or in showdowns.)\nDeal 5 damage split among units at a single battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "deal_split",
        amount: 5,
        target: {
          chosen: true,
          cardType: "unit",
          zone: "battlefield",
          group: { sameLocation: true },
        },
      },
    },
  ],
});
