/**
 * Ntofo Strikes (RAD-148) — "Give a friendly unit [Shield 2] this turn, then deal damage equal to
 * its [Shield] to an enemy unit." (814.2: the summed Shield value)
 */
import { aUnit, registerCardScript } from "../sdk";
import { letX } from "./custom";

registerCardScript({
  name: "Ntofo Strikes",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a friendly unit [Shield 2] this turn, then deal damage equal to its [Shield] to an enemy unit. (A unit with Shield has +1 [Might] for each instance of Shield while it's a defender.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Shield",
            value: 2,
            target: aUnit({ controller: "self", targetRef: "target:0" }),
            duration: "this-turn",
          },
          {
            op: "for_each",
            selector: aUnit({ controller: "opponent", targetRef: "target:1" }),
            effect: letX(
              { keywordValue: "Shield", of: { targetRef: "target:0" } },
              { op: "deal", amount: { kind: "x" }, target: { targetRef: "it" } },
            ),
          },
        ],
      },
    },
  ],
});
