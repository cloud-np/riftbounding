/** Brawl (RAD-004) — "Give a unit [Assault] this turn equal to its Might." (807.1.c, 807.2) */
import { aUnit, registerCardScript } from "../sdk";
import { letX } from "./custom";

registerCardScript({
  name: "Brawl",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a unit [Assault] this turn equal to its Might. (+1 [Might] for each instance of Assault while it's an attacker.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit(),
        effect: letX(
          { amount: { kind: "might", selector: { targetRef: "it" } } },
          {
            op: "grant_keyword",
            keyword: "Assault",
            value: { kind: "x" },
            target: { targetRef: "it" },
            duration: "this-turn",
          },
        ),
      },
    },
  ],
});
