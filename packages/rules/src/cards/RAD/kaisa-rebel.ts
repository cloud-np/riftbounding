/** Kai'Sa, Rebel (RAD-063) — [Disarm]; while in a showdown, your spells have [Reaction]. */
import { whileModifier as conditional, notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Kai'Sa, Rebel",
  text: "[Disarm] (When I attack, give an enemy unit here -1[Might] this turn.)\nWhile I'm in a showdown, your spells have [Reaction]. (Play them any time, even before spells and abilities resolve.)",
  status: "partial",
  notes:
    '"Your spells have [Reaction]" is a passive keyword grant to cards in hand; the play layer\'s keyword array form does not see passives (801.3, 806).',
  abilities: [
    ...notIntrinsic("Reaction"),
    {
      kind: "passive",
      modifier: conditional(
        {
          kind: "or",
          conditions: [
            { kind: "is-state", state: "showdown_open" },
            { kind: "is-state", state: "showdown_closed" },
          ],
        },
        { kind: "keyword", keyword: "Reaction", target: { cardType: "spell", controller: "self" } },
      ),
    },
  ],
});
