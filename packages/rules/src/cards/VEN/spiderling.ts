/** Spiderling. */
import { HERE, registerCardScript, SELF } from "../sdk";

const SPIDERLING = "Spiderling";

registerCardScript({
  name: "Spiderling",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nI have +1 [Might] for each other unit you control here with my name.\nYour deck can have any number of cards named Spiderling.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: {
          kind: "count",
          selector: {
            cardType: "unit",
            controller: "self",
            zone: HERE,
            name: SPIDERLING,
            excludeSource: true,
          },
        },
        target: SELF,
      },
    },
  ],
});
