/** K'Sante, Pride of Nazumah (RAD-147, legend) — [1], [Tap]: give a unit [Assault] equal to its [Shield]. */
import { aUnit, notIntrinsic, registerCardScript, SELF } from "../sdk";
import { letX } from "./custom";

registerCardScript({
  name: "K'Sante, Pride of Nazumah",
  text: '[1], [Tap]: Give a friendly unit "I have [Assault] equal to my [Shield]" this turn. (+1 [Might] for each instance of Assault while it\'s an attacker.)',
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: letX(
          { keywordValue: "Shield", of: { targetRef: "it" } },
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
    ...notIntrinsic("Assault", "Shield"),
  ],
});
