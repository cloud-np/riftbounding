/** Wild Claw. */
import { custom, registerCardScript } from "../sdk";

const LOOKED_UNIT_OR_GEAR = {
  zone: "deck" as const,
  where: {
    kind: "and" as const,
    conditions: [{ kind: "in-ref" as const, ref: "looked" }, custom("ven:is-unit-or-gear")],
  },
};

registerCardScript({
  name: "Wild Claw",
  text: "Look at the top 5 cards of your Main Deck. You may banish a unit or gear from among them and play it, reducing its Energy cost by [5]. Recycle the rest. Then you may do this: Empower it. (It becomes Empowered if it's not already.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 5,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "chosen",
              selector: LOOKED_UNIT_OR_GEAR,
              min: 0,
              max: 1,
              label: "Banish a unit or gear and play it for [5] less?",
            },
            { op: "custom", id: "ven:wild-claw-play" },
          ],
        },
      },
    },
  ],
});
