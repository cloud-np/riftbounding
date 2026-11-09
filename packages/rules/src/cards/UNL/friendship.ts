/**
 * Friendship (UNL-046) — [Reaction]. "Give a unit +1 [Might] this turn for each of the following
 * tags among your units — Bird, Cat, Dog, and Poro." (143.1 tags; each tag counts once.)
 */
import type { Amount } from "@rift/protocol";
import { aUnit, registerCardScript } from "../sdk";

function hasTag(tag: string): Amount {
  return {
    kind: "min",
    amounts: [{ kind: "count", selector: { cardType: "unit", controller: "self", tag } }, 1],
  };
}

registerCardScript({
  name: "Friendship",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a unit. Give it +1[Might] this turn for each of the following tags among your units — Bird, Cat, Dog, and Poro.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: {
          kind: "sum",
          amounts: [hasTag("Bird"), hasTag("Cat"), hasTag("Dog"), hasTag("Poro")],
        },
        target: aUnit(),
      },
    },
  ],
});
