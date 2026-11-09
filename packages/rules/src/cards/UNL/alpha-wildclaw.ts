/** Alpha Wildclaw. */
import { HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Alpha Wildclaw",
  text: "[Tank] (I must be assigned combat damage first.)\nYour units here with less Might than me can't be chosen by enemy spells and abilities.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "restriction",
        restriction: "be-targeted:enemy",
        target: {
          cardType: "unit",
          controller: "self",
          zone: HERE,
          might: { op: "lt", value: { kind: "might", selector: SELF } },
        },
      },
    },
  ],
});
